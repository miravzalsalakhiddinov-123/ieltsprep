const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db/db');
const { requireAuth, requireRole, setAuthCookie, clearAuthCookie } = require('../middleware/auth');
const wrapRouter = require('../lib/wrapRouter');

const router = wrapRouter(express.Router());

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/auth/login
// `username` may be either a username (teacher-created accounts) or an
// email (self-signup accounts) — whichever matches.
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  const { rows } = await query('SELECT * FROM users WHERE username = $1 OR email = $1', [username]);
  const user = rows[0];
  if (!user) return res.status(401).json({ error: 'Invalid username or password' });

  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid username or password' });

  setAuthCookie(res, user);
  res.json({ id: user.id, name: user.name, username: user.username, role: user.role });
});

// POST /api/auth/signup — students create their own account with an email.
// Always creates role='student'; admins are still created separately.
// Username is set to the email so the same login form works for everyone.
router.post('/signup', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  if (!email || !EMAIL_RE.test(email.trim())) return res.status(400).json({ error: 'A valid email is required' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await query('SELECT id FROM users WHERE username = $1 OR email = $1', [normalizedEmail]);
  if (existing.rows[0]) return res.status(409).json({ error: 'An account with this email already exists' });

  const hash = bcrypt.hashSync(password, 10);
  const { rows } = await query(
    'INSERT INTO users (name, username, email, password_hash, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, username, role',
    [name.trim(), normalizedEmail, normalizedEmail, hash, 'student']
  );
  const user = rows[0];
  setAuthCookie(res, user);
  res.status(201).json(user);
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await query('SELECT id, name, username, role FROM users WHERE id = $1', [req.user.userId]);
  const user = rows[0];
  if (!user) return res.status(401).json({ error: 'Not logged in' });
  res.json(user);
});

// ---- Admin-only: manage student accounts ----

// GET /api/auth/students
router.get('/students', requireAuth, requireRole('admin'), async (req, res) => {
  const { rows } = await query(
    "SELECT id, name, username, created_at FROM users WHERE role = 'student' ORDER BY name"
  );
  res.json(rows);
});

// POST /api/auth/students  { name, username, password }
router.post('/students', requireAuth, requireRole('admin'), async (req, res) => {
  const { name, username, password } = req.body || {};
  if (!name || !username || !password) {
    return res.status(400).json({ error: 'name, username, password are required' });
  }
  const existing = await query('SELECT id FROM users WHERE username = $1', [username]);
  if (existing.rows[0]) return res.status(409).json({ error: 'Username already taken' });

  const hash = bcrypt.hashSync(password, 10);
  const { rows } = await query(
    'INSERT INTO users (name, username, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
    [name, username, hash, 'student']
  );

  res.status(201).json({ id: rows[0].id, name, username, role: 'student' });
});

// PUT /api/auth/students/:id/password  { password }
router.put('/students/:id/password', requireAuth, requireRole('admin'), async (req, res) => {
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: 'password is required' });
  const hash = bcrypt.hashSync(password, 10);
  await query("UPDATE users SET password_hash = $1 WHERE id = $2 AND role = 'student'", [hash, req.params.id]);
  res.json({ ok: true });
});

// DELETE /api/auth/students/:id
router.delete('/students/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { rows } = await query(
      "DELETE FROM users WHERE id = $1 AND role = 'student' RETURNING id",
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Student not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Could not delete student: ' + err.message });
  }
});

module.exports = router;
