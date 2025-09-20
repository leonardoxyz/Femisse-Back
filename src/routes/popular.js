import express from 'express';
import { getPopular } from '../controllers/populariesController.js';
const router = express.Router();

router.get('/', getPopular);

export default router;
