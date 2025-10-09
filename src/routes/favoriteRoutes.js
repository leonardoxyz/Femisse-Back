import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { getFavorites, addFavorite, removeFavorite, clearFavorites } from '../controllers/favoritesController.js';
import { favoriteBodySchema, favoriteParamSchema } from '../validators/favoriteSchemas.js';

const router = express.Router();

// Rotas do usuário autenticado para favoritos
router.get('/', authenticateToken, getFavorites); // Listar favoritos do usuário
router.post('/', authenticateToken, validateRequest(favoriteBodySchema), addFavorite); // Adicionar produto aos favoritos
router.delete('/clear', authenticateToken, clearFavorites); // Limpar todos os favoritos
router.delete(
  '/:productId',
  authenticateToken,
  validateRequest(favoriteParamSchema, 'params'),
  removeFavorite
); // Remover produto dos favoritos

export default router;
