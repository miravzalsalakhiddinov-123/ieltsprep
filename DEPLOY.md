# Deploying: GitHub + Vercel + Supabase

This sets up two Vercel projects from one GitHub repo (client and server), backed by
one Supabase project (Postgres database + file storage). Do the steps in order —
the server needs to exist before the client's config can point at it.

---

## 1. Push the code to GitHub

```bash
cd ielts-platform
git init
git add .
git commit -m "Initial commit"
```
Create a new repo on GitHub, then:
```bash
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git branch -M main
git push -u origin main
```

---

## 2. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) → New project. Pick a region close to
   where your students are (this affects latency more than almost anything else).
2. Once it's ready, open **SQL Editor → New query**, paste in the contents of
   `server/db/schema.sql`, and run it. This creates all the tables.
3. Create the storage bucket for test files:
   - Go to **Storage** → **New bucket** → name it `test-files` → **keep it Private**
     (not public — the API streams files through itself, see the code comments in
     `server/lib/supabaseStorage.js` for why).
4. Collect the values you'll need:
   - **Project Settings → Database → Connection string → Transaction pooler** (port
     `6543`) → this is your `DATABASE_URL`. Replace `[YOUR-PASSWORD]` with your DB
     password from project creation.
   - **Project Settings → API → Project URL** → this is `SUPABASE_URL`.
   - **Project Settings → API → service_role key** (not the `anon` key — this one
     bypasses storage policies, needed for the server to manage files) → this is
     `SUPABASE_SERVICE_KEY`. Keep this secret; it only ever goes in the server's
     environment variables, never in the client.

---

## 3. Deploy the server to Vercel

1. [vercel.com](https://vercel.com) → **Add New → Project** → import your GitHub repo.
2. When asked for the **Root Directory**, set it to `server`.
3. Framework preset: **Other**.
4. Before deploying, add these **Environment Variables**:
   | Name | Value |
   |---|---|
   | `DATABASE_URL` | from step 2 |
   | `SUPABASE_URL` | from step 2 |
   | `SUPABASE_SERVICE_KEY` | from step 2 |
   | `SUPABASE_BUCKET` | `test-files` |
   | `JWT_SECRET` | a long random string — generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
   | `NODE_ENV` | `production` |
   | `CLIENT_ORIGIN` | your client's URL (you can update this after step 4 once you know it, e.g. `https://your-app.vercel.app`) |
5. Deploy. Note the URL Vercel gives this project (e.g. `https://ielts-server-xyz.vercel.app`)
   — you need it in the next step.

---

## 4. Deploy the client to Vercel

1. Edit `client/vercel.json` **before deploying**: replace
   `https://REPLACE-WITH-YOUR-BACKEND-PROJECT.vercel.app` with the actual server URL
   from step 3, commit, and push.
   ```json
   { "source": "/api/(.*)", "destination": "https://ielts-server-xyz.vercel.app/api/$1" }
   ```
   This makes the client proxy all `/api/*` calls to your server, so from the
   browser's point of view everything is same-origin — this is what makes login
   cookies work and (importantly) keeps the test iframe same-origin so the scoring
   bridge script can read it.
2. Vercel → **Add New → Project** → same GitHub repo again.
3. **Root Directory**: set to `client`. Framework preset: **Vite** (should
   auto-detect).
4. Deploy. Note this URL too (e.g. `https://ielts-client-xyz.vercel.app`).
5. Go back to the **server** project's environment variables (step 3) and set
   `CLIENT_ORIGIN` to this client URL, then redeploy the server (Vercel → Deployments
   → ⋯ → Redeploy) so CORS allows it.

---

## 5. Seed the first admin account

Run this from your own machine, pointed at the same Supabase database (put the real
`DATABASE_URL` etc. in `server/.env` locally first):
```bash
cd server
npm install
cp .env.example .env   # fill in the same values you used in Vercel
npm run seed
```
This prints an admin username/password. Log in at your client URL with those, then
create student accounts from **Admin → Students** and change the admin password.

---

## 6. Verify

- Visit your client URL, log in as admin.
- Upload a test file (**Admin → Tests**) — this should upload to Supabase Storage.
- Log in as a student (or use an incognito window) and take that test — the score
  should save, and **Admin → Writing Queue** should show writing submissions pending
  review.

If login seems to "not stick" (redirects back to login after refresh), double-check
step 4.1 — the client's `/api` proxy has to point at the right server URL, or cookies
won't be set correctly.
