/**
 * DTO para perfil público do usuário
 * Retorna apenas dados necessários para o frontend
 * Não expõe dados sensíveis desnecessários
 */
const toPublicProfile = (user) => ({
  id: user.id, // ✅ ID é necessário para autenticação
  nome: user.nome ?? null,
  email: user.email ?? null,
  data_nascimento: user.data_nascimento ?? null,
  cpf: user.cpf ?? null,
  telefone: user.telefone ?? null,
});

export {
  toPublicProfile,
};
