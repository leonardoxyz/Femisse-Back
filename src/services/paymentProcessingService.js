import supabase from './supabaseClient.js';
import { getErrorMessage } from '../utils/securityUtils.js';
import { logger } from '../utils/logger.js';
/**
 * Verifica se já existe pagamento aprovado para um pedido
 */
export async function checkExistingApprovedPayment(orderId) {
  const { data: existingPayment, error } = await supabase
    .from('payments')
    .select('*')
    .eq('order_id', orderId)
    .eq('status', 'approved')
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return existingPayment;
}

/**
 * Busca itens do pedido
 */
export async function getOrderItems(orderId) {
  const { data: orderItems, error } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId);

  if (error || !orderItems?.length) {
    throw new Error('Itens do pedido não encontrados');
  }

  return orderItems;
}

/**
 * Calcula e ajusta preços dos itens
 */
export function calculateAdjustedItems(orderItems, discountedSubtotal, rawSubtotal) {
  let adjustedItems = orderItems.map(item => ({ ...item }));
  
  if (rawSubtotal > 0) {
    const factor = discountedSubtotal > 0 ? discountedSubtotal / rawSubtotal : 0;
    let runningTotal = 0;
    
    adjustedItems = orderItems.map(item => {
      const adjustedUnit = Number((Number(item.unit_price) * factor).toFixed(2));
      runningTotal += adjustedUnit * item.quantity;
      return {
        ...item,
        unit_price: adjustedUnit
      };
    });

    let diff = Number((discountedSubtotal - runningTotal).toFixed(2));
    if (adjustedItems.length > 0 && Math.abs(diff) >= 0.01) {
      const lastIndex = adjustedItems.length - 1;
      const lastItem = adjustedItems[lastIndex];
      const perUnitAdjustment = Number((diff / lastItem.quantity).toFixed(2));
      const adjustedUnitPrice = Math.max(0, Number((lastItem.unit_price + perUnitAdjustment).toFixed(2)));
      adjustedItems[lastIndex] = {
        ...lastItem,
        unit_price: adjustedUnitPrice
      };
    }
  }

  return adjustedItems;
}

/**
 * Salva dados do pagamento no banco
 */
export async function savePaymentData(paymentData) {
  const { error } = await supabase
    .from('payments')
    .insert(paymentData);

  if (error) {
    logger.info({ error: error.message }, 'Error saving payment data:');
  }

  return error;
}

/**
 * Atualiza status do pedido baseado no pagamento
 */
export async function updateOrderStatus(orderId, paymentStatus) {
  let orderStatus = 'pending';
  let paymentStatusMapped = paymentStatus;

  if (paymentStatus === 'approved') {
    orderStatus = 'processing';
    paymentStatusMapped = 'paid';
  } else if (paymentStatus === 'rejected') {
    paymentStatusMapped = 'failed';
  } else if (paymentStatus === 'cancelled') {
    paymentStatusMapped = 'cancelled';
    orderStatus = 'cancelled';
  }

  await supabase
    .from('orders')
    .update({ 
      status: orderStatus,
      payment_status: paymentStatusMapped,
      updated_at: new Date().toISOString()
    })
    .eq('id', orderId);

  return { orderStatus, paymentStatus: paymentStatusMapped };
}

/**
 * Processa notificação de pagamento
 */
export async function processPaymentNotification(mpPayment) {
  if (!mpPayment.external_reference) {
    return;
  }

  const orderId = mpPayment.external_reference;

  // Atualizar dados do pagamento no banco
  const { error: updateError } = await supabase
    .from('payments')
    .update({
      status: mpPayment.status,
      mp_payment_data: mpPayment,
      updated_at: new Date().toISOString()
    })
    .eq('mp_payment_id', mpPayment.id);

  if (updateError) {
    logger.info({ error: updateError.message }, 'Error updating payment:');
    return;
  }

  // Atualizar status do pedido
  const { orderStatus, paymentStatus } = await updateOrderStatus(orderId, mpPayment.status);

  logger.info({ 
    order_id: orderId,
    payment_status: paymentStatus,
    order_status: orderStatus 
  }, 'Order status updated:');
}

/**
 * Busca dados de pagamento do usuário
 */
export async function getUserPayment(paymentId, userId) {
  const { data: payment, error } = await supabase
    .from('payments')
    .select('*')
    .eq('mp_payment_id', paymentId)
    .eq('user_id', userId)
    .single();

  if (error || !payment) {
    return null;
  }

  return payment;
}
