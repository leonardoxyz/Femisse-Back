/**
 * 🔒 Error Sanitizer
 * 
 * Sanitiza mensagens de erro para não expor informações sensíveis
 * em produção. Previne information disclosure attacks.
 * 
 * @module utils/errorSanitizer
 */

import { logger } from './logger.js';
import { env } from '../config/validateEnv.js';

const isProduction = env.NODE_ENV === 'production';

/**
 * Mapeamento de erros conhecidos para mensagens seguras
 */
const ERROR_MESSAGES = {
  // Erros de autenticação
  'jwt expired': 'Sessão expirada. Faça login novamente.',
  'jwt malformed': 'Token de autenticação inválido.',
  'invalid token': 'Token de autenticação inválido.',
  'invalid signature': 'Token de autenticação inválido.',
  
  // Erros de validação
  'validation error': 'Dados inválidos fornecidos.',
  'invalid input': 'Dados inválidos fornecidos.',
  
  // Erros de banco de dados
  'duplicate key': 'Registro já existe.',
  'foreign key constraint': 'Operação inválida. Dependências existentes.',
  'unique constraint': 'Registro já existe.',
  '23505': 'Registro já existe.',
  '23503': 'Operação inválida. Dependências existentes.',
  
  // Erros de rede/API externa
  'econnrefused': 'Serviço temporariamente indisponível.',
  'etimedout': 'Tempo limite de conexão excedido.',
  'enotfound': 'Serviço não encontrado.',
  
  // Erros de pagamento (Mercado Pago)
  'cc_rejected_bad_filled_card_number': 'Número do cartão inválido.',
  'cc_rejected_bad_filled_date': 'Data de validade inválida.',
  'cc_rejected_bad_filled_security_code': 'Código de segurança inválido.',
  'cc_rejected_insufficient_amount': 'Saldo insuficiente.',
  'cc_rejected_high_risk': 'Pagamento rejeitado por análise de risco.',
  'cc_rejected_call_for_authorize': 'Entre em contato com seu banco.',
  'cc_rejected_card_disabled': 'Cartão desabilitado. Entre em contato com seu banco.',
  'cc_rejected_blacklist': 'Pagamento não autorizado.',
};

/**
 * Padrões que não devem ser expostos ao usuário
 */
const SENSITIVE_PATTERNS = [
  // Paths de arquivo
  /\/[a-z]+\/[a-z0-9_-]+\/[a-z0-9_.-]+/gi,
  // Stack traces
  /at\s+.+\s+\(.+:\d+:\d+\)/gi,
  // Códigos SQL
  /error:\s+\w+\s+violation/gi,
  // Tokens e chaves
  /\b[a-f0-9]{32,}\b/gi,
  // Credenciais
  /password|token|secret|key/gi,
];

/**
 * Sanitiza uma mensagem de erro para consumo do usuário
 * Remove informações sensíveis e técnicas em produção
 * 
 * @param {Error|string} error - Erro a ser sanitizado
 * @param {string} defaultMessage - Mensagem padrão se não houver mapeamento
 * @returns {string} Mensagem segura para o usuário
 */
export function sanitizeErrorMessage(error, defaultMessage = 'Erro ao processar solicitação') {
  try {
    // Se não está em produção, retorna erro completo (para debugging)
    if (!isProduction) {
      return error?.message || String(error) || defaultMessage;
    }
    
    const errorMessage = error?.message || String(error) || '';
    const lowerMessage = errorMessage.toLowerCase();
    
    // Procura por mapeamento conhecido
    for (const [pattern, safeMessage] of Object.entries(ERROR_MESSAGES)) {
      if (lowerMessage.includes(pattern.toLowerCase())) {
        return safeMessage;
      }
    }
    
    // Remove padrões sensíveis
    let sanitized = errorMessage;
    SENSITIVE_PATTERNS.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    });
    
    // Se a mensagem foi muito sanitizada, usa mensagem padrão
    if (sanitized.includes('[REDACTED]') || sanitized.length < 10) {
      return defaultMessage;
    }
    
    // Limita tamanho da mensagem
    if (sanitized.length > 200) {
      return defaultMessage;
    }
    
    return sanitized;
    
  } catch (err) {
    logger.error({ err }, 'Error sanitizing error message');
    return defaultMessage;
  }
}

/**
 * Sanitiza erro do Mercado Pago
 * Remove detalhes técnicos e mantém apenas mensagem amigável
 * 
 * @param {Object} mercadoPagoError - Erro retornado pelo MP
 * @returns {Object} { message: string, code?: string }
 */
export function sanitizeMercadoPagoError(mercadoPagoError) {
  try {
    const mpData = mercadoPagoError?.response?.data || mercadoPagoError;
    
    // Busca mensagem de erro
    const errorMessage = 
      mpData?.message || 
      mpData?.cause?.[0]?.description ||
      mpData?.cause?.[0]?.code ||
      mpData?.error_description ||
      mpData?.error ||
      'Erro ao processar pagamento';
    
    const errorCode = 
      mpData?.cause?.[0]?.code ||
      mpData?.error ||
      mpData?.status ||
      null;
    
    // Sanitiza mensagem
    const sanitizedMessage = sanitizeErrorMessage(
      errorMessage, 
      'Erro ao processar pagamento. Tente novamente ou use outro método.'
    );
    
    // Em produção, nunca expõe código de erro interno
    if (isProduction) {
      return {
        message: sanitizedMessage,
        code: null, // Não expõe códigos internos
      };
    }
    
    // Em desenvolvimento, inclui código para debugging
    return {
      message: sanitizedMessage,
      code: errorCode,
    };
    
  } catch (err) {
    logger.error({ err }, 'Error sanitizing Mercado Pago error');
    return {
      message: 'Erro ao processar pagamento',
      code: null,
    };
  }
}

/**
 * Sanitiza erro de API externa
 * 
 * @param {Error} error - Erro da API externa
 * @param {string} serviceName - Nome do serviço (para logging)
 * @returns {string} Mensagem sanitizada
 */
export function sanitizeExternalAPIError(error, serviceName = 'External Service') {
  try {
    // Loga erro completo internamente
    logger.error({
      service: serviceName,
      error: error?.message,
      status: error?.response?.status,
      data: error?.response?.data,
    }, `${serviceName} API error`);
    
    // Retorna mensagem genérica ao usuário
    if (isProduction) {
      return 'Serviço temporariamente indisponível. Tente novamente em alguns instantes.';
    }
    
    // Em dev, retorna mais detalhes
    return error?.response?.data?.message || error?.message || 'API Error';
    
  } catch (err) {
    logger.error({ err }, 'Error sanitizing external API error');
    return 'Serviço temporariamente indisponível';
  }
}

/**
 * Cria um objeto de erro padronizado para resposta HTTP
 * 
 * @param {Error|string} error - Erro original
 * @param {number} statusCode - Status HTTP
 * @param {string} defaultMessage - Mensagem padrão
 * @returns {Object} { error: string, details?: string }
 */
export function createSafeErrorResponse(error, statusCode = 500, defaultMessage = 'Erro interno') {
  const sanitizedMessage = sanitizeErrorMessage(error, defaultMessage);
  
  const response = {
    error: sanitizedMessage,
  };
  
  // Em desenvolvimento, adiciona detalhes
  if (!isProduction && error?.message) {
    response.details = error.message;
    if (error?.stack) {
      response.stack = error.stack.split('\n').slice(0, 5); // Primeiras 5 linhas do stack
    }
  }
  
  return response;
}

/**
 * Valida se uma mensagem é segura para expor ao usuário
 * 
 * @param {string} message - Mensagem a validar
 * @returns {boolean} true se é segura
 */
export function isSafeErrorMessage(message) {
  if (!message || typeof message !== 'string') return false;
  
  // Verifica padrões sensíveis
  const hasSensitivePattern = SENSITIVE_PATTERNS.some(pattern => pattern.test(message));
  
  if (hasSensitivePattern) return false;
  
  // Verifica tamanho razoável
  if (message.length > 300) return false;
  
  return true;
}

export default {
  sanitizeErrorMessage,
  sanitizeMercadoPagoError,
  sanitizeExternalAPIError,
  createSafeErrorResponse,
  isSafeErrorMessage,
};
