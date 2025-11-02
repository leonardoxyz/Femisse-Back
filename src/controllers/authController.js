import supabase from '../services/supabaseClient.js';
import bcrypt from 'bcryptjs';
import validator from 'validator';
import { validateTurnstileToken } from '../utils/turnstile.js';
import { logger, logSecurity } from '../utils/logger.js';
import { getClientIp } from '../utils/requestUtils.js';
import {
  generateAccessToken,
  generateRefreshToken,
  setAuthCookies,
  saveRefreshToken,
  clearAuthCookies,
} from '../utils/tokenManager.js';
import {
  asyncHandler,
  ValidationError,
  UnauthorizedError,
  ConflictError,
} from '../middleware/errorHandler.js';
import {
  sanitizeString,
  validatePassword,
  validateEmail,
  validateCPF,
  validatePhone,
  validateBirthDate,
} from '../utils/authValidation.js';

export const register = asyncHandler(async (req, res) => {
  const clientIp = getClientIp(req);
  logger.info({ ip: clientIp }, 'Tentativa de registro');

  let { nome, data_nascimento, cpf, telefone, email, senha, turnstileToken } = req.body;

  if (!nome || !email || !senha) {
    throw new ValidationError('Nome, email e senha são obrigatórios');
  }

  if (!turnstileToken) {
    throw new ValidationError('Complete a verificação de segurança');
  }

  const turnstileValidation = await validateTurnstileToken(turnstileToken, clientIp);

  if (!turnstileValidation.success) {
    logSecurity('turnstile_failed', { ip: clientIp });
    throw new ValidationError(turnstileValidation.error || 'Verificação de segurança inválida');
  }

  nome = sanitizeString(nome);
  email = sanitizeString(email);
  validateEmail(email);
  email = validator.normalizeEmail(email);
  validatePassword(senha);

  if (cpf) validateCPF(cpf);
  if (telefone) validatePhone(telefone);
  if (data_nascimento) validateBirthDate(data_nascimento);

  // 🔒 SEGURANÇA: 14 rounds recomendados para 2024 (mais seguro que 12)
  const senha_hash = await bcrypt.hash(senha, 14);

  const userData = {
    nome,
    email,
    senha_hash,
    data_nascimento: data_nascimento || null,
    cpf: cpf ? cpf.replace(/\D/g, '') : null,
    telefone: telefone ? telefone.replace(/\D/g, '') : null,
  };

  const { data, error } = await supabase
    .from('usuarios')
    .insert([userData])
    .select('id, nome, email')
    .single();

  if (error) {
    if (error.code === '23505' || error.message.includes('duplicate')) {
      throw new ConflictError('Email já cadastrado');
    }
    throw error;
  }

  logSecurity('user_registered', { userId: data.id, email });
  res.status(201).json({ success: true, message: 'Usuário registrado com sucesso' });
});

export const login = asyncHandler(async (req, res) => {
  const clientIp = getClientIp(req);
  logger.info({ ip: clientIp }, 'Tentativa de login');

  let { email, senha } = req.body;

  if (!email || !senha) {
    throw new ValidationError('Email e senha são obrigatórios');
  }

  email = sanitizeString(email);
  validateEmail(email);
  email = validator.normalizeEmail(email);

  const { data: user, error } = await supabase
    .from('usuarios')
    .select('id, nome, email, senha_hash, cpf, telefone, data_nascimento')
    .eq('email', email)
    .single();

  if (error || !user) {
    logSecurity('login_failed_user_not_found', { email });
    throw new UnauthorizedError('Email ou senha incorretos');
  }

  const senhaValida = await bcrypt.compare(senha, user.senha_hash);

  if (!senhaValida) {
    logSecurity('login_failed_wrong_password', { userId: user.id });
    throw new UnauthorizedError('Email ou senha incorretos');
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  await saveRefreshToken(user.id, refreshToken);
  setAuthCookies(res, accessToken, refreshToken);

  logSecurity('user_logged_in', { userId: user.id });

  res.json({
    success: true,
    message: 'Login realizado com sucesso',
    accessToken,
    refreshToken,
    user: { id: user.id, nome: user.nome, email: user.email }
  });
});

export const logout = asyncHandler(async (req, res) => {
  const userId = req.user?.id;

  if (userId) {
    await supabase
      .from('refresh_tokens')
      .delete()
      .eq('user_id', userId);

    logSecurity('user_logged_out', { userId });
  }

  clearAuthCookies(res);
  res.json({ success: true, message: 'Logout realizado com sucesso' });
});

export const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken: token } = req.body;

  if (!token) {
    throw new ValidationError('Refresh token é obrigatório');
  }

  const { data: tokenData, error } = await supabase
    .from('refresh_tokens')
    .select('id, user_id, token, expires_at, created_at')
    .eq('token', token)
    .single();

  if (error || !tokenData) {
    throw new UnauthorizedError('Refresh token inválido');
  }

  const { data: user } = await supabase
    .from('usuarios')
    .select('id, nome, email, cpf, telefone, data_nascimento')
    .eq('id', tokenData.user_id)
    .single();

  if (!user) {
    throw new UnauthorizedError('Usuário não encontrado');
  }

  const newAccessToken = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(user);

  await supabase
    .from('refresh_tokens')
    .delete()
    .eq('token', token);

  await saveRefreshToken(user.id, newRefreshToken);
  setAuthCookies(res, newAccessToken, newRefreshToken);

  res.json({
    success: true,
    accessToken: newAccessToken,
    refreshToken: newRefreshToken
  });
});

export default {
  register,
  login,
  logout,
  refreshToken,
};
