import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
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
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';

// Importa configuração de ambiente
import { CORS_ORIGINS, isDevelopment, isProduction, PORT } from './config/environment.js';

// Configura variáveis de ambiente
dotenv.config();

const app = express();

// Configuração CORS baseada no ambiente
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // Permite requests sem origin (ex: curl, Postman)
    
    // Em desenvolvimento, permite localhost
    if (isDevelopment && origin.includes('localhost')) {
      return callback(null, true);
    }
    
    // Permite origens específicas
    if (CORS_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    
    // Em produção, permite qualquer subdomínio da Vercel
    if (isProduction && origin.includes('.vercel.app')) {
      return callback(null, true);
    }
    
    console.log('❌ CORS blocked origin:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json());

const logger = pinoHttp({
  level: isDevelopment ? 'debug' : 'info',
});

app.use(logger);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: isProduction ? 500 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Muitas requisições. Tente novamente em alguns minutos.',
  },
});

app.use('/api/', apiLimiter);

// Inicializa Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);


app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      frameSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  })
);

// Rota de health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Rota raiz
app.get('/', (req, res) => {
  res.json({ message: 'Feminisse API - Backend funcionando!' });
});

// Rotas da API (todas ANTES do express.static)
app.use('/api/address', addressRoutes);
app.use('/api/products', productRoutes);
app.use('/api/popular', popularRoutes);
app.use('/api/banner-images', bannerImagesRoutes);
app.use('/api/moment-products', momentProductsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/users/me', favoriteRoutes); // Rotas de usuário (favoritos)
app.use('/api/orders', reviewRoutes);
app.use('/api/orders', orderRoutes);

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Rota 404 para APIs
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Na Vercel, servir apenas a API (frontend é projeto separado)
console.log('Environment:', process.env.NODE_ENV);
console.log('Vercel:', process.env.VERCEL);
console.log('Rodando apenas como API backend');

// Handler final para rotas não encontradas
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📍 Ambiente: ${isDevelopment ? 'DESENVOLVIMENTO' : 'PRODUÇÃO'}`);
  console.log(`🌐 CORS permitido para: ${CORS_ORIGINS.join(', ')}`);
});
