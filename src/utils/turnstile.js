import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const isDevelopment = process.env.NODE_ENV !== 'production';
const isProduction = process.env.NODE_ENV === 'production';

// Chave secreta do Turnstile
const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;

// URL da API do Cloudflare Turnstile
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Valida o token do Cloudflare Turnstile
 * @param {string} token - Token retornado pelo widget Turnstile
 * @param {string} remoteip - IP do cliente (opcional)
 * @returns {Promise<{success: boolean, error?: string, data?: object}>}
 */
export async function validateTurnstileToken(token, remoteip = null) {
  try {
    // Log para desenvolvimento
    if (isDevelopment) {
      console.log('Validating Turnstile token:', {
        tokenLength: token?.length,
        hasSecretKey: !!TURNSTILE_SECRET_KEY,
        remoteip,
        environment: process.env.NODE_ENV
      });
    }

    // Validação básica do token
    if (!token || typeof token !== 'string') {
      return {
        success: false,
        error: 'Token do Turnstile inválido ou ausente'
      };
    }

    // Validação da chave secreta
    if (!TURNSTILE_SECRET_KEY) {
      console.error('TURNSTILE_SECRET_KEY não configurada');
      return {
        success: false,
        error: 'Configuração do Turnstile não encontrada'
      };
    }

    // Preparar dados para envio
    const formData = new URLSearchParams();
    formData.append('secret', TURNSTILE_SECRET_KEY);
    formData.append('response', token);
    
    if (remoteip) {
      formData.append('remoteip', remoteip);
    }

    // Fazer requisição para API do Cloudflare
    const response = await axios.post(TURNSTILE_VERIFY_URL, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 10000, // 10 segundos de timeout
    });

    const result = response.data;

    if (isDevelopment) {
      console.log('Turnstile API response:', {
        success: result.success,
        challenge_ts: result.challenge_ts,
        hostname: result.hostname,
        errorCodes: result['error-codes']
      });
    }

    // Verificar resposta da API
    if (result.success) {
      return {
        success: true,
        data: {
          challenge_ts: result.challenge_ts,
          hostname: result.hostname,
          action: result.action,
          cdata: result.cdata
        }
      };
    } else {
      // Mapear códigos de erro para mensagens amigáveis
      const errorMessages = {
        'missing-input-secret': 'Chave secreta ausente',
        'invalid-input-secret': 'Chave secreta inválida',
        'missing-input-response': 'Token de resposta ausente',
        'invalid-input-response': 'Token de resposta inválido',
        'bad-request': 'Requisição malformada',
        'timeout-or-duplicate': 'Token expirado ou já utilizado',
        'internal-error': 'Erro interno do Turnstile'
      };

      const errorCodes = result['error-codes'] || [];
      const errorMessage = errorCodes
        .map(code => errorMessages[code] || code)
        .join(', ') || 'Falha na verificação de segurança';

      if (isDevelopment) {
        console.error('Turnstile validation failed:', {
          errorCodes,
          errorMessage
        });
      }

      return {
        success: false,
        error: errorMessage
      };
    }

  } catch (error) {
    console.error('Erro ao validar token Turnstile:', {
      message: error.message,
      code: error.code,
      response: error.response?.data
    });

    // Em produção, retorna erro genérico
    if (isProduction) {
      return {
        success: false,
        error: 'Erro na verificação de segurança'
      };
    }

    // Em desenvolvimento, retorna detalhes do erro
    return {
      success: false,
      error: `Erro na validação: ${error.message}`
    };
  }
}

/**
 * Middleware para validar Turnstile em rotas específicas
 * @param {boolean} required - Se a validação é obrigatória
 * @returns {Function} Middleware function
 */
export function turnstileMiddleware(required = true) {
  return async (req, res, next) => {
    try {
      const { turnstileToken } = req.body;
      const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];

      // Se não é obrigatório e não foi fornecido, prossegue
      if (!required && !turnstileToken) {
        return next();
      }

      // Se é obrigatório e não foi fornecido, retorna erro
      if (required && !turnstileToken) {
        return res.status(400).json({
          error: 'Verificação de segurança obrigatória',
          details: [{ message: 'Token Turnstile é obrigatório' }]
        });
      }

      // Valida o token
      const validation = await validateTurnstileToken(turnstileToken, clientIP);

      if (!validation.success) {
        return res.status(400).json({
          error: 'Falha na verificação de segurança',
          details: [{ message: validation.error }]
        });
      }

      // Adiciona dados da validação ao request para uso posterior
      req.turnstileValidation = validation.data;
      
      next();
    } catch (error) {
      console.error('Erro no middleware Turnstile:', error.message);
      
      return res.status(500).json({
        error: 'Erro interno na verificação de segurança',
        details: [{ message: 'Tente novamente em alguns instantes' }]
      });
    }
  };
}

export default {
  validateTurnstileToken,
  turnstileMiddleware
};
