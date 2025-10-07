import validator from 'validator';

const isDevelopment = process.env.NODE_ENV !== 'production';
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Sanitiza strings removendo caracteres perigosos
 */
export const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  return validator.escape(str.trim());
};

/**
 * Sanitiza recursivamente todos os campos string de um objeto
 */
export const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  
  const sanitized = Array.isArray(obj) ? [] : {};
  
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      sanitized[key] = sanitizeString(obj[key]);
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitized[key] = sanitizeObject(obj[key]);
    } else {
      sanitized[key] = obj[key];
    }
  }
  
  return sanitized;
};

/**
 * Valida email
 */
export const validateEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return { valid: false, message: 'Email é obrigatório' };
  }
  
  const sanitized = sanitizeString(email);
  
  if (!validator.isEmail(sanitized)) {
    return { valid: false, message: 'Email inválido' };
  }
  
  return { valid: true, value: validator.normalizeEmail(sanitized) };
};

/**
 * Valida senha forte
 */
export const validatePassword = (senha) => {
  if (!senha || senha.length < 8) {
    return { valid: false, message: 'Senha deve ter pelo menos 8 caracteres' };
  }
  if (!/[A-Z]/.test(senha)) {
    return { valid: false, message: 'Senha deve conter pelo menos uma letra maiúscula' };
  }
  if (!/[a-z]/.test(senha)) {
    return { valid: false, message: 'Senha deve conter pelo menos uma letra minúscula' };
  }
  if (!/[0-9]/.test(senha)) {
    return { valid: false, message: 'Senha deve conter pelo menos um número' };
  }
  return { valid: true };
};

/**
 * Valida CPF
 */
export const validateCPF = (cpf) => {
  if (!cpf) return { valid: true, value: null }; // CPF é opcional
  
  const cleanCPF = cpf.replace(/\D/g, '');
  
  if (cleanCPF.length !== 11) {
    return { valid: false, message: 'CPF deve ter 11 dígitos' };
  }
  
  // Rejeita CPFs com todos dígitos iguais
  if (/^(\d)\1{10}$/.test(cleanCPF)) {
    return { valid: false, message: 'CPF inválido' };
  }
  
  // Validação completa do CPF
  let sum = 0;
  let remainder;
  
  for (let i = 1; i <= 9; i++) {
    sum += parseInt(cleanCPF.substring(i - 1, i)) * (11 - i);
  }
  
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(9, 10))) {
    return { valid: false, message: 'CPF inválido' };
  }
  
  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(cleanCPF.substring(i - 1, i)) * (12 - i);
  }
  
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(10, 11))) {
    return { valid: false, message: 'CPF inválido' };
  }
  
  return { valid: true, value: cleanCPF };
};

/**
 * Valida telefone
 */
export const validatePhone = (telefone) => {
  if (!telefone) return { valid: true, value: null }; // Telefone é opcional
  
  const cleanPhone = telefone.replace(/\D/g, '');
  
  if (cleanPhone.length < 10 || cleanPhone.length > 11) {
    return { valid: false, message: 'Telefone deve ter 10 ou 11 dígitos' };
  }
  
  return { valid: true, value: cleanPhone };
};

/**
 * Valida CEP
 */
export const validateCEP = (cep) => {
  if (!cep) {
    return { valid: false, message: 'CEP é obrigatório' };
  }
  
  const cleanCEP = cep.replace(/\D/g, '');
  
  if (cleanCEP.length !== 8) {
    return { valid: false, message: 'CEP deve ter 8 dígitos' };
  }
  
  return { valid: true, value: cleanCEP };
};

/**
 * Valida data de nascimento
 */
export const validateBirthDate = (date) => {
  if (!date) return { valid: true, value: null }; // Data é opcional
  
  if (!validator.isDate(date)) {
    return { valid: false, message: 'Data de nascimento inválida' };
  }
  
  const birthDate = new Date(date);
  const today = new Date();
  
  if (birthDate > today) {
    return { valid: false, message: 'Data de nascimento não pode ser futura' };
  }
  
  // Verifica se a pessoa tem pelo menos 13 anos
  const minAge = new Date(today.getFullYear() - 13, today.getMonth(), today.getDate());
  if (birthDate > minAge) {
    return { valid: false, message: 'Você deve ter pelo menos 13 anos' };
  }
  
  // Verifica se a data não é muito antiga (mais de 120 anos)
  const maxAge = new Date(today.getFullYear() - 120, today.getMonth(), today.getDate());
  if (birthDate < maxAge) {
    return { valid: false, message: 'Data de nascimento inválida' };
  }
  
  return { valid: true, value: date };
};

/**
 * Valida UUID
 */
export const validateUUID = (id) => {
  if (!id) {
    return { valid: false, message: 'ID é obrigatório' };
  }
  
  if (!validator.isUUID(id)) {
    return { valid: false, message: 'ID inválido' };
  }
  
  return { valid: true, value: id };
};

/**
 * Valida número inteiro positivo
 */
export const validatePositiveInteger = (value, fieldName = 'Valor') => {
  const num = parseInt(value);
  
  if (isNaN(num) || num < 0) {
    return { valid: false, message: `${fieldName} deve ser um número positivo` };
  }
  
  return { valid: true, value: num };
};

/**
 * Valida número decimal positivo
 */
export const validatePositiveDecimal = (value, fieldName = 'Valor') => {
  const num = parseFloat(value);
  
  if (isNaN(num) || num < 0) {
    return { valid: false, message: `${fieldName} deve ser um número positivo` };
  }
  
  return { valid: true, value: num };
};

/**
 * Valida rating (1-5)
 */
export const validateRating = (rating) => {
  const num = parseInt(rating);
  
  if (isNaN(num) || num < 1 || num > 5) {
    return { valid: false, message: 'Avaliação deve ser entre 1 e 5' };
  }
  
  return { valid: true, value: num };
};

/**
 * Valida limite de paginação
 */
export const validateLimit = (limit, max = 100) => {
  if (!limit) return { valid: true, value: null };
  
  const num = parseInt(limit);
  
  if (isNaN(num) || num < 1) {
    return { valid: false, message: 'Limite deve ser um número positivo' };
  }
  
  if (num > max) {
    return { valid: false, message: `Limite máximo é ${max}` };
  }
  
  return { valid: true, value: num };
};

/**
 * Valida nome (apenas letras e espaços)
 */
export const validateName = (name, minLength = 2, maxLength = 100) => {
  if (!name || typeof name !== 'string') {
    return { valid: false, message: 'Nome é obrigatório' };
  }
  
  const sanitized = sanitizeString(name);
  
  if (sanitized.length < minLength || sanitized.length > maxLength) {
    return { valid: false, message: `Nome deve ter entre ${minLength} e ${maxLength} caracteres` };
  }
  
  if (!/^[a-zA-ZÀ-ÿ\s]+$/.test(sanitized)) {
    return { valid: false, message: 'Nome deve conter apenas letras e espaços' };
  }
  
  return { valid: true, value: sanitized };
};

/**
 * Valida endereço completo
 */
export const validateAddress = (address) => {
  const errors = [];
  const sanitized = {};
  
  // Label
  if (!address.label || typeof address.label !== 'string') {
    errors.push({ field: 'label', message: 'Identificação do endereço é obrigatória' });
  } else {
    const label = sanitizeString(address.label);
    if (label.length < 2 || label.length > 50) {
      errors.push({ field: 'label', message: 'Identificação deve ter entre 2 e 50 caracteres' });
    } else {
      sanitized.label = label;
    }
  }
  
  // Street
  if (!address.street || typeof address.street !== 'string') {
    errors.push({ field: 'street', message: 'Rua é obrigatória' });
  } else {
    const street = sanitizeString(address.street);
    if (street.length < 3 || street.length > 200) {
      errors.push({ field: 'street', message: 'Rua deve ter entre 3 e 200 caracteres' });
    } else {
      sanitized.street = street;
    }
  }
  
  // Number
  if (!address.number || typeof address.number !== 'string') {
    errors.push({ field: 'number', message: 'Número é obrigatório' });
  } else {
    const number = sanitizeString(address.number);
    if (number.length > 20) {
      errors.push({ field: 'number', message: 'Número deve ter no máximo 20 caracteres' });
    } else {
      sanitized.number = number;
    }
  }
  
  // Complement (opcional)
  if (address.complement) {
    const complement = sanitizeString(address.complement);
    if (complement.length > 100) {
      errors.push({ field: 'complement', message: 'Complemento deve ter no máximo 100 caracteres' });
    } else {
      sanitized.complement = complement;
    }
  }
  
  // Neighborhood
  if (!address.neighborhood || typeof address.neighborhood !== 'string') {
    errors.push({ field: 'neighborhood', message: 'Bairro é obrigatório' });
  } else {
    const neighborhood = sanitizeString(address.neighborhood);
    if (neighborhood.length < 2 || neighborhood.length > 100) {
      errors.push({ field: 'neighborhood', message: 'Bairro deve ter entre 2 e 100 caracteres' });
    } else {
      sanitized.neighborhood = neighborhood;
    }
  }
  
  // City
  if (!address.city || typeof address.city !== 'string') {
    errors.push({ field: 'city', message: 'Cidade é obrigatória' });
  } else {
    const city = sanitizeString(address.city);
    if (city.length < 2 || city.length > 100) {
      errors.push({ field: 'city', message: 'Cidade deve ter entre 2 e 100 caracteres' });
    } else {
      sanitized.city = city;
    }
  }
  
  // State
  if (!address.state || typeof address.state !== 'string') {
    errors.push({ field: 'state', message: 'Estado é obrigatório' });
  } else {
    const state = sanitizeString(address.state).toUpperCase();
    if (state.length !== 2) {
      errors.push({ field: 'state', message: 'Estado deve ter 2 caracteres (UF)' });
    } else {
      sanitized.state = state;
    }
  }
  
  // ZIP Code
  const cepValidation = validateCEP(address.zip_code);
  if (!cepValidation.valid) {
    errors.push({ field: 'zip_code', message: cepValidation.message });
  } else {
    sanitized.zip_code = cepValidation.value;
  }
  
  return {
    valid: errors.length === 0,
    errors,
    sanitized
  };
};

/**
 * Logger seguro (não loga dados sensíveis em produção)
 */
export const secureLog = (message, data = {}) => {
  if (isDevelopment) {
    console.log(message, data);
  } else {
    // Em produção, loga apenas informações não sensíveis
    const safeData = { ...data };
    delete safeData.senha;
    delete safeData.senha_hash;
    delete safeData.password;
    delete safeData.token;
    delete safeData.cpf;
    console.log(message, safeData);
  }
};

/**
 * Retorna mensagem de erro genérica em produção
 */
export const getErrorMessage = (error, devMessage, prodMessage = 'Erro ao processar solicitação') => {
  if (isDevelopment) {
    return { error: devMessage, details: error.message };
  }
  return { error: prodMessage };
};
