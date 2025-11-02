/**
 * 🔒 CSRF Protection Middleware
 * 
 * Proteção contra Cross-Site Request Forgery
 * Implementa Double Submit Cookie pattern com exceções para webhooks
 * 
 * @module middleware/csrfMiddleware
 */

import csurf from 'csurf';
import { logger, logSecurity } from '../utils/logger.js';
import { env } from '../config/validateEnv.js';

const isProduction = env.NODE_ENV === 'production';

/**
 * Rotas que devem ser EXCLUÍDAS da proteção CSRF
 * 
 * Webhooks externos não podem incluir token CSRF,
 * então validamos por assinatura/IP em vez disso
 */
const CSRF_EXCLUDED_PATHS = [
  // Webhooks externos
  /^\/api\/payments\/webhook$/,
  /^\/api\/webhooks\/melhorenvio$/,
  /^\/api\/webhooks\/.+$/,
  
  // Health checks
  /^\/api\/health$/,
  /^\/_health$/,
  
  // Endpoints públicos que não modificam estado
  /^\/api\/products\?.*$/, // GET apenas
  /^\/api\/categories$/, // GET apenas
];

/**
 * Métodos HTTP que NÃO precisam de CSRF protection
 * (GET, HEAD, OPTIONS são safe methods)
 */
const CSRF_SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

/**
 * Verifica se a rota deve ser excluída da proteção CSRF
 * 
 * @param {Object} req - Request object
 * @returns {boolean} true se deve ser excluída
 */
function shouldSkipCSRF(req) {
  // Métodos seguros não precisam de CSRF
  if (CSRF_SAFE_METHODS.includes(req.method)) {
    return true;
  }
  
  // Verifica se está na lista de exclusões
  const path = req.path || req.url;
  const isExcluded = CSRF_EXCLUDED_PATHS.some(pattern => pattern.test(path));
  
  if (isExcluded) {
    logger.debug({
      path,
      method: req.method,
    }, 'CSRF protection skipped for excluded path');
  }
  
  return isExcluded;
}

/**
 * Middleware CSRF com configuração customizada
 */
const csrfProtection = csurf({
  cookie: {
    httpOnly: true,
    secure: isProduction, // HTTPS apenas em produção
    sameSite: isProduction ? 'strict' : 'lax',
    path: '/',
    maxAge: 60 * 60 * 1000, // 1 hora
  },
  ignoreMethods: CSRF_SAFE_METHODS,
  value: (req) => {
    // Aceita token de múltiplas fontes (em ordem de prioridade):
    // 1. Header X-CSRF-Token
    // 2. Body _csrf
    // 3. Query _csrf
    return (
      req.headers['x-csrf-token'] ||
      req.headers['x-xsrf-token'] ||
      req.body?._csrf ||
      req.query?._csrf
    );
  },
});

/**
 * Middleware wrapper que aplica CSRF com exceções
 */
export function csrfMiddleware(req, res, next) {
  // Pula CSRF se deve ser excluído
  if (shouldSkipCSRF(req)) {
    return next();
  }
  
  // Aplica proteção CSRF
  csrfProtection(req, res, (err) => {
    if (err) {
      // Loga tentativa de CSRF
      logSecurity('csrf_token_invalid', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        userAgent: req.get('User-Agent'),
        referer: req.get('Referer'),
      });
      
      logger.warn({
        err,
        ip: req.ip,
        path: req.path,
        method: req.method,
      }, 'CSRF token validation failed');
      
      // Retorna erro específico
      return res.status(403).json({
        error: 'Token CSRF inválido ou ausente',
        message: 'Por favor, recarregue a página e tente novamente',
        code: 'INVALID_CSRF_TOKEN',
      });
    }
    
    next();
  });
}

/**
 * Endpoint para obter token CSRF
 * Útil para SPAs que precisam do token antes de fazer requisições
 * 
 * GET /api/csrf-token
 */
export function getCsrfToken(req, res) {
  res.json({
    csrfToken: req.csrfToken(),
    expiresIn: 3600, // 1 hora em segundos
  });
}

/**
 * Middleware para adicionar token CSRF ao response
 * Útil para aplicações server-side rendered
 */
export function attachCsrfToken(req, res, next) {
  try {
    if (!shouldSkipCSRF(req)) {
      res.locals.csrfToken = req.csrfToken();
    }
  } catch (err) {
    logger.error({ err }, 'Error attaching CSRF token');
  }
  
  next();
}

/**
 * Handler de erro CSRF global
 * Deve ser usado no error handler principal
 */
export function csrfErrorHandler(err, req, res, next) {
  if (err.code === 'EBADCSRFTOKEN') {
    logSecurity('csrf_attack_attempt', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userAgent: req.get('User-Agent'),
    });
    
    return res.status(403).json({
      error: 'Token CSRF inválido',
      message: 'Por favor, recarregue a página e tente novamente',
      code: 'INVALID_CSRF_TOKEN',
    });
  }
  
  next(err);
}

export default {
  csrfMiddleware,
  getCsrfToken,
  attachCsrfToken,
  csrfErrorHandler,
};
