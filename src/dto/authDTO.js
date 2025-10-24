/**
 * DTO para Auth - Remove dados sensíveis das respostas de autenticação
 */

/**
 * Formata resposta de registro/login
 */
export const toAuthResponse = (user, tokens = null) => {
  const response = {
    id: user.id,
    nome: user.nome,
    email: user.email,
    cpf: user.cpf || null,
    telefone: user.telefone || null,
    data_nascimento: user.data_nascimento || null,
    created_at: user.created_at,
  };

  // Adiciona tokens se fornecidos
  if (tokens) {
    response.accessToken = tokens.accessToken;
    response.refreshToken = tokens.refreshToken;
  }

  return response;
};

/**
 * Formata lista de usuários (apenas dados públicos)
 */
export const toAuthUserList = (users) => {
  if (!Array.isArray(users)) return [];
  
  return users.map(user => ({
    id: user.id,
    nome: user.nome,
    email: user.email,
    created_at: user.created_at,
  }));
};

/**
 * Formata resposta de refresh token
 */
export const toRefreshTokenResponse = (tokens) => ({
  accessToken: tokens.accessToken,
  refreshToken: tokens.refreshToken,
});

/**
 * Formata resposta de logout
 */
export const toLogoutResponse = () => ({
  message: 'Logout realizado com sucesso',
});
