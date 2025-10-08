import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Logger estruturado com Pino
 * - Desenvolvimento: Pretty print
 * - Produção: JSON estruturado
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  
  // Pretty print apenas em desenvolvimento
  transport: isDevelopment ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
    }
  } : undefined,

  // Configurações de produção
  ...(isProduction && {
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        '*.password',
        '*.token',
        '*.senha',
      ],
      remove: true,
    },
  }),

  // Serializers customizados
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      headers: {
        host: req.headers.host,
        'user-agent': req.headers['user-agent'],
      },
      remoteAddress: req.remoteAddress,
      remotePort: req.remotePort,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
    err: pino.stdSerializers.err,
  },
});

/**
 * Middleware de logging HTTP
 */
export const httpLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    };

    if (res.statusCode >= 500) {
      logger.error(logData, 'HTTP Request Error');
    } else if (res.statusCode >= 400) {
      logger.warn(logData, 'HTTP Request Warning');
    } else {
      logger.info(logData, 'HTTP Request');
    }
  });

  next();
};

/**
 * Helper para logar erros de forma consistente
 */
export const logError = (error, context = {}) => {
  logger.error({
    err: error,
    ...context,
  }, error.message || 'Erro não especificado');
};

/**
 * Helper para logar eventos de segurança
 */
export const logSecurity = (event, details = {}) => {
  logger.warn({
    type: 'security',
    event,
    ...details,
  }, `Security Event: ${event}`);
};

/**
 * Helper para logar performance
 */
export const logPerformance = (operation, duration, metadata = {}) => {
  logger.info({
    type: 'performance',
    operation,
    duration: `${duration}ms`,
    ...metadata,
  }, `Performance: ${operation}`);
};

export default logger;
