import supabase from '../services/supabaseClient.js';
import { logger } from '../utils/logger.js';

function formatCategoryNames(categories = []) {
  if (!Array.isArray(categories)) return [];

  const normalized = new Set();

  return categories.reduce((acc, category) => {
    if (!category) return acc;

    const trimmed = category.trim();
    if (!trimmed) return acc;

    const key = trimmed.toLowerCase();
    if (normalized.has(key)) return acc;

    normalized.add(key);

    const formatted = trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
    acc.push(formatted);
    return acc;
  }, []);
}

/**
 * Validar cupom e calcular desconto
 * @param {string} couponCode - Código do cupom
 * @param {string} userId - ID do usuário
 * @param {Array} cartItems - Itens do carrinho com { product_id, quantity, price, category }
 * @param {number} subtotal - Subtotal do pedido
 * @returns {Object} Resultado da validação com discount, coupon_id, etc.
 */
export async function validateCoupon(req, res) {
  try {
    const { code, cart_items, subtotal } = req.body;
    const userId = req.user.id;

    if (!code || !cart_items || !subtotal) {
      return res.status(400).json({
        valid: false,
        error: 'Dados incompletos',
        message: 'Código do cupom, itens do carrinho e subtotal são obrigatórios'
      });
    }

    // Normalizar código (uppercase e trim)
    const normalizedCode = code.trim().toUpperCase();

    // Buscar cupom no banco
    const { data: coupon, error: couponError } = await supabase
      .from('coupons')
      .select('*')
      .ilike('code', normalizedCode)
      .single();

    if (couponError || !coupon) {
      logger.info({ code: normalizedCode, userId }, 'Coupon not found:');
      return res.status(404).json({
        valid: false,
        error: 'Cupom inválido',
        message: 'Cupom não encontrado ou inválido'
      });
    }

    // Verificar se cupom está ativo
    if (!coupon.active) {
      return res.status(400).json({
        valid: false,
        error: 'Cupom inativo',
        message: 'Este cupom não está mais ativo'
      });
    }

    // Verificar validade do cupom (datas)
    const now = new Date();
    const validFrom = new Date(coupon.valid_from);
    const validTo = coupon.valid_to ? new Date(coupon.valid_to) : null;

    if (now < validFrom) {
      return res.status(400).json({
        valid: false,
        error: 'Cupom ainda não válido',
        message: `Este cupom será válido a partir de ${validFrom.toLocaleDateString('pt-BR')}`
      });
    }

    if (validTo && now > validTo) {
      return res.status(400).json({
        valid: false,
        error: 'Cupom expirado',
        message: 'Este cupom já expirou'
      });
    }

    // Verificar se atingiu número máximo de usos
    if (coupon.max_uses && coupon.used_count >= coupon.max_uses) {
      return res.status(400).json({
        valid: false,
        error: 'Cupom esgotado',
        message: 'Este cupom já foi utilizado o número máximo de vezes'
      });
    }

    // Verificar se usuário já usou o cupom (limite por usuário)
    const { data: userUsage, error: usageError } = await supabase
      .from('coupon_usage')
      .select('*')
      .eq('coupon_id', coupon.id)
      .eq('user_id', userId);

    if (!usageError && userUsage) {
      const userUsageCount = userUsage.length;
      const maxUsesPerUser = coupon.max_uses_per_user || 1;

      if (userUsageCount >= maxUsesPerUser) {
        return res.status(400).json({
          valid: false,
          error: 'Limite de uso atingido',
          message: 'Você já utilizou este cupom o número máximo de vezes permitido'
        });
      }
    }

    // Verificar valor mínimo de compra
    if (coupon.min_purchase_amount && subtotal < coupon.min_purchase_amount) {
      return res.status(400).json({
        valid: false,
        error: 'Valor mínimo não atingido',
        message: `Este cupom requer uma compra mínima de R$ ${coupon.min_purchase_amount.toFixed(2)}`
      });
    }

    // Calcular desconto baseado no escopo
    let discountAmount = 0;
    let applicableItems = [];
    let isApplicable = false;

    switch (coupon.scope) {
      case 'storewide':
        // Aplicável a todos os produtos
        isApplicable = true;
        applicableItems = cart_items;
        
        if (coupon.discount_type === 'percentage') {
          discountAmount = (subtotal * coupon.discount_value) / 100;
        } else {
          discountAmount = coupon.discount_value;
        }
        break;

      case 'category':
        // Aplicável a produtos de categorias específicas
        if (!coupon.applicable_categories || coupon.applicable_categories.length === 0) {
          return res.status(400).json({
            valid: false,
            error: 'Configuração inválida',
            message: 'Este cupom não está configurado corretamente'
          });
        }

        // Filtrar itens aplicáveis
        applicableItems = cart_items.filter(item => 
          item.category && coupon.applicable_categories.some(cat => 
            cat.toLowerCase() === item.category.toLowerCase()
          )
        );

        if (applicableItems.length === 0) {
          const formattedCategories = formatCategoryNames(coupon.applicable_categories);

          return res.status(400).json({
            valid: false,
            error: 'Cupom não aplicável',
            message: `Este cupom é válido apenas para as categorias: ${formattedCategories.join(', ')}`
          });
        }

        isApplicable = true;
        
        // Calcular subtotal dos itens aplicáveis
        const categorySubtotal = applicableItems.reduce((sum, item) => 
          sum + (item.price * item.quantity), 0
        );

        if (coupon.discount_type === 'percentage') {
          discountAmount = (categorySubtotal * coupon.discount_value) / 100;
        } else {
          discountAmount = Math.min(coupon.discount_value, categorySubtotal);
        }
        break;

      case 'product':
        // Aplicável a produtos específicos
        if (!coupon.applicable_products || coupon.applicable_products.length === 0) {
          return res.status(400).json({
            valid: false,
            error: 'Configuração inválida',
            message: 'Este cupom não está configurado corretamente'
          });
        }

        // Filtrar itens aplicáveis
        applicableItems = cart_items.filter(item => 
          coupon.applicable_products.includes(item.product_id)
        );

        if (applicableItems.length === 0) {
          return res.status(400).json({
            valid: false,
            error: 'Cupom não aplicável',
            message: 'Este cupom não é válido para os produtos no seu carrinho'
          });
        }

        isApplicable = true;
        
        // Calcular subtotal dos itens aplicáveis
        const productSubtotal = applicableItems.reduce((sum, item) => 
          sum + (item.price * item.quantity), 0
        );

        if (coupon.discount_type === 'percentage') {
          discountAmount = (productSubtotal * coupon.discount_value) / 100;
        } else {
          discountAmount = Math.min(coupon.discount_value, productSubtotal);
        }
        break;

      default:
        return res.status(400).json({
          valid: false,
          error: 'Tipo inválido',
          message: 'Este cupom possui um tipo inválido'
        });
    }

    // Garantir que desconto não seja maior que o subtotal
    discountAmount = Math.min(discountAmount, subtotal);
    discountAmount = Math.max(0, discountAmount); // Não permitir desconto negativo
    
    // Arredondar para 2 casas decimais
    discountAmount = Math.round(discountAmount * 100) / 100;

    logger.info({ 
      code: normalizedCode, 
      userId, 
      discountAmount,
      scope: coupon.scope
    }, 'Coupon validated successfully:');

    res.json({
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        description: coupon.description,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
        scope: coupon.scope
      },
      discount_amount: discountAmount,
      applicable_items: applicableItems.map(item => item.product_id),
      message: `Cupom aplicado! Desconto de R$ ${discountAmount.toFixed(2)}`
    });

  } catch (error) {
    logger.error({ err: error }, 'Error validating coupon');
    
    logger.info({ 
      userId: req.user?.id,
      error: error.message 
    }, 'Coupon validation failed:');

    res.status(500).json({
      valid: false,
      error: 'Erro ao validar cupom',
      message: 'Ocorreu um erro ao validar o cupom. Tente novamente.'
    });
  }
}

/**
 * Registrar uso de cupom após pagamento aprovado
 * @param {string} couponId - ID do cupom
 * @param {string} userId - ID do usuário
 * @param {string} orderId - ID do pedido
 * @param {number} discountApplied - Valor do desconto aplicado
 */
export async function registerCouponUsage(couponId, userId, orderId, discountApplied) {
  try {
    const { error } = await supabase
      .from('coupon_usage')
      .insert({
        coupon_id: couponId,
        user_id: userId,
        order_id: orderId,
        discount_applied: discountApplied,
        used_at: new Date().toISOString()
      });

    if (error) {
      logger.error({ err: error }, 'Error registering coupon usage');
      throw error;
    }

    logger.info({ 
      couponId, 
      userId, 
      orderId, 
      discountApplied 
    }, 'Coupon usage registered:');

    return true;
  } catch (error) {
    logger.error({ err: error }, 'Error in registerCouponUsage');
    return false;
  }
}

/**
 * Listar todos os cupons ativos (público)
 */
export async function listActiveCoupons(req, res) {
  try {
    const now = new Date().toISOString();

    const { data: coupons, error } = await supabase
      .from('coupons')
      .select('id, code, description, discount_type, discount_value, scope, valid_from, valid_to, min_purchase_amount')
      .eq('active', true)
      .lte('valid_from', now)
      .or(`valid_to.is.null,valid_to.gte.${now}`)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.json({
      coupons: coupons || [],
      count: coupons?.length || 0
    });

  } catch (error) {
    logger.error({ err: error }, 'Error listing active coupons');
    res.status(500).json({
      error: 'Erro ao listar cupons',
      message: 'Ocorreu um erro ao buscar cupons disponíveis'
    });
  }
}

/**
 * Criar novo cupom (apenas admin)
 */
export async function createCoupon(req, res) {
  try {
    const couponData = req.body;
    const userId = req.user.id;

    // Validar dados obrigatórios
    if (!couponData.code || !couponData.discount_type || !couponData.discount_value || !couponData.scope) {
      return res.status(400).json({
        error: 'Dados incompletos',
        message: 'Code, discount_type, discount_value e scope são obrigatórios'
      });
    }

    // Normalizar código
    couponData.code = couponData.code.trim().toUpperCase();

    // Verificar se código já existe
    const { data: existing } = await supabase
      .from('coupons')
      .select('id')
      .eq('code', couponData.code)
      .single();

    if (existing) {
      return res.status(400).json({
        error: 'Código já existe',
        message: 'Já existe um cupom com este código'
      });
    }

    const { data: coupon, error } = await supabase
      .from('coupons')
      .insert({
        ...couponData,
        created_by: userId,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    logger.info({ couponId: coupon.id, code: coupon.code, userId }, 'Coupon created:');

    res.status(201).json({
      message: 'Cupom criado com sucesso',
      coupon
    });

  } catch (error) {
    logger.error({ err: error }, 'Error creating coupon');
    res.status(500).json({
      error: 'Erro ao criar cupom',
      message: 'Ocorreu um erro ao criar o cupom'
    });
  }
}

/**
 * Atualizar cupom (apenas admin)
 */
export async function updateCoupon(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;
    const userId = req.user.id;

    // Normalizar código se fornecido
    if (updates.code) {
      updates.code = updates.code.trim().toUpperCase();
    }

    const { data: coupon, error } = await supabase
      .from('coupons')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    if (!coupon) {
      return res.status(404).json({
        error: 'Cupom não encontrado'
      });
    }

    logger.info({ couponId: id, userId }, 'Coupon updated:');

    res.json({
      message: 'Cupom atualizado com sucesso',
      coupon
    });

  } catch (error) {
    logger.error({ err: error }, 'Error updating coupon');
    res.status(500).json({
      error: 'Erro ao atualizar cupom',
      message: 'Ocorreu um erro ao atualizar o cupom'
    });
  }
}

/**
 * Deletar cupom (apenas admin)
 */
export async function deleteCoupon(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { error } = await supabase
      .from('coupons')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    logger.info({ couponId: id, userId }, 'Coupon deleted:');

    res.json({
      message: 'Cupom deletado com sucesso'
    });

  } catch (error) {
    logger.error({ err: error }, 'Error deleting coupon');
    res.status(500).json({
      error: 'Erro ao deletar cupom',
      message: 'Ocorreu um erro ao deletar o cupom'
    });
  }
}

/**
 * Obter histórico de uso de cupons do usuário
 */
export async function getUserCouponHistory(req, res) {
  try {
    const userId = req.user.id;

    const { data: history, error } = await supabase
      .from('coupon_usage')
      .select(`
        *,
        coupons (code, description),
        orders (order_number, total, created_at)
      `)
      .eq('user_id', userId)
      .order('used_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.json({
      history: history || [],
      count: history?.length || 0
    });

  } catch (error) {
    logger.error({ err: error }, 'Error getting user coupon history');
    res.status(500).json({
      error: 'Erro ao buscar histórico',
      message: 'Ocorreu um erro ao buscar seu histórico de cupons'
    });
  }
}

export default {
  validateCoupon,
  registerCouponUsage,
  listActiveCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  getUserCouponHistory
};
