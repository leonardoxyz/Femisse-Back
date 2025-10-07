import jwt from 'jsonwebtoken';

// Validação crítica: JWT_SECRET deve existir
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET não configurado! Configure a variável de ambiente.');
}

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ 
      error: 'Não autorizado',
      details: 'Token de acesso requerido' 
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      // Log do erro para debugging (sem expor detalhes ao cliente)
      console.error('Token verification failed:', err.message);
      
      return res.status(403).json({ 
        error: 'Não autorizado',
        details: 'Token inválido ou expirado' 
      });
    }
    
    // Valida campos obrigatórios no token
    if (!user.id || !user.email) {
      console.error('Invalid token payload:', user);
      return res.status(403).json({ 
        error: 'Não autorizado',
        details: 'Token inválido' 
      });
    }
    
    req.user = user;
    next();
  });
}

/**
 * Middleware opcional de autenticação (não bloqueia se não houver token)
 */
export function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (!err && user && user.id) {
      req.user = user;
    }
    next();
  });
}
