import express from 'express';
import { listUsers, getUserById, createUser, updateUser, deleteUser, updateMyProfile } from '../controllers/userController.js';
import { listMyAddresses } from '../controllers/addressController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Rotas protegidas (requerem autenticação)
router.get('/me/addresses', authenticateToken, listMyAddresses);
router.put('/me/profile', authenticateToken, updateMyProfile);

// Rotas administrativas
router.get('/', listUsers);
router.get('/:id', getUserById);
router.post('/', createUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;
