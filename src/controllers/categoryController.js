import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export const getAllCategories = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true });
    
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar categorias', details: error.message });
  }
};

export const createCategory = async (req, res) => {
  const { name, image, link } = req.body;
  if (!name || !image) {
    return res.status(400).json({ error: 'Nome e imagem são obrigatórios' });
  }
  try {
    const { data, error } = await supabase
      .from('categories')
      .insert([{ name, image, link: link || null }])
      .select()
      .single();
    
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar categoria', details: error.message });
  }
};
