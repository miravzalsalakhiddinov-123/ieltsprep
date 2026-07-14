-- schema.sql — run this once in the Supabase SQL Editor (Project -> SQL Editor -> New query)
-- before deploying. This replaces the old auto-created SQLite schema.

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
  file_path TEXT,              -- Supabase Storage public URL for the uploaded HTML file
  audio_url TEXT,               -- external URL for listening tests
  is_mock BOOLEAN NOT NULL DEFAULT false,
  mock_id INTEGER REFERENCES mocks(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attempts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  test_id INTEGER REFERENCES tests(id),
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

CREATE INDEX IF NOT EXISTS idx_attempts_user ON attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_test ON attempts(test_id);
CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(to_user_id);
