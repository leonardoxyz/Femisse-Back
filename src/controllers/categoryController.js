import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { cacheGet, cacheSet, cacheDelete } from '../services/cacheService.js';

dotenv.config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const CATEGORIES_CACHE_KEY = 'cache:categories:all';
const CATEGORIES_CACHE_TTL = 300; // 5 minutos

export const getAllCategories = async (req, res) => {
  try {
    const cached = await cacheGet(CATEGORIES_CACHE_KEY);
    if (cached) {
      return res.json(cached);
    }

    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true });
    
    if (error) throw error;
    const response = data || [];
    await cacheSet(CATEGORIES_CACHE_KEY, response, CATEGORIES_CACHE_TTL);
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar categorias', details: error.message });
  }
};

export const createCategory = async (req, res) => {
  const { name, image, link } = req.validatedBody ?? req.body;
  try {
    const { data, error } = await supabase
      .from('categories')
      .insert([{ name, image, link: link || null }])
      .select()
      .single();
    
    if (error) throw error;
    await cacheDelete(CATEGORIES_CACHE_KEY);
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar categoria', details: error.message });
  }
};
