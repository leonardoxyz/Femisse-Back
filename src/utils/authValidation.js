import validator from 'validator';

/**
 * Sanitiza string removendo caracteres perigosos
 */
export const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  return validator.escape(str.trim());
};

/**
 * Validação de senha forte
 */
export const validatePassword = (senha) => {
  if (!senha || senha.length < 8) {
    throw new Error('Senha deve ter pelo menos 8 caracteres');
  }
  if (!/[A-Z]/.test(senha)) {
    throw new Error('Senha deve conter pelo menos uma letra maiúscula');
  }
  if (!/[a-z]/.test(senha)) {
    throw new Error('Senha deve conter pelo menos uma letra minúscula');
  }
  if (!/[0-9]/.test(senha)) {
    throw new Error('Senha deve conter pelo menos um número');
  }
  return true;
};

/**
 * Validação de email
 */
export const validateEmail = (email) => {
  if (!validator.isEmail(email)) {
    throw new Error('Email inválido');
  }
  return true;
};

/**
 * Validação de CPF
 */
export const validateCPF = (cpf) => {
  const cleanCPF = cpf.replace(/\D/g, '');
  
  if (cleanCPF.length !== 11) {
    throw new Error('CPF deve conter 11 dígitos');
  }

  if (/^(\d)\1{10}$/.test(cleanCPF)) {
    throw new Error('CPF inválido');
  }

  let sum = 0;
  let remainder;

  for (let i = 1; i <= 9; i++) {
    sum += parseInt(cleanCPF.substring(i - 1, i)) * (11 - i);
  }

  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(9, 10))) {
    throw new Error('CPF inválido');
  }

  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(cleanCPF.substring(i - 1, i)) * (12 - i);
  }

  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(10, 11))) {
    throw new Error('CPF inválido');
  }

  return true;
};

/**
 * Validação de telefone
 */
export const validatePhone = (phone) => {
  const cleanPhone = phone.replace(/\D/g, '');
  
  if (cleanPhone.length < 10 || cleanPhone.length > 11) {
    throw new Error('Telefone inválido');
  }
  
  return true;
};

/**
 * Validação de data de nascimento
 */
export const validateBirthDate = (birthDate) => {
  const date = new Date(birthDate);
  const today = new Date();
  const age = today.getFullYear() - date.getFullYear();
  
  if (age < 18) {
    throw new Error('Você deve ter pelo menos 18 anos');
  }
  
  return true;
};
