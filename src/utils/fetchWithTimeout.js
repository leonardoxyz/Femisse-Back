/**
 * Utilitário para fazer fetch com timeout
 * Evita que requisições a APIs externas travem o servidor
 */

import { logger } from './logger.js';

/**
 * Faz uma requisição HTTP com timeout
 * @param {string} url - URL para fazer a requisição
 * @param {object} options - Opções do fetch (method, headers, body, etc)
 * @param {number} timeout - Timeout em milissegundos (padrão: 10000ms = 10s)
 * @returns {Promise<Response>} Response da requisição
 * @throws {Error} Se timeout ou erro de rede
 */
export async function fetchWithTimeout(url, options = {}, timeout = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    
    if (error.name === 'AbortError') {
      logger.error({ url, timeout }, 'Request timeout');
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    
    logger.error({ url, error: error.message }, 'Fetch error');
    throw error;
  }
}

/**
 * Faz uma requisição HTTP com timeout e retries
 * @param {string} url - URL para fazer a requisição
 * @param {object} options - Opções do fetch
 * @param {number} timeout - Timeout em milissegundos (padrão: 10000ms)
 * @param {number} retries - Número de tentativas (padrão: 3)
 * @param {number} retryDelay - Delay entre tentativas em ms (padrão: 1000ms)
 * @returns {Promise<Response>} Response da requisição
 */
export async function fetchWithRetry(url, options = {}, timeout = 10000, retries = 3, retryDelay = 1000) {
  let lastError;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fetchWithTimeout(url, options, timeout);
    } catch (error) {
      lastError = error;
      
      if (attempt < retries - 1) {
        logger.warn({ url, attempt: attempt + 1, retries, error: error.message }, 'Retrying request');
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
  
  logger.error({ url, retries, error: lastError.message }, 'All retries failed');
  throw lastError;
}

/**
 * Configurações padrão de timeout por tipo de API
 */
export const TIMEOUT_CONFIGS = {
  // APIs de pagamento são críticas mas podem demorar
  PAYMENT: 15000,        // 15s
  
  // APIs de envio geralmente são rápidas
  SHIPPING: 10000,       // 10s
  
  // APIs internas devem ser muito rápidas
  INTERNAL: 5000,        // 5s
  
  // APIs de terceiros genéricas
  EXTERNAL: 12000,       // 12s
  
  // Webhooks podem demorar
  WEBHOOK: 8000,         // 8s
};

export default {
  fetchWithTimeout,
  fetchWithRetry,
  TIMEOUT_CONFIGS,
};
