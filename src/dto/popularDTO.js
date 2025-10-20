const toPublicPopular = (popular) => ({
  name: popular.name,
  image: popular.image ?? null,
});

const toPublicPopularList = (populars = []) =>
  (Array.isArray(populars) ? populars : []).map(toPublicPopular);

const toAdminPopular = (popular) => ({
  id: popular.id,
  name: popular.name,
  image: popular.image ?? null,
  createdAt: popular.created_at,
  updatedAt: popular.updated_at,
});

const toAdminPopularList = (populars = []) =>
  (Array.isArray(populars) ? populars : []).map(toAdminPopular);

const validatePopularInput = (input) => {
  const errors = [];

  if (!input) {
    errors.push({ field: 'body', message: 'Dados do produto popular são obrigatórios' });
    return { isValid: false, errors };
  }

  const name = input.name?.trim();
  if (!name) {
    errors.push({ field: 'name', message: 'Nome é obrigatório' });
  } else if (name.length < 2) {
    errors.push({ field: 'name', message: 'Nome deve ter pelo menos 2 caracteres' });
  } else if (name.length > 150) {
    errors.push({ field: 'name', message: 'Nome deve ter no máximo 150 caracteres' });
  }

  if (input.image && typeof input.image !== 'string') {
    errors.push({ field: 'image', message: 'Image deve ser uma string' });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

const sanitizePopularInput = (input) => ({
  name: input.name?.trim(),
  image: input.image?.trim() || null,
});

export {
  toPublicPopular,
  toPublicPopularList,
  toAdminPopular,
  toAdminPopularList,
  validatePopularInput,
  sanitizePopularInput,
};
