// db/seed.js — creates the first admin account so you can log in and
// create everything else (students, tests) from the admin panel.
// Run: npm run seed   (from the server/ folder, after setting DATABASE_URL in .env
// and running schema.sql once in the Supabase SQL Editor)

const bcrypt = require('bcryptjs');
const { query, pool } = require('./db');

const ADMIN_NAME = process.env.SEED_ADMIN_NAME || 'Admin';
const ADMIN_USERNAME = process.env.SEED_ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';

async function main() {
  const { rows } = await query('SELECT id FROM users WHERE username = $1', [ADMIN_USERNAME]);
  if (rows[0]) {
    console.log(`Admin user "${ADMIN_USERNAME}" already exists (id ${rows[0].id}). Nothing to do.`);
    await pool.end();
    process.exit(0);
  }

  const hash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
  const { rows: inserted } = await query(
    'INSERT INTO users (name, username, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
    [ADMIN_NAME, ADMIN_USERNAME, hash, 'admin']
  );

  console.log('Admin account created:');
  console.log(`  username: ${ADMIN_USERNAME}`);
  console.log(`  password: ${ADMIN_PASSWORD}`);
  console.log(`  id: ${inserted[0].id}`);
  console.log('\nLog in with these, then change the password and create student accounts from the admin panel.');
  await pool.end();
}

main().catch(async (err) => {
  console.error('Seed failed:', err.message);
  await pool.end();
  process.exit(1);
});
