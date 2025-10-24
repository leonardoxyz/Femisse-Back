import supabase from '../services/supabaseClient.js';

import { logger } from '../utils/logger.js';
export async function getFavorites(req, res) {
  try {
    const userId = req.user.id;
    
    const { data, error } = await supabase
      .from('usuarios')
      .select('favorites')
      .eq('id', userId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }
      throw error;
    }
    
    const favorites = data?.favorites || [];
    res.json(favorites);
  } catch (err) {
    logger.error({ err: err }, 'Erro ao buscar favoritos');
    res.status(500).json({ error: 'Erro ao buscar favoritos', details: err.message });
  }
}

export async function addFavorite(req, res) {
  try {
    const userId = req.user.id;
    const { productId } = req.validatedBody ?? req.body;
    
    if (!productId) {
      return res.status(400).json({ error: 'productId é obrigatório' });
    }
    
    // Busca os favoritos atuais
    const { data: userData, error: fetchError } = await supabase
      .from('usuarios')
      .select('favorites')
      .eq('id', userId)
      .single();
    
    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }
      throw fetchError;
    }
    
    let favorites = userData?.favorites || [];
    
    // Converte productId para string para garantir consistência
    const productIdStr = String(productId);
    const favoritesStr = favorites.map(f => String(f));
    
    // Adiciona o produto se não estiver na lista
    if (!favoritesStr.includes(productIdStr)) {
      favorites.push(productIdStr);
      
      // Atualiza no banco
      const { error: updateError } = await supabase
        .from('usuarios')
        .update({ favorites })
        .eq('id', userId);
      
      if (updateError) throw updateError;
    }
    
    res.json(favorites);
  } catch (err) {
    logger.error({ err: err }, 'Erro ao adicionar favorito');
    res.status(500).json({ error: 'Erro ao adicionar favorito', details: err.message });
  }
}

export async function removeFavorite(req, res) {
  try {
    const userId = req.user.id;
    const { productId } = req.validatedParams ?? req.params;
    
    if (!productId) {
      return res.status(400).json({ error: 'productId é obrigatório' });
    }
    
    // Busca os favoritos atuais
    const { data: userData, error: fetchError } = await supabase
      .from('usuarios')
      .select('favorites')
      .eq('id', userId)
      .single();
    
    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }
      throw fetchError;
    }
    
    let favorites = userData?.favorites || [];
    
    // Converte para string para garantir consistência
    const productIdStr = String(productId);
    favorites = favorites.filter(id => String(id) !== productIdStr);
    
    // Atualiza no banco
    const { error: updateError } = await supabase
      .from('usuarios')
      .update({ favorites })
      .eq('id', userId);
    
    if (updateError) throw updateError;
    
    res.json(favorites);
  } catch (err) {
    logger.error({ err: err }, 'Erro ao remover favorito');
    res.status(500).json({ error: 'Erro ao remover favorito', details: err.message });
  }
}

// Função para resetar favoritos (útil para debugging)
export async function clearFavorites(req, res) {
  try {
    const userId = req.user.id;
    
    // Limpa todos os favoritos
    const { error: updateError } = await supabase
      .from('usuarios')
      .update({ favorites: [] })
      .eq('id', userId);
    
    if (updateError) throw updateError;
    
    res.json({ message: 'Favoritos limpos com sucesso', favorites: [] });
  } catch (err) {
    logger.error({ err: err }, 'Erro ao limpar favoritos');
    res.status(500).json({ error: 'Erro ao limpar favoritos', details: err.message });
  }
}
