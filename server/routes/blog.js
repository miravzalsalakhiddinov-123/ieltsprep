const express = require('express');
const { query } = require('../db/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const wrapRouter = require('../lib/wrapRouter');

const router = wrapRouter(express.Router());

// GET /api/blog — any logged-in user (student or admin) can read posts.
router.get('/', requireAuth, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
  const { rows } = await query(
    'SELECT b.*, u.name AS author_name FROM blog_posts b LEFT JOIN users u ON u.id = b.created_by ORDER BY b.created_at DESC LIMIT $1',
    [limit]
  );
  res.json(rows);
});

// GET /api/blog/:id
router.get('/:id', requireAuth, async (req, res) => {
  const { rows } = await query(
    'SELECT b.*, u.name AS author_name FROM blog_posts b LEFT JOIN users u ON u.id = b.created_by WHERE b.id = $1',
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Post not found' });
  res.json(rows[0]);
});

// POST /api/blog — admin only
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  const { title, body } = req.body || {};
  if (!title || !title.trim() || !body || !body.trim()) {
    return res.status(400).json({ error: 'title and body are required' });
  }
  const { rows } = await query(
    'INSERT INTO blog_posts (title, body, created_by) VALUES ($1, $2, $3) RETURNING *',
    [title.trim(), body.trim(), req.user.userId]
  );
  res.status(201).json(rows[0]);
});

// PUT /api/blog/:id — admin only
router.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { title, body } = req.body || {};
  if (!title || !title.trim() || !body || !body.trim()) {
    return res.status(400).json({ error: 'title and body are required' });
  }
  const { rows } = await query(
    'UPDATE blog_posts SET title = $1, body = $2, updated_at = now() WHERE id = $3 RETURNING *',
    [title.trim(), body.trim(), req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Post not found' });
  res.json(rows[0]);
});

// DELETE /api/blog/:id — admin only
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  await query('DELETE FROM blog_posts WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
