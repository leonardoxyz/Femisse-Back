import supabase from '../services/supabaseClient.js';
import { getErrorMessage, validateUUID } from '../utils/securityUtils.js';
import * as mercadoPagoService from '../services/mercadoPagoService.js';
import * as paymentProcessingService from '../services/paymentProcessingService.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/validateEnv.js';
import { validateMercadoPagoWebhook } from '../services/webhookSecurityService.js';
import { sanitizeMercadoPagoError, sanitizeErrorMessage } from '../utils/errorSanitizer.js';
import { maskSensitiveData } from '../utils/dataMasking.js';
import { getClientIp, getCloudflareMeta } from '../utils/requestUtils.js';
export async function createPaymentPreference(req, res) {
  try {
    const paymentData = req.validatedPayment;
    const order = req.orderData;
    const userId = req.user.id;

    logger.info({ order_id: order.id, userId }, 'Creating payment preference:');

    const existingPayment = await paymentProcessingService.checkExistingApprovedPayment(order.id);
    if (existingPayment) {
      return res.status(400).json({ 
        error: 'Pagamento já processado',
        message: 'Este pedido já possui um pagamento aprovado.',
        payment_id: existingPayment.mp_payment_id
      });
    }

    const orderItems = await paymentProcessingService.getOrderItems(order.id);
    const shippingCost = Number(order.shipping_cost ?? 0);
    const rawSubtotal = orderItems.reduce((sum, item) => sum + (Number(item.unit_price) * item.quantity), 0);
    const orderTotal = Number(order.total ?? (Number(order.subtotal ?? rawSubtotal) + shippingCost));
    const discountedSubtotal = Math.max(0, Number((orderTotal - shippingCost).toFixed(2)));

    const adjustedItems = paymentProcessingService.calculateAdjustedItems(orderItems, discountedSubtotal, rawSubtotal);

    const preferenceData = {
      items: adjustedItems.map(item => ({
        id: item.product_id,
        title: item.product_name,
        quantity: item.quantity,
        unit_price: Number(item.unit_price.toFixed(2)),
        currency_id: 'BRL'
      })),
      payer: {
        name: paymentData.payer.first_name,
        surname: paymentData.payer.last_name,
        email: paymentData.payer.email,
        identification: paymentData.payer.identification
      },
      payment_methods: {
        excluded_payment_methods: [],
        excluded_payment_types: [],
        installments: paymentData.installments || 12
      },
      shipments: paymentData.shipping_address ? {
        cost: order.shipping_cost || 0,
        mode: 'not_specified',
        receiver_address: {
          zip_code: paymentData.shipping_address.zip_code,
          street_name: paymentData.shipping_address.street_name,
          street_number: paymentData.shipping_address.street_number,
          city_name: paymentData.shipping_address.city,
          state_name: paymentData.shipping_address.state
        }
      } : undefined,
      back_urls: {
        success: `${env.FRONTEND_URL}/checkout/success`,
        failure: `${env.FRONTEND_URL}/checkout/failure`,
        pending: `${env.FRONTEND_URL}/checkout/pending`
      },
      auto_return: 'approved',
      notification_url: env.BACKEND_URL ? `${env.BACKEND_URL}/api/payments/webhook` : undefined,
      external_reference: order.id,
      metadata: {
        user_id: userId,
        order_id: order.id,
        order_number: order.order_number || order.id.slice(-8),
        platform: 'Femisse-ecommerce'
      },
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(Date.now() + 30 * 60 * 1000).toISOString()
    };

    const preference = await mercadoPagoService.createPreference(preferenceData);

    await paymentProcessingService.savePaymentData({
      order_id: order.id,
      user_id: userId,
      preference_id: preference.id,
      payment_method: paymentData.payment_method,
      amount: orderTotal,
      status: 'pending',
      mp_preference_data: preference,
      created_at: new Date().toISOString()
    });

    logger.info({ order_id: order.id, preference_id: preference.id }, 'Payment preference created:');

    res.status(201).json({
      preference_id: preference.id,
      init_point: preference.init_point,
      sandbox_init_point: preference.sandbox_init_point,
      public_key: mercadoPagoService.getPublicKey(),
      expires_at: preference.expiration_date_to
    });

  } catch (error) {
    logger.info({ error: error.message }, 'Payment preference creation failed:');
    res.status(error.response?.status || 500).json({ 
      error: 'Erro ao processar pagamento',
      details: error.message 
    });
  }
}

export async function processDirectPayment(req, res) {
  const paymentData = req.validatedPayment;
  const order = req.orderData;
  const userId = req.user.id;

  try {

    logger.info({ order_id: order.id, userId, order_number: order.order_number }, 'Processing direct payment:');

    const existingPayment = await paymentProcessingService.checkExistingApprovedPayment(order.id);
    if (existingPayment) {
      return res.status(400).json({ 
        error: 'Pagamento já processado',
        message: 'Este pedido já possui um pagamento aprovado.',
        payment_id: existingPayment.mp_payment_id
      });
    }

    const totalDiscount = (parseFloat(order.discount) || 0) + (parseFloat(order.coupon_discount) || 0);
    const pricing = req.orderPricing ?? {
      subtotal: parseFloat(order.subtotal) || 0,
      shippingCost: parseFloat(order.shipping_cost) || 0,
      discount: parseFloat(order.discount) || 0,
      couponDiscount: parseFloat(order.coupon_discount) || 0,
      total: parseFloat(order.total) || paymentData.total_amount
    };

    const paymentPayload = {
      transaction_amount: pricing.total,
      payer: {
        email: paymentData.payer.email,
        first_name: paymentData.payer.first_name,
        last_name: paymentData.payer.last_name,
        identification: paymentData.payer.identification
      },
      external_reference: order.id,
      description: `Pedido #${order.order_number || order.id.slice(-8)} - Femisse${totalDiscount > 0 ? ` (Desconto: R$ ${totalDiscount.toFixed(2)})` : ''}`,
      metadata: {
        user_id: userId,
        order_id: order.id,
        order_number: order.order_number || order.id.slice(-8),
        platform: 'femisse-ecommerce',
        subtotal: pricing.subtotal,
        shipping_cost: pricing.shippingCost,
        discount: pricing.discount,
        coupon_discount: pricing.couponDiscount,
        coupon_code: order.coupon_code || null
      },
      notification_url: env.BACKEND_URL ? `${env.BACKEND_URL}/api/payments/webhook` : undefined
    };

    if (paymentData.card_token && paymentData.payment_method !== 'pix') {
      paymentPayload.token = paymentData.card_token;
      paymentPayload.installments = paymentData.installments || 1;
      paymentPayload.payment_method_id = paymentData.mp_payment_method_id || paymentData.payment_method;
      if (paymentData.mp_issuer_id) {
        paymentPayload.issuer_id = paymentData.mp_issuer_id;
      }
      if (paymentData.mp_payment_type_id) {
        paymentPayload.payment_type_id = paymentData.mp_payment_type_id;
      }
      paymentPayload.metadata = {
        ...paymentPayload.metadata,
        card_bin: paymentData.card_bin || null,
        card_brand: paymentData.card_brand || null,
        installment_amount: paymentData.mp_installment_amount || null,
        installment_total_amount: paymentData.mp_installment_total_amount || null,
      };
    } else {
      paymentPayload.payment_method_id = paymentData.payment_method;

      if (paymentData.payment_method === 'pix') {
        const expirationDate = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        paymentPayload.date_of_expiration = expirationDate;
      }
    }

    logger.info({
      order_id: order.id,
      userId,
      payment_method_id: paymentPayload.payment_method_id,
      issuer_id: paymentPayload.issuer_id || null,
      card_bin: paymentData.card_bin || null,
      installments: paymentPayload.installments,
    }, 'Mercado Pago payload metadata prepared');

    const payment = await mercadoPagoService.processPayment(paymentPayload, order.id);

    await paymentProcessingService.savePaymentData({
      order_id: order.id,
      user_id: userId,
      mp_payment_id: payment.id,
      payment_method: paymentData.payment_method,
      amount: pricing.total,
      status: payment.status,
      mp_payment_data: payment,
      created_at: new Date().toISOString()
    });

    await paymentProcessingService.updateOrderStatus(order.id, payment.status);

    logger.info({ order_id: order.id, payment_id: payment.id }, 'Direct payment processed:');

    const responseData = {
      payment_id: payment.id,
      status: payment.status,
      status_detail: payment.status_detail
    };

    if (paymentData.payment_method === 'pix' && payment.point_of_interaction?.transaction_data) {
      responseData.pix = {
        qr_code: payment.point_of_interaction.transaction_data.qr_code,
        qr_code_base64: payment.point_of_interaction.transaction_data.qr_code_base64,
        ticket_url: payment.point_of_interaction.transaction_data.ticket_url
      };
    }

    res.status(201).json(responseData);

  } catch (error) {
    // 🔒 SEGURANÇA: Mascara dados sensíveis no log
    const safeLogData = maskSensitiveData({
      error: error.message,
      order_id: order?.id,
      userId,
      status: error.response?.status,
    });
    
    logger.info(safeLogData, 'Direct payment processing failed');

    // Restaura status do pedido e estoque quando o pagamento falha
    if (order?.id) {
      try {
        await paymentProcessingService.updateOrderStatus(order.id, 'rejected');
      } catch (updateError) {
        logger.error({ err: updateError, orderId: order.id }, 'Erro ao atualizar pedido após falha no pagamento');
      }
    }

    // 🔒 SEGURANÇA: Sanitiza erro do Mercado Pago
    const sanitizedError = sanitizeMercadoPagoError(error);
    const statusCode = error.response?.status || 500;

    res.status(statusCode).json({ 
      error: 'Pagamento rejeitado',
      message: sanitizedError.message,
    });
  }
}

export async function handleWebhook(req, res) {
  try {
    const payload = req.body;
    const headers = req.headers;
    const sourceIP = getClientIp(req);
    const cfMeta = getCloudflareMeta(req);

    // 🔒 SEGURANÇA: Valida webhook do Mercado Pago
    const validation = await validateMercadoPagoWebhook(payload, headers, sourceIP);
    
    if (!validation.valid) {
      logger.warn({
        ip: sourceIP,
        cfRay: cfMeta.cfRay,
        country: cfMeta.country,
        error: validation.error,
        type: payload?.type,
      }, 'Webhook validation failed');
      
      // Retorna 401 para webhooks inválidos (não retentar)
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: validation.error 
      });
    }

    const { type, data } = payload;

    logger.info({ 
      type, 
      data_id: data?.id,
      ip: sourceIP,
      cfRay: cfMeta.cfRay,
      country: cfMeta.country,
    }, 'Webhook validated and received');

    if (type === 'payment' && data?.id) {
      const payment = await mercadoPagoService.getPaymentData(data.id);
      await paymentProcessingService.processPaymentNotification(payment);
    }

    res.status(200).json({ received: true });

  } catch (error) {
    logger.error({ err: error }, 'Webhook processing error');
    
    // 🔒 SEGURANÇA: Sanitiza erro antes de retornar
    const safeMessage = sanitizeErrorMessage(error, 'Erro ao processar webhook');
    res.status(500).json({ error: safeMessage });
  }
}

export async function getPaymentStatus(req, res) {
  try {
    const { payment_id } = req.params;
    const userId = req.user.id;

    const payment = await paymentProcessingService.getUserPayment(payment_id, userId);
    if (!payment) {
      return res.status(404).json({ error: 'Pagamento não encontrado' });
    }

    try {
      const mpPayment = await mercadoPagoService.getPaymentData(payment_id);

      if (mpPayment.status !== payment.status) {
        await supabase
          .from('payments')
          .update({
            status: mpPayment.status,
            mp_payment_data: mpPayment,
            updated_at: new Date().toISOString()
          })
          .eq('mp_payment_id', payment_id);
      }

      res.json({
        payment_id: mpPayment.id,
        status: mpPayment.status,
        status_detail: mpPayment.status_detail,
        amount: mpPayment.transaction_amount,
        payment_method: mpPayment.payment_method_id,
        created_at: mpPayment.date_created
      });

    } catch (mpError) {
      res.json({
        payment_id: payment.mp_payment_id,
        status: payment.status,
        amount: payment.amount,
        payment_method: payment.payment_method,
        created_at: payment.created_at
      });
    }

  } catch (error) {
    logger.error({ err: error }, 'Error getting payment status');
    res.status(500).json({ error: 'Erro ao consultar status do pagamento' });
  }
}

export async function getPendingPaymentByOrder(req, res) {
  const { orderId } = req.params;
  const userId = req.user.id;

  const validation = validateUUID(orderId);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.message });
  }

  try {
    const payment = await paymentProcessingService.getUserPendingPaymentByOrder(orderId, userId);
    if (!payment) {
      return res.status(404).json({ error: 'Pagamento pendente não encontrado para este pedido' });
    }

    return res.json({
      payment_id: payment.mp_payment_id,
      status: payment.status,
      payment_method: payment.payment_method,
      amount: payment.amount,
      pix: payment.mp_payment_data?.point_of_interaction?.transaction_data
        ? {
            qr_code: payment.mp_payment_data.point_of_interaction.transaction_data.qr_code,
            qr_code_base64: payment.mp_payment_data.point_of_interaction.transaction_data.qr_code_base64,
            ticket_url: payment.mp_payment_data.point_of_interaction.transaction_data.ticket_url,
          }
        : null,
      created_at: payment.created_at,
      expires_at: payment.mp_payment_data?.date_of_expiration ?? null,
    });
  } catch (error) {
    logger.error({ err: error, orderId, userId }, 'Erro ao buscar pagamento pendente do pedido');
    return res.status(500).json(getErrorMessage(error, 'Erro ao buscar pagamento pendente'));
  }
}

export default {
  createPaymentPreference,
  processDirectPayment,
  handleWebhook,
  getPaymentStatus,
  getPendingPaymentByOrder,
};
