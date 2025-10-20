import express from 'express';
import testimonialController from '../controllers/testimonialController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import {
  generalRateLimit,
  authRateLimit,
} from '../middleware/validationMiddleware.js';

const router = express.Router();

/**
 * Rotas Públicas (sem autenticação)
 */

// GET /api/testimonials - Listar todos os depoimentos ativos (público, sem ID)
router.get('/', generalRateLimit, testimonialController.getAllTestimonials);

/**
 * Rotas Protegidas (requerem autenticação)
 */

// GET /api/testimonials/admin - Listar todos os depoimentos (admin, com ID)
router.get(
  '/admin',
  authenticateToken,
  generalRateLimit,
  testimonialController.getAllTestimonialsAdmin
);

// GET /api/testimonials/:id - Buscar depoimento por ID (admin)
router.get(
  '/:id',
  authenticateToken,
  generalRateLimit,
  testimonialController.getTestimonialById
);

// POST /api/testimonials - Criar novo depoimento
router.post(
  '/',
  authenticateToken,
  authRateLimit,
  testimonialController.createTestimonial
);

// PUT /api/testimonials/:id - Atualizar depoimento
router.put(
  '/:id',
  authenticateToken,
  authRateLimit,
  testimonialController.updateTestimonial
);

// DELETE /api/testimonials/:id - Deletar depoimento (soft delete)
router.delete(
  '/:id',
  authenticateToken,
  authRateLimit,
  testimonialController.deleteTestimonial
);

// PATCH /api/testimonials/:id/toggle - Ativar/desativar depoimento
router.patch(
  '/:id/toggle',
  authenticateToken,
  authRateLimit,
  testimonialController.toggleTestimonial
);

export default router;
