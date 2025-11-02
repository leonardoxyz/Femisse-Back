import supabase from '../services/supabaseClient.js';
import { toPublicTestimonialList } from '../dto/testimonialDTO.js';
import { logger } from '../utils/logger.js';

/**
 * GET /api/testimonials
 * Retorna todos os depoimentos ativos (público - sem ID)
 */
const getAllTestimonials = async (req, res) => {
  try {
    const { data: testimonials, error } = await supabase
      .from('testimonials')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false});

    if (error) {
      logger.error({ err: error }, 'Erro ao buscar testimonials');
      return res.status(500).json({
        success: false,
        message: 'Erro ao buscar depoimentos',
      });
    }

    // Usar DTO para remover IDs e campos sensíveis
    const publicTestimonials = toPublicTestimonialList(testimonials);

    return res.status(200).json({
      success: true,
      data: publicTestimonials,
    });
  } catch (error) {
    logger.error({ err: error }, 'Erro ao buscar testimonials');
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
    });
  }
};

export default {
  getAllTestimonials,
};
