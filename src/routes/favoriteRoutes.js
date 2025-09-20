import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { getFavorites, addFavorite, removeFavorite } from '../controllers/favoritesController.js';

const router = express.Router();

router.get('/', authenticateToken, getFavorites);
router.post('/', authenticateToken, addFavorite);
router.delete('/:productId', authenticateToken, removeFavorite);

export default router;
