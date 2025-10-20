const toPublicMomentProduct = (product) => ({
  title: product.title,
  imageUrl: product.image_url ?? null,
});

const toPublicMomentProductList = (products = []) =>
  (Array.isArray(products) ? products : []).map(toPublicMomentProduct);

const toAdminMomentProduct = (product) => ({
  id: product.id,
  imageUrl: product.image_url ?? null,
});

const toAdminMomentProductList = (products = []) =>
  (Array.isArray(products) ? products : []).map(toAdminMomentProduct);

const validateMomentProductInput = (input) => {
  const errors = [];

  if (!input) {
    errors.push({ field: 'body', message: 'Dados do produto do momento são obrigatórios' });
    return { isValid: false, errors };
  }

  const title = input.title?.trim();
  if (!title) {
    errors.push({ field: 'title', message: 'Título é obrigatório' });
  } else if (title.length < 2) {
    errors.push({ field: 'title', message: 'Título deve ter pelo menos 2 caracteres' });
  } else if (title.length > 150) {
    errors.push({ field: 'title', message: 'Título deve ter no máximo 150 caracteres' });
  }

  if (input.image_url && typeof input.image_url !== 'string') {
    errors.push({ field: 'image_url', message: 'Image URL deve ser uma string' });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

const sanitizeMomentProductInput = (input) => ({
  title: input.title?.trim(),
  imageUrl: input.image_url?.trim() || null,
});

export {
  toPublicMomentProduct,
  toPublicMomentProductList,
  toAdminMomentProduct,
  toAdminMomentProductList,
  validateMomentProductInput,
  sanitizeMomentProductInput,
};
