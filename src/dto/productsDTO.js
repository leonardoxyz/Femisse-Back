/**
 * DTO para produto público
 * Retorna apenas dados necessários para exibição no frontend
 * Não expõe IDs internos ou dados de auditoria
 */
const toPublicProduct = (product) => {
  const imagesList = product.images_urls ?? [];
  
  return {
    id: product.id,
    name: product.name,
    description: product.description ?? null,
    price: product.price,
    originalPrice: product.original_price ?? null,
    image: imagesList.length > 0 ? imagesList[0] : null,
    images: imagesList,
    badge: product.badge ?? null,
    badgeVariant: product.badge_variant ?? null,
    sizes: product.sizes ?? [],
    colors: product.colors ?? [],
    inStock: product.in_stock ?? true,
    stock: product.stock ?? null,
    categoriaId: product.categoria_id ?? null,
  };
};

const toPublicProductList = (products = []) =>
  (Array.isArray(products) ? products : []).map(toPublicProduct);

export {
  toPublicProduct,
  toPublicProductList,
};
