# IELTS Practice Platform

A self-hosted practice platform for IELTS Reading, Listening, and Writing, with a
separate admin panel and a student dashboard (completion pie chart, score trend,
inbox with teacher feedback, motivation banner, analytics, and full mock tests).

## Architecture

- **server/** — Node.js + Express API, **Postgres database (Supabase)**, with test HTML
  files stored in **Supabase Storage** (private bucket, streamed through the API — see
  `DEPLOY.md`). Handles login/accounts, test file uploads, scoring records, messages,
  and the motivation banner. Auth uses a signed JWT in an httpOnly cookie (not
  server-side sessions), so it works on stateless serverless hosts like Vercel.
- **client/** — React (Vite) single-page app. Student side (Dashboard, Analytics,
  Practice, Full Mock) and Admin side (Students, Tests, Mock Bundles, Writing Queue,
  Messages, Motivation).

> This was migrated from an earlier SQLite/local-disk/session-cookie version to run
> on Vercel + Supabase. See **`DEPLOY.md`** for the full deployment walkthrough
> (Supabase setup, Vercel projects, environment variables). For pure local-machine
> use without any of this, you'd need Postgres and Supabase Storage credentials too —
> this version no longer uses local SQLite/disk.

No test files were modified. Your reading/listening HTML files are stored and served
exactly as uploaded. A small "bridge" script is injected into the iframe *after* it
loads (from the React side, not saved into your file) which hooks into the functions
your files already define (`checkAnswers`, `displayResults`) and reports the result
back to the app via `postMessage`. See "How scoring works" below for details.

## First-time setup (local development)

You'll need [Node.js](https://nodejs.org) 18+, plus a free [Supabase](https://supabase.com)
project (for Postgres + file storage) — even for local dev, since this version no longer
uses local SQLite/disk. See **`DEPLOY.md`** for the one-time Supabase setup (create project,
run `server/db/schema.sql`, create the storage bucket, grab your keys).

```bash
# 1. Install server dependencies
cd server
npm install
cp .env.example .env      # fill in DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_KEY, JWT_SECRET (see DEPLOY.md)
npm run seed               # creates your first admin login (prints username/password)
npm run dev                 # starts the API on http://localhost:4000

# 2. In a second terminal, install and start the client
cd client
npm install
npm run dev                 # starts the app on http://localhost:5173
```

Open `http://localhost:5173`, log in with the admin credentials printed by `npm run seed`,
and create your student accounts from **Admin → Students**. Students can only log in
with accounts you create — there is no self-signup.

## Deploying for real use

Full step-by-step walkthrough (Supabase project, Vercel projects for client + server,
environment variables, connecting the two): see **`DEPLOY.md`**.

## How scoring & "Analyze" works

**Reading & Listening:** your test files already contain a global `ANSWERS` object,
a `PART_QS` map, and a `checkAnswers()` function that scores everything client-side.
When a student opens a test, it loads in an iframe; once loaded, the app injects a
tiny script that wraps `checkAnswers` so that after your file finishes scoring the
attempt, the result (score, per-question breakdown, estimated band) is also sent to
the app and saved. Nothing in your original file is touched.

Clicking **Analyze** afterwards reopens the same file in the same iframe, but this
time the app replays the student's saved answers into the DOM and calls your file's
own `checkAnswers()` again — which reveals its built-in green "evidence" highlighting,
exactly like when a student checks their own work.

**Writing:** your writing file has no fixed answer key — it produces a heuristic
band estimate from word count and vocabulary diversity. That estimate is saved, but
the attempt is marked "pending review" and shows up in **Admin → Writing Queue**,
where you read the essay, set the real band score, and write feedback. Submitting
that form saves the final band and automatically sends your feedback as a message
to the student's inbox, linked to that attempt — clicking it from their dashboard
takes them straight to their Analytics page for that submission.

**Speaking:** there's no test file for speaking, so scores are entered directly by
you in **Admin → Mock Bundles** after a live session (or standalone, outside a mock).

## Full mock tests

Create a "mock bundle" in **Admin → Mock Bundles**, then upload reading/listening/
writing tests as usual but attach each one to that bundle from the upload form.
Students see it under **Full Mock** and can take all three components back-to-back;
speaking shows as "scored by your teacher" until you enter it manually. All three
(four) scores combine into the mock's overall band on the student's dashboard.

## Adding more tests later

Just keep uploading more HTML files from **Admin → Tests** in the same format as the
ones you already have — reading/listening need the `ANSWERS` + `PART_QS` + `checkAnswers`
globals, writing needs `partData` + `displayResults`. Anything following that same
structure plugs in automatically, no code changes required.

## A note on this build

This was migrated from SQLite/local-disk/sessions to Postgres (Supabase) + Supabase
Storage + JWT-cookie auth, restructured for Vercel. It was reviewed carefully and
syntax-checked file by file, but `npm install` requires internet access this sandbox
doesn't have, so it wasn't run end-to-end here. Follow `DEPLOY.md` step by step, and
let me know if anything doesn't come up cleanly — happy to debug further.
