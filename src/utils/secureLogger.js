/**
 * 🔒 Secure Logger Utility
 * 
 * Sistema de logging seguro que:
 * - Remove dados sensíveis automaticamente
 * - Formata logs estruturados
 * - Diferencia ambientes (dev/prod)
 * - Previne vazamento de informações
 * - Otimiza performance
 */

import pino from 'pino';
import dotenv from 'dotenv';

dotenv.config();

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

// Campos sensíveis que devem ser removidos dos logs
const SENSITIVE_FIELDS = [
  'password',
  'senha',
  'senha_hash',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'cookie',
  'cpf',
  'credit_card',
  'card_number',
  'cvv',
  'secret',
  'api_key',
  'private_key',
];

// Padrões regex para detectar dados sensíveis
const SENSITIVE_PATTERNS = [
  /\d{3}\.\d{3}\.\d{3}-\d{2}/, // CPF
  /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/, // Cartão de crédito
  /Bearer\s+[\w-]+\.[\w-]+\.[\w-]+/, // JWT
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // Email (parcial)
];

/**
 * Remove campos sensíveis de um objeto
 */
function sanitizeObject(obj, depth = 0) {
  if (depth > 5) return '[Max Depth]'; // Previne recursão infinita
  
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj !== 'object') {
    // Sanitiza strings
    if (typeof obj === 'string') {
      return sanitizeString(obj);
    }
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, depth + 1));
  }
  
  const sanitized = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    
    // Remove campos sensíveis
    if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field))) {
      sanitized[key] = '[REDACTED]';
      continue;
    }
    
    // Recursivamente sanitiza objetos aninhados
    if (value && typeof value === 'object') {
      sanitized[key] = sanitizeObject(value, depth + 1);
    } else if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Sanitiza strings removendo dados sensíveis
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  
  let sanitized = str;
  
  // Remove padrões sensíveis
  SENSITIVE_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  });
  
  // Limita tamanho (previne logs gigantes)
  if (sanitized.length > 1000) {
    sanitized = sanitized.substring(0, 1000) + '... [TRUNCATED]';
  }
  
  return sanitized;
}

/**
 * Configuração do Pino (logger de alta performance)
 */
const pinoConfig = {
  level: isDevelopment ? 'debug' : 'info',
  
  // Formatação para desenvolvimento
  transport: isDevelopment ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
      singleLine: false,
    }
  } : undefined,
  
  // Serializers personalizados
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      path: req.path,
      params: sanitizeObject(req.params),
      query: sanitizeObject(req.query),
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
    err: pino.stdSerializers.err,
  },
  
  // Remove dados sensíveis automaticamente
  redact: {
    paths: SENSITIVE_FIELDS,
    remove: true,
  },
};

// Cria logger base
const baseLogger = pino(pinoConfig);

/**
 * Classe de Logger Seguro
 */
class SecureLogger {
  constructor() {
    this.logger = baseLogger;
  }

  /**
   * Log de debug (apenas desenvolvimento)
   */
  debug(message, data = {}) {
    if (!isDevelopment) return;
    this.logger.debug(sanitizeObject({ message, ...data }));
  }

  /**
   * Log de informação
   */
  info(message, data = {}) {
    this.logger.info(sanitizeObject({ message, ...data }));
  }

  /**
   * Log de aviso
   */
  warn(message, data = {}) {
    this.logger.warn(sanitizeObject({ message, ...data }));
  }

  /**
   * Log de erro
   */
  error(message, error = null, data = {}) {
    const errorData = {
      message,
      ...data,
    };
    
    if (error) {
      errorData.error = {
        message: error.message,
        stack: isDevelopment ? error.stack : undefined,
        code: error.code,
        name: error.name,
      };
    }
    
    this.logger.error(sanitizeObject(errorData));
  }

  /**
   * Log de segurança (sempre registrado)
   */
  security(event, data = {}) {
    this.logger.warn(sanitizeObject({
      type: 'SECURITY_EVENT',
      event,
      timestamp: new Date().toISOString(),
      ...data,
    }));
  }

  /**
   * Log de performance
   */
  performance(operation, duration, data = {}) {
    const level = duration > 1000 ? 'warn' : 'info';
    
    this.logger[level](sanitizeObject({
      type: 'PERFORMANCE',
      operation,
      duration: `${duration}ms`,
      ...data,
    }));
  }

  /**
   * Log de auditoria (ações importantes)
   */
  audit(action, userId, data = {}) {
    this.logger.info(sanitizeObject({
      type: 'AUDIT',
      action,
      userId,
      timestamp: new Date().toISOString(),
      ...data,
    }));
  }

  /**
   * Log de requisição HTTP
   */
  http(req, res, duration) {
    const statusCode = res.statusCode;
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    
    this.logger[level]({
      type: 'HTTP',
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
  }

  /**
   * Cria um logger filho com contexto
   */
  child(bindings) {
    const childLogger = this.logger.child(sanitizeObject(bindings));
    return new SecureLogger();
  }
}

// Exporta instância singleton
export const secureLogger = new SecureLogger();

// Exporta também como default
export default secureLogger;

/**
 * Middleware de logging HTTP
 */
export function httpLoggingMiddleware(req, res, next) {
  const startTime = Date.now();
  
  // Intercepta o fim da resposta
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = Date.now() - startTime;
    secureLogger.http(req, res, duration);
    return originalEnd.apply(this, args);
  };
  
  next();
}

/**
 * Utilitário para medir performance de funções
 */
export async function measurePerformance(operation, fn) {
  const startTime = Date.now();
  
  try {
    const result = await fn();
    const duration = Date.now() - startTime;
    
    secureLogger.performance(operation, duration, { success: true });
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    secureLogger.performance(operation, duration, { 
      success: false,
      error: error.message 
    });
    
    throw error;
  }
}
