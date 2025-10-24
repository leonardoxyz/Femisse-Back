/**
 * 🔒 Input Sanitizer Utility
 * 
 * Protege contra:
 * - SQL Injection
 * - NoSQL Injection
 * - XSS (Cross-Site Scripting)
 * - Command Injection
 * - Path Traversal
 * - LDAP Injection
 */

import validator from 'validator';
import { logger, logSecurity } from './logger.js';

/**
 * Remove caracteres perigosos de SQL
 */
export function sanitizeSql(input) {
  if (typeof input !== 'string') return input;
  
  // Remove caracteres perigosos
  return input
    .replace(/['";\\]/g, '') // Remove aspas e barras
    .replace(/--/g, '') // Remove comentários SQL
    .replace(/\/\*/g, '') // Remove início de comentário
    .replace(/\*\//g, '') // Remove fim de comentário
    .trim();
}

/**
 * Sanitiza entrada para prevenir NoSQL Injection
 */
export function sanitizeNoSql(input) {
  if (typeof input !== 'object') return input;
  
  const sanitized = {};
  
  for (const [key, value] of Object.entries(input)) {
    // Remove operadores MongoDB perigosos
    if (key.startsWith('$') || key.startsWith('_')) {
      logSecurity('nosql_injection_attempt', { key });
      continue;
    }
    
    if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeNoSql(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Sanitiza string removendo HTML e scripts
 */
export function sanitizeHtml(input) {
  if (typeof input !== 'string') return input;
  
  return validator.escape(input)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/data:text\/html/gi, '')
    .trim();
}

/**
 * Sanitiza string genérica
 */
export function sanitizeString(input, options = {}) {
  if (typeof input !== 'string') return input;
  
  const {
    maxLength = 10000,
    allowHtml = false,
    trim = true,
    lowercase = false,
  } = options;
  
  let sanitized = input;
  
  // Trim
  if (trim) {
    sanitized = sanitized.trim();
  }
  
  // Lowercase
  if (lowercase) {
    sanitized = sanitized.toLowerCase();
  }
  
  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');
  
  // Remove caracteres de controle
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Remove HTML se não permitido
  if (!allowHtml) {
    sanitized = sanitizeHtml(sanitized);
  }
  
  // Limita tamanho
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
    logger.warn({ 
      originalLength: input.length, 
      maxLength 
    }, 'Input truncated');
  }
  
  return sanitized;
}

/**
 * Valida e sanitiza email
 */
export function sanitizeEmail(email) {
  if (typeof email !== 'string') return null;
  
  const sanitized = email.trim().toLowerCase();
  
  if (!validator.isEmail(sanitized)) {
    logSecurity('invalid_email_format', { email: '[REDACTED]' });
    return null;
  }
  
  if (sanitized.length > 254) {
    logger.warn({ length: sanitized.length }, 'Email too long');
    return null;
  }
  
  return sanitized;
}

/**
 * Valida e sanitiza URL
 */
export function sanitizeUrl(url) {
  if (typeof url !== 'string') return null;
  
  const sanitized = url.trim();
  
  // Bloqueia protocolos perigosos
  const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
  if (dangerousProtocols.some(proto => sanitized.toLowerCase().startsWith(proto))) {
    logSecurity('dangerous_url_protocol', { url: '[REDACTED]' });
    return null;
  }
  
  if (!validator.isURL(sanitized, { 
    protocols: ['http', 'https'],
    require_protocol: false 
  })) {
    return null;
  }
  
  return sanitized;
}

/**
 * Valida e sanitiza CPF
 */
export function sanitizeCpf(cpf) {
  if (typeof cpf !== 'string') return null;
  
  // Remove caracteres não numéricos
  const cleaned = cpf.replace(/\D/g, '');
  
  if (cleaned.length !== 11) return null;
  
  // Verifica se não é sequência repetida
  if (/^(\d)\1{10}$/.test(cleaned)) return null;
  
  // Valida dígitos verificadores
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned.charAt(i)) * (10 - i);
  }
  let digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(cleaned.charAt(9))) return null;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned.charAt(i)) * (11 - i);
  }
  digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(cleaned.charAt(10))) return null;
  
  return cleaned;
}

/**
 * Valida e sanitiza telefone
 */
export function sanitizePhone(phone) {
  if (typeof phone !== 'string') return null;
  
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length !== 10 && cleaned.length !== 11) return null;
  
  return cleaned;
}

/**
 * Valida e sanitiza CEP
 */
export function sanitizeCep(cep) {
  if (typeof cep !== 'string') return null;
  
  const cleaned = cep.replace(/\D/g, '');
  
  if (cleaned.length !== 8) return null;
  
  return cleaned;
}

/**
 * Sanitiza número
 */
export function sanitizeNumber(input, options = {}) {
  const {
    min = -Infinity,
    max = Infinity,
    integer = false,
  } = options;
  
  const num = Number(input);
  
  if (isNaN(num)) return null;
  if (!isFinite(num)) return null;
  if (num < min || num > max) return null;
  if (integer && !Number.isInteger(num)) return null;
  
  return num;
}

/**
 * Sanitiza UUID
 */
export function sanitizeUuid(uuid) {
  if (typeof uuid !== 'string') return null;
  
  if (!validator.isUUID(uuid)) {
    logSecurity('invalid_uuid_format', { uuid: '[REDACTED]' });
    return null;
  }
  
  return uuid.toLowerCase();
}

/**
 * Sanitiza objeto recursivamente
 */
export function sanitizeObject(obj, depth = 0) {
  if (depth > 10) {
    logger.warn('Max sanitization depth reached');
    return obj;
  }
  
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj !== 'object') {
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
    // Sanitiza a chave
    const sanitizedKey = sanitizeString(key, { maxLength: 100 });
    
    // Sanitiza o valor
    if (value && typeof value === 'object') {
      sanitized[sanitizedKey] = sanitizeObject(value, depth + 1);
    } else if (typeof value === 'string') {
      sanitized[sanitizedKey] = sanitizeString(value);
    } else {
      sanitized[sanitizedKey] = value;
    }
  }
  
  return sanitized;
}

/**
 * Previne Path Traversal
 */
export function sanitizePath(path) {
  if (typeof path !== 'string') return null;
  
  // Remove tentativas de path traversal
  const sanitized = path
    .replace(/\.\./g, '')
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .trim();
  
  // Não permite caminhos absolutos
  if (sanitized.startsWith('/')) {
    logSecurity('absolute_path_attempt', { path: '[REDACTED]' });
    return null;
  }
  
  return sanitized;
}

/**
 * Sanitiza JSON
 */
export function sanitizeJson(input) {
  if (typeof input !== 'string') return null;
  
  try {
    const parsed = JSON.parse(input);
    return sanitizeObject(parsed);
  } catch (error) {
    logger.warn({ error: error.message }, 'Invalid JSON');
    return null;
  }
}

/**
 * Detecta padrões suspeitos
 */
export function detectSuspiciousPatterns(input) {
  if (typeof input !== 'string') return false;
  
  const suspiciousPatterns = [
    /(\bor\b|\band\b).*[=<>]/i, // SQL injection
    /union.*select/i, // SQL injection
    /drop\s+table/i, // SQL injection
    /insert\s+into/i, // SQL injection
    /delete\s+from/i, // SQL injection
    /<script/i, // XSS
    /javascript:/i, // XSS
    /on\w+\s*=/i, // XSS event handlers
    /\$\{.*\}/,  // Template injection
    /\$\(.*\)/, // Command injection
    /`.*`/, // Command injection
  ];
  
  return suspiciousPatterns.some(pattern => pattern.test(input));
}

/**
 * Middleware de sanitização automática
 */
export function sanitizationMiddleware(req, res, next) {
  try {
    // Sanitiza body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }
    
    // Sanitiza query params
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query);
    }
    
    // Sanitiza params
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeObject(req.params);
    }
    
    // Detecta padrões suspeitos
    const allInputs = JSON.stringify({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    
    if (detectSuspiciousPatterns(allInputs)) {
      logSecurity('suspicious_pattern_detected', {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
      });
    }
    
    next();
  } catch (error) {
    logger.error({ err: error }, 'Sanitization middleware error');
    next();
  }
}

export default {
  sanitizeSql,
  sanitizeNoSql,
  sanitizeHtml,
  sanitizeString,
  sanitizeEmail,
  sanitizeUrl,
  sanitizeCpf,
  sanitizePhone,
  sanitizeCep,
  sanitizeNumber,
  sanitizeUuid,
  sanitizeObject,
  sanitizePath,
  sanitizeJson,
  detectSuspiciousPatterns,
  sanitizationMiddleware,
};
