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
// request here — this is just a safety net.
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

const app = express();

app.set('trust proxy', 1); // required on Vercel so secure:true cookies are set correctly
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/tests', testsRoutes);
app.use('/api/attempts', attemptsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/motivation', motivationRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

module.exports = app;
