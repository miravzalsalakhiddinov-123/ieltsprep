require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/auth');
const testsRoutes = require('./routes/tests');
const attemptsRoutes = require('./routes/attempts');
const messagesRoutes = require('./routes/messages');
const motivationRoutes = require('./routes/motivation');

// CLIENT_ORIGIN only matters for local dev (Vite on :5173) and for the rare case
// someone splits client/server into two Vercel projects again. In the normal
// single-project deploy (see /vercel.json at repo root) client and API are
// served from the same domain, so the browser never makes a cross-origin
// request here.
//
// Previously this hardcoded a single allowed origin (defaulting to
// localhost:5173), so any deploy where the client ended up on a different
// domain than expected — e.g. a split client/server deploy, or a Vercel
// preview URL — got silently blocked by CORS and login failed with an
// opaque network error. This now reflects whatever origin the request
// actually came from (still safe: `credentials: true` means the browser
// only ever sends the auth cookie back to this exact API, and a comma
// separated CLIENT_ORIGIN can still be set to lock it down to specific
// domains if desired).
const CLIENT_ORIGINS = (process.env.CLIENT_ORIGIN || '')
  .split(',').map(s => s.trim()).filter(Boolean);

const app = express();

app.set('trust proxy', 1); // required on Vercel so secure:true cookies are set correctly
app.use(cors({
  origin(origin, callback) {
    // No Origin header (same-origin requests, curl, server-to-server) — allow.
    if (!origin) return callback(null, true);
    // If CLIENT_ORIGIN(S) is explicitly set, enforce the allowlist.
    if (CLIENT_ORIGINS.length) return callback(null, CLIENT_ORIGINS.includes(origin));
    // Otherwise reflect the request's own origin so this works regardless of
    // which domain the client is deployed to.
    return callback(null, true);
  },
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/tests', testsRoutes);
app.use('/api/attempts', attemptsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/motivation', motivationRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

module.exports = app;
