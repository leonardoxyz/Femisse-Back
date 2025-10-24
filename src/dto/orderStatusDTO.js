/**
 * DTO para Status de Pedidos - Formata histórico de status
 */

/**
 * Formata status de pedido
 */
export const toOrderStatus = (status) => ({
  id: status.id,
  order_id: status.order_id,
  status: status.status,
  description: status.description || null,
  updated_by: status.updated_by || null,
  notes: status.notes || null,
  created_at: status.created_at,
});

/**
 * Formata lista de status (histórico)
 */
export const toOrderStatusHistory = (statusList) => {
  if (!Array.isArray(statusList)) return [];
  
  return statusList
    .map(toOrderStatus)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); // Mais recente primeiro
};

/**
 * Formata resposta de atualização de status
 */
export const toStatusUpdateResponse = (status, order) => ({
  order_id: order.id,
  previous_status: order.status,
  new_status: status.status,
  description: status.description || null,
  updated_at: status.created_at,
  message: 'Status do pedido atualizado com sucesso',
});

/**
 * Formata status atual do pedido (simplificado)
 */
export const toCurrentOrderStatus = (order) => ({
  order_id: order.id,
  status: order.status,
  status_description: getStatusDescription(order.status),
  last_updated: order.updated_at,
});

/**
 * Formata lista de pedidos com status
 */
export const toOrdersWithStatus = (orders) => {
  if (!Array.isArray(orders)) return [];
  return orders.map(toCurrentOrderStatus);
};

/**
 * Helper: Descrições de status em português
 */
function getStatusDescription(status) {
  const descriptions = {
    'pending': 'Pedido pendente',
    'processing': 'Processando pedido',
    'confirmed': 'Pedido confirmado',
    'paid': 'Pagamento confirmado',
    'preparing': 'Preparando para envio',
    'shipped': 'Pedido enviado',
    'delivered': 'Pedido entregue',
    'cancelled': 'Pedido cancelado',
    'refunded': 'Pedido reembolsado',
  };
  
  return descriptions[status] || status;
}
