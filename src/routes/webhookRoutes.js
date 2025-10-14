/**
 * ROTAS DE WEBHOOKS
 */

import express from 'express';
import {
  handleMelhorEnvioWebhook,
  testWebhook
} from '../controllers/webhookController.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limiter para webhooks (mais permissivo)
const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 100, // 100 requisições por minuto
  message: 'Muitas requisições de webhook'
});

/**
 * Webhook do MelhorEnvio
 * POST /api/webhooks/melhorenvio
 * 
 * Esta rota é pública e será chamada pelo MelhorEnvio
 * A autenticação é feita via assinatura HMAC no header X-ME-Signature
 * 
 * Headers:
 *   X-ME-Signature: string (HMAC-SHA256)
 * 
 * Body: {
 *   event: string, // order.created, order.posted, order.delivered, etc.
 *   data: {
 *     id: string,
 *     protocol: string,
 *     status: string,
 *     tracking: string,
 *     tracking_url: string,
 *     ...
 *   }
 * }
 */
router.post('/melhorenvio', webhookLimiter, handleMelhorEnvioWebhook);

/**
 * Testa webhook (apenas desenvolvimento)
 * POST /api/webhooks/melhorenvio/test
 * 
 * Body: {
 *   labelId: string,
 *   eventType: string // order.posted, order.delivered, etc.
 * }
 */
router.post('/melhorenvio/test', testWebhook);

export default router;
