import supabase from '../services/supabaseClient.js';
import { toPublicCategoryList } from '../dto/categoryDTO.js';
import { cacheGet, cacheSet } from '../services/cacheService.js';

const CATEGORIES_CACHE_KEY = 'cache:categories:all';
const HOME_GRID_CACHE_KEY = 'cache:categories:home_grid';
const CATEGORIES_CACHE_TTL = 300; // 5 minutos

export const getAllCategories = async (req, res) => {
  try {
    const homeGridOnly = String(req.query.homeGrid ?? req.query.grid ?? '').toLowerCase() === 'true';
    const cacheKey = homeGridOnly ? HOME_GRID_CACHE_KEY : CATEGORIES_CACHE_KEY;

    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res.json({ success: true, data: cached });
    }

    let query = supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true });

    if (homeGridOnly) {
      query = query.eq('show_in_home_grid', true);
    }

    const { data = [], error } = await query;
    
    if (error) throw error;
    const response = toPublicCategoryList(data);
    await cacheSet(cacheKey, response, CATEGORIES_CACHE_TTL);
    res.json({ success: true, data: response });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar categorias',
      details: error.message,
    });
  }
};
