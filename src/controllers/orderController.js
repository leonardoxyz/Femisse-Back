import { pool } from '../db/index.js';

export async function listOrders(req, res) {
  try {
    const { usuario_id } = req.query;
    let result;
    if (usuario_id) {
      result = await pool.query('SELECT * FROM pedidos WHERE usuario_id = $1', [usuario_id]);
    } else {
      result = await pool.query('SELECT * FROM pedidos');
    }
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar pedidos' });
  }
}

export async function getOrderById(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM pedidos WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pedido não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar pedido' });
  }
}

export async function createOrder(req, res) {
  try {
    const { usuario_id, status, total } = req.body;
    const result = await pool.query(
      'INSERT INTO pedidos (usuario_id, status, total) VALUES ($1, $2, $3) RETURNING *',
      [usuario_id, status, total]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar pedido' });
  }
}

export async function updateOrder(req, res) {
  try {
    const { id } = req.params;
    const { status, total } = req.body;
    const result = await pool.query(
      'UPDATE pedidos SET status=$1, total=$2 WHERE id=$3 RETURNING *',
      [status, total, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pedido não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar pedido' });
  }
}

export async function deleteOrder(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM pedidos WHERE id=$1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pedido não encontrado' });
    res.json({ message: 'Pedido deletado com sucesso' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao deletar pedido' });
  }
}
