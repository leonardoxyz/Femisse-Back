/**
 * 🔒 Secure HTTP Client
 * 
 * Wrapper seguro para axios com:
 * - Timeout automático
 * - Retry logic
 * - Circuit breaker pattern
 * - Request/Response logging
 * - Error sanitization
 * 
 * @module utils/httpClient
 */

import axios from 'axios';
import { logger } from './logger.js';
import { TIMEOUT_CONFIGS } from './fetchWithTimeout.js';
import { env } from '../config/validateEnv.js';

const isProduction = env.NODE_ENV === 'production';

/**
 * Circuit Breaker State
 * Previne chamadas repetidas a serviços que estão falhando
 */
class CircuitBreaker {
  constructor(threshold = 5, timeout = 60000) {
    this.failureCount = 0;
    this.threshold = threshold; // Falhas antes de abrir o circuito
    this.timeout = timeout; // Tempo para tentar novamente
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.nextAttempt = Date.now();
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failureCount++;
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
      logger.warn({
        state: this.state,
        nextAttempt: new Date(this.nextAttempt).toISOString(),
      }, 'Circuit breaker opened');
    }
  }
}

/**
 * Circuit breakers por serviço
 */
const circuitBreakers = {
  mercadopago: new CircuitBreaker(5, 60000), // 5 falhas, 1 min timeout
  melhorenvio: new CircuitBreaker(5, 60000),
  default: new CircuitBreaker(3, 30000), // 3 falhas, 30s timeout
};

/**
 * Cria instância configurada do axios
 * 
 * @param {Object} config - Configuração customizada
 * @returns {AxiosInstance}
 */
export function createHttpClient(config = {}) {
  const {
    timeout = TIMEOUT_CONFIGS.EXTERNAL,
    baseURL = null,
    headers = {},
    retries = 2,
    retryDelay = 1000,
    service = 'default',
  } = config;

  const instance = axios.create({
    baseURL,
    timeout,
    headers: {
      'User-Agent': 'Femisse-API/2.0',
      ...headers,
    },
  });

  // Request interceptor - logging
  instance.interceptors.request.use(
    (config) => {
      const startTime = Date.now();
      config.metadata = { startTime };
      
      logger.debug({
        method: config.method?.toUpperCase(),
        url: config.url,
        baseURL: config.baseURL,
      }, 'HTTP Request started');
      
      return config;
    },
    (error) => {
      logger.error({ err: error }, 'HTTP Request error');
      return Promise.reject(error);
    }
  );

  // Response interceptor - logging e retry
  instance.interceptors.response.use(
    (response) => {
      const duration = Date.now() - response.config.metadata.startTime;
      
      logger.debug({
        method: response.config.method?.toUpperCase(),
        url: response.config.url,
        status: response.status,
        duration: `${duration}ms`,
      }, 'HTTP Response received');
      
      return response;
    },
    async (error) => {
      const config = error.config;
      
      if (!config || !config.metadata) {
        return Promise.reject(error);
      }

      const duration = Date.now() - config.metadata.startTime;
      
      // Log do erro
      logger.warn({
        method: config.method?.toUpperCase(),
        url: config.url,
        status: error.response?.status,
        duration: `${duration}ms`,
        error: error.message,
      }, 'HTTP Request failed');

      // Retry logic (apenas para erros de rede/timeout)
      const shouldRetry = 
        !error.response && // Erro de rede
        config.metadata.retryCount < retries &&
        !['POST', 'PUT', 'PATCH', 'DELETE'].includes(config.method?.toUpperCase()); // Só retry em GET

      if (shouldRetry) {
        config.metadata.retryCount = (config.metadata.retryCount || 0) + 1;
        
        logger.info({
          url: config.url,
          attempt: config.metadata.retryCount,
          maxRetries: retries,
        }, 'Retrying HTTP request');

        await new Promise(resolve => setTimeout(resolve, retryDelay));
        
        return instance(config);
      }

      return Promise.reject(error);
    }
  );

  return instance;
}

/**
 * Cliente HTTP para Mercado Pago
 */
export const mercadoPagoClient = createHttpClient({
  timeout: TIMEOUT_CONFIGS.PAYMENT,
  baseURL: 'https://api.mercadopago.com',
  headers: {
    'Authorization': `Bearer ${env.MERCADO_PAGO_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  },
  service: 'mercadopago',
  retries: 2,
});

/**
 * Cliente HTTP para Melhor Envio
 */
export const melhorEnvioClient = createHttpClient({
  timeout: TIMEOUT_CONFIGS.SHIPPING,
  baseURL: env.MELHOR_ENVIO_API_URL || 'https://melhorenvio.com.br/api/v2',
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${env.MELHOR_ENVIO_TOKEN}`,
  },
  service: 'melhorenvio',
  retries: 2,
});

/**
 * Wrapper com circuit breaker
 * 
 * @param {Function} fn - Função que retorna Promise
 * @param {string} service - Nome do serviço
 * @returns {Promise}
 */
export async function withCircuitBreaker(fn, service = 'default') {
  const breaker = circuitBreakers[service] || circuitBreakers.default;
  return breaker.execute(fn);
}

/**
 * Helper para fazer requisição GET segura
 * 
 * @param {string} url - URL completa
 * @param {Object} config - Configuração axios
 * @returns {Promise}
 */
export async function safeGet(url, config = {}) {
  const client = createHttpClient(config);
  
  try {
    const response = await client.get(url);
    return response.data;
  } catch (error) {
    logger.error({
      url,
      error: error.message,
      status: error.response?.status,
    }, 'Safe GET failed');
    
    throw error;
  }
}

/**
 * Helper para fazer requisição POST segura
 * 
 * @param {string} url - URL completa
 * @param {Object} data - Dados a enviar
 * @param {Object} config - Configuração axios
 * @returns {Promise}
 */
export async function safePost(url, data, config = {}) {
  const client = createHttpClient(config);
  
  try {
    const response = await client.post(url, data);
    return response.data;
  } catch (error) {
    logger.error({
      url,
      error: error.message,
      status: error.response?.status,
    }, 'Safe POST failed');
    
    throw error;
  }
}

/**
 * Timeout padrões por serviço
 */
export { TIMEOUT_CONFIGS };

export default {
  createHttpClient,
  mercadoPagoClient,
  melhorEnvioClient,
  withCircuitBreaker,
  safeGet,
  safePost,
  TIMEOUT_CONFIGS,
};
