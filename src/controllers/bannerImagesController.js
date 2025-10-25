import supabase from '../services/supabaseClient.js';
import { toPublicBannerImageList } from '../dto/bannerImageDTO.js';
import { logger } from '../utils/logger.js';

export const getBannerImages = async (req, res) => {
  try {
    const layoutParam = (req.query.layout || '').toString().trim().toLowerCase();

    let query = supabase
      .from('banner_images')
      .select('*')
      .order('id', { ascending: true });

    if (layoutParam) {
      query = query.eq('target_layout', layoutParam);
    }

    const { data = [], error } = await query;
    
    if (error) throw error;

    const banners = toPublicBannerImageList(data);

    res.json({
      success: true,
      data: banners,
    });
  } catch (error) {
    logger.error('Erro ao buscar imagens do banner', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar imagens do banner',
      details: error.message,
    });
  }
};
