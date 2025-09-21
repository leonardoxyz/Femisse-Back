import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { getFavorites, addFavorite, removeFavorite, clearFavorites } from '../controllers/favoritesController.js';

const router = express.Router();

// Rotas do usuário autenticado para favoritos
router.get('/favorites', authenticateToken, getFavorites); // Listar favoritos do usuário
router.post('/favorites', authenticateToken, addFavorite); // Adicionar produto aos favoritos
router.delete('/favorites/clear', authenticateToken, clearFavorites); // Limpar todos os favoritos
router.delete('/favorites/:productId', authenticateToken, removeFavorite); // Remover produto dos favoritos

export default router;
