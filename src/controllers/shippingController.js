/**
 * CONTROLLER DE ENVIOS - MELHOR ENVIO
 * 
 * Gerencia todas as operações relacionadas a fretes e envios
 * através da integração com MelhorEnvio
 */

import supabase from '../services/supabaseClient.js';
import melhorEnvioService from '../services/melhorEnvioService.js';
import { 
  validateUUID, 
  validatePositiveDecimal, 
  validatePositiveInteger,
  sanitizeString,
  secureLog, 
  getErrorMessage 
} from '../utils/securityUtils.js';

/**
 * AUTENTICAÇÃO OAUTH2
 */

/**
 * Inicia processo de autorização OAuth2
 * GET /api/shipping/auth/authorize
 */
export async function initiateAuthorization(req, res) {
  try {
    const userId = req.user.id;
    
    // Gera state único para segurança
    const state = `${userId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    // Salva state temporariamente (pode usar cache ou sessão)
    // Por simplicidade, vamos incluir no próprio state
    
    const authUrl = melhorEnvioService.getAuthorizationUrl(state);
    
    secureLog('MelhorEnvio authorization initiated', { userId });
    
    return res.json({ 
      success: true, 
      authorizationUrl: authUrl,
      message: 'Redirecione o usuário para esta URL para autorizar o aplicativo'
    });
  } catch (error) {
    console.error('Erro ao iniciar autorização:', error);
    return res.status(500).json({ 
      error: 'Erro ao iniciar autorização',
      details: getErrorMessage(error)
    });
  }
}

/**
 * Callback OAuth2 - recebe código de autorização
 * GET /api/shipping/auth/callback
 */
export async function handleAuthCallback(req, res) {
  try {
    const { code, state, error: authError } = req.query;
    
    if (authError) {
      return res.status(400).json({ 
        error: 'Autorização negada',
        details: authError
      });
    }
    
    if (!code) {
      return res.status(400).json({ 
        error: 'Código de autorização não fornecido'
      });
    }
    
    // Extrai userId do state (formato: userId-timestamp-random)
    const userId = state?.split('-')[0];
    
    if (!userId || !validateUUID(userId).valid) {
      return res.status(400).json({ 
        error: 'State inválido'
      });
    }
    
    // Troca código por tokens
    const result = await melhorEnvioService.exchangeCodeForTokens(code, userId);
    
    if (!result.success) {
      return res.status(400).json({ 
        error: 'Erro ao obter tokens',
        details: result.error
      });
    }
    
    secureLog('MelhorEnvio authorization completed', { userId });
    
    // Redireciona para página de sucesso no frontend
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return res.redirect(`${frontendUrl}/profile/shipping?auth=success`);
  } catch (error) {
    console.error('Erro no callback de autorização:', error);
    return res.status(500).json({ 
      error: 'Erro ao processar autorização',
      details: getErrorMessage(error)
    });
  }
}

/**
 * Verifica se usuário tem token válido
 * GET /api/shipping/auth/status
 */
export async function checkAuthStatus(req, res) {
  try {
    const userId = req.user.id;
    
    const { data: token, error } = await supabase
      .from('melhorenvio_tokens')
      .select('expires_at, created_at')
      .eq('user_id', userId)
      .single();
    
    if (error || !token) {
      return res.json({ 
        authorized: false,
        message: 'Usuário precisa autorizar o aplicativo MelhorEnvio'
      });
    }
    
    const expiresAt = new Date(token.expires_at);
    const isExpired = expiresAt < new Date();
    
    return res.json({ 
      authorized: !isExpired,
      expiresAt: token.expires_at,
      authorizedSince: token.created_at
    });
  } catch (error) {
    console.error('Erro ao verificar status de autorização:', error);
    return res.status(500).json({ 
      error: 'Erro ao verificar autorização'
    });
  }
}

/**
 * COTAÇÃO DE FRETES
 */

/**
 * Calcula cotação de frete
 * POST /api/shipping/calculate
 */
export async function calculateShipping(req, res) {
  try {
    const userId = req.user.id;
    const payload = req.validatedBody ?? req.body;
    
    // Validações
    if (!payload.fromZipCode || !payload.toZipCode) {
      return res.status(400).json({ 
        error: 'CEPs de origem e destino são obrigatórios'
      });
    }
    
    if (!payload.products || !Array.isArray(payload.products) || payload.products.length === 0) {
      return res.status(400).json({ 
        error: 'Produtos são obrigatórios para cotação'
      });
    }
    
    // Valida cada produto
    for (const product of payload.products) {
      if (!product.width || !product.height || !product.length || !product.weight) {
        return res.status(400).json({ 
          error: 'Todos os produtos devem ter dimensões (width, height, length, weight)'
        });
      }
    }
    
    const result = await melhorEnvioService.calculateShipping(userId, {
      fromZipCode: payload.fromZipCode,
      toZipCode: payload.toZipCode,
      products: payload.products,
      orderId: payload.orderId || null,
      receipt: payload.receipt || false,
      ownHand: payload.ownHand || false,
      collect: payload.collect || false
    });
    
    if (!result.success) {
      return res.status(400).json({ 
        error: result.error
      });
    }
    
    return res.json({ 
      success: true,
      quotes: result.data,
      savedQuotes: result.savedQuotes
    });
  } catch (error) {
    console.error('Erro ao calcular frete:', error);
    return res.status(500).json({ 
      error: 'Erro ao calcular frete',
      details: getErrorMessage(error)
    });
  }
}

/**
 * Lista cotações salvas do usuário
 * GET /api/shipping/quotes
 */
export async function listQuotes(req, res) {
  try {
    const userId = req.user.id;
    const { order_id: orderId } = req.query;
    
    let query = supabase
      .from('shipping_quotes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (orderId) {
      const uuidValidation = validateUUID(orderId);
      if (!uuidValidation.valid) {
        return res.status(400).json({ 
          error: 'ID do pedido inválido'
        });
      }
      query = query.eq('order_id', orderId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Erro ao listar cotações:', error);
      return res.status(500).json({ 
        error: 'Erro ao listar cotações'
      });
    }
    
    return res.json(data || []);
  } catch (error) {
    console.error('Erro ao listar cotações:', error);
    return res.status(500).json({ 
      error: 'Erro ao listar cotações'
    });
  }
}

/**
 * ETIQUETAS DE ENVIO
 */

/**
 * Cria etiqueta de envio
 * POST /api/shipping/labels
 */
export async function createLabel(req, res) {
  try {
    const userId = req.user.id;
    const payload = req.validatedBody ?? req.body;
    
    // Validações básicas
    if (!payload.orderId) {
      return res.status(400).json({ 
        error: 'ID do pedido é obrigatório'
      });
    }
    
    const orderValidation = validateUUID(payload.orderId);
    if (!orderValidation.valid) {
      return res.status(400).json({ 
        error: 'ID do pedido inválido'
      });
    }
    
    // Verifica se pedido pertence ao usuário
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, user_id')
      .eq('id', payload.orderId)
      .eq('user_id', userId)
      .single();
    
    if (orderError || !order) {
      return res.status(404).json({ 
        error: 'Pedido não encontrado'
      });
    }
    
    // Verifica se já existe etiqueta para este pedido
    const { data: existingLabel } = await supabase
      .from('shipping_labels')
      .select('id, status')
      .eq('order_id', payload.orderId)
      .single();
    
    if (existingLabel && existingLabel.status !== 'cancelled') {
      return res.status(400).json({ 
        error: 'Já existe uma etiqueta ativa para este pedido'
      });
    }
    
    const result = await melhorEnvioService.createShippingLabel(userId, payload.orderId, {
      serviceId: payload.serviceId,
      serviceName: payload.serviceName,
      companyId: payload.companyId,
      companyName: payload.companyName,
      quoteId: payload.quoteId || null,
      from: payload.from,
      to: payload.to,
      products: payload.products,
      volumes: payload.volumes,
      insuranceValue: payload.insuranceValue || 0,
      receipt: payload.receipt || false,
      ownHand: payload.ownHand || false,
      collect: payload.collect || false,
      reverse: payload.reverse || false,
      nonCommercial: payload.nonCommercial || false,
      invoice: payload.invoice || null,
      tags: payload.tags || []
    });
    
    if (!result.success) {
      return res.status(400).json({ 
        error: result.error
      });
    }
    
    return res.status(201).json({ 
      success: true,
      label: result.data
    });
  } catch (error) {
    console.error('Erro ao criar etiqueta:', error);
    return res.status(500).json({ 
      error: 'Erro ao criar etiqueta',
      details: getErrorMessage(error)
    });
  }
}

/**
 * Lista etiquetas do usuário
 * GET /api/shipping/labels
 */
export async function listLabels(req, res) {
  try {
    const userId = req.user.id;
    const { order_id: orderId, status } = req.query;
    
    let query = supabase
      .from('shipping_labels')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (orderId) {
      const uuidValidation = validateUUID(orderId);
      if (!uuidValidation.valid) {
        return res.status(400).json({ 
          error: 'ID do pedido inválido'
        });
      }
      query = query.eq('order_id', orderId);
    }
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Erro ao listar etiquetas:', error);
      return res.status(500).json({ 
        error: 'Erro ao listar etiquetas'
      });
    }
    
    return res.json(data || []);
  } catch (error) {
    console.error('Erro ao listar etiquetas:', error);
    return res.status(500).json({ 
      error: 'Erro ao listar etiquetas'
    });
  }
}

/**
 * Busca etiqueta por ID
 * GET /api/shipping/labels/:id
 */
export async function getLabelById(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    const uuidValidation = validateUUID(id);
    if (!uuidValidation.valid) {
      return res.status(400).json({ 
        error: 'ID da etiqueta inválido'
      });
    }
    
    const { data, error } = await supabase
      .from('shipping_labels')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
    
    if (error || !data) {
      return res.status(404).json({ 
        error: 'Etiqueta não encontrada'
      });
    }
    
    // Busca eventos relacionados
    const { data: events } = await supabase
      .from('shipping_events')
      .select('*')
      .eq('shipping_label_id', id)
      .order('created_at', { ascending: false });
    
    return res.json({
      ...data,
      events: events || []
    });
  } catch (error) {
    console.error('Erro ao buscar etiqueta:', error);
    return res.status(500).json({ 
      error: 'Erro ao buscar etiqueta'
    });
  }
}

/**
 * Gera etiqueta (após pagamento)
 * POST /api/shipping/labels/:id/generate
 */
export async function generateLabelById(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    const uuidValidation = validateUUID(id);
    if (!uuidValidation.valid) {
      return res.status(400).json({ 
        error: 'ID da etiqueta inválido'
      });
    }
    
    // Busca etiqueta
    const { data: label, error } = await supabase
      .from('shipping_labels')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
    
    if (error || !label) {
      return res.status(404).json({ 
        error: 'Etiqueta não encontrada'
      });
    }
    
    if (label.status !== 'released') {
      return res.status(400).json({ 
        error: 'Etiqueta precisa estar paga (status: released) para ser gerada'
      });
    }
    
    const result = await melhorEnvioService.generateLabel(userId, label.melhorenvio_order_id);
    
    if (!result.success) {
      return res.status(400).json({ 
        error: result.error
      });
    }
    
    // Atualiza status no banco
    await supabase
      .from('shipping_labels')
      .update({ 
        status: 'generated',
        generated_at: new Date().toISOString()
      })
      .eq('id', id);
    
    return res.json({ 
      success: true,
      message: 'Etiqueta gerada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao gerar etiqueta:', error);
    return res.status(500).json({ 
      error: 'Erro ao gerar etiqueta'
    });
  }
}

/**
 * Imprime etiqueta
 * POST /api/shipping/labels/:id/print
 */
export async function printLabelById(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    const uuidValidation = validateUUID(id);
    if (!uuidValidation.valid) {
      return res.status(400).json({ 
        error: 'ID da etiqueta inválido'
      });
    }
    
    const { data: label, error } = await supabase
      .from('shipping_labels')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
    
    if (error || !label) {
      return res.status(404).json({ 
        error: 'Etiqueta não encontrada'
      });
    }
    
    const result = await melhorEnvioService.printLabel(userId, label.melhorenvio_order_id);
    
    if (!result.success) {
      return res.status(400).json({ 
        error: result.error
      });
    }
    
    // Salva URL da etiqueta
    await supabase
      .from('shipping_labels')
      .update({ label_url: result.url })
      .eq('id', id);
    
    return res.json({ 
      success: true,
      url: result.url
    });
  } catch (error) {
    console.error('Erro ao imprimir etiqueta:', error);
    return res.status(500).json({ 
      error: 'Erro ao imprimir etiqueta'
    });
  }
}

/**
 * Cancela etiqueta
 * POST /api/shipping/labels/:id/cancel
 */
export async function cancelLabelById(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { reason } = req.body;
    
    const uuidValidation = validateUUID(id);
    if (!uuidValidation.valid) {
      return res.status(400).json({ 
        error: 'ID da etiqueta inválido'
      });
    }
    
    const { data: label, error } = await supabase
      .from('shipping_labels')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
    
    if (error || !label) {
      return res.status(404).json({ 
        error: 'Etiqueta não encontrada'
      });
    }
    
    const result = await melhorEnvioService.cancelLabel(
      userId, 
      label.melhorenvio_order_id, 
      reason
    );
    
    if (!result.success) {
      return res.status(400).json({ 
        error: result.error
      });
    }
    
    // Atualiza status no banco
    await supabase
      .from('shipping_labels')
      .update({ 
        status: 'cancelled',
        cancelled_at: new Date().toISOString()
      })
      .eq('id', id);
    
    return res.json({ 
      success: true,
      message: 'Etiqueta cancelada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao cancelar etiqueta:', error);
    return res.status(500).json({ 
      error: 'Erro ao cancelar etiqueta'
    });
  }
}

/**
 * RASTREAMENTO
 */

/**
 * Rastreia envio
 * GET /api/shipping/track/:id
 */
export async function trackShipment(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    const uuidValidation = validateUUID(id);
    if (!uuidValidation.valid) {
      return res.status(400).json({ 
        error: 'ID da etiqueta inválido'
      });
    }
    
    const { data: label, error } = await supabase
      .from('shipping_labels')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
    
    if (error || !label) {
      return res.status(404).json({ 
        error: 'Etiqueta não encontrada'
      });
    }
    
    const result = await melhorEnvioService.trackShipment(userId, label.melhorenvio_order_id);
    
    if (!result.success) {
      return res.status(400).json({ 
        error: result.error
      });
    }
    
    return res.json({ 
      success: true,
      tracking: result.data
    });
  } catch (error) {
    console.error('Erro ao rastrear envio:', error);
    return res.status(500).json({ 
      error: 'Erro ao rastrear envio'
    });
  }
}

/**
 * Lista eventos de rastreamento
 * GET /api/shipping/labels/:id/events
 */
export async function listLabelEvents(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    const uuidValidation = validateUUID(id);
    if (!uuidValidation.valid) {
      return res.status(400).json({ 
        error: 'ID da etiqueta inválido'
      });
    }
    
    // Verifica se etiqueta pertence ao usuário
    const { data: label, error: labelError } = await supabase
      .from('shipping_labels')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
    
    if (labelError || !label) {
      return res.status(404).json({ 
        error: 'Etiqueta não encontrada'
      });
    }
    
    const { data, error } = await supabase
      .from('shipping_events')
      .select('*')
      .eq('shipping_label_id', id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Erro ao listar eventos:', error);
      return res.status(500).json({ 
        error: 'Erro ao listar eventos'
      });
    }
    
    return res.json(data || []);
  } catch (error) {
    console.error('Erro ao listar eventos:', error);
    return res.status(500).json({ 
      error: 'Erro ao listar eventos'
    });
  }
}

export default {
  // Auth
  initiateAuthorization,
  handleAuthCallback,
  checkAuthStatus,
  
  // Quotes
  calculateShipping,
  listQuotes,
  
  // Labels
  createLabel,
  listLabels,
  getLabelById,
  generateLabelById,
  printLabelById,
  cancelLabelById,
  
  // Tracking
  trackShipment,
  listLabelEvents
};
