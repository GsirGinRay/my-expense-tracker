import { Router } from 'express';
import { pool } from './db.js';
import { authMiddleware } from './auth.js';

const router = Router();
router.use(authMiddleware);

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function validateInput(body, { partial = false } = {}) {
  const out = {};

  if (!partial || body.type !== undefined) {
    if (!['income', 'expense'].includes(body.type)) {
      throw badRequest('類型無效');
    }
    out.type = body.type;
  }

  if (!partial || body.amount !== undefined) {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw badRequest('金額必須大於 0');
    }
    out.amount = amount;
  }

  if (!partial || body.category !== undefined) {
    if (typeof body.category !== 'string' || body.category.trim() === '') {
      throw badRequest('請選擇類別');
    }
    out.category = body.category.trim().slice(0, 60);
  }

  if (!partial || body.date !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      throw badRequest('日期格式錯誤');
    }
    out.date = body.date;
  }

  if (body.merchant !== undefined) {
    out.merchant = String(body.merchant ?? '').trim().slice(0, 60);
  }
  if (body.note !== undefined) {
    out.note = String(body.note ?? '').trim().slice(0, 200);
  }

  return out;
}

function serialize(row) {
  return {
    id: row.id,
    type: row.type,
    amount: Number(row.amount),
    category: row.category,
    merchant: row.merchant || '',
    date: row.date instanceof Date
      ? row.date.toISOString().slice(0, 10)
      : String(row.date).slice(0, 10),
    note: row.note || '',
    createdAt: row.created_at.toISOString(),
  };
}

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, type, amount, category, merchant, date, note, created_at
         FROM records
        WHERE user_id = $1
        ORDER BY date DESC, created_at DESC`,
      [req.user.id],
    );
    res.json(rows.map(serialize));
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const data = validateInput(req.body);
    const { rows } = await pool.query(
      `INSERT INTO records (user_id, type, amount, category, merchant, date, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, type, amount, category, merchant, date, note, created_at`,
      [
        req.user.id,
        data.type,
        data.amount,
        data.category,
        data.merchant ?? '',
        data.date,
        data.note ?? '',
      ],
    );
    res.status(201).json(serialize(rows[0]));
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const data = validateInput(req.body, { partial: true });
    const entries = Object.entries(data);
    if (entries.length === 0) {
      throw badRequest('沒有要更新的欄位');
    }

    const sets = entries.map(([key], i) => `${key} = $${i + 1}`);
    const values = entries.map(([, v]) => v);
    values.push(req.user.id, req.params.id);

    const { rows } = await pool.query(
      `UPDATE records
          SET ${sets.join(', ')}
        WHERE user_id = $${values.length - 1}
          AND id = $${values.length}
        RETURNING id, type, amount, category, merchant, date, note, created_at`,
      values,
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: '找不到記帳資料' });
    }
    res.json(serialize(rows[0]));
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      `DELETE FROM records WHERE user_id = $1 AND id = $2`,
      [req.user.id, req.params.id],
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: '找不到記帳資料' });
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.post('/restore', async (req, res, next) => {
  const incoming = Array.isArray(req.body?.records) ? req.body.records : null;
  if (!incoming) {
    return res.status(400).json({ error: '請提供 records 陣列' });
  }

  let normalized;
  try {
    normalized = incoming.map((r) => validateInput(r));
  } catch (err) {
    return next(err);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM records WHERE user_id = $1', [req.user.id]);

    for (const r of normalized) {
      await client.query(
        `INSERT INTO records (user_id, type, amount, category, merchant, date, note)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [req.user.id, r.type, r.amount, r.category, r.merchant ?? '', r.date, r.note ?? ''],
      );
    }
    await client.query('COMMIT');

    const { rows } = await client.query(
      `SELECT id, type, amount, category, merchant, date, note, created_at
         FROM records
        WHERE user_id = $1
        ORDER BY date DESC, created_at DESC`,
      [req.user.id],
    );
    res.json(rows.map(serialize));
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
});

export default router;
