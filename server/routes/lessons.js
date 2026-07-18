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

// GET /api/lessons?skill=writing&kind=sample — list lessons (any logged-in
// user). Card list only, no full content, so the grid stays light.
router.get('/', requireAuth, async (req, res) => {
  const { skill, kind } = req.query;
  const conds = [];
  const params = [];
  if (skill) { params.push(skill); conds.push(`skill = $${params.length}`); }
  if (kind) { params.push(kind); conds.push(`kind = $${params.length}`); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT id, kind, skill, task_type, title, band_level, (image_key IS NOT NULL) AS has_image, created_at
     FROM lessons ${where} ORDER BY created_at DESC`,
    params
  );
  res.json(rows);
});

// GET /api/lessons/:id — full lesson (content + metadata), any logged-in user
router.get('/:id', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT id, kind, skill, task_type, title, band_level, prompt, plan, (image_key IS NOT NULL) AS has_image, content, created_at
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

// POST /api/lessons — admin creates a lesson. multipart/form-data.
// kind='sample' (default): skill, task_type, title, content, band_level,
//   prompt (the question), plan (Task 2 outline), image (Task 1 photo) —
//   all optional except skill/task_type/title/content.
// kind='mini_lesson': just title, content.
router.post('/', requireAuth, requireRole('admin'), upload.single('image'), async (req, res) => {
  const { kind = 'sample', skill, task_type, title, band_level, content, prompt, plan } = req.body || {};
  if (!['sample', 'mini_lesson'].includes(kind)) {
    return res.status(400).json({ error: 'kind must be sample or mini_lesson' });
  }
  if (!title || !content) return res.status(400).json({ error: 'title and content are required' });

  if (kind === 'sample') {
    if (!skill || !['speaking', 'writing'].includes(skill)) {
      return res.status(400).json({ error: 'skill must be speaking or writing' });
    }
    if (!task_type || !TASK_TYPES.includes(task_type)) {
      return res.status(400).json({ error: `task_type must be one of ${TASK_TYPES.join(', ')}` });
    }
  }

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
    `INSERT INTO lessons (kind, skill, task_type, title, band_level, image_key, content, prompt, plan, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
    [
      kind,
      kind === 'sample' ? skill : null,
      kind === 'sample' ? task_type : null,
      title,
      kind === 'sample' ? (band_level || null) : null,
      kind === 'sample' ? imageKey : null,
      content,
      kind === 'sample' ? (prompt || null) : null,
      kind === 'sample' ? (plan || null) : null,
      req.user.userId
    ]
  );
  res.status(201).json({ id: rows[0].id });
});

// PUT /api/lessons/:id — admin edits a sample. Same fields as POST; image is
// only replaced if a new file is sent.
router.put('/:id', requireAuth, requireRole('admin'), upload.single('image'), async (req, res) => {
  const { rows } = await query('SELECT * FROM lessons WHERE id = $1', [req.params.id]);
  const existing = rows[0];
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const { kind, skill, task_type, title, band_level, content, prompt, plan } = req.body || {};
  const newKind = kind || existing.kind;
  if (!['sample', 'mini_lesson'].includes(newKind)) {
    return res.status(400).json({ error: 'kind must be sample or mini_lesson' });
  }
  if (newKind === 'sample') {
    const newSkill = skill || existing.skill;
    const newTaskType = task_type || existing.task_type;
    if (!newSkill || !['speaking', 'writing'].includes(newSkill)) {
      return res.status(400).json({ error: 'skill must be speaking or writing' });
    }
    if (!newTaskType || !TASK_TYPES.includes(newTaskType)) {
      return res.status(400).json({ error: `task_type must be one of ${TASK_TYPES.join(', ')}` });
    }
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
  if (newKind === 'mini_lesson') imageKey = null;

  await query(
    `UPDATE lessons SET kind=$1, skill=$2, task_type=$3, title=$4, band_level=$5, image_key=$6, content=$7, prompt=$8, plan=$9 WHERE id=$10`,
    [
      newKind,
      newKind === 'sample' ? (skill || existing.skill) : null,
      newKind === 'sample' ? (task_type || existing.task_type) : null,
      title || existing.title,
      newKind === 'sample' ? (band_level !== undefined ? (band_level || null) : existing.band_level) : null,
      imageKey,
      content || existing.content,
      newKind === 'sample' ? (prompt !== undefined ? (prompt || null) : existing.prompt) : null,
      newKind === 'sample' ? (plan !== undefined ? (plan || null) : existing.plan) : null,
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
