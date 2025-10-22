import { z } from 'zod';
import dotenv from 'dotenv';

// Carrega variáveis de ambiente ANTES de validar
dotenv.config();

/**
 * Schema de validação para variáveis de ambiente
 */
const envSchema = z.object({
  // Ambiente
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('4000'),

  // Supabase
  SUPABASE_URL: z.string().url('SUPABASE_URL deve ser uma URL válida'),
  SUPABASE_KEY: z.string().min(1, 'SUPABASE_KEY é obrigatória'),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET deve ter no mínimo 32 caracteres'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_SECRET: z.string().min(32).optional(),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  // Redis (opcional)
  REDIS_URL: z.string().url().optional(),
  REDIS_PASSWORD: z.string().optional(),

  // Mercado Pago
  MERCADO_PAGO_ACCESS_TOKEN: z.string().optional(),
  MERCADO_PAGO_PUBLIC_KEY: z.string().optional(),

  // Cloudflare Turnstile
  TURNSTILE_SECRET_KEY: z.string().optional(),

  // Logs
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // CORS
  FRONTEND_URL: z.string().url().default('http://localhost:8080'),
  CORS_ORIGINS: z.string().optional(),
});

/**
 * Valida e exporta variáveis de ambiente
 */
export function validateEnv() {
  try {
    const env = envSchema.parse(process.env);
    
    // Log de sucesso (apenas em desenvolvimento)
    if (env.NODE_ENV === 'development') {
      console.log('✅ Variáveis de ambiente validadas com sucesso');
    }

    return env;
  } catch (error) {
    console.error('❌ Erro na validação de variáveis de ambiente:');
    
    if (error instanceof z.ZodError) {
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
    }

    console.error('\n📝 Verifique seu arquivo .env e tente novamente.\n');
    process.exit(1);
  }
}

/**
 * Variáveis de ambiente validadas
 */
export const env = validateEnv();

if (process.env.NODE_ENV === 'production') {
  const productionSecrets = [
    { key: 'JWT_SECRET', value: env.JWT_SECRET, minLength: 32 },
    { key: 'TURNSTILE_SECRET_KEY', value: env.TURNSTILE_SECRET_KEY, minLength: 20 },
    { key: 'SUPABASE_KEY', value: env.SUPABASE_KEY, minLength: 20 },
  ];

  const missingSecrets = [];
  const weakSecrets = [];

  productionSecrets.forEach(({ key, value, minLength }) => {
    if (!value) {
      missingSecrets.push(key);
    } else if (value.length < minLength) {
      weakSecrets.push(`${key} (mínimo ${minLength} caracteres)`);
    }
  });

  if (missingSecrets.length > 0) {
    console.error('❌ ERRO CRÍTICO: Secrets obrigatórios ausentes em PRODUÇÃO:');
    missingSecrets.forEach(key => console.error(`   - ${key}`));
    process.exit(1);
  }

  if (weakSecrets.length > 0) {
    console.error('⚠️ AVISO: Secrets fracos em PRODUÇÃO:');
    weakSecrets.forEach(msg => console.warn(`   - ${msg}`));
    console.error('❌ PRODUÇÃO BLOQUEADA: Use secrets fortes!');
    process.exit(1);
  }

  console.log('✅ Secrets de produção validados com sucesso');
}

/**
 * Helpers para verificar ambiente
 */
export const isDevelopment = env.NODE_ENV === 'development';
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

/**
 * Configurações de CORS baseadas no ambiente
 */
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

/**
 * Export padrão com todas as configurações
 */
export default {
  NODE_ENV: env.NODE_ENV,
  isDevelopment,
  isProduction,
  isTest,
  PORT: env.PORT,
  SUPABASE_URL: env.SUPABASE_URL,
  SUPABASE_KEY: env.SUPABASE_KEY,
  JWT_SECRET: env.JWT_SECRET,
  JWT_EXPIRES_IN: env.JWT_EXPIRES_IN,
  JWT_REFRESH_SECRET: env.JWT_REFRESH_SECRET,
  JWT_REFRESH_EXPIRES_IN: env.JWT_REFRESH_EXPIRES_IN,
  REDIS_URL: env.REDIS_URL,
  REDIS_PASSWORD: env.REDIS_PASSWORD,
  MERCADO_PAGO_ACCESS_TOKEN: env.MERCADO_PAGO_ACCESS_TOKEN,
  MERCADO_PAGO_PUBLIC_KEY: env.MERCADO_PAGO_PUBLIC_KEY,
  TURNSTILE_SECRET_KEY: env.TURNSTILE_SECRET_KEY,
  LOG_LEVEL: env.LOG_LEVEL,
  FRONTEND_URL: env.FRONTEND_URL,
  CORS_ORIGINS,
};
