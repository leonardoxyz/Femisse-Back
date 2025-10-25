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
  target_layout: banner.target_layout
});

const toPublicBannerImageList = (banners = []) =>
  (Array.isArray(banners) ? banners : []).map(toPublicBannerImage);

export {
  toPublicBannerImage,
  toPublicBannerImageList,
};
