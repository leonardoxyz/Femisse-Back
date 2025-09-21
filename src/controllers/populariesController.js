import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export const getPopular = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('popular')
      .select('*')
      .order('id', { ascending: true });
    
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar produtos populares', details: error.message });
  }
};
