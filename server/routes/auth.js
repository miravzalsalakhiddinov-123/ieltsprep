const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query } = require('../db/db');
const { requireAuth, requireRole, setAuthCookie, clearAuthCookie } = require('../middleware/auth');
const wrapRouter = require('../lib/wrapRouter');
const { sendVerificationEmail } = require('../lib/mailer');

const router = wrapRouter(express.Router());

// TEMPORARY DEBUG ROUTE — remove once email verification is confirmed
// working. Does not expose the actual key, just whether it's present and
// its first few characters, so you can confirm the right one is deployed.
router.get('/debug-mail', (req, res) => {
  const key = process.env.RESEND_API_KEY || '';
  res.json({
    hasApiKey: !!key,
    apiKeyPreview: key ? key.slice(0, 8) + '…' : null,
    apiKeyLength: key.length,
    emailFrom: process.env.EMAIL_FROM || null,
    appUrl: process.env.APP_URL || null
  });
});

// POST /api/auth/register — public. Anyone can create their own student
// account. Deliberately does NOT log the user in (no setAuthCookie here) —
// they're sent back to the login page and have to sign in with the
// credentials they just created, same as the assistant described. The
// account starts unverified; a verification link is emailed and login is
// blocked until it's clicked (see /login and /verify below).
router.post('/register', async (req, res) => {
  const { name, username, password, email } = req.body || {};
  if (!name || !name.trim() || !username || !username.trim() || !password || !email || !email.trim()) {
    return res.status(400).json({ error: 'Name, username, email and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  const cleanEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }
  const cleanUsername = username.trim().toLowerCase();
  const existing = await query('SELECT id FROM users WHERE username = $1', [cleanUsername]);
  if (existing.rows[0]) return res.status(409).json({ error: 'That username is already taken' });

  const hash = bcrypt.hashSync(password, 10);
  const token = crypto.randomBytes(32).toString('hex');
  const { rows } = await query(
    `INSERT INTO users (name, username, password_hash, role, email, is_verified, verification_token, verification_sent_at)
     VALUES ($1, $2, $3, $4, $5, false, $6, now()) RETURNING id`,
    [name.trim(), cleanUsername, hash, 'student', cleanEmail, token]
  );
  const user = { id: rows[0].id, name: name.trim(), email: cleanEmail };
  try {
    await sendVerificationEmail(user, token);
  } catch (err) {
    console.error('[register] failed to send verification email', err);
  }
  res.status(201).json({ id: user.id, name: user.name, username: cleanUsername, role: 'student' });
});

// GET /api/auth/verify?token=... — public, called from the link in the
// verification email.
router.get('/verify', async (req, res) => {
  const { token } = req.query || {};
  if (!token) return res.status(400).json({ error: 'Missing token' });
  const { rows } = await query('SELECT id FROM users WHERE verification_token = $1', [token]);
  if (!rows[0]) return res.status(400).json({ error: 'This verification link is invalid or has already been used.' });
  await query('UPDATE users SET is_verified = true, verification_token = NULL WHERE id = $1', [rows[0].id]);
  res.json({ ok: true });
});

// POST /api/auth/resend-verification  { username }
router.post('/resend-verification', async (req, res) => {
  const { username } = req.body || {};
  if (!username) return res.status(400).json({ error: 'username required' });
  const { rows } = await query('SELECT * FROM users WHERE username = $1', [username.trim().toLowerCase()]);
  const user = rows[0];
  if (!user || !user.email) return res.json({ ok: true }); // don't leak account existence
  if (user.is_verified) return res.json({ ok: true });
  const token = crypto.randomBytes(32).toString('hex');
  await query('UPDATE users SET verification_token = $1, verification_sent_at = now() WHERE id = $2', [token, user.id]);
  try { await sendVerificationEmail(user, token); } catch (err) { console.error('[resend-verification]', err); }
  res.json({ ok: true });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  const { rows } = await query('SELECT * FROM users WHERE username = $1', [username]);
  const user = rows[0];
  if (!user) return res.status(401).json({ error: 'Invalid username or password' });

  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid username or password' });

  if (!user.is_verified) {
    return res.status(403).json({ error: 'Please verify your email before logging in.', code: 'unverified' });
  }

  setAuthCookie(res, user);
  res.json({ id: user.id, name: user.name, username: user.username, role: user.role });
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
