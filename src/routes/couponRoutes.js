import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware.js';
import rateLimit from 'express-rate-limit';
import {
  validateCoupon,
  listActiveCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  getUserCouponHistory
} from '../controllers/couponController.js';

const router = express.Router();

// Rate limiter para validação de cupons (evitar spam)
const couponValidationRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20, // 20 tentativas de validação por IP
  message: 'Muitas tentativas de validação de cupom. Tente novamente mais tarde.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter para criação de cupons (admin)
const couponCreationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 50, // 50 criações por hora
  message: 'Limite de criação de cupons atingido.',
  standardHeaders: true,
  legacyHeaders: false,
});

// ========== ROTAS PÚBLICAS ==========

// Listar cupons ativos (público - sem autenticação)
router.get('/active', listActiveCoupons);

// ========== ROTAS AUTENTICADAS ==========

// Validar cupom (usuário autenticado)
router.post('/validate',
  couponValidationRateLimit,
  authenticateToken,
  validateCoupon
);

// Histórico de cupons do usuário
router.get('/my-history',
  authenticateToken,
  getUserCouponHistory
);

// ========== ROTAS ADMIN ==========

// Criar cupom (apenas admin)
router.post('/',
  couponCreationRateLimit,
  authenticateToken,
  requireAdmin,
  createCoupon
);

// Atualizar cupom (apenas admin)
router.put('/:id',
  authenticateToken,
  requireAdmin,
  updateCoupon
);

// Deletar cupom (apenas admin)
router.delete('/:id',
  authenticateToken,
  requireAdmin,
  deleteCoupon
);

export default router;
