import supabase from '../services/supabaseClient.js';
import { toPublicCategoryList } from '../dto/categoryDTO.js';
import { cacheGet, cacheSet, cacheDelete } from '../services/cacheService.js';
import { logger } from '../utils/logger.js';

const CATEGORIES_CACHE_KEY = 'cache:categories:all';
const CATEGORIES_CACHE_TTL = 300; // 5 minutos

export const getAllCategories = async (req, res) => {
  try {
    const cached = await cacheGet(CATEGORIES_CACHE_KEY);
    if (cached) {
      return res.json({ success: true, data: cached });
    }

    const { data = [], error } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true });
    
    if (error) throw error;
    const response = toPublicCategoryList(data);
    await cacheSet(CATEGORIES_CACHE_KEY, response, CATEGORIES_CACHE_TTL);
    res.json({ success: true, data: response });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar categorias',
      details: error.message,
    });
  }
};
