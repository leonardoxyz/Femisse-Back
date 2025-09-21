import express from 'express';
import { listAddresses, getAddressById, createAddress, updateAddress, deleteAddress, listMyAddresses } from '../controllers/addressController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Rotas administrativas (sem autenticação para listagem geral)
router.get('/', listAddresses);

// Rotas do usuário autenticado (devem vir antes das rotas com parâmetros)
router.get('/user/addresses', authenticateToken, listMyAddresses);
router.post('/user/addresses', authenticateToken, createAddress);

// Rotas específicas por ID (devem vir por último)
router.get('/:id', authenticateToken, getAddressById);
router.put('/:id', authenticateToken, updateAddress);
router.delete('/:id', authenticateToken, deleteAddress);

export default router;
