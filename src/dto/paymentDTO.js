/**
 * DTO para Pagamentos - Formata respostas de pagamento
 */

/**
 * Formata preferência de pagamento (Mercado Pago)
 */
export const toPaymentPreferenceResponse = (preference, order) => ({
  preference_id: preference.id,
  order_id: order.id,
  init_point: preference.init_point,
  sandbox_init_point: preference.sandbox_init_point,
  payment_methods: {
    excluded_payment_methods: preference.payment_methods?.excluded_payment_methods || [],
    excluded_payment_types: preference.payment_methods?.excluded_payment_types || [],
    installments: preference.payment_methods?.installments || null,
  },
});

/**
 * Formata status de pagamento
 */
export const toPaymentStatus = (payment) => ({
  id: payment.id,
  order_id: payment.order_id,
  status: payment.status,
  payment_method: payment.payment_method,
  total_amount: payment.total_amount,
  paid_at: payment.paid_at || null,
  created_at: payment.created_at,
  updated_at: payment.updated_at,
});

/**
 * Formata detalhes de pagamento (completo)
 */
export const toPaymentDetails = (payment) => ({
  id: payment.id,
  order_id: payment.order_id,
  external_payment_id: payment.external_payment_id || null,
  status: payment.status,
  payment_method: payment.payment_method,
  payment_type: payment.payment_type || null,
  total_amount: payment.total_amount,
  paid_amount: payment.paid_amount || null,
  currency: payment.currency || 'BRL',
  installments: payment.installments || 1,
  payer_email: payment.payer_email || null,
  paid_at: payment.paid_at || null,
  created_at: payment.created_at,
  updated_at: payment.updated_at,
});

/**
 * Formata lista de pagamentos
 */
export const toPaymentList = (payments) => {
  if (!Array.isArray(payments)) return [];
  return payments.map(toPaymentStatus);
};

/**
 * Formata resposta de PIX
 */
export const toPixPaymentResponse = (pixData, payment) => ({
  payment_id: payment.id,
  order_id: payment.order_id,
  qr_code: pixData.qr_code,
  qr_code_base64: pixData.qr_code_base64,
  transaction_id: pixData.transaction_id,
  expiration_date: pixData.expiration_date,
  amount: payment.total_amount,
});

/**
 * Formata resposta de webhook de pagamento
 */
export const toPaymentWebhookResponse = (acknowledged = true) => ({
  acknowledged,
  timestamp: new Date().toISOString(),
});
