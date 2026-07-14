const express = require('express');
const { query } = require('../db/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/messages/inbox — the logged-in user's received messages
router.get('/inbox', requireAuth, async (req, res) => {
  const { rows } = await query(`
    SELECT m.*, u.name as from_name
    FROM messages m
    JOIN users u ON u.id = m.from_user_id
    WHERE m.to_user_id = $1
    ORDER BY m.created_at DESC
  `, [req.user.userId]);
  res.json(rows);
});

// GET /api/messages/unread-count
router.get('/unread-count', requireAuth, async (req, res) => {
  const { rows } = await query(
    'SELECT COUNT(*) c FROM messages WHERE to_user_id = $1 AND read_at IS NULL',
    [req.user.userId]
  );
  res.json({ count: Number(rows[0].c) });
});

// PUT /api/messages/:id/read
router.put('/:id/read', requireAuth, async (req, res) => {
  await query(
    "UPDATE messages SET read_at = now() WHERE id = $1 AND to_user_id = $2",
    [req.params.id, req.user.userId]
  );
  res.json({ ok: true });
});

// POST /api/messages — admin sends a message to a student (general note, not tied to an attempt)
// body: { to_user_id, body }
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  const { to_user_id, body } = req.body || {};
  if (!to_user_id || !body) return res.status(400).json({ error: 'to_user_id and body required' });
  const { rows } = await query(
    'INSERT INTO messages (from_user_id, to_user_id, body) VALUES ($1, $2, $3) RETURNING id',
    [req.user.userId, to_user_id, body]
  );
  res.status(201).json({ id: rows[0].id });
});

module.exports = router;
