const express = require('express');
const { query } = require('../db/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const wrapRouter = require('../lib/wrapRouter');

const router = wrapRouter(express.Router());

// ---- Student: submit a completed attempt (called by TestRunner after postMessage from iframe) ----
// POST /api/attempts
// body: { test_id, test_type, score_raw, score_total, band_estimate, detail, started_at, mock_id }
router.post('/', requireAuth, async (req, res) => {
  const { test_id, test_type, score_raw, score_total, band_estimate, detail, started_at, mock_id } = req.body || {};
  if (!test_type) return res.status(400).json({ error: 'test_type required' });

  // Mock sections are one-shot: once a student has any attempt recorded
  // against a test that belongs to a mock bundle, block a second submission
  // outright (not just hidden in the UI) so a student can't retake a section
  // via a direct link/replay and can't quietly improve on a graded score.
  // Checked by test_id (the test's own mock_id), not the mock_id sent in the
  // body, so this can't be bypassed by a request that omits it.
  if (test_id) {
    const { rows: testRows } = await query('SELECT mock_id FROM tests WHERE id = $1', [test_id]);
    const test = testRows[0];
    if (test && test.mock_id) {
      const { rows: existing } = await query(
        'SELECT id FROM attempts WHERE user_id = $1 AND test_id = $2 LIMIT 1',
        [req.user.userId, test_id]
      );
      if (existing[0]) {
        return res.status(409).json({ error: 'You\u2019ve already submitted this mock section — it can only be taken once.' });
      }
    }
  }

  // Standalone practice (no mock_id): reading/listening are auto-scored and
  // released immediately, only writing waits for a teacher.
  // Full-mock attempts (mock_id set) ALWAYS wait for teacher approval before
  // any score is shown to the student — reading and listening included, not
  // just writing — so the whole mock is reviewed and released together via
  // the student's inbox instead of leaking an instant auto-score.
  const isMockAttempt = !!mock_id;
  const status = (isMockAttempt || test_type === 'writing') ? 'pending_review' : 'completed';
  const bandFinal = status === 'pending_review' ? null : band_estimate;

  const { rows } = await query(
    `INSERT INTO attempts
      (user_id, test_id, test_type, mock_id, score_raw, score_total, band_estimate, band_final, detail_json, status, started_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
    [
      req.user.userId, test_id || null, test_type, mock_id || null,
      score_raw ?? null, score_total ?? null, band_estimate ?? null, bandFinal,
      detail ? JSON.stringify(detail) : null, status, started_at || null
    ]
  );

  res.status(201).json({ id: rows[0].id, status });
});

// ---- Admin: enter a speaking score manually (no test file for speaking) ----
// POST /api/attempts/speaking  { student_id, band_final, mock_id }
router.post('/speaking', requireAuth, requireRole('admin'), async (req, res) => {
  const { student_id, band_final, mock_id } = req.body || {};
  if (!student_id || band_final == null) return res.status(400).json({ error: 'student_id and band_final required' });
  const { rows } = await query(
    `INSERT INTO attempts (user_id, test_id, test_type, mock_id, band_estimate, band_final, status)
     VALUES ($1, NULL, 'speaking', $2, $3, $4, 'reviewed') RETURNING id`,
    [student_id, mock_id || null, band_final, band_final]
  );
  res.status(201).json({ id: rows[0].id });
});

// GET /api/attempts/mine?type=reading — the logged-in student's own attempts
// Left-joined with tests so the client can tell a full-test attempt apart
// from a single-passage (reading) / single-part (listening) practice attempt
// — e.g. to exclude those from the Analytics score-history line graph, which
// should only ever plot full tests. attempt.part_scope is null for attempts
// with no test row (writing/speaking, or a deleted test), which is treated
// as "full" (not a partial section) by the client.
router.get('/mine', requireAuth, async (req, res) => {
  const { type } = req.query;
  const { rows } = type
    ? await query(
        `SELECT a.*, t.part_scope, t.part_number
         FROM attempts a LEFT JOIN tests t ON t.id = a.test_id
         WHERE a.user_id = $1 AND a.test_type = $2 ORDER BY a.finished_at ASC`,
        [req.user.userId, type])
    : await query(
        `SELECT a.*, t.part_scope, t.part_number
         FROM attempts a LEFT JOIN tests t ON t.id = a.test_id
         WHERE a.user_id = $1 ORDER BY a.finished_at ASC`,
        [req.user.userId]);
  res.json(rows);
});

// GET /api/attempts/latest — most recent attempt per section, for the dashboard "latest results" widget
router.get('/latest', requireAuth, async (req, res) => {
  const sections = ['reading', 'listening', 'writing', 'speaking'];
  const results = await Promise.all(sections.map(s =>
    query(
      'SELECT * FROM attempts WHERE user_id = $1 AND test_type = $2 ORDER BY finished_at DESC LIMIT 1',
      [req.user.userId, s]
    )
  ));
  const result = {};
  sections.forEach((s, i) => { result[s] = results[i].rows[0] || null; });
  res.json(result);
});

// GET /api/attempts/progress — completion % for the dashboard pie chart
router.get('/progress', requireAuth, async (req, res) => {
  const types = ['reading', 'listening', 'writing'];
  const [totals, done] = await Promise.all([
    Promise.all(types.map(type => query('SELECT COUNT(*) c FROM tests WHERE type = $1', [type]))),
    Promise.all(types.map(type => query(
      'SELECT COUNT(DISTINCT test_id) c FROM attempts WHERE user_id = $1 AND test_type = $2',
      [req.user.userId, type]
    )))
  ]);
  const totalByType = {};
  const doneByType = {};
  types.forEach((type, i) => {
    totalByType[type] = Number(totals[i].rows[0].c);
    doneByType[type] = Number(done[i].rows[0].c);
  });
  const totalAll = Object.values(totalByType).reduce((a, b) => a + b, 0);
  const doneAll = Object.values(doneByType).reduce((a, b) => a + b, 0);
  res.json({
    overallPercent: totalAll ? Math.round((doneAll / totalAll) * 100) : 0,
    byType: Object.fromEntries(
      types.map(t => [
        t,
        { done: doneByType[t], total: totalByType[t], percent: totalByType[t] ? Math.round((doneByType[t] / totalByType[t]) * 100) : 0 }
      ])
    )
  });
});

// GET /api/attempts/leaderboard — the single top-scoring student for Reading
// and Listening (auto-scored sections only). Shown on the student dashboard.
// Registered before GET /:id so "leaderboard" is never swallowed as an id.
router.get('/leaderboard', requireAuth, async (req, res) => {
  const skills = ['reading', 'listening'];
  const results = await Promise.all(skills.map(skill => query(
    `SELECT u.id AS user_id, u.name, COALESCE(a.band_final, a.band_estimate) AS band
     FROM attempts a JOIN users u ON u.id = a.user_id
     WHERE a.test_type = $1 AND a.status <> 'pending_review' AND COALESCE(a.band_final, a.band_estimate) IS NOT NULL
     ORDER BY COALESCE(a.band_final, a.band_estimate) DESC, a.finished_at DESC
     LIMIT 1`,
    [skill]
  )));
  const out = {};
  skills.forEach((s, i) => {
    const row = results[i].rows[0];
    out[s] = row ? { name: row.name, band: row.band } : null;
  });
  res.json(out);
});

// ---- Admin: every result, across every student, as soon as it's submitted ----

// GET /api/attempts — admin-only feed of all attempts (newest first), with
// the student's name and the test's title joined in so the panel doesn't
// need a second round trip per row.
router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  const { rows } = await query(`
    SELECT a.*, u.name as student_name, u.username as student_username, t.title as test_title
    FROM attempts a
    JOIN users u ON u.id = a.user_id
    LEFT JOIN tests t ON t.id = a.test_id
    ORDER BY a.finished_at DESC
  `);
  res.json(rows);
});

// GET /api/attempts/:id — single attempt detail (for the Analyze view)
router.get('/:id', requireAuth, async (req, res) => {
  const { rows } = await query('SELECT * FROM attempts WHERE id = $1', [req.params.id]);
  const attempt = rows[0];
  if (!attempt) return res.status(404).json({ error: 'Not found' });
  if (req.user.role !== 'admin' && attempt.user_id !== req.user.userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  // Mock sections never get the per-test Analyze/answer-key view, graded or
  // not — that level of detail is reserved for standalone practice. A mock
  // result is only ever shown as the consolidated score on the Mock Results
  // page, so students can't retroactively study the answer key for a section
  // they've already been graded on.
  if (req.user.role !== 'admin' && attempt.mock_id) {
    return res.status(403).json({ error: 'mock_attempt', message: 'Mock section results are shown on the Mock Results page, not here.' });
  }
  // Reading/listening detail_json carries the answer key alongside the
  // student's own answers, so a still-pending mock section must stay hidden
  // from the student (not just its band) until a teacher approves it —
  // otherwise "Analyze" would leak the correct answers early. Writing is
  // exempt: its detail is just the student's own essay text, which is
  // already safe for them to re-read while awaiting a band.
  if (req.user.role !== 'admin' && attempt.test_type !== 'writing' && attempt.status === 'pending_review') {
    return res.status(403).json({ error: 'pending_review', message: 'This result is awaiting your teacher\u2019s review.' });
  }
  res.json(attempt);
});

// ---- Admin: writing review queue ----

// GET /api/attempts/queue/pending — all writing attempts awaiting a human band score
router.get('/queue/pending', requireAuth, requireRole('admin'), async (req, res) => {
  const { rows } = await query(`
    SELECT a.*, u.name as student_name, u.username as student_username, t.title as test_title
    FROM attempts a
    JOIN users u ON u.id = a.user_id
    LEFT JOIN tests t ON t.id = a.test_id
    WHERE a.status = 'pending_review'
    ORDER BY a.finished_at ASC
  `);
  res.json(rows);
});

// PUT /api/attempts/:id/grade  { band_final, feedback }
router.put('/:id/grade', requireAuth, requireRole('admin'), async (req, res) => {
  const { band_final, feedback } = req.body || {};
  const { rows } = await query('SELECT * FROM attempts WHERE id = $1', [req.params.id]);
  const attempt = rows[0];
  if (!attempt) return res.status(404).json({ error: 'Not found' });
  if (band_final == null) return res.status(400).json({ error: 'band_final required' });

  await query("UPDATE attempts SET band_final = $1, status = 'reviewed' WHERE id = $2", [band_final, req.params.id]);

  const sectionLabel = attempt.test_type ? attempt.test_type[0].toUpperCase() + attempt.test_type.slice(1) : 'Test';
  await query(
    `INSERT INTO messages (from_user_id, to_user_id, body, attempt_id) VALUES ($1, $2, $3, $4)`,
    [req.user.userId, attempt.user_id, feedback || `Your ${sectionLabel} result is ready: Band ${band_final}.`, attempt.id]
  );

  res.json({ ok: true });
});

module.exports = router;
