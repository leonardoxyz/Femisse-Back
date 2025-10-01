import express from 'express';
import * as productsController from '../controllers/productsController.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { productCreateSchema, productUpdateSchema } from '../validators/productSchemas.js';

const router = express.Router();

router.get('/', productsController.getAllProducts);
router.get('/:id', productsController.getProductById);
router.post('/', validateRequest(productCreateSchema), productsController.createProduct);
router.put('/:id', validateRequest(productUpdateSchema), productsController.updateProduct);
router.delete('/:id', productsController.deleteProduct);

export default router;
