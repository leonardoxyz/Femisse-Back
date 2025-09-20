import express from 'express';
import { getMomentProducts } from '../controllers/momentProductsController.js';

const router = express.Router();

router.get('/', getMomentProducts);

export default router;
