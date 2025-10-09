import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import { env } from '../config/validateEnv.js';
import { logger } from './logger.js';

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);

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
 */
export function generateRefreshToken(payload) {
  const refreshSecret = env.JWT_REFRESH_SECRET || env.JWT_SECRET;
  return jwt.sign(payload, refreshSecret, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
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
 */
export async function saveRefreshToken(userId, token) {
  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 dias

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
 */
export function setAuthCookies(res, accessToken, refreshToken) {
  const isProduction = env.NODE_ENV === 'production';

  // Configurações base dos cookies
  const cookieOptions = {
    httpOnly: true,
    secure: isProduction, // ✅ true apenas em produção (HTTPS), false em dev (HTTP)
    sameSite: isProduction ? 'none' : 'lax', // 'none' em prod para cross-domain, 'lax' em dev
  };

  // Access token (curta duração)
  res.cookie('accessToken', accessToken, {
    ...cookieOptions,
    maxAge: 15 * 60 * 1000, // 15 minutos
    path: '/',
  });

  // Refresh token (longa duração)
  res.cookie('refreshToken', refreshToken, {
    ...cookieOptions,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 dias
    path: '/api/auth',
  });

  logger.info('Cookies de autenticação definidos', {
    production: isProduction,
    sameSite: cookieOptions.sameSite,
    secure: cookieOptions.secure
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
  
  res.clearCookie('refreshToken', { 
    ...cookieOptions,
    path: '/api/auth' 
  });
  
  logger.info('Cookies de autenticação limpos');
}
