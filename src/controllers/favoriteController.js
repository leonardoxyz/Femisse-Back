import { pool } from '../db/index.js';

export async function listFavorites(req, res) {
  try {
    const { usuario_id } = req.query;
    let result;
    if (usuario_id) {
      result = await pool.query('SELECT * FROM favoritos WHERE usuario_id = $1', [usuario_id]);
    } else {
      result = await pool.query('SELECT * FROM favoritos');
    }
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar favoritos' });
  }
}

export async function getFavoriteById(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM favoritos WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Favorito não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar favorito' });
  }
}

export async function createFavorite(req, res) {
  try {
    const { usuario_id, produto_id } = req.body;
    const result = await pool.query(
      'INSERT INTO favoritos (usuario_id, produto_id) VALUES ($1, $2) RETURNING *',
      [usuario_id, produto_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar favorito' });
  }
}

export async function deleteFavorite(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM favoritos WHERE id=$1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Favorito não encontrado' });
    res.json({ message: 'Favorito deletado com sucesso' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao deletar favorito' });
  }
}
