/**
 * DTO para Webhooks - Formata respostas de webhooks
 */

/**
 * Formata resposta de webhook processado
 */
export const toWebhookResponse = (processed = true, message = 'Webhook processado com sucesso') => ({
  acknowledged: processed,
  message,
  timestamp: new Date().toISOString(),
});

/**
 * Formata evento de webhook para log
 */
export const toWebhookEvent = (webhook) => ({
  id: webhook.id,
  type: webhook.type,
  resource: webhook.resource || null,
  resource_id: webhook.resource_id || null,
  status: webhook.status,
  processed: webhook.processed || false,
  processed_at: webhook.processed_at || null,
  payload_summary: {
    action: webhook.payload?.action || null,
    status: webhook.payload?.status || null,
  },
  created_at: webhook.created_at,
});

/**
 * Formata lista de webhooks
 */
export const toWebhookEventList = (webhooks) => {
  if (!Array.isArray(webhooks)) return [];
  return webhooks.map(toWebhookEvent);
};

/**
 * Formata erro de webhook
 */
export const toWebhookError = (error, details = null) => ({
  acknowledged: false,
  error,
  details: details || 'Erro ao processar webhook',
  timestamp: new Date().toISOString(),
});
