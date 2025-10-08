import { logger, logError } from '../utils/logger.js';

/**
 * Middleware global de tratamento de erros
 * Deve ser o último middleware registrado
 */
export const errorHandler = (err, req, res, next) => {
  // Log do erro
  logError(err, {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userId: req.user?.id,
  });

  // Erro de validação (Zod)
  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: 'Erro de validação',
      details: err.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  // Erro de autenticação JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Token inválido',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expirado',
    });
  }

  // Erro de autorização
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'Não autorizado',
    });
  }

  // Erro de permissão
  if (err.name === 'ForbiddenError') {
    return res.status(403).json({
      error: 'Acesso negado',
    });
  }

  // Erro de não encontrado
  if (err.name === 'NotFoundError') {
    return res.status(404).json({
      error: 'Recurso não encontrado',
    });
  }

  // Erro de conflito (ex: email já existe)
  if (err.name === 'ConflictError') {
    return res.status(409).json({
      error: err.message || 'Conflito de dados',
    });
  }

  // Erro de rate limit
  if (err.name === 'TooManyRequestsError') {
    return res.status(429).json({
      error: 'Muitas requisições. Tente novamente mais tarde.',
    });
  }

  // Erro do Supabase
  if (err.code && err.code.startsWith('PGRST')) {
    return res.status(500).json({
      error: 'Erro no banco de dados',
      ...(process.env.NODE_ENV === 'development' && { details: err.message }),
    });
  }

  // Erro genérico
  const statusCode = err.statusCode || err.status || 500;
  
  res.status(statusCode).json({
    error: statusCode === 500 
      ? 'Erro interno do servidor' 
      : err.message || 'Erro desconhecido',
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      details: err,
    }),
  });
};

/**
 * Middleware para capturar rotas não encontradas
 */
export const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: 'Rota não encontrada',
    path: req.url,
  });
};

/**
 * Classes de erro customizadas
 */
export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message) {
    super(message, 400);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Não autorizado') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Acesso negado') {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Recurso não encontrado') {
    super(message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message) {
    super(message, 409);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Muitas requisições') {
    super(message, 429);
  }
}

/**
 * Wrapper async para controllers
 * Captura erros automaticamente
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
