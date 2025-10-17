import supabase from '../services/supabaseClient.js';

export async function listFavorites(req, res) {
  try {
    const { usuario_id } = req.query;

    let query = supabase.from('favoritos').select('*');
    if (usuario_id) {
      query = query.eq('usuario_id', usuario_id);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.json(data ?? []);
  } catch (error) {
    console.error('Erro ao listar favoritos:', error);
    res.status(500).json({ error: 'Erro ao listar favoritos' });
  }
}

export async function getFavoriteById(req, res) {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('favoritos')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Favorito não encontrado' });
      }
      throw error;
    }

    res.json(data);
  } catch (error) {
    console.error('Erro ao buscar favorito:', error);
    res.status(500).json({ error: 'Erro ao buscar favorito' });
  }
}

export async function createFavorite(req, res) {
  try {
    const { usuario_id, produto_id } = req.body;

    if (!usuario_id || !produto_id) {
      return res.status(400).json({ error: 'usuario_id e produto_id são obrigatórios' });
    }

    const { data, error } = await supabase
      .from('favoritos')
      .insert({ usuario_id, produto_id })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json(data);
  } catch (error) {
    console.error('Erro ao criar favorito:', error);
    res.status(500).json({ error: 'Erro ao criar favorito' });
  }
}

export async function deleteFavorite(req, res) {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('favoritos')
      .delete()
      .eq('id', id);

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Favorito não encontrado' });
      }
      throw error;
    }

    res.json({ message: 'Favorito deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar favorito:', error);
    res.status(500).json({ error: 'Erro ao deletar favorito' });
  }
}
