-- schema.sql — run this once in the Supabase SQL Editor (Project -> SQL Editor -> New query)
-- before deploying. Safe to re-run on an existing database — every statement
-- is either idempotent (CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT
-- EXISTS) or drops-then-recreates a constraint by name.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','student')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mocks (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tests (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('reading','listening','writing')),
  title TEXT NOT NULL,
  file_path TEXT,              -- Supabase Storage public URL for the uploaded HTML file (reading/listening)
  audio_url TEXT,               -- external URL for listening tests
  is_mock BOOLEAN NOT NULL DEFAULT false,
  mock_id INTEGER REFERENCES mocks(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_minutes INTEGER,               -- time limit shown as a countdown; auto-submits at 0. NULL = no limit.
  writing_tasks TEXT CHECK (writing_tasks IN ('task1','task2','both')), -- which writing task(s) this test has
  writing_task1_prompt TEXT,
  writing_task1_image_key TEXT,           -- Supabase Storage key for the Task 1 image (chart/diagram/letter prompt)
  writing_task2_prompt TEXT
);

-- Safe to re-run on an existing database that predates these columns:
ALTER TABLE tests ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;
ALTER TABLE tests ADD COLUMN IF NOT EXISTS writing_tasks TEXT;
ALTER TABLE tests ADD COLUMN IF NOT EXISTS writing_task1_prompt TEXT;
ALTER TABLE tests ADD COLUMN IF NOT EXISTS writing_task1_image_key TEXT;
ALTER TABLE tests ADD COLUMN IF NOT EXISTS writing_task2_prompt TEXT;
ALTER TABLE tests ADD COLUMN IF NOT EXISTS reading_variant TEXT; -- 'academic' | 'general', reading tests only

CREATE TABLE IF NOT EXISTS attempts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  test_id INTEGER REFERENCES tests(id) ON DELETE SET NULL,
  test_type TEXT NOT NULL,
  mock_id INTEGER,
  score_raw REAL,
  score_total REAL,
  band_estimate REAL,
  band_final REAL,
  detail_json JSONB,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','pending_review','reviewed')),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  from_user_id INTEGER NOT NULL REFERENCES users(id),
  to_user_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT,
  attempt_id INTEGER REFERENCES attempts(id),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS motivation (
  id SERIAL PRIMARY KEY,
  message TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fixes "can't delete a test that has attempts": the original schema had no
-- ON DELETE rule on attempts.test_id, which defaults to RESTRICT in Postgres,
-- so Postgres refused to delete any test a student had already taken. This
-- drops that old restrictive constraint (name may vary; both common
-- auto-generated forms are covered) and puts a SET NULL one in its place so
-- attempt history is kept but no longer blocks deletion.
DO $$
DECLARE
  c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'attempts'::regclass AND confrelid = 'tests'::regclass AND contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE attempts DROP CONSTRAINT %I', c);
  END LOOP;
END $$;
ALTER TABLE attempts ADD CONSTRAINT attempts_test_id_fkey FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE SET NULL;

-- Fixes "can't delete a student": attempts.user_id and messages.from_user_id /
-- to_user_id originally had no ON DELETE rule, which defaults to RESTRICT in
-- Postgres, so deleting any student who had ever taken a test or received a
-- message failed with a foreign-key violation. This makes deleting a student
-- also remove their attempt history and messages (CASCADE), and lets
-- messages that pointed at one of those deleted attempts just drop that link
-- (SET NULL) instead of blocking the delete.
DO $$
DECLARE
  c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'attempts'::regclass AND confrelid = 'users'::regclass AND contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE attempts DROP CONSTRAINT %I', c);
  END LOOP;
END $$;
ALTER TABLE attempts ADD CONSTRAINT attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

DO $$
DECLARE
  c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'messages'::regclass AND confrelid = 'users'::regclass AND contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE messages DROP CONSTRAINT %I', c);
  END LOOP;
END $$;
ALTER TABLE messages ADD CONSTRAINT messages_from_user_id_fkey FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE messages ADD CONSTRAINT messages_to_user_id_fkey FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE;

DO $$
DECLARE
  c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'messages'::regclass AND confrelid = 'attempts'::regclass AND contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE messages DROP CONSTRAINT %I', c);
  END LOOP;
END $$;
ALTER TABLE messages ADD CONSTRAINT messages_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES attempts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_attempts_user ON attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_test ON attempts(test_id);
CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(to_user_id);
