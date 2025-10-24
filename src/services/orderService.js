import supabase from './supabaseClient.js';
import {
  cacheAddToSet,
  cacheDelete,
  cacheGet,
  cacheGetSetMembers,
  cacheSet,
  cacheClearSet,
} from './cacheService.js';
import { logger } from '../utils/logger.js';

const ORDER_LIST_TTL = 120;
const ORDER_DETAIL_TTL = 180;
const USER_CACHE_SET_PREFIX = 'cache:orders:user:set:';

const getUserOrdersSetKey = (userId) => `${USER_CACHE_SET_PREFIX}${userId}`;
const getUserOrdersCacheKey = (userId, paramsHash) => `cache:orders:user:${userId}:${paramsHash}`;
const getOrderDetailCacheKey = (orderId) => `cache:orders:detail:${orderId}`;

const hashParams = (params) => JSON.stringify(params ?? {});

// Gera um número de pedido único no formato FEM-YYYYMMDD-HHMMSS-XXXX
function generateOrderNumber() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const y = now.getFullYear();
  const m = pad(now.getMonth() + 1);
  const d = pad(now.getDate());
  const hh = pad(now.getHours());
  const mm = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `FEM-${y}${m}${d}-${hh}${mm}${ss}-${rand}`;
}

/**
 * Invalida cache de pedidos do usuário
 */
export async function invalidateUserOrderCaches(userId) {
  const setKey = getUserOrdersSetKey(userId);
  const keys = await cacheGetSetMembers(setKey);
  if (keys.length > 0) {
    await cacheDelete(keys);
  }
  await cacheClearSet(setKey);
}

/**
 * Invalida cache de detalhes do pedido
 */
export async function invalidateOrderDetailCache(orderId) {
  await cacheDelete(getOrderDetailCacheKey(orderId));
}

/**
 * Calcula totais do pedido
 */
export function calculateOrderTotals(items, shippingCost = 0, discount = 0, couponDiscount = 0) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const total = subtotal + shippingCost - discount - couponDiscount;
  return { subtotal, total };
}

/**
 * Busca pedidos do usuário com cache
 */
export async function getUserOrders(userId, limit = 10, offset = 0) {
  const paramsHash = hashParams({ limit, offset });
  const cacheKey = getUserOrdersCacheKey(userId, paramsHash);

  const cached = await cacheGet(cacheKey);
  if (cached) {
    return cached;
  }

  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  await cacheSet(cacheKey, orders, ORDER_LIST_TTL);
  await cacheAddToSet(getUserOrdersSetKey(userId), cacheKey);

  return orders;
}

/**
 * Busca detalhes do pedido com cache
 */
export async function getOrderDetail(orderId, userId) {
  const cacheKey = getOrderDetailCacheKey(orderId);

  const cached = await cacheGet(cacheKey);
  if (cached) {
    return cached;
  }

  const { data: order, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .eq('user_id', userId)
    .single();

  if (error) throw error;

  await cacheSet(cacheKey, order, ORDER_DETAIL_TTL);

  return order;
}

/**
 * Cria novo pedido
 */
export async function createOrder(orderData) {
  const payload = { ...orderData };
  if (!payload.order_number) {
    payload.order_number = generateOrderNumber();
  }

  const { data: order, error } = await supabase
    .from('orders')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;

  return order;
}

/**
 * Atualiza pedido
 */
export async function updateOrder(orderId, updates) {
  const { data: order, error } = await supabase
    .from('orders')
    .update(updates)
    .eq('id', orderId)
    .select()
    .single();

  if (error) throw error;

  await invalidateOrderDetailCache(orderId);

  return order;
}

/**
 * Busca itens do pedido
 */
export async function getOrderItems(orderId) {
  const { data: items, error } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId);

  if (error) throw error;

  return items;
}

/**
 * Cria itens do pedido
 */
export async function createOrderItems(items) {
  const { error } = await supabase
    .from('order_items')
    .insert(items);

  if (error) throw error;
}

/**
 * Busca pedidos por status
 */
export async function getOrdersByStatus(status, limit = 50, offset = 0) {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  return orders;
}
