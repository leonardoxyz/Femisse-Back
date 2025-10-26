import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

interface OrderRecord {
  id: string;
}

interface OrderItemRecord {
  product_id: string | null;
  quantity: number | null;
  variant_size: string | null;
  variant_color: string | null;
}

interface ProductVariant {
  color?: string | null;
  sizes?: Array<{ size?: string | null; stock?: number | null }>;
}

interface ProductRecord {
  id: string;
  variants: ProductVariant[] | null;
}

const PROJECT_URL = Deno.env.get("PROJECT_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY");
const BACKEND_URL = Deno.env.get("BACKEND_URL");
const INTERNAL_API_TOKEN = Deno.env.get("INTERNAL_API_TOKEN");
const EXPIRATION_MINUTES = Number(Deno.env.get("ORDER_EXPIRATION_MINUTES") ?? "30");
const AUTO_CANCEL_REASON = "PIX expired";

if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing PROJECT_URL or SERVICE_ROLE_KEY env vars");
}

const SUPABASE_HEADERS = {
  "Content-Type": "application/json",
  apikey: SERVICE_ROLE_KEY ?? "",
  Authorization: `Bearer ${SERVICE_ROLE_KEY ?? ""}`,
};

const normalizeValue = (value: string | null | undefined): string | null => {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed.length === 0 ? null : trimmed;
};

const normalizeComparable = (value: string | null | undefined): string | null => {
  const normalized = normalizeValue(value);
  return normalized ? normalized.toLowerCase() : null;
};

type AggregatedOrderItem = {
  productId: string;
  quantity: number;
  variantColor: string | null;
  variantSize: string | null;
  normalizedColor: string | null;
  normalizedSize: string | null;
};

const aggregateItemsByVariant = (items: OrderItemRecord[]): AggregatedOrderItem[] => {
  const map = new Map<string, AggregatedOrderItem>();

  for (const rawItem of items) {
    const productId = normalizeValue(rawItem.product_id);
    const quantity = Number(rawItem.quantity ?? 0);
    const variantSize = normalizeValue(rawItem.variant_size);
    const variantColor = normalizeValue(rawItem.variant_color);

    if (!productId) {
      console.warn("Order item without product_id, skipping stock restoration", rawItem);
      continue;
    }

    if (!variantSize) {
      console.warn("Order item without variant_size, skipping stock restoration", rawItem);
      continue;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      console.warn("Order item with invalid quantity, skipping stock restoration", rawItem);
      continue;
    }

    const normalizedColor = normalizeComparable(variantColor) ?? "__no_color__";
    const normalizedSize = normalizeComparable(variantSize);
    if (!normalizedSize) {
      console.warn("Order item with invalid normalized size, skipping", rawItem);
      continue;
    }

    const key = `${productId}::${normalizedColor}::${normalizedSize}`;
    const existing = map.get(key);

    if (existing) {
      existing.quantity += quantity;
    } else {
      map.set(key, {
        productId,
        quantity,
        variantColor,
        variantSize,
        normalizedColor,
        normalizedSize,
      });
    }
  }

  return Array.from(map.values());
};

const cloneVariants = (variants: ProductVariant[] | null | undefined): ProductVariant[] => {
  if (!Array.isArray(variants)) return [];
  return JSON.parse(JSON.stringify(variants));
};

const findMatchingVariant = (variants: ProductVariant[], normalizedColor: string | null) => {
  return variants.find((variant) => {
    const comparable = normalizeComparable(variant?.color) ?? "__no_color__";
    return comparable === (normalizedColor ?? "__no_color__");
  }) ?? null;
};

const findMatchingSizeEntry = (variant: ProductVariant, normalizedSize: string | null) => {
  const sizes = Array.isArray(variant?.sizes) ? variant.sizes : [];
  return sizes.find((entry) => normalizeComparable(entry?.size) === normalizedSize) ?? null;
};

const buildInFilter = (ids: string[]): string => {
  if (ids.length === 0) return "";
  const quoted = ids.map((id) => `"${id}"`).join(",");
  return `in.(${quoted})`;
};

async function fetchExpiredPixOrders(cutoffIso: string): Promise<OrderRecord[]> {
  if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
    return [];
  }

  const params = new URLSearchParams({
    select: "id",
    status: "eq.pending",
    payment_method: "eq.pix",
    created_at: `lt.${cutoffIso}`,
  });

  const response = await fetch(`${PROJECT_URL}/rest/v1/orders?${params.toString()}`, {
    headers: SUPABASE_HEADERS,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Failed fetching expired orders", response.status, error);
    return [];
  }

  return (await response.json()) as OrderRecord[];
}

async function fetchOrderItems(orderId: string): Promise<OrderItemRecord[]> {
  if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
    return [];
  }

  const params = new URLSearchParams({
    select: "product_id,quantity,variant_size,variant_color",
  });
  params.set("order_id", `eq.${orderId}`);

  const response = await fetch(`${PROJECT_URL}/rest/v1/order_items?${params.toString()}`, {
    headers: SUPABASE_HEADERS,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Failed fetching order items for stock restoration", orderId, response.status, error);
    return [];
  }

  const data = (await response.json()) as OrderItemRecord[];
  return Array.isArray(data) ? data : [];
}

async function restoreStockFromItems(items: OrderItemRecord[]): Promise<void> {
  if (items.length === 0) {
    return;
  }

  const aggregatedItems = aggregateItemsByVariant(items);
  if (aggregatedItems.length === 0) {
    console.warn("No valid items to restore stock from aggregated data");
    return;
  }

  const productIds = Array.from(new Set(aggregatedItems.map((item) => item.productId)));
  const inFilter = buildInFilter(productIds);

  if (!inFilter) {
    return;
  }

  const params = new URLSearchParams({
    select: "id,variants",
    id: inFilter,
  });

  const response = await fetch(`${PROJECT_URL}/rest/v1/products?${params.toString()}`, {
    headers: SUPABASE_HEADERS,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Failed fetching products for stock restoration", response.status, error);
    return;
  }

  const products = (await response.json()) as ProductRecord[];
  const productsById = new Map<string, { updatedVariants: ProductVariant[]; touched: boolean }>();

  for (const product of products ?? []) {
    if (!product?.id) continue;
    productsById.set(product.id, {
      updatedVariants: cloneVariants(product.variants),
      touched: false,
    });
  }

  for (const item of aggregatedItems) {
    const context = productsById.get(item.productId);
    if (!context) {
      console.warn("Product not found during stock restoration", { productId: item.productId });
      continue;
    }

    const variant = findMatchingVariant(context.updatedVariants, item.normalizedColor);
    if (!variant) {
      console.warn("Variant color not found during stock restoration", {
        productId: item.productId,
        color: item.variantColor,
      });
      continue;
    }

    const sizeEntry = findMatchingSizeEntry(variant, item.normalizedSize);
    if (!sizeEntry) {
      console.warn("Variant size not found during stock restoration", {
        productId: item.productId,
        color: item.variantColor,
        size: item.variantSize,
      });
      continue;
    }

    const currentStock = Number(sizeEntry.stock ?? 0);
    const normalizedStock = Number.isFinite(currentStock) ? currentStock : 0;
    sizeEntry.stock = normalizedStock + item.quantity;
    context.touched = true;
  }

  for (const [productId, context] of productsById.entries()) {
    if (!context.touched) continue;

    const updateResponse = await fetch(`${PROJECT_URL}/rest/v1/products?id=eq.${productId}`, {
      method: "PATCH",
      headers: SUPABASE_HEADERS,
      body: JSON.stringify({ variants: context.updatedVariants }),
    });

    if (!updateResponse.ok) {
      const error = await updateResponse.text();
      console.error("Failed to update product variants during stock restoration", {
        productId,
        status: updateResponse.status,
        error,
      });
    }
  }
}

async function restoreOrderStock(orderId: string): Promise<void> {
  try {
    const items = await fetchOrderItems(orderId);
    if (items.length === 0) {
      console.warn("No order items found for stock restoration", { orderId });
      return;
    }
    await restoreStockFromItems(items);
  } catch (error) {
    console.error("Unexpected error while restoring stock for order", { orderId, error });
  }
}

async function cancelThroughBackend(orderId: string): Promise<boolean> {
  if (!BACKEND_URL || !INTERNAL_API_TOKEN) {
    return false;
  }

  const response = await fetch(`${BACKEND_URL}/api/internal/orders/${orderId}/auto-cancel`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-token": INTERNAL_API_TOKEN,
    },
    body: JSON.stringify({ reason: AUTO_CANCEL_REASON }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Backend cancellation failed", orderId, response.status, error);
    return false;
  }

  return true;
}

async function cancelDirectly(orderId: string): Promise<boolean> {
  if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
    return false;
  }

  await restoreOrderStock(orderId);

  const response = await fetch(`${PROJECT_URL}/rest/v1/orders?id=eq.${orderId}`, {
    method: "PATCH",
    headers: {
      ...SUPABASE_HEADERS,
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      status: "cancelled",
      payment_status: "cancelled",
      auto_cancelled_at: new Date().toISOString(),
      auto_cancel_reason: AUTO_CANCEL_REASON,
      updated_at: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Direct cancellation failed", orderId, response.status, error);
    return false;
  }

  return true;
}

serve(async () => {
  const now = Date.now();
  const cutoff = new Date(now - EXPIRATION_MINUTES * 60 * 1000).toISOString();

  const expiredOrders = await fetchExpiredPixOrders(cutoff);
  const totals = {
    checked: expiredOrders.length,
    cancelled: 0,
    failed: 0,
  };

  for (const { id } of expiredOrders) {
    let success = await cancelThroughBackend(id);

    if (!success) {
      console.warn("Backend auto-cancel failed, falling back to direct patch", { orderId: id });
      success = await cancelDirectly(id);
    }

    if (success) {
      totals.cancelled += 1;
    } else {
      totals.failed += 1;
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      data: totals,
      processedAt: new Date().toISOString(),
      cutoff,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
});
