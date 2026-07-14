const express = require('express');
const multer = require('multer');
const { query } = require('../db/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { uploadTestFile, downloadTestFile, deleteTestFile } = require('../lib/supabaseStorage');

const router = express.Router();

// Memory storage — no local disk on Vercel. The buffer goes straight to Supabase Storage.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

// GET /api/tests?type=reading — list tests (any logged-in user)
router.get('/', requireAuth, async (req, res) => {
  const { type } = req.query;
  const { rows } = type
    ? await query('SELECT id, type, title, is_mock, mock_id, audio_url, created_at FROM tests WHERE type = $1 ORDER BY created_at DESC', [type])
    : await query('SELECT id, type, title, is_mock, mock_id, audio_url, created_at FROM tests ORDER BY created_at DESC');
  res.json(rows);
});

// GET /api/tests/mocks — list mock bundles with their component tests
router.get('/mocks', requireAuth, async (req, res) => {
  const { rows: mocks } = await query('SELECT * FROM mocks ORDER BY created_at DESC');
  const result = [];
  for (const m of mocks) {
    const { rows: tests } = await query('SELECT id, type, title FROM tests WHERE mock_id = $1', [m.id]);
    result.push({ ...m, tests });
  }
  res.json(result);
});

// POST /api/tests/mocks  { title } — admin creates a mock bundle shell
router.post('/mocks', requireAuth, requireRole('admin'), async (req, res) => {
  const { title } = req.body || {};
  if (!title) return res.status(400).json({ error: 'title required' });
  const { rows } = await query('INSERT INTO mocks (title) VALUES ($1) RETURNING id', [title]);
  res.status(201).json({ id: rows[0].id, title });
});

// POST /api/tests — admin uploads a test HTML file (goes to Supabase Storage, not local disk)
// multipart/form-data: file, type (reading|listening|writing), title, audio_url (optional), mock_id (optional)
router.post('/', requireAuth, requireRole('admin'), upload.single('file'), async (req, res) => {
  const { type, title, audio_url, mock_id } = req.body || {};
  if (!type || !title || !req.file) {
    return res.status(400).json({ error: 'type, title, and file are required' });
  }
  if (!['reading', 'listening', 'writing'].includes(type)) {
    return res.status(400).json({ error: 'type must be reading, listening, or writing' });
  }

  let uploaded;
  try {
    uploaded = await uploadTestFile(req.file.buffer, req.file.originalname, req.file.mimetype);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  const { rows } = await query(
    `INSERT INTO tests (type, title, file_path, audio_url, is_mock, mock_id, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [type, title, uploaded.key, audio_url || null, !!mock_id, mock_id || null, req.user.userId]
  );

  res.status(201).json({ id: rows[0].id, type, title });
});

// DELETE /api/tests/:id
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { rows } = await query('SELECT * FROM tests WHERE id = $1', [req.params.id]);
  const test = rows[0];
  if (test && test.file_path) {
    await deleteTestFile(test.file_path).catch(() => {});
  }
  await query('DELETE FROM tests WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// GET /api/tests/:id/meta — test metadata (used by practice page before opening)
router.get('/:id/meta', requireAuth, async (req, res) => {
  const { rows } = await query(
    'SELECT id, type, title, audio_url, is_mock, mock_id FROM tests WHERE id = $1',
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

// GET /api/tests/:id/file — streams the raw HTML file back from Supabase Storage,
// served from OUR OWN origin (not a Supabase link). This matters: the TestRunner
// page injects a bridge script directly into this iframe's document, which only
// works if the iframe is same-origin with the rest of the app. Served as-is,
// untouched — the bridge script comes from the React side after load, not from here.
router.get('/:id/file', requireAuth, async (req, res) => {
  const { rows } = await query('SELECT * FROM tests WHERE id = $1', [req.params.id]);
  const test = rows[0];
  if (!test || !test.file_path) return res.status(404).send('Test file not found');
  try {
    const { buffer } = await downloadTestFile(test.file_path);
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(buffer);
  } catch (err) {
    res.status(404).send('Test file not found in storage');
  }
});
module.exports = router;
