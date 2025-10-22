const toPublicMomentProduct = (product) => ({
  title: product.title,
  imageUrl: product.image_url ?? null,
});

const toPublicMomentProductList = (products = []) =>
  (Array.isArray(products) ? products : []).map(toPublicMomentProduct);

export {
  toPublicMomentProduct,
  toPublicMomentProductList,
};
