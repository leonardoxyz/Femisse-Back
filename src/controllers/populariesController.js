import supabase from '../services/supabaseClient.js';
import { toPublicProductList } from '../dto/productsDTO.js';
import { logger } from '../utils/logger.js';

export const getPopular = async (req, res) => {
  try {
    const { page = 1, limit = 12 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    // Buscar produtos mais vendidos baseado em orders
    // Conta quantas vezes cada produto aparece em order_items
    const { data: orderItems, error: orderError } = await supabase
      .from('order_items')
      .select('product_id')
      .order('product_id');

    if (orderError) throw orderError;

    // Contar ocorrências de cada produto
    const productCounts = {};
    orderItems.forEach(item => {
      productCounts[item.product_id] = (productCounts[item.product_id] || 0) + 1;
    });

    // Ordenar produtos por quantidade de vendas (decrescente)
    const sortedProductIds = Object.entries(productCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([productId]) => productId);

    // Se não houver produtos vendidos, retornar produtos aleatórios
    if (sortedProductIds.length === 0) {
      const { data: allProducts, error: productsError } = await supabase
        .from('products')
        .select('*')
        .range(offset, offset + limitNum - 1)
        .order('created_at', { ascending: false});

      if (productsError) throw productsError;

      const { count } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })

      return res.json({
        success: true,
        data: toPublicProductList(allProducts || []),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limitNum)
        }
      });
    }

    // Paginação manual dos IDs
    const paginatedIds = sortedProductIds.slice(offset, offset + limitNum);

    // Buscar detalhes dos produtos
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .in('id', paginatedIds);

    if (productsError) throw productsError;

    // Reordenar produtos pela ordem de vendas
    const orderedProducts = paginatedIds
      .map(id => products.find(p => p.id === id))
      .filter(Boolean);

    logger.info({
      page: pageNum,
      limit: limitNum,
      totalBestSellers: sortedProductIds.length,
      returned: orderedProducts.length
    }, 'Produtos mais vendidos buscados');

    res.json({
      success: true,
      data: toPublicProductList(orderedProducts),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: sortedProductIds.length,
        totalPages: Math.ceil(sortedProductIds.length / limitNum)
      }
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Erro ao buscar produtos populares');
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar produtos populares',
      details: error.message,
    });
  }
};
