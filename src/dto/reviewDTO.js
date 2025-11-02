const getDisplayName = (rawName) => {
  if (typeof rawName !== 'string') {
    return null;
  }

  const trimmed = rawName.trim();
  if (!trimmed) {
    return null;
  }

  const [firstName] = trimmed.split(/\s+/);
  return firstName || trimmed;
};

const toPublicReview = (review) => {
  const rawName = review.userDisplayName ?? review.userName ?? review.user_name ?? review.nome ?? null;
  const userName = getDisplayName(rawName) ?? 'Cliente Femisse';

  return {
    rating: review.rating,
    comment: review.comment ?? null,
    createdAt: review.createdAt ?? review.created_at,
    updatedAt: review.updatedAt ?? review.updated_at ?? null,
    userName,
  };
};

const toPublicReviewList = (reviews = []) =>
  (Array.isArray(reviews) ? reviews : []).map(toPublicReview);

const toPublicReviewableProduct = (product) => {
  const publicProduct = {
    id: product.productId ?? product.product_id ?? null,
    productId: product.productId ?? product.product_id ?? null,
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

export {
  toPublicReview,
  toPublicReviewList,
  toPublicReviewableProduct,
  toPublicReviewableProductList,
};
