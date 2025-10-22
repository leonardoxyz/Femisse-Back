const toPublicPopular = (popular) => ({
  name: popular.name,
  image: popular.image ?? null,
});

const toPublicPopularList = (populars = []) =>
  (Array.isArray(populars) ? populars : []).map(toPublicPopular);

export {
  toPublicPopular,
  toPublicPopularList,
};
