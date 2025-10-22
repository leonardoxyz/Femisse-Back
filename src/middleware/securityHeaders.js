/**
 * 🔒 Security Headers & HTTPS Enforcement Middleware
 * 
 * Implementa:
 * - Forçar HTTPS (redirect HTTP → HTTPS)
 * - Security headers (HSTS, CSP, X-Frame-Options, etc.)
 * - Proteção contra clickjacking, XSS, MIME sniffing
 */
import logger from '../utils/logger.js';

/**
 * Middleware para forçar HTTPS em produção
 */
function forceHTTPS(req, res, next) {
  // Ignora em desenvolvimento
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  // Verifica se a requisição já é HTTPS
  const isHTTPS = 
    req.secure || 
    req.headers['x-forwarded-proto'] === 'https' ||
    req.headers['x-forwarded-ssl'] === 'on';

  if (!isHTTPS) {
    // Log de tentativa HTTP em produção
    logger.warn('Tentativa de acesso HTTP em produção', {
      url: req.url,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    // Redirect permanente para HTTPS
    const httpsUrl = `https://${req.hostname}${req.url}`;
    return res.redirect(301, httpsUrl);
  }

  next();
}

/**
 * Middleware para adicionar security headers
 */
function securityHeaders(req, res, next) {
  // HTTP Strict Transport Security (HSTS)
  // Force HTTPS por 1 ano, incluindo subdomínios
  res.setHeader(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );

  // Content Security Policy (CSP)
  // Previne XSS e injeção de conteúdo malicioso
  const csp = [
    "default-src 'self'",
    "script-src 'self' https://sdk.mercadopago.com https://challenges.cloudflare.com",
    "style-src 'self' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://api.mercadopago.com https://*.supabase.co wss://*.supabase.co",
    "frame-src 'self' https://challenges.cloudflare.com https://www.mercadopago.com.br",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
  ].join('; ');
  
  res.setHeader('Content-Security-Policy', csp);

  // X-Content-Type-Options
  // Previne MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // X-Frame-Options
  // Previne clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // X-XSS-Protection
  // Habilita proteção XSS do navegador
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer-Policy
  // Controla informações enviadas no header Referer
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions-Policy
  // Controla recursos do navegador
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=(self)'
  );

  // X-Permitted-Cross-Domain-Policies
  // Previne Adobe Flash/PDF de carregar conteúdo
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

  // Remove header X-Powered-By (oculta tecnologia do servidor)
  res.removeHeader('X-Powered-By');

  next();
}

/**
 * Middleware combinado de segurança
 */
function applySecurity() {
  return [
    forceHTTPS,
    securityHeaders
  ];
}

export {
  forceHTTPS,
  securityHeaders,
  applySecurity
};
