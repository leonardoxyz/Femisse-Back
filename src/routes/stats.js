import express from 'express';
import { performanceStats } from '../middleware/performanceMiddleware.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { strictRateLimit } from '../middleware/validationMiddleware.js';

const router = express.Router();

// Aplicar rate limiting e autenticação para stats
router.use(strictRateLimit);
router.use(authenticateToken);

// Endpoint para estatísticas de performance (apenas para admins)
router.get('/performance', (req, res) => {
  try {
    const stats = performanceStats.getStats();
    
    res.json({
      success: true,
      data: {
        ...stats,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        nodeVersion: process.version
      }
    });
  } catch (error) {
    console.error('Error getting performance stats:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao obter estatísticas'
    });
  }
});

// Endpoint para resetar estatísticas
router.post('/performance/reset', (req, res) => {
  try {
    performanceStats.reset();
    
    res.json({
      success: true,
      message: 'Estatísticas resetadas com sucesso'
    });
  } catch (error) {
    console.error('Error resetting performance stats:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao resetar estatísticas'
    });
  }
});

// Endpoint para health check
router.get('/health', (req, res) => {
  const healthCheck = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024 * 100) / 100
    },
    cpu: process.cpuUsage(),
    environment: process.env.NODE_ENV || 'development'
  };

  res.status(200).json(healthCheck);
});

export default router;
