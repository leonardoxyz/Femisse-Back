/**
 * ROTAS DE ENVIOS - MELHOR ENVIO
 */

import express from 'express';
import {
  initiateAuthorization,
  handleAuthCallback,
  checkAuthStatus,
  calculateShipping,
  listQuotes,
  createLabel,
  listLabels,
  getLabelById,
  generateLabelById,
  printLabelById,
  cancelLabelById,
  trackShipment,
  listLabelEvents
} from '../controllers/shippingController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limiters específicos
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // 10 requisições
  message: 'Muitas tentativas de autorização. Tente novamente mais tarde.'
});

const quoteLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 20, // 20 cotações por minuto
  message: 'Muitas cotações em pouco tempo. Aguarde um momento.'
});

const labelLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 10, // 10 etiquetas por 5 minutos
  message: 'Muitas criações de etiquetas. Aguarde um momento.'
});

// =====================================================
// AUTENTICAÇÃO OAUTH2
// =====================================================

/**
 * Inicia processo de autorização OAuth2
 * GET /api/shipping/auth/authorize
 */
router.get('/auth/authorize', authenticateToken, authLimiter, initiateAuthorization);

/**
 * Callback OAuth2 (recebe código de autorização)
 * GET /api/shipping/auth/callback
 * 
 * Esta rota é chamada pelo MelhorEnvio após autorização
 * Não requer autenticação pois vem de redirect externo
 */
router.get('/auth/callback', handleAuthCallback);

/**
 * Verifica status de autorização
 * GET /api/shipping/auth/status
 */
router.get('/auth/status', authenticateToken, checkAuthStatus);

// =====================================================
// COTAÇÃO DE FRETES
// =====================================================

/**
 * Calcula cotação de frete
 * POST /api/shipping/calculate
 * 
 * Body: {
 *   fromZipCode: string,
 *   toZipCode: string,
 *   products: [{
 *     id: string,
 *     width: number,
 *     height: number,
 *     length: number,
 *     weight: number,
 *     insuranceValue: number,
 *     quantity: number
 *   }],
 *   orderId?: string,
 *   receipt?: boolean,
 *   ownHand?: boolean,
 *   collect?: boolean
 * }
 */
router.post('/calculate', authenticateToken, quoteLimiter, calculateShipping);

/**
 * Lista cotações salvas
 * GET /api/shipping/quotes?order_id=xxx
 */
router.get('/quotes', authenticateToken, listQuotes);

// =====================================================
// ETIQUETAS DE ENVIO
// =====================================================

/**
 * Cria etiqueta de envio (adiciona ao carrinho MelhorEnvio)
 * POST /api/shipping/labels
 * 
 * Body: {
 *   orderId: string,
 *   serviceId: number,
 *   serviceName: string,
 *   companyId: number,
 *   companyName: string,
 *   quoteId?: string,
 *   from: {
 *     name, phone, email, document, companyDocument?, stateRegister?,
 *     street, number, complement?, neighborhood, city, state, zipCode
 *   },
 *   to: {
 *     name, phone, email, document,
 *     street, number, complement?, neighborhood, city, state, zipCode
 *   },
 *   products: [{name, quantity, unitaryValue, weight}],
 *   volumes: [{height, width, length, weight}],
 *   insuranceValue?: number,
 *   receipt?: boolean,
 *   ownHand?: boolean,
 *   collect?: boolean,
 *   reverse?: boolean,
 *   nonCommercial?: boolean,
 *   invoice?: {key: string},
 *   tags?: [{tag: string, url: string}]
 * }
 */
router.post('/labels', authenticateToken, labelLimiter, createLabel);

/**
 * Lista etiquetas do usuário
 * GET /api/shipping/labels?order_id=xxx&status=xxx
 */
router.get('/labels', authenticateToken, listLabels);

/**
 * Busca etiqueta por ID
 * GET /api/shipping/labels/:id
 */
router.get('/labels/:id', authenticateToken, getLabelById);

/**
 * Gera etiqueta (após pagamento)
 * POST /api/shipping/labels/:id/generate
 */
router.post('/labels/:id/generate', authenticateToken, generateLabelById);

/**
 * Imprime etiqueta (retorna URL do PDF)
 * POST /api/shipping/labels/:id/print
 */
router.post('/labels/:id/print', authenticateToken, printLabelById);

/**
 * Cancela etiqueta
 * POST /api/shipping/labels/:id/cancel
 * 
 * Body: {
 *   reason?: string
 * }
 */
router.post('/labels/:id/cancel', authenticateToken, cancelLabelById);

// =====================================================
// RASTREAMENTO
// =====================================================

/**
 * Rastreia envio
 * GET /api/shipping/track/:id
 */
router.get('/track/:id', authenticateToken, trackShipment);

/**
 * Lista eventos de rastreamento de uma etiqueta
 * GET /api/shipping/labels/:id/events
 */
router.get('/labels/:id/events', authenticateToken, listLabelEvents);

export default router;
