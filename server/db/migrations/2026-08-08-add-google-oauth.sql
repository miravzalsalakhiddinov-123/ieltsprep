-- Adds Google sign-in support.
--
-- Run this once against your live database (paste into the Supabase SQL
-- editor). schema.sql has also been updated so fresh setups include this
-- automatically — you only need to run this file if your database already
-- existed before this change.

-- Google-signed-in users don't set a password, so it can no longer be
-- required at the database level (the app still requires one for
-- username/password signups — this only relaxes the DB constraint).
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;

-- Email is now a real login identifier (Google sign-in matches on it), so it
-- needs to be unique. If this fails with a duplicate-key error, you have two
-- existing accounts sharing an email — fix those manually first, then rerun.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;

-- Google verifies the email itself, so accounts created this way are
-- considered verified immediately (handled in the app code, not here — this
-- is just a note for context).
