import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import validator from 'validator';
import { validateTurnstileToken } from '../utils/turnstile.js';

dotenv.config();

const isDevelopment = process.env.NODE_ENV !== 'production';
const isProduction = process.env.NODE_ENV === 'production';

// Configuração do Supabase baseada no ambiente
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

console.log('Environment:', { 
  NODE_ENV: process.env.NODE_ENV, 
  isDevelopment, 
  isProduction,
  hasSupabaseUrl: !!supabaseUrl,
  hasSupabaseKey: !!supabaseKey
});

const supabase = createClient(supabaseUrl, supabaseKey);

// Validação crítica: JWT_SECRET deve existir em produção
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET não configurado! Configure a variável de ambiente.');
}

// Utilitário para sanitizar strings (remove caracteres perigosos)
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  return validator.escape(str.trim());
};

// Validação de senha forte
const validatePassword = (senha) => {
  if (!senha || senha.length < 8) {
    return { valid: false, message: 'Senha deve ter pelo menos 8 caracteres' };
  }
  if (!/[A-Z]/.test(senha)) {
    return { valid: false, message: 'Senha deve conter pelo menos uma letra maiúscula' };
  }
  if (!/[a-z]/.test(senha)) {
    return { valid: false, message: 'Senha deve conter pelo menos uma letra minúscula' };
  }
  if (!/[0-9]/.test(senha)) {
    return { valid: false, message: 'Senha deve conter pelo menos um número' };
  }
  return { valid: true };
};

// Validação de CPF
const validateCPF = (cpf) => {
  if (!cpf) return true; // CPF é opcional
  const cleanCPF = cpf.replace(/\D/g, '');
  if (cleanCPF.length !== 11) return false;
  // Validação básica de CPF (pode melhorar com algoritmo completo)
  if (/^(\d)\1{10}$/.test(cleanCPF)) return false; // Rejeita CPFs com todos dígitos iguais
  return true;
};

// Validação de telefone
const validatePhone = (telefone) => {
  if (!telefone) return true; // Telefone é opcional
  const cleanPhone = telefone.replace(/\D/g, '');
  return cleanPhone.length >= 10 && cleanPhone.length <= 11;
};

// Logger seguro (não loga dados sensíveis em produção)
const secureLog = (message, data = {}) => {
  if (isDevelopment) {
    console.log(message, data);
  } else {
    // Em produção, loga apenas informações não sensíveis
    const safeData = { ...data };
    delete safeData.senha;
    delete safeData.senha_hash;
    delete safeData.password;
    console.log(message, safeData);
  }
};

export async function register(req, res) {
  try {
    secureLog('Register attempt');
    
    let { nome, data_nascimento, cpf, telefone, email, senha, turnstileToken } = req.body;
    
    // 1. VALIDAÇÃO DE CAMPOS OBRIGATÓRIOS
    if (!nome || !email || !senha) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: [{ message: 'Nome, email e senha são obrigatórios' }]
      });
    }
    
    // 1.1. VALIDAÇÃO DO TURNSTILE (CAPTCHA)
    if (!turnstileToken) {
      return res.status(400).json({ 
        error: 'Verificação de segurança obrigatória',
        details: [{ message: 'Complete a verificação de segurança' }]
      });
    }
    
    // Validar token do Turnstile
    const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
    const turnstileValidation = await validateTurnstileToken(turnstileToken, clientIP);
    
    if (!turnstileValidation.success) {
      secureLog('Turnstile validation failed:', { error: turnstileValidation.error });
      return res.status(400).json({ 
        error: 'Falha na verificação de segurança',
        details: [{ message: turnstileValidation.error || 'Verificação de segurança inválida' }]
      });
    }
    
    secureLog('Turnstile validation successful');
    
    // 2. SANITIZAÇÃO DE INPUTS
    nome = sanitizeString(nome);
    email = sanitizeString(email);
    
    // 3. VALIDAÇÃO DE EMAIL
    if (!validator.isEmail(email)) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: [{ path: 'email', message: 'Email inválido' }]
      });
    }
    
    // Normaliza email para lowercase
    email = validator.normalizeEmail(email);
    
    // 4. VALIDAÇÃO DE SENHA FORTE
    const passwordValidation = validatePassword(senha);
    if (!passwordValidation.valid) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: [{ path: 'senha', message: passwordValidation.message }]
      });
    }
    
    // 5. VALIDAÇÃO DE CPF (se fornecido)
    if (cpf && !validateCPF(cpf)) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: [{ path: 'cpf', message: 'CPF inválido' }]
      });
    }
    
    // 6. VALIDAÇÃO DE TELEFONE (se fornecido)
    if (telefone && !validatePhone(telefone)) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: [{ path: 'telefone', message: 'Telefone inválido' }]
      });
    }
    
    // 7. VALIDAÇÃO DE DATA DE NASCIMENTO (se fornecida)
    if (data_nascimento && !validator.isDate(data_nascimento)) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: [{ path: 'data_nascimento', message: 'Data de nascimento inválida' }]
      });
    }
    
    // 8. HASH DA SENHA (bcrypt com salt rounds 12 para maior segurança)
    const senha_hash = await bcrypt.hash(senha, 12);
    secureLog('Password hashed successfully');
    
    // 9. PREPARAÇÃO DOS DADOS (apenas campos válidos)
    const userData = {
      nome,
      email,
      senha_hash
    };
    
    // Adiciona campos opcionais apenas se fornecidos
    if (data_nascimento) userData.data_nascimento = data_nascimento;
    if (cpf) userData.cpf = cpf.replace(/\D/g, ''); // Remove formatação
    if (telefone) userData.telefone = telefone.replace(/\D/g, ''); // Remove formatação
    
    secureLog('Inserting user data');
    
    // 10. INSERÇÃO NO BANCO (Supabase já protege contra SQL Injection)
    const { data, error } = await supabase
      .from('usuarios')
      .insert([userData])
      .select('id, nome, email, data_nascimento, cpf, telefone')
      .single();
    
    if (error) {
      secureLog('Supabase insert error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      
      // Mensagem genérica para não expor detalhes do banco
      if (error.code === '23505' || error.message.includes('duplicate')) {
        return res.status(409).json({ 
          error: 'Dados inválidos',
          details: [{ message: 'E-mail ou CPF já cadastrado' }]
        });
      }
      
      // Erro genérico para não expor estrutura do banco
      return res.status(500).json({ 
        error: 'Erro ao processar solicitação',
        details: [{ message: 'Não foi possível completar o registro' }]
      });
    }
    
    secureLog('User registered successfully');
    
    // 11. RESPOSTA (não retorna senha_hash)
    res.status(201).json({ 
      usuario: {
        id: data.id,
        nome: data.nome,
        email: data.email,
        data_nascimento: data.data_nascimento,
        cpf: data.cpf,
        telefone: data.telefone,
      },
      message: 'Usuário registrado com sucesso'
    });
  } catch (err) {
    console.error('Erro no registro:', err.message);
    
    // Mensagem genérica em produção
    if (isProduction) {
      return res.status(500).json({ 
        error: 'Erro ao processar solicitação',
        details: [{ message: 'Ocorreu um erro interno' }]
      });
    }
    
    // Detalhes apenas em desenvolvimento
    res.status(500).json({ 
      error: 'Erro ao registrar usuário', 
      details: [{ message: err.message }]
    });
  }
}

export async function login(req, res) {
  try {
    secureLog('Login attempt');
    
    let { email, senha } = req.body;
    
    // 1. VALIDAÇÃO DE CAMPOS OBRIGATÓRIOS
    if (!email || !senha) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: [
          { path: 'email', message: 'Email é obrigatório' },
          { path: 'senha', message: 'Senha é obrigatória' }
        ]
      });
    }
    
    // 2. SANITIZAÇÃO E VALIDAÇÃO DE EMAIL
    email = sanitizeString(email);
    
    if (!validator.isEmail(email)) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: [{ path: 'email', message: 'Email inválido' }]
      });
    }
    
    // Normaliza email
    email = validator.normalizeEmail(email);
    
    // 3. VALIDAÇÃO BÁSICA DE SENHA (mínimo 6 caracteres para login)
    if (senha.length < 6) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: [{ path: 'senha', message: 'Senha deve ter pelo menos 6 caracteres' }]
      });
    }
    
    secureLog('Searching for user');
    
    // 4. BUSCA USUÁRIO (Supabase protege contra SQL Injection)
    const { data: usuarios, error } = await supabase
      .from('usuarios')
      .select('id, nome, email, senha_hash')
      .eq('email', email)
      .limit(1);
    
    if (error) {
      console.error('Supabase error:', error.message);
      return res.status(500).json({ 
        error: 'Erro ao processar solicitação',
        details: [{ message: 'Não foi possível completar o login' }]
      });
    }
    
    // 5. VALIDAÇÃO DE CREDENCIAIS (mensagem genérica para não expor se usuário existe)
    if (!usuarios || usuarios.length === 0) {
      secureLog('User not found');
      // Delay artificial para dificultar timing attacks
      await new Promise(resolve => setTimeout(resolve, 1000));
      return res.status(401).json({ 
        error: 'Credenciais inválidas',
        details: [{ message: 'E-mail ou senha inválidos' }]
      });
    }
    
    const usuario = usuarios[0];
    secureLog('User found');
    
    // 6. VERIFICAÇÃO DE SENHA
    const senhaOk = await bcrypt.compare(senha, usuario.senha_hash);
    
    if (!senhaOk) {
      secureLog('Invalid password');
      // Delay artificial para dificultar timing attacks
      await new Promise(resolve => setTimeout(resolve, 1000));
      return res.status(401).json({ 
        error: 'Credenciais inválidas',
        details: [{ message: 'E-mail ou senha inválidos' }]
      });
    }
    
    // 7. GERAÇÃO DE TOKEN JWT
    const token = jwt.sign(
      { 
        id: usuario.id, 
        email: usuario.email, 
        nome: usuario.nome 
      }, 
      JWT_SECRET, 
      { 
        expiresIn: '7d',
        issuer: 'feminisse-api',
        audience: 'feminisse-app'
      }
    );
    
    secureLog('Login successful');
    
    // 8. RESPOSTA (não retorna senha_hash)
    res.json({ 
      token, 
      usuario: { 
        id: usuario.id, 
        nome: usuario.nome, 
        email: usuario.email
      } 
    });
  } catch (err) {
    console.error('Erro no login:', err.message);
    
    // Mensagem genérica em produção
    if (isProduction) {
      return res.status(500).json({ 
        error: 'Erro ao processar solicitação',
        details: [{ message: 'Ocorreu um erro interno' }]
      });
    }
    
    // Detalhes apenas em desenvolvimento
    res.status(500).json({ 
      error: 'Erro ao fazer login', 
      details: [{ message: err.message }]
    });
  }
}
