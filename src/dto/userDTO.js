const toPublicProfile = (user) => ({
  nome: user.nome ?? null,
  email: user.email,
  dataNascimento: user.data_nascimento ?? null,
  telefone: user.telefone ?? null,
});

const toAdminUser = (user) => ({
  id: user.id,
  nome: user.nome ?? null,
  email: user.email,
  dataNascimento: user.data_nascimento ?? null,
  cpf: user.cpf ?? null,
  telefone: user.telefone ?? null,
  createdAt: user.created_at,
  updatedAt: user.updated_at,
});

const toAdminUserList = (users = []) =>
  (Array.isArray(users) ? users : []).map(toAdminUser);

const validateUserInput = (input) => {
  const errors = [];

  if (!input) {
    errors.push({ field: 'body', message: 'Dados do usuário são obrigatórios' });
    return { isValid: false, errors };
  }

  if (input.nome && typeof input.nome !== 'string') {
    errors.push({ field: 'nome', message: 'Nome deve ser uma string' });
  }

  if (input.email && typeof input.email !== 'string') {
    errors.push({ field: 'email', message: 'Email deve ser uma string' });
  }

  if (input.telefone && typeof input.telefone !== 'string') {
    errors.push({ field: 'telefone', message: 'Telefone deve ser uma string' });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

const sanitizeUserInput = (input) => ({
  nome: input.nome?.trim() || null,
  email: input.email?.trim() || null,
  data_nascimento: input.data_nascimento || input.dataNascimento || null,
  telefone: input.telefone?.trim() || null,
  cpf: input.cpf?.trim() || null,
});

export {
  toPublicProfile,
  toAdminUser,
  toAdminUserList,
  validateUserInput,
  sanitizeUserInput,
};
