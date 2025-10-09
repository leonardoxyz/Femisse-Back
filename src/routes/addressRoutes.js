import express from 'express';
import { listAddresses, getAddressById, createAddress, updateAddress, deleteAddress, listMyAddresses } from '../controllers/addressController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { strictRateLimit } from '../middleware/validationMiddleware.js';
import {
  addressCreateSchema,
  addressUpdateSchema,
  addressParamsSchema,
  addressListQuerySchema,
} from '../validators/addressSchemas.js';

const router = express.Router();

// Rate limiting mais restrito para operações de endereço
router.use(strictRateLimit);

// Rotas administrativas (sem autenticação para listagem geral)
router.get('/', validateRequest(addressListQuerySchema, 'query'), listAddresses);

// Rotas do usuário autenticado (devem vir antes das rotas com parâmetros)
router.get('/my', authenticateToken, listMyAddresses);
router.post(
  '/my',
  authenticateToken,
  validateRequest(addressCreateSchema),
  createAddress
);

// Rotas específicas por ID (devem vir por último)
router.get(
  '/:id',
  authenticateToken,
  validateRequest(addressParamsSchema, 'params'),
  getAddressById
);
router.put(
  '/:id',
  authenticateToken,
  validateRequest(addressParamsSchema, 'params'),
  validateRequest(addressUpdateSchema),
  updateAddress
);
router.delete(
  '/:id',
  authenticateToken,
  validateRequest(addressParamsSchema, 'params'),
  deleteAddress
);

export default router;
