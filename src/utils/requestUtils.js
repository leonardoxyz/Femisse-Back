/**
 * Utilitários relacionados à requisição HTTP.
 * Foca em extrair dados confiáveis quando a aplicação está atrás do Cloudflare/Vercel.
 */

/**
 * Obtém o IP real do cliente considerando cabeçalhos do Cloudflare.
 * Prioridade:
 * 1. CF-Connecting-IP (Cloudflare)
 * 2. True-Client-IP (fallback)
 * 3. X-Forwarded-For (primeiro da lista)
 * 4. req.ip (Express)
 *
 * @param {import('express').Request} req
 * @returns {string} IP do cliente normalizado
 */
export function getClientIp(req) {
  const cfConnectingIp = req.headers['cf-connecting-ip'];
  if (cfConnectingIp && typeof cfConnectingIp === 'string') {
    return cfConnectingIp;
  }

  const trueClientIp = req.headers['true-client-ip'];
  if (trueClientIp && typeof trueClientIp === 'string') {
    return trueClientIp;
  }

  const xForwardedFor = req.headers['x-forwarded-for'];
  if (typeof xForwardedFor === 'string' && xForwardedFor.length > 0) {
    return xForwardedFor.split(',')[0].trim();
  }

  if (Array.isArray(xForwardedFor)) {
    return xForwardedFor[0];
  }

  if (req?.ip) {
    return req.ip.replace('::ffff:', '');
  }

  if (req?.connection?.remoteAddress) {
    return req.connection.remoteAddress.replace('::ffff:', '');
  }

  return '0.0.0.0';
}

/**
 * Retorna metadados Cloudflare relevantes para logging/segurança.
 * @param {import('express').Request} req
 * @returns {{ ip: string, cfRay?: string, country?: string, dataCenter?: string }}
 */
export function getCloudflareMeta(req) {
  return {
    ip: getClientIp(req),
    cfRay: req.headers['cf-ray'],
    country: req.headers['cf-ipcountry'],
    dataCenter: req.headers['cf-ray']?.split('-')[1],
  };
}

export default {
  getClientIp,
  getCloudflareMeta,
};
