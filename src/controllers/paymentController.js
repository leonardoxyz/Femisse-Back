import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import { secureLog } from '../utils/securityUtils.js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Configuração do Mercado Pago
const MP_ACCESS_TOKEN = process.env.MERCADO_PAGO_ACCESS_TOKEN;
const MP_PUBLIC_KEY = process.env.MERCADO_PAGO_PUBLIC_KEY;
const MP_WEBHOOK_SECRET = process.env.MERCADO_PAGO_WEBHOOK_SECRET;

if (!MP_ACCESS_TOKEN || !MP_PUBLIC_KEY) {
  throw new Error('Credenciais do Mercado Pago não configuradas');
}

const mercadoPagoAPI = axios.create({
  baseURL: 'https://api.mercadopago.com',
  headers: {
    'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
    'X-Idempotency-Key': () => `feminisse-${Date.now()}-${Math.random()}`
  },
  timeout: 30000 // 30 segundos
});

// Criar preferência de pagamento (checkout transparente)
export async function createPaymentPreference(req, res) {
  try {
    const paymentData = req.validatedPayment;
    const order = req.orderData;
    const userId = req.user.id;

    secureLog('Creating payment preference:', { 
      order_id: order.id, 
      userId,
      payment_method: paymentData.payment_method 
    });

    // PROTEÇÃO: Verificar se já existe pagamento aprovado para este pedido
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('*')
      .eq('order_id', order.id)
      .eq('status', 'approved')
      .single();

    if (existingPayment) {
      return res.status(400).json({ 
        error: 'Pagamento já processado',
        message: 'Este pedido já possui um pagamento aprovado. Não é possível pagar novamente.',
        payment_id: existingPayment.mp_payment_id
      });
    }

    // Buscar itens do pedido
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order.id);

    if (itemsError || !orderItems?.length) {
      return res.status(400).json({ 
        error: 'Itens do pedido não encontrados',
        details: itemsError?.message 
      });
    }

    // Preparar dados para o Mercado Pago
    const preferenceData = {
      items: orderItems.map(item => ({
        id: item.product_id,
        title: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        currency_id: 'BRL'
      })),
      
      payer: {
        name: paymentData.payer.first_name,
        surname: paymentData.payer.last_name,
        email: paymentData.payer.email,
        identification: paymentData.payer.identification ? {
          type: paymentData.payer.identification.type,
          number: paymentData.payer.identification.number
        } : undefined
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
        success: `${process.env.FRONTEND_URL}/checkout/success`,
        failure: `${process.env.FRONTEND_URL}/checkout/failure`,
        pending: `${process.env.FRONTEND_URL}/checkout/pending`
      },

      auto_return: 'approved',
      
      notification_url: `${process.env.BACKEND_URL}/api/payments/webhook`,
      
      external_reference: order.id,
      
      metadata: {
        user_id: userId,
        order_id: order.id,
        order_number: order.order_number,
        platform: 'feminisse-ecommerce'
      },

      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutos
    };

    // Criar preferência no Mercado Pago
    const response = await mercadoPagoAPI.post('/checkout/preferences', preferenceData);
    
    if (response.status !== 201) {
      throw new Error(`Mercado Pago API error: ${response.status}`);
    }

    const preference = response.data;

    // Salvar dados do pagamento no banco
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        order_id: order.id,
        user_id: userId,
        preference_id: preference.id,
        payment_method: paymentData.payment_method,
        amount: paymentData.total_amount,
        status: 'pending',
        mp_preference_data: preference,
        created_at: new Date().toISOString()
      });

    if (paymentError) {
      console.error('Error saving payment data:', paymentError);
      // Não falha a operação, apenas loga o erro
    }

    secureLog('Payment preference created successfully:', { 
      order_id: order.id, 
      userId,
      preference_id: preference.id 
    });

    res.status(201).json({
      preference_id: preference.id,
      init_point: preference.init_point,
      sandbox_init_point: preference.sandbox_init_point,
      public_key: MP_PUBLIC_KEY,
      expires_at: preference.expiration_date_to
    });

  } catch (error) {
    console.error('Error creating payment preference:', error);
    
    secureLog('Payment preference creation failed:', { 
      order_id: req.orderData?.id, 
      userId: req.user?.id,
      error: error.message 
    });

    if (error.response?.data) {
      return res.status(400).json({
        error: 'Erro ao processar pagamento',
        details: 'Dados de pagamento inválidos'
      });
    }

    res.status(500).json({ 
      error: 'Erro interno ao processar pagamento',
      details: 'Tente novamente em alguns instantes'
    });
  }
}

// Processar pagamento direto (para PIX e cartão)
export async function processDirectPayment(req, res) {
  try {
    const paymentData = req.validatedPayment;
    const order = req.orderData;
    const userId = req.user.id;

    secureLog('Processing direct payment:', { 
      order_id: order.id, 
      userId,
      payment_method: paymentData.payment_method 
    });

    // PROTEÇÃO: Verificar se já existe pagamento aprovado para este pedido
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('*')
      .eq('order_id', order.id)
      .eq('status', 'approved')
      .single();

    if (existingPayment) {
      return res.status(400).json({ 
        error: 'Pagamento já processado',
        message: 'Este pedido já possui um pagamento aprovado. Não é possível pagar novamente.',
        payment_id: existingPayment.mp_payment_id
      });
    }

    const paymentPayload = {
      transaction_amount: paymentData.total_amount,
      payer: {
        email: paymentData.payer.email,
        first_name: paymentData.payer.first_name,
        last_name: paymentData.payer.last_name,
        identification: paymentData.payer.identification
      },
      external_reference: order.id,
      description: `Pedido #${order.order_number} - Femisse`,
      metadata: {
        user_id: userId,
        order_id: order.id,
        order_number: order.order_number,
        platform: 'femisse-ecommerce'
      }
    };

    // Adicionar notification_url apenas se estiver configurada e for válida
    const backendUrl = process.env.BACKEND_URL;
    if (backendUrl && backendUrl.startsWith('http')) {
      paymentPayload.notification_url = `${backendUrl}/api/payments/webhook`;
    }

    // Para cartão: usar token e especificar tipo (débito ou crédito)
    if (paymentData.card_token && paymentData.payment_method !== 'pix') {
      paymentPayload.token = paymentData.card_token;
      paymentPayload.installments = paymentData.installments || 1;
      
      // IMPORTANTE: Especificar se é débito ou crédito
      // O MP precisa saber o tipo mesmo com token
      if (paymentData.payment_method === 'debit_card') {
        paymentPayload.payment_method_id = 'debit_card';
      } else if (paymentData.payment_method === 'credit_card') {
        paymentPayload.payment_method_id = 'credit_card';
      }
    } else {
      // Para PIX: enviar payment_method_id
      paymentPayload.payment_method_id = paymentData.payment_method;
    }

    // Gerar idempotency key única para evitar duplicação
    const idempotencyKey = `${order.id}-${Date.now()}`;
    
    // Processar pagamento no Mercado Pago
    const response = await mercadoPagoAPI.post('/v1/payments', paymentPayload, {
      headers: {
        'X-Idempotency-Key': idempotencyKey
      }
    });
    
    // Aceitar tanto 200 (OK) quanto 201 (Created)
    if (response.status !== 200 && response.status !== 201) {
      throw new Error(`Mercado Pago API error: ${response.status}`);
    }

    const payment = response.data;

    // Salvar dados do pagamento no banco
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        order_id: order.id,
        user_id: userId,
        mp_payment_id: payment.id,
        payment_method: paymentData.payment_method,
        amount: payment.transaction_amount,
        status: payment.status,
        mp_payment_data: payment,
        created_at: new Date().toISOString()
      });

    if (paymentError) {
      console.error('Error saving payment data:', paymentError);
    }

    // Atualizar status do pedido baseado no pagamento
    let orderStatus = 'pending';
    let paymentStatus = payment.status;

    if (payment.status === 'approved') {
      orderStatus = 'processing';
      paymentStatus = 'paid';
    } else if (payment.status === 'rejected') {
      paymentStatus = 'failed';
    }

    await supabase
      .from('orders')
      .update({ 
        status: orderStatus,
        payment_status: paymentStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id);

    secureLog('Direct payment processed:', { 
      order_id: order.id, 
      userId,
      payment_id: payment.id,
      status: payment.status 
    });

    // Resposta baseada no tipo de pagamento
    const responseData = {
      payment_id: payment.id,
      status: payment.status,
      status_detail: payment.status_detail
    };

    // Para PIX, incluir dados do QR Code
    if (paymentData.payment_method === 'pix' && payment.point_of_interaction?.transaction_data) {
      responseData.pix = {
        qr_code: payment.point_of_interaction.transaction_data.qr_code,
        qr_code_base64: payment.point_of_interaction.transaction_data.qr_code_base64,
        ticket_url: payment.point_of_interaction.transaction_data.ticket_url
      };
    }

    res.status(201).json(responseData);

  } catch (error) {
    console.error('Error processing direct payment:', error);
    console.error('Error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    secureLog('Direct payment processing failed:', { 
      order_id: req.orderData?.id, 
      userId: req.user?.id,
      error: error.message,
      mpError: error.response?.data
    });

    if (error.response?.data) {
      const mpError = error.response.data;
      return res.status(400).json({
        error: 'Pagamento rejeitado',
        details: mpError.message || mpError.error || 'Verifique os dados do pagamento',
        mpDetails: mpError // Incluir detalhes do MP em desenvolvimento
      });
    }

    res.status(500).json({ 
      error: 'Erro interno ao processar pagamento',
      details: error.message || 'Tente novamente em alguns instantes'
    });
  }
}

// Webhook do Mercado Pago
export async function handleWebhook(req, res) {
  try {
    const { type, data, action } = req.body;

    secureLog('Webhook received:', { type, action, data_id: data?.id });

    // Verificar assinatura do webhook (se configurada)
    if (MP_WEBHOOK_SECRET) {
      const signature = req.headers['x-signature'];
      // Implementar verificação de assinatura aqui se necessário
    }

    // Processar apenas notificações de pagamento
    if (type === 'payment' && data?.id) {
      await processPaymentNotification(data.id);
    }

    res.status(200).json({ received: true });

  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}

// Processar notificação de pagamento
async function processPaymentNotification(paymentId) {
  try {
    // Buscar dados do pagamento no Mercado Pago
    const response = await mercadoPagoAPI.get(`/v1/payments/${paymentId}`);
    const payment = response.data;

    secureLog('Processing payment notification:', { 
      payment_id: paymentId, 
      status: payment.status,
      external_reference: payment.external_reference 
    });

    // Atualizar dados do pagamento no banco
    const { error: updateError } = await supabase
      .from('payments')
      .update({
        status: payment.status,
        mp_payment_data: payment,
        updated_at: new Date().toISOString()
      })
      .eq('mp_payment_id', paymentId);

    if (updateError) {
      console.error('Error updating payment:', updateError);
      return;
    }

    // Atualizar status do pedido
    if (payment.external_reference) {
      let orderStatus = 'pending';
      let paymentStatus = payment.status;

      if (payment.status === 'approved') {
        orderStatus = 'processing';
        paymentStatus = 'paid';
      } else if (payment.status === 'rejected') {
        paymentStatus = 'failed';
      } else if (payment.status === 'cancelled') {
        paymentStatus = 'cancelled';
        orderStatus = 'cancelled';
      }

      await supabase
        .from('orders')
        .update({ 
          status: orderStatus,
          payment_status: paymentStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', payment.external_reference);

      secureLog('Order status updated:', { 
        order_id: payment.external_reference,
        payment_status: paymentStatus,
        order_status: orderStatus 
      });
    }

  } catch (error) {
    console.error('Error processing payment notification:', error);
  }
}

// Consultar status de pagamento
export async function getPaymentStatus(req, res) {
  try {
    const { payment_id } = req.params;
    const userId = req.user.id;

    // Validar se o pagamento pertence ao usuário
    const { data: payment, error } = await supabase
      .from('payments')
      .select('*')
      .eq('mp_payment_id', payment_id)
      .eq('user_id', userId)
      .single();

    if (error || !payment) {
      return res.status(404).json({ error: 'Pagamento não encontrado' });
    }

    // Buscar dados atualizados no Mercado Pago
    try {
      const response = await mercadoPagoAPI.get(`/v1/payments/${payment_id}`);
      const mpPayment = response.data;

      // Atualizar dados no banco se necessário
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
      // Se falhar ao consultar MP, retorna dados do banco
      res.json({
        payment_id: payment.mp_payment_id,
        status: payment.status,
        amount: payment.amount,
        payment_method: payment.payment_method,
        created_at: payment.created_at
      });
    }

  } catch (error) {
    console.error('Error getting payment status:', error);
    res.status(500).json({ error: 'Erro ao consultar status do pagamento' });
  }
}

export default {
  createPaymentPreference,
  processDirectPayment,
  handleWebhook,
  getPaymentStatus
};
