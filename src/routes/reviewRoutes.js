import express from 'express';
import {
  listUserReviews,
  listReviewableProducts,
  createReview,
  updateReview,
  deleteReview,
  getProductReviewStats,
} from '../controllers/reviewController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  reviewCreateSchema,
  reviewUpdateSchema,
  reviewParamsSchema,
} from '../validators/reviewSchemas.js';

const router = express.Router();

// Rotas do usuário autenticado para avaliações
router.get(
  '/my',
  authenticateToken,
  listUserReviews
);

router.get(
  '/my/reviewable-products',
  authenticateToken,
  listReviewableProducts
);

// Alias para compatibilidade
router.get(
  '/my/reviewable-items',
  authenticateToken,
  listReviewableProducts
);

router.get(
  '/reviewable',
  authenticateToken,
  listReviewableProducts
);

router.post(
  '/my',
  authenticateToken,
  validateRequest(reviewCreateSchema),
  createReview
);

router.put(
  '/my/:id',
  authenticateToken,
  validateRequest(reviewParamsSchema, 'params'),
  validateRequest(reviewUpdateSchema),
  updateReview
);

router.delete(
  '/my/:id',
  authenticateToken,
  validateRequest(reviewParamsSchema, 'params'),
  deleteReview
);

// Estatísticas de avaliações por produto (público)
router.get(
  '/products/:id/stats',
  validateRequest(reviewParamsSchema, 'params'),
  getProductReviewStats
);

export default router;
