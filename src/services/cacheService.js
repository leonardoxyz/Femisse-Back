import { LRUCache } from 'lru-cache';
import { redisClient, isRedisEnabled } from '../config/redisClient.js';

const DEFAULT_TTL_SECONDS = 60;
const localCache = new LRUCache({ max: 500, ttl: DEFAULT_TTL_SECONDS * 1000 });
const localSets = new Map();

const toArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
};

export const cacheGet = async (key) => {
  if (!key) return null;
  if (isRedisEnabled()) {
    const value = await redisClient.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch (error) {
      console.warn(`⚠️ Falha ao fazer parse do cache Redis para a chave ${key}:`, error);
      return null;
    }
  }
  return localCache.get(key) ?? null;
};

export const cacheSet = async (key, value, ttlSeconds = DEFAULT_TTL_SECONDS) => {
  if (!key) return;
  if (isRedisEnabled()) {
    const payload = JSON.stringify(value);
    await redisClient.set(key, payload, 'EX', ttlSeconds);
    return;
  }
  localCache.set(key, value, { ttl: ttlSeconds * 1000 });
};

export const cacheDelete = async (keys) => {
  const entries = toArray(keys);
  if (entries.length === 0) return;

  if (isRedisEnabled()) {
    await redisClient.del(entries);
    return;
  }
  entries.forEach((key) => localCache.delete(key));
};

export const cacheAddToSet = async (setKey, members) => {
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
  if (isRedisEnabled()) {
    return redisClient.smembers(setKey);
  }
  return Array.from(localSets.get(setKey) ?? []);
};

export const cacheClearSet = async (setKey) => {
  if (isRedisEnabled()) {
    await redisClient.del(setKey);
    return;
  }
  localSets.delete(setKey);
};

export const cacheFlush = async () => {
  if (isRedisEnabled()) {
    await redisClient.flushdb();
    return;
  }
  localCache.clear();
  localSets.clear();
};
