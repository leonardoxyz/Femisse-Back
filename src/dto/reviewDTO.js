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
