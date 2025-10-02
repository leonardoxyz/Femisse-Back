import supabase from '../services/supabaseClient.js';
import {
  cacheDelete,
  cacheGet,
  cacheSet,
} from '../services/cacheService.js';

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
  id: review.id,
  user_id: review.user_id,
  product_id: review.product_id,
  product_name: review.product_name,
  product_image: resolvePrimaryImage(review.product_image, imageMap),
  rating: review.rating,
  comment: review.comment,
  created_at: review.created_at,
  updated_at: review.updated_at,
  can_edit: true,
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
      return res.json(cached);
    }

    const { data, error } = await supabase
      .from('product_reviews_detailed')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao listar avaliações:', error);
      return res.status(500).json({ error: 'Erro ao listar avaliações', details: error.message });
    }

    const reviews = data ?? [];
    const allImageIds = new Set();
    reviews.forEach((review) => {
      normalizeImageRefs(review.product_image).forEach((id) => allImageIds.add(id));
    });

    const imageMap = await fetchImagesByIds(allImageIds);
    const formatted = reviews.map((review) => formatReviewResponse(review, imageMap));

    await cacheSet(cacheKey, formatted, REVIEW_LIST_TTL);
    return res.json(formatted);
  } catch (error) {
    console.error('Erro inesperado ao listar avaliações:', error);
    return res.status(500).json({ error: 'Erro interno ao listar avaliações' });
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

    const { data, error } = await supabase.rpc('list_user_reviewable_products', { p_user_id: userId });
    console.log('RPC reviewable data:', data);

    if (error) {
      console.error('Erro ao listar produtos avaliáveis:', error);
      return res.status(500).json({ error: 'Erro ao listar produtos avaliáveis', details: error.message });
    }

    const products = data ?? [];
    const imageIds = new Set();
    products.forEach((product) => {
      normalizeImageRefs(product.product_image).forEach((id) => imageIds.add(id));
    });

    const imageMap = await fetchImagesByIds(imageIds);
    const formatted = products.map((product) => ({
      id: product.product_id,
      name: product.product_name,
      image: resolvePrimaryImage(product.product_image, imageMap),
      order_id: product.order_id,
      order_date: product.order_date,
      has_review: product.has_review,
    }));

    await cacheSet(cacheKey, formatted, REVIEWABLE_LIST_TTL);
    return res.json(formatted);
  } catch (error) {
    console.error('Erro inesperado ao listar produtos avaliáveis:', error);
    return res.status(500).json({ error: 'Erro interno ao listar produtos avaliáveis' });
  }
}

export async function createReview(req, res) {
  try {
    const userId = req.user.id;
    const { product_id, order_id, rating, comment } = req.validatedBody ?? req.body;
    console.log('createReview payload', { userId, product_id, order_id, rating, comment });

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
    const payload = req.validatedBody ?? req.body;

    const updates = {};
    if (payload.rating !== undefined) updates.rating = payload.rating;
    if (payload.comment !== undefined) updates.comment = payload.comment;

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
