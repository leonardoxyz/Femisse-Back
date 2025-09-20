import { pool } from '../db/index.js';

export async function listAddresses(req, res) {
  try {
    const { usuario_id } = req.query;
    let result;
    if (usuario_id) {
      result = await pool.query('SELECT * FROM address WHERE usuario_id = $1', [usuario_id]);
    } else {
      result = await pool.query('SELECT * FROM address');
    }
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar endereços' });
  }
}

export async function getAddressById(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM address WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Endereço não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar endereço' });
  }
}

export async function createAddress(req, res) {
  try {
    const usuario_id = req.user.id; // pega do token JWT
    const { label, street, number, complement, neighborhood, city, state, zip_code, is_default } = req.body;
    const result = await pool.query(
      'INSERT INTO address (usuario_id, label, street, number, complement, neighborhood, city, state, zip_code, is_default) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',
      [usuario_id, label, street, number, complement, neighborhood, city, state, zip_code, is_default]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao criar endereço:', err);
    res.status(500).json({ error: 'Erro ao criar endereço', details: err.message });
  }
}

export async function updateAddress(req, res) {
  try {
    const { id } = req.params;
    const { label, street, number, complement, neighborhood, city, state, zip_code, is_default } = req.body;
    const result = await pool.query(
      'UPDATE address SET label=$1, street=$2, number=$3, complement=$4, neighborhood=$5, city=$6, state=$7, zip_code=$8, is_default=$9 WHERE id=$10 RETURNING *',
      [label, street, number, complement, neighborhood, city, state, zip_code, is_default, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Endereço não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar endereço' });
  }
}

export async function deleteAddress(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM address WHERE id=$1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Endereço não encontrado' });
    res.json({ message: 'Endereço deletado com sucesso' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao deletar endereço' });
  }
}

export async function listMyAddresses(req, res) {
  try {
    const usuario_id = req.user.id;
    const result = await pool.query('SELECT * FROM address WHERE usuario_id = $1', [usuario_id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar endereços do usuário autenticado' });
  }
}
