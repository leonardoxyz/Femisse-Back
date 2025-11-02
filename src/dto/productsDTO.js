/**
 * DTO para produto público
 * Retorna apenas dados necessários para exibição no frontend
 * Não expõe IDs internos ou dados de auditoria
 */
const sanitizeNumber = (value, { allowNegative = false, fallback = 0 } = {}) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (!allowNegative && parsed < 0) return fallback;
  return parsed;
};

const normalizeVariants = (variants = []) => {
  if (!Array.isArray(variants) || variants.length === 0) return [];

  return variants.map((variant) => {
    const color = typeof variant?.color === 'string' ? variant.color.trim() : (variant?.color ?? null);
    const sizes = Array.isArray(variant?.sizes) ? variant.sizes : [];

    const normalizedSizes = sizes.map((sizeEntry) => {
      const size = typeof sizeEntry?.size === 'string' ? sizeEntry.size.trim() : (sizeEntry?.size ?? null);
      return {
        ...sizeEntry,
        size,
        stock: sanitizeNumber(sizeEntry?.stock),
      };
    });

    return {
      ...variant,
      color,
      sizes: normalizedSizes,
    };
  });
};

const collectVariantMetadata = (variants = []) => {
  const allSizes = [];
  const availableSizes = [];
  const allColors = [];
  const availableColors = [];

  const pushUnique = (array, value) => {
    if (value === null || value === undefined) return;
    const normalized = typeof value === 'string' ? value.trim() : value;
    if (normalized === '' || array.includes(normalized)) return;
    array.push(normalized);
  };

  variants.forEach((variant) => {
    pushUnique(allColors, variant.color);

    let variantHasStock = false;
    variant.sizes.forEach((sizeEntry) => {
      pushUnique(allSizes, sizeEntry.size);
      if (sizeEntry.stock > 0) {
        variantHasStock = true;
        pushUnique(availableSizes, sizeEntry.size);
      }
    });

    if (variantHasStock) {
      pushUnique(availableColors, variant.color);
    }
  });

  return {
    allSizes,
    availableSizes,
    allColors,
    availableColors,
  };
};

const sumVariantStock = (variants = []) => {
  if (!Array.isArray(variants) || variants.length === 0) return 0;

  return variants.reduce((variantTotal, variant) => {
    const sizeStock = variant.sizes.reduce((sizeTotal, sizeEntry) => sizeTotal + sanitizeNumber(sizeEntry.stock), 0);
    return variantTotal + sizeStock;
  }, 0);
};

const toPublicProduct = (product) => {
  const imagesList = product.images_urls ?? [];
  const variants = normalizeVariants(product.variants);
  const variantStock = sumVariantStock(variants);
  const stock = sanitizeNumber(variantStock);
  const hasStock = stock > 0;
  const {
    allSizes,
    availableSizes,
    allColors,
    availableColors,
  } = collectVariantMetadata(variants);

  const variantPrices = variants.flatMap((variant) =>
    variant.sizes
      .map((sizeEntry) => sanitizeNumber(sizeEntry?.price, { fallback: null }))
      .filter((price) => price !== null)
  );

  const fallbackPrice = sanitizeNumber(product.price);
  const minPrice = variantPrices.length > 0 ? Math.min(...variantPrices) : fallbackPrice;
  const maxPrice = variantPrices.length > 0 ? Math.max(...variantPrices) : minPrice;

  return {
    id: product.id,
    name: product.name,
    description: product.description ?? null,
    price: minPrice,
    priceMin: minPrice,
    priceMax: maxPrice,
    originalPrice: product.original_price ?? null,
    original_price: product.original_price ?? null,
    image: imagesList.length > 0 ? imagesList[0] : null,
    images: imagesList,
    badge: product.badge ?? null,
    badgeVariant: product.badge_variant ?? null,
    variants,
    sizes: allSizes,
    colors: allColors,
    availableSizes,
    availableColors,
    stock,
    inStock: hasStock,
    // 🔒 categoria_id removido - IDs internos não devem ser expostos
    // TODO: Implementar categoria_slug para navegação
    isNew: Boolean(product.is_new),
    newUntil: product.new_until ?? null,
  };
};

const toPublicProductList = (products = []) =>
  (Array.isArray(products) ? products : []).map(toPublicProduct);

export {
  toPublicProduct,
  toPublicProductList,
};
