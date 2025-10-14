/**
 * 🔒 Validador de CPF
 * 
 * Implementa validação completa de CPF incluindo:
 * - Validação de formato
 * - Validação de dígitos verificadores
 * - Proteção contra sequências repetidas
 * - Sanitização de entrada
 */

const logger = require('./logger');

/**
 * Valida CPF com dígitos verificadores
 * @param {string} cpf - CPF a ser validado (pode conter formatação)
 * @returns {boolean} - true se CPF válido
 */
function validateCPF(cpf) {
  if (!cpf) return false;

  // Remove formatação
  const cleaned = cpf.toString().replace(/\D/g, '');
  
  // Verifica tamanho
  if (cleaned.length !== 11) {
    logger.debug('CPF inválido: tamanho incorreto', { length: cleaned.length });
    return false;
  }
  
  // Verifica sequências repetidas (111.111.111-11, etc)
  if (/^(\d)\1{10}$/.test(cleaned)) {
    logger.debug('CPF inválido: sequência repetida');
    return false;
  }
  
  // Valida primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned.charAt(i)) * (10 - i);
  }
  let digit1 = 11 - (sum % 11);
  if (digit1 > 9) digit1 = 0;
  
  if (parseInt(cleaned.charAt(9)) !== digit1) {
    logger.debug('CPF inválido: primeiro dígito verificador incorreto');
    return false;
  }
  
  // Valida segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned.charAt(i)) * (11 - i);
  }
  let digit2 = 11 - (sum % 11);
  if (digit2 > 9) digit2 = 0;
  
  if (parseInt(cleaned.charAt(10)) !== digit2) {
    logger.debug('CPF inválido: segundo dígito verificador incorreto');
    return false;
  }
  
  return true;
}

/**
 * Sanitiza CPF removendo formatação
 * @param {string} cpf - CPF a ser sanitizado
 * @returns {string} - CPF apenas com números
 */
function sanitizeCPF(cpf) {
  if (!cpf) return '';
  return cpf.toString().replace(/\D/g, '');
}

/**
 * Formata CPF para exibição
 * @param {string} cpf - CPF a ser formatado
 * @returns {string} - CPF formatado (XXX.XXX.XXX-XX)
 */
function formatCPF(cpf) {
  const cleaned = sanitizeCPF(cpf);
  if (cleaned.length !== 11) return cpf;
  
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Mascara CPF para logs (mostra apenas primeiros 3 dígitos)
 * @param {string} cpf - CPF a ser mascarado
 * @returns {string} - CPF mascarado (XXX.***.***-**)
 */
function maskCPFForLog(cpf) {
  if (!cpf) return 'null';
  const cleaned = sanitizeCPF(cpf);
  if (cleaned.length < 11) return '***';
  return `${cleaned.substring(0, 3)}.***.***-**`;
}

/**
 * Middleware para validar CPF em requisições
 */
function validateCPFMiddleware(req, res, next) {
  const { cpf } = req.body;
  
  // CPF é opcional - se não fornecido, apenas prossegue
  if (!cpf) {
    return next();
  }
  
  // Se fornecido, deve ser válido
  if (!validateCPF(cpf)) {
    logger.warn('Tentativa de salvar CPF inválido', {
      userId: req.user?.id,
      masked: maskCPFForLog(cpf),
      ip: req.ip
    });
    
    return res.status(400).json({ 
      error: 'CPF inválido',
      message: 'O CPF fornecido não é válido. Verifique os dígitos e tente novamente.'
    });
  }
  
  // Sanitiza o CPF antes de continuar
  req.body.cpf = sanitizeCPF(cpf);
  
  logger.info('CPF validado com sucesso', {
    userId: req.user?.id,
    masked: maskCPFForLog(cpf)
  });
  
  next();
}

module.exports = {
  validateCPF,
  sanitizeCPF,
  formatCPF,
  maskCPFForLog,
  validateCPFMiddleware
};
