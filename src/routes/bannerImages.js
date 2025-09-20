import express from 'express';
import { getBannerImages } from '../controllers/bannerImagesController.js';

const router = express.Router();

router.get('/', getBannerImages);

export default router;
