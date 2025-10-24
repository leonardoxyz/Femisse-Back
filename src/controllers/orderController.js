import supabase from '../services/supabaseClient.js';
import { validateUUID, validateLimit, getErrorMessage } from '../utils/securityUtils.js';
import { registerCouponUsage } from './couponController.js';
import { toPublicOrderList } from '../dto/orderDTO.js';
import * as orderService from '../services/orderService.js';

import { logger } from '../utils/logger.js';
const normalizeShippingPayload = (shipping) => ({
  shipping_name: shipping.name,
  shipping_street: shipping.street,
  shipping_number: shipping.number,
  shipping_complement: shipping.complement ?? null,
  shipping_neighborhood: shipping.neighborhood,
  shipping_city: shipping.city,
  shipping_state: shipping.state,
  shipping_zip_code: shipping.zip_code,
});

const mapOrderItemsPayload = (orderId, items) =>
  items.map((item) => ({
    order_id: orderId,
    product_id: item.product_id,
    product_name: item.product_name,
    product_image: item.product_image ?? null,
    quantity: item.quantity,
    unit_price: item.unit_price,
    subtotal: item.quantity * item.unit_price,
    variant_size: item.variant_size ?? null,
    variant_color: item.variant_color ?? null,
  }));

export async function listOrders(req, res) {
  try {
    const limit = validateLimit(req.query.limit, 50);
    const offset = parseInt(req.query.offset) || 0;
    const status = req.query.status;

    let orders;
    if (status) {
      orders = await orderService.getOrdersByStatus(status, limit, offset);
    } else {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      
      if (error) throw error;
      orders = data;
    }

    const formattedOrders = toPublicOrderList(orders);
    logger.info({ count: orders.length }, 'All orders listed:');
    res.json({ success: true, data: formattedOrders });

  } catch (error) {
    logger.info({ error: error.message }, 'Error listing all orders:');
    res.status(500).json(getErrorMessage(error, 'Erro ao listar pedidos'));
  }
}

export async function listUserOrders(req, res) {
  try {
    const userId = req.user.id;
    const limitObj = validateLimit(req.query.limit, 10);
    const limit = limitObj.value;
    
    let offset = 0;
    if (req.query.page) {
      const page = parseInt(req.query.page);
      offset = (page - 1) * limit;
    } else if (req.query.offset) {
      offset = parseInt(req.query.offset);
    }

    const orders = await orderService.getUserOrders(userId, limit, offset);
    const formattedOrders = toPublicOrderList(orders);

    logger.info({ userId, count: orders.length }, 'Orders listed:');
    res.json({ success: true, data: formattedOrders });

  } catch (error) {
    logger.info({ error: error.message }, 'Error listing user orders:');
    res.status(500).json(getErrorMessage(error, 'Erro ao listar pedidos'));
  }
}

export async function getOrderById(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const validation = validateUUID(id);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.message });
    }

    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !order) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }

    if (userId && order.user_id !== userId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const items = await orderService.getOrderItems(id);
    const formattedOrder = toPublicOrderList([{ ...order, items }])[0];

    logger.info({ orderId: id }, 'Order retrieved:');
    res.json({ success: true, data: formattedOrder });

  } catch (error) {
    logger.info({ error: error.message }, 'Error getting order:');
    res.status(500).json(getErrorMessage(error, 'Erro ao buscar pedido'));
  }
}

export async function getOrderDetail(req, res) {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    const validation = validateUUID(orderId);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.message });
    }

    const order = await orderService.getOrderDetail(orderId, userId);
    const items = await orderService.getOrderItems(orderId);

    const formattedOrder = toPublicOrderList([{ ...order, items }])[0];

    logger.info({ orderId, userId }, 'Order detail retrieved:');
    res.json({ success: true, data: formattedOrder });

  } catch (error) {
    logger.info({ error: error.message }, 'Error getting order detail:');
    res.status(500).json(getErrorMessage(error, 'Erro ao buscar pedido'));
  }
}

export async function createOrder(req, res) {
  try {
    const userId = req.user.id;
    const { items, shipping, payment_method, coupon_code, coupon_id, subtotal, shipping_cost, discount, coupon_discount } = req.body;

    if (!items?.length) {
      return res.status(400).json({ error: 'Pedido deve conter itens' });
    }

    // payment_method é obrigatório: 'pix' | 'credit_card' | 'debit_card'
    if (!payment_method) {
      return res.status(400).json({ error: 'Método de pagamento é obrigatório' });
    }

    // Resolve itens com segurança no servidor (por ID ou slug)
    const resolvedItems = [];
    for (const [index, item] of items.entries()) {
      let productId = item.product_id;
      let productName = item.product_name;
      let unitPrice = item.unit_price;

      if (!productId) {
        if (!item.product_slug) {
          return res.status(400).json({ error: `Item ${index + 1}: produto é obrigatório (id ou slug)` });
        }

        // Busca por slug no banco e usa preço/nome oficiais
        const { data: product, error: prodError } = await supabase
          .from('products')
          .select('id, name, price, images_urls')
          .eq('slug', item.product_slug)
          .single();

        if (prodError || !product) {
          return res.status(400).json({ error: `Item ${index + 1}: produto não encontrado pelo slug` });
        }

        productId = product.id;
        productName = product.name;
        unitPrice = Number(product.price);
      } else {
        // Mesmo com ID, por segurança revalida preço atual do banco
        const { data: product, error: prodError } = await supabase
          .from('products')
          .select('id, name, price')
          .eq('id', productId)
          .single();
        if (!prodError && product) {
          productName = product.name;
          unitPrice = Number(product.price);
        }
      }

      resolvedItems.push({
        product_id: productId,
        product_name: productName,
        product_image: item.product_image ?? null,
        quantity: item.quantity,
        unit_price: Number(unitPrice),
        variant_size: item.variant_size ?? null,
        variant_color: item.variant_color ?? null,
      });
    }

    // Se veio apenas o código do cupom, tentar resolver o ID no banco
    let resolvedCouponId = coupon_id ?? null;
    if (!resolvedCouponId && coupon_code) {
      const { data: couponRow } = await supabase
        .from('coupons')
        .select('id, code, active')
        .eq('code', coupon_code)
        .eq('active', true)
        .single();
      if (couponRow?.id) {
        resolvedCouponId = couponRow.id;
      }
    }

    // Calcula totais no servidor com base nos preços oficiais
    const { subtotal: calculatedSubtotal, total } = orderService.calculateOrderTotals(
      resolvedItems,
      shipping_cost,
      discount,
      coupon_discount
    );

    const orderData = {
      user_id: userId,
      status: 'pending',
      payment_status: 'pending',
      payment_method,
      subtotal: calculatedSubtotal,
      shipping_cost: shipping_cost || 0,
      discount: discount || 0,
      coupon_discount: coupon_discount || 0,
      coupon_id: resolvedCouponId,
      coupon_code: coupon_code || null,
      total,
      ...normalizeShippingPayload(shipping),
      created_at: new Date().toISOString(),
    };

    const order = await orderService.createOrder(orderData);

    const orderItems = mapOrderItemsPayload(order.id, resolvedItems);
    await orderService.createOrderItems(orderItems);

    if (coupon_code) {
      await registerCouponUsage(userId, coupon_code, order.id);
    }

    logger.info({ orderId: order.id, userId }, 'Order created:');
    res.status(201).json({ success: true, data: order });

  } catch (error) {
    logger.info({ error: error.message }, 'Error creating order:');
    res.status(500).json(getErrorMessage(error, 'Erro ao criar pedido'));
  }
}

export async function updateOrder(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;
    const userId = req.user?.id;

    const validation = validateUUID(id);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.message });
    }

    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !order) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }

    if (userId && order.user_id !== userId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    updates.updated_at = new Date().toISOString();
    const updatedOrder = await orderService.updateOrder(id, updates);

    logger.info({ orderId: id }, 'Order updated:');
    res.json({ success: true, data: updatedOrder });

  } catch (error) {
    logger.info({ error: error.message }, 'Error updating order:');
    res.status(500).json(getErrorMessage(error, 'Erro ao atualizar pedido'));
  }
}

export async function updateOrderStatus(req, res) {
  try {
    const { orderId } = req.params;
    const { status, payment_status } = req.body;
    const userId = req.user.id;

    const validation = validateUUID(orderId);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.message });
    }

    const order = await orderService.getOrderDetail(orderId, userId);

    const updates = {};
    if (status) updates.status = status;
    if (payment_status) updates.payment_status = payment_status;
    updates.updated_at = new Date().toISOString();

    const updatedOrder = await orderService.updateOrder(orderId, updates);

    logger.info({ orderId, status, payment_status }, 'Order status updated:');
    res.json({ success: true, data: updatedOrder });

  } catch (error) {
    logger.info({ error: error.message }, 'Error updating order status:');
    res.status(500).json(getErrorMessage(error, 'Erro ao atualizar pedido'));
  }
}

export async function deleteOrder(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const validation = validateUUID(id);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.message });
    }

    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !order) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }

    if (userId && order.user_id !== userId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    await supabase.from('order_items').delete().eq('order_id', id);
    await supabase.from('orders').delete().eq('id', id);

    if (userId) {
      await orderService.invalidateUserOrderCaches(userId);
    }

    logger.info({ orderId: id }, 'Order deleted:');
    res.json({ success: true, message: 'Pedido deletado com sucesso' });

  } catch (error) {
    logger.info({ error: error.message }, 'Error deleting order:');
    res.status(500).json(getErrorMessage(error, 'Erro ao deletar pedido'));
  }
}

export async function cancelOrder(req, res) {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    const validation = validateUUID(orderId);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.message });
    }

    const order = await orderService.getOrderDetail(orderId, userId);

    if (order.status === 'cancelled') {
      return res.status(400).json({ error: 'Pedido já foi cancelado' });
    }

    const updatedOrder = await orderService.updateOrder(orderId, {
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    });

    await orderService.invalidateUserOrderCaches(userId);

    logger.info({ orderId, userId }, 'Order cancelled:');
    res.json({ success: true, data: updatedOrder });

  } catch (error) {
    logger.info({ error: error.message }, 'Error cancelling order:');
    res.status(500).json(getErrorMessage(error, 'Erro ao cancelar pedido'));
  }
}

export default {
  listOrders,
  listUserOrders,
  getOrderById,
  getOrderDetail,
  createOrder,
  updateOrder,
  updateOrderStatus,
  deleteOrder,
  cancelOrder,
};
