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
  orderNumber: order.order_number,
  status: order.status,
  subtotal: order.subtotal,
  shippingCost: order.shipping_cost ?? 0,
  discount: order.discount ?? 0,
  total: order.total,
  paymentMethod: order.payment_method ?? null,
  shippingName: order.shipping_name ?? null,
  shippingStreet: order.shipping_street ?? null,
  shippingNumber: order.shipping_number ?? null,
  shippingComplement: order.shipping_complement ?? null,
  shippingNeighborhood: order.shipping_neighborhood ?? null,
  shippingCity: order.shipping_city ?? null,
  shippingState: order.shipping_state ?? null,
  shippingZipCode: order.shipping_zip_code ?? null,
  items: order.items ? order.items.map(toPublicOrderItem) : [],
  createdAt: order.created_at,
  updatedAt: order.updated_at,
});

const toPublicOrderList = (orders = []) =>
  (Array.isArray(orders) ? orders : []).map(toPublicOrder);

export {
  toPublicOrder,
  toPublicOrderList,
  toPublicOrderItem,
};
