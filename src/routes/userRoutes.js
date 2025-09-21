import express from 'express';
import { listUsers, getUserById, createUser, updateUser, deleteUser, updateMyProfile, getMyProfile } from '../controllers/userController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Rotas do usuário autenticado (devem vir antes das rotas com parâmetros)
router.get('/profile', authenticateToken, getMyProfile); // Buscar perfil do usuário logado
router.put('/profile', authenticateToken, updateMyProfile); // Atualizar perfil do usuário logado

// Rotas administrativas para gerenciamento de usuários
router.get('/', listUsers); // Listar todos os usuários (admin)
router.post('/', createUser); // Criar novo usuário (registro)

// Rotas específicas por ID (devem vir por último)
router.get('/:id', getUserById); // Buscar usuário por ID (admin)
router.put('/:id', updateUser); // Atualizar usuário por ID (admin)
router.delete('/:id', deleteUser); // Deletar usuário por ID (admin)

export default router;
