const toPublicProduct = (product) => ({
  name: product.name,
  description: product.description ?? null,
  price: product.price,
  originalPrice: product.original_price ?? null,
  image: product.image ?? null,
  images: product.images ?? [],
  badge: product.badge ?? null,
  badgeVariant: product.badge_variant ?? null,
  sizes: product.sizes ?? [],
  colors: product.colors ?? [],
  inStock: product.in_stock ?? true,
  stock: product.stock ?? null,
});

const toPublicProductList = (products = []) =>
  (Array.isArray(products) ? products : []).map(toPublicProduct);

const toAdminProduct = (product) => ({
  id: product.id,
  name: product.name,
  description: product.description ?? null,
  price: product.price,
  originalPrice: product.original_price ?? null,
  image: product.image ?? null,
  images: product.images ?? [],
  imageIds: product.image_ids ?? [],
  badge: product.badge ?? null,
  badgeVariant: product.badge_variant ?? null,
  sizes: product.sizes ?? [],
  colors: product.colors ?? [],
  inStock: product.in_stock ?? true,
  stock: product.stock ?? null,
  categoriaId: product.categoria_id ?? null,
  createdAt: product.created_at,
  updatedAt: product.updated_at,
});

const toAdminProductList = (products = []) =>
  (Array.isArray(products) ? products : []).map(toAdminProduct);

const validateProductInput = (input) => {
  const errors = [];

  if (!input) {
    errors.push({ field: 'body', message: 'Dados do produto são obrigatórios' });
    return { isValid: false, errors };
  }

  const name = input.name?.trim();
  if (!name) {
    errors.push({ field: 'name', message: 'Nome é obrigatório' });
  } else if (name.length < 2) {
    errors.push({ field: 'name', message: 'Nome deve ter pelo menos 2 caracteres' });
  } else if (name.length > 200) {
    errors.push({ field: 'name', message: 'Nome deve ter no máximo 200 caracteres' });
  }

  if (input.price === undefined || input.price === null) {
    errors.push({ field: 'price', message: 'Preço é obrigatório' });
  } else if (Number.isNaN(Number(input.price)) || Number(input.price) < 0) {
    errors.push({ field: 'price', message: 'Preço deve ser um número válido e não negativo' });
  }

  if (input.original_price !== undefined && input.original_price !== null) {
    if (Number.isNaN(Number(input.original_price)) || Number(input.original_price) < 0) {
      errors.push({ field: 'original_price', message: 'Preço original deve ser um número válido e não negativo' });
    }
  }

  if (input.description && typeof input.description !== 'string') {
    errors.push({ field: 'description', message: 'Descrição deve ser uma string' });
  }

  if (input.image && typeof input.image !== 'string') {
    errors.push({ field: 'image', message: 'Imagem deve ser uma string' });
  }

  if (input.images && !Array.isArray(input.images)) {
    errors.push({ field: 'images', message: 'Images deve ser um array' });
  }

  if (input.image_ids && !Array.isArray(input.image_ids)) {
    errors.push({ field: 'image_ids', message: 'Image IDs deve ser um array' });
  }

  if (input.sizes && !Array.isArray(input.sizes)) {
    errors.push({ field: 'sizes', message: 'Sizes deve ser um array' });
  }

  if (input.colors && !Array.isArray(input.colors)) {
    errors.push({ field: 'colors', message: 'Colors deve ser um array' });
  }

  if (input.stock !== undefined && input.stock !== null) {
    if (Number.isNaN(Number(input.stock)) || Number(input.stock) < 0) {
      errors.push({ field: 'stock', message: 'Estoque deve ser um número válido e não negativo' });
    }
  }

  if (input.in_stock !== undefined && typeof input.in_stock !== 'boolean') {
    errors.push({ field: 'in_stock', message: 'in_stock deve ser um booleano' });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

const sanitizeProductInput = (input) => ({
  name: input.name?.trim(),
  description: input.description?.trim() || null,
  price: input.price !== undefined ? Number(input.price) : null,
  original_price: input.original_price !== undefined ? Number(input.original_price) : null,
  image: input.image?.trim() || null,
  images: Array.isArray(input.images) ? input.images : [],
  image_ids: Array.isArray(input.image_ids) ? input.image_ids : [],
  badge: input.badge?.trim() || null,
  badge_variant: input.badge_variant?.trim() || null,
  sizes: Array.isArray(input.sizes) ? input.sizes : [],
  colors: Array.isArray(input.colors) ? input.colors : [],
  stock: input.stock !== undefined ? Number(input.stock) : null,
  in_stock: input.in_stock ?? true,
  categoria_id: input.categoria_id?.trim() || null,
});

export {
  toPublicProduct,
  toPublicProductList,
  toAdminProduct,
  toAdminProductList,
  validateProductInput,
  sanitizeProductInput,
};
