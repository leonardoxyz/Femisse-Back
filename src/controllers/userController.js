import supabase from '../services/supabaseClient.js';
import { 
  validateEmail,
  validateCPF,
  validatePhone,
  validateBirthDate,
  validateName,
  validateUUID,
} from '../utils/securityUtils.js';
import { toPublicProfile, toOwnerProfile } from '../dto/userDTO.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/validateEnv.js';

const isDevelopment = env.NODE_ENV !== 'production';
const isProduction = env.NODE_ENV === 'production';

export async function listUsers(req, res) {
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nome, email, data_nascimento, cpf, telefone, created_at');
    
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    logger.error({ err: err }, 'Erro ao listar usuários');
    res.status(500).json({ error: 'Erro ao listar usuários', details: err.message });
  }
}

export async function getUserById(req, res) {
  try {
    const { id } = req.params;
    
    // Valida UUID
    const uuidValidation = validateUUID(id);
    if (!uuidValidation.valid) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: uuidValidation.message
      });
    }
    
    logger.info({ id }, 'Buscando usuário com ID:');
    
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nome, email, data_nascimento, cpf, telefone, created_at')
      .eq('id', id)
      .single();
    
    logger.info({ data, error }, 'Resultado da busca');
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }
      throw error;
    }
    
    res.json(data);
  } catch (err) {
    logger.error({ err: err }, 'Erro ao buscar usuário');
    res.status(500).json({ error: 'Erro ao buscar usuário', details: err.message });
  }
}

export async function getMyProfile(req, res) {
  try {
    const userId = req.user.id; // ID do usuário autenticado
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nome, email, data_nascimento, cpf, telefone')
      .eq('id', userId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ success: false, message: 'Perfil não encontrado' });
      }
      throw error;
    }
    
    // ✅ Usuário autenticado vê seus próprios dados completos (não mascarados)
    const profile = toOwnerProfile(data);
    logger.info({ userId }, 'Profile retrieved');
    res.status(200).json({ success: true, data: profile });
  } catch (err) {
    logger.info({ error: err.message }, 'Error fetching profile');
    res.status(500).json({ success: false, message: 'Erro ao buscar perfil', details: err.message });
  }
}

export async function createUser(req, res) {
  try {
    const { nome, data_nascimento, cpf, telefone, email, senha_hash } = req.body;
    
    const { data, error } = await supabase
      .from('usuarios')
      .insert([{
        nome,
        data_nascimento,
        cpf,
        telefone,
        email,
        senha_hash
      }])
      .select()
      .single();
    
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    logger.error({ err: err }, 'Erro ao criar usuário');
    res.status(500).json({ error: 'Erro ao criar usuário', details: err.message });
  }
}

export async function updateUser(req, res) {
  try {
    const { id } = req.params;
    
    // Valida UUID
    const uuidValidation = validateUUID(id);
    if (!uuidValidation.valid) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: uuidValidation.message
      });
    }
    
    const { nome, data_nascimento, cpf, telefone, email } = req.body;
    
    // Valida e sanitiza dados
    const { errors, sanitized } = validateAndSanitizeProfileData({ nome, data_nascimento, cpf, telefone });
    
    if (errors.length > 0) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: errors
      });
    }
    
    // Valida email se fornecido
    if (email) {
      const emailValidation = validateEmail(email);
      if (!emailValidation.valid) {
        return res.status(400).json({ 
          error: 'Dados inválidos',
          details: [{ field: 'email', message: emailValidation.message }]
        });
      }
      sanitized.email = emailValidation.value;
    }
    
    const { data, error } = await supabase
      .from('usuarios')
      .update(sanitized)
      .eq('id', id)
      .select('id, nome, data_nascimento, cpf, telefone, email')
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }
      throw error;
    }
    
    res.json(data);
  } catch (err) {
    logger.error({ err: err }, 'Erro ao atualizar usuário');
    res.status(500).json({ error: 'Erro ao atualizar usuário', details: err.message });
  }
}

export async function deleteUser(req, res) {
  try {
    const { id } = req.params;
    
    // Valida UUID
    const uuidValidation = validateUUID(id);
    if (!uuidValidation.valid) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: uuidValidation.message
      });
    }
    
    const { data, error } = await supabase
      .from('usuarios')
      .delete()
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }
      throw error;
    }
    
    res.json({ message: 'Usuário deletado com sucesso' });
  } catch (err) {
    logger.error({ err: err }, 'Erro ao deletar usuário');
    res.status(500).json({ error: 'Erro ao deletar usuário', details: err.message });
  }
}

// Validações e sanitização usando utilitários centralizados
function validateAndSanitizeProfileData(data) {
  const errors = [];
  const sanitized = {};

  // Nome - obrigatório
  const nameValidation = validateName(data.nome);
  if (!nameValidation.valid) {
    errors.push({ field: 'nome', message: nameValidation.message });
  } else {
    sanitized.nome = nameValidation.value;
  }

  // Data de nascimento - opcional
  if (data.data_nascimento) {
    const birthDateValidation = validateBirthDate(data.data_nascimento);
    if (!birthDateValidation.valid) {
      errors.push({ field: 'data_nascimento', message: birthDateValidation.message });
    } else {
      sanitized.data_nascimento = birthDateValidation.value;
    }
  }

  // CPF - opcional
  if (data.cpf) {
    const cpfValidation = validateCPF(data.cpf);
    if (!cpfValidation.valid) {
      errors.push({ field: 'cpf', message: cpfValidation.message });
    } else {
      sanitized.cpf = cpfValidation.value;
    }
  }

  // Telefone - opcional
  if (data.telefone) {
    const phoneValidation = validatePhone(data.telefone);
    if (!phoneValidation.valid) {
      errors.push({ field: 'telefone', message: phoneValidation.message });
    } else {
      sanitized.telefone = phoneValidation.value;
    }
  }

  return { errors, sanitized };
}

// Função otimizada para atualizar perfil
export async function updateMyProfile(req, res) {
  try {
    const userId = req.user.id;
    
    // Validar e sanitizar dados
    const { errors, sanitized } = validateAndSanitizeProfileData(req.body);
    
    if (errors.length > 0) {
      return res.status(400).json({ 
        error: 'Dados inválidos', 
        details: errors 
      });
    }

    // Verificar se há campos para atualizar
    const fieldsToUpdate = Object.keys(sanitized);
    if (fieldsToUpdate.length === 0) {
      return res.status(400).json({ 
        error: 'Nenhum campo válido fornecido para atualização' 
      });
    }

    // Atualizar usando Supabase
    const { data, error } = await supabase
      .from('usuarios')
      .update(sanitized)
      .eq('id', userId)
      .select('id, nome, data_nascimento, cpf, telefone, email')
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
      }
      throw error;
    }

    // ✅ Usuário autenticado vê seus próprios dados completos (não mascarados)
    const profile = toOwnerProfile(data);
    logger.info({ userId }, 'Profile updated');
    
    res.json({
      success: true,
      message: 'Perfil atualizado com sucesso',
      data: profile
    });
    
  } catch (err) {
    logger.info({ 
      userId: req.user?.id,
      error: err.message,
      code: err.code
    }, 'Error updating profile');
    
    // Tratar erros específicos
    if (err.code === '23505') { // Violação de constraint única
      if (err.constraint?.includes('cpf')) {
        return res.status(409).json({ success: false, message: 'CPF já está em uso' });
      }
      if (err.constraint?.includes('email')) {
        return res.status(409).json({ success: false, message: 'Email já está em uso' });
      }
    }
    
    // Erro genérico (não expor detalhes internos)
    res.status(500).json({ 
      success: false,
      message: 'Erro interno do servidor' 
    });
  }
}
