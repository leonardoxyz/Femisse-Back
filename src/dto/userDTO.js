import { maskCPF, maskEmail, maskPhone, maskBirthDate } from '../utils/dataMasking.js';

/**
 * DTO para perfil público do usuário
 * Retorna apenas dados necessários para o frontend
 * Dados sensíveis são mascarados conforme LGPD
 */
const toPublicProfile = (user) => ({
  id: user.id, // ✅ ID é necessário para autenticação
  nome: user.nome ?? null,
  email: maskEmail(user.email), // 🔒 Mascarado
  data_nascimento: maskBirthDate(user.data_nascimento), // 🔒 Apenas ano
  cpf: maskCPF(user.cpf), // 🔒 Mascarado
  telefone: maskPhone(user.telefone), // 🔒 Mascarado
});

/**
 * DTO para perfil completo do próprio usuário (autenticado)
 * Retorna dados completos apenas para o dono da conta
 */
const toOwnerProfile = (user) => ({
  id: user.id,
  nome: user.nome ?? null,
  email: user.email ?? null, // ✅ Email completo
  data_nascimento: user.data_nascimento ?? null, // ✅ Data completa
  cpf: user.cpf ?? null, // ✅ CPF completo
  telefone: user.telefone ?? null, // ✅ Telefone completo
});

export {
  toPublicProfile,
  toOwnerProfile,
};
