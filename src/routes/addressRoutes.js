import express from 'express';
import { listAddresses, getAddressById, createAddress, updateAddress, deleteAddress, listMyAddresses } from '../controllers/addressController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  addressCreateSchema,
  addressUpdateSchema,
  addressParamsSchema,
  addressListQuerySchema,
} from '../validators/addressSchemas.js';

const router = express.Router();

// Rotas administrativas (sem autenticação para listagem geral)
router.get('/', validateRequest(addressListQuerySchema, 'query'), listAddresses);

// Rotas do usuário autenticado (devem vir antes das rotas com parâmetros)
router.get('/user/addresses', authenticateToken, listMyAddresses);
router.post(
  '/user/addresses',
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
