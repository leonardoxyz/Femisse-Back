import { generateSlug } from '../utils/slugGenerator.js';

const toPublicCategory = (category) => {
  // Sempre gera slug a partir do nome (banco pode não ter coluna slug)
  const slug = generateSlug(category.name);
  
  return {
    slug,
    name: category.name,
    image: category.image || null,
    showInHighlight: Boolean(category.show_in_highlight),
  };
};

const toPublicCategoryList = (categories = []) =>
  categories.map(toPublicCategory);

export {
  toPublicCategory,
  toPublicCategoryList,
};
