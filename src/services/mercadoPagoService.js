import axios from 'axios';
import { env } from '../config/validateEnv.js';
import { secureLog } from '../utils/securityUtils.js';

const MP_ACCESS_TOKEN = env.MERCADO_PAGO_ACCESS_TOKEN;
const MP_PUBLIC_KEY = env.MERCADO_PAGO_PUBLIC_KEY;

const MP_CONFIGURED = !!(MP_ACCESS_TOKEN && MP_PUBLIC_KEY);

if (!MP_CONFIGURED) {
  console.warn('⚠️ Mercado Pago não configurado - funcionalidades de pagamento desabilitadas');
}

const mercadoPagoAPI = axios.create({
  baseURL: 'https://api.mercadopago.com',
  headers: {
    'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  },
  timeout: 30000
});

/**
 * Cria preferência de pagamento no Mercado Pago
 */
export async function createPreference(preferenceData) {
  if (!MP_CONFIGURED) {
    throw new Error('Mercado Pago não configurado');
  }
  
  try {
    const response = await mercadoPagoAPI.post('/checkout/preferences', preferenceData);
    
    if (response.status !== 201) {
      throw new Error(`Mercado Pago API error: ${response.status}`);
    }

    return response.data;
  } catch (error) {
    secureLog('Mercado Pago preference creation failed:', { error: error.message });
    throw error;
  }
}

/**
 * Processa pagamento direto (PIX/Cartão)
 */
export async function processPayment(paymentPayload, orderId) {
  if (!MP_CONFIGURED) {
    throw new Error('Mercado Pago não configurado');
  }
  
  try {
    const idempotencyKey = `${orderId}-${Date.now()}`;
    
    const response = await mercadoPagoAPI.post('/v1/payments', paymentPayload, {
      headers: {
        'X-Idempotency-Key': idempotencyKey
      }
    });
    
    if (response.status !== 200 && response.status !== 201) {
      throw new Error(`Mercado Pago API error: ${response.status}`);
    }

    return response.data;
  } catch (error) {
    secureLog('Mercado Pago payment processing failed:', { 
      orderId, 
      error: error.message,
      mpError: error.response?.data 
    });
    throw error;
  }
}

/**
 * Busca dados de pagamento no Mercado Pago
 */
export async function getPaymentData(paymentId) {
  if (!MP_CONFIGURED) {
    throw new Error('Mercado Pago não configurado');
  }
  
  try {
    const response = await mercadoPagoAPI.get(`/v1/payments/${paymentId}`);
    return response.data;
  } catch (error) {
    secureLog('Mercado Pago payment fetch failed:', { paymentId, error: error.message });
    throw error;
  }
}

/**
 * Retorna chave pública do Mercado Pago
 */
export function getPublicKey() {
  if (!MP_CONFIGURED) {
    return null;
  }
  return MP_PUBLIC_KEY;
}
