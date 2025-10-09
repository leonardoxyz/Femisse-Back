/**
 * 🛡️ Advanced Rate Limiting Utility
 * 
 * Sistema de rate limiting avançado com:
 * - Múltiplas estratégias (sliding window, token bucket)
 * - Rate limiting por IP, usuário, endpoint
 * - Whitelist/Blacklist
 * - Detecção de abuso
 * - Métricas em tempo real
 */

import { performanceCache } from './performanceCache.js';
import { secureLogger } from './secureLogger.js';

// Configurações padrão
const DEFAULT_CONFIG = {
  windowMs: 15 * 60 * 1000, // 15 minutos
  maxRequests: 100,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  keyGenerator: (req) => req.ip,
};

// IPs na whitelist (não sofrem rate limiting)
const WHITELIST = new Set([
  '127.0.0.1',
  '::1',
  'localhost',
]);

// IPs na blacklist (bloqueados permanentemente)
const BLACKLIST = new Set();

// Métricas de rate limiting
const metrics = {
  totalRequests: 0,
  blockedRequests: 0,
  whitelistedRequests: 0,
  blacklistedRequests: 0,
};

/**
 * Adiciona IP à whitelist
 */
export function addToWhitelist(ip) {
  WHITELIST.add(ip);
  secureLogger.security('IP added to whitelist', { ip });
}

/**
 * Remove IP da whitelist
 */
export function removeFromWhitelist(ip) {
  WHITELIST.delete(ip);
  secureLogger.security('IP removed from whitelist', { ip });
}

/**
 * Adiciona IP à blacklist
 */
export function addToBlacklist(ip, reason = 'Manual') {
  BLACKLIST.add(ip);
  secureLogger.security('IP added to blacklist', { ip, reason });
}

/**
 * Remove IP da blacklist
 */
export function removeFromBlacklist(ip) {
  BLACKLIST.delete(ip);
  secureLogger.security('IP removed from blacklist', { ip });
}

/**
 * Verifica se IP está na whitelist
 */
function isWhitelisted(ip) {
  return WHITELIST.has(ip);
}

/**
 * Verifica se IP está na blacklist
 */
function isBlacklisted(ip) {
  return BLACKLIST.has(ip);
}

/**
 * Gera chave de rate limit
 */
function generateKey(prefix, identifier) {
  return `ratelimit:${prefix}:${identifier}`;
}

/**
 * Sliding Window Rate Limiter
 */
class SlidingWindowLimiter {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async check(identifier) {
    const key = generateKey('sliding', identifier);
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    
    // Obtém dados do cache
    let data = await performanceCache.get(key) || { requests: [] };
    
    // Remove requisições fora da janela
    data.requests = data.requests.filter(timestamp => timestamp > windowStart);
    
    // Verifica limite
    if (data.requests.length >= this.config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: data.requests[0] + this.config.windowMs,
      };
    }
    
    // Adiciona nova requisição
    data.requests.push(now);
    
    // Salva no cache
    await performanceCache.set(key, data, Math.ceil(this.config.windowMs / 1000));
    
    return {
      allowed: true,
      remaining: this.config.maxRequests - data.requests.length,
      resetAt: now + this.config.windowMs,
    };
  }

  async reset(identifier) {
    const key = generateKey('sliding', identifier);
    await performanceCache.delete(key);
  }
}

/**
 * Token Bucket Rate Limiter
 */
class TokenBucketLimiter {
  constructor(config = {}) {
    this.config = {
      capacity: config.maxRequests || 100,
      refillRate: config.refillRate || 10, // tokens por segundo
      refillInterval: 1000, // 1 segundo
      ...config,
    };
  }

  async check(identifier) {
    const key = generateKey('bucket', identifier);
    const now = Date.now();
    
    // Obtém dados do cache
    let bucket = await performanceCache.get(key) || {
      tokens: this.config.capacity,
      lastRefill: now,
    };
    
    // Calcula tokens a adicionar
    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor(timePassed / this.config.refillInterval) * this.config.refillRate;
    
    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(this.config.capacity, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }
    
    // Verifica se há tokens disponíveis
    if (bucket.tokens < 1) {
      await performanceCache.set(key, bucket, 3600); // 1 hora
      
      return {
        allowed: false,
        remaining: 0,
        resetAt: bucket.lastRefill + this.config.refillInterval,
      };
    }
    
    // Consome um token
    bucket.tokens -= 1;
    
    // Salva no cache
    await performanceCache.set(key, bucket, 3600); // 1 hora
    
    return {
      allowed: true,
      remaining: Math.floor(bucket.tokens),
      resetAt: bucket.lastRefill + this.config.refillInterval,
    };
  }

  async reset(identifier) {
    const key = generateKey('bucket', identifier);
    await performanceCache.delete(key);
  }
}

/**
 * Detector de Abuso
 */
class AbuseDetector {
  constructor() {
    this.suspiciousThreshold = 50; // requisições por minuto
    this.abuseThreshold = 100; // requisições por minuto
  }

  async check(ip) {
    const key = generateKey('abuse', ip);
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Obtém histórico
    let history = await performanceCache.get(key) || { requests: [] };
    
    // Remove requisições antigas
    history.requests = history.requests.filter(timestamp => timestamp > oneMinuteAgo);
    
    // Adiciona nova requisição
    history.requests.push(now);
    
    const requestsPerMinute = history.requests.length;
    
    // Detecta abuso
    if (requestsPerMinute > this.abuseThreshold) {
      secureLogger.security('Abuse detected', { 
        ip, 
        requestsPerMinute,
        action: 'auto-blacklist'
      });
      
      addToBlacklist(ip, 'Automatic - Abuse detected');
      
      return { abuse: true, suspicious: true, requestsPerMinute };
    }
    
    // Detecta comportamento suspeito
    if (requestsPerMinute > this.suspiciousThreshold) {
      secureLogger.security('Suspicious activity detected', { 
        ip, 
        requestsPerMinute 
      });
      
      return { abuse: false, suspicious: true, requestsPerMinute };
    }
    
    // Salva histórico
    await performanceCache.set(key, history, 60);
    
    return { abuse: false, suspicious: false, requestsPerMinute };
  }
}

// Instâncias globais
const slidingWindowLimiter = new SlidingWindowLimiter();
const tokenBucketLimiter = new TokenBucketLimiter();
const abuseDetector = new AbuseDetector();

/**
 * Middleware de Rate Limiting Avançado
 */
export function advancedRateLimit(options = {}) {
  const config = { ...DEFAULT_CONFIG, ...options };
  const strategy = options.strategy || 'sliding'; // 'sliding' ou 'bucket'
  
  const limiter = strategy === 'bucket' ? tokenBucketLimiter : slidingWindowLimiter;
  
  return async (req, res, next) => {
    metrics.totalRequests++;
    
    const identifier = config.keyGenerator(req);
    const ip = req.ip;
    
    try {
      // Verifica blacklist
      if (isBlacklisted(ip)) {
        metrics.blacklistedRequests++;
        
        secureLogger.security('Blacklisted IP blocked', { ip, url: req.originalUrl });
        
        return res.status(403).json({
          error: 'Acesso negado',
          message: 'Seu IP foi bloqueado devido a atividade suspeita',
        });
      }
      
      // Verifica whitelist
      if (isWhitelisted(ip)) {
        metrics.whitelistedRequests++;
        return next();
      }
      
      // Detecta abuso
      const abuseCheck = await abuseDetector.check(ip);
      
      if (abuseCheck.abuse) {
        metrics.blockedRequests++;
        
        return res.status(429).json({
          error: 'Muitas requisições',
          message: 'Você foi temporariamente bloqueado devido a atividade suspeita',
        });
      }
      
      // Verifica rate limit
      const result = await limiter.check(identifier);
      
      // Define headers de rate limit
      res.set({
        'X-RateLimit-Limit': config.maxRequests,
        'X-RateLimit-Remaining': result.remaining,
        'X-RateLimit-Reset': new Date(result.resetAt).toISOString(),
      });
      
      if (!result.allowed) {
        metrics.blockedRequests++;
        
        const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
        
        res.set('Retry-After', retryAfter);
        
        secureLogger.warn('Rate limit exceeded', {
          ip,
          identifier,
          url: req.originalUrl,
          retryAfter,
        });
        
        return res.status(429).json({
          error: 'Muitas requisições',
          message: 'Você excedeu o limite de requisições. Tente novamente mais tarde.',
          retryAfter,
        });
      }
      
      // Adiciona informações ao request
      req.rateLimit = result;
      
      next();
    } catch (error) {
      secureLogger.error('Rate limit middleware error', error);
      // Em caso de erro, permite a requisição
      next();
    }
  };
}

/**
 * Obtém métricas de rate limiting
 */
export function getRateLimitMetrics() {
  const blockedRate = metrics.totalRequests > 0
    ? (metrics.blockedRequests / metrics.totalRequests * 100).toFixed(2)
    : 0;
  
  return {
    ...metrics,
    blockedRate: `${blockedRate}%`,
    whitelistSize: WHITELIST.size,
    blacklistSize: BLACKLIST.size,
  };
}

/**
 * Reseta métricas
 */
export function resetRateLimitMetrics() {
  metrics.totalRequests = 0;
  metrics.blockedRequests = 0;
  metrics.whitelistedRequests = 0;
  metrics.blacklistedRequests = 0;
}

export default {
  advancedRateLimit,
  addToWhitelist,
  removeFromWhitelist,
  addToBlacklist,
  removeFromBlacklist,
  getRateLimitMetrics,
  resetRateLimitMetrics,
  SlidingWindowLimiter,
  TokenBucketLimiter,
  AbuseDetector,
};
