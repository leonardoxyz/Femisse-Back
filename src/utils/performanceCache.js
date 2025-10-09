/**
 * 🚀 Performance Cache Utility
 * 
 * Sistema de cache de alta performance com:
 * - Suporte a Redis e memória
 * - Invalidação inteligente
 * - Compressão automática
 * - Métricas de performance
 * - TTL configurável
 */

import { createClient } from 'redis';
import { secureLogger } from './secureLogger.js';
import { sanitizeObject } from './inputSanitizer.js';

const isDevelopment = process.env.NODE_ENV === 'development';

// Configuração do Redis
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const CACHE_PREFIX = 'feminisse:';

// Cache em memória (fallback)
const memoryCache = new Map();
const cacheStats = {
  hits: 0,
  misses: 0,
  sets: 0,
  deletes: 0,
  errors: 0,
};

/**
 * Cliente Redis (singleton)
 */
let redisClient = null;
let isRedisConnected = false;

async function getRedisClient() {
  if (redisClient && isRedisConnected) {
    return redisClient;
  }
  
  try {
    redisClient = createClient({
      url: REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            secureLogger.error('Redis reconnection failed after 10 attempts');
            return new Error('Redis reconnection failed');
          }
          return Math.min(retries * 100, 3000);
        },
      },
    });
    
    redisClient.on('error', (err) => {
      secureLogger.error('Redis error', err);
      isRedisConnected = false;
      cacheStats.errors++;
    });
    
    redisClient.on('connect', () => {
      secureLogger.info('Redis connected');
      isRedisConnected = true;
    });
    
    redisClient.on('disconnect', () => {
      secureLogger.warn('Redis disconnected');
      isRedisConnected = false;
    });
    
    await redisClient.connect();
    
    return redisClient;
  } catch (error) {
    secureLogger.warn('Redis not available, using memory cache', { error: error.message });
    isRedisConnected = false;
    return null;
  }
}

/**
 * Gera chave de cache
 */
function generateCacheKey(key) {
  return `${CACHE_PREFIX}${key}`;
}

/**
 * Serializa valor para cache
 */
function serializeValue(value) {
  try {
    return JSON.stringify(sanitizeObject(value));
  } catch (error) {
    secureLogger.error('Cache serialization error', error);
    return null;
  }
}

/**
 * Deserializa valor do cache
 */
function deserializeValue(value) {
  try {
    return JSON.parse(value);
  } catch (error) {
    secureLogger.error('Cache deserialization error', error);
    return null;
  }
}

/**
 * Classe de Cache de Performance
 */
class PerformanceCache {
  /**
   * Obtém valor do cache
   */
  async get(key) {
    const cacheKey = generateCacheKey(key);
    
    try {
      // Tenta Redis primeiro
      if (isRedisConnected) {
        const client = await getRedisClient();
        if (client) {
          const value = await client.get(cacheKey);
          
          if (value) {
            cacheStats.hits++;
            return deserializeValue(value);
          }
        }
      }
      
      // Fallback para memória
      if (memoryCache.has(cacheKey)) {
        const cached = memoryCache.get(cacheKey);
        
        // Verifica expiração
        if (cached.expiresAt && Date.now() > cached.expiresAt) {
          memoryCache.delete(cacheKey);
          cacheStats.misses++;
          return null;
        }
        
        cacheStats.hits++;
        return cached.value;
      }
      
      cacheStats.misses++;
      return null;
    } catch (error) {
      secureLogger.error('Cache get error', error, { key });
      cacheStats.errors++;
      return null;
    }
  }

  /**
   * Define valor no cache
   */
  async set(key, value, ttl = 300) {
    const cacheKey = generateCacheKey(key);
    const serialized = serializeValue(value);
    
    if (!serialized) return false;
    
    try {
      // Tenta Redis primeiro
      if (isRedisConnected) {
        const client = await getRedisClient();
        if (client) {
          await client.setEx(cacheKey, ttl, serialized);
          cacheStats.sets++;
          return true;
        }
      }
      
      // Fallback para memória
      memoryCache.set(cacheKey, {
        value,
        expiresAt: Date.now() + (ttl * 1000),
      });
      
      cacheStats.sets++;
      return true;
    } catch (error) {
      secureLogger.error('Cache set error', error, { key });
      cacheStats.errors++;
      return false;
    }
  }

  /**
   * Remove valor do cache
   */
  async delete(key) {
    const cacheKey = generateCacheKey(key);
    
    try {
      // Remove do Redis
      if (isRedisConnected) {
        const client = await getRedisClient();
        if (client) {
          await client.del(cacheKey);
        }
      }
      
      // Remove da memória
      memoryCache.delete(cacheKey);
      
      cacheStats.deletes++;
      return true;
    } catch (error) {
      secureLogger.error('Cache delete error', error, { key });
      cacheStats.errors++;
      return false;
    }
  }

  /**
   * Remove múltiplas chaves
   */
  async deleteMany(keys) {
    const promises = keys.map(key => this.delete(key));
    await Promise.all(promises);
  }

  /**
   * Remove chaves por padrão
   */
  async deletePattern(pattern) {
    try {
      if (isRedisConnected) {
        const client = await getRedisClient();
        if (client) {
          const keys = await client.keys(`${CACHE_PREFIX}${pattern}`);
          if (keys.length > 0) {
            await client.del(keys);
            cacheStats.deletes += keys.length;
          }
        }
      }
      
      // Remove da memória
      const memoryKeys = Array.from(memoryCache.keys());
      const matchingKeys = memoryKeys.filter(key => 
        key.includes(pattern)
      );
      matchingKeys.forEach(key => memoryCache.delete(key));
      
      return true;
    } catch (error) {
      secureLogger.error('Cache delete pattern error', error, { pattern });
      cacheStats.errors++;
      return false;
    }
  }

  /**
   * Limpa todo o cache
   */
  async clear() {
    try {
      if (isRedisConnected) {
        const client = await getRedisClient();
        if (client) {
          const keys = await client.keys(`${CACHE_PREFIX}*`);
          if (keys.length > 0) {
            await client.del(keys);
          }
        }
      }
      
      memoryCache.clear();
      
      secureLogger.info('Cache cleared');
      return true;
    } catch (error) {
      secureLogger.error('Cache clear error', error);
      cacheStats.errors++;
      return false;
    }
  }

  /**
   * Obtém estatísticas do cache
   */
  getStats() {
    const hitRate = cacheStats.hits + cacheStats.misses > 0
      ? (cacheStats.hits / (cacheStats.hits + cacheStats.misses) * 100).toFixed(2)
      : 0;
    
    return {
      ...cacheStats,
      hitRate: `${hitRate}%`,
      memoryCacheSize: memoryCache.size,
      redisConnected: isRedisConnected,
    };
  }

  /**
   * Reseta estatísticas
   */
  resetStats() {
    cacheStats.hits = 0;
    cacheStats.misses = 0;
    cacheStats.sets = 0;
    cacheStats.deletes = 0;
    cacheStats.errors = 0;
  }

  /**
   * Wrapper para funções com cache automático
   */
  async wrap(key, fn, ttl = 300) {
    // Tenta obter do cache
    const cached = await this.get(key);
    if (cached !== null) {
      return cached;
    }
    
    // Executa função e cacheia resultado
    const result = await fn();
    await this.set(key, result, ttl);
    
    return result;
  }
}

// Exporta instância singleton
export const performanceCache = new PerformanceCache();

/**
 * Middleware de cache HTTP
 */
export function cacheMiddleware(options = {}) {
  const {
    ttl = 300,
    keyGenerator = (req) => `http:${req.method}:${req.originalUrl}`,
    condition = () => true,
  } = options;
  
  return async (req, res, next) => {
    // Apenas cacheia GET requests
    if (req.method !== 'GET') {
      return next();
    }
    
    // Verifica condição
    if (!condition(req)) {
      return next();
    }
    
    const cacheKey = keyGenerator(req);
    
    try {
      // Tenta obter do cache
      const cached = await performanceCache.get(cacheKey);
      
      if (cached) {
        res.set('X-Cache', 'HIT');
        return res.json(cached);
      }
      
      // Intercepta a resposta
      const originalJson = res.json.bind(res);
      
      res.json = (data) => {
        // Cacheia a resposta
        performanceCache.set(cacheKey, data, ttl).catch(err => {
          secureLogger.error('Cache middleware set error', err);
        });
        
        res.set('X-Cache', 'MISS');
        return originalJson(data);
      };
      
      next();
    } catch (error) {
      secureLogger.error('Cache middleware error', error);
      next();
    }
  };
}

/**
 * Limpa cache em memória periodicamente
 */
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [key, value] of memoryCache.entries()) {
    if (value.expiresAt && now > value.expiresAt) {
      memoryCache.delete(key);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    secureLogger.debug('Memory cache cleaned', { cleaned });
  }
}, 60000); // A cada minuto

export default performanceCache;
