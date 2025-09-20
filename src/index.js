import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import addressRoutes from './routes/addressRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import productRoutes from './routes/products.js';
import popularRoutes from './routes/popular.js';
import bannerImagesRoutes from './routes/bannerImages.js';
import momentProductsRoutes from './routes/momentProducts.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import favoriteRoutes from './routes/favoriteRoutes.js';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';

// Configura variáveis de ambiente
dotenv.config();

const app = express();
// Configuração CORS restritiva
const allowedOrigins = [
  'http://localhost:8080', // Vite dev
  'http://localhost:5173', // Vite dev (porta padrão)
  'https://femisse.com', // Seu domínio de produção
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // Permite requests sem origin (ex: curl)
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json());

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

// Rotas da API (todas ANTES do express.static)
app.use('/api/address', addressRoutes);
app.use('/api/products', productRoutes);
app.use('/api/popular', popularRoutes);
app.use('/api/banner-images', bannerImagesRoutes);
app.use('/api/moment-products', momentProductsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/users/me/favorites', favoriteRoutes);

// Servir build do frontend (Vite) em produção
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const viteBuildPath = path.join(__dirname, '../../feminisse-front/dist');
app.use(express.static(viteBuildPath));

// Rota catch-all para SPA (React Router)
app.get('*', (req, res) => {
  res.sendFile(path.join(viteBuildPath, 'index.html'));
});

// Handler para 404 (caso queira customizar)
app.use((req, res, next) => {
  res.status(404).json({ error: 'Not Found' });
});

// Handler para 500
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

