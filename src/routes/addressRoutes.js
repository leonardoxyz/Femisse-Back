import express from 'express';
import { listAddresses, getAddressById, createAddress, updateAddress, deleteAddress } from '../controllers/addressController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', listAddresses);
router.get('/:id', authenticateToken, getAddressById);
router.post('/', authenticateToken, createAddress);
router.put('/:id', authenticateToken, updateAddress);
router.delete('/:id', authenticateToken, deleteAddress);

export default router;
