import supabase from '../services/supabaseClient.js';
import { 
  validateAddress, 
  validateUUID, 
  getErrorMessage 
} from '../utils/securityUtils.js';
import { toPublicAddressList } from '../dto/addressDTO.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/validateEnv.js';

const isDevelopment = env.NODE_ENV !== 'production';
const isProduction = env.NODE_ENV === 'production';

export async function listAddresses(req, res) {
  try {
    const { usuario_id } = req.validatedQuery ?? req.query;
    let query = supabase.from('address').select('*');
    
    if (usuario_id) {
      query = query.eq('usuario_id', usuario_id);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    res.json(data || []);
  } catch (err) {
    logger.error({ err: err }, 'Erro ao listar endereços');
    res.status(500).json({ error: 'Erro ao listar endereços', details: err.message });
  }
}

export async function getAddressById(req, res) {
  try {
    const { id } = req.validatedParams ?? req.params;
    
    const { data, error } = await supabase
      .from('address')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Endereço não encontrado' });
      }
      throw error;
    }
    
    res.json(data);
  } catch (err) {
    logger.error({ err: err }, 'Erro ao buscar endereço');
    res.status(500).json({ error: 'Erro ao buscar endereço', details: err.message });
  }
}

export async function createAddress(req, res) {
  try {
    const usuario_id = req.user.id;
    logger.info({ usuario_id }, 'Creating address for user:');
    
    const addressData = req.validatedBody ?? req.body;
    
    // Validação completa do endereço
    const validation = validateAddress(addressData);
    
    if (!validation.valid) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: validation.errors
      });
    }
    
    // Verifica limite de endereços por usuário (máximo 10)
    const { count, error: countError } = await supabase
      .from('address')
      .select('*', { count: 'exact', head: true })
      .eq('usuario_id', usuario_id);
    
    if (countError) {
      logger.error({ err: countError }, 'Erro ao verificar limite de endereços');
    } else if (count >= 10) {
      return res.status(400).json({ 
        error: 'Limite atingido',
        details: 'Você pode ter no máximo 10 endereços cadastrados'
      });
    }
    
    const { data, error } = await supabase
      .from('address')
      .insert({
        usuario_id,
        ...validation.sanitized,
        complement: addressData.complement || null,
        is_default: addressData.is_default || false
      })
      .select()
      .single();
    
    if (error) {
      logger.error({ err: error }, 'Erro ao criar endereço');
      return res.status(500).json(getErrorMessage(error, 'Erro ao criar endereço'));
    }
    
    logger.info('Address created successfully');
    res.status(201).json(data);
  } catch (err) {
    logger.error({ err: err }, 'Erro ao criar endereço');
    res.status(500).json(getErrorMessage(err, 'Erro ao criar endereço'));
  }
}

export async function updateAddress(req, res) {
  try {
    const { id } = req.validatedParams ?? req.params;
    const usuario_id = req.user.id;
    
    // Valida UUID
    const uuidValidation = validateUUID(id);
    if (!uuidValidation.valid) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: [{ field: 'id', message: uuidValidation.message }]
      });
    }
    
    logger.info({ id, usuario_id }, 'Updating address:');
    
    const addressData = req.validatedBody ?? req.body;
    
    // Validação completa do endereço
    const validation = validateAddress(addressData);
    
    if (!validation.valid) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: validation.errors
      });
    }
    
    // Verifica se o endereço pertence ao usuário
    const { data: existingAddress, error: fetchError } = await supabase
      .from('address')
      .select('usuario_id')
      .eq('id', id)
      .single();
    
    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Endereço não encontrado' });
      }
      logger.error({ err: fetchError }, 'Erro ao buscar endereço');
      return res.status(500).json(getErrorMessage(fetchError, 'Erro ao atualizar endereço'));
    }
    
    if (existingAddress.usuario_id !== usuario_id) {
      return res.status(403).json({ 
        error: 'Não autorizado',
        details: 'Você não tem permissão para atualizar este endereço'
      });
    }
    
    const { data, error } = await supabase
      .from('address')
      .update({
        ...validation.sanitized,
        complement: addressData.complement || null,
        is_default: addressData.is_default
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      logger.error({ err: error }, 'Erro ao atualizar endereço');
      return res.status(500).json(getErrorMessage(error, 'Erro ao atualizar endereço'));
    }
    
    logger.info('Address updated successfully');
    res.json(data);
  } catch (err) {
    logger.error({ err: err }, 'Erro ao atualizar endereço');
    res.status(500).json(getErrorMessage(err, 'Erro ao atualizar endereço'));
  }
}

export async function deleteAddress(req, res) {
  try {
    const { id } = req.validatedParams ?? req.params;
    const usuario_id = req.user.id;
    
    // Valida UUID
    const uuidValidation = validateUUID(id);
    if (!uuidValidation.valid) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: [{ field: 'id', message: uuidValidation.message }]
      });
    }
    
    logger.info({ id, usuario_id }, 'Deleting address:');
    
    // Verifica se o endereço pertence ao usuário
    const { data: existingAddress, error: fetchError } = await supabase
      .from('address')
      .select('usuario_id')
      .eq('id', id)
      .single();
    
    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Endereço não encontrado' });
      }
      logger.error({ err: fetchError }, 'Erro ao buscar endereço');
      return res.status(500).json(getErrorMessage(fetchError, 'Erro ao deletar endereço'));
    }
    
    if (existingAddress.usuario_id !== usuario_id) {
      return res.status(403).json({ 
        error: 'Não autorizado',
        details: 'Você não tem permissão para deletar este endereço'
      });
    }
    
    const { error } = await supabase
      .from('address')
      .delete()
      .eq('id', id);
    
    if (error) {
      logger.error({ err: error }, 'Erro ao deletar endereço');
      return res.status(500).json(getErrorMessage(error, 'Erro ao deletar endereço'));
    }
    
    logger.info('Address deleted successfully');
    res.json({ message: 'Endereço deletado com sucesso' });
  } catch (err) {
    logger.error({ err: err }, 'Erro ao deletar endereço');
    res.status(500).json(getErrorMessage(err, 'Erro ao deletar endereço'));
  }
}

export async function listMyAddresses(req, res) {
  try {
    const usuario_id = req.user.id;
    
    const { data = [], error } = await supabase
      .from('address')
      .select('*')
      .eq('usuario_id', usuario_id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    const addresses = toPublicAddressList(data);
    res.json({ success: true, data: addresses });
  } catch (err) {
    logger.error({ err: err }, 'Erro ao listar endereços do usuário');
    res.status(500).json({ success: false, message: 'Erro ao listar endereços do usuário autenticado', details: err.message });
  }
}
