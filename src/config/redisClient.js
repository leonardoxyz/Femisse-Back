import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL || process.env.REDIS_CONNECTION_STRING;

if (!redisUrl) {
  console.warn('⚠️ Redis URL não configurada. O cache distribuído ficará desativado.');
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
    console.error('Erro no Redis:', err);
  });

  redisClient.on('connect', () => {
    console.log('✅ Redis conectado com sucesso');
  });
}
