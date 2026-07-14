require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/auth');
const testsRoutes = require('./routes/tests');
const attemptsRoutes = require('./routes/attempts');
const messagesRoutes = require('./routes/messages');
const motivationRoutes = require('./routes/motivation');

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

const app = express();

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
