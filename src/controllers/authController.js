import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const isDevelopment = process.env.NODE_ENV !== 'production';
const isProduction = process.env.NODE_ENV === 'production';

// Configuração do Supabase baseada no ambiente
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

console.log('Environment:', { 
  NODE_ENV: process.env.NODE_ENV, 
  isDevelopment, 
  isProduction,
  hasSupabaseUrl: !!supabaseUrl,
  hasSupabaseKey: !!supabaseKey
});

const supabase = createClient(supabaseUrl, supabaseKey);
const JWT_SECRET = process.env.JWT_SECRET || 'segredo_dev';

export async function register(req, res) {
  try {
    console.log('Register attempt:', req.body);
    
    const { nome, data_nascimento, cpf, telefone, email, senha } = req.body;
    
    if (!nome || !email || !senha) {
      return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
    }
    
    const senha_hash = await bcrypt.hash(senha, 10);
    console.log('Password hashed successfully');
    
    const userData = {
      nome,
      data_nascimento,
      cpf,
      telefone,
      email,
      senha_hash
    };
    
    console.log('Inserting user data:', { ...userData, senha_hash: '[HIDDEN]' });
    
    const { data, error } = await supabase
      .from('usuarios')
      .insert([userData])
      .select()
      .single();
    
    console.log('Supabase insert result:', { data, error });
    
    if (error) {
      console.error('Supabase insert error:', error);
      if (error.code === '23505' || error.message.includes('duplicate')) {
        return res.status(409).json({ error: 'E-mail ou CPF já cadastrado' });
      }
      throw error;
    }
    
    console.log('User registered successfully:', data.email);
    res.status(201).json({ usuario: data });
  } catch (err) {
    console.error('Erro no registro:', err);
    res.status(500).json({ error: 'Erro ao registrar usuário', details: err.message });
  }
}

export async function login(req, res) {
  try {
    console.log('Login attempt:', { email: req.body.email, hasPassword: !!req.body.senha });
    
    const { email, senha } = req.body;
    
    if (!email || !senha) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }
    
    console.log('Searching for user with email:', email);
    
    const { data: usuarios, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', email);
    
    console.log('Supabase query result:', { usuarios, error });
    
    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }
    
    if (!usuarios || usuarios.length === 0) {
      console.log('User not found');
      return res.status(401).json({ error: 'E-mail ou senha inválidos' });
    }
    
    const usuario = usuarios[0];
    console.log('User found:', { id: usuario.id, email: usuario.email, hasHash: !!usuario.senha_hash });
    
    const senhaOk = await bcrypt.compare(senha, usuario.senha_hash);
    console.log('Password check result:', senhaOk);
    
    if (!senhaOk) {
      return res.status(401).json({ error: 'E-mail ou senha inválidos' });
    }
    
    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, nome: usuario.nome }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );
    
    console.log('Login successful for user:', usuario.email);
    
    res.json({ 
      token, 
      usuario: { 
        id: usuario.id, 
        nome: usuario.nome, 
        email: usuario.email 
      } 
    });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ error: 'Erro ao fazer login', details: err.message });
  }
}
