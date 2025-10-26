import supabase from './supabaseClient.js';
import {
  cacheDelete,
  cacheGetSetMembers,
  cacheClearSet,
} from './cacheService.js';
import { logger } from '../utils/logger.js';

const PRODUCTS_LIST_KEYS_SET = 'cache:products:list-keys';
const getProductDetailCacheKey = (id) => `cache:products:detail:${id}`;

const normalizeValue = (value) => {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed.length === 0 ? null : trimmed;
};

const normalizeComparable = (value) => {
  const normalized = normalizeValue(value);
  return normalized ? normalized.toLowerCase() : null;
};

const sumVariantStock = (variants = []) => {
  if (!Array.isArray(variants) || variants.length === 0) return 0;

  return variants.reduce((variantTotal, variant) => {
    const sizes = Array.isArray(variant?.sizes) ? variant.sizes : [];
    const sizeStock = sizes.reduce((sizeTotal, sizeEntry) => {
      const stock = Number(sizeEntry?.stock);
      if (!Number.isFinite(stock) || stock < 0) return sizeTotal;
      return sizeTotal + stock;
    }, 0);
    return variantTotal + sizeStock;
  }, 0);
};

const aggregateItemsByVariant = (items) => {
  const map = new Map();

  for (const rawItem of items) {
    const productId = rawItem.product_id;
    const quantity = Number(rawItem.quantity) || 0;
    const variantSize = normalizeValue(rawItem.variant_size);
    const variantColor = normalizeValue(rawItem.variant_color);

    if (!productId) {
      throw new StockReservationError('Produto inválido no pedido.', {
        code: 'INVALID_PRODUCT_ID',
        item: rawItem,
      });
    }

    if (!variantSize) {
      throw new StockReservationError('Tamanho não informado para o item do pedido.', {
        code: 'MISSING_VARIANT_SIZE',
        productId,
        item: rawItem,
      });
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new StockReservationError('Quantidade inválida para item do pedido.', {
        code: 'INVALID_QUANTITY',
        productId,
        item: rawItem,
      });
    }

    const key = `${productId}::${normalizeComparable(variantColor) ?? '__no_color__'}::${normalizeComparable(variantSize)}`;
    const existing = map.get(key);

    if (existing) {
      existing.quantity += quantity;
    } else {
      map.set(key, {
        productId,
        quantity,
        variantColor,
        variantSize,
        normalizedColor: normalizeComparable(variantColor),
        normalizedSize: normalizeComparable(variantSize),
      });
    }
  }

  return Array.from(map.values());
};

const cloneVariants = (variants) => JSON.parse(JSON.stringify(Array.isArray(variants) ? variants : []));

const findMatchingVariant = (variants, normalizedColor) => {
  return variants.find((variant) => {
    const variantColorComparable = normalizeComparable(variant?.color);
    return variantColorComparable === normalizedColor;
  });
};

const findMatchingSizeEntry = (variant, normalizedSize) => {
  const sizes = Array.isArray(variant?.sizes) ? variant.sizes : [];
  return sizes.find((entry) => normalizeComparable(entry?.size) === normalizedSize);
};

const invalidateProductCaches = async (productId) => {
  const detailKey = getProductDetailCacheKey(productId);
  await cacheDelete(detailKey);

  const listKeys = await cacheGetSetMembers(PRODUCTS_LIST_KEYS_SET);
  if (Array.isArray(listKeys) && listKeys.length > 0) {
    await cacheDelete(listKeys);
  }
  await cacheClearSet(PRODUCTS_LIST_KEYS_SET);
};

export class StockReservationError extends Error {
  constructor(message, { code = 'STOCK_RESERVATION_ERROR', details = null } = {}) {
    super(message);
    this.name = 'StockReservationError';
    this.code = code;
    this.details = details;
  }
}

export const reserveProductVariantsStock = async (orderItems = []) => {
  if (!Array.isArray(orderItems) || orderItems.length === 0) {
    return { snapshots: [] };
  }

  const aggregatedItems = aggregateItemsByVariant(orderItems);
  const productIds = Array.from(new Set(aggregatedItems.map((item) => item.productId)));

  const { data: products, error } = await supabase
    .from('products')
    .select('id, variants')
    .in('id', productIds);

  if (error) {
    logger.error({ err: error, productIds }, 'Erro ao buscar produtos para reservar estoque');
    throw new StockReservationError('Falha ao consultar produtos para reservar estoque.', {
      code: 'PRODUCT_QUERY_FAILED',
      details: error.message,
    });
  }

  const productsById = new Map();
  for (const product of products || []) {
    productsById.set(product.id, {
      originalVariants: cloneVariants(product.variants),
      updatedVariants: cloneVariants(product.variants),
      touched: false,
    });
  }

  for (const item of aggregatedItems) {
    const context = productsById.get(item.productId);
    if (!context) {
      throw new StockReservationError('Produto não encontrado para reserva de estoque.', {
        code: 'PRODUCT_NOT_FOUND',
        details: { productId: item.productId },
      });
    }

    const variant = findMatchingVariant(context.updatedVariants, item.normalizedColor);
    if (!variant) {
      throw new StockReservationError('Variação de cor não encontrada para o produto.', {
        code: 'VARIANT_COLOR_NOT_FOUND',
        details: {
          productId: item.productId,
          color: item.variantColor,
        },
      });
    }

    const sizeEntry = findMatchingSizeEntry(variant, item.normalizedSize);
    if (!sizeEntry) {
      throw new StockReservationError('Tamanho da variante não encontrado para o produto.', {
        code: 'VARIANT_SIZE_NOT_FOUND',
        details: {
          productId: item.productId,
          color: item.variantColor,
          size: item.variantSize,
        },
      });
    }

    const currentStock = Number(sizeEntry.stock);
    if (!Number.isFinite(currentStock) || currentStock < item.quantity) {
      throw new StockReservationError('Estoque insuficiente para a variante selecionada.', {
        code: 'INSUFFICIENT_STOCK',
        details: {
          productId: item.productId,
          color: item.variantColor,
          size: item.variantSize,
          requested: item.quantity,
          available: Number.isFinite(currentStock) ? currentStock : 0,
        },
      });
    }

    sizeEntry.stock = currentStock - item.quantity;
    context.touched = true;
  }

  const snapshots = [];

  for (const [productId, context] of productsById.entries()) {
    if (!context.touched) continue;

    const { updatedVariants, originalVariants } = context;
    const { error: updateError } = await supabase
      .from('products')
      .update({ variants: updatedVariants })
      .eq('id', productId);

    if (updateError) {
      logger.error({ err: updateError, productId }, 'Erro ao atualizar estoque de variantes');
      throw new StockReservationError('Falha ao atualizar estoque do produto.', {
        code: 'VARIANT_UPDATE_FAILED',
        details: updateError.message,
      });
    }

    snapshots.push({ productId, variants: originalVariants });
    await invalidateProductCaches(productId);
  }

  return { snapshots };
};

export const releaseProductVariantsStock = async (orderItems = []) => {
  if (!Array.isArray(orderItems) || orderItems.length === 0) {
    return;
  }

  let aggregatedItems;
  try {
    aggregatedItems = aggregateItemsByVariant(orderItems);
  } catch (error) {
    logger.error({ err: error }, 'Erro ao agregar itens para restaurar estoque');
    return;
  }

  if (aggregatedItems.length === 0) {
    return;
  }

  const productIds = Array.from(new Set(aggregatedItems.map((item) => item.productId)));

  const { data: products, error } = await supabase
    .from('products')
    .select('id, variants')
    .in('id', productIds);

  if (error) {
    logger.error({ err: error, productIds }, 'Erro ao buscar produtos para restaurar estoque');
    return;
  }

  const productsById = new Map();
  for (const product of products || []) {
    productsById.set(product.id, {
      updatedVariants: cloneVariants(product.variants),
      touched: false,
    });
  }

  for (const item of aggregatedItems) {
    const context = productsById.get(item.productId);
    if (!context) {
      logger.warn({ productId: item.productId }, 'Produto não encontrado ao restaurar estoque');
      continue;
    }

    const variant = findMatchingVariant(context.updatedVariants, item.normalizedColor);
    if (!variant) {
      logger.warn({
        productId: item.productId,
        color: item.variantColor,
      }, 'Variação de cor não encontrada ao restaurar estoque');
      continue;
    }

    const sizeEntry = findMatchingSizeEntry(variant, item.normalizedSize);
    if (!sizeEntry) {
      logger.warn({
        productId: item.productId,
        color: item.variantColor,
        size: item.variantSize,
      }, 'Tamanho não encontrado ao restaurar estoque');
      continue;
    }

    const currentStock = Number(sizeEntry.stock);
    const normalizedCurrentStock = Number.isFinite(currentStock) ? currentStock : 0;
    sizeEntry.stock = normalizedCurrentStock + item.quantity;
    context.touched = true;
  }

  for (const [productId, context] of productsById.entries()) {
    if (!context.touched) continue;

    const { error: updateError } = await supabase
      .from('products')
      .update({ variants: context.updatedVariants })
      .eq('id', productId);

    if (updateError) {
      logger.error({ err: updateError, productId }, 'Erro ao restaurar estoque de produto');
      continue;
    }

    await invalidateProductCaches(productId);
  }
};

export const restoreProductVariantsStock = async (snapshots = []) => {
  if (!Array.isArray(snapshots) || snapshots.length === 0) {
    return;
  }

  for (const snapshot of snapshots) {
    if (!snapshot?.productId) continue;
    const { error } = await supabase
      .from('products')
      .update({ variants: snapshot.variants })
      .eq('id', snapshot.productId);

    if (error) {
      logger.error({ err: error, productId: snapshot.productId }, 'Erro ao restaurar estoque de produto');
      continue;
    }

    await invalidateProductCaches(snapshot.productId);
  }
};
