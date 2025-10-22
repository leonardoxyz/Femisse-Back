/**
 * DTO para favorito público
 * Retorna apenas dados necessários para o frontend
 */
const toPublicFavorite = (favorite) => ({
  createdAt: favorite.created_at,
});

const toPublicFavoriteList = (favorites = []) =>
  (Array.isArray(favorites) ? favorites : []).map(toPublicFavorite);

export {
  toPublicFavorite,
  toPublicFavoriteList,
};
