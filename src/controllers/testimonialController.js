import { createClient } from '@supabase/supabase-js';
import { toPublicTestimonialList } from '../dto/testimonialDTO.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

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
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar testimonials:', error);
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
    console.error('Erro ao buscar testimonials:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
    });
  }
};

export default {
  getAllTestimonials,
};
