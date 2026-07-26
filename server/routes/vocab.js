const express = require('express');
const { query } = require('../db/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const wrapRouter = require('../lib/wrapRouter');

const router = wrapRouter(express.Router());

// ---------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------

// GET /api/vocab/categories — list all categories with how many sets each
// has. Any logged-in user (students need this to browse).
router.get('/categories', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT c.id, c.name, c.description, c.created_at,
            COUNT(s.id)::int AS set_count
     FROM vocab_categories c
     LEFT JOIN vocab_sets s ON s.category_id = c.id
     GROUP BY c.id
     ORDER BY c.name ASC`
  );
  res.json(rows);
});

// POST /api/vocab/categories — admin only
router.post('/categories', requireAuth, requireRole('admin'), async (req, res) => {
  const { name, description } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
  const { rows } = await query(
    'INSERT INTO vocab_categories (name, description, created_by) VALUES ($1, $2, $3) RETURNING id',
    [name.trim(), description ? description.trim() : null, req.user.userId]
  );
  res.status(201).json({ id: rows[0].id });
});

// PUT /api/vocab/categories/:id — admin only, rename/redescribe
router.put('/categories/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { rows: existingRows } = await query('SELECT * FROM vocab_categories WHERE id = $1', [req.params.id]);
  const existing = existingRows[0];
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const { name, description } = req.body || {};
  if (name !== undefined && !name.trim()) return res.status(400).json({ error: 'name is required' });
  const { rows } = await query(
    'UPDATE vocab_categories SET name = $1, description = $2 WHERE id = $3 RETURNING id',
    [
      name !== undefined ? name.trim() : existing.name,
      description !== undefined ? (description.trim() || null) : existing.description,
      req.params.id
    ]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// DELETE /api/vocab/categories/:id — admin only. Cascades to its sets/words.
router.delete('/categories/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { rows } = await query('DELETE FROM vocab_categories WHERE id = $1 RETURNING id', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------
// Sets
// ---------------------------------------------------------------------

// GET /api/vocab/categories/:id/sets — sets in a category, with word count.
router.get('/categories/:id/sets', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT s.id, s.name, s.category_id, s.created_at,
            COUNT(w.id)::int AS word_count,
            (s.text1_body IS NOT NULL AND s.text1_body != '') AS has_text1,
            (s.text2_body IS NOT NULL AND s.text2_body != '') AS has_text2
     FROM vocab_sets s
     LEFT JOIN vocab_words w ON w.set_id = s.id
     WHERE s.category_id = $1
     GROUP BY s.id
     ORDER BY s.created_at ASC`,
    [req.params.id]
  );
  res.json(rows);
});

// GET /api/vocab/sets/:id — full set for studying/editing: metadata, the two
// texts, and every word. Any logged-in user.
router.get('/sets/:id', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT s.id, s.name, s.category_id, c.name AS category_name,
            s.text1_title, s.text1_body, s.text2_title, s.text2_body
     FROM vocab_sets s JOIN vocab_categories c ON c.id = s.category_id
     WHERE s.id = $1`,
    [req.params.id]
  );
  const set = rows[0];
  if (!set) return res.status(404).json({ error: 'Not found' });
  const words = await query(
    'SELECT id, english, russian FROM vocab_words WHERE set_id = $1 ORDER BY sort_order ASC, id ASC',
    [req.params.id]
  );
  res.json({ ...set, words: words.rows });
});

// POST /api/vocab/sets — admin only. { category_id, name }
router.post('/sets', requireAuth, requireRole('admin'), async (req, res) => {
  const { category_id, name } = req.body || {};
  if (!category_id) return res.status(400).json({ error: 'category_id is required' });
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
  const { rows } = await query(
    'INSERT INTO vocab_sets (category_id, name, created_by) VALUES ($1, $2, $3) RETURNING id',
    [category_id, name.trim(), req.user.userId]
  );
  res.status(201).json({ id: rows[0].id });
});

// PUT /api/vocab/sets/:id — admin only. Update name and/or the two texts.
router.put('/sets/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { rows } = await query('SELECT * FROM vocab_sets WHERE id = $1', [req.params.id]);
  const existing = rows[0];
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const { name, text1_title, text1_body, text2_title, text2_body } = req.body || {};
  await query(
    `UPDATE vocab_sets SET name=$1, text1_title=$2, text1_body=$3, text2_title=$4, text2_body=$5 WHERE id=$6`,
    [
      name && name.trim() ? name.trim() : existing.name,
      text1_title !== undefined ? (text1_title || null) : existing.text1_title,
      text1_body !== undefined ? (text1_body || null) : existing.text1_body,
      text2_title !== undefined ? (text2_title || null) : existing.text2_title,
      text2_body !== undefined ? (text2_body || null) : existing.text2_body,
      req.params.id
    ]
  );
  res.json({ ok: true });
});

// DELETE /api/vocab/sets/:id — admin only. Cascades to its words.
router.delete('/sets/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { rows } = await query('DELETE FROM vocab_sets WHERE id = $1 RETURNING id', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------

// POST /api/vocab/sets/:id/words — admin only, add a single word.
router.post('/sets/:id/words', requireAuth, requireRole('admin'), async (req, res) => {
  const { english, russian } = req.body || {};
  if (!english || !english.trim() || !russian || !russian.trim()) {
    return res.status(400).json({ error: 'english and russian are required' });
  }
  const count = await query('SELECT COUNT(*)::int AS c FROM vocab_words WHERE set_id = $1', [req.params.id]);
  const { rows } = await query(
    'INSERT INTO vocab_words (set_id, english, russian, sort_order) VALUES ($1, $2, $3, $4) RETURNING id',
    [req.params.id, english.trim(), russian.trim(), count.rows[0].c]
  );
  res.status(201).json({ id: rows[0].id });
});

// POST /api/vocab/sets/:id/words/bulk — admin only, add many at once.
// Body: { text }, one word per line, "english - russian" (also accepts
// " = " or tab or " : " as the separator).
router.post('/sets/:id/words/bulk', requireAuth, requireRole('admin'), async (req, res) => {
  const { text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: 'text is required' });

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const parsed = [];
  for (const line of lines) {
    const m = line.split(/\t| - | = | : |=|:/).map(s => s.trim()).filter(Boolean);
    if (m.length >= 2) parsed.push({ english: m[0], russian: m.slice(1).join(' ') });
  }
  if (!parsed.length) return res.status(400).json({ error: 'No valid lines found. Use one word per line: english - russian' });

  const count = await query('SELECT COUNT(*)::int AS c FROM vocab_words WHERE set_id = $1', [req.params.id]);
  let order = count.rows[0].c;
  for (const p of parsed) {
    await query(
      'INSERT INTO vocab_words (set_id, english, russian, sort_order) VALUES ($1, $2, $3, $4)',
      [req.params.id, p.english, p.russian, order++]
    );
  }
  res.status(201).json({ added: parsed.length });
});

// PUT /api/vocab/words/:id — admin only
router.put('/words/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { english, russian } = req.body || {};
  if (!english || !english.trim() || !russian || !russian.trim()) {
    return res.status(400).json({ error: 'english and russian are required' });
  }
  const { rows } = await query(
    'UPDATE vocab_words SET english=$1, russian=$2 WHERE id=$3 RETURNING id',
    [english.trim(), russian.trim(), req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// DELETE /api/vocab/words/:id — admin only
router.delete('/words/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { rows } = await query('DELETE FROM vocab_words WHERE id = $1 RETURNING id', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

module.exports = router;
