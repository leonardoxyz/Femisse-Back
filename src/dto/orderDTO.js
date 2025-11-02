const toPublicOrderItem = (item) => ({
  productName: item.product_name,
  productImage: item.product_image ?? null,
  quantity: item.quantity,
  unitPrice: item.unit_price,
  subtotal: item.subtotal,
  variantSize: item.variant_size ?? null,
  variantColor: item.variant_color ?? null,
});

/**
 * Formata pedido para exibição pública
 * @param {object} order - Pedido do banco
 * @param {object} options - Opções de formatação
 * @param {boolean} options.includeFullAddress - Se deve incluir endereço completo (apenas para pedidos ativos)
 * @returns {object} Pedido formatado
 */
const toPublicOrder = (order, options = {}) => {
  const { includeFullAddress = false } = options;
  
  // Status que ainda precisam do endereço completo
  const needsFullAddress = ['pending', 'processing', 'payment_pending', 'paid'].includes(order.status);
  const shouldShowFullAddress = includeFullAddress || needsFullAddress;
  
  return {
    // 🔒 ID interno removido - usar order_number para identificação pública
    order_number: order.order_number,
    status: order.status,
    payment_status: order.payment_status,
    subtotal: order.subtotal,
    shipping_cost: order.shipping_cost ?? 0,
    discount: order.discount ?? 0,
    total: order.total,
    payment_method: order.payment_method ?? null,
    
    // Endereço: sempre mostrar cidade/estado
    shipping_city: order.shipping_city ?? null,
    shipping_state: order.shipping_state ?? null,
    
    // Endereço completo: apenas se necessário
    ...(shouldShowFullAddress && {
      shipping_name: order.shipping_name ?? null,
      shipping_street: order.shipping_street ?? null,
      shipping_number: order.shipping_number ?? null,
      shipping_complement: order.shipping_complement ?? null,
      shipping_neighborhood: order.shipping_neighborhood ?? null,
      shipping_zip_code: order.shipping_zip_code ?? null,
    }),
    
    items: order.items ? order.items.map(toPublicOrderItem) : [],
    created_at: order.created_at,
    updated_at: order.updated_at,
  };
};

const toPublicOrderList = (orders = []) =>
  (Array.isArray(orders) ? orders : []).map(toPublicOrder);

export {
  toPublicOrder,
  toPublicOrderList,
  toPublicOrderItem,
};
