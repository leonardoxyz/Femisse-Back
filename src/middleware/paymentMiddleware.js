import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { validateUUID, sanitizeString, secureLog } from '../utils/securityUtils.js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Schema específico para validação de pagamentos Mercado Pago
export const mercadoPagoPaymentSchema = z.object({
  // Dados do pedido
  order_id: z.string().uuid('ID do pedido inválido'),
  
  // Método de pagamento
  payment_method: z.enum(['pix', 'credit_card', 'debit_card'], {
    errorMap: () => ({ message: 'Método de pagamento inválido' })
  }),
  
  // Dados do cartão (apenas para cartão)
  card_token: z.string()
    .min(1, 'Token do cartão é obrigatório')
    .max(500, 'Token do cartão inválido')
    .optional(),
  
  // Dados de parcelamento
  installments: z.number()
    .min(1, 'Parcelas mínimas: 1')
    .max(12, 'Parcelas máximas: 12')
    .int('Parcelas deve ser um número inteiro')
    .default(1),
  
  // Valor total (validação de integridade)
  total_amount: z.number()
    .min(0.01, 'Valor mínimo: R$ 0,01')
    .max(50000, 'Valor máximo: R$ 50.000')
    .multipleOf(0.01, 'Valor deve ter no máximo 2 casas decimais'),
  
  // Dados do comprador (obrigatórios para MP)
  payer: z.object({
    email: z.string().email('Email inválido'),
    first_name: z.string()
      .min(1, 'Nome é obrigatório')
      .max(50, 'Nome muito longo')
      .regex(/^[a-zA-ZÀ-ÿ\s]+$/, 'Nome deve conter apenas letras'),
    last_name: z.string()
      .min(1, 'Sobrenome é obrigatório')
      .max(50, 'Sobrenome muito longo')
      .regex(/^[a-zA-ZÀ-ÿ\s]+$/, 'Sobrenome deve conter apenas letras'),
    identification: z.object({
      type: z.enum(['CPF'], { errorMap: () => ({ message: 'Tipo de documento inválido' }) }),
      number: z.string()
        .regex(/^\d{11}$/, 'CPF deve ter 11 dígitos')
        .refine(cpf => {
          // Validação básica de CPF
          if (/^(\d)\1{10}$/.test(cpf)) return false;
          return true;
        }, 'CPF inválido')
    }).optional()
  }),
  
  // Dados de endereço (obrigatórios para alguns métodos)
  shipping_address: z.object({
    street_name: z.string().min(1).max(100),
    street_number: z.string().min(1).max(10),
    zip_code: z.string().regex(/^\d{8}$/, 'CEP deve ter 8 dígitos'),
    city: z.string().min(1).max(50),
    state: z.string().length(2, 'Estado deve ter 2 caracteres'),
    neighborhood: z.string().min(1).max(50)
  }).optional(),
  
  // Metadados seguros
  metadata: z.object({
    user_id: z.string().uuid('ID do usuário inválido'),
    order_number: z.string().min(1).max(50),
    platform: z.literal('feminisse-ecommerce')
  })
});

// Middleware para validar dados de pagamento
export const validatePaymentData = (req, res, next) => {
  try {
    const result = mercadoPagoPaymentSchema.safeParse(req.body);
    
    if (!result.success) {
      const errors = result.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));
      
      secureLog('Payment validation failed:', { 
        errors, 
        userId: req.user?.id,
        ip: req.ip 
      });
      
      return res.status(400).json({
        error: 'Dados de pagamento inválidos',
        details: errors
      });
    }
    
    // Sanitiza strings nos dados validados
    const sanitizedData = sanitizePaymentData(result.data);
    req.validatedPayment = sanitizedData;
    
    next();
  } catch (error) {
    console.error('Payment validation middleware error:', error);
    res.status(500).json({ error: 'Erro interno de validação de pagamento' });
  }
};

// Função para sanitizar dados de pagamento
const sanitizePaymentData = (data) => {
  return {
    ...data,
    payer: {
      ...data.payer,
      first_name: sanitizeString(data.payer.first_name),
      last_name: sanitizeString(data.payer.last_name),
      email: sanitizeString(data.payer.email)
    },
    shipping_address: data.shipping_address ? {
      ...data.shipping_address,
      street_name: sanitizeString(data.shipping_address.street_name),
      street_number: sanitizeString(data.shipping_address.street_number),
      city: sanitizeString(data.shipping_address.city),
      state: sanitizeString(data.shipping_address.state),
      neighborhood: sanitizeString(data.shipping_address.neighborhood)
    } : undefined
  };
};

// Middleware para verificar integridade do pedido
export const verifyOrderIntegrity = async (req, res, next) => {
  try {
    const { order_id, total_amount } = req.validatedPayment;
    const userId = req.user.id;
    
    // Busca o pedido no banco com dados do cupom
    const { data: order, error } = await supabase
      .from('orders')
      .select('id, user_id, total, subtotal, shipping_cost, discount, status, payment_status, coupon_id, coupon_code, coupon_discount')
      .eq('id', order_id)
      .eq('user_id', userId)
      .single();
    
    if (error || !order) {
      secureLog('Order not found for payment:', { 
        order_id, 
        userId, 
        error: error?.message 
      });
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }
    
    // Verifica se o pedido pode ser pago
    if (order.payment_status !== 'pending') {
      secureLog('Order payment status invalid:', { 
        order_id, 
        userId, 
        current_status: order.payment_status 
      });
      return res.status(400).json({ 
        error: 'Pedido não pode ser pago',
        details: 'Status de pagamento inválido'
      });
    }
    
    // Verifica integridade do valor considerando cupom
    // Se houver cupom, valida que o desconto está correto
    const subtotal = parseFloat(order.subtotal) || 0;
    const shippingCost = parseFloat(order.shipping_cost) || 0;
    const discount = parseFloat(order.discount) || 0;
    const storedCouponDiscount = parseFloat(order.coupon_discount) || 0;

    let expectedTotal = parseFloat(order.total);
    if (!Number.isFinite(expectedTotal)) {
      expectedTotal = subtotal - discount - storedCouponDiscount + shippingCost;
    }
    expectedTotal = Math.round(expectedTotal * 100) / 100;

    let verifiedCouponDiscount = storedCouponDiscount;

    if (order.coupon_id && order.coupon_code) {
      // Buscar cupom no banco para validar desconto
      const { data: coupon, error: couponError } = await supabase
        .from('coupons')
        .select('id, code, discount_type, discount_value, scope, active, valid_from, valid_to, applicable_categories, applicable_products')
        .eq('id', order.coupon_id)
        .single();
      
      if (couponError || !coupon) {
        secureLog('Coupon not found during payment verification:', { 
          order_id, 
          userId,
          coupon_id: order.coupon_id,
          coupon_code: order.coupon_code
        });
        return res.status(400).json({ 
          error: 'Cupom inválido',
          details: 'O cupom aplicado não existe mais'
        });
      }
      
      // Verificar se cupom ainda está ativo e válido
      if (!coupon.active) {
        secureLog('Coupon inactive during payment:', { 
          order_id, 
          userId,
          coupon_code: coupon.code
        });
        return res.status(400).json({ 
          error: 'Cupom inativo',
          details: 'O cupom aplicado não está mais ativo'
        });
      }
      
      const now = new Date();
      const validFrom = new Date(coupon.valid_from);
      const validTo = coupon.valid_to ? new Date(coupon.valid_to) : null;
      
      if (now < validFrom || (validTo && now > validTo)) {
        secureLog('Coupon expired during payment:', { 
          order_id, 
          userId,
          coupon_code: coupon.code
        });
        return res.status(400).json({ 
          error: 'Cupom expirado',
          details: 'O cupom aplicado expirou'
        });
      }
      
      // Recalcular desconto esperado baseado no cupom
      let expectedDiscount = 0;
      
      // Validar que subtotal existe
      if (subtotal <= 0) {
        secureLog('Order subtotal missing or invalid:', { 
          order_id, 
          userId, 
          subtotal: order.subtotal
        });
        return res.status(400).json({ 
          error: 'Dados do pedido inválidos',
          details: 'Subtotal do pedido não encontrado'
        });
      }
      
      if (coupon.discount_type === 'percentage') {
        expectedDiscount = (subtotal * coupon.discount_value) / 100;
      } else if (coupon.discount_type === 'fixed') {
        expectedDiscount = Math.min(coupon.discount_value, subtotal);
      }
      
      // Arredondar para 2 casas decimais
      expectedDiscount = Math.round(expectedDiscount * 100) / 100;
      verifiedCouponDiscount = expectedDiscount;

      // Verificar se o desconto aplicado está correto (tolerância de 0.02 para arredondamento)
      const discountDifference = Math.abs(storedCouponDiscount - expectedDiscount);
      
      if (discountDifference > 0.02) {
        secureLog('Coupon discount mismatch:', { 
          order_id, 
          userId, 
          coupon_code: coupon.code,
          expected_discount: expectedDiscount,
          applied_discount: order.coupon_discount,
          difference: discountDifference
        });
        return res.status(400).json({ 
          error: 'Desconto inválido',
          details: 'O desconto do cupom foi manipulado'
        });
      }
      
      // Recalcular total esperado
      expectedTotal = subtotal - discount - expectedDiscount + shippingCost;
      expectedTotal = Math.round(expectedTotal * 100) / 100;

      secureLog('Payment integrity check with coupon:', {
        order_id,
        userId,
        coupon_code: coupon.code,
        subtotal,
        discount: order.discount,
        expected_discount: expectedDiscount,
        applied_discount: order.coupon_discount,
        shipping: order.shipping_cost,
        expected_total: expectedTotal,
        payment_amount: total_amount
      });
    }
    
    // Verifica integridade do valor final (tolerância de 0.02 para arredondamento)
    const totalDifference = Math.abs(expectedTotal - total_amount);
    
    // Log detalhado para debug
    console.log('=== PAYMENT INTEGRITY CHECK ===');
    console.log('Order ID:', order_id);
    console.log('Order Data:', {
      subtotal: order.subtotal,
      shipping_cost: order.shipping_cost,
      discount: order.discount,
      coupon_discount: order.coupon_discount,
      total: order.total
    });
    console.log('Expected Total:', expectedTotal);
    console.log('Payment Amount:', total_amount);
    console.log('Difference:', totalDifference);
    console.log('Has Coupon:', !!order.coupon_id);
    console.log('===============================');
    
    if (totalDifference > 0.02) {
      secureLog('Payment amount mismatch:', { 
        order_id, 
        userId,
        order_subtotal: order.subtotal,
        order_shipping: order.shipping_cost,
        order_discount: order.discount,
        order_coupon_discount: order.coupon_discount,
        order_total: order.total,
        expected_total: expectedTotal,
        payment_amount: total_amount,
        difference: totalDifference,
        has_coupon: !!order.coupon_id
      });
      return res.status(400).json({ 
        error: 'Valor do pagamento não confere',
        details: 'Integridade do pedido comprometida'
      });
    }
    
    req.orderData = order;
    req.orderPricing = {
      subtotal,
      shippingCost,
      discount,
      couponDiscount: verifiedCouponDiscount,
      total: expectedTotal
    };
    next();
  } catch (error) {
    console.error('Order integrity verification error:', error);
    res.status(500).json({ error: 'Erro interno na verificação do pedido' });
  }
};

// Middleware para log de tentativas de pagamento
export const logPaymentAttempt = (req, res, next) => {
  const { order_id, payment_method, total_amount } = req.validatedPayment;
  const userId = req.user.id;
  
  secureLog('Payment attempt started:', {
    order_id,
    userId,
    payment_method,
    total_amount,
    ip: req.ip,
    user_agent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  
  next();
};

// Rate limiting específico para pagamentos (mais restritivo)
import rateLimit from 'express-rate-limit';

const isDevelopment = process.env.NODE_ENV !== 'production';

export const paymentRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: isDevelopment ? 50 : 5, // Desenvolvimento: 50, Produção: 5 tentativas
  message: { 
    error: 'Muitas tentativas de pagamento',
    details: 'Aguarde alguns minutos antes de tentar novamente'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Não contar requisições bem-sucedidas
  handler: (req, res) => {
    secureLog('Payment rate limit exceeded:', {
      ip: req.ip,
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });
    res.status(429).json({ 
      error: 'Muitas tentativas de pagamento',
      details: 'Aguarde alguns minutos antes de tentar novamente'
    });
  }
});

export default {
  mercadoPagoPaymentSchema,
  validatePaymentData,
  verifyOrderIntegrity,
  logPaymentAttempt,
  paymentRateLimit
};
