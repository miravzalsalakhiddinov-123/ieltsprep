// api/index.js — Vercel serverless entrypoint for the WHOLE app (single project).
//
// Why this file exists here (repo root) instead of only inside /server:
// running client + server as ONE Vercel project means everything is served from
// the same domain — no cross-project rewrite, no CLIENT_ORIGIN CORS config to
// keep in sync, and (most importantly) the login cookie and the test iframe are
// automatically same-origin. That's what makes both auth and the scoring bridge
// script in TestRunner.jsx reliable.
//
// Vercel auto-detects any file under /api as a serverless function. This one
// just re-exports the existing Express app from server/app.js untouched.
module.exports = require('../server/app');
