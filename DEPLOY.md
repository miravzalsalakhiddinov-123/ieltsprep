# Deploying: GitHub + Vercel + Supabase

One GitHub repo → **one** Vercel project → one Supabase project (Postgres + file
storage). Client and API are served from the same domain, so there's no proxy
URL to keep in sync and no CORS configuration to break.

---

## 1. Push the code to GitHub

```bash
cd ieltsprep-main
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git branch -M main
git push -u origin main
```

If you're re-uploading an update to a repo you already have connected to
Vercel, just commit and push — Vercel redeploys automatically. Nothing else
needs to change.

---

## 2. Create the Supabase project (skip if you already have one)

1. [supabase.com](https://supabase.com) → **New project**.
2. **SQL Editor → New query** → paste the contents of `server/db/schema.sql` →
   run it. This creates all the tables (safe to re-run — it's all
   `CREATE TABLE IF NOT EXISTS`).
3. **Storage → New bucket** → name it `test-files` → keep it **Private**.
4. Collect these values:
   - **Project Settings → Database → Connection string → Transaction pooler**
     (port `6543`) → this is `DATABASE_URL`. Fill in your DB password.
   - **Project Settings → API → Project URL** → `SUPABASE_URL`.
   - **Project Settings → API → service_role key** → `SUPABASE_SERVICE_KEY`
     (never expose this to the client — it's a server-only env var).

---

## 3. Deploy to Vercel — one project

1. [vercel.com](https://vercel.com) → **Add New → Project** → import your repo.
2. **Root Directory**: leave it as the repo root (do **not** point it at
   `client` or `server`). The root `vercel.json` handles both the client build
   and the API function.
3. Framework preset: **Other**.
4. **Environment Variables** (Project Settings → Environment Variables):

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | from step 2 |
   | `SUPABASE_URL` | from step 2 |
   | `SUPABASE_SERVICE_KEY` | from step 2 |
   | `SUPABASE_BUCKET` | `test-files` |
   | `JWT_SECRET` | a long random string — generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
   | `NODE_ENV` | `production` |

   You do **not** need `CLIENT_ORIGIN` — client and API share one domain now.
5. Deploy.

That's the whole deploy. Every future `git push` to `main` redeploys this one
project — no second project, no URL to paste anywhere.

---

## 4. Seed the first admin account

From your own machine, pointed at the same Supabase database:
```bash
cd server
npm install
cp .env.example .env   # fill in DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_KEY, JWT_SECRET
npm run seed
```
This prints an admin username/password. Log in at your Vercel URL, then create
student accounts from **Admin → Students** and change the admin password.

---

## 5. Verify

- Visit your Vercel URL, log in as admin.
- **Admin → Tests** → upload an HTML test file.
- Open it as a student (or incognito window) — it should render full-screen in
  an iframe and score itself on submit.
- **Admin → Writing Queue** should show writing submissions pending review.

If login "doesn't stick" after refresh, double-check `JWT_SECRET` is set and
that you're visiting the Vercel URL directly (not through some other proxy).

---

## Local development

```bash
# terminal 1
cd server && npm install && cp .env.example .env   # fill in the same values
npm run dev            # http://localhost:4000

# terminal 2
cd client && npm install
npm run dev             # http://localhost:5173, proxies /api to :4000
```

## Running two separate Vercel projects instead

If you ever *do* want client and server as separate Vercel projects (e.g. to
scale them independently), you can still deploy `server/` and `client/` with
their own `Root Directory` settings — just add back a `vercel.json` in
`client/` with a rewrite to your server's URL, and set `CLIENT_ORIGIN` on the
server to the client's URL. The single-project setup above is recommended for
this app's size, though: it's simpler and avoids an entire class of
cross-origin cookie bugs.

---

## Giving admin and students two separate links

By default one deployment serves both the student site (`/`) and the admin
panel (`/admin`) — same link, students just never visit `/admin`. If you'd
rather hand out **two completely separate links** (e.g. so the admin panel
doesn't even exist as far as a student's browser is concerned), do this:

1. Keep your **main project exactly as deployed above** — this stays your
   API + "full" combined app. Note its URL, e.g. `https://ieltsprep-umber.vercel.app`.
2. In Vercel, **Add New → Project**, import the **same repo** again, but this
   time set **Root Directory** to `client`.
3. Environment Variables for this new project:
   | Name | Value |
   |---|---|
   | `VITE_APP_MODE` | `student` |
4. Edit `client/vercel.json`'s rewrite destination to point at your main
   project's URL from step 1 (it already contains a template you can adjust),
   then deploy. This project only mounts the student routes — visiting `/admin`
   here does nothing, and an admin account logging in on it is signed back out.
5. Repeat steps 2–4 once more for a **third** Vercel project, this time with
   `VITE_APP_MODE=admin`. This one only mounts the `/admin` routes (its root
   `/` redirects straight to `/admin`), and a student account logging in here
   is signed back out.

You now have three links: your original combined one (still works, handy as
a fallback), a student-only link to give out to students, and an admin-only
link for yourself/teachers. All three talk to the same database and the same
login cookie mechanism (already configured for cross-domain cookies — see the
notes in `server/middleware/auth.js`), so accounts, tests, results, and
lessons are shared and stay in sync automatically. You never need to
redeploy the main project when you add/change students or lessons — only
`git push` to the repo redeploys any of the three.
