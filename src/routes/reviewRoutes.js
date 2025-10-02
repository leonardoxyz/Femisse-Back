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
  '/user/reviews',
  authenticateToken,
  listUserReviews
);

router.get(
  '/user/reviewable-products',
  authenticateToken,
  listReviewableProducts
);

router.post(
  '/user/reviews',
  authenticateToken,
  validateRequest(reviewCreateSchema),
  createReview
);

router.put(
  '/user/reviews/:id',
  authenticateToken,
  validateRequest(reviewParamsSchema, 'params'),
  validateRequest(reviewUpdateSchema),
  updateReview
);

router.delete(
  '/user/reviews/:id',
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
