import { pool } from '../db/index.js';

export async function listCards(req, res) {
  try {
    const { usuario_id } = req.query;
    let result;
    if (usuario_id) {
      result = await pool.query('SELECT * FROM cartoes WHERE usuario_id = $1', [usuario_id]);
    } else {
      result = await pool.query('SELECT * FROM cartoes');
    }
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar cartões' });
  }
}

export async function getCardById(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM cartoes WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Cartão não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar cartão' });
  }
}

export async function createCard(req, res) {
  try {
    const { usuario_id, bandeira, ultimos_digitos, nome_titular, validade_mes, validade_ano, principal } = req.body;
    const result = await pool.query(
      'INSERT INTO cartoes (usuario_id, bandeira, ultimos_digitos, nome_titular, validade_mes, validade_ano, principal) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [usuario_id, bandeira, ultimos_digitos, nome_titular, validade_mes, validade_ano, principal]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar cartão' });
  }
}

export async function updateCard(req, res) {
  try {
    const { id } = req.params;
    const { bandeira, ultimos_digitos, nome_titular, validade_mes, validade_ano, principal } = req.body;
    const result = await pool.query(
      'UPDATE cartoes SET bandeira=$1, ultimos_digitos=$2, nome_titular=$3, validade_mes=$4, validade_ano=$5, principal=$6 WHERE id=$7 RETURNING *',
      [bandeira, ultimos_digitos, nome_titular, validade_mes, validade_ano, principal, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Cartão não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar cartão' });
  }
}

export async function deleteCard(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM cartoes WHERE id=$1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Cartão não encontrado' });
    res.json({ message: 'Cartão deletado com sucesso' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao deletar cartão' });
  }
}
