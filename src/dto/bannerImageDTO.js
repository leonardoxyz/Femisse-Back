const normalizeBoolean = (value, defaultValue = false) => {
  if (typeof value === 'boolean') return value;
  if (value === null || value === undefined) return defaultValue;
  if (typeof value === 'string') {
    return ['true', '1', 'on', 'yes'].includes(value.toLowerCase());
  }
  return Boolean(value);
};

const normalizeNumber = (value, defaultValue = null) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? defaultValue : parsed;
};

const toPublicBannerImage = (banner) => ({
  url: banner.url,
});

const toPublicBannerImageList = (banners = []) =>
  (Array.isArray(banners) ? banners : []).map(toPublicBannerImage);

const toAdminBannerImage = (banner) => ({
  id: banner.id,
  url: banner.url,
});

const toAdminBannerImageList = (banners = []) =>
  (Array.isArray(banners) ? banners : []).map(toAdminBannerImage);

const validateBannerImageInput = (input) => {
  const errors = [];

  if (!input) {
    errors.push({ field: 'body', message: 'Dados do banner são obrigatórios' });
    return { isValid: false, errors };
  }

  const url = input.url?.trim();
  if (!url) {
    errors.push({ field: 'url', message: 'URL é obrigatória' });
  }

  if (input.title && typeof input.title !== 'string') {
    errors.push({ field: 'title', message: 'Title deve ser uma string' });
  }

  if (input.subtitle && typeof input.subtitle !== 'string') {
    errors.push({ field: 'subtitle', message: 'Subtitle deve ser uma string' });
  }

  if (input.cta_label && typeof input.cta_label !== 'string') {
    errors.push({ field: 'cta_label', message: 'CTA label deve ser uma string' });
  }

  if (input.cta_link && typeof input.cta_link !== 'string') {
    errors.push({ field: 'cta_link', message: 'CTA link deve ser uma string' });
  }

  if (input.position !== undefined && Number.isNaN(Number(input.position))) {
    errors.push({ field: 'position', message: 'Position deve ser um número válido' });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

const sanitizeBannerImageInput = (input) => ({
  url: input.url?.trim(),
});

export {
  toPublicBannerImage,
  toPublicBannerImageList,
  toAdminBannerImage,
  toAdminBannerImageList,
  validateBannerImageInput,
  sanitizeBannerImageInput,
};
