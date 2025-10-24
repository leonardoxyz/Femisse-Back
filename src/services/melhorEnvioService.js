/**
 * SERVIÇO MELHOR ENVIO
 * 
 * Gerencia integração completa com API do MelhorEnvio:
 * - Autenticação OAuth2
 * - Cotação de fretes
 * - Compra de etiquetas
 * - Rastreamento de envios
 * 
 * Documentação: https://docs.melhorenvio.com.br/
 */

import axios from 'axios';
import supabase from './supabaseClient.js';
import { getErrorMessage } from '../utils/securityUtils.js';
import { logger } from '../utils/logger.js';
// URLs da API (Produção e Sandbox)
const MELHORENVIO_API_URL = process.env.MELHORENVIO_SANDBOX === 'true' 
  ? 'https://sandbox.melhorenvio.com.br/api/v2'
  : 'https://melhorenvio.com.br/api/v2';

const MELHORENVIO_AUTH_URL = process.env.MELHORENVIO_SANDBOX === 'true'
  ? 'https://sandbox.melhorenvio.com.br'
  : 'https://melhorenvio.com.br';

// Credenciais OAuth2
const CLIENT_ID = process.env.MELHORENVIO_CLIENT_ID;
const CLIENT_SECRET = process.env.MELHORENVIO_CLIENT_SECRET;
const REDIRECT_URI = process.env.MELHORENVIO_REDIRECT_URI;

/**
 * Cria instância do axios com configurações padrão
 */
const createApiClient = (accessToken = null) => {
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': 'Feminisse/1.0'
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  return axios.create({
    baseURL: MELHORENVIO_API_URL,
    headers,
    timeout: 30000 // 30 segundos
  });
};

/**
 * Loga operação no banco de dados
 */
const logOperation = async (operationType, status, data = {}) => {
  try {
    await supabase.from('melhorenvio_logs').insert([{
      user_id: data.userId || null,
      order_id: data.orderId || null,
      shipping_label_id: data.shippingLabelId || null,
      operation_type: operationType,
      status,
      message: data.message || null,
      request_data: data.request || null,
      response_data: data.response || null,
      error_details: data.error || null,
      ip_address: data.ipAddress || null,
      user_agent: data.userAgent || null
    }]);
  } catch (error) {
    logger.error({ err: error }, 'Erro ao registrar log MelhorEnvio');
  }
};

/**
 * AUTENTICAÇÃO OAUTH2
 */

/**
 * Gera URL de autorização OAuth2
 */
export const getAuthorizationUrl = (state = null) => {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'cart-read cart-write companies-read companies-write coupons-read coupons-write notifications-read orders-read products-read products-write purchases-read shipping-calculate shipping-cancel shipping-checkout shipping-companies shipping-generate shipping-preview shipping-print shipping-share shipping-tracking ecommerce-shipping transactions-read'
  });

  if (state) {
    params.append('state', state);
  }

  return `${MELHORENVIO_AUTH_URL}/oauth/authorize?${params.toString()}`;
};

/**
 * Troca código de autorização por tokens
 */
export const exchangeCodeForTokens = async (code, userId) => {
  try {
    const response = await axios.post(`${MELHORENVIO_AUTH_URL}/oauth/token`, {
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      code
    });

    const { access_token, refresh_token, expires_in, token_type, scope } = response.data;

    // Calcula data de expiração
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    // Salva tokens no banco
    const { data: tokenData, error } = await supabase
      .from('melhorenvio_tokens')
      .upsert([{
        user_id: userId,
        access_token,
        refresh_token,
        token_type,
        expires_at: expiresAt.toISOString(),
        scope
      }], { onConflict: 'user_id' })
      .select()
      .single();

    if (error) throw error;

    await logOperation('exchange_token', 'success', {
      userId,
      message: 'Tokens obtidos com sucesso'
    });

    return { success: true, data: tokenData };
  } catch (error) {
    await logOperation('exchange_token', 'error', {
      userId,
      error: { message: error.message, response: error.response?.data }
    });

    return { 
      success: false, 
      error: getErrorMessage(error, 'Erro ao obter tokens de acesso') 
    };
  }
};

/**
 * Atualiza token usando refresh_token
 */
export const refreshAccessToken = async (userId) => {
  try {
    // Busca refresh_token atual
    const { data: tokenData, error: fetchError } = await supabase
      .from('melhorenvio_tokens')
      .select('refresh_token')
      .eq('user_id', userId)
      .single();

    if (fetchError || !tokenData) {
      throw new Error('Token não encontrado');
    }

    const response = await axios.post(`${MELHORENVIO_AUTH_URL}/oauth/token`, {
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: tokenData.refresh_token
    });

    const { access_token, refresh_token, expires_in, token_type, scope } = response.data;

    const expiresAt = new Date(Date.now() + expires_in * 1000);

    // Atualiza tokens no banco
    const { data: updatedToken, error: updateError } = await supabase
      .from('melhorenvio_tokens')
      .update({
        access_token,
        refresh_token,
        token_type,
        expires_at: expiresAt.toISOString(),
        scope
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) throw updateError;

    await logOperation('refresh_token', 'success', {
      userId,
      message: 'Token renovado com sucesso'
    });

    return { success: true, data: updatedToken };
  } catch (error) {
    await logOperation('refresh_token', 'error', {
      userId,
      error: { message: error.message, response: error.response?.data }
    });

    return { 
      success: false, 
      error: getErrorMessage(error, 'Erro ao renovar token') 
    };
  }
};

/**
 * Obtém token válido (renova se necessário)
 */
export const getValidToken = async (userId) => {
  try {
    // FALLBACK: Se houver token fixo configurado, usa ele
    if (process.env.MELHORENVIO_ACCESS_TOKEN) {
      return { success: true, token: process.env.MELHORENVIO_ACCESS_TOKEN };
    }

    // Caso contrário, busca token OAuth2 do usuário
    const { data: tokenData, error } = await supabase
      .from('melhorenvio_tokens')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !tokenData) {
      return { success: false, error: 'Token não encontrado. Usuário precisa autorizar o aplicativo.' };
    }

    // Verifica se token está expirado (com margem de 5 minutos)
    const expiresAt = new Date(tokenData.expires_at);
    const now = new Date();
    const fiveMinutes = 5 * 60 * 1000;

    if (expiresAt.getTime() - now.getTime() < fiveMinutes) {
      // Token expirado ou prestes a expirar, renova
      const refreshResult = await refreshAccessToken(userId);
      if (!refreshResult.success) {
        return refreshResult;
      }
      return { success: true, token: refreshResult.data.access_token };
    }

    return { success: true, token: tokenData.access_token };
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Erro ao obter token válido') };
  }
};

/**
 * COTAÇÃO DE FRETES
 */

/**
 * Calcula cotação de frete
 */
export const calculateShipping = async (userId, shippingData) => {
  try {
    const tokenResult = await getValidToken(userId);
    if (!tokenResult.success) {
      return tokenResult;
    }

    const api = createApiClient(tokenResult.token);

    // Monta payload da cotação
    const payload = {
      from: {
        postal_code: shippingData.fromZipCode.replace(/\D/g, '')
      },
      to: {
        postal_code: shippingData.toZipCode.replace(/\D/g, '')
      },
      products: shippingData.products.map(product => ({
        id: product.id,
        width: product.width,
        height: product.height,
        length: product.length,
        weight: product.weight,
        insurance_value: product.insuranceValue || product.price,
        quantity: product.quantity || 1
      })),
      options: {
        receipt: shippingData.receipt || false,
        own_hand: shippingData.ownHand || false,
        collect: shippingData.collect || false
      }
    };

    const response = await api.post('/me/shipment/calculate', payload);

    // Filtra apenas cotações válidas (sem erro) e salva no banco
    const validQuotes = response.data.filter(quote => !quote.error);
    
    const quotes = validQuotes.map(quote => ({
      user_id: userId,
      order_id: shippingData.orderId || null,
      service_id: quote.id,
      service_name: quote.name,
      company_id: quote.company.id,
      company_name: quote.company.name,
      company_picture: quote.company.picture,
      price: parseFloat(quote.custom_price || quote.price || 0),
      custom_price: parseFloat(quote.custom_price || quote.price || 0),
      discount: parseFloat(quote.discount || 0),
      delivery_time: parseInt(quote.custom_delivery_time || quote.delivery_time || 0),
      custom_delivery_time: parseInt(quote.custom_delivery_time || quote.delivery_time || 0),
      delivery_range: quote.delivery_range || null,
      packages: quote.packages || payload.products || [],
      from_zip_code: shippingData.fromZipCode,
      to_zip_code: shippingData.toZipCode,
      additional_services: payload.options,
      insurance_value: shippingData.products.reduce((sum, p) => sum + (p.insuranceValue || p.price || 0), 0),
      quote_data: quote
    }));

    const { data: savedQuotes, error: saveError } = await supabase
      .from('shipping_quotes')
      .insert(quotes)
      .select();

    if (saveError) {
      logger.error({ err: saveError }, 'Erro ao salvar cotações');
    }

    await logOperation('calculate_shipping', 'success', {
      userId,
      orderId: shippingData.orderId,
      message: `${validQuotes.length} cotações válidas de ${response.data.length} calculadas`,
      request: payload,
      response: { total: response.data.length, valid: validQuotes.length }
    });

    return { 
      success: true, 
      data: validQuotes, // Retorna apenas cotações válidas
      savedQuotes: savedQuotes || []
    };
  } catch (error) {
    await logOperation('calculate_shipping', 'error', {
      userId,
      orderId: shippingData.orderId,
      error: { message: error.message, response: error.response?.data }
    });

    return { 
      success: false, 
      error: getErrorMessage(error, 'Erro ao calcular frete') 
    };
  }
};

/**
 * COMPRA DE ETIQUETAS
 */

/**
 * Adiciona etiqueta ao carrinho do MelhorEnvio
 */
export const createShippingLabel = async (userId, orderId, labelData) => {
  try {
    const tokenResult = await getValidToken(userId);
    if (!tokenResult.success) {
      return tokenResult;
    }

    const api = createApiClient(tokenResult.token);

    // Monta payload da etiqueta
    const payload = {
      service: labelData.serviceId,
      from: {
        name: labelData.from.name,
        phone: labelData.from.phone,
        email: labelData.from.email,
        document: labelData.from.document.replace(/\D/g, ''),
        company_document: labelData.from.companyDocument?.replace(/\D/g, ''),
        state_register: labelData.from.stateRegister,
        address: labelData.from.street,
        complement: labelData.from.complement || '',
        number: labelData.from.number,
        district: labelData.from.neighborhood,
        city: labelData.from.city,
        state_abbr: labelData.from.state,
        country_id: 'BR',
        postal_code: labelData.from.zipCode.replace(/\D/g, ''),
        note: labelData.from.note || ''
      },
      to: {
        name: labelData.to.name,
        phone: labelData.to.phone,
        email: labelData.to.email,
        document: labelData.to.document.replace(/\D/g, ''),
        address: labelData.to.street,
        complement: labelData.to.complement || '',
        number: labelData.to.number,
        district: labelData.to.neighborhood,
        city: labelData.to.city,
        state_abbr: labelData.to.state,
        country_id: 'BR',
        postal_code: labelData.to.zipCode.replace(/\D/g, ''),
        note: labelData.to.note || ''
      },
      products: labelData.products.map(product => ({
        name: product.name,
        quantity: product.quantity,
        unitary_value: product.unitaryValue,
        weight: product.weight
      })),
      volumes: labelData.volumes.map(volume => ({
        height: volume.height,
        width: volume.width,
        length: volume.length,
        weight: volume.weight
      })),
      options: {
        insurance_value: labelData.insuranceValue || 0,
        receipt: labelData.receipt || false,
        own_hand: labelData.ownHand || false,
        collect: labelData.collect || false,
        reverse: labelData.reverse || false,
        non_commercial: labelData.nonCommercial || false,
        invoice: labelData.invoice ? {
          key: labelData.invoice.key
        } : undefined,
        platform: labelData.platform || 'Feminisse',
        tags: labelData.tags || []
      }
    };

    const response = await api.post('/me/cart', payload);

    // Salva etiqueta no banco
    const labelRecord = {
      order_id: orderId,
      user_id: userId,
      quote_id: labelData.quoteId || null,
      melhorenvio_order_id: response.data.id,
      protocol: response.data.protocol,
      service_id: labelData.serviceId,
      service_name: labelData.serviceName,
      company_id: labelData.companyId,
      company_name: labelData.companyName,
      status: 'pending',
      price: response.data.price,
      discount: response.data.discount || 0,
      insurance_value: labelData.insuranceValue || 0,
      invoice_key: labelData.invoice?.key || null,
      api_response: response.data,
      tags: labelData.tags || []
    };

    const { data: savedLabel, error: saveError } = await supabase
      .from('shipping_labels')
      .insert([labelRecord])
      .select()
      .single();

    if (saveError) throw saveError;

    await logOperation('create_label', 'success', {
      userId,
      orderId,
      shippingLabelId: savedLabel.id,
      message: 'Etiqueta adicionada ao carrinho',
      request: payload,
      response: response.data
    });

    return { 
      success: true, 
      data: savedLabel
    };
  } catch (error) {
    await logOperation('create_label', 'error', {
      userId,
      orderId,
      error: { message: error.message, response: error.response?.data }
    });

    return { 
      success: false, 
      error: getErrorMessage(error, 'Erro ao criar etiqueta') 
    };
  }
};

/**
 * Gera etiqueta (após pagamento)
 */
export const generateLabel = async (userId, melhorenvioOrderId) => {
  try {
    const tokenResult = await getValidToken(userId);
    if (!tokenResult.success) {
      return tokenResult;
    }

    const api = createApiClient(tokenResult.token);

    const response = await api.post('/me/shipment/generate', {
      orders: [melhorenvioOrderId]
    });

    await logOperation('generate_label', 'success', {
      userId,
      message: 'Etiqueta gerada com sucesso',
      response: response.data
    });

    return { success: true, data: response.data };
  } catch (error) {
    await logOperation('generate_label', 'error', {
      userId,
      error: { message: error.message, response: error.response?.data }
    });

    return { 
      success: false, 
      error: getErrorMessage(error, 'Erro ao gerar etiqueta') 
    };
  }
};

/**
 * Imprime etiqueta (retorna URL do PDF)
 */
export const printLabel = async (userId, melhorenvioOrderId) => {
  try {
    const tokenResult = await getValidToken(userId);
    if (!tokenResult.success) {
      return tokenResult;
    }

    const api = createApiClient(tokenResult.token);

    const response = await api.post('/me/shipment/print', {
      orders: [melhorenvioOrderId]
    });

    return { success: true, url: response.data.url };
  } catch (error) {
    return { 
      success: false, 
      error: getErrorMessage(error, 'Erro ao imprimir etiqueta') 
    };
  }
};

/**
 * Cancela etiqueta
 */
export const cancelLabel = async (userId, melhorenvioOrderId, reason = '') => {
  try {
    const tokenResult = await getValidToken(userId);
    if (!tokenResult.success) {
      return tokenResult;
    }

    const api = createApiClient(tokenResult.token);

    const response = await api.post(`/me/shipment/cancel`, {
      order: {
        id: melhorenvioOrderId,
        reason: reason || 'Cancelado pelo usuário'
      }
    });

    await logOperation('cancel_label', 'success', {
      userId,
      message: 'Etiqueta cancelada',
      response: response.data
    });

    return { success: true, data: response.data };
  } catch (error) {
    await logOperation('cancel_label', 'error', {
      userId,
      error: { message: error.message, response: error.response?.data }
    });

    return { 
      success: false, 
      error: getErrorMessage(error, 'Erro ao cancelar etiqueta') 
    };
  }
};

/**
 * RASTREAMENTO
 */

/**
 * Busca informações de rastreamento
 */
export const trackShipment = async (userId, melhorenvioOrderId) => {
  try {
    const tokenResult = await getValidToken(userId);
    if (!tokenResult.success) {
      return tokenResult;
    }

    const api = createApiClient(tokenResult.token);

    const response = await api.get(`/me/orders/${melhorenvioOrderId}`);

    return { success: true, data: response.data };
  } catch (error) {
    return { 
      success: false, 
      error: getErrorMessage(error, 'Erro ao rastrear envio') 
    };
  }
};

/**
 * VALIDAÇÃO DE WEBHOOK
 */

/**
 * Valida assinatura do webhook
 */
export const validateWebhookSignature = (payload, signature) => {
  const crypto = require('crypto');
  
  const hmac = crypto.createHmac('sha256', CLIENT_SECRET);
  hmac.update(JSON.stringify(payload));
  const calculatedSignature = hmac.digest('base64');

  return calculatedSignature === signature;
};

export default {
  // Auth
  getAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  getValidToken,
  
  // Shipping
  calculateShipping,
  createShippingLabel,
  generateLabel,
  printLabel,
  cancelLabel,
  trackShipment,
  
  // Webhook
  validateWebhookSignature
};
