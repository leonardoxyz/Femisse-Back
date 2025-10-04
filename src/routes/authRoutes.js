import express from 'express';
import { register, login } from '../controllers/authController.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { registerSchema, loginSchema } from '../validators/authSchemas.js';
import { authRateLimit } from '../middleware/validationMiddleware.js';

const router = express.Router();

router.use(authRateLimit);

router.post('/register', validateRequest(registerSchema), register);
router.post('/login', validateRequest(loginSchema), login);

export default router;
