import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { 
  validateEmail,
  validateCPF,
  validatePhone,
  validateBirthDate,
  validateName,
  validateUUID,
  sanitizeString,
  secureLog, 
  getErrorMessage 
} from '../utils/securityUtils.js';
import { toPublicProfile } from '../dto/userDTO.js';

dotenv.config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const isDevelopment = process.env.NODE_ENV !== 'production';
const isProduction = process.env.NODE_ENV === 'production';

export async function listUsers(req, res) {
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*');
    
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('Erro ao listar usuários:', err);
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
    
    secureLog('Buscando usuário com ID:', { id });
    
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', id)
      .single();
    
    console.log('Resultado da busca:', { data, error });
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }
      throw error;
    }
    
    res.json(data);
  } catch (err) {
    console.error('Erro ao buscar usuário:', err);
    res.status(500).json({ error: 'Erro ao buscar usuário', details: err.message });
  }
}

export async function getMyProfile(req, res) {
  try {
    const userId = req.user.id; // ID do usuário autenticado
    console.log('🔍 Buscando perfil do usuário:', userId);
    
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nome, email, data_nascimento, cpf, telefone')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error('❌ Erro ao buscar perfil:', error);
      if (error.code === 'PGRST116') {
        return res.status(404).json({ success: false, message: 'Perfil não encontrado' });
      }
      throw error;
    }
    
    console.log('✅ Dados do banco:', data);
    const profile = toPublicProfile(data);
    console.log('✅ Perfil após DTO:', profile);
    res.json({ success: true, data: profile });
  } catch (err) {
    console.error('❌ Erro ao buscar perfil:', err);
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
    console.error('Erro ao criar usuário:', err);
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
    console.error('Erro ao atualizar usuário:', err);
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
    console.error('Erro ao deletar usuário:', err);
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
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }
      throw error;
    }

    // Não retornar dados sensíveis
    const user = data;
    const safeUser = {
      id: user.id,
      nome: user.nome,
      data_nascimento: user.data_nascimento,
      cpf: user.cpf,
      telefone: user.telefone,
      email: user.email
    };

    res.json({
      message: 'Perfil atualizado com sucesso',
      user: safeUser
    });
    
  } catch (err) {
    // Log do erro (em produção, usar logger profissional)
    console.error('Erro ao atualizar perfil:', {
      userId: req.user?.id,
      error: err.message,
      code: err.code
    });
    
    // Tratar erros específicos
    if (err.code === '23505') { // Violação de constraint única
      if (err.constraint?.includes('cpf')) {
        return res.status(409).json({ error: 'CPF já está em uso' });
      }
      if (err.constraint?.includes('email')) {
        return res.status(409).json({ error: 'Email já está em uso' });
      }
    }
    
    // Erro genérico (não expor detalhes internos)
    res.status(500).json({ 
      error: 'Erro interno do servidor' 
    });
  }
}
