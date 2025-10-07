import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { 
  validateAddress, 
  validateUUID, 
  secureLog, 
  getErrorMessage 
} from '../utils/securityUtils.js';

dotenv.config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const isDevelopment = process.env.NODE_ENV !== 'production';
const isProduction = process.env.NODE_ENV === 'production';

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
    console.error('Erro ao listar endereços:', err);
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
    console.error('Erro ao buscar endereço:', err);
    res.status(500).json({ error: 'Erro ao buscar endereço', details: err.message });
  }
}

export async function createAddress(req, res) {
  try {
    const usuario_id = req.user.id;
    secureLog('Creating address for user:', { usuario_id });
    
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
      console.error('Erro ao verificar limite de endereços:', countError);
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
      console.error('Erro ao criar endereço:', error);
      return res.status(500).json(getErrorMessage(error, 'Erro ao criar endereço'));
    }
    
    secureLog('Address created successfully');
    res.status(201).json(data);
  } catch (err) {
    console.error('Erro ao criar endereço:', err);
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
    
    secureLog('Updating address:', { id, usuario_id });
    
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
      console.error('Erro ao buscar endereço:', fetchError);
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
      console.error('Erro ao atualizar endereço:', error);
      return res.status(500).json(getErrorMessage(error, 'Erro ao atualizar endereço'));
    }
    
    secureLog('Address updated successfully');
    res.json(data);
  } catch (err) {
    console.error('Erro ao atualizar endereço:', err);
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
    
    secureLog('Deleting address:', { id, usuario_id });
    
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
      console.error('Erro ao buscar endereço:', fetchError);
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
      console.error('Erro ao deletar endereço:', error);
      return res.status(500).json(getErrorMessage(error, 'Erro ao deletar endereço'));
    }
    
    secureLog('Address deleted successfully');
    res.json({ message: 'Endereço deletado com sucesso' });
  } catch (err) {
    console.error('Erro ao deletar endereço:', err);
    res.status(500).json(getErrorMessage(err, 'Erro ao deletar endereço'));
  }
}

export async function listMyAddresses(req, res) {
  try {
    const usuario_id = req.user.id;
    
    const { data, error } = await supabase
      .from('address')
      .select('*')
      .eq('usuario_id', usuario_id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    res.json(data || []);
  } catch (err) {
    console.error('Erro ao listar endereços do usuário:', err);
    res.status(500).json({ error: 'Erro ao listar endereços do usuário autenticado', details: err.message });
  }
}
