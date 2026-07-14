const express = require('express');
const { query } = require('../db/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/motivation/latest — shown on every student's dashboard
router.get('/latest', requireAuth, async (req, res) => {
  const { rows } = await query('SELECT * FROM motivation ORDER BY created_at DESC LIMIT 1');
  res.json(rows[0] || null);
});

// POST /api/motivation — admin posts a new motivational message
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  const { message } = req.body || {};
  if (!message) return res.status(400).json({ error: 'message required' });
  const { rows } = await query(
    'INSERT INTO motivation (message, created_by) VALUES ($1, $2) RETURNING id',
    [message, req.user.userId]
  );
  res.status(201).json({ id: rows[0].id, message });
});

module.exports = router;
