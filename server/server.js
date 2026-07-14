// server.js — local development entrypoint only.
// On Vercel, api/index.js exports the same app as a serverless function instead
// (Vercel doesn't use .listen()).
const app = require('./app');

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`IELTS platform API running on http://localhost:${PORT}`);
});
