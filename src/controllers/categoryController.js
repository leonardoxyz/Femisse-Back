import { pool } from '../db/index.js';

export const getAllCategories = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY name ASC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar categorias', details: error.message });
  }
};

export const createCategory = async (req, res) => {
  const { name, image, link } = req.body;
  if (!name || !image) {
    return res.status(400).json({ error: 'Nome e imagem são obrigatórios' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO categories (name, image, link) VALUES ($1, $2, $3) RETURNING *',
      [name, image, link || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar categoria', details: error.message });
  }
};
