import { createClient } from '@supabase/supabase-js';
import { toPublicBannerImageList } from '../dto/bannerImageDTO.js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export const getBannerImages = async (req, res) => {
  try {
    const { data = [], error } = await supabase
      .from('banner_images')
      .select('*')
      .order('id', { ascending: true });
    
    if (error) throw error;

    const banners = toPublicBannerImageList(data);

    res.json({
      success: true,
      data: banners,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar imagens do banner',
      details: error.message,
    });
  }
};
