import { createClient } from '@supabase/supabase-js';
import {
  toPublicTestimonialList,
  toAdminTestimonial,
  toAdminTestimonialList,
  validateCreateTestimonial,
  sanitizeTestimonialInput,
} from '../dto/testimonialDTO.js';

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

/**
 * GET /api/testimonials/admin
 * Retorna todos os depoimentos (admin - com ID)
 * Requer autenticação
 */
const getAllTestimonialsAdmin = async (req, res) => {
  try {
    const { data: testimonials, error } = await supabase
      .from('testimonials')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar testimonials (admin):', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao buscar depoimentos',
      });
    }

    // Usar DTO admin que inclui ID
    const adminTestimonials = toAdminTestimonialList(testimonials);

    return res.status(200).json({
      success: true,
      data: adminTestimonials,
    });
  } catch (error) {
    console.error('Erro ao buscar testimonials (admin):', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
    });
  }
};

/**
 * GET /api/testimonials/:id
 * Retorna um depoimento específico (admin)
 * Requer autenticação
 */
const getTestimonialById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'ID do depoimento é obrigatório',
      });
    }

    const { data: testimonial, error } = await supabase
      .from('testimonials')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !testimonial) {
      return res.status(404).json({
        success: false,
        message: 'Depoimento não encontrado',
      });
    }

    const adminTestimonial = toAdminTestimonial(testimonial);

    return res.status(200).json({
      success: true,
      data: adminTestimonial,
    });
  } catch (error) {
    console.error('Erro ao buscar testimonial:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
    });
  }
};

/**
 * POST /api/testimonials
 * Cria um novo depoimento
 * Requer autenticação
 */
const createTestimonial = async (req, res) => {
  try {
    // Validar dados de entrada
    const validation = validateCreateTestimonial(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: validation.errors,
      });
    }

    // Sanitizar dados
    const sanitizedData = sanitizeTestimonialInput(req.body);

    // Inserir no banco
    const { data: testimonial, error } = await supabase
      .from('testimonials')
      .insert([sanitizedData])
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar testimonial:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao criar depoimento',
      });
    }

    const adminTestimonial = toAdminTestimonial(testimonial);

    return res.status(201).json({
      success: true,
      message: 'Depoimento criado com sucesso',
      data: adminTestimonial,
    });
  } catch (error) {
    console.error('Erro ao criar testimonial:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
    });
  }
};

/**
 * PUT /api/testimonials/:id
 * Atualiza um depoimento existente
 * Requer autenticação
 */
const updateTestimonial = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'ID do depoimento é obrigatório',
      });
    }

    // Validar dados de entrada
    const validation = validateCreateTestimonial(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: validation.errors,
      });
    }

    // Sanitizar dados
    const sanitizedData = sanitizeTestimonialInput(req.body);

    // Atualizar no banco
    const { data: testimonial, error } = await supabase
      .from('testimonials')
      .update(sanitizedData)
      .eq('id', id)
      .select()
      .single();

    if (error || !testimonial) {
      return res.status(404).json({
        success: false,
        message: 'Depoimento não encontrado',
      });
    }

    const adminTestimonial = toAdminTestimonial(testimonial);

    return res.status(200).json({
      success: true,
      message: 'Depoimento atualizado com sucesso',
      data: adminTestimonial,
    });
  } catch (error) {
    console.error('Erro ao atualizar testimonial:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
    });
  }
};

/**
 * DELETE /api/testimonials/:id
 * Deleta um depoimento (soft delete - marca como inativo)
 * Requer autenticação
 */
const deleteTestimonial = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'ID do depoimento é obrigatório',
      });
    }

    // Soft delete - apenas marca como inativo
    const { data: testimonial, error } = await supabase
      .from('testimonials')
      .update({ is_active: false })
      .eq('id', id)
      .select()
      .single();

    if (error || !testimonial) {
      return res.status(404).json({
        success: false,
        message: 'Depoimento não encontrado',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Depoimento removido com sucesso',
    });
  } catch (error) {
    console.error('Erro ao deletar testimonial:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
    });
  }
};

/**
 * PATCH /api/testimonials/:id/toggle
 * Ativa/desativa um depoimento
 * Requer autenticação
 */
const toggleTestimonial = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'ID do depoimento é obrigatório',
      });
    }

    // Buscar estado atual
    const { data: currentTestimonial, error: fetchError } = await supabase
      .from('testimonials')
      .select('is_active')
      .eq('id', id)
      .single();

    if (fetchError || !currentTestimonial) {
      return res.status(404).json({
        success: false,
        message: 'Depoimento não encontrado',
      });
    }

    // Inverter estado
    const newState = !currentTestimonial.is_active;

    const { data: testimonial, error } = await supabase
      .from('testimonials')
      .update({ is_active: newState })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Erro ao atualizar depoimento',
      });
    }

    const adminTestimonial = toAdminTestimonial(testimonial);

    return res.status(200).json({
      success: true,
      message: `Depoimento ${newState ? 'ativado' : 'desativado'} com sucesso`,
      data: adminTestimonial,
    });
  } catch (error) {
    console.error('Erro ao alternar testimonial:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
    });
  }
};

export default {
  getAllTestimonials,
  getAllTestimonialsAdmin,
  getTestimonialById,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
  toggleTestimonial,
};
