import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { 
  validatePaymentData, 
  verifyOrderIntegrity, 
  logPaymentAttempt,
  paymentRateLimit 
} from '../middleware/paymentMiddleware.js';
import { 
  createPaymentPreference, 
  processDirectPayment, 
  handleWebhook, 
  getPaymentStatus,
  getPendingPaymentByOrder,
} from '../controllers/paymentController.js';
import { validateRequest, schemas } from '../middleware/validationMiddleware.js';

const router = express.Router();

// Rota para criar preferência de pagamento (checkout pro/transparente)
router.post('/preference', 
  paymentRateLimit, // Rate limit apenas em rotas de criação
  authenticateToken,
  validatePaymentData,
  verifyOrderIntegrity,
  logPaymentAttempt,
  createPaymentPreference
);

// Rota para pagamento direto (PIX, cartão)
router.post('/process',
  paymentRateLimit, // Rate limit apenas em rotas de criação
  authenticateToken,
  validatePaymentData,
  verifyOrderIntegrity,
  logPaymentAttempt,
  processDirectPayment
);

// Webhook do Mercado Pago (sem autenticação - vem do MP)
router.post('/webhook', handleWebhook);

// Consultar status de pagamento (SEM rate limit - é apenas consulta)
router.get('/status/:payment_id',
  authenticateToken,
  getPaymentStatus
);

router.get('/order/:orderId/pending',
  authenticateToken,
  getPendingPaymentByOrder
);

// Rota para obter chave pública do MP (sem autenticação e sem rate limit)
router.get('/public-key', (req, res) => {
  res.json({ 
    public_key: process.env.MERCADO_PAGO_PUBLIC_KEY 
  });
});

export default router;
