import express from 'express';
import testimonialController from '../controllers/testimonialController.js';
import { generalRateLimit } from '../middleware/validationMiddleware.js';

const router = express.Router();

/**
 * Rotas Públicas (sem autenticação)
 */

// GET /api/testimonials - Listar todos os depoimentos ativos (público, sem ID)
router.get('/', generalRateLimit, testimonialController.getAllTestimonials);

export default router;
