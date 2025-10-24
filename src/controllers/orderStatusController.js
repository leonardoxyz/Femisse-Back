import supabase from '../services/supabaseClient.js';
import { validateUUID } from '../utils/securityUtils.js';

import { logger } from '../utils/logger.js';
/**
 * Atualizar status de um pedido (para admin/testes)
 */
export async function updateOrderStatus(req, res) {
  try {
    const userId = req.user.id;
    const { orderId } = req.params;
    const { status, payment_status } = req.body;

    // Validar UUID
    const orderIdValidation = validateUUID(orderId);
    if (!orderIdValidation.valid) {
      return res.status(400).json({ 
        error: 'ID de pedido inválido',
        details: orderIdValidation.message 
      });
    }

    // Validar status
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: 'Status inválido',
        details: `Status deve ser um de: ${validStatuses.join(', ')}` 
      });
    }

    // Validar payment_status
    const validPaymentStatuses = ['pending', 'paid', 'failed', 'refunded'];
    if (payment_status && !validPaymentStatuses.includes(payment_status)) {
      return res.status(400).json({ 
        error: 'Status de pagamento inválido',
        details: `Payment status deve ser um de: ${validPaymentStatuses.join(', ')}` 
      });
    }

    // Verificar se o pedido pertence ao usuário
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, user_id, status, payment_status')
      .eq('id', orderId)
      .single();

    if (orderError) {
      if (orderError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Pedido não encontrado' });
      }
      logger.error({ err: orderError }, 'Erro ao buscar pedido');
      return res.status(500).json({ error: 'Erro ao buscar pedido' });
    }

    if (order.user_id !== userId) {
      return res.status(403).json({ error: 'Você não tem permissão para atualizar este pedido' });
    }

    // Preparar dados para atualização
    const updates = {
      updated_at: new Date().toISOString()
    };

    if (status) updates.status = status;
    if (payment_status) updates.payment_status = payment_status;

    // Atualizar pedido
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', orderId)
      .select()
      .single();

    if (updateError) {
      logger.error({ err: updateError }, 'Erro ao atualizar pedido');
      return res.status(500).json({ error: 'Erro ao atualizar pedido' });
    }

    return res.json({
      message: 'Pedido atualizado com sucesso',
      order: updatedOrder
    });

  } catch (error) {
    logger.error({ err: error }, 'Erro inesperado ao atualizar status do pedido');
    return res.status(500).json({ error: 'Erro interno ao atualizar pedido' });
  }
}

/**
 * Listar pedidos do usuário (para debug)
 */
export async function listUserOrdersDebug(req, res) {
  try {
    const userId = req.user.id;

    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        status,
        payment_status,
        total,
        created_at,
        order_items (
          product_id,
          product_name,
          quantity
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error({ err: error }, 'Erro ao listar pedidos');
      return res.status(500).json({ error: 'Erro ao listar pedidos' });
    }

    return res.json(orders || []);

  } catch (error) {
    logger.error({ err: error }, 'Erro inesperado ao listar pedidos');
    return res.status(500).json({ error: 'Erro interno' });
  }
}
