-- Adds email verification fields to users, and a blog_posts table for the
-- admin-authored mini-blog shown in the student sidebar.
--
-- Run this once against your live database (e.g. paste into the Supabase
-- SQL editor). schema.sql has also been updated so fresh setups include
-- this automatically — you only need to run this file if your database
-- already existed before this change.

ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_sent_at TIMESTAMPTZ;

-- Existing accounts (including admins created before this change) shouldn't
-- get locked out — only newly registered students go through verification.
UPDATE users SET is_verified = true WHERE is_verified = false;

CREATE TABLE IF NOT EXISTS blog_posts (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_blog_posts_created ON blog_posts(created_at DESC);
