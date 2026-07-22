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

-- Single-passage / single-part practice: a reading or listening test can now
-- be either the full thing ('full', the old/default behaviour) or just one
-- passage (reading, 1-3) / one part (listening, 1-4), so students can drill
-- section by section instead of always taking the whole test.
ALTER TABLE tests ADD COLUMN IF NOT EXISTS part_scope TEXT NOT NULL DEFAULT 'full' CHECK (part_scope IN ('full','part'));
ALTER TABLE tests ADD COLUMN IF NOT EXISTS part_number INTEGER;

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

-- Lessons: Speaking / Writing sample answers, added by the admin, read by
-- students on the Lessons page. Each sample is tagged with which task/part
-- it's a model answer for, so students can see that (plus the band level and
-- a small cover image) on the card BEFORE opening it.
CREATE TABLE IF NOT EXISTS lessons (
  id SERIAL PRIMARY KEY,
  skill TEXT NOT NULL CHECK (skill IN ('speaking','writing')),
  task_type TEXT NOT NULL CHECK (task_type IN ('task1','task2','part1','part2','part3')),
  title TEXT NOT NULL,
  band_level TEXT,             -- free text, e.g. "Band 7-8"
  image_key TEXT,               -- Supabase Storage key for the small cover image (optional)
  content TEXT NOT NULL,        -- the sample answer / model text itself
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lessons_skill ON lessons(skill);

-- Lessons v2: split into two kinds.
--   'sample'      — a model answer for a specific task, as before, now with
--                    its own question text (`prompt`) shown alongside it, and
--                    for Writing Task 2 an optional `plan`/outline. Task 1
--                    keeps using `image_key` for the chart/diagram photo.
--   'mini_lesson'  — a plain study article: just a title + content, no task,
--                    band, image, prompt, or plan.
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'sample' CHECK (kind IN ('sample','mini_lesson'));
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS prompt TEXT;   -- the question/task prompt (samples only)
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS plan TEXT;     -- Task 2 outline/plan (writing samples only)
ALTER TABLE lessons ALTER COLUMN skill DROP NOT NULL;       -- mini-lessons don't need a skill
ALTER TABLE lessons ALTER COLUMN task_type DROP NOT NULL;   -- mini-lessons don't need a task
CREATE INDEX IF NOT EXISTS idx_lessons_kind ON lessons(kind);
