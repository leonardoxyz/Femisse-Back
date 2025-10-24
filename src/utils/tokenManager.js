import jwt from 'jsonwebtoken';
import supabase from '../services/supabaseClient.js';
import { env } from '../config/validateEnv.js';
import { logger } from './logger.js';

/**
 * Gera access token (curta duração)
 */
export function generateAccessToken(payload) {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: '15m', // 15 minutos
    issuer: 'feminisse-api',
    audience: 'feminisse-app',
  });
}

/**
 * Gera refresh token (longa duração)
 * @param {Object} payload
 * @param {Boolean} rememberMe
 */
export function generateRefreshToken(payload, rememberMe = false) {
  const refreshSecret = env.JWT_REFRESH_SECRET || env.JWT_SECRET;
  const expiresIn = rememberMe ? '30d' : '7d';
  
  return jwt.sign(payload, refreshSecret, {
    expiresIn,
    issuer: 'feminisse-api',
    audience: 'feminisse-app',
  });
}

/**
 * Verifica access token
 */
export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, env.JWT_SECRET, {
      issuer: 'feminisse-api',
      audience: 'feminisse-app',
    });
  } catch (error) {
    throw error;
  }
}

/**
 * Verifica refresh token
 */
export function verifyRefreshToken(token) {
  try {
    const refreshSecret = env.JWT_REFRESH_SECRET || env.JWT_SECRET;
    return jwt.verify(token, refreshSecret, {
      issuer: 'feminisse-api',
      audience: 'feminisse-app',
    });
  } catch (error) {
    throw error;
  }
}

/**
 * Salva refresh token no banco
 * @param {String} userId - ID do usuário
 * @param {String} token - Token a ser salvo
 * @param {Boolean} rememberMe - Se true, expira em 30 dias; se false, 7 dias
 */
export async function saveRefreshToken(userId, token, rememberMe = false) {
  try {
    const expiresAt = new Date();
    const daysToAdd = rememberMe ? 30 : 7;
    expiresAt.setDate(expiresAt.getDate() + daysToAdd);

    const { error } = await supabase
      .from('refresh_tokens')
      .insert({
        user_id: userId,
        token,
        expires_at: expiresAt.toISOString(),
      });

    if (error) throw error;
  } catch (error) {
    logger.error({ err: error }, 'Erro ao salvar refresh token');
    throw error;
  }
}

/**
 * Verifica se refresh token existe no banco
 */
export async function validateRefreshToken(token) {
  try {
    const { data, error } = await supabase
      .from('refresh_tokens')
      .select('*')
      .eq('token', token)
      .eq('revoked', false)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) return null;
    return data;
  } catch (error) {
    logger.error({ err: error }, 'Erro ao validar refresh token');
    return null;
  }
}

/**
 * Revoga refresh token
 */
export async function revokeRefreshToken(token) {
  try {
    const { error } = await supabase
      .from('refresh_tokens')
      .update({ revoked: true, revoked_at: new Date().toISOString() })
      .eq('token', token);

    if (error) throw error;
  } catch (error) {
    logger.error({ err: error }, 'Erro ao revogar refresh token');
    throw error;
  }
}

/**
 * Revoga todos os refresh tokens de um usuário
 */
export async function revokeAllUserTokens(userId) {
  try {
    const { error } = await supabase
      .from('refresh_tokens')
      .update({ revoked: true, revoked_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('revoked', false);

    if (error) throw error;
  } catch (error) {
    logger.error({ err: error }, 'Erro ao revogar tokens do usuário');
    throw error;
  }
}

/**
 * Limpa tokens expirados (executar periodicamente)
 */
export async function cleanExpiredTokens() {
  try {
    const { error } = await supabase
      .from('refresh_tokens')
      .delete()
      .lt('expires_at', new Date().toISOString());

    if (error) throw error;
    
    logger.info('Tokens expirados limpos com sucesso');
  } catch (error) {
    logger.error({ err: error }, 'Erro ao limpar tokens expirados');
  }
}

/**
 * Define cookies de autenticação
 * @param {Object} res - Response object
 * @param {String} accessToken - Access token
 * @param {String} refreshToken - Refresh token
 * @param {Boolean} rememberMe - Se true, cookie dura 30 dias; se false, 7 dias
 */
export function setAuthCookies(res, accessToken, refreshToken, rememberMe = false) {
  const isProduction = env.NODE_ENV === 'production';

  // ✅ CORREÇÃO CRÍTICA: Em produção com HTTPS, usar sameSite='none' + secure=true
  // Em desenvolvimento ou se não for HTTPS, usar sameSite='lax' + secure=false
  const cookieOptions = {
    httpOnly: true,
    secure: isProduction, // true em produção (HTTPS), false em dev
    sameSite: isProduction ? 'none' : 'lax', // 'none' requer secure=true
    path: '/',
  };

  // Access token (curta duração)
  res.cookie('accessToken', accessToken, {
    ...cookieOptions,
    maxAge: 15 * 60 * 1000, // 15 minutos
  });

  // Refresh token (duração variável)
  const refreshMaxAge = rememberMe 
    ? 30 * 24 * 60 * 60 * 1000  // 30 dias
    : 7 * 24 * 60 * 60 * 1000;  // 7 dias
  
  res.cookie('refreshToken', refreshToken, {
    ...cookieOptions,
    maxAge: refreshMaxAge,
  });

  logger.info('Cookies de autenticação definidos', {
    production: isProduction,
    sameSite: cookieOptions.sameSite,
    secure: cookieOptions.secure,
    path: cookieOptions.path,
    rememberMe: rememberMe,
    refreshTokenDuration: rememberMe ? '30 dias' : '7 dias'
  });
}

/**
 * Limpa cookies de autenticação
 */
export function clearAuthCookies(res) {
  const isProduction = env.NODE_ENV === 'production';
  
  // ✅ Deve usar as MESMAS opções que foram usadas no setCookie
  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
  };
  
  res.clearCookie('accessToken', { 
    ...cookieOptions,
    path: '/' 
  });
  
  // ✅ CORRIGIDO: path '/' para corresponder ao setAuthCookies
  res.clearCookie('refreshToken', { 
    ...cookieOptions,
    path: '/' // ✅ Mudado de '/api/auth' para '/'
  });
  
  logger.info('Cookies de autenticação limpos');
}
