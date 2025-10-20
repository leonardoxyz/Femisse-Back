/**
 * DTO (Data Transfer Object) para Testimonials
 * 
 * Remove campos sensíveis e formata dados para o frontend
 */

/**
 * Converte um testimonial do banco para o formato público
 * Remove ID e outros campos internos
 */
const toPublicTestimonial = (testimonial) => {
  if (!testimonial) return null;

  return {
    name: testimonial.name,
    city: testimonial.city,
    comment: testimonial.comment,
    rating: testimonial.rating,
    avatar: testimonial.avatar_url,
    createdAt: testimonial.created_at,
  };
};

/**
 * Converte array de testimonials para formato público
 */
const toPublicTestimonialList = (testimonials) => {
  if (!Array.isArray(testimonials)) return [];
  return testimonials.map(toPublicTestimonial);
};

/**
 * Converte um testimonial do banco para o formato admin
 * Inclui todos os campos incluindo ID
 */
const toAdminTestimonial = (testimonial) => {
  if (!testimonial) return null;

  return {
    id: testimonial.id,
    name: testimonial.name,
    city: testimonial.city,
    comment: testimonial.comment,
    rating: testimonial.rating,
    avatar: testimonial.avatar_url,
    isActive: testimonial.is_active,
    createdAt: testimonial.created_at,
    updatedAt: testimonial.updated_at,
  };
};

/**
 * Converte array de testimonials para formato admin
 */
const toAdminTestimonialList = (testimonials) => {
  if (!Array.isArray(testimonials)) return [];
  return testimonials.map(toAdminTestimonial);
};

/**
 * Valida dados de criação de testimonial
 */
const validateCreateTestimonial = (data) => {
  const errors = [];

  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.push('Nome é obrigatório');
  }

  if (!data.city || typeof data.city !== 'string' || data.city.trim().length === 0) {
    errors.push('Cidade é obrigatória');
  }

  if (!data.comment || typeof data.comment !== 'string' || data.comment.trim().length === 0) {
    errors.push('Comentário é obrigatório');
  }

  if (data.comment && data.comment.length > 1000) {
    errors.push('Comentário não pode ter mais de 1000 caracteres');
  }

  if (!data.rating || typeof data.rating !== 'number' || data.rating < 1 || data.rating > 5) {
    errors.push('Avaliação deve ser um número entre 1 e 5');
  }

  if (data.avatar_url && typeof data.avatar_url !== 'string') {
    errors.push('URL do avatar inválida');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Sanitiza dados de entrada
 */
const sanitizeTestimonialInput = (data) => {
  return {
    name: data.name?.trim(),
    city: data.city?.trim(),
    comment: data.comment?.trim(),
    rating: parseInt(data.rating, 10),
    avatar_url: data.avatar_url?.trim() || null,
    is_active: data.is_active !== undefined ? Boolean(data.is_active) : true,
  };
};

export {
  toPublicTestimonial,
  toPublicTestimonialList,
  toAdminTestimonial,
  toAdminTestimonialList,
  validateCreateTestimonial,
  sanitizeTestimonialInput,
};
