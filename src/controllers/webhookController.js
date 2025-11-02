/**
 * WEBHOOK CONTROLLER - MELHOR ENVIO
 * 
 * Recebe e processa webhooks do MelhorEnvio para
 * atualizar status de envios em tempo real
 */

import supabase from '../services/supabaseClient.js';
import melhorEnvioService from '../services/melhorEnvioService.js';
import { sanitizeString } from '../utils/securityUtils.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/validateEnv.js';
import { validateMelhorEnvioWebhook } from '../services/webhookSecurityService.js';
import { sanitizeErrorMessage } from '../utils/errorSanitizer.js';

const {
  SUPABASE_URL,
  SUPABASE_KEY,
  MELHOR_ENVIO_API_KEY,
  MELHOR_ENVIO_API_SECRET,
  MELHOR_ENVIO_API_URL,
} = process.env;

/**
 * Processa webhook do MelhorEnvio
 * POST /api/webhooks/melhorenvio
 */
export async function handleMelhorEnvioWebhook(req, res) {
  try {
    const signature = req.headers['x-me-signature'];
    const payload = req.body;
    const sourceIP = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    
    logger.info({
      event: payload.event,
      orderId: payload.data?.id,
      hasSignature: !!signature,
      ip: sourceIP
    }, 'MelhorEnvio webhook received');
    
    // 🔒 SEGURANÇA: Valida webhook completo (assinatura + IP + replay)
    const validation = await validateMelhorEnvioWebhook(payload, signature, sourceIP);
    
    if (!validation.valid) {
      logger.warn({
        ip: sourceIP,
        error: validation.error,
        event: payload?.event,
      }, 'MelhorEnvio webhook validation failed');
      
      // 🔒 SEGURANÇA: Retorna 401 definitivamente (não 200)
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: validation.error
      });
    }
    
    // Extrai dados do webhook
    const { event, data } = payload;
    
    if (!event || !data) {
      return res.status(400).json({ 
        error: 'Payload do webhook inválido' 
      });
    }
    
    // Busca etiqueta no banco pelo melhorenvio_order_id
    const { data: label, error: labelError } = await supabase
      .from('shipping_labels')
      .select('id, user_id, order_id, melhorenvio_order_id, tracking_code, status, created_at, updated_at')
      .eq('melhorenvio_order_id', data.id)
      .single();
    
    if (labelError || !label) {
      logger.warn({ data: data.id }, 'Etiqueta não encontrada para webhook');
      
      // Registra evento mesmo sem etiqueta encontrada
      await supabase.from('shipping_events').insert([{
        shipping_label_id: null,
        event_type: event,
        status: data.status,
        melhorenvio_order_id: data.id,
        protocol: data.protocol,
        tracking_code: data.tracking || data.self_tracking,
        webhook_payload: payload,
        webhook_signature: signature,
        processed: false,
        error_message: 'Etiqueta não encontrada no banco de dados'
      }]);
      
      // Retorna 200 para não retentar
      return res.status(200).json({ 
        received: true,
        warning: 'Etiqueta não encontrada'
      });
    }
    
    // Registra evento
    const { data: eventRecord, error: eventError } = await supabase
      .from('shipping_events')
      .insert([{
        shipping_label_id: label.id,
        event_type: event,
        status: data.status,
        melhorenvio_order_id: data.id,
        protocol: data.protocol,
        tracking_code: data.tracking || data.self_tracking,
        webhook_payload: payload,
        webhook_signature: signature,
        processed: false
      }])
      .select()
      .single();
    
    if (eventError) {
      logger.error({ err: eventError }, 'Erro ao registrar evento');
      return res.status(500).json({ 
        error: 'Erro ao registrar evento' 
      });
    }
    
    // Processa evento e atualiza etiqueta
    const updateResult = await processWebhookEvent(label, event, data, eventRecord.id);
    
    if (!updateResult.success) {
      logger.error({ err: updateResult.error }, 'Erro ao processar evento');
      
      // Marca evento como erro
      await supabase
        .from('shipping_events')
        .update({ 
          processed: false,
          error_message: updateResult.error
        })
        .eq('id', eventRecord.id);
      
      return res.status(500).json({ 
        error: 'Erro ao processar evento',
        details: updateResult.error
      });
    }
    
    // Marca evento como processado
    await supabase
      .from('shipping_events')
      .update({ 
        processed: true,
        processed_at: new Date().toISOString()
      })
      .eq('id', eventRecord.id);
    
    logger.info({
      event,
      labelId: label.id,
      orderId: label.order_id
    }, 'MelhorEnvio webhook processed successfully');
    
    // Retorna 200 para confirmar recebimento
    return res.status(200).json({ 
      received: true,
      processed: true
    });
  } catch (error) {
    logger.error({ err: error }, 'Erro ao processar webhook');
    
    // 🔒 SEGURANÇA: Sanitiza erro antes de retornar
    const safeMessage = sanitizeErrorMessage(error, 'Erro ao processar webhook');
    
    // Retorna 500 (não 200) para erros internos
    // Webhooks legítimos devem ser retentados
    return res.status(500).json({ 
      error: safeMessage
    });
  }
}

/**
 * Processa evento do webhook e atualiza etiqueta
 */
async function processWebhookEvent(label, eventType, eventData, eventId) {
  try {
    const updates = {
      status: eventData.status,
      tracking_code: eventData.tracking || eventData.self_tracking || label.tracking_code,
      tracking_url: eventData.tracking_url || label.tracking_url,
      protocol: eventData.protocol || label.protocol
    };
    
    // Atualiza campos de data baseado no evento
    switch (eventType) {
      case 'order.created':
        // Etiqueta criada (já temos created_at)
        break;
        
      case 'order.released':
        // Etiqueta paga
        updates.paid_at = eventData.paid_at || new Date().toISOString();
        updates.payment_status = 'paid';
        break;
        
      case 'order.generated':
        // Etiqueta gerada
        updates.generated_at = eventData.generated_at || new Date().toISOString();
        break;
        
      case 'order.posted':
        // Encomenda postada
        updates.posted_at = eventData.posted_at || new Date().toISOString();
        
        // Atualiza status do pedido para 'shipped'
        await supabase
          .from('orders')
          .update({ status: 'shipped' })
          .eq('id', label.order_id);
        break;
        
      case 'order.delivered':
        // Encomenda entregue
        updates.delivered_at = eventData.delivered_at || new Date().toISOString();
        
        // Atualiza status do pedido para 'delivered'
        await supabase
          .from('orders')
          .update({ 
            status: 'delivered',
            completed_at: new Date().toISOString()
          })
          .eq('id', label.order_id);
        break;
        
      case 'order.cancelled':
        // Etiqueta cancelada
        updates.cancelled_at = eventData.cancelled_at || new Date().toISOString();
        break;
        
      case 'order.expired':
        // Etiqueta expirada
        updates.expired_at = eventData.expired_at || new Date().toISOString();
        break;
        
      case 'order.pending':
        // Etiqueta retornada ao carrinho
        updates.payment_status = 'pending';
        break;
        
      case 'order.undelivered':
      case 'order.paused':
      case 'order.suspended':
        // Problemas na entrega - não altera status do pedido
        break;
        
      case 'order.received':
        // Recebido em ponto de distribuição
        break;
    }
    
    // Atualiza etiqueta
    const { error: updateError } = await supabase
      .from('shipping_labels')
      .update(updates)
      .eq('id', label.id);
    
    if (updateError) {
      throw updateError;
    }
    
    // Log da operação
    await supabase.from('melhorenvio_logs').insert([{
      user_id: label.user_id,
      order_id: label.order_id,
      shipping_label_id: label.id,
      operation_type: 'webhook_processed',
      status: 'success',
      message: `Evento ${eventType} processado com sucesso`,
      request_data: { event: eventType, eventId },
      response_data: updates
    }]);
    
    return { success: true };
  } catch (error) {
    logger.error({ err: error }, 'Erro ao processar evento');
    
    // Log do erro
    await supabase.from('melhorenvio_logs').insert([{
      user_id: label.user_id,
      order_id: label.order_id,
      shipping_label_id: label.id,
      operation_type: 'webhook_error',
      status: 'error',
      message: `Erro ao processar evento ${eventType}`,
      error_details: { 
        message: error.message,
        event: eventType,
        eventId
      }
    }]);
    
    return { 
      success: false, 
      error: error.message 
    };
  }
}

/**
 * Testa webhook (para desenvolvimento)
 * POST /api/webhooks/melhorenvio/test
 */
export async function testWebhook(req, res) {
  if (env.NODE_ENV === 'production') {
    return res.status(403).json({ 
      error: 'Endpoint de teste não disponível em produção' 
    });
  }
  
  try {
    const { labelId, eventType } = req.body;
    
    if (!labelId || !eventType) {
      return res.status(400).json({ 
        error: 'labelId e eventType são obrigatórios' 
      });
    }
    
    // Busca etiqueta
    const { data: label, error } = await supabase
      .from('shipping_labels')
      .select('id, user_id, order_id, melhorenvio_order_id, tracking_code, status, created_at, updated_at')
      .eq('id', labelId)
      .single();
    
    if (error || !label) {
      return res.status(404).json({ 
        error: 'Etiqueta não encontrada' 
      });
    }
    
    // Simula payload do webhook
    const mockPayload = {
      event: eventType,
      data: {
        id: label.melhorenvio_order_id,
        protocol: label.protocol,
        status: eventType.replace('order.', ''),
        tracking: label.tracking_code || 'TEST123456789BR',
        self_tracking: null,
        user_id: label.user_id,
        tags: [],
        created_at: label.created_at,
        paid_at: eventType === 'order.released' ? new Date().toISOString() : null,
        generated_at: eventType === 'order.generated' ? new Date().toISOString() : null,
        posted_at: eventType === 'order.posted' ? new Date().toISOString() : null,
        delivered_at: eventType === 'order.delivered' ? new Date().toISOString() : null,
        cancelled_at: eventType === 'order.cancelled' ? new Date().toISOString() : null,
        expired_at: eventType === 'order.expired' ? new Date().toISOString() : null,
        tracking_url: `https://www.melhorrastreio.com.br/rastreio/${label.tracking_code || 'TEST123456789BR'}`
      }
    };
    
    // Registra evento de teste
    const { data: eventRecord } = await supabase
      .from('shipping_events')
      .insert([{
        shipping_label_id: label.id,
        event_type: eventType,
        status: mockPayload.data.status,
        melhorenvio_order_id: label.melhorenvio_order_id,
        protocol: label.protocol,
        tracking_code: mockPayload.data.tracking,
        webhook_payload: mockPayload,
        webhook_signature: 'TEST_SIGNATURE',
        processed: false
      }])
      .select()
      .single();
    
    // Processa evento
    const result = await processWebhookEvent(label, eventType, mockPayload.data, eventRecord.id);
    
    if (!result.success) {
      return res.status(500).json({ 
        error: 'Erro ao processar evento de teste',
        details: result.error
      });
    }
    
    // Marca como processado
    await supabase
      .from('shipping_events')
      .update({ 
        processed: true,
        processed_at: new Date().toISOString()
      })
      .eq('id', eventRecord.id);
    
    return res.json({ 
      success: true,
      message: 'Evento de teste processado com sucesso',
      event: eventRecord
    });
  } catch (error) {
    logger.error({ err: error }, 'Erro ao testar webhook');
    return res.status(500).json({ 
      error: 'Erro ao testar webhook',
      details: error.message
    });
  }
}

export default {
  handleMelhorEnvioWebhook,
  testWebhook
};
