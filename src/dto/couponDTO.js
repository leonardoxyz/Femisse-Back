/**
 * DTO para Cupons - Formata respostas de cupons
 */

/**
 * Formata resposta de validação de cupom (cliente)
 */
export const toCouponValidationResponse = (coupon, discount, applicableItems) => ({
  valid: true,
  coupon_id: coupon.id,
  code: coupon.code,
  description: coupon.description || null,
  discount_type: coupon.discount_type,
  discount_value: coupon.discount_value,
  discount_amount: discount,
  min_purchase: coupon.min_purchase || null,
  max_discount: coupon.max_discount || null,
  applicable_categories: coupon.applicable_categories || [],
  applicable_items_count: applicableItems?.length || 0,
});

/**
 * Formata cupom público (sem dados sensíveis)
 */
export const toPublicCoupon = (coupon) => ({
  id: coupon.id,
  code: coupon.code,
  description: coupon.description || null,
  discount_type: coupon.discount_type,
  discount_value: coupon.discount_value,
  min_purchase: coupon.min_purchase || null,
  max_discount: coupon.max_discount || null,
  applicable_categories: coupon.applicable_categories || [],
  valid_from: coupon.valid_from,
  valid_to: coupon.valid_to || null,
  active: coupon.active,
});

/**
 * Formata lista de cupons públicos
 */
export const toPublicCouponList = (coupons) => {
  if (!Array.isArray(coupons)) return [];
  return coupons.map(toPublicCoupon);
};

/**
 * Formata cupom completo (admin)
 */
export const toAdminCoupon = (coupon) => ({
  ...toPublicCoupon(coupon),
  usage_count: coupon.usage_count || 0,
  max_uses: coupon.max_uses || null,
  max_uses_per_user: coupon.max_uses_per_user || null,
  created_at: coupon.created_at,
  updated_at: coupon.updated_at,
});

/**
 * Formata lista de cupons (admin)
 */
export const toAdminCouponList = (coupons) => {
  if (!Array.isArray(coupons)) return [];
  return coupons.map(toAdminCoupon);
};

/**
 * Formata resposta de erro de cupom
 */
export const toCouponErrorResponse = (error, message) => ({
  valid: false,
  error,
  message,
});
