/**
 * ⚠️ Middleware de Validação
 * 
 * Rate limiting foi movido para: @see middleware/rateLimit.js
 * Sanitização foi movida para: @see utils/inputSanitizer.js
 * 
 * Este arquivo mantém apenas:
 * - Schemas de validação (considerar mover para validators/)
 * - Middleware validateRequest
 * - Middleware sanitizeInput (wrapper)
 * - Security headers
 */

import { z } from 'zod';
import helmet from 'helmet';
import { sanitizeString, detectSuspiciousPatterns } from '../validators/securitySchemas.js';
import { sanitizeObject as sanitizeObjUtil } from '../utils/inputSanitizer.js';
import { logger, logSecurity } from '../utils/logger.js';

// Re-export rate limiters do arquivo consolidado
export { 
  createRateLimit,
  authRateLimit, 
  generalRateLimit, 
  strictRateLimit 
} from './rateLimit.js';

// Schemas de validação para backend
const addressSchema = z.object({
  label: z.string()
    .min(1, 'Rótulo é obrigatório')
    .max(50, 'Rótulo deve ter no máximo 50 caracteres')
    .regex(/^[a-zA-ZÀ-ÿ0-9\s]+$/, 'Rótulo contém caracteres inválidos'),
  
  street: z.string()
    .min(1, 'Rua é obrigatória')
    .max(100, 'Rua deve ter no máximo 100 caracteres')
    .regex(/^[a-zA-ZÀ-ÿ0-9\s,.-]+$/, 'Rua contém caracteres inválidos'),
  
  number: z.string()
    .min(1, 'Número é obrigatório')
    .max(10, 'Número deve ter no máximo 10 caracteres')
    .regex(/^[a-zA-Z0-9\s-]+$/, 'Número contém caracteres inválidos'),
  
  complement: z.string()
    .max(50, 'Complemento deve ter no máximo 50 caracteres')
    .regex(/^[a-zA-ZÀ-ÿ0-9\s,.-]*$/, 'Complemento contém caracteres inválidos')
    .optional(),
  
  neighborhood: z.string()
    .min(1, 'Bairro é obrigatório')
    .max(50, 'Bairro deve ter no máximo 50 caracteres')
    .regex(/^[a-zA-ZÀ-ÿ0-9\s,.-]+$/, 'Bairro contém caracteres inválidos'),
  
  city: z.string()
    .min(1, 'Cidade é obrigatória')
    .max(50, 'Cidade deve ter no máximo 50 caracteres')
    .regex(/^[a-zA-ZÀ-ÿ\s]+$/, 'Cidade contém caracteres inválidos'),
  
  state: z.string()
    .length(2, 'Estado deve ter 2 caracteres')
    .regex(/^[A-Z]{2}$/, 'Estado deve conter apenas letras maiúsculas'),
  
  zip_code: z.string()
    .regex(/^\d{8}$/, 'CEP deve conter apenas 8 dígitos')
    .transform(val => val.replace(/\D/g, '')),
  
  is_default: z.boolean().default(false)
});

const userUpdateSchema = z.object({
  name: z.string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres')
    .regex(/^[a-zA-ZÀ-ÿ\s]+$/, 'Nome deve conter apenas letras e espaços')
    .optional(),
  
  phone: z.string()
    .regex(/^\d{10,11}$/, 'Telefone deve ter 10 ou 11 dígitos')
    .optional(),
  
  cpf: z.string()
    .regex(/^\d{11}$/, 'CPF deve ter 11 dígitos')
    .refine(cpf => {
      if (/^(\d)\1{10}$/.test(cpf)) return false;
      return true;
    }, 'CPF inválido')
    .optional(),
  
  birth_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve ter o formato YYYY-MM-DD')
    .refine(date => {
      const birthDate = new Date(date);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      return age >= 13 && age <= 120;
    }, 'Idade deve estar entre 13 e 120 anos')
    .optional()
});

const reviewSchema = z.object({
  rating: z.number()
    .min(1, 'Avaliação deve ser entre 1 e 5')
    .max(5, 'Avaliação deve ser entre 1 e 5')
    .int('Avaliação deve ser um número inteiro'),
  
  comment: z.string()
    .min(10, 'Comentário deve ter pelo menos 10 caracteres')
    .max(500, 'Comentário deve ter no máximo 500 caracteres')
    .regex(/^[a-zA-ZÀ-ÿ0-9\s.,!?()-]+$/, 'Comentário contém caracteres inválidos'),
  
  product_id: z.string().uuid('ID do produto inválido')
});

const searchQuerySchema = z.object({
  q: z.string()
    .max(100, 'Busca deve ter no máximo 100 caracteres')
    .regex(/^[a-zA-ZÀ-ÿ0-9\s]*$/, 'Busca contém caracteres inválidos')
    .optional(),
  
  category: z.string()
    .max(50, 'Categoria deve ter no máximo 50 caracteres')
    .regex(/^[a-zA-Z0-9-]*$/, 'Categoria contém caracteres inválidos')
    .optional(),
  
  min_price: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Preço inválido').optional(),
  max_price: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Preço inválido').optional(),
  
  page: z.string().regex(/^\d+$/, 'Página deve ser um número').optional(),
  limit: z.string().regex(/^\d+$/, 'Limite deve ser um número').optional()
});

const uuidSchema = z.object({
  id: z.string().uuid('ID inválido')
});

// Middleware de validação genérico
export const validateRequest = (schema, target = 'body') => {
  return (req, res, next) => {
    try {
      const data = target === 'body' ? req.body : 
                   target === 'params' ? req.params :
                   target === 'query' ? req.query : req.body;
      
      const result = schema.safeParse(data);
      
      if (!result.success) {
        const errors = result.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));
        
        logger.warn({
          method: req.method,
          url: req.originalUrl,
          errors
        }, 'Validation error');
        
        return res.status(400).json({
          error: 'Dados inválidos',
          details: errors
        });
      }
      
      // Adiciona dados validados ao request
      if (target === 'body') req.validatedBody = result.data;
      if (target === 'params') req.validatedParams = result.data;
      if (target === 'query') req.validatedQuery = result.data;
      
      next();
    } catch (error) {
      logger.error({ err: error }, 'Validation middleware error');
      res.status(500).json({ error: 'Erro interno de validação' });
    }
  };
};

// Middleware de sanitização (wrapper para inputSanitizer)
export const sanitizeInput = (req, res, next) => {
  try {
    req.body = sanitizeObjUtil(req.body);
    req.query = sanitizeObjUtil(req.query);
    req.params = sanitizeObjUtil(req.params);
    
    // Detecta padrões suspeitos
    const allInputs = JSON.stringify({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    
    if (detectSuspiciousPatterns(allInputs)) {
      logSecurity('suspicious_pattern_in_request', {
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
};

// Middleware de segurança adicional
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.mercadopago.com", "https://secure.mlstatic.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false
});

// Middleware de log de segurança
export const securityLogger = (req, res, next) => {
  const requestData = {
    body: req.body,
    query: req.query,
    params: req.params
  };
  
  const isSuspicious = detectSuspiciousPatterns(requestData);
  
  if (isSuspicious) {
    logSecurity('suspicious_request_detected', {
      ip: req.ip,
      method: req.method,
      url: req.originalUrl,
      userAgent: req.get('User-Agent'),
      referer: req.get('Referer'),
      timestamp: new Date().toISOString(),
    });
    
    // Em produção, você pode querer bloquear ou alertar sobre isso
    // res.status(400).json({ error: 'Requisição suspeita detectada' });
    // return;
  }
  
  next();
};

// Exports dos schemas para uso nos controllers
export const schemas = {
  address: addressSchema,
  userUpdate: userUpdateSchema,
  review: reviewSchema,
  searchQuery: searchQuerySchema,
  uuid: uuidSchema
};
