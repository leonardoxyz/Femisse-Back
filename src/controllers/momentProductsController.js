import supabase from '../services/supabaseClient.js';
import { toPublicMomentProductList } from '../dto/momentProductsDTO.js';
import { logger } from '../utils/logger.js';

export const getMomentProducts = async (req, res) => {
  try {
    const { data = [], error } = await supabase
      .from('moment_products')
      .select('*')
      .order('id', { ascending: true });
    
    if (error) throw error;

    const products = toPublicMomentProductList(data);

    res.json({
      success: true,
      data: products,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar produtos do momento',
      details: error.message,
    });
  }
};
