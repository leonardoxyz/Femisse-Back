import express from 'express';
import {
  listOrders,
  listUserOrders,
  getOrderById,
  createOrder,
  updateOrder,
  deleteOrder,
} from '../controllers/orderController.js';
import {
  updateOrderStatus,
  listUserOrdersDebug,
} from '../controllers/orderStatusController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  orderCreateSchema,
  orderUpdateSchema,
  orderParamsSchema,
  orderListQuerySchema,
  orderUserListQuerySchema,
} from '../validators/orderSchemas.js';

const router = express.Router();

// Rotas do usuário autenticado para pedidos
router.get(
  '/my',
  authenticateToken,
  validateRequest(orderUserListQuerySchema, 'query'),
  listUserOrders
);
router.get(
  '/my/debug',
  authenticateToken,
  listUserOrdersDebug
);
router.post(
  '/my',
  authenticateToken,
  validateRequest(orderCreateSchema),
  createOrder
);
router.patch(
  '/my/:orderId/status',
  authenticateToken,
  updateOrderStatus
);

// Rotas administrativas (PROTEGIDAS - listar todos os pedidos)
router.get('/', authenticateToken, validateRequest(orderListQuerySchema, 'query'), listOrders);

// Rotas específicas por ID (devem vir por último)
router.get(
  '/:id',
  authenticateToken,
  validateRequest(orderParamsSchema, 'params'),
  getOrderById
);
router.put(
  '/:id',
  authenticateToken,
  validateRequest(orderParamsSchema, 'params'),
  validateRequest(orderUpdateSchema),
  updateOrder
);
router.delete(
  '/:id',
  authenticateToken,
  validateRequest(orderParamsSchema, 'params'),
  deleteOrder
);

export default router;
