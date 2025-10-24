import dotenv from 'dotenv';

import { logger } from '../utils/logger.js';
// Carrega variáveis de ambiente
dotenv.config();

// Detecta o ambiente
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const isDevelopment = NODE_ENV !== 'production';
export const isProduction = NODE_ENV === 'production';

// Configurações do servidor
export const PORT = process.env.PORT || 4000;

// Configurações do Supabase
export const SUPABASE_URL = process.env.SUPABASE_URL;
export const SUPABASE_KEY = process.env.SUPABASE_KEY;

// Configurações de autenticação
export const JWT_SECRET = process.env.JWT_SECRET;

// Configurações de CORS baseadas no ambiente
export const CORS_ORIGINS = isDevelopment 
  ? [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:8080',
    ]
  : [
      'https://femisse-front.vercel.app',
      'https://femisse.com',
    ];

// Adiciona domínios específicos em produção
if (isProduction) {
  CORS_ORIGINS.push(
    'https://femisse-front.vercel.app',
    'https://femisse-back.vercel.app'
  );
}

// Log das configurações (sem dados sensíveis)
logger.info({
  NODE_ENV,
  isDevelopment,
  isProduction,
  PORT,
  hasSupabaseUrl: !!SUPABASE_URL,
  hasSupabaseKey: !!SUPABASE_KEY,
  corsOrigins: CORS_ORIGINS
}, 'Environment Configuration');

export default {
  NODE_ENV,
  isDevelopment,
  isProduction,
  PORT,
  SUPABASE_URL,
  SUPABASE_KEY,
  JWT_SECRET,
  CORS_ORIGINS
};
