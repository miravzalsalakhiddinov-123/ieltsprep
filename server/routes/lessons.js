const express = require('express');
const multer = require('multer');
const { query } = require('../db/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { uploadTestFile, downloadTestFile, deleteTestFile } = require('../lib/supabaseStorage');
const wrapRouter = require('../lib/wrapRouter');

const router = wrapRouter(express.Router());

// Small cover images only — reuses the same private-bucket storage helpers
// tests.js uses for the Writing Task 1 chart image.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 6 * 1024 * 1024 } });

const TASK_TYPES = ['task1', 'task2', 'part1', 'part2', 'part3'];

// GET /api/lessons?skill=writing — list samples (any logged-in user). Card
// list only, no full content, so the grid stays light.
router.get('/', requireAuth, async (req, res) => {
  const { skill } = req.query;
  const { rows } = skill
    ? await query(
        `SELECT id, skill, task_type, title, band_level, (image_key IS NOT NULL) AS has_image, created_at
         FROM lessons WHERE skill = $1 ORDER BY created_at DESC`,
        [skill]
      )
    : await query(
        `SELECT id, skill, task_type, title, band_level, (image_key IS NOT NULL) AS has_image, created_at
         FROM lessons ORDER BY created_at DESC`
      );
  res.json(rows);
});

// GET /api/lessons/:id — full sample (content + metadata), any logged-in user
router.get('/:id', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT id, skill, task_type, title, band_level, (image_key IS NOT NULL) AS has_image, content, created_at
     FROM lessons WHERE id = $1`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

// GET /api/lessons/:id/image — streams the small cover image, same-origin
router.get('/:id/image', requireAuth, async (req, res) => {
  const { rows } = await query('SELECT image_key FROM lessons WHERE id = $1', [req.params.id]);
  const lesson = rows[0];
  if (!lesson || !lesson.image_key) return res.status(404).send('Image not found');
  try {
    const { buffer, contentType } = await downloadTestFile(lesson.image_key);
    res.set('Content-Type', contentType || 'image/jpeg');
    res.send(buffer);
  } catch (err) {
    res.status(404).send('Image not found in storage');
  }
});

// POST /api/lessons — admin creates a sample. multipart/form-data:
// skill, task_type, title, band_level (optional), content, image (optional file)
router.post('/', requireAuth, requireRole('admin'), upload.single('image'), async (req, res) => {
  const { skill, task_type, title, band_level, content } = req.body || {};
  if (!skill || !['speaking', 'writing'].includes(skill)) {
    return res.status(400).json({ error: 'skill must be speaking or writing' });
  }
  if (!task_type || !TASK_TYPES.includes(task_type)) {
    return res.status(400).json({ error: `task_type must be one of ${TASK_TYPES.join(', ')}` });
  }
  if (!title || !content) return res.status(400).json({ error: 'title and content are required' });

  let imageKey = null;
  if (req.file) {
    try {
      const uploaded = await uploadTestFile(req.file.buffer, req.file.originalname, req.file.mimetype);
      imageKey = uploaded.key;
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  const { rows } = await query(
    `INSERT INTO lessons (skill, task_type, title, band_level, image_key, content, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [skill, task_type, title, band_level || null, imageKey, content, req.user.userId]
  );
  res.status(201).json({ id: rows[0].id });
});

// PUT /api/lessons/:id — admin edits a sample. Same fields as POST; image is
// only replaced if a new file is sent.
router.put('/:id', requireAuth, requireRole('admin'), upload.single('image'), async (req, res) => {
  const { rows } = await query('SELECT * FROM lessons WHERE id = $1', [req.params.id]);
  const existing = rows[0];
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const { skill, task_type, title, band_level, content } = req.body || {};
  if (skill && !['speaking', 'writing'].includes(skill)) {
    return res.status(400).json({ error: 'skill must be speaking or writing' });
  }
  if (task_type && !TASK_TYPES.includes(task_type)) {
    return res.status(400).json({ error: `task_type must be one of ${TASK_TYPES.join(', ')}` });
  }

  let imageKey = existing.image_key;
  if (req.file) {
    try {
      const uploaded = await uploadTestFile(req.file.buffer, req.file.originalname, req.file.mimetype);
      imageKey = uploaded.key;
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
    if (existing.image_key) deleteTestFile(existing.image_key).catch(() => {});
  }

  await query(
    `UPDATE lessons SET skill=$1, task_type=$2, title=$3, band_level=$4, image_key=$5, content=$6 WHERE id=$7`,
    [
      skill || existing.skill,
      task_type || existing.task_type,
      title || existing.title,
      band_level !== undefined ? (band_level || null) : existing.band_level,
      imageKey,
      content || existing.content,
      req.params.id
    ]
  );
  res.json({ ok: true });
});

// DELETE /api/lessons/:id
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { rows } = await query('DELETE FROM lessons WHERE id = $1 RETURNING image_key', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  if (rows[0].image_key) deleteTestFile(rows[0].image_key).catch(() => {});
  res.json({ ok: true });
});

module.exports = router;
