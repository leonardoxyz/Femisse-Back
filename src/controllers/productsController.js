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
import { 
  validateUUID, 
  sanitizeString,
  validateLimit,
  secureLog, 
  getErrorMessage 
} from '../utils/securityUtils.js';

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
  try {
    const { categoria_id, search, ids } = req.query;
    
    // Valida categoria_id se fornecido
    if (categoria_id) {
      const uuidValidation = validateUUID(categoria_id);
      if (!uuidValidation.valid) {
        return res.status(400).json({ 
          error: 'Dados inválidos',
          details: 'ID da categoria inválido'
        });
      }
    }
    
    let query = supabase.from('products').select('*');

    const cacheKey = getProductsCacheKey(req.query);
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Filtro por IDs específicos (usado para favoritos)
    if (ids) {
      const idsArray = ids.split(',').map(id => id.trim()).filter(id => id);
      
      // Limita a 100 IDs
      if (idsArray.length > 100) {
        return res.status(400).json({ 
          error: 'Dados inválidos',
          details: 'Máximo de 100 produtos por vez'
        });
      }
      
      // Valida cada ID
      for (const id of idsArray) {
        const uuidValidation = validateUUID(id);
        if (!uuidValidation.valid) {
          return res.status(400).json({ 
            error: 'Dados inválidos',
            details: 'Um ou mais IDs de produtos são inválidos'
          });
        }
      }
      
      if (idsArray.length > 0) {
        query = query.in('id', idsArray);
      }
    }

    if (categoria_id) {
      query = query.eq('categoria_id', categoria_id);
    }
    
    // Sanitiza e valida busca
    if (search && search.trim() !== "") {
      const sanitizedSearch = sanitizeString(search.trim());
      
      // Limita tamanho da busca
      if (sanitizedSearch.length > 100) {
        return res.status(400).json({ 
          error: 'Dados inválidos',
          details: 'Termo de busca muito longo (máximo 100 caracteres)'
        });
      }
      
      // Verifica se não é apenas caracteres especiais
      if (sanitizedSearch.length < 2) {
        return res.status(400).json({ 
          error: 'Dados inválidos',
          details: 'Termo de busca deve ter pelo menos 2 caracteres'
        });
      }
      
      // Busca case-insensitive por nome ou descrição
      query = query.or(`name.ilike.%${sanitizedSearch}%,description.ilike.%${sanitizedSearch}%`);
    }

    const { data: products, error } = await query;
    if (error) {
      console.error('Erro ao buscar produtos:', error);
      return res.status(500).json(getErrorMessage(error, 'Erro ao buscar produtos'));
    }

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
  } catch (error) {
    console.error('Erro inesperado ao buscar produtos:', error);
    return res.status(500).json(getErrorMessage(error, 'Erro ao buscar produtos'));
  }
}

export async function getProductById(req, res) {
  try {
    const { id } = req.params;
    
    // Valida UUID
    const uuidValidation = validateUUID(id);
    if (!uuidValidation.valid) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: uuidValidation.message
      });
    }

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

    if (productError) {
      if (productError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Produto não encontrado' });
      }
      console.error('Erro ao buscar produto:', productError);
      return res.status(500).json(getErrorMessage(productError, 'Erro ao buscar produto'));
    }
    
    if (!product) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

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
  } catch (error) {
    console.error('Erro inesperado ao buscar produto:', error);
    return res.status(500).json(getErrorMessage(error, 'Erro ao buscar produto'));
  }
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
  try {
    const { id } = req.params;
    const fields = req.validatedBody ?? req.body;
    
    // Valida UUID
    const uuidValidation = validateUUID(id);
    if (!uuidValidation.valid) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: uuidValidation.message
      });
    }

    const { data, error } = await supabase
      .from('products')
      .update(fields)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar produto:', error);
      return res.status(500).json(getErrorMessage(error, 'Erro ao atualizar produto'));
    }
    
    await cacheDelete(getProductDetailCacheKey(id));
    await invalidateProductListsCache();
    res.json(data);
  } catch (error) {
    console.error('Erro inesperado ao atualizar produto:', error);
    return res.status(500).json(getErrorMessage(error, 'Erro ao atualizar produto'));
  }
}

export async function deleteProduct(req, res) {
  try {
    const { id } = req.params;
    
    // Valida UUID
    const uuidValidation = validateUUID(id);
    if (!uuidValidation.valid) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: uuidValidation.message
      });
    }

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar produto:', error);
      return res.status(500).json(getErrorMessage(error, 'Erro ao deletar produto'));
    }
    
    await cacheDelete(getProductDetailCacheKey(id));
    await invalidateProductListsCache();
    res.status(204).send();
  } catch (error) {
    console.error('Erro inesperado ao deletar produto:', error);
    return res.status(500).json(getErrorMessage(error, 'Erro ao deletar produto'));
  }
}
