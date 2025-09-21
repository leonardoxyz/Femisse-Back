import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export async function listAddresses(req, res) {
  try {
    const { usuario_id } = req.query;
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
    const { id } = req.params;
    
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
    const usuario_id = req.user.id; // pega do token JWT
    const { label, street, number, complement, neighborhood, city, state, zip_code, is_default } = req.body;
    
    // Validação básica
    if (!label || !street || !number || !neighborhood || !city || !state || !zip_code) {
      return res.status(400).json({ error: 'Campos obrigatórios: label, street, number, neighborhood, city, state, zip_code' });
    }
    
    const { data, error } = await supabase
      .from('address')
      .insert({
        usuario_id,
        label,
        street,
        number,
        complement,
        neighborhood,
        city,
        state,
        zip_code,
        is_default: is_default || false
      })
      .select()
      .single();
    
    if (error) throw error;
    
    res.status(201).json(data);
  } catch (err) {
    console.error('Erro ao criar endereço:', err);
    res.status(500).json({ error: 'Erro ao criar endereço', details: err.message });
  }
}

export async function updateAddress(req, res) {
  try {
    const { id } = req.params;
    const { label, street, number, complement, neighborhood, city, state, zip_code, is_default } = req.body;
    
    const { data, error } = await supabase
      .from('address')
      .update({
        label,
        street,
        number,
        complement,
        neighborhood,
        city,
        state,
        zip_code,
        is_default
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Endereço não encontrado' });
      }
      throw error;
    }
    
    res.json(data);
  } catch (err) {
    console.error('Erro ao atualizar endereço:', err);
    res.status(500).json({ error: 'Erro ao atualizar endereço', details: err.message });
  }
}

export async function deleteAddress(req, res) {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('address')
      .delete()
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Endereço não encontrado' });
      }
      throw error;
    }
    
    res.json({ message: 'Endereço deletado com sucesso', data });
  } catch (err) {
    console.error('Erro ao deletar endereço:', err);
    res.status(500).json({ error: 'Erro ao deletar endereço', details: err.message });
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
