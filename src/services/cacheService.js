import { LRUCache } from 'lru-cache';

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
  return localCache.get(vKey) ?? null;
};

export const cacheSet = async (key, value, ttlSeconds = DEFAULT_TTL_SECONDS) => {
  if (!CACHE_ENABLED) return;
  if (!key) return;
  const vKey = versionedKey(key);
  localCache.set(vKey, value, { ttl: ttlSeconds * 1000 });
};

export const cacheDelete = async (keys) => {
  if (!CACHE_ENABLED) return;
  const entries = toArray(keys);
  if (entries.length === 0) return;
  const vKeys = entries.map(k => versionedKey(k));
  vKeys.forEach((key) => localCache.delete(key));
};

export const cacheAddToSet = async (setKey, members) => {
  if (!CACHE_ENABLED) return;
  const values = toArray(members).filter(Boolean);
  if (values.length === 0) return;

  const set = localSets.get(setKey) ?? new Set();
  values.forEach((member) => set.add(member));
  localSets.set(setKey, set);
};

export const cacheGetSetMembers = async (setKey) => {
  if (!CACHE_ENABLED) return [];
  return Array.from(localSets.get(setKey) ?? []);
};

export const cacheClearSet = async (setKey) => {
  if (!CACHE_ENABLED) return;
  localSets.delete(setKey);
};

export const cacheFlush = async () => {
  if (!CACHE_ENABLED) return;
  localCache.clear();
  localSets.clear();
};
