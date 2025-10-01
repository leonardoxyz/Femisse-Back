import express from 'express';
import { getAllCategories, createCategory } from '../controllers/categoryController.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { categoryCreateSchema } from '../validators/categorySchemas.js';

const router = express.Router();

router.get('/', getAllCategories);
router.post('/', validateRequest(categoryCreateSchema), createCategory);

export default router;
