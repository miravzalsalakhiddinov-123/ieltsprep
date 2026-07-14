// api/index.js — Vercel serverless entrypoint.
// Vercel treats a module that exports an Express app as a request handler.
// vercel.json rewrites every request to this one function.
module.exports = require('../app');
