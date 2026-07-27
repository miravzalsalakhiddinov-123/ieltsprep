-- Adds an Uzbek translation column to vocab_words, alongside the existing
-- Russian one. Nullable — existing words simply have no Uzbek translation
-- until someone fills it in via the admin Vocabulary page.
--
-- Run this once against your live database (e.g. paste into the Supabase
-- SQL editor). schema.sql has also been updated so fresh setups include
-- this column automatically — you only need to run this file if your
-- database already existed before this change.

ALTER TABLE vocab_words ADD COLUMN IF NOT EXISTS uzbek TEXT;
