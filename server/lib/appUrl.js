// Resolves the app's public-facing URL. Prefers an explicit APP_URL env var;
// otherwise falls back to the URL Vercel automatically provides for the
// deployment (VERCEL_PROJECT_PRODUCTION_URL is the stable production
// domain; VERCEL_URL is set on every deployment, including previews). Only
// falls back to localhost for local dev.
function getAppUrl() {
  return (
    process.env.APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
    (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
    'http://localhost:5173'
  ).replace(/\/$/, '');
}

module.exports = { getAppUrl };
