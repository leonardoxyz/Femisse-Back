import express from 'express';
import { 
  getAllProducts, 
  getProductById,
  getProductBySlug,
  createProduct, 
  updateProduct, 
  deleteProduct 
} from '../controllers/productsController.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { productsQuerySchema } from '../validators/securitySchemas.js';
import { productCreateSchema, productUpdateSchema } from '../validators/productSchemas.js';

const router = express.Router();

router.get('/', validateRequest(productsQuerySchema, 'query'), getAllProducts);
router.get('/slug/:slug', getProductBySlug);
router.get('/:id', getProductById);
router.post('/', validateRequest(productCreateSchema), createProduct);
router.put('/:id', validateRequest(productUpdateSchema), updateProduct);
router.delete('/:id', deleteProduct);

export default router;
