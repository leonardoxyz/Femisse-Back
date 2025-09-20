import { pool } from '../db.js';

export const getMomentProducts = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM moment_products ORDER BY id');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar produtos do momento', details: error.message });
  }
};
