const toPublicOrderItem = (item) => ({
  productName: item.product_name,
  productImage: item.product_image ?? null,
  quantity: item.quantity,
  unitPrice: item.unit_price,
  subtotal: item.subtotal,
  variantSize: item.variant_size ?? null,
  variantColor: item.variant_color ?? null,
});

const toPublicOrder = (order) => ({
  id: order.id,
  order_number: order.order_number,
  status: order.status,
  payment_status: order.payment_status,
  subtotal: order.subtotal,
  shipping_cost: order.shipping_cost ?? 0,
  discount: order.discount ?? 0,
  total: order.total,
  payment_method: order.payment_method ?? null,
  shipping_name: order.shipping_name ?? null,
  shipping_street: order.shipping_street ?? null,
  shipping_number: order.shipping_number ?? null,
  shipping_complement: order.shipping_complement ?? null,
  shipping_neighborhood: order.shipping_neighborhood ?? null,
  shipping_city: order.shipping_city ?? null,
  shipping_state: order.shipping_state ?? null,
  shipping_zip_code: order.shipping_zip_code ?? null,
  items: order.items ? order.items.map(toPublicOrderItem) : [],
  created_at: order.created_at,
  updated_at: order.updated_at,
});

const toPublicOrderList = (orders = []) =>
  (Array.isArray(orders) ? orders : []).map(toPublicOrder);

export {
  toPublicOrder,
  toPublicOrderList,
  toPublicOrderItem,
};
