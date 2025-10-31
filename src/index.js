import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env, isDevelopment, isProduction } from './config/validateEnv.js';
import { logger, httpLogger } from './utils/logger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import {
  compressionMiddleware,
  performanceHeaders,
  performanceLogger,
  cacheMiddleware,
  statsCollector,
} from './middleware/performanceMiddleware.js';
import {
  generalRateLimit,
  sanitizeInput,
  securityLogger,
} from './middleware/validationMiddleware.js';
import { applySecurity } from './middleware/securityHeaders.js';

// Importar rotas
import addressRoutes from './routes/addressRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import productRoutes from './routes/products.js';
import popularRoutes from './routes/popular.js';
import bannerImagesRoutes from './routes/bannerImages.js';
import momentProductsRoutes from './routes/momentProducts.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import favoriteRoutes from './routes/favoriteRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import statsRoutes from './routes/stats.js';
import paymentRoutes from './routes/paymentRoutes.js';
import couponRoutes from './routes/couponRoutes.js';
import shippingRoutes from './routes/shippingRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';
import testimonialRoutes from './routes/testimonialRoutes.js';
import securityRoutes from './routes/securityRoutes.js';

const app = express();
const PORT = env.PORT || 4000;

// Log de inicialização
logger.info({
  env: env.NODE_ENV,
  port: PORT,
  corsOrigins: env.CORS_ORIGINS,
}, 'Iniciando servidor');

// ============================================
// MIDDLEWARES DE PERFORMANCE (aplicar primeiro)
// ============================================
app.use(compressionMiddleware);
app.use(performanceHeaders);
app.use(performanceLogger);
app.use(statsCollector);

// ============================================
// MIDDLEWARES DE SEGURANÇA
// ============================================
// ✅ HTTPS Forçado e Security Headers consolidados
app.use(...applySecurity());
app.use(sanitizeInput);
app.use(securityLogger);

// Rate limit geral (exceto rotas de consulta de status)
app.use((req, res, next) => {
  // Rotas que NÃO devem ter rate limit
  const excludedPaths = [
    /^\/api\/payments\/status\/.+$/,  // Status de pagamento
    /^\/api\/payments\/webhook$/,      // Webhook do MP
    /^\/api\/webhooks\/.+$/,           // Webhooks (MelhorEnvio, etc)
    /^\/api\/health$/,                 // Health check
    /^\/api\/users\/profile$/,         // ✅ Perfil do usuário (GET frequente)
  ];

  // Verifica se a rota atual está na lista de exclusão
  const isExcluded = excludedPaths.some(pattern => pattern.test(req.path));
  
  if (isExcluded) {
    return next(); // Pula o rate limit
  }
  
  // Aplica rate limit para outras rotas
  generalRateLimit(req, res, next);
});

// ============================================
// CORS CONFIGURAÇÃO
// ============================================
const CORS_ORIGINS = env.CORS_ORIGINS 
  ? env.CORS_ORIGINS.split(',').map(o => o.trim())
  : [env.FRONTEND_URL];

const isAllowedOrigin = (origin) => {
  return CORS_ORIGINS.some((allowedOrigin) => {
    if (allowedOrigin === origin) return true;
    if (allowedOrigin.includes('*')) {
      const regex = new RegExp(`^${allowedOrigin.replace(/\./g, '\\.').replace(/\*/g, '.*')}$`);
      return regex.test(origin);
    }
    return false;
  });
};

app.use(
  cors({
    origin: function (origin, callback) {
      // Permite requests sem origin (ex: curl, Postman)
      if (!origin) return callback(null, true);

      // Em desenvolvimento, permite localhost
      if (isDevelopment && origin.includes('localhost')) {
        return callback(null, true);
      }

      // Verifica lista de origens permitidas
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }

      // Em produção, permite qualquer subdomínio da Vercel
      if (isProduction && origin.endsWith('.vercel.app')) {
        return callback(null, true);
      }

      logger.warn({ origin }, 'CORS blocked origin');
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true, // Importante para cookies
    exposedHeaders: ['set-cookie'], // Expõe header de cookies
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'], // Headers permitidos
  })
);

// ============================================
// PARSERS
// ============================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser()); // Para ler cookies

// ============================================
// LOGGING HTTP
// ============================================
app.use(httpLogger);

// ============================================
// HEALTH CHECK
// ============================================
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'API is running',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    version: '2.0.0',
  });
});

// ============================================
// ROTA RAIZ
// ============================================
app.get('/', (req, res) => {
  res.json({
    message: 'Femisse API v2.0',
    status: 'online',
    docs: '/api/docs',
  });
});

// ============================================
// ROTAS DA API
// ============================================
app.use('/api/auth', authRoutes);
app.use('/api/address', addressRoutes);
app.use('/api/products', productRoutes);
app.use('/api/popular', popularRoutes);
app.use('/api/moment-products', momentProductsRoutes);
app.use('/api/banner-images', bannerImagesRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/shipping', shippingRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/testimonials', testimonialRoutes);
app.use('/api/security', securityRoutes);

// ============================================
// TRATAMENTO DE ERROS
// ============================================
// 404 para rotas de API não encontradas
app.use('/api/*', notFoundHandler);

// Middleware global de erro (DEVE SER O ÚLTIMO)
app.use(errorHandler);

// ============================================
// INICIAR SERVIDOR (apenas em modo não-serverless)
// ============================================
// Vercel usa serverless, então não precisa de app.listen()
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    logger.info({
      port: PORT,
      env: env.NODE_ENV,
      corsOrigins: CORS_ORIGINS,
    }, 'Servidor iniciado com sucesso');

    console.log(`
╔════════════════════════════════════════╗
║   🚀 Femisse API v2.0                  ║
║   📍 Porta: ${PORT}                    ║
║   🌍 Ambiente: ${env.NODE_ENV.toUpperCase().padEnd(20)}║
║   🔒 Segurança: Ativada                ║
║   🍪 Cookies: httpOnly                 ║
╚════════════════════════════════════════╝
    `);
  });

  // Tratamento de erros não capturados
  process.on('unhandledRejection', (reason, promise) => {
    logger.error({ reason, promise }, 'Unhandled Rejection');
  });

  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'Uncaught Exception');
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    process.exit(0);
  });
} else {
  logger.info('Running in Vercel serverless mode');
}

// Exportar app para Vercel
export default app;
