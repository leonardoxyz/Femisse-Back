import { verifyAccessToken } from '../utils/tokenManager.js';
import { logger, logSecurity } from '../utils/logger.js';
import { UnauthorizedError } from './errorHandler.js';

/**
 * Middleware de autenticação
 * Verifica access token em cookies ou header Authorization
 */
export function authenticateToken(req, res, next) {
  try {
    // Tenta ler token do cookie primeiro (mais seguro)
    let token = req.cookies?.accessToken;

    // DEBUG: Log para verificar cookies recebidos
    logger.debug('Auth Debug', {
      hasCookies: !!req.cookies,
      cookieKeys: req.cookies ? Object.keys(req.cookies) : [],
      hasAccessToken: !!token,
      origin: req.headers.origin,
      path: req.path
    });

    // Fallback: lê do header Authorization (para compatibilidade)
    if (!token) {
      const authHeader = req.headers['authorization'];
      token = authHeader && authHeader.split(' ')[1];
    }

    if (!token) {
      logSecurity('auth_no_token', { 
        ip: req.ip, 
        path: req.path,
        origin: req.headers.origin,
        cookies: req.cookies ? Object.keys(req.cookies) : []
      });
      return res.status(401).json({
        error: 'Não autorizado',
        message: 'Token de acesso requerido',
      });
    }

    // Verifica token
    const user = verifyAccessToken(token);

    // Valida campos obrigatórios
    if (!user.id || !user.email) {
      logSecurity('auth_invalid_payload', { ip: req.ip });
      return res.status(403).json({
        error: 'Não autorizado',
        message: 'Token inválido',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.warn({ err: error, ip: req.ip }, 'Falha na autenticação');

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expirado',
        message: 'Faça login novamente ou renove o token',
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({
        error: 'Token inválido',
        message: 'Token malformado ou inválido',
      });
    }

    return res.status(403).json({
      error: 'Não autorizado',
      message: 'Falha na verificação do token',
    });
  }
}

/**
 * Middleware opcional de autenticação
 * Não bloqueia se não houver token
 */
export function optionalAuth(req, res, next) {
  try {
    // Tenta ler token do cookie primeiro
    let token = req.cookies?.accessToken;

    // Fallback: lê do header Authorization
    if (!token) {
      const authHeader = req.headers['authorization'];
      token = authHeader && authHeader.split(' ')[1];
    }

    if (!token) {
      return next();
    }

    // Verifica token
    const user = verifyAccessToken(token);

    if (user && user.id) {
      req.user = user;
    }

    next();
  } catch (error) {
    // Em caso de erro, apenas continua sem autenticar
    logger.debug({ err: error }, 'Token opcional inválido');
    next();
  }
}

/**
 * Middleware para verificar se usuário é admin
 */
export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Não autorizado',
      message: 'Autenticação requerida',
    });
  }

  if (!req.user.isAdmin && !req.user.is_admin) {
    logSecurity('unauthorized_admin_access', {
      userId: req.user.id,
      ip: req.ip,
      path: req.path,
    });

    return res.status(403).json({
      error: 'Acesso negado',
      message: 'Permissões de administrador requeridas',
    });
  }

  next();
}

/**
 * Middleware para verificar se usuário está acessando seus próprios dados
 */
export function requireOwnership(paramName = 'id') {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Não autorizado',
        message: 'Autenticação requerida',
      });
    }

    const resourceId = req.params[paramName];

    if (req.user.id !== resourceId && !req.user.isAdmin) {
      logSecurity('unauthorized_resource_access', {
        userId: req.user.id,
        resourceId,
        ip: req.ip,
        path: req.path,
      });

      return res.status(403).json({
        error: 'Acesso negado',
        message: 'Você não tem permissão para acessar este recurso',
      });
    }

    next();
  };
}
