import supabase from '../services/supabaseClient.js';
import {
  cacheDelete,
  cacheGet,
  cacheSet,
} from '../services/cacheService.js';
import { 
  validateUUID, 
  validateRating,
  sanitizeString,
  secureLog, 
  getErrorMessage 
} from '../utils/securityUtils.js';
import { 
  toPublicReviewList, 
  toPublicReviewableProductList 
} from '../dto/reviewDTO.js';

const REVIEW_LIST_TTL = 120;
const REVIEWABLE_LIST_TTL = 120;
const PRODUCT_STATS_TTL = 300;

const getUserReviewsCacheKey = (userId) => `cache:reviews:user:${userId}`;
const getReviewableProductsCacheKey = (userId) => `cache:reviews:reviewable:${userId}`;
const getProductStatsCacheKey = (productId) => `cache:reviews:stats:${productId}`;

const normalizeImageRefs = (value) => {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.filter(Boolean).map(String);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter(Boolean).map(String);
      }
    } catch (err) {
      // ignore JSON parse error – attempt to parse legacy Postgres array format {id1,id2}
    }

    return trimmed
      .replace(/["{}]/g, '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

const fetchImagesByIds = async (ids) => {
  if (!ids || ids.size === 0) return new Map();

  const { data, error } = await supabase
    .from('images')
    .select('id, image_url')
    .in('id', Array.from(ids));

  if (error) {
    console.error('Erro ao buscar imagens:', error);
    return new Map();
  }

  return new Map((data ?? []).map((image) => [image.id, image.image_url]));
};

const resolvePrimaryImage = (imageRef, imageMap) => {
  const refs = normalizeImageRefs(imageRef);
  for (const ref of refs) {
    const url = imageMap.get(ref);
    if (url) return url;
  }
  return null;
};

const formatReviewResponse = (review, imageMap) => ({
  reviewId: review.id,
  productId: review.product_id,
  rating: review.rating,
  comment: review.comment,
  productName: review.product_name,
  productImage: resolvePrimaryImage(review.product_image, imageMap),
  createdAt: review.created_at,
  updatedAt: review.updated_at ?? null,
});

const invalidateUserReviewCaches = async (userId) => {
  await cacheDelete([
    getUserReviewsCacheKey(userId),
    getReviewableProductsCacheKey(userId),
  ]);
};

const invalidateProductStatsCache = async (productId) => {
  await cacheDelete(getProductStatsCacheKey(productId));
};

const fetchDetailedReviewById = async (reviewId) => {
  const { data, error } = await supabase
    .from('product_reviews_detailed')
    .select('*')
    .eq('id', reviewId)
    .single();

  if (error) {
    return { error };
  }

  const imageIds = new Set(normalizeImageRefs(data.product_image));
  const imageMap = await fetchImagesByIds(imageIds);
  return { data: formatReviewResponse(data, imageMap) };
};

export async function listUserReviews(req, res) {
  try {
    const userId = req.user.id;
    const cacheKey = getUserReviewsCacheKey(userId);
    const cached = await cacheGet(cacheKey);

    if (cached) {
      return res.json({ success: true, data: cached });
    }

    const { data, error } = await supabase
      .from('product_reviews')
      .select(`
        id,
        user_id,
        product_id,
        order_id,
        rating,
        comment,
        created_at,
        updated_at,
        products!inner(name, image_ids)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao listar avaliações:', error);
      return res.status(500).json({ success: false, message: 'Erro ao listar avaliações', details: error.message });
    }

    const reviews = data ?? [];
    const allImageIds = new Set();
    reviews.forEach((review) => {
      if (review.products?.image_ids) {
        normalizeImageRefs(review.products.image_ids).forEach((id) => allImageIds.add(id));
      }
    });

    const imageMap = await fetchImagesByIds(allImageIds);
    const rawReviews = reviews.map((review) => ({
      reviewId: review.id,
      rating: review.rating,
      comment: review.comment,
      productName: review.products?.name ?? null,
      productImage: review.products?.image_ids ? resolvePrimaryImage(review.products.image_ids, imageMap) : null,
      createdAt: review.created_at,
      updatedAt: review.updated_at ?? null,
    }));
    const formatted = toPublicReviewList(rawReviews);

    await cacheSet(cacheKey, formatted, REVIEW_LIST_TTL);
    return res.json({ success: true, data: formatted });
  } catch (error) {
    console.error('Erro inesperado ao listar avaliações:', error);
    return res.status(500).json({ success: false, message: 'Erro interno ao listar avaliações', details: error.message });
  }
}

export async function listReviewableProducts(req, res) {
  try {
    const userId = req.user.id;
    const cacheKey = getReviewableProductsCacheKey(userId);
    const cached = await cacheGet(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    // Buscar pedidos entregues do usuário
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, created_at, status')
      .eq('user_id', userId)
      .eq('status', 'delivered')
      .order('created_at', { ascending: false });

    if (ordersError) {
      console.error('Erro ao buscar pedidos:', ordersError);
      return res.status(500).json({ error: 'Erro ao listar produtos avaliáveis', details: ordersError.message });
    }

    if (!orders || orders.length === 0) {
      await cacheSet(cacheKey, [], REVIEWABLE_LIST_TTL);
      return res.json([]);
    }

    const orderIds = orders.map(o => o.id);

    // Buscar itens dos pedidos
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('order_id, product_id, product_name, product_image')
      .in('order_id', orderIds);

    if (itemsError) {
      console.error('Erro ao buscar itens dos pedidos:', itemsError);
      return res.status(500).json({ error: 'Erro ao listar produtos avaliáveis', details: itemsError.message });
    }

    // Buscar reviews existentes do usuário
    const { data: existingReviews, error: reviewsError } = await supabase
      .from('product_reviews')
      .select('product_id, order_id')
      .eq('user_id', userId);

    if (reviewsError) {
      console.error('Erro ao buscar reviews existentes:', reviewsError);
      return res.status(500).json({ error: 'Erro ao listar produtos avaliáveis', details: reviewsError.message });
    }

    // Criar um Set de combinações produto+pedido que já foram avaliadas
    const reviewedSet = new Set(
      (existingReviews || []).map(r => `${r.product_id}_${r.order_id}`)
    );

    // Filtrar produtos que ainda não foram avaliados
    const reviewableProducts = (orderItems || [])
      .filter(item => !reviewedSet.has(`${item.product_id}_${item.order_id}`))
      .map(item => {
        const order = orders.find(o => o.id === item.order_id);
        return {
          product_id: item.product_id,
          product_name: item.product_name,
          product_image: item.product_image,
          order_id: item.order_id,
          order_date: order?.created_at,
          has_review: false
        };
      });

    // Remover duplicatas (mesmo produto em pedidos diferentes)
    const uniqueProducts = new Map();
    reviewableProducts.forEach(product => {
      const key = `${product.product_id}_${product.order_id}`;
      if (!uniqueProducts.has(key)) {
        uniqueProducts.set(key, product);
      }
    });

    const products = Array.from(uniqueProducts.values());
    const imageIds = new Set();
    products.forEach((product) => {
      normalizeImageRefs(product.product_image).forEach((id) => imageIds.add(id));
    });

    const imageMap = await fetchImagesByIds(imageIds);
    const rawProducts = products.map((product) => ({
      productId: product.product_id,
      orderId: product.order_id,
      name: product.product_name,
      image: resolvePrimaryImage(product.product_image, imageMap),
      orderDate: product.order_date,
      hasReview: product.has_review,
    }));

    const formatted = toPublicReviewableProductList(rawProducts);
    await cacheSet(cacheKey, formatted, REVIEWABLE_LIST_TTL);
    return res.json({ success: true, data: formatted });
  } catch (error) {
    console.error('Erro inesperado ao listar produtos avaliáveis:', error);
    return res.status(500).json({ success: false, message: 'Erro interno ao listar produtos avaliáveis', details: error.message });
  }
}

export async function createReview(req, res) {
  try {
    const userId = req.user.id;
    let { product_id, order_id, rating, comment } = req.validatedBody ?? req.body;
    
    secureLog('Creating review', { userId, product_id, order_id, rating });
    
    // Valida product_id
    const productIdValidation = validateUUID(product_id);
    if (!productIdValidation.valid) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: [{ field: 'product_id', message: productIdValidation.message }]
      });
    }
    
    // Valida order_id
    const orderIdValidation = validateUUID(order_id);
    if (!orderIdValidation.valid) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: [{ field: 'order_id', message: orderIdValidation.message }]
      });
    }
    
    // Valida rating (1-5)
    const ratingValidation = validateRating(rating);
    if (!ratingValidation.valid) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: [{ field: 'rating', message: ratingValidation.message }]
      });
    }
    rating = ratingValidation.value;
    
    // Valida e sanitiza comment
    if (comment) {
      if (typeof comment !== 'string') {
        return res.status(400).json({ 
          error: 'Dados inválidos',
          details: [{ field: 'comment', message: 'Comentário deve ser texto' }]
        });
      }
      
      comment = sanitizeString(comment);
      
      // Limita tamanho do comentário
      if (comment.length > 1000) {
        return res.status(400).json({ 
          error: 'Dados inválidos',
          details: [{ field: 'comment', message: 'Comentário deve ter no máximo 1000 caracteres' }]
        });
      }
      
      // Verifica se não é spam (comentário muito curto ou repetitivo)
      if (comment.length < 10) {
        return res.status(400).json({ 
          error: 'Dados inválidos',
          details: [{ field: 'comment', message: 'Comentário deve ter pelo menos 10 caracteres' }]
        });
      }
      
      // Detecta spam simples (mesma letra repetida muitas vezes)
      if (/(.)\1{10,}/.test(comment)) {
        return res.status(400).json({ 
          error: 'Dados inválidos',
          details: [{ field: 'comment', message: 'Comentário inválido' }]
        });
      }
    }
    
    // Verifica rate limiting (máximo 5 reviews por dia por usuário)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await supabase
      .from('product_reviews')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', oneDayAgo);
    
    if (countError) {
      console.error('Erro ao verificar limite de reviews:', countError);
    } else if (count >= 5) {
      return res.status(429).json({ 
        error: 'Limite atingido',
        details: 'Você pode criar no máximo 5 avaliações por dia'
      });
    }

    const { data: existingOrder, error: orderError } = await supabase
      .from('orders')
      .select('id, user_id')
      .eq('id', order_id)
      .single();
    console.log('order lookup', { existingOrder, orderError });

    if (orderError) {
      if (orderError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Pedido não encontrado' });
      }
      console.error('Erro ao validar pedido para avaliação:', orderError);
      return res.status(500).json({ error: 'Erro ao validar pedido', details: orderError.message });
    }

    if (existingOrder.user_id !== userId) {
      return res.status(403).json({ error: 'Você não tem permissão para avaliar este pedido' });
    }

    const { data, error } = await supabase
      .from('product_reviews')
      .insert([
        {
          user_id: userId,
          product_id,
          order_id,
          rating,
          comment,
        },
      ])
      .select('id, product_id')
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Você já avaliou este produto para este pedido' });
      }
      console.error('Erro ao criar avaliação:', error);
      return res.status(500).json({ error: 'Erro ao criar avaliação', details: error.message });
    }

    await invalidateUserReviewCaches(userId);
    await invalidateProductStatsCache(product_id);

    const { data: reviewData, error: fetchError } = await fetchDetailedReviewById(data.id);
    if (fetchError) {
      console.error('Erro ao carregar avaliação recém-criada:', fetchError);
      return res.status(201).json({ id: data.id, message: 'Avaliação criada com sucesso' });
    }

    return res.status(201).json(reviewData);
  } catch (error) {
    console.error('Erro inesperado ao criar avaliação:', error);
    return res.status(500).json({ error: 'Erro interno ao criar avaliação' });
  }
}

export async function updateReview(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.validatedParams ?? req.params;
    let payload = req.validatedBody ?? req.body;
    
    // Valida UUID
    const uuidValidation = validateUUID(id);
    if (!uuidValidation.valid) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: [{ field: 'id', message: uuidValidation.message }]
      });
    }
    
    secureLog('Updating review', { userId, id });

    const updates = {};
    
    // Valida rating se fornecido
    if (payload.rating !== undefined) {
      const ratingValidation = validateRating(payload.rating);
      if (!ratingValidation.valid) {
        return res.status(400).json({ 
          error: 'Dados inválidos',
          details: [{ field: 'rating', message: ratingValidation.message }]
        });
      }
      updates.rating = ratingValidation.value;
    }
    
    // Valida e sanitiza comment se fornecido
    if (payload.comment !== undefined) {
      if (typeof payload.comment !== 'string') {
        return res.status(400).json({ 
          error: 'Dados inválidos',
          details: [{ field: 'comment', message: 'Comentário deve ser texto' }]
        });
      }
      
      const comment = sanitizeString(payload.comment);
      
      if (comment.length > 1000) {
        return res.status(400).json({ 
          error: 'Dados inválidos',
          details: [{ field: 'comment', message: 'Comentário deve ter no máximo 1000 caracteres' }]
        });
      }
      
      if (comment.length < 10) {
        return res.status(400).json({ 
          error: 'Dados inválidos',
          details: [{ field: 'comment', message: 'Comentário deve ter pelo menos 10 caracteres' }]
        });
      }
      
      if (/(.)\1{10,}/.test(comment)) {
        return res.status(400).json({ 
          error: 'Dados inválidos',
          details: [{ field: 'comment', message: 'Comentário inválido' }]
        });
      }
      
      updates.comment = comment;
    }

    const { data, error } = await supabase
      .from('product_reviews')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select('id, product_id')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Avaliação não encontrada' });
      }
      console.error('Erro ao atualizar avaliação:', error);
      return res.status(500).json({ error: 'Erro ao atualizar avaliação', details: error.message });
    }

    await invalidateUserReviewCaches(userId);
    await invalidateProductStatsCache(data.product_id);

    const { data: reviewData, error: fetchError } = await fetchDetailedReviewById(id);
    if (fetchError) {
      console.error('Erro ao carregar avaliação atualizada:', fetchError);
      return res.json({ id, message: 'Avaliação atualizada com sucesso' });
    }

    return res.json(reviewData);
  } catch (error) {
    console.error('Erro inesperado ao atualizar avaliação:', error);
    return res.status(500).json({ error: 'Erro interno ao atualizar avaliação' });
  }
}

export async function deleteReview(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.validatedParams ?? req.params;
    
    // Valida UUID
    const uuidValidation = validateUUID(id);
    if (!uuidValidation.valid) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: [{ field: 'id', message: uuidValidation.message }]
      });
    }
    
    secureLog('Deleting review', { userId, id });

    const { data, error } = await supabase
      .from('product_reviews')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('product_id')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Avaliação não encontrada' });
      }
      console.error('Erro ao remover avaliação:', error);
      return res.status(500).json({ error: 'Erro ao remover avaliação', details: error.message });
    }

    await invalidateUserReviewCaches(userId);
    if (data?.product_id) {
      await invalidateProductStatsCache(data.product_id);
    }

    return res.json({ message: 'Avaliação removida com sucesso' });
  } catch (error) {
    console.error('Erro inesperado ao remover avaliação:', error);
    return res.status(500).json({ error: 'Erro interno ao remover avaliação' });
  }
}

export async function getProductReviewStats(req, res) {
  try {
    const { id: productId } = req.validatedParams ?? req.params;
    
    // Valida UUID
    const uuidValidation = validateUUID(productId);
    if (!uuidValidation.valid) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: [{ field: 'id', message: uuidValidation.message }]
      });
    }
    
    const cacheKey = getProductStatsCacheKey(productId);
    const cached = await cacheGet(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    const { data, error } = await supabase
      .rpc('get_product_rating_stats', { p_product_id: productId });

    if (error) {
      console.error('Erro ao buscar estatísticas de avaliações:', error);
      return res.status(500).json({ error: 'Erro ao buscar estatísticas', details: error.message });
    }

    const stats = (data && data[0]) || {
      average_rating: 0,
      total_reviews: 0,
      rating_1_count: 0,
      rating_2_count: 0,
      rating_3_count: 0,
      rating_4_count: 0,
      rating_5_count: 0,
    };

    await cacheSet(cacheKey, stats, PRODUCT_STATS_TTL);
    return res.json(stats);
  } catch (error) {
    console.error('Erro inesperado ao buscar estatísticas de avaliações:', error);
    return res.status(500).json({ error: 'Erro interno ao buscar estatísticas de avaliações' });
  }
}
