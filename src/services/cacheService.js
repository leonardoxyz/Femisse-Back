import { LRUCache } from 'lru-cache';
import { redisClient, isRedisEnabled } from '../config/redisClient.js';
import { logger } from '../utils/logger.js';

/**
 * CACHE VERSION - Incremente quando houver mudanças no formato dos dados em cache
 * Isso invalida automaticamente todo cache antigo
 */
const CACHE_VERSION = 'v2';

const DEFAULT_TTL_SECONDS = 60;
const localCache = new LRUCache({ max: 500, ttl: DEFAULT_TTL_SECONDS * 1000 });
const localSets = new Map();
const CACHE_ENABLED = process.env.ENABLE_CACHE === 'true';

/**
 * Adiciona versão à chave de cache
 * @param {string} key - Chave original
 * @returns {string} Chave versionada
 */
const versionedKey = (key) => `${CACHE_VERSION}:${key}`;

const toArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
};

export const cacheGet = async (key) => {
  if (!CACHE_ENABLED) return null;
  if (!key) return null;
  const vKey = versionedKey(key);
  if (isRedisEnabled()) {
    const value = await redisClient.get(vKey);
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch (error) {
      logger.warn({ err: error, key }, 'Falha ao fazer parse do cache Redis');
      return null;
    }
  }
  return localCache.get(vKey) ?? null;
};

export const cacheSet = async (key, value, ttlSeconds = DEFAULT_TTL_SECONDS) => {
  if (!CACHE_ENABLED) return;
  if (!key) return;
  const vKey = versionedKey(key);
  if (isRedisEnabled()) {
    const payload = JSON.stringify(value);
    await redisClient.set(vKey, payload, 'EX', ttlSeconds);
    return;
  }
  localCache.set(vKey, value, { ttl: ttlSeconds * 1000 });
};

export const cacheDelete = async (keys) => {
  if (!CACHE_ENABLED) return;
  const entries = toArray(keys);
  if (entries.length === 0) return;
  const vKeys = entries.map(k => versionedKey(k));

  if (isRedisEnabled()) {
    await redisClient.del(...vKeys);
    return;
  }
  vKeys.forEach((key) => localCache.delete(key));
};

export const cacheAddToSet = async (setKey, members) => {
  if (!CACHE_ENABLED) return;
  const values = toArray(members).filter(Boolean);
  if (values.length === 0) return;

  if (isRedisEnabled()) {
    await redisClient.sadd(setKey, values);
    return;
  }

  const set = localSets.get(setKey) ?? new Set();
  values.forEach((member) => set.add(member));
  localSets.set(setKey, set);
};

export const cacheGetSetMembers = async (setKey) => {
  if (!CACHE_ENABLED) return [];
  if (isRedisEnabled()) {
    return redisClient.smembers(setKey);
  }
  return Array.from(localSets.get(setKey) ?? []);
};

export const cacheClearSet = async (setKey) => {
  if (!CACHE_ENABLED) return;
  if (isRedisEnabled()) {
    await redisClient.del(setKey);
    return;
  }
  localSets.delete(setKey);
};

export const cacheFlush = async () => {
  if (!CACHE_ENABLED) return;
  if (isRedisEnabled()) {
    await redisClient.flushdb();
    return;
  }
  localCache.clear();
  localSets.clear();
};
