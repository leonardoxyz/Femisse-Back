import supabase from '../services/supabaseClient.js';
import {
  cacheAddToSet,
  cacheDelete,
  cacheGet,
  cacheGetSetMembers,
  cacheSet,
  cacheClearSet,
} from '../services/cacheService.js';
import { 
  validateUUID, 
  validatePositiveDecimal, 
  validatePositiveInteger,
  validateLimit,
  sanitizeString,
  secureLog, 
  getErrorMessage 
} from '../utils/securityUtils.js';

const ORDER_LIST_TTL = 120;
const ORDER_DETAIL_TTL = 180;
const USER_CACHE_SET_PREFIX = 'cache:orders:user:set:';

const getUserOrdersSetKey = (userId) => `${USER_CACHE_SET_PREFIX}${userId}`;
const getUserOrdersCacheKey = (userId, paramsHash) => `cache:orders:user:${userId}:${paramsHash}`;
const getAdminOrdersCacheKey = (paramsHash) => `cache:orders:admin:${paramsHash}`;
const getOrderDetailCacheKey = (orderId) => `cache:orders:detail:${orderId}`;

const hashParams = (params) => JSON.stringify(params ?? {});

const invalidateUserOrderCaches = async (userId) => {
  const setKey = getUserOrdersSetKey(userId);
  const keys = await cacheGetSetMembers(setKey);
  if (keys.length > 0) {
    await cacheDelete(keys);
  }
  await cacheClearSet(setKey);
};

const invalidateOrderDetailCache = async (orderId) => {
  await cacheDelete(getOrderDetailCacheKey(orderId));
};

const calculateOrderTotals = (items, shippingCost = 0, discount = 0) => {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const total = subtotal + shippingCost - discount;
  return { subtotal, total };
};

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

const fetchOrderWithItems = async (orderId) => {
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (orderError) {
    return { error: orderError };
  }

  const { data: items, error: itemsError } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId);

  if (itemsError) {
    return { error: itemsError };
  }

  return { data: { ...order, items: items ?? [] } };
};

export async function listUserOrders(req, res) {
  try {
    const userId = req.user.id;
    const { status, limit } = req.validatedQuery ?? {};
    
    // Valida limit
    if (limit) {
      const limitValidation = validateLimit(limit, 100);
      if (!limitValidation.valid) {
        return res.status(400).json({ 
          error: 'Dados inválidos',
          details: limitValidation.message
        });
      }
    }
    
    // Valida status
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: 'Status inválido'
      });
    }

    const paramsHash = hashParams({ status: status ?? null, limit: limit ?? null });
    const cacheKey = getUserOrdersCacheKey(userId, paramsHash);
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    let query = supabase
      .from('orders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }
    if (limit) {
      query = query.limit(parseInt(limit));
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao listar pedidos do usuário:', error);
      return res.status(500).json({ error: 'Erro ao listar pedidos', details: error.message });
    }

    const orders = data ?? [];
    await cacheSet(cacheKey, orders, ORDER_LIST_TTL);
    await cacheAddToSet(getUserOrdersSetKey(userId), cacheKey);

    return res.json(orders);
  } catch (error) {
    console.error('Erro inesperado ao listar pedidos do usuário:', error);
    return res.status(500).json({ error: 'Erro interno ao listar pedidos' });
  }
}

export async function listOrders(req, res) {
  try {
    const { user_id: userIdFilter, status, payment_status: paymentStatus, limit } = req.validatedQuery ?? req.query;
    const paramsHash = hashParams({ userIdFilter: userIdFilter ?? null, status: status ?? null, paymentStatus: paymentStatus ?? null, limit: limit ?? null });
    const cacheKey = getAdminOrdersCacheKey(paramsHash);

    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    let query = supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (userIdFilter) {
      query = query.eq('user_id', userIdFilter);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (paymentStatus) {
      query = query.eq('payment_status', paymentStatus);
    }
    if (limit) {
      query = query.limit(Number(limit));
    }

    const { data, error } = await query;
    if (error) {
      console.error('Erro ao listar pedidos:', error);
      return res.status(500).json({ error: 'Erro ao listar pedidos', details: error.message });
    }

    const orders = data ?? [];
    await cacheSet(cacheKey, orders, ORDER_LIST_TTL);

    return res.json(orders);
  } catch (error) {
    console.error('Erro inesperado ao listar pedidos:', error);
    return res.status(500).json({ error: 'Erro interno ao listar pedidos' });
  }
}

export async function getOrderById(req, res) {
  try {
    const { id } = req.validatedParams ?? req.params;
    const requesterId = req.user?.id;
    
    // Valida UUID
    const uuidValidation = validateUUID(id);
    if (!uuidValidation.valid) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: uuidValidation.message
      });
    }

    const cacheKey = getOrderDetailCacheKey(id);
    const cached = await cacheGet(cacheKey);
    if (cached && (!requesterId || cached.user_id === requesterId)) {
      return res.json(cached);
    }

    const { data, error } = await fetchOrderWithItems(id);
    if (error) {
      if (error.code === 'PGRST116' || error.details?.includes('Results contains 0 rows')) {
        return res.status(404).json({ error: 'Pedido não encontrado' });
      }
      console.error('Erro ao buscar pedido:', error);
      return res.status(500).json({ error: 'Erro ao buscar pedido', details: error.message });
    }

    if (requesterId && data.user_id !== requesterId) {
      return res.status(403).json({ error: 'Você não tem permissão para acessar este pedido' });
    }

    await cacheSet(cacheKey, data, ORDER_DETAIL_TTL);
    return res.json(data);
  } catch (error) {
    console.error('Erro inesperado ao buscar pedido:', error);
    return res.status(500).json({ error: 'Erro interno ao buscar pedido' });
  }
}

export async function createOrder(req, res) {
  try {
    const userId = req.user.id;
    const payload = req.validatedBody ?? req.body;
    
    secureLog('Creating order for user:', { userId });

    // Validação de itens
    const items = payload.items ?? [];
    if (items.length === 0) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: 'Inclua pelo menos um item no pedido' 
      });
    }
    
    // Limite de 50 itens por pedido
    if (items.length > 50) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: 'Máximo de 50 itens por pedido' 
      });
    }
    
    // Valida cada item
    const errors = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      // Valida product_id
      const productIdValidation = validateUUID(item.product_id);
      if (!productIdValidation.valid) {
        errors.push({ field: `items[${i}].product_id`, message: 'ID do produto inválido' });
      }
      
      // Valida quantity
      const quantityValidation = validatePositiveInteger(item.quantity, 'Quantidade');
      if (!quantityValidation.valid) {
        errors.push({ field: `items[${i}].quantity`, message: quantityValidation.message });
      } else if (quantityValidation.value > 100) {
        errors.push({ field: `items[${i}].quantity`, message: 'Quantidade máxima é 100 por item' });
      }
      
      // Valida unit_price
      const priceValidation = validatePositiveDecimal(item.unit_price, 'Preço unitário');
      if (!priceValidation.valid) {
        errors.push({ field: `items[${i}].unit_price`, message: priceValidation.message });
      } else if (priceValidation.value > 100000) {
        errors.push({ field: `items[${i}].unit_price`, message: 'Preço unitário máximo é R$ 100.000' });
      }
      
      // Sanitiza product_name
      if (item.product_name) {
        items[i].product_name = sanitizeString(item.product_name);
      }
    }
    
    if (errors.length > 0) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: errors
      });
    }
    
    // Valida shipping_cost
    const shippingCostValidation = validatePositiveDecimal(payload.shipping_cost ?? 0, 'Custo de envio');
    if (!shippingCostValidation.valid) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: shippingCostValidation.message
      });
    }
    const shippingCost = shippingCostValidation.value;
    
    // Valida discount
    const discountValidation = validatePositiveDecimal(payload.discount ?? 0, 'Desconto');
    if (!discountValidation.valid) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: discountValidation.message
      });
    }
    const discount = discountValidation.value;
    
    // Valida payment_method
    const validPaymentMethods = ['credit_card', 'debit_card', 'pix', 'boleto'];
    if (!payload.payment_method || !validPaymentMethods.includes(payload.payment_method)) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: 'Método de pagamento inválido'
      });
    }
    
    // Valida shipping (endereço de entrega)
    if (!payload.shipping || typeof payload.shipping !== 'object') {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: 'Endereço de entrega é obrigatório'
      });
    }

    const { subtotal, total } = calculateOrderTotals(items, shippingCost, discount);
    
    // Valida total máximo (R$ 50.000)
    if (total > 50000) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: 'Valor total do pedido excede o limite de R$ 50.000'
      });
    }

    const { data: orderCode, error: orderCodeError } = await supabase.rpc('generate_order_number');
    if (orderCodeError) {
      console.error('Erro ao gerar número do pedido:', orderCodeError);
      return res.status(500).json({ error: 'Erro ao gerar número do pedido', details: orderCodeError.message });
    }

    const baseOrder = {
      user_id: userId,
      order_number: Array.isArray(orderCode) ? orderCode[0]?.order_number ?? orderCode[0] : orderCode,
      status: 'pending',
      payment_status: payload.payment_status ?? 'pending',
      payment_method: payload.payment_method,
      subtotal,
      shipping_cost: shippingCost,
      discount,
      total,
      notes: payload.notes ? sanitizeString(payload.notes.substring(0, 500)) : null, // Limita a 500 caracteres
      ...normalizeShippingPayload(payload.shipping),
    };

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([baseOrder])
      .select('*')
      .single();

    if (orderError) {
      console.error('Erro ao criar pedido:', orderError);
      return res.status(500).json({ error: 'Erro ao criar pedido', details: orderError.message });
    }

    const itemsPayload = mapOrderItemsPayload(order.id, items);
    const { error: itemsError } = await supabase.from('order_items').insert(itemsPayload);

    if (itemsError) {
      console.error('Erro ao inserir itens do pedido:', itemsError);
      await supabase.from('orders').delete().eq('id', order.id);
      return res.status(500).json({ error: 'Erro ao salvar itens do pedido', details: itemsError.message });
    }

    const response = { ...order, items: itemsPayload };

    await invalidateUserOrderCaches(userId);
    await cacheSet(getOrderDetailCacheKey(order.id), response, ORDER_DETAIL_TTL);

    return res.status(201).json(response);
  } catch (error) {
    console.error('Erro inesperado ao criar pedido:', error);
    return res.status(500).json({ error: 'Erro interno ao criar pedido' });
  }
}

export async function updateOrder(req, res) {
  try {
    const { id } = req.validatedParams ?? req.params;
    const payload = req.validatedBody ?? req.body;
    
    // Valida UUID
    const uuidValidation = validateUUID(id);
    if (!uuidValidation.valid) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: uuidValidation.message
      });
    }
    
    // Valida status se fornecido
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (payload.status && !validStatuses.includes(payload.status)) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: 'Status inválido'
      });
    }
    
    // Valida payment_status se fornecido
    const validPaymentStatuses = ['pending', 'paid', 'failed', 'refunded'];
    if (payload.payment_status && !validPaymentStatuses.includes(payload.payment_status)) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: 'Status de pagamento inválido'
      });
    }

    const updates = { ...payload };

    if (payload.status === 'delivered') {
      updates.completed_at = new Date().toISOString();
    }

    if (payload.status === 'cancelled') {
      updates.cancelled_at = new Date().toISOString();
    }

    const { data: order, error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Pedido não encontrado' });
      }
      console.error('Erro ao atualizar pedido:', error);
      return res.status(500).json({ error: 'Erro ao atualizar pedido', details: error.message });
    }

    await invalidateOrderDetailCache(id);
    await invalidateUserOrderCaches(order.user_id);

    return res.json(order);
  } catch (error) {
    console.error('Erro inesperado ao atualizar pedido:', error);
    return res.status(500).json({ error: 'Erro interno ao atualizar pedido' });
  }
}

export async function deleteOrder(req, res) {
  try {
    const { id } = req.validatedParams ?? req.params;
    
    // Valida UUID
    const uuidValidation = validateUUID(id);
    if (!uuidValidation.valid) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: uuidValidation.message
      });
    }

    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('id, user_id')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Pedido não encontrado' });
      }
      console.error('Erro ao localizar pedido para exclusão:', fetchError);
      return res.status(500).json({ error: 'Erro ao excluir pedido', details: fetchError.message });
    }

    const { error: deleteItemsError } = await supabase
      .from('order_items')
      .delete()
      .eq('order_id', id);

    if (deleteItemsError) {
      console.error('Erro ao deletar itens do pedido:', deleteItemsError);
      return res.status(500).json({ error: 'Erro ao deletar itens do pedido', details: deleteItemsError.message });
    }

    const { error: deleteOrderError } = await supabase
      .from('orders')
      .delete()
      .eq('id', id);

    if (deleteOrderError) {
      console.error('Erro ao deletar pedido:', deleteOrderError);
      return res.status(500).json({ error: 'Erro ao deletar pedido', details: deleteOrderError.message });
    }

    await invalidateOrderDetailCache(id);
    await invalidateUserOrderCaches(order.user_id);

    return res.json({ message: 'Pedido deletado com sucesso' });
  } catch (error) {
    console.error('Erro inesperado ao deletar pedido:', error);
    return res.status(500).json({ error: 'Erro interno ao deletar pedido' });
  }
}