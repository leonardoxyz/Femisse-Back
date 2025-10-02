import { cacheDelete } from '../src/services/cacheService.js';

const userId = '42626783-370f-4ae9-9085-70fea96d97f6';

const run = async () => {
  try {
    await cacheDelete([
      `cache:reviews:user:${userId}`,
      `cache:reviews:reviewable:${userId}`,
    ]);
    console.log('Cache limpo para usuário', userId);
  } catch (error) {
    console.error('Erro ao limpar cache:', error);
  } finally {
    process.exit(0);
  }
};

run();