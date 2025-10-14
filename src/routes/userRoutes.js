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
import {
  cpfVerificationLimiter,
  cpfUpdateLimiter,
  userRoutesLimiter
} from '../middleware/cpfRateLimit.js';

const router = express.Router();

// ✅ Rate limit geral para todas as rotas de usuário
router.use(userRoutesLimiter);

// Rotas do usuário autenticado (devem vir antes das rotas com parâmetros)
// ✅ Rate limit específico para verificação de CPF
router.get('/profile', 
  authenticateToken, 
  cpfVerificationLimiter,  // 30 req / 15min
  getMyProfile
);

// ✅ Rate limit mais restritivo para atualização de CPF
router.put(
  '/profile',
  authenticateToken,
  cpfUpdateLimiter,  // 5 req / hora
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
