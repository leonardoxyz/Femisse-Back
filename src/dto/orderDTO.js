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

const toAdminOrderItem = (item) => ({
  id: item.id,
  orderId: item.order_id,
  productId: item.product_id,
  productName: item.product_name,
  productImage: item.product_image ?? null,
  quantity: item.quantity,
  unitPrice: item.unit_price,
  subtotal: item.subtotal,
  variantSize: item.variant_size ?? null,
  variantColor: item.variant_color ?? null,
});

const toAdminOrder = (order) => ({
  id: order.id,
  usuarioId: order.usuario_id,
  orderNumber: order.order_number,
  status: order.status,
  subtotal: order.subtotal,
  shippingCost: order.shipping_cost ?? 0,
  discount: order.discount ?? 0,
  couponDiscount: order.coupon_discount ?? 0,
  total: order.total,
  paymentMethod: order.payment_method ?? null,
  paymentStatus: order.payment_status ?? null,
  shippingName: order.shipping_name ?? null,
  shippingStreet: order.shipping_street ?? null,
  shippingNumber: order.shipping_number ?? null,
  shippingComplement: order.shipping_complement ?? null,
  shippingNeighborhood: order.shipping_neighborhood ?? null,
  shippingCity: order.shipping_city ?? null,
  shippingState: order.shipping_state ?? null,
  shippingZipCode: order.shipping_zip_code ?? null,
  items: order.items ? order.items.map(toAdminOrderItem) : [],
  createdAt: order.created_at,
  updatedAt: order.updated_at,
});

const toAdminOrderList = (orders = []) =>
  (Array.isArray(orders) ? orders : []).map(toAdminOrder);

const validateOrderInput = (input) => {
  const errors = [];

  if (!input) {
    errors.push({ field: 'body', message: 'Dados do pedido são obrigatórios' });
    return { isValid: false, errors };
  }

  if (!input.items || !Array.isArray(input.items) || input.items.length === 0) {
    errors.push({ field: 'items', message: 'Itens do pedido são obrigatórios' });
  }

  if (!input.shipping) {
    errors.push({ field: 'shipping', message: 'Dados de entrega são obrigatórios' });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

export {
  toPublicOrder,
  toPublicOrderList,
  toPublicOrderItem,
  toAdminOrder,
  toAdminOrderList,
  toAdminOrderItem,
  validateOrderInput,
};
