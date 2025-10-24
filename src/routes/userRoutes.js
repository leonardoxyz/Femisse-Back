import express from 'express';
import {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  updateMyProfile,
  getMyProfile,
} from '../controllers/userController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  userCreateSchema,
  userUpdateSchema,
  userParamsSchema,
  profileUpdateSchema,
} from '../validators/userSchemas.js';
import { createRateLimit } from '../middleware/rateLimit.js';

const router = express.Router();

// ✅ Rate limit geral para todas as rotas de usuário
router.use(createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requisições por janela
  message: {
    error: 'Muitas requisições',
    message: 'Você excedeu o limite de requisições. Tente novamente em 15 minutos.',
    retryAfter: '15 minutos'
  },
  standardHeaders: true, // Retorna info de rate limit nos headers
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Conta todas as requisições
  skipFailedRequests: false,
  keyGenerator: (req) => req.ip,
}));

// Rotas do usuário autenticado (devem vir antes das rotas com parâmetros)
// ✅ Rate limit específico para verificação de CPF
router.get('/profile', 
  authenticateToken, 
  createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 30, // 30 requisições por janela
    message: {
      error: 'Muitas tentativas de verificação',
      message: 'Você excedeu o limite de verificações. Tente novamente em 15 minutos.',
      retryAfter: '15 minutos'
    },
    standardHeaders: true, // Retorna info de rate limit nos headers
    legacyHeaders: false,
    skipSuccessfulRequests: false, // Conta todas as requisições
    skipFailedRequests: false,
    keyGenerator: (req) => req.ip,
  }),
  getMyProfile
);

// ✅ Rate limit mais restritivo para atualização de CPF
router.put(
  '/profile',
  authenticateToken,
  createRateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 5, // 5 requisições por janela
    message: {
      error: 'Muitas tentativas de atualização',
      message: 'Você excedeu o limite de atualizações. Tente novamente em 1 hora.',
      retryAfter: '1 hora'
    },
    standardHeaders: true, // Retorna info de rate limit nos headers
    legacyHeaders: false,
    skipSuccessfulRequests: false, // Conta todas as requisições
    skipFailedRequests: false,
    keyGenerator: (req) => req.ip,
  }),
  validateRequest(profileUpdateSchema),
  updateMyProfile
);

// Rotas administrativas para gerenciamento de usuários
router.get('/', listUsers); // Listar todos os usuários (admin)
router.post('/', validateRequest(userCreateSchema), createUser); // Criar novo usuário (registro)

// Rotas específicas por ID (devem vir por último)
router.get('/:id', validateRequest(userParamsSchema, 'params'), getUserById); // Buscar usuário por ID (admin)
router.put(
  '/:id',
  validateRequest(userParamsSchema, 'params'),
  validateRequest(userUpdateSchema),
  updateUser
); // Atualizar usuário por ID (admin)
router.delete(
  '/:id',
  validateRequest(userParamsSchema, 'params'),
  deleteUser
); // Deletar usuário por ID (admin)

export default router;
