import { createClient } from '@supabase/supabase-js';
import { toPublicPopularList } from '../dto/popularDTO.js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export const getPopular = async (req, res) => {
  try {
    const { data = [], error } = await supabase
      .from('popular')
      .select('*')
      .order('id', { ascending: true });
    
    if (error) throw error;

    const populars = toPublicPopularList(data);

    res.json({
      success: true,
      data: populars,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar produtos populares',
      details: error.message,
    });
  }
};
