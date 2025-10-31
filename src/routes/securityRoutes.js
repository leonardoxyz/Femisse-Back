import { Router } from 'express';

import { getSafeBrowsingStatus } from '../controllers/securityController.js';

const router = Router();

router.get('/safe-browsing', getSafeBrowsingStatus);

export default router;
