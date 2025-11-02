/**
 * Utilitários para mascaramento de dados sensíveis
 * Compliance com LGPD e boas práticas de segurança
 */

/**
 * Mascara CPF mantendo apenas os últimos 2 dígitos visíveis
 * @param {string} cpf - CPF a ser mascarado
 * @returns {string|null} CPF mascarado ou null
 * @example maskCPF('12345678901') // returns '***.***.*01'
 */
export const maskCPF = (cpf) => {
  if (!cpf) return null;
  
  // Remove caracteres não numéricos
  const cleaned = String(cpf).replace(/\D/g, '');
  
  // Valida tamanho
  if (cleaned.length !== 11) return null;
  
  // Formata: ***.***.*01
  return `***.***.*${cleaned.slice(-2)}`;
};

/**
 * Mascara email mantendo primeiros 3 caracteres e domínio completo
 * @param {string} email - Email a ser mascarado
 * @returns {string|null} Email mascarado ou null
 * @example maskEmail('usuario@example.com') // returns 'usu***@example.com'
 */
export const maskEmail = (email) => {
  if (!email || typeof email !== 'string') return null;
  
  const parts = email.split('@');
  if (parts.length !== 2) return null;
  
  const [local, domain] = parts;
  if (!local || !domain) return null;
  
  // Mantém primeiros 3 caracteres ou menos
  const visibleStart = Math.min(3, local.length);
  const masked = local.slice(0, visibleStart) + '***';
  
  return `${masked}@${domain}`;
};

/**
 * Mascara telefone mantendo apenas DDD e últimos 4 dígitos
 * @param {string} phone - Telefone a ser mascarado
 * @returns {string|null} Telefone mascarado ou null
 * @example maskPhone('11987654321') // returns '(11) *****-4321'
 */
export const maskPhone = (phone) => {
  if (!phone) return null;
  
  // Remove caracteres não numéricos
  const cleaned = String(phone).replace(/\D/g, '');
  
  // Valida tamanho (10 ou 11 dígitos)
  if (cleaned.length < 10 || cleaned.length > 11) return null;
  
  const ddd = cleaned.slice(0, 2);
  const lastFour = cleaned.slice(-4);
  
  // Formata: (11) *****-4321
  return `(${ddd}) *****-${lastFour}`;
};

/**
 * Mascara data de nascimento mantendo apenas o ano
 * @param {string} date - Data no formato ISO ou brasileiro
 * @returns {string|null} Apenas o ano ou null
 * @example maskBirthDate('1990-05-15') // returns '1990'
 * @example maskBirthDate('15/05/1990') // returns '1990'
 */
export const maskBirthDate = (date) => {
  if (!date) return null;
  
  const dateStr = String(date);
  
  // Tenta extrair ano de formato ISO (YYYY-MM-DD)
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
    return dateStr.slice(0, 4);
  }
  
  // Tenta extrair ano de formato brasileiro (DD/MM/YYYY)
  if (dateStr.match(/^\d{2}\/\d{2}\/\d{4}/)) {
    return dateStr.slice(-4);
  }
  
  // Tenta extrair ano de timestamp
  try {
    const year = new Date(dateStr).getFullYear();
    if (year && year > 1900 && year < 2100) {
      return String(year);
    }
  } catch (error) {
    return null;
  }
  
  return null;
};

/**
 * Mascara endereço mantendo apenas cidade e estado
 * @param {object} address - Objeto de endereço
 * @returns {object} Endereço mascarado
 */
export const maskAddress = (address) => {
  if (!address || typeof address !== 'object') return null;
  
  return {
    city: address.city ?? address.cidade ?? null,
    state: address.state ?? address.estado ?? null,
  };
};

/**
 * Mascara número de cartão de crédito mantendo últimos 4 dígitos
 * @param {string} cardNumber - Número do cartão
 * @returns {string|null} Número mascarado ou null
 * @example maskCardNumber('1234567890123456') // returns '****-****-****-3456'
 */
export const maskCardNumber = (cardNumber) => {
  if (!cardNumber) return null;
  
  const cleaned = String(cardNumber).replace(/\D/g, '');
  
  if (cleaned.length < 13 || cleaned.length > 19) return null;
  
  const lastFour = cleaned.slice(-4);
  return `****-****-****-${lastFour}`;
};

/**
 * Mascara BIN de cartão (primeiros 6-8 dígitos)
 * Mantém apenas os primeiros 4 dígitos
 * @param {string} bin - BIN do cartão
 * @returns {string|null} BIN mascarado ou null
 * @example maskCardBIN('12345678') // returns '1234****'
 */
export const maskCardBIN = (bin) => {
  if (!bin) return null;
  
  const cleaned = String(bin).replace(/\D/g, '');
  
  if (cleaned.length < 6 || cleaned.length > 8) return null;
  
  const firstFour = cleaned.slice(0, 4);
  return `${firstFour}****`;
};

/**
 * Mascara token JWT ou similar
 * Mantém apenas os primeiros e últimos 8 caracteres
 * @param {string} token - Token a ser mascarado
 * @returns {string|null} Token mascarado ou null
 * @example maskToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI...') // returns 'eyJhbGci...J9.eyJzd'
 */
export const maskToken = (token) => {
  if (!token || typeof token !== 'string') return null;
  
  if (token.length <= 16) return '***';
  
  const start = token.slice(0, 8);
  const end = token.slice(-8);
  
  return `${start}...${end}`;
};

/**
 * Mascara chave de API ou secret
 * Mantém apenas os primeiros 4 caracteres
 * @param {string} key - Chave a ser mascarada
 * @returns {string|null} Chave mascarada ou null
 */
export const maskAPIKey = (key) => {
  if (!key || typeof key !== 'string') return null;
  
  if (key.length <= 8) return '***';
  
  const start = key.slice(0, 4);
  return `${start}***`;
};

/**
 * Verifica se um valor é considerado sensível e precisa ser mascarado
 * @param {string} fieldName - Nome do campo
 * @returns {boolean} true se o campo é sensível
 */
export const isSensitiveField = (fieldName) => {
  if (!fieldName || typeof fieldName !== 'string') return false;
  
  const lowerFieldName = fieldName.toLowerCase();
  
  const sensitiveFields = [
    // Documentos
    'cpf', 'rg', 'cnh', 'passport', 'passaporte',
    // Senhas e autenticação
    'password', 'senha', 'pwd', 'pass',
    'access_token', 'refresh_token', 'token', 'jwt',
    'api_key', 'secret', 'private_key',
    // Cartões
    'card_number', 'card_token', 'cvv', 'cvc', 'security_code',
    'card_bin', 'bin', 'card_brand',
    // Dados bancários
    'account_number', 'bank_account', 'iban',
    'routing_number', 'swift', 'pix_key',
    // Dados pessoais sensíveis
    'birth_date', 'data_nascimento', 'ssn',
    // Hashes
    'senha_hash', 'password_hash',
  ];
  
  return sensitiveFields.some(field => lowerFieldName.includes(field));
};

/**
 * Mascara um campo baseado no tipo detectado
 * @param {string} fieldName - Nome do campo
 * @param {any} value - Valor a ser mascarado
 * @returns {any} Valor mascarado ou original
 */
export const maskField = (fieldName, value) => {
  if (value === null || value === undefined) return value;
  
  const lowerFieldName = fieldName.toLowerCase();
  
  // CPF
  if (lowerFieldName.includes('cpf')) {
    return maskCPF(value);
  }
  
  // Email
  if (lowerFieldName.includes('email') || lowerFieldName.includes('e-mail')) {
    return maskEmail(value);
  }
  
  // Telefone
  if (lowerFieldName.includes('phone') || lowerFieldName.includes('telefone') || lowerFieldName.includes('celular')) {
    return maskPhone(value);
  }
  
  // Data de nascimento
  if (lowerFieldName.includes('birth') || lowerFieldName.includes('nascimento')) {
    return maskBirthDate(value);
  }
  
  // Cartão
  if (lowerFieldName.includes('card_number')) {
    return maskCardNumber(value);
  }
  
  // BIN
  if (lowerFieldName.includes('card_bin') || lowerFieldName.includes('bin')) {
    return maskCardBIN(value);
  }
  
  // Token/JWT
  if (lowerFieldName.includes('token') || lowerFieldName.includes('jwt')) {
    return maskToken(value);
  }
  
  // API Key / Secret
  if (lowerFieldName.includes('api_key') || lowerFieldName.includes('secret') || lowerFieldName.includes('key')) {
    return maskAPIKey(value);
  }
  
  // Senha (sempre oculta completamente)
  if (lowerFieldName.includes('password') || lowerFieldName.includes('senha') || lowerFieldName.includes('pass')) {
    return '[REDACTED]';
  }
  
  // CVV/CVC (sempre oculta completamente)
  if (lowerFieldName.includes('cvv') || lowerFieldName.includes('cvc') || lowerFieldName.includes('security_code')) {
    return '***';
  }
  
  // Default: se é campo sensível, oculta
  if (isSensitiveField(fieldName)) {
    return '[REDACTED]';
  }
  
  return value;
};

/**
 * Mascara dados sensíveis em um objeto de forma recursiva
 * Ideal para logs seguros
 * 
 * @param {any} data - Dados a serem mascarados
 * @param {number} depth - Profundidade atual (evita recursão infinita)
 * @param {number} maxDepth - Profundidade máxima permitida
 * @returns {any} Dados mascarados
 * 
 * @example
 * const sensitive = { cpf: '12345678901', email: 'user@example.com' };
 * maskSensitiveData(sensitive); // { cpf: '***.***.*01', email: 'use***@example.com' }
 */
export const maskSensitiveData = (data, depth = 0, maxDepth = 10) => {
  // Previne recursão infinita
  if (depth > maxDepth) {
    return '[MAX_DEPTH_EXCEEDED]';
  }
  
  // Null ou undefined
  if (data === null || data === undefined) {
    return data;
  }
  
  // Tipos primitivos
  if (typeof data !== 'object') {
    return data;
  }
  
  // Arrays
  if (Array.isArray(data)) {
    return data.map(item => maskSensitiveData(item, depth + 1, maxDepth));
  }
  
  // Date objects
  if (data instanceof Date) {
    return data;
  }
  
  // Objects
  const masked = {};
  
  for (const [key, value] of Object.entries(data)) {
    // Se é campo sensível, mascara o valor
    if (isSensitiveField(key)) {
      masked[key] = maskField(key, value);
    }
    // Se é objeto ou array, recursão
    else if (value && typeof value === 'object') {
      masked[key] = maskSensitiveData(value, depth + 1, maxDepth);
    }
    // Caso contrário, mantém o valor original
    else {
      masked[key] = value;
    }
  }
  
  return masked;
};

/**
 * Wrapper para logging seguro
 * Mascara automaticamente dados sensíveis antes de logar
 * 
 * @param {Object} logger - Instância do logger (pino, winston, etc)
 * @returns {Object} Logger com mascaramento automático
 */
export const createSecureLogger = (logger) => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    info: (data, message) => {
      const masked = isProduction && data ? maskSensitiveData(data) : data;
      logger.info(masked, message);
    },
    warn: (data, message) => {
      const masked = isProduction && data ? maskSensitiveData(data) : data;
      logger.warn(masked, message);
    },
    error: (data, message) => {
      const masked = isProduction && data ? maskSensitiveData(data) : data;
      logger.error(masked, message);
    },
    debug: (data, message) => {
      // Debug nunca loga dados sensíveis mesmo em dev
      const masked = data ? maskSensitiveData(data) : data;
      logger.debug(masked, message);
    },
    fatal: (data, message) => {
      const masked = isProduction && data ? maskSensitiveData(data) : data;
      logger.fatal(masked, message);
    },
  };
};

export default {
  maskCPF,
  maskEmail,
  maskPhone,
  maskBirthDate,
  maskAddress,
  maskCardNumber,
  maskCardBIN,
  maskToken,
  maskAPIKey,
  isSensitiveField,
  maskField,
  maskSensitiveData,
  createSecureLogger,
};
