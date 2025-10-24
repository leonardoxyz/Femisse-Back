import supabase from '../services/supabaseClient.js';

import { logger } from '../utils/logger.js';
export async function listCards(req, res) {
  try {
    const { usuario_id } = req.query;

    let query = supabase.from('cartoes').select('*');
    if (usuario_id) {
      query = query.eq('usuario_id', usuario_id);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.json(data ?? []);
  } catch (error) {
    logger.error({ err: error }, 'Erro ao listar cartões');
    res.status(500).json({ error: 'Erro ao listar cartões' });
  }
}

export async function getCardById(req, res) {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('cartoes')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Cartão não encontrado' });
      }
      throw error;
    }

    res.json(data);
  } catch (error) {
    logger.error({ err: error }, 'Erro ao buscar cartão');
    res.status(500).json({ error: 'Erro ao buscar cartão' });
  }
}

export async function createCard(req, res) {
  try {
    const { usuario_id, bandeira, ultimos_digitos, nome_titular, validade_mes, validade_ano, principal } = req.body;

    if (!usuario_id || !bandeira || !ultimos_digitos || !nome_titular || !validade_mes || !validade_ano) {
      return res.status(400).json({ error: 'Campos obrigatórios ausentes' });
    }

    const { data, error } = await supabase
      .from('cartoes')
      .insert({
        usuario_id,
        bandeira,
        ultimos_digitos,
        nome_titular,
        validade_mes,
        validade_ano,
        principal: principal ?? false,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json(data);
  } catch (error) {
    logger.error({ err: error }, 'Erro ao criar cartão');
    res.status(500).json({ error: 'Erro ao criar cartão' });
  }
}

export async function updateCard(req, res) {
  try {
    const { id } = req.params;
    const { bandeira, ultimos_digitos, nome_titular, validade_mes, validade_ano, principal } = req.body;

    const updatePayload = {
      bandeira,
      ultimos_digitos,
      nome_titular,
      validade_mes,
      validade_ano,
      principal,
    };

    Object.keys(updatePayload).forEach((key) => {
      if (updatePayload[key] === undefined) {
        delete updatePayload[key];
      }
    });

    if (Object.keys(updatePayload).length === 0) {
      return res.status(400).json({ error: 'Nenhum campo fornecido para atualização' });
    }

    const { data, error } = await supabase
      .from('cartoes')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Cartão não encontrado' });
      }
      throw error;
    }

    res.json(data);
  } catch (error) {
    logger.error({ err: error }, 'Erro ao atualizar cartão');
    res.status(500).json({ error: 'Erro ao atualizar cartão' });
  }
}

export async function deleteCard(req, res) {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('cartoes')
      .delete()
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Cartão não encontrado' });
      }
      throw error;
    }

    res.json({ message: 'Cartão deletado com sucesso' });
  } catch (error) {
    logger.error({ err: error }, 'Erro ao deletar cartão');
    res.status(500).json({ error: 'Erro ao deletar cartão' });
  }
}
