const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query } = require('../db/db');
const { requireAuth, requireRole, setAuthCookie, clearAuthCookie } = require('../middleware/auth');
const wrapRouter = require('../lib/wrapRouter');
const { sendVerificationEmail } = require('../lib/mailer');
const { getAppUrl } = require('../lib/appUrl');

const router = wrapRouter(express.Router());

// Turns "jane.doe@gmail.com" into a unique username like "janedoe", adding a
// numeric suffix ("janedoe2") if that's already taken. Used only for accounts
// created via Google sign-in — username/password signups pick their own.
async function generateUsernameFromEmail(email) {
  const base = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'student';
  let candidate = base;
  let suffix = 1;
  // Bounded loop — realistically resolves on the first or second try.
  while (suffix < 1000) {
    const { rows } = await query('SELECT id FROM users WHERE username = $1', [candidate]);
    if (!rows[0]) return candidate;
    suffix += 1;
    candidate = `${base}${suffix}`;
  }
  return `${base}${crypto.randomBytes(3).toString('hex')}`;
}

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
  const existingUsername = await query('SELECT id FROM users WHERE username = $1', [cleanUsername]);
  if (existingUsername.rows[0]) return res.status(409).json({ error: 'That username is already taken' });

  const existingEmail = await query('SELECT id, is_verified FROM users WHERE email = $1', [cleanEmail]);
  if (existingEmail.rows[0]) {
    if (existingEmail.rows[0].is_verified) {
      return res.status(409).json({ error: 'An account with this email already exists. Try logging in instead.' });
    }
    // Unverified account already sitting there (e.g. from an earlier signup
    // where the verification email never arrived) — rather than blocking
    // the person with a confusing duplicate-key error, just resend the link.
    const token = crypto.randomBytes(32).toString('hex');
    await query('UPDATE users SET verification_token = $1, verification_sent_at = now() WHERE id = $2', [token, existingEmail.rows[0].id]);
    try { await sendVerificationEmail({ id: existingEmail.rows[0].id, name: name.trim(), email: cleanEmail }, token); } catch (err) { console.error('[register] resend to unverified existing account failed', err); }
    return res.status(409).json({ error: 'An account with this email already exists but is not verified yet. We just sent a new verification link — check your inbox.' });
  }

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

  if (!user.password_hash) {
    // Account was created via Google sign-in and never set a password.
    return res.status(401).json({ error: 'This account uses Google sign-in. Use the "Sign in with Google" button instead.', code: 'google_only' });
  }
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

// ---- Google sign-in ----
//
// Setup: create an OAuth Client ID (Web application) in Google Cloud Console
// and set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET as env vars. Authorized
// redirect URI must be exactly `${APP_URL}/api/auth/google/callback`.
// If these env vars aren't set, both routes below return a clear error
// instead of a confusing crash, so the rest of the app (password login)
// keeps working either way.

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

function googleRedirectUri() {
  return `${getAppUrl()}/api/auth/google/callback`;
}

// GET /api/auth/google — the "Sign in with Google" button links straight
// here; this redirects the browser on to Google's consent screen.
router.get('/google', (req, res) => {
  if (!GOOGLE_CLIENT_ID) {
    return res.status(500).send('Google sign-in is not configured (missing GOOGLE_CLIENT_ID).');
  }
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: googleRedirectUri(),
    response_type: 'code',
    scope: 'openid email profile',
    prompt: 'select_account'
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

// GET /api/auth/google/callback — Google redirects back here with a one-time
// code. Exchange it for the user's Google profile, find-or-create the local
// account, log them in, and send them to the dashboard.
router.get('/google/callback', async (req, res) => {
  const { code, error } = req.query || {};
  const appUrl = getAppUrl();
  if (error) return res.redirect(`${appUrl}/login?error=google_${error}`);
  if (!code) return res.redirect(`${appUrl}/login?error=google_no_code`);
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res.status(500).send('Google sign-in is not configured on the server.');
  }

  // Exchange the code for tokens.
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: googleRedirectUri(),
      grant_type: 'authorization_code'
    })
  });
  if (!tokenRes.ok) {
    console.error('[google auth] token exchange failed', tokenRes.status, await tokenRes.text().catch(() => ''));
    return res.redirect(`${appUrl}/login?error=google_token_exchange`);
  }
  const { access_token } = await tokenRes.json();

  // Fetch the profile.
  const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${access_token}` }
  });
  if (!profileRes.ok) {
    console.error('[google auth] userinfo failed', profileRes.status);
    return res.redirect(`${appUrl}/login?error=google_profile`);
  }
  const profile = await profileRes.json();
  const googleId = profile.sub;
  const email = (profile.email || '').trim().toLowerCase();
  const name = profile.name || email.split('@')[0] || 'Student';
  if (!googleId || !email) return res.redirect(`${appUrl}/login?error=google_incomplete_profile`);

  // Find an existing account by google_id, then by email (so someone who
  // already signed up with a password can link Google to the same account),
  // else create a brand-new student account.
  let { rows } = await query('SELECT * FROM users WHERE google_id = $1', [googleId]);
  let user = rows[0];

  if (!user) {
    const byEmail = await query('SELECT * FROM users WHERE email = $1', [email]);
    if (byEmail.rows[0]) {
      user = byEmail.rows[0];
      await query('UPDATE users SET google_id = $1, is_verified = true WHERE id = $2', [googleId, user.id]);
    }
  }

  if (!user) {
    const username = await generateUsernameFromEmail(email);
    const { rows: created } = await query(
      `INSERT INTO users (name, username, role, email, is_verified, google_id)
       VALUES ($1, $2, 'student', $3, true, $4) RETURNING *`,
      [name, username, email, googleId]
    );
    user = created[0];
  }

  setAuthCookie(res, user);
  res.redirect(`${appUrl}/dashboard`);
});

module.exports = router;
