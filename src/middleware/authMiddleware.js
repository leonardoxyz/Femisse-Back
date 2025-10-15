import { verifyAccessToken, verifyRefreshToken, generateAccessToken, validateRefreshToken, setAuthCookies } from '../utils/tokenManager.js';
import { logger, logSecurity } from '../utils/logger.js';
import { UnauthorizedError } from './errorHandler.js';

/**
 * Middleware de autenticação com renovação automática
 * Verifica access token em cookies ou header Authorization
 * Se expirado, tenta renovar automaticamente com refresh token
 */
export async function authenticateToken(req, res, next) {
  try {
    // Tenta ler token do cookie primeiro (mais seguro)
    let token = req.cookies?.accessToken;

    // DEBUG: Log detalhado para verificar cookies recebidos
    console.log('🔐 Auth Debug:', {
      path: req.path,
      method: req.method,
      hasCookies: !!req.cookies,
      cookieKeys: req.cookies ? Object.keys(req.cookies) : [],
      hasAccessToken: !!token,
      origin: req.headers.origin,
      userAgent: req.headers['user-agent']?.substring(0, 50)
    });

    // Fallback: lê do header Authorization (para compatibilidade)
    if (!token) {
      const authHeader = req.headers['authorization'];
      token = authHeader && authHeader.split(' ')[1];
      if (token) {
        console.log('⚠️ Token encontrado no header Authorization (fallback)');
      }
    }

    if (!token) {
      console.log('❌ Nenhum token encontrado');
      logSecurity('auth_no_token', { 
        ip: req.ip, 
        path: req.path,
        origin: req.headers.origin,
        cookies: req.cookies ? Object.keys(req.cookies) : []
      });
      return res.status(401).json({
        error: 'Acesso não autorizado',
        message: 'Token de autenticação não fornecido'
      });
    }

    // Verifica token
    const user = verifyAccessToken(token);
    console.log('✅ Token verificado com sucesso:', { userId: user.id, email: user.email });

    // Valida campos obrigatórios
    if (!user.id || !user.email) {
      console.log('❌ Token inválido - campos obrigatórios ausentes');
      logSecurity('auth_invalid_payload', { ip: req.ip });
      return res.status(403).json({
        error: 'Não autorizado',
        message: 'Token inválido',
      });
    }

    req.user = user;
    console.log('✅ Usuário autenticado:', { userId: user.id, path: req.path });
    next();
  } catch (error) {
    logger.warn({ err: error, ip: req.ip }, 'Falha na autenticação');

    // ✅ Se token expirou, tenta renovar automaticamente com refresh token
    if (error.name === 'TokenExpiredError') {
      const refreshToken = req.cookies?.refreshToken;
      
      if (refreshToken) {
        try {
          // Verifica refresh token
          const refreshPayload = verifyRefreshToken(refreshToken);
          
          // Valida no banco
          const tokenData = await validateRefreshToken(refreshToken);
          
          if (tokenData && tokenData.user_id === refreshPayload.id) {
            // Gera novo access token
            const newAccessToken = generateAccessToken({
              id: refreshPayload.id,
              email: refreshPayload.email,
              nome: refreshPayload.nome
            });
            
            // Define novo cookie
            const isProduction = process.env.NODE_ENV === 'production';
            res.cookie('accessToken', newAccessToken, {
              httpOnly: true,
              secure: isProduction,
              sameSite: isProduction ? 'none' : 'lax',
              maxAge: 15 * 60 * 1000, // 15 minutos
              path: '/'
            });
            
            // Define usuário e continua
            req.user = {
              id: refreshPayload.id,
              email: refreshPayload.email,
              nome: refreshPayload.nome
            };
            
            logger.info('Token renovado automaticamente', { userId: refreshPayload.id });
            return next();
          }
        } catch (refreshError) {
          logger.warn('Falha ao renovar token automaticamente', { err: refreshError });
        }
      }
      
      return res.status(401).json({
        error: 'Token expirado',
        message: 'Faça login novamente',
        code: 'TOKEN_EXPIRED'
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
