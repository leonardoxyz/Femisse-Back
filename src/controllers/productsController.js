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
import { toPublicProductList, toPublicProduct } from '../dto/productsDTO.js';

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
    
    console.log('🔍 getAllProducts chamado com:', { categoria_id, search, ids });
    
    // Valida categoria_id se fornecido
    if (categoria_id) {
      const uuidValidation = validateUUID(categoria_id);
      if (!uuidValidation.valid) {
        console.error('❌ categoria_id inválido:', categoria_id);
        return res.status(400).json({ 
          error: 'Dados inválidos',
          details: 'ID da categoria inválido'
        });
      }
      console.log('✅ categoria_id válido:', categoria_id);
    }
    
    let query = supabase.from('products').select('*');

    const cacheKey = getProductsCacheKey(req.query);
    const cached = await cacheGet(cacheKey);
    if (cached) {
      console.log('📦 Retornando do cache:', cached.length, 'produtos');
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

    if (categoria_id) {
      console.log('🎯 Aplicando filtro: categoria_id =', categoria_id);
      query = query.eq('categoria_id', categoria_id);
    } else {
      console.log('📋 Sem filtro de categoria - buscando TODOS os produtos');
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
      console.error('❌ Erro ao buscar produtos:', error);
      return res.status(500).json(getErrorMessage(error, 'Erro ao buscar produtos'));
    }

    console.log(`✅ Query retornou ${products?.length || 0} produtos do banco`);
    
    if (categoria_id && products && products.length > 0) {
      // Verificar se todos os produtos pertencem à categoria solicitada
      const correctCategory = products.filter(p => p.categoria_id === categoria_id).length;
      const wrongCategory = products.filter(p => p.categoria_id !== categoria_id).length;
      
      console.log('📊 Análise dos produtos do banco:', {
        total: products.length,
        categoriaCorreta: correctCategory,
        categoriaErrada: wrongCategory,
        primeiros3: products.slice(0, 3).map(p => ({ 
          name: p.name, 
          categoria_id: p.categoria_id 
        }))
      });
      
      if (wrongCategory > 0) {
        console.error('⚠️ ERRO: Banco retornou produtos de outras categorias!');
      }
    }

    if (!products || products.length === 0) {
      console.log('📭 Nenhum produto encontrado');
      return res.json({ success: true, data: [] });
    }

    // ✅ SIMPLIFICADO: images_urls já vem do banco, não precisa de join
    console.log('✅ Produtos carregados com images_urls do banco');

    const formattedProducts = toPublicProductList(products);
    await cacheSet(cacheKey, formattedProducts, PRODUCTS_LIST_TTL);
    await cacheAddToSet(PRODUCTS_LIST_KEYS_SET, cacheKey);
    res.json({ success: true, data: formattedProducts });
  } catch (error) {
    console.error('Erro inesperado ao buscar produtos:', error);
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
      console.error('Erro ao buscar produto:', productError);
      return res.status(500).json(getErrorMessage(productError, 'Erro ao buscar produto'));
    }
    
    if (!product) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    // ✅ SIMPLIFICADO: images_urls já vem do banco
    console.log('✅ Produto carregado com images_urls do banco');
    const formattedProduct = toPublicProduct(product);
    await cacheSet(cacheKey, formattedProduct, PRODUCTS_DETAIL_TTL);
    res.json({ success: true, data: formattedProduct });
  } catch (error) {
    console.error('Erro inesperado ao buscar produto:', error);
    return res.status(500).json({ success: false, message: 'Erro ao buscar produto', details: error.message });
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
