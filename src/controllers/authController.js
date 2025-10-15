import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import validator from 'validator';
import { validateTurnstileToken } from '../utils/turnstile.js';
import { logger, logSecurity } from '../utils/logger.js';
import { env } from '../config/validateEnv.js';
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

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);

/**
 * Sanitiza string removendo caracteres perigosos
 */
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  return validator.escape(str.trim());
};

/**
 * Validação de senha forte
 */
const validatePassword = (senha) => {
  if (!senha || senha.length < 8) {
    throw new ValidationError('Senha deve ter pelo menos 8 caracteres');
  }
  if (!/[A-Z]/.test(senha)) {
    throw new ValidationError('Senha deve conter pelo menos uma letra maiúscula');
  }
  if (!/[a-z]/.test(senha)) {
    throw new ValidationError('Senha deve conter pelo menos uma letra minúscula');
  }
  if (!/[0-9]/.test(senha)) {
    throw new ValidationError('Senha deve conter pelo menos um número');
  }
  return true;
};

/**
 * Validação de CPF
 */
const validateCPF = (cpf) => {
  if (!cpf) return true;
  const cleanCPF = cpf.replace(/\D/g, '');
  if (cleanCPF.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleanCPF)) return false;
  return true;
};

/**
 * Validação de telefone
 */
const validatePhone = (telefone) => {
  if (!telefone) return true;
  const cleanPhone = telefone.replace(/\D/g, '');
  return cleanPhone.length >= 10 && cleanPhone.length <= 11;
};

/**
 * Registro de novo usuário
 */
export const register = asyncHandler(async (req, res) => {
  logger.info({ ip: req.ip }, 'Tentativa de registro');

  let { nome, data_nascimento, cpf, telefone, email, senha, turnstileToken } = req.body;

  // 1. Validação de campos obrigatórios
  if (!nome || !email || !senha) {
    throw new ValidationError('Nome, email e senha são obrigatórios');
  }

  // 2. Validação do Turnstile (CAPTCHA)
  if (!turnstileToken) {
    throw new ValidationError('Complete a verificação de segurança');
  }

  const clientIP = req.ip || req.headers['x-forwarded-for'];
  const turnstileValidation = await validateTurnstileToken(turnstileToken, clientIP);

  if (!turnstileValidation.success) {
    logSecurity('turnstile_failed', { ip: clientIP });
    throw new ValidationError(turnstileValidation.error || 'Verificação de segurança inválida');
  }

  // 3. Sanitização de inputs
  nome = sanitizeString(nome);
  email = sanitizeString(email);

  // 4. Validação de email
  if (!validator.isEmail(email)) {
    throw new ValidationError('Email inválido');
  }

  email = validator.normalizeEmail(email);

  // 5. Validação de senha forte
  validatePassword(senha);

  // 6. Validação de CPF (se fornecido)
  if (cpf && !validateCPF(cpf)) {
    throw new ValidationError('CPF inválido');
  }

  // 7. Validação de telefone (se fornecido)
  if (telefone && !validatePhone(telefone)) {
    throw new ValidationError('Telefone inválido');
  }

  // 8. Validação de data de nascimento (se fornecida)
  if (data_nascimento && !validator.isDate(data_nascimento)) {
    throw new ValidationError('Data de nascimento inválida');
  }

  // 9. Hash da senha (bcrypt com salt rounds 12)
  const senha_hash = await bcrypt.hash(senha, 12);

  // 10. Preparação dos dados
  const userData = {
    nome,
    email,
    senha_hash,
  };

  if (data_nascimento) userData.data_nascimento = data_nascimento;
  if (cpf) userData.cpf = cpf.replace(/\D/g, '');
  if (telefone) userData.telefone = telefone.replace(/\D/g, '');

  // 11. Inserção no banco
  const { data, error } = await supabase
    .from('usuarios')
    .insert([userData])
    .select('id, nome, email, data_nascimento, cpf, telefone')
    .single();

  if (error) {
    logger.error({ err: error }, 'Erro ao inserir usuário');

    if (error.code === '23505' || error.message.includes('duplicate')) {
      throw new ConflictError('E-mail ou CPF já cadastrado');
    }

    throw new Error('Não foi possível completar o registro');
  }

  logger.info({ userId: data.id }, 'Usuário registrado com sucesso');
  logSecurity('user_registered', { userId: data.id, email: data.email });

  // 12. Resposta (não retorna senha_hash)
  res.status(201).json({
    usuario: {
      id: data.id,
      nome: data.nome,
      email: data.email,
      data_nascimento: data.data_nascimento,
      cpf: data.cpf,
      telefone: data.telefone,
    },
    message: 'Usuário registrado com sucesso',
  });
});

/**
 * Login de usuário
 */
export const login = asyncHandler(async (req, res) => {
  logger.info({ ip: req.ip }, 'Tentativa de login');

  let { email, senha } = req.body;

  // 1. Validação de campos obrigatórios
  if (!email || !senha) {
    throw new ValidationError('Email e senha são obrigatórios');
  }

  // 2. Sanitização e validação de email
  email = sanitizeString(email);

  if (!validator.isEmail(email)) {
    throw new ValidationError('Email inválido');
  }

  email = validator.normalizeEmail(email);

  // 3. Validação básica de senha
  if (senha.length < 6) {
    throw new ValidationError('Senha deve ter pelo menos 6 caracteres');
  }

  // 4. Busca usuário
  const { data: usuarios, error } = await supabase
    .from('usuarios')
    .select('id, nome, email, senha_hash')
    .eq('email', email)
    .limit(1);

  if (error) {
    logger.error({ err: error }, 'Erro ao buscar usuário');
    throw new Error('Não foi possível completar o login');
  }

  // 5. Validação de credenciais
  if (!usuarios || usuarios.length === 0) {
    logSecurity('login_failed_user_not_found', { email, ip: req.ip });
    // Delay artificial para dificultar timing attacks
    await new Promise((resolve) => setTimeout(resolve, 1000));
    throw new UnauthorizedError('E-mail ou senha inválidos');
  }

  const usuario = usuarios[0];

  // 6. Verificação de senha
  const senhaOk = await bcrypt.compare(senha, usuario.senha_hash);

  if (!senhaOk) {
    logSecurity('login_failed_invalid_password', { userId: usuario.id, ip: req.ip });
    // Delay artificial para dificultar timing attacks
    await new Promise((resolve) => setTimeout(resolve, 1000));
    throw new UnauthorizedError('E-mail ou senha inválidos');
  }

  // 7. Geração de tokens
  const payload = {
    id: usuario.id,
    email: usuario.email,
    nome: usuario.nome,
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  // 8. Salva refresh token no banco
  await saveRefreshToken(usuario.id, refreshToken);

  // 9. Define cookies httpOnly
  setAuthCookies(res, accessToken, refreshToken);

  logger.info({ 
    userId: usuario.id,
    userAgent: req.headers['user-agent'],
    origin: req.headers.origin,
    isMobile: /mobile/i.test(req.headers['user-agent'] || '')
  }, 'Login bem-sucedido - cookies definidos');
  logSecurity('user_logged_in', { userId: usuario.id });

  // 10. Resposta (não retorna senha_hash)
  // Token já está nos cookies httpOnly (mais seguro)
  res.json({
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
    },
    message: 'Login realizado com sucesso',
  });
});

/**
 * Logout de usuário
 */
export const logout = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (refreshToken) {
    // Revoga refresh token
    const { revokeRefreshToken } = await import('../utils/tokenManager.js');
    await revokeRefreshToken(refreshToken);
  }

  // Limpa cookies
  clearAuthCookies(res);

  logger.info({ userId: req.user?.id }, 'Logout realizado');

  res.json({ message: 'Logout realizado com sucesso' });
});

/**
 * Refresh token
 */
export const refreshToken = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    throw new UnauthorizedError('Refresh token não fornecido');
  }

  // Verifica refresh token
  const { verifyRefreshToken, validateRefreshToken } = await import('../utils/tokenManager.js');

  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (error) {
    throw new UnauthorizedError('Refresh token inválido');
  }

  // Valida se token existe no banco e não foi revogado
  const tokenData = await validateRefreshToken(refreshToken);

  if (!tokenData) {
    throw new UnauthorizedError('Refresh token inválido ou revogado');
  }

  // Gera novo access token
  const payload = {
    id: decoded.id,
    email: decoded.email,
    nome: decoded.nome,
  };

  const newAccessToken = generateAccessToken(payload);

  // Define novo cookie
  const isProduction = env.NODE_ENV === 'production';
  res.cookie('accessToken', newAccessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000, // 15 minutos
    path: '/',
  });

  logger.info({ userId: decoded.id }, 'Token renovado');

  res.json({ message: 'Token renovado com sucesso' });
});
