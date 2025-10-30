import supabase from '../services/supabaseClient.js';
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
  getErrorMessage 
} from '../utils/securityUtils.js';
import { toPublicProductList, toPublicProduct } from '../dto/productsDTO.js';
import { generateSlug } from '../utils/slugGenerator.js';
import { logger } from '../utils/logger.js';

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
    let { categoria_slug, search, ids } = req.validatedQuery || req.query;
    let categoria_id = null;
    
    if (categoria_slug && typeof categoria_slug !== 'string') {
      categoria_slug = String(categoria_slug);
    }
    
    logger.info({ categoria_slug, search, ids }, 'getAllProducts chamado');
    
    // Se fornecido slug, busca o ID da categoria
    if (categoria_slug && categoria_slug.trim() !== '') {
      const slugTrimmed = categoria_slug.trim();
      logger.debug({ slug: slugTrimmed }, 'Buscando categoria com slug');
      
      // Busca TODAS as categorias e compara slug gerado
      const { data: allCategories, error: categoriesError } = await supabase
        .from('categories')
        .select('id, name');
      
      if (categoriesError || !allCategories) {
        logger.error({ err: categoriesError }, 'Erro ao buscar categorias');
        return res.status(500).json({ 
          error: 'Erro ao buscar categorias',
          details: categoriesError?.message || 'Erro desconhecido'
        });
      }
      
      // Gera slug do nome e compara
      const foundCategory = allCategories.find(cat => generateSlug(cat.name) === slugTrimmed);
      
      if (!foundCategory) {
        logger.warn({ slug: slugTrimmed }, 'Categoria não encontrada');
        return res.status(404).json({ 
          error: 'Categoria não encontrada',
          details: `Nenhuma categoria com slug "${slugTrimmed}" foi encontrada`
        });
      }
      
      categoria_id = foundCategory.id;
      logger.info({ slug: slugTrimmed, name: foundCategory.name, id: categoria_id }, 'Categoria encontrada');
    } else {
      logger.debug('Sem filtro de categoria - buscando TODOS os produtos');
    }
    
    let query = supabase.from('products').select('*');

    // Cria chave de cache com dados validados
    const cacheKey = getProductsCacheKey({ categoria_id, search, ids });
    const cached = await cacheGet(cacheKey);
    if (cached) {
      logger.debug({ count: cached.length, categoria_id }, 'Retornando produtos do cache');
      return res.json({ success: true, data: cached });
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

    // ✅ IMPORTANTE: Aplicar filtro de categoria ANTES de buscar do banco
    if (categoria_id) {
      logger.debug({ categoria_id }, 'Aplicando filtro de categoria');
      query = query.eq('categoria_id', categoria_id);
    } else {
      logger.debug('Sem filtro de categoria - buscando TODOS os produtos');
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
      logger.error({ err: error }, 'Erro ao buscar produtos');
      return res.status(500).json(getErrorMessage(error, 'Erro ao buscar produtos'));
    }

    logger.info({ count: products?.length || 0 }, 'Query retornou produtos do banco');
    
    // ✅ VALIDAÇÃO: Se filtrou por categoria, TODOS devem ter essa categoria
    if (categoria_id && products && products.length > 0) {
      const allCorrectCategory = products.every(p => p.categoria_id === categoria_id);
      if (!allCorrectCategory) {
        logger.error('ERRO CRÍTICO: Banco retornou produtos de categorias diferentes!');
      }
    }
    

    if (!products || products.length === 0) {
      logger.info('Nenhum produto encontrado');
      return res.json({ success: true, data: [] });
    }

    // ✅ SIMPLIFICADO: images_urls já vem do banco, não precisa de join
    logger.debug('Produtos carregados com images_urls do banco');

    const formattedProducts = toPublicProductList(products);
    await cacheSet(cacheKey, formattedProducts, PRODUCTS_LIST_TTL);
    await cacheAddToSet(PRODUCTS_LIST_KEYS_SET, cacheKey);
    res.json({ success: true, data: formattedProducts });
  } catch (error) {
    logger.error({ err: error }, 'Erro inesperado ao buscar produtos');
    return res.status(500).json({ success: false, message: 'Erro ao buscar produtos', details: error.message });
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
      return res.json({ success: true, data: cached });
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
      logger.error({ err: productError }, 'Erro ao buscar produto');
      return res.status(500).json(getErrorMessage(productError, 'Erro ao buscar produto'));
    }
    
    if (!product) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    // ✅ SIMPLIFICADO: images_urls já vem do banco
    logger.debug('Produto carregado com images_urls do banco');
    const formattedProduct = toPublicProduct(product);
    await cacheSet(cacheKey, formattedProduct, PRODUCTS_DETAIL_TTL);
    res.json({ success: true, data: formattedProduct });
  } catch (error) {
    logger.error({ err: error }, 'Erro inesperado ao buscar produto');
    return res.status(500).json({ success: false, message: 'Erro ao buscar produto', details: error.message });
  }
}

const deriveVariantPricing = (variants = []) => {
  if (!Array.isArray(variants) || variants.length === 0) {
    return { minPrice: 0, maxPrice: 0 };
  }

  const prices = [];

  for (const variant of variants) {
    const sizes = Array.isArray(variant?.sizes) ? variant.sizes : [];
    for (const sizeEntry of sizes) {
      const numericPrice = Number(sizeEntry?.price);
      if (Number.isFinite(numericPrice) && numericPrice >= 0) {
        prices.push(numericPrice);
      }
    }
  }

  if (prices.length === 0) {
    return { minPrice: 0, maxPrice: 0 };
  }

  return {
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
  };
};

export async function createProduct(req, res) {
  const {
    name,
    description,
    original_price,
    image,
    images,
    badge,
    badge_variant,
    image_ids,
    variants
  } = req.validatedBody ?? req.body;

  const { minPrice, maxPrice } = deriveVariantPricing(variants);

  const payload = {
    name,
    description,
    price: minPrice,
    price_min: minPrice,
    price_max: maxPrice,
    original_price,
    image,
    images,
    badge,
    badge_variant,
    image_ids,
    variants,
  };

  const { data, error } = await supabase
    .from('products')
    .insert([
      {
        ...payload
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

    const { stock: _ignoredStock, price: _ignoredPrice, ...sanitizedFields } = fields ?? {};

    let derivedPricing = {};
    if (sanitizedFields.variants) {
      const { minPrice, maxPrice } = deriveVariantPricing(sanitizedFields.variants);
      derivedPricing = {
        price: minPrice,
        price_min: minPrice,
        price_max: maxPrice,
      };
    }

    const updatePayload = { ...sanitizedFields, ...derivedPricing };

    const { data, error } = await supabase
      .from('products')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error({ err: error }, 'Erro ao atualizar produto');
      return res.status(500).json(getErrorMessage(error, 'Erro ao atualizar produto'));
    }
    
    await cacheDelete(getProductDetailCacheKey(id));
    await invalidateProductListsCache();
    res.json(data);
  } catch (error) {
    logger.error({ err: error }, 'Erro inesperado ao atualizar produto');
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
      logger.error({ err: error }, 'Erro ao deletar produto');
      return res.status(500).json(getErrorMessage(error, 'Erro ao deletar produto'));
    }
    
    await cacheDelete(getProductDetailCacheKey(id));
    await invalidateProductListsCache();
    res.status(204).send();
  } catch (error) {
    logger.error({ err: error }, 'Erro inesperado ao deletar produto');
    return res.status(500).json(getErrorMessage(error, 'Erro ao deletar produto'));
  }
}
