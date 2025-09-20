import { pool } from '../db/index.js';

export async function listUsers(req, res) {
  try {
    const result = await pool.query('SELECT * FROM usuarios');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar usuários' });
  }
}

export async function getUserById(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM usuarios WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar usuário' });
  }
}

export async function createUser(req, res) {
  try {
    const { nome, data_nascimento, cpf, telefone, email, senha_hash } = req.body;
    const result = await pool.query(
      'INSERT INTO usuarios (nome, data_nascimento, cpf, telefone, email, senha_hash) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [nome, data_nascimento, cpf, telefone, email, senha_hash]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar usuário' });
  }
}

export async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const { nome, data_nascimento, cpf, telefone, email } = req.body;
    const result = await pool.query(
      'UPDATE usuarios SET nome=$1, data_nascimento=$2, cpf=$3, telefone=$4, email=$5 WHERE id=$6 RETURNING *',
      [nome, data_nascimento, cpf, telefone, email, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar usuário' });
  }
}

export async function deleteUser(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM usuarios WHERE id=$1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json({ message: 'Usuário deletado com sucesso' });
  } catch (err) {
    res.status(500).json({ error: err });
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

    // Construir query de forma segura
    const setClause = fieldsToUpdate
      .map((field, index) => `${field} = $${index + 1}`)
      .join(', ');
    
    const values = [...Object.values(sanitized), userId];
    
    const query = `
      UPDATE usuarios 
      SET ${setClause}
      WHERE id = $${values.length} 
      RETURNING id, nome, data_nascimento, cpf, telefone, email
    `;
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Não retornar dados sensíveis
    const user = result.rows[0];
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
