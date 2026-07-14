// middleware/auth.js — JWT-in-httpOnly-cookie auth, replacing express-session.
//
// Why: express-session (with the old SQLite-backed store) relied on the server
// process staying alive and holding session state. Vercel serverless functions
// are stateless and short-lived, so instead the login token itself carries the
// user's identity (signed with JWT_SECRET) and is verified on every request.

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';
const COOKIE_NAME = 'ielts_token';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, matches old session cookie

function signToken(user) {
  return jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
}

// NOTE on cookie settings: the deploy setup in DEPLOY.md has the client project
// proxy /api/* to the server project via a Vercel rewrite, so from the browser's
// point of view every request is same-origin/same-site — no need for
// SameSite=None cross-site cookie gymnastics. Keep 'lax' + secure in production.
function setAuthCookie(res, user) {
  const token = signToken(user);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE_MS,
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}

function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Not logged in' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { userId: payload.userId, role: payload.role };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Not logged in' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, setAuthCookie, clearAuthCookie, COOKIE_NAME };
