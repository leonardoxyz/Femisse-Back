import Redis from 'ioredis';
import dotenv from 'dotenv';

import { logger } from '../utils/logger.js';
dotenv.config();

const redisUrl = process.env.REDIS_URL || process.env.REDIS_CONNECTION_STRING;

if (!redisUrl) {
  logger.warn('⚠️ Redis URL não configurada. O cache distribuído ficará desativado.');
}

export const redisClient = redisUrl
  ? new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      reconnectOnError: (err) => {
        const targetErrors = ['READONLY', 'ETIMEDOUT'];
        if (targetErrors.some((code) => err?.message?.includes(code))) {
          return true;
        }
        return false;
      },
    })
  : null;

export const isRedisEnabled = () => Boolean(redisClient);

if (redisClient) {
  redisClient.on('error', (err) => {
    logger.error({ err: err }, 'Erro no Redis');
  });

  redisClient.on('connect', () => {
    logger.info('✅ Redis conectado com sucesso');
  });
}
