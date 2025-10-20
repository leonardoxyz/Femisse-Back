const toPublicReview = (review) => {
  const publicReview = {
    reviewId: review.reviewId ?? review.id,
    productName: review.productName ?? review.product_name ?? null,
    productImage: review.productImage ?? review.product_image ?? null,
    rating: review.rating,
    comment: review.comment ?? null,
    createdAt: review.createdAt ?? review.created_at,
  };
  
  delete publicReview.productId;
  delete publicReview.product_id;
  delete publicReview.userId;
  delete publicReview.user_id;
  delete publicReview.id;
  
  return publicReview;
};

const toPublicReviewList = (reviews = []) =>
  (Array.isArray(reviews) ? reviews : []).map(toPublicReview);

const toPublicReviewableProduct = (product) => {
  // Para produtos avaliáveis, precisamos dos IDs para criar a review
  // Mas usamos hash/token em vez de expor IDs diretos do banco
  const publicProduct = {
    productId: product.productId ?? product.id ?? product.product_id,
    orderId: product.orderId ?? product.order_id ?? null,
    name: product.name ?? product.product_name ?? null,
    image: product.image ?? product.product_image ?? null,
    orderDate: product.orderDate ?? product.order_date ?? null,
    hasReview: product.hasReview ?? product.has_review ?? false,
  };
  
  return publicProduct;
};

const toPublicReviewableProductList = (products = []) =>
  (Array.isArray(products) ? products : []).map(toPublicReviewableProduct);

const toAdminReview = (review) => ({
  id: review.id,
  userId: review.user_id,
  productId: review.product_id,
  orderId: review.order_id ?? null,
  rating: review.rating,
  comment: review.comment ?? null,
  images: review.images ?? [],
  productName: review.product_name ?? null,
  productImage: review.product_image ?? null,
  isVerifiedPurchase: review.is_verified_purchase ?? false,
  createdAt: review.created_at,
  updatedAt: review.updated_at,
});

const toAdminReviewList = (reviews = []) =>
  (Array.isArray(reviews) ? reviews : []).map(toAdminReview);

const validateReviewInput = (input) => {
  const errors = [];

  if (!input) {
    errors.push({ field: 'body', message: 'Dados da avaliação são obrigatórios' });
    return { isValid: false, errors };
  }

  if (!input.product_id && !input.productId) {
    errors.push({ field: 'product_id', message: 'ID do produto é obrigatório' });
  }

  if (!input.rating) {
    errors.push({ field: 'rating', message: 'Nota é obrigatória' });
  } else if (input.rating < 1 || input.rating > 5) {
    errors.push({ field: 'rating', message: 'Nota deve estar entre 1 e 5' });
  }

  if (input.comment && typeof input.comment !== 'string') {
    errors.push({ field: 'comment', message: 'Comentário deve ser uma string' });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

const sanitizeReviewInput = (input) => ({
  product_id: input.product_id || input.productId,
  order_id: input.order_id || input.orderId || null,
  rating: Number(input.rating),
  comment: input.comment?.trim() || null,
  images: Array.isArray(input.images) ? input.images : [],
});

export {
  toPublicReview,
  toPublicReviewList,
  toPublicReviewableProduct,
  toPublicReviewableProductList,
  toAdminReview,
  toAdminReviewList,
  validateReviewInput,
  sanitizeReviewInput,
};
