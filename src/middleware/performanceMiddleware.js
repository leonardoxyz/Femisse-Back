import compression from 'compression';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';

// Cache em memória simples (para produção, usar Redis)
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Middleware de compressão
export const compressionMiddleware = compression({
  level: 6, // Nível de compressão (1-9)
  threshold: 1024, // Comprimir apenas responses > 1KB
  filter: (req, res) => {
    // Não comprimir se o cliente não suporta
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Usar filtro padrão do compression
    return compression.filter(req, res);
  }
});

// Middleware de cache para responses
export const cacheMiddleware = (ttl = CACHE_TTL) => {
  return (req, res, next) => {
    // Apenas cachear GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Criar chave do cache baseada na URL e query params
    const cacheKey = `${req.originalUrl}${JSON.stringify(req.query)}`;
    
    // Verificar se existe no cache
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < ttl) {
      logger.debug({ cacheKey }, 'Cache hit');
      return res.json(cached.data);
    }

    // Interceptar res.json para cachear a response
    const originalJson = res.json;
    res.json = function(data) {
      // Cachear apenas responses de sucesso
      if (res.statusCode === 200) {
        cache.set(cacheKey, {
          data,
          timestamp: Date.now()
        });
        
        // Limpar cache antigo
        cleanExpiredCache();
      }
      
      return originalJson.call(this, data);
    };

    next();
  };
};

// Limpar entradas expiradas do cache
function cleanExpiredCache() {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      cache.delete(key);
    }
  }
}

// Middleware para adicionar headers de performance
export const performanceHeaders = (req, res, next) => {
  const startTime = Date.now();
  
  // Headers de cache para recursos estáticos
  if (req.url.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
    res.set({
      'Cache-Control': 'public, max-age=31536000', // 1 ano
      'Expires': new Date(Date.now() + 31536000000).toUTCString()
    });
  }
  
  // Headers de performance
  res.set({
    'X-Response-Time': `${Date.now() - startTime}ms`,
    'X-Powered-By': 'Femisse API',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block'
  });

  // Interceptar o fim da response para calcular tempo
  const originalEnd = res.end;
  res.end = function(...args) {
    res.set('X-Response-Time', `${Date.now() - startTime}ms`);
    return originalEnd.apply(this, args);
  };

  next();
};

// Middleware para logging de performance
export const performanceLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Log da request
  logger.info({ method: req.method, url: req.originalUrl, ip: req.ip }, 'HTTP Request');
  
  // Interceptar o fim da response
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = Date.now() - startTime;
    const status = res.statusCode;
    
    // Log colorido baseado no status e tempo
    let logColor = '✅'; // Success
    if (status >= 400) logColor = '❌'; // Error
    else if (status >= 300) logColor = '⚠️'; // Redirect
    else if (duration > 1000) logColor = '🐌'; // Slow
    else if (duration > 500) logColor = '⏳'; // Medium
    
    logger.info({ method: req.method, url: req.originalUrl, status, duration: `${duration}ms` }, 'HTTP Response');
    
    // Alertar para requests muito lentas
    if (duration > 2000) {
      logger.warn({ method: req.method, url: req.originalUrl, duration: `${duration}ms` }, 'Slow request detected');
    }
    
    return originalEnd.apply(this, args);
  };

  next();
};

// Middleware para batch de queries do Supabase
export const batchQueryMiddleware = () => {
  const batches = new Map();
  const BATCH_DELAY = 50; // 50ms

  return (req, res, next) => {
    // Adicionar função de batch ao req
    req.batchQuery = (table, query) => {
      return new Promise((resolve, reject) => {
        const batchKey = table;
        
        if (!batches.has(batchKey)) {
          batches.set(batchKey, {
            queries: [],
            timeout: setTimeout(() => executeBatch(batchKey), BATCH_DELAY)
          });
        }
        
        const batch = batches.get(batchKey);
        batch.queries.push({ query, resolve, reject });
      });
    };

    next();
  };

  async function executeBatch(batchKey) {
    const batch = batches.get(batchKey);
    if (!batch) return;
    
    batches.delete(batchKey);
    clearTimeout(batch.timeout);
    
    try {
      // Executar todas as queries em paralelo
      const results = await Promise.all(
        batch.queries.map(({ query }) => query)
      );
      
      // Resolver todas as promises
      batch.queries.forEach(({ resolve }, index) => {
        resolve(results[index]);
      });
    } catch (error) {
      // Rejeitar todas as promises
      batch.queries.forEach(({ reject }) => {
        reject(error);
      });
    }
  }
};

// Middleware para otimização de imagens
export const imageOptimizationMiddleware = (req, res, next) => {
  // Verificar se é uma request de imagem
  if (!req.url.includes('/storage/') || !req.query.width && !req.query.height) {
    return next();
  }

  const { width, height, quality = 85, format = 'webp' } = req.query;
  
  // Adicionar headers de otimização
  res.set({
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Vary': 'Accept',
    'X-Image-Optimized': 'true'
  });

  // Se o cliente suporta WebP, usar WebP
  const acceptsWebP = req.headers.accept?.includes('image/webp');
  if (acceptsWebP && !format) {
    req.query.format = 'webp';
  }

  next();
};

// Estatísticas de performance
export const performanceStats = {
  requests: 0,
  totalTime: 0,
  slowRequests: 0,
  cacheHits: 0,
  
  getStats() {
    return {
      totalRequests: this.requests,
      averageTime: this.requests > 0 ? this.totalTime / this.requests : 0,
      slowRequestsPercentage: this.requests > 0 ? (this.slowRequests / this.requests) * 100 : 0,
      cacheHitRate: this.requests > 0 ? (this.cacheHits / this.requests) * 100 : 0
    };
  },
  
  reset() {
    this.requests = 0;
    this.totalTime = 0;
    this.slowRequests = 0;
    this.cacheHits = 0;
  }
};

// Middleware para coletar estatísticas
export const statsCollector = (req, res, next) => {
  const startTime = Date.now();
  performanceStats.requests++;
  
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = Date.now() - startTime;
    performanceStats.totalTime += duration;
    
    if (duration > 1000) {
      performanceStats.slowRequests++;
    }
    
    return originalEnd.apply(this, args);
  };

  next();
};

export default {
  compressionMiddleware,
  cacheMiddleware,
  performanceHeaders,
  performanceLogger,
  batchQueryMiddleware,
  imageOptimizationMiddleware,
  performanceStats,
  statsCollector
};
