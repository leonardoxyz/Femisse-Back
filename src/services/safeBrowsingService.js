import { logger } from '../utils/logger.js';
import { env } from '../config/validateEnv.js';

const SAFE_BROWSING_ENDPOINT = 'https://safebrowsing.googleapis.com/v4/threatMatches:find';
const SAFE_BROWSING_TIMEOUT_MS = 5000;

const DEFAULT_CLIENT = {
  clientId: 'femisse-backend',
  clientVersion: '1.0.0',
};

const DEFAULT_THREAT_TYPES = [
  'MALWARE',
  'SOCIAL_ENGINEERING',
  'UNWANTED_SOFTWARE',
  'POTENTIALLY_HARMFUL_APPLICATION',
];

const DEFAULT_PLATFORM_TYPES = ['ANY_PLATFORM'];
const DEFAULT_ENTRY_TYPES = ['URL'];

export async function checkSafeBrowsingStatus(urls = ['https://femisse.com.br/']) {
  if (!env.SAFE_BROWSING_API_KEY) {
    logger.warn('SAFE_BROWSING_API_KEY not configured; skipping Safe Browsing check.');
    return { safe: true, checkedAt: new Date().toISOString(), matches: [] };
  }

  const threatEntries = urls
    .filter(Boolean)
    .map((url) => ({ url: String(url).trim() }))
    .filter((entry) => entry.url.length > 0);

  if (threatEntries.length === 0) {
    return { safe: true, checkedAt: new Date().toISOString(), matches: [] };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SAFE_BROWSING_TIMEOUT_MS);

  try {
    const response = await fetch(`${SAFE_BROWSING_ENDPOINT}?key=${env.SAFE_BROWSING_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client: DEFAULT_CLIENT,
        threatInfo: {
          threatTypes: DEFAULT_THREAT_TYPES,
          platformTypes: DEFAULT_PLATFORM_TYPES,
          threatEntryTypes: DEFAULT_ENTRY_TYPES,
          threatEntries,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = new Error(`Safe Browsing request failed with status ${response.status}`);
      error.status = response.status;
      throw error;
    }

    const payload = await response.json();
    const matches = Array.isArray(payload?.matches) ? payload.matches : [];

    return {
      safe: matches.length === 0,
      checkedAt: new Date().toISOString(),
      matches,
    };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      logger.error('Safe Browsing check timed out');
      return {
        safe: false,
        checkedAt: new Date().toISOString(),
        error: 'Safe Browsing request timed out',
        matches: [],
      };
    }

    logger.error({ err: error }, 'Safe Browsing check failed');
    return {
      safe: false,
      checkedAt: new Date().toISOString(),
      error: error.message,
      status: error.status,
      matches: [],
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export default {
  checkSafeBrowsingStatus,
};
