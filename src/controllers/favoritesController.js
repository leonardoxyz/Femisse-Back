import { pool } from '../db/index.js';

export async function getFavorites(req, res) {
  const userId = req.user.id;
  const result = await pool.query('SELECT favorites FROM usuarios WHERE id = $1', [userId]);
  res.json(result.rows[0]?.favorites || []);
}

export async function addFavorite(req, res) {
  const userId = req.user.id;
  const { productId } = req.body;
  const result = await pool.query('SELECT favorites FROM usuarios WHERE id = $1', [userId]);
  let favorites = result.rows[0]?.favorites || [];
  if (!favorites.includes(productId)) favorites.push(productId);
  await pool.query('UPDATE usuarios SET favorites = $1 WHERE id = $2', [JSON.stringify(favorites), userId]);
  res.json(favorites);
}

export async function removeFavorite(req, res) {
  const userId = req.user.id;
  const { productId } = req.params;
  const result = await pool.query('SELECT favorites FROM usuarios WHERE id = $1', [userId]);
  let favorites = (result.rows[0]?.favorites || []).filter(id => id !== productId);
  await pool.query('UPDATE usuarios SET favorites = $1 WHERE id = $2', [JSON.stringify(favorites), userId]);
  res.json(favorites);
}
