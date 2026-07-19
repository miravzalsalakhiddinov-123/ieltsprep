const express = require('express');
const multer = require('multer');
const { query } = require('../db/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { uploadTestFile, downloadTestFile, deleteTestFile } = require('../lib/supabaseStorage');
const { fetchDriveFile } = require('../lib/driveAudio');
const wrapRouter = require('../lib/wrapRouter');

const router = wrapRouter(express.Router());

// Mirrors the client-side helper in TestRunner.jsx — extracts a Drive file
// ID from either a /file/d/FILE_ID/ share link or a ?id=FILE_ID link.
function extractDriveFileId(url) {
  if (!url) return null;
  let m = url.match(/drive\.google\.com\/file\/d\/([^/?#]+)/);
  if (m) return m[1];
  m = url.match(/[?&]id=([^&#]+)/);
  if (m) return m[1];
  return null;
}

// Memory storage — no local disk on Vercel. The buffer goes straight to Supabase Storage.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
// Writing tests take no HTML file, only an optional Task 1 image.
const uploadWriting = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

// GET /api/tests?type=reading — list tests (any logged-in user)
router.get('/', requireAuth, async (req, res) => {
  const { type } = req.query;
  const { rows } = type
    ? await query('SELECT id, type, title, is_mock, mock_id, audio_url, duration_minutes, reading_variant, created_at FROM tests WHERE type = $1 ORDER BY created_at DESC', [type])
    : await query('SELECT id, type, title, is_mock, mock_id, audio_url, duration_minutes, reading_variant, created_at FROM tests ORDER BY created_at DESC');
  res.json(rows);
});

// GET /api/tests/with-progress?type=reading — same list, but with the
// logged-in student's own most recent attempt (if any) attached to each row
// as `attempt_id`. One request instead of two round trips for the Practice page.
// Tests attached to a mock bundle (mock_id set) are excluded here — they're
// meant to be taken only through the Mock Center (either as part of "Start
// Full Mock" or opened individually from within that mock's card), not as a
// standalone Practice item too.
router.get('/with-progress', requireAuth, async (req, res) => {
  const { type } = req.query;
  const { rows } = await query(
    `SELECT t.id, t.type, t.title, t.is_mock, t.mock_id, t.audio_url, t.duration_minutes, t.reading_variant, t.created_at,
            a.id AS attempt_id
     FROM tests t
     LEFT JOIN LATERAL (
       SELECT id FROM attempts
       WHERE test_id = t.id AND user_id = $2
       ORDER BY finished_at DESC NULLS LAST, id DESC
       LIMIT 1
     ) a ON true
     WHERE ($1::text IS NULL OR t.type = $1) AND t.mock_id IS NULL
     ORDER BY t.created_at DESC`,
    [type || null, req.user.userId]
  );
  res.json(rows);
});

// GET /api/tests/mocks — list mock bundles with their component tests
router.get('/mocks', requireAuth, async (req, res) => {
  const { rows: mocks } = await query('SELECT * FROM mocks ORDER BY created_at DESC');
  const result = await Promise.all(mocks.map(async m => {
    const { rows: tests } = await query('SELECT id, type, title FROM tests WHERE mock_id = $1', [m.id]);
    return { ...m, tests };
  }));
  res.json(result);
});

// POST /api/tests/mocks  { title } — admin creates a mock bundle shell
router.post('/mocks', requireAuth, requireRole('admin'), async (req, res) => {
  const { title } = req.body || {};
  if (!title) return res.status(400).json({ error: 'title required' });
  const { rows } = await query('INSERT INTO mocks (title) VALUES ($1) RETURNING id', [title]);
  res.status(201).json({ id: rows[0].id, title });
});

// DELETE /api/tests/mocks/:id — admin deletes a mock bundle. Tests that were
// attached to it are NOT deleted, just detached (mock_id -> NULL, via the
// existing ON DELETE SET NULL on tests.mock_id) so nothing a student already
// took disappears — it just becomes a standalone test again.
router.delete('/mocks/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { rows } = await query('DELETE FROM mocks WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Could not delete mock bundle: ' + err.message });
  }
});

// POST /api/tests — admin uploads a reading/listening test HTML file (goes to Supabase Storage, not local disk)
// multipart/form-data: file, type (reading|listening), title, audio_url (optional), mock_id (optional), duration_minutes (optional)
router.post('/', requireAuth, requireRole('admin'), upload.single('file'), async (req, res) => {
  const { type, title, audio_url, mock_id, duration_minutes, reading_variant } = req.body || {};
  if (!type || !title || !req.file) {
    return res.status(400).json({ error: 'type, title, and file are required' });
  }
  if (!['reading', 'listening'].includes(type)) {
    return res.status(400).json({ error: 'type must be reading or listening — use POST /api/tests/writing for writing tests' });
  }

  let uploaded;
  try {
    uploaded = await uploadTestFile(req.file.buffer, req.file.originalname, req.file.mimetype);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  const mins = duration_minutes ? parseInt(duration_minutes, 10) : null;
  const variant = type === 'reading' ? (reading_variant === 'general' ? 'general' : 'academic') : null;
  const { rows } = await query(
    `INSERT INTO tests (type, title, file_path, audio_url, is_mock, mock_id, created_by, duration_minutes, reading_variant)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [type, title, uploaded.key, audio_url || null, !!mock_id, mock_id || null, req.user.userId, mins && !isNaN(mins) ? mins : null, variant]
  );

  res.status(201).json({ id: rows[0].id, type, title });
});

// POST /api/tests/writing — admin creates a writing test from a simple form, no HTML upload needed.
// multipart/form-data: title, writing_tasks (task1|task2|both), duration_minutes (optional),
// task1_prompt (required if task1/both), task1_image (optional file, required-ish for task1),
// task2_prompt (required if task2/both), mock_id (optional)
router.post('/writing', requireAuth, requireRole('admin'), uploadWriting.single('task1_image'), async (req, res) => {
  const { title, writing_tasks, task1_prompt, task2_prompt, duration_minutes, mock_id } = req.body || {};
  if (!title || !writing_tasks) {
    return res.status(400).json({ error: 'title and writing_tasks are required' });
  }
  if (!['task1', 'task2', 'both'].includes(writing_tasks)) {
    return res.status(400).json({ error: 'writing_tasks must be task1, task2, or both' });
  }
  const needsTask1 = writing_tasks === 'task1' || writing_tasks === 'both';
  const needsTask2 = writing_tasks === 'task2' || writing_tasks === 'both';
  if (needsTask1 && !task1_prompt) return res.status(400).json({ error: 'task1_prompt is required' });
  if (needsTask2 && !task2_prompt) return res.status(400).json({ error: 'task2_prompt is required' });

  let imageKey = null;
  if (needsTask1 && req.file) {
    try {
      const uploaded = await uploadTestFile(req.file.buffer, req.file.originalname, req.file.mimetype);
      imageKey = uploaded.key;
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  const mins = duration_minutes ? parseInt(duration_minutes, 10) : null;
  const { rows } = await query(
    `INSERT INTO tests (type, title, is_mock, mock_id, created_by, duration_minutes, writing_tasks, writing_task1_prompt, writing_task1_image_key, writing_task2_prompt)
     VALUES ('writing', $1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [
      title, !!mock_id, mock_id || null, req.user.userId, mins && !isNaN(mins) ? mins : null,
      writing_tasks, needsTask1 ? task1_prompt : null, imageKey, needsTask2 ? task2_prompt : null
    ]
  );

  res.status(201).json({ id: rows[0].id, type: 'writing', title });
});

// PATCH /api/tests/:id/mock  { mock_id } — admin attaches/detaches an existing
// test to a mock bundle after the fact (e.g. it was uploaded before the mock
// existed, or the mock wasn't selected at upload time). mock_id: null/'' detaches.
router.patch('/:id/mock', requireAuth, requireRole('admin'), async (req, res) => {
  const { mock_id } = req.body || {};
  const mockId = mock_id ? parseInt(mock_id, 10) : null;
  const { rows } = await query(
    'UPDATE tests SET mock_id = $1, is_mock = $2 WHERE id = $3 RETURNING id, mock_id',
    [mockId, !!mockId, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

// PATCH /api/tests/:id/file — admin replaces the HTML file on an EXISTING
// reading/listening test in place. Keeps the same test row (id, title, mock
// attachment, timer, attempt history) — only the underlying HTML content
// changes. Useful when a mistake in an uploaded file needs correcting
// without deleting the test and losing its attachment/analytics history.
// multipart/form-data: file
router.patch('/:id/file', requireAuth, requireRole('admin'), upload.single('file'), async (req, res) => {
  const { rows } = await query('SELECT * FROM tests WHERE id = $1', [req.params.id]);
  const test = rows[0];
  if (!test) return res.status(404).json({ error: 'Not found' });
  if (!['reading', 'listening'].includes(test.type)) {
    return res.status(400).json({ error: 'Only reading and listening tests have an HTML file to replace' });
  }
  if (!req.file) return res.status(400).json({ error: 'file is required' });

  let uploaded;
  try {
    uploaded = await uploadTestFile(req.file.buffer, req.file.originalname, req.file.mimetype);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  try {
    await query('UPDATE tests SET file_path = $1 WHERE id = $2', [uploaded.key, req.params.id]);
  } catch (err) {
    // Row update failed — clean up the newly-uploaded orphan and bail.
    deleteTestFile(uploaded.key).catch(() => {});
    return res.status(500).json({ error: 'Could not update test: ' + err.message });
  }

  // Old file is only removed after the DB points at the new one, and a
  // failure here doesn't fail the request — an orphaned old file in storage
  // is harmless.
  if (test.file_path) deleteTestFile(test.file_path).catch(() => {});

  res.json({ ok: true, id: test.id });
});

// DELETE /api/tests/:id
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { rows } = await query('SELECT * FROM tests WHERE id = $1', [req.params.id]);
  const test = rows[0];
  if (!test) return res.status(404).json({ error: 'Not found' });
  try {
    // Attempt history keeps pointing at a (now-null) test_id via ON DELETE SET NULL,
    // so this is safe even for tests students have already taken.
    await query('DELETE FROM tests WHERE id = $1', [req.params.id]);
  } catch (err) {
    return res.status(500).json({ error: 'Could not delete test: ' + err.message });
  }
  // Storage cleanup happens after the row is gone, and failures here don't
  // block the delete — an orphaned file in storage is harmless either way.
  if (test.file_path) deleteTestFile(test.file_path).catch(() => {});
  if (test.writing_task1_image_key) deleteTestFile(test.writing_task1_image_key).catch(() => {});
  res.json({ ok: true });
});

// GET /api/tests/:id/audio — streams a Google Drive-hosted recording's raw
// bytes through our own origin, so the student's browser plays it in OUR
// no-controls AudioPlayer instead of Google's own /preview embed (which has
// play/pause/seek controls we can't strip). Only used when a test's
// audio_url is a Drive link — direct audio URLs are played straight from
// their own host as before.
router.get('/:id/audio', requireAuth, async (req, res) => {
  const { rows } = await query('SELECT audio_url FROM tests WHERE id = $1', [req.params.id]);
  const test = rows[0];
  if (!test || !test.audio_url) return res.status(404).send('No recording set for this test');

  const fileId = extractDriveFileId(test.audio_url);
  if (!fileId) return res.status(400).send('audio_url is not a recognizable Google Drive link');

  try {
    const driveRes = await fetchDriveFile(fileId, req.headers.range);
    res.status(driveRes.status === 206 ? 206 : 200);
    const passthroughHeaders = ['content-type', 'content-length', 'content-range', 'accept-ranges'];
    for (const h of passthroughHeaders) {
      const v = driveRes.headers.get(h);
      if (v) res.set(h, v);
    }
    if (!driveRes.headers.get('content-type')) res.set('content-type', 'audio/mpeg');
    if (!driveRes.headers.get('accept-ranges')) res.set('accept-ranges', 'bytes');
    // Node's global fetch Response.body is a web ReadableStream — pipe it to
    // the Express response via its Node.js Readable wrapper.
    const { Readable } = require('stream');
    Readable.fromWeb(driveRes.body).pipe(res);
  } catch (err) {
    res.status(502).send(err.message);
  }
});

// GET /api/tests/:id/meta — test metadata (used by practice page before opening)
router.get('/:id/meta', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT id, type, title, audio_url, is_mock, mock_id, duration_minutes, reading_variant,
            writing_tasks, writing_task1_prompt, writing_task2_prompt,
            (writing_task1_image_key IS NOT NULL) AS has_task1_image
     FROM tests WHERE id = $1`,
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

// GET /api/tests/:id/task1-image — streams the Writing Task 1 image (chart/letter/diagram)
router.get('/:id/task1-image', requireAuth, async (req, res) => {
  const { rows } = await query('SELECT writing_task1_image_key FROM tests WHERE id = $1', [req.params.id]);
  const test = rows[0];
  if (!test || !test.writing_task1_image_key) return res.status(404).send('Image not found');
  try {
    const { buffer, contentType } = await downloadTestFile(test.writing_task1_image_key);
    res.set('Content-Type', contentType || 'image/png');
    res.send(buffer);
  } catch (err) {
    res.status(404).send('Image not found in storage');
  }
});
module.exports = router;
