import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL,
  ssl: process.env.SUPABASE_DB_URL ? { rejectUnauthorized: false } : false
});

export const getPopular = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM popular ORDER BY id');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar produtos populares', details: error.message });
  }
};
