const toPublicFavorite = (favorite) => ({
  produtoId: favorite.produto_id,
  createdAt: favorite.created_at,
});

const toPublicFavoriteList = (favorites = []) =>
  (Array.isArray(favorites) ? favorites : []).map(toPublicFavorite);

const toAdminFavorite = (favorite) => ({
  id: favorite.id,
  usuarioId: favorite.usuario_id,
  produtoId: favorite.produto_id,
  createdAt: favorite.created_at,
});

const toAdminFavoriteList = (favorites = []) =>
  (Array.isArray(favorites) ? favorites : []).map(toAdminFavorite);

const validateFavoriteInput = (input) => {
  const errors = [];

  if (!input) {
    errors.push({ field: 'body', message: 'Dados do favorito são obrigatórios' });
    return { isValid: false, errors };
  }

  if (!input.produto_id && !input.produtoId) {
    errors.push({ field: 'produto_id', message: 'ID do produto é obrigatório' });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

const sanitizeFavoriteInput = (input) => ({
  produto_id: input.produto_id || input.produtoId,
  usuario_id: input.usuario_id || input.usuarioId,
});

export {
  toPublicFavorite,
  toPublicFavoriteList,
  toAdminFavorite,
  toAdminFavoriteList,
  validateFavoriteInput,
  sanitizeFavoriteInput,
};
