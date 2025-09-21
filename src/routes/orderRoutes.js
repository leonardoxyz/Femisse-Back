import express from 'express';
import { listOrders, getOrderById, createOrder, updateOrder, deleteOrder } from '../controllers/orderController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Rotas do usuário autenticado para pedidos
router.get('/user/orders', authenticateToken, listOrders); // Listar pedidos do usuário
router.post('/user/orders', authenticateToken, createOrder); // Criar novo pedido

// Rotas administrativas (listar todos os pedidos)
router.get('/', listOrders); // Listar todos os pedidos (admin)

// Rotas específicas por ID (devem vir por último)
router.get('/:id', authenticateToken, getOrderById); // Buscar pedido por ID
router.put('/:id', authenticateToken, updateOrder); // Atualizar pedido
router.delete('/:id', authenticateToken, deleteOrder); // Cancelar pedido

export default router;
