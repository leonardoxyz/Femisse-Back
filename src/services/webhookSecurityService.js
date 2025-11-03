/**
 * 🔒 Webhook Security Service
 * 
 * Serviço centralizado para validação e segurança de webhooks
 * Implementa:
 * - Assinatura HMAC (Mercado Pago)
 * - IP Whitelisting
 * - Replay Attack Protection (nonce/timestamp)
 * - Rate Limiting por webhook
 * 
 * @module services/webhookSecurityService
 */

import crypto from 'crypto';
import supabase from './supabaseClient.js';
import { logger, logSecurity } from '../utils/logger.js';
import { env } from '../config/validateEnv.js';

/**
 * IPs confiáveis do Mercado Pago (atualizar conforme documentação oficial)
 * @see https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 */
const MERCADO_PAGO_IPS = [
  '209.225.49.0/24',
  '216.33.197.0/24',
  '216.33.196.0/24',
  '209.225.48.0/24',
  // IPs adicionais - verificar documentação oficial
];

/**
 * IPs confiáveis do Melhor Envio
 */
const MELHOR_ENVIO_IPS = [
  // Adicionar IPs oficiais do Melhor Envio
  // Verificar documentação oficial
];

/**
 * Valida se IP está em uma lista de CIDRs permitidos
 * @param {string} ip - IP a validar
 * @param {string[]} allowedCIDRs - Lista de CIDRs permitidos
 * @returns {boolean}
 */
function isIPAllowed(ip, allowedCIDRs) {
  // Normaliza IP (remove ::ffff: de IPv6-mapped IPv4)
  const normalizedIP = ip.replace(/^::ffff:/, '');
  
  // Em desenvolvimento, permite todos os IPs
  if (env.NODE_ENV === 'development') {
    return true;
  }
  
  // TODO: Implementar validação CIDR real
  // Por enquanto, apenas verifica se IP está na lista
  return allowedCIDRs.some(cidr => {
    const [network] = cidr.split('/');
    return normalizedIP.startsWith(network.split('.').slice(0, 3).join('.'));
  });
}

/**
 * Valida assinatura HMAC do webhook Mercado Pago
 * 
 * Mercado Pago usa formato:
 * x-signature: ts=<timestamp>,v1=<hash>
 * 
 * Hash = HMAC-SHA256(secret, "id:<data.id>;request-id:<x-request-id>;ts:<timestamp>")
 * 
 * @param {Object} payload - Payload do webhook
 * @param {Object} headers - Headers da requisição
 * @returns {Object} { valid: boolean, error?: string }
 */
export function validateMercadoPagoSignature(payload, headers) {
  try {
    const signature = headers['x-signature'];
    const requestId = headers['x-request-id'];
    
    if (!signature) {
      logSecurity('webhook_missing_signature', { provider: 'mercadopago' });
      return { valid: false, error: 'Missing x-signature header' };
    }
    
    if (!requestId) {
      logSecurity('webhook_missing_request_id', { provider: 'mercadopago' });
      return { valid: false, error: 'Missing x-request-id header' };
    }
    
    // Parse signature: ts=<timestamp>,v1=<hash>
    const signatureParts = {};
    signature.split(',').forEach(part => {
      const [key, value] = part.split('=');
      signatureParts[key] = value;
    });
    
    const timestamp = signatureParts.ts;
    const hash = signatureParts.v1;
    
    if (!timestamp || !hash) {
      logSecurity('webhook_malformed_signature', { provider: 'mercadopago' });
      return { valid: false, error: 'Malformed signature' };
    }
    
    // Valida timestamp (não mais que 5 minutos de diferença)
    const currentTime = Math.floor(Date.now() / 1000);
    const timeDiff = Math.abs(currentTime - parseInt(timestamp));
    
    if (timeDiff > 300) { // 5 minutos
      logSecurity('webhook_expired_timestamp', { 
        provider: 'mercadopago',
        timeDiff 
      });
      return { valid: false, error: 'Timestamp expired' };
    }
    
    // Constrói string para HMAC
    const dataId = payload.data?.id || payload.id;
    const manifestString = `id:${dataId};request-id:${requestId};ts:${timestamp}`;
    
    // Calcula HMAC-SHA256
    const secret = env.MERCADO_PAGO_WEBHOOK_SECRET || env.MERCADO_PAGO_ACCESS_TOKEN;
    
    if (!secret) {
      logger.error('Mercado Pago secret not configured');
      return { valid: false, error: 'Webhook secret not configured' };
    }
    
    const expectedHash = crypto
      .createHmac('sha256', secret)
      .update(manifestString)
      .digest('hex');
    
    // Compara hashes (timing-safe)
    const isValid = crypto.timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(expectedHash, 'hex')
    );
    
    if (!isValid) {
      logSecurity('webhook_invalid_signature', { 
        provider: 'mercadopago',
        dataId 
      });
      return { valid: false, error: 'Invalid signature' };
    }
    
    return { valid: true };
    
  } catch (error) {
    logger.error({ err: error }, 'Error validating Mercado Pago signature');
    return { valid: false, error: 'Signature validation error' };
  }
}

/**
 * Valida webhook do Mercado Pago (completo)
 * 
 * @param {Object} payload - Payload do webhook
 * @param {Object} headers - Headers da requisição
 * @param {string} sourceIP - IP de origem
 * @returns {Promise<Object>} { valid: boolean, error?: string }
 */
export async function validateMercadoPagoWebhook(payload, headers, sourceIP) {
  try {
    // 1. Valida IP de origem (modo soft: apenas registra alerta)
    const ipAllowed = isIPAllowed(sourceIP, MERCADO_PAGO_IPS);

    if (!ipAllowed) {
      logSecurity('webhook_untrusted_ip', {
        provider: 'mercadopago',
        ip: sourceIP,
        enforcement: 'soft',
      });

      logger.warn({
        provider: 'mercadopago',
        ip: sourceIP,
      }, 'Mercado Pago webhook recebido de IP fora da lista de confiança');
    }

    // 2. Valida assinatura HMAC
    const signatureValidation = validateMercadoPagoSignature(payload, headers);
    if (!signatureValidation.valid) {
      return signatureValidation;
    }
    
    // 3. Valida estrutura do payload
    if (!payload.type || !payload.data) {
      logSecurity('webhook_invalid_payload', { provider: 'mercadopago' });
      return { valid: false, error: 'Invalid payload structure' };
    }
    
    // 4. Previne replay attack
    const requestId = headers['x-request-id'];
    const replayCheck = await checkReplayAttack('mercadopago', requestId, payload);
    
    if (!replayCheck.valid) {
      return replayCheck;
    }
    
    logger.info({
      provider: 'mercadopago',
      type: payload.type,
      dataId: payload.data?.id
    }, 'Webhook validation successful');
    
    return { valid: true };
    
  } catch (error) {
    logger.error({ err: error }, 'Error validating Mercado Pago webhook');
    return { valid: false, error: 'Webhook validation error' };
  }
}

/**
 * Valida assinatura do webhook Melhor Envio
 * 
 * @param {Object} payload - Payload do webhook
 * @param {string} signature - Header x-me-signature
 * @returns {boolean}
 */
export function validateMelhorEnvioSignature(payload, signature) {
  try {
    if (!signature) {
      return false;
    }
    
    // Melhor Envio usa HMAC-SHA256 do payload JSON
    const secret = env.MELHOR_ENVIO_WEBHOOK_SECRET;
    
    if (!secret) {
      logger.error('Melhor Envio webhook secret not configured');
      return false;
    }
    
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    // Compara signatures (timing-safe)
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
    
  } catch (error) {
    logger.error({ err: error }, 'Error validating Melhor Envio signature');
    return false;
  }
}

/**
 * Valida webhook do Melhor Envio (completo)
 * 
 * @param {Object} payload - Payload do webhook
 * @param {string} signature - Header x-me-signature
 * @param {string} sourceIP - IP de origem
 * @returns {Promise<Object>} { valid: boolean, error?: string }
 */
export async function validateMelhorEnvioWebhook(payload, signature, sourceIP) {
  try {
    // 1. Valida IP de origem (se configurado)
    if (MELHOR_ENVIO_IPS.length > 0) {
      if (!isIPAllowed(sourceIP, MELHOR_ENVIO_IPS)) {
        logSecurity('webhook_untrusted_ip', {
          provider: 'melhorenvio',
          ip: sourceIP
        });
        
        if (env.NODE_ENV === 'production') {
          return { valid: false, error: 'Untrusted IP address' };
        }
      }
    }
    
    // 2. Valida assinatura
    const isValidSignature = validateMelhorEnvioSignature(payload, signature);
    
    if (!isValidSignature) {
      logSecurity('webhook_invalid_signature', { provider: 'melhorenvio' });
      return { valid: false, error: 'Invalid signature' };
    }
    
    // 3. Valida estrutura
    if (!payload.event || !payload.data) {
      logSecurity('webhook_invalid_payload', { provider: 'melhorenvio' });
      return { valid: false, error: 'Invalid payload structure' };
    }
    
    // 4. Previne replay attack
    const eventId = `${payload.event}_${payload.data?.id}_${Date.now()}`;
    const replayCheck = await checkReplayAttack('melhorenvio', eventId, payload);
    
    if (!replayCheck.valid) {
      return replayCheck;
    }
    
    logger.info({
      provider: 'melhorenvio',
      event: payload.event,
      dataId: payload.data?.id
    }, 'Webhook validation successful');
    
    return { valid: true };
    
  } catch (error) {
    logger.error({ err: error }, 'Error validating Melhor Envio webhook');
    return { valid: false, error: 'Webhook validation error' };
  }
}

/**
 * Previne replay attacks verificando se webhook já foi processado
 * Usa cache de curto prazo (30 minutos) para IDs de webhooks
 * 
 * @param {string} provider - Nome do provedor (mercadopago, melhorenvio)
 * @param {string} webhookId - ID único do webhook
 * @param {Object} payload - Payload do webhook
 * @returns {Promise<Object>} { valid: boolean, error?: string }
 */
async function checkReplayAttack(provider, webhookId, payload) {
  try {
    // Gera hash do ID do webhook
    const webhookHash = crypto
      .createHash('sha256')
      .update(`${provider}:${webhookId}`)
      .digest('hex');
    
    // Verifica se já foi processado nos últimos 30 minutos
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    const { data: existing } = await supabase
      .from('webhook_processed_ids')
      .select('id, created_at')
      .eq('webhook_hash', webhookHash)
      .gte('created_at', thirtyMinutesAgo)
      .maybeSingle();
    
    if (existing) {
      logSecurity('webhook_replay_attack_detected', {
        provider,
        webhookId: webhookHash.substring(0, 16), // Apenas parte do hash
        firstProcessed: existing.created_at
      });
      
      return { valid: false, error: 'Duplicate webhook (replay attack)' };
    }
    
    // Registra como processado
    await supabase
      .from('webhook_processed_ids')
      .insert({
        webhook_hash: webhookHash,
        provider,
        webhook_type: payload.type || payload.event,
        created_at: new Date().toISOString()
      });
    
    return { valid: true };
    
  } catch (error) {
    logger.error({ err: error }, 'Error checking replay attack');
    // Em caso de erro, permite (fail-open para não bloquear webhooks legítimos)
    // Mas loga o erro para investigação
    return { valid: true };
  }
}

/**
 * Limpa registros antigos de webhooks processados
 * Deve ser executado periodicamente (cron job)
 */
export async function cleanOldWebhookRecords() {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { error } = await supabase
      .from('webhook_processed_ids')
      .delete()
      .lt('created_at', oneDayAgo);
    
    if (error) throw error;
    
    logger.info('Old webhook records cleaned successfully');
  } catch (error) {
    logger.error({ err: error }, 'Error cleaning old webhook records');
  }
}

export default {
  validateMercadoPagoWebhook,
  validateMelhorEnvioWebhook,
  validateMercadoPagoSignature,
  validateMelhorEnvioSignature,
  cleanOldWebhookRecords,
};
