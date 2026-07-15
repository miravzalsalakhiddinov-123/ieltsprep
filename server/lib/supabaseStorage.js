// lib/supabaseStorage.js — replaces local disk storage (server/uploads/tests/)
// with Supabase Storage, since Vercel serverless functions have no persistent disk.
//
// IMPORTANT DESIGN NOTE: the bucket is kept PRIVATE and files are always streamed
// back through our own API (GET /api/tests/:id/file), never linked to directly.
// This is required, not just a security nicety: the TestRunner page injects a
// "bridge" script directly into the test iframe's document (same-origin DOM
// access) to read quiz results. That only works if the iframe is loaded from
// the SAME origin as the rest of the app. Redirecting straight to a Supabase
// storage URL would load the iframe from a different origin and silently break
// scoring. So: upload to a private bucket, and always serve file bytes through
// our API.

const { createClient } = require('@supabase/supabase-js');

const BUCKET = process.env.SUPABASE_BUCKET || 'test-files';

// IMPORTANT: don't create the Supabase client eagerly at module load. This
// file is require()'d from routes/tests.js, which is require()'d from
// app.js at cold start — so if createClient() threw here (which it does
// synchronously when SUPABASE_URL is missing), the ENTIRE app failed to
// load, breaking every route including login, not just file uploads. Build
// the client lazily instead, the first time a storage function is actually
// called, so a missing Supabase config only breaks file upload/download —
// not the whole API.
let supabase = null;
function getClient() {
  if (supabase) return supabase;
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    throw new Error('File storage is not configured: SUPABASE_URL / SUPABASE_SERVICE_KEY are missing.');
  }
  // Uses the service_role key (server-side only, never exposed to the client).
  // It bypasses storage policies, which is fine since every request to this
  // bucket is mediated by our own auth middleware, never accessed directly by clients.
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  return supabase;
}

// Uploads a file buffer (from multer memory storage) into the private bucket
// and returns the storage key to save in the `tests.file_path` column.
async function uploadTestFile(buffer, originalName, mimetype) {
  const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `${unique}-${safeName}`;

  const { error } = await getClient().storage
    .from(BUCKET)
    .upload(key, buffer, { contentType: mimetype || 'text/html', upsert: false });

  if (error) throw new Error(`Supabase upload failed: ${error.message}`);
  return { key };
}

// Downloads a file's bytes + content-type by storage key, for the API to stream
// back to the browser same-origin.
async function downloadTestFile(key) {
  const { data, error } = await getClient().storage.from(BUCKET).download(key);
  if (error) throw new Error(`Supabase download failed: ${error.message}`);
  const arrayBuffer = await data.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), contentType: data.type || 'text/html' };
}

// Deletes a file by its storage key.
async function deleteTestFile(key) {
  if (!key) return;
  await getClient().storage.from(BUCKET).remove([key]);
}

module.exports = { uploadTestFile, downloadTestFile, deleteTestFile, BUCKET };
