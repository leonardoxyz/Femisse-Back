import { pool } from '../db/index.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'segredo_dev';

export async function register(req, res) {
  try {
    const { nome, data_nascimento, cpf, telefone, email, senha } = req.body;
    const senha_hash = await bcrypt.hash(senha, 10);
    const result = await pool.query(
      'INSERT INTO usuarios (nome, data_nascimento, cpf, telefone, email, senha_hash) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [nome, data_nascimento, cpf, telefone, email, senha_hash]
    );
    res.status(201).json({ usuario: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'E-mail ou CPF já cadastrado' });
    }
    res.status(500).json({ error: 'Erro ao registrar usuário' });
  }
}

export async function login(req, res) {
  try {
    const { email, senha } = req.body;
    const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'E-mail ou senha inválidos' });
    const usuario = result.rows[0];
    const senhaOk = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaOk) return res.status(401).json({ error: 'E-mail ou senha inválidos' });
    const token = jwt.sign({ id: usuario.id, email: usuario.email, nome: usuario.nome }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email } });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao fazer login' });
  }
}
