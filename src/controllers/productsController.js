import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import {
  cacheGet,
  cacheSet,
  cacheDelete,
  cacheAddToSet,
  cacheGetSetMembers,
  cacheClearSet,
} from '../services/cacheService.js';

dotenv.config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const PRODUCTS_LIST_KEYS_SET = 'cache:products:list-keys';
const PRODUCTS_LIST_TTL = 120;
const PRODUCTS_DETAIL_TTL = 300;

const getProductsCacheKey = (query = {}) => {
  const { categoria_id = null, search = null, ids = null } = query;
  return JSON.stringify({ categoria_id, search, ids });
};

const getProductDetailCacheKey = (id) => `cache:products:detail:${id}`;

const invalidateProductListsCache = async () => {
  const keys = await cacheGetSetMembers(PRODUCTS_LIST_KEYS_SET);
  if (keys.length > 0) {
    await cacheDelete(keys);
  }
  await cacheClearSet(PRODUCTS_LIST_KEYS_SET);
};

export async function getAllProducts(req, res) {
  const { categoria_id, search, ids } = req.query;
  let query = supabase.from('products').select('*');

  const cacheKey = getProductsCacheKey(req.query);
  const cached = await cacheGet(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  // Filtro por IDs específicos (usado para favoritos)
  if (ids) {
    const idsArray = ids.split(',').map(id => id.trim()).filter(id => id);
    if (idsArray.length > 0) {
      query = query.in('id', idsArray);
    }
  }

  if (categoria_id) {
    query = query.eq('categoria_id', categoria_id);
  }
  if (search && search.trim() !== "") {
    // Busca case-insensitive por nome ou descrição
    query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
  }

  const { data: products, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  if (!products || products.length === 0) {
    return res.json([]);
  }

  const imageIdSet = new Set();
  products.forEach(product => {
    if (Array.isArray(product.image_ids)) {
      product.image_ids.filter(Boolean).forEach(id => imageIdSet.add(id));
    }
  });

  let imageMap = new Map();
  if (imageIdSet.size > 0) {
    const imageIds = Array.from(imageIdSet);
    const { data: imageData, error: imageError } = await supabase
      .from('images')
      .select('id, image_url')
      .in('id', imageIds);

    if (imageError) {
      console.error('Erro ao buscar imagens dos produtos:', imageError);
    } else if (imageData) {
      imageMap = new Map(imageData.map(img => [img.id, img.image_url]));
    }
  }

  const productsWithImages = products.map(product => {
    const relatedImages = Array.isArray(product.image_ids)
      ? product.image_ids
          .map(id => imageMap.get(id))
          .filter(Boolean)
      : [];

    const mergedImages = relatedImages.length > 0
      ? relatedImages
      : Array.isArray(product.images)
        ? product.images
        : [];

    return { ...product, images: mergedImages };
  });

  await cacheSet(cacheKey, productsWithImages, PRODUCTS_LIST_TTL);
  await cacheAddToSet(PRODUCTS_LIST_KEYS_SET, cacheKey);
  res.json(productsWithImages);
}

export async function getProductById(req, res) {
  const { id } = req.params;

  const cacheKey = getProductDetailCacheKey(id);
  const cached = await cacheGet(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  const { data: product, error: productError } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();

  if (productError) return res.status(500).json({ error: productError.message });
  if (!product) return res.status(404).json({ error: 'Produto não encontrado' });

  let images = [];
  if (Array.isArray(product.image_ids) && product.image_ids.length > 0) {
    const { data: imageData, error: imageError } = await supabase
      .from('images')
      .select('id, image_url')
      .in('id', product.image_ids);

    if (imageError) {
      console.error('Erro ao buscar imagens do produto:', imageError);
    } else if (imageData) {
      const imageMap = new Map(imageData.map(img => [img.id, img.image_url]));
      images = product.image_ids
        .map(id => imageMap.get(id))
        .filter(Boolean);
    }
  }

  if (images.length === 0 && Array.isArray(product.images)) {
    images = product.images;
  }

  const response = { ...product, images };
  await cacheSet(cacheKey, response, PRODUCTS_DETAIL_TTL);
  res.json(response);
}

export async function createProduct(req, res) {
  const {
    name,
    description,
    price,
    original_price,
    image,
    images,
    badge,
    badge_variant,
    sizes,
    colors,
    image_ids,
    in_stock
  } = req.validatedBody ?? req.body;

  const { data, error } = await supabase
    .from('products')
    .insert([
      {
        name,
        description,
        price,
        original_price,
        image,
        images,
        badge,
        badge_variant,
        sizes,
        colors,
        image_ids,
        in_stock
      }
    ])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  await invalidateProductListsCache();
  res.status(201).json(data);
}

export async function updateProduct(req, res) {
  const { id } = req.params;
  const fields = req.validatedBody ?? req.body;
  if (!id) return res.status(400).json({ error: 'ID é obrigatório' });

  const { data, error } = await supabase
    .from('products')
    .update(fields)
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  await cacheDelete(getProductDetailCacheKey(id));
  await invalidateProductListsCache();
  res.json(data);
}

export async function deleteProduct(req, res) {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: 'ID é obrigatório' });

  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id);

  if (error) return res.status(500).json({ error: error.message });
  await cacheDelete(getProductDetailCacheKey(id));
  await invalidateProductListsCache();
  res.status(204).send();
}
