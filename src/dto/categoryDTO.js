const toPublicCategory = (category) => ({
  id: category.id,
  name: category.name,
  image: category.image,
});

const toPublicCategoryList = (categories = []) =>
  categories.map(toPublicCategory);

const toAdminCategory = (category) => ({
  id: category.id,
  name: category.name,
  image: category.image,
  createdAt: category.created_at,
  updatedAt: category.updated_at,
});

const toAdminCategoryList = (categories = []) =>
  categories.map(toAdminCategory);

const validateCategoryInput = (input) => {
  const errors = [];

  if (!input) {
    errors.push({ field: 'body', message: 'Dados da categoria são obrigatórios' });
    return { isValid: false, errors };
  }

  const name = input.name?.trim();
  if (!name) {
    errors.push({ field: 'name', message: 'Nome é obrigatório' });
  } else if (name.length < 2) {
    errors.push({ field: 'name', message: 'Nome deve ter pelo menos 2 caracteres' });
  } else if (name.length > 100) {
    errors.push({ field: 'name', message: 'Nome deve ter no máximo 100 caracteres' });
  }

  if (input.image && typeof input.image !== 'string') {
    errors.push({ field: 'image', message: 'Image deve ser uma string' });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

const sanitizeCategoryInput = (input) => ({
  name: input.name?.trim(),
  image: input.image?.trim() || null,
});

export {
  toPublicCategory,
  toPublicCategoryList,
  toAdminCategory,
  toAdminCategoryList,
  validateCategoryInput,
  sanitizeCategoryInput,
};
