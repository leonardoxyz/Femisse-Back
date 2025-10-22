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

export {
  toPublicTestimonial,
  toPublicTestimonialList,
};
