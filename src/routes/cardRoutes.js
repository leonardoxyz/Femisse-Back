import express from 'express';
import { listCards, getCardById, createCard, updateCard, deleteCard } from '../controllers/cardController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Rotas do usuário autenticado para cartões de pagamento
router.get('/my', authenticateToken, listCards); // Listar cartões do usuário
router.post('/my', authenticateToken, createCard); // Adicionar novo cartão

// Rotas específicas por ID (devem vir por último)
router.get('/:id', authenticateToken, getCardById); // Buscar cartão por ID
router.put('/:id', authenticateToken, updateCard); // Atualizar cartão
router.delete('/:id', authenticateToken, deleteCard); // Deletar cartão

export default router;
