import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

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
    console.log('Buscando usuário com ID:', id);
    
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
    console.log('Buscando perfil do usuário logado:', userId);
    
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', userId)
      .single();
    
    console.log('Resultado da busca do perfil:', { data, error });
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Perfil não encontrado' });
      }
      throw error;
    }
    
    res.json(data);
  } catch (err) {
    console.error('Erro ao buscar perfil:', err);
    res.status(500).json({ error: 'Erro ao buscar perfil', details: err.message });
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
    const { nome, data_nascimento, cpf, telefone, email } = req.body;
    
    const { data, error } = await supabase
      .from('usuarios')
      .update({
        nome,
        data_nascimento,
        cpf,
        telefone,
        email
      })
      .eq('id', id)
      .select()
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

// Validações e sanitização
function validateAndSanitizeProfileData(data) {
  const errors = [];
  const sanitized = {};

  // Nome - obrigatório
  if (!data.nome || typeof data.nome !== 'string') {
    errors.push('Nome é obrigatório');
  } else {
    const nome = data.nome.trim();
    if (nome.length < 2 || nome.length > 100) {
      errors.push('Nome deve ter entre 2 e 100 caracteres');
    } else if (!/^[a-zA-ZÀ-ÿ\s]+$/.test(nome)) {
      errors.push('Nome deve conter apenas letras e espaços');
    } else {
      sanitized.nome = nome;
    }
  }

  // Data de nascimento - opcional
  if (data.data_nascimento) {
    const date = new Date(data.data_nascimento);
    if (isNaN(date.getTime())) {
      errors.push('Data de nascimento inválida');
    } else if (date > new Date()) {
      errors.push('Data de nascimento não pode ser futura');
    } else {
      sanitized.data_nascimento = data.data_nascimento;
    }
  }

  // CPF - opcional, mas se fornecido deve ser válido
  if (data.cpf) {
    const cpf = data.cpf.replace(/\D/g, '');
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) {
      errors.push('CPF inválido');
    } else {
      sanitized.cpf = cpf;
    }
  }

  // Telefone - opcional
  if (data.telefone) {
    const telefone = data.telefone.replace(/\D/g, '');
    if (telefone.length < 10 || telefone.length > 11) {
      errors.push('Telefone deve ter 10 ou 11 dígitos');
    } else {
      sanitized.telefone = telefone;
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
