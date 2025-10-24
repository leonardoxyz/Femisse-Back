/**
 * 🛡️ Rate Limiting Middleware
 * 
 * Sistema consolidado de rate limiting para todas as rotas da API.
 * Usa express-rate-limit para simplicidade e eficácia.
 * 
 * Configurações disponíveis:
 * - authRateLimit: Login/autenticação (5 req/15min)
 * - generalRateLimit: Rotas gerais (100 req/15min)
 * - strictRateLimit: Rotas sensíveis (20 req/15min)
 * - apiRateLimit: APIs públicas (60 req/min)
 * - cpfVerificationLimiter: Verificação de CPF (30 req/15min)
 * - cpfUpdateLimiter: Atualização de CPF (5 req/hora)
 * - userRoutesLimiter: Rotas de usuário (100 req/15min)
 */

import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger.js';

/**
 * Factory function para criar rate limiters customizados
 */
export const createRateLimit = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutos
    max = 100,
    message = 'Muitas requisições',
    keyGenerator = (req) => req.ip,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
  } = options;

  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    skipSuccessfulRequests,
    skipFailedRequests,
    handler: (req, res) => {
      logger.warn({
        ip: req.ip,
        url: req.originalUrl,
        method: req.method,
        limit: max,
        window: `${windowMs / 1000}s`,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString(),
      }, 'Rate limit exceeded');

      res.status(429).json({
        error: message,
        retryAfter: Math.ceil(windowMs / 1000),
      });
    },
  });
};

// ========================================
// RATE LIMITERS GERAIS
// ========================================

/**
 * Rate limiter para autenticação (login, registro)
 * Limite restritivo para prevenir brute force
 */
export const authRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5,
  message: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
});

/**
 * Rate limiter geral para a maioria das rotas
 */
export const generalRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100,
  message: 'Muitas requisições. Tente novamente em alguns minutos.',
});

/**
 * Rate limiter restritivo para rotas sensíveis
 */
export const strictRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20,
  message: 'Limite de requisições excedido.',
});

/**
 * Rate limiter para APIs públicas
 */
export const apiRateLimit = createRateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 60,
  message: 'Limite de requisições por minuto excedido.',
});

// ========================================
// RATE LIMITERS ESPECÍFICOS PARA CPF
// ========================================

/**
 * Rate limiter para verificação de CPF (GET /api/users/profile)
 * Limite mais generoso para não atrapalhar UX
 */
export const cpfVerificationLimiter = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 30,
  message: 'Muitas tentativas de verificação. Tente novamente em 15 minutos.',
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  keyGenerator: (req) => {
    const userId = req.user?.id || 'anonymous';
    return `cpf_verification:${req.ip}:${userId}`;
  },
});

/**
 * Rate limiter para atualização de CPF (PUT /api/users/profile)
 * Limite mais restritivo para proteger contra abuso
 */
export const cpfUpdateLimiter = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5,
  message: 'Muitas tentativas de atualização de CPF. Tente novamente em 1 hora.',
  skipSuccessfulRequests: false,
  skipFailedRequests: true, // Não conta requisições com erro de validação
  keyGenerator: (req) => {
    const userId = req.user?.id || 'anonymous';
    return `cpf_update:${req.ip}:${userId}`;
  },
});

/**
 * Rate limiter para tentativas de CPF inválido
 * Proteção agressiva contra tentativas de burlar validação
 */
export const invalidCPFLimiter = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3,
  message: 'Muitas tentativas com CPF inválido. Verifique os dados e tente novamente em 1 hora.',
  skipSuccessfulRequests: true, // Só conta requisições com erro
  keyGenerator: (req) => {
    const userId = req.user?.id || 'anonymous';
    return `invalid_cpf:${req.ip}:${userId}`;
  },
});

// ========================================
// RATE LIMITERS PARA ROTAS DE USUÁRIO
// ========================================

/**
 * Rate limiter geral para rotas de usuário
 * Proteção contra brute force geral
 */
export const userRoutesLimiter = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100,
  message: 'Muitas requisições. Tente novamente em alguns minutos.',
  keyGenerator: (req) => {
    const userId = req.user?.id || 'anonymous';
    return `user_routes:${req.ip}:${userId}`;
  },
});

// ========================================
// EXPORTS
// ========================================

export default {
  createRateLimit,
  authRateLimit,
  generalRateLimit,
  strictRateLimit,
  apiRateLimit,
  cpfVerificationLimiter,
  cpfUpdateLimiter,
  invalidCPFLimiter,
  userRoutesLimiter,
};
