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
  MERCADOPAGO_ACCESS_TOKEN: z.string().optional(),
  MERCADOPAGO_PUBLIC_KEY: z.string().optional(),

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

/**
 * Helpers para verificar ambiente
 */
export const isDevelopment = env.NODE_ENV === 'development';
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
