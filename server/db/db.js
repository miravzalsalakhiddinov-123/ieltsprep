// db.js — Postgres connection (Supabase), replacing the old better-sqlite3 file.
// Exposes a single `query(text, params)` helper used by every route.
// Uses the standard `pg` driver against Supabase's connection string
// (Session Pooler recommended for serverless — see server/.env.example).

const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.warn('[db] DATABASE_URL is not set — set it to your Supabase connection string.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Supabase requires SSL; this accepts their managed cert chain
  max: 5, // keep low — serverless functions each open their own small pool
});

async function query(text, params = []) {
  return pool.query(text, params);
}

module.exports = { pool, query };
