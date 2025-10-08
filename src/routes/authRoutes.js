import express from 'express';
import { register, login, logout, refreshToken } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limiting específico para autenticação
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 tentativas
  message: {
    error: 'Muitas tentativas',
    message: 'Tente novamente em 15 minutos',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // 3 registros
  message: {
    error: 'Muitas tentativas de registro',
    message: 'Tente novamente em 1 hora',
  },
});

// Rotas públicas
router.post('/register', registerLimiter, register);
router.post('/login', authLimiter, login);
router.post('/refresh-token', refreshToken);

// Rotas protegidas
router.post('/logout', authenticateToken, logout);

export default router;
