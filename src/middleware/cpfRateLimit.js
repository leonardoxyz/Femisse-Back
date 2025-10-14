/**
 * 🔒 Rate Limiting Específico para Operações de CPF
 * 
 * Protege contra:
 * - Brute force de CPF
 * - Enumeração de CPFs
 * - Ataques automatizados
 * - Abuse de API
 */
import rateLimit from 'express-rate-limit';
import logger from '../utils/logger.js';

/**
 * Rate limiter para verificação de CPF (GET /api/users/profile)
 * Limite mais generoso para não atrapalhar UX
 */
const cpfVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 30, // 30 requisições por janela
  message: {
    error: 'Muitas tentativas de verificação',
    message: 'Você excedeu o limite de verificações. Tente novamente em 15 minutos.',
    retryAfter: '15 minutos'
  },
  standardHeaders: true, // Retorna info de rate limit nos headers
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Conta todas as requisições
  skipFailedRequests: false,
  
  // Key generator: IP + userId
  keyGenerator: (req) => {
    const userId = req.user?.id || 'anonymous';
    return `cpf_verification:${req.ip}:${userId}`;
  },
  
  // Handler quando limite é excedido
  handler: (req, res) => {
    logger.warn('Rate limit excedido: verificação de CPF', {
      ip: req.ip,
      userId: req.user?.id,
      userAgent: req.get('user-agent')
    });
    
    res.status(429).json({
      error: 'Muitas tentativas de verificação',
      message: 'Você excedeu o limite de verificações. Tente novamente em 15 minutos.',
      retryAfter: 900 // segundos
    });
  }
});

/**
 * Rate limiter para atualização de CPF (PUT /api/users/profile)
 * Limite mais restritivo para proteger contra abuso
 */
const cpfUpdateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5, // 5 atualizações por hora
  message: {
    error: 'Muitas tentativas de atualização',
    message: 'Você excedeu o limite de atualizações de CPF. Tente novamente em 1 hora.',
    retryAfter: '1 hora'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: true, // Não conta requisições com erro de validação
  
  // Key generator: IP + userId
  keyGenerator: (req) => {
    const userId = req.user?.id || 'anonymous';
    return `cpf_update:${req.ip}:${userId}`;
  },
  
  // Handler quando limite é excedido
  handler: (req, res) => {
    logger.warn('Rate limit excedido: atualização de CPF', {
      ip: req.ip,
      userId: req.user?.id,
      userAgent: req.get('user-agent')
    });
    
    res.status(429).json({
      error: 'Muitas tentativas de atualização',
      message: 'Você excedeu o limite de atualizações de CPF. Tente novamente em 1 hora.',
      retryAfter: 3600 // segundos
    });
  }
});

/**
 * Rate limiter geral para rotas de usuário
 * Proteção contra brute force geral
 */
const userRoutesLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requisições por janela
  message: {
    error: 'Muitas requisições',
    message: 'Você excedeu o limite de requisições. Tente novamente em alguns minutos.',
    retryAfter: '15 minutos'
  },
  standardHeaders: true,
  legacyHeaders: false,
  
  keyGenerator: (req) => {
    const userId = req.user?.id || 'anonymous';
    return `user_routes:${req.ip}:${userId}`;
  },
  
  handler: (req, res) => {
    logger.warn('Rate limit excedido: rotas de usuário', {
      ip: req.ip,
      userId: req.user?.id,
      path: req.path,
      userAgent: req.get('user-agent')
    });
    
    res.status(429).json({
      error: 'Muitas requisições',
      message: 'Você excedeu o limite de requisições. Tente novamente em alguns minutos.',
      retryAfter: 900
    });
  }
});

/**
 * Rate limiter para tentativas de CPF inválido
 * Proteção agressiva contra tentativas de burlar validação
 */
const invalidCPFLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // Apenas 3 tentativas com CPF inválido por hora
  message: {
    error: 'Muitas tentativas com CPF inválido',
    message: 'Você excedeu o limite de tentativas com CPF inválido. Verifique os dados e tente novamente em 1 hora.',
    retryAfter: '1 hora'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Só conta requisições com erro
  
  keyGenerator: (req) => {
    const userId = req.user?.id || 'anonymous';
    return `invalid_cpf:${req.ip}:${userId}`;
  },
  
  handler: (req, res) => {
    logger.error('Rate limit excedido: CPF inválido', {
      ip: req.ip,
      userId: req.user?.id,
      userAgent: req.get('user-agent'),
      suspectActivity: true
    });
    
    res.status(429).json({
      error: 'Muitas tentativas com CPF inválido',
      message: 'Por segurança, sua conta foi temporariamente bloqueada. Tente novamente em 1 hora ou entre em contato com o suporte.',
      retryAfter: 3600,
      support: 'contato@femisse.com.br'
    });
  }
});

export {
  cpfVerificationLimiter,
  cpfUpdateLimiter,
  userRoutesLimiter,
  invalidCPFLimiter
};
