# 🚀 VibeMusic Production Deployment Manual

This guide contains everything you need to deploy VibeMusic to production (Frontend on **Vercel**, Backend on **Railway** or **Render**, and Database on **Supabase**).

---

## 📋 Pre-Flight Deployment Checklist

Before starting deployment, confirm the following steps:

- [x] **Zero TypeScript Errors**: Tested with `npx tsc --noEmit` across all components and pages.
- [x] **Zero ESLint Errors**: Tested with `npm run lint` (`0 errors, 181 benign style warnings`).
- [x] **Production Build Verified**: Successfully ran `npm run build` with all static pages prerendered.
- [x] **Repository Cleaned**: Removed obsolete scratch scripts, legacy mockups (`ui/`), and untracked dynamic cache files.
- [x] **Git Checkpoint Created**: Tagged `checkpoint-pre-deploy` and `phase-13-pre-deploy`.

---

## ☁️ Step 1: Set Up Supabase Cloud Database (Free)

If you haven't already created a Supabase project:

1. Sign up or log in at [supabase.com](https://supabase.com/).
2. Create a new project (e.g. `vibemusic-prod`).
3. Under **SQL Editor**, paste the contents of [`supabase_schema.sql`](file:///c:/Projects/VibeMusic/supabase_schema.sql) and click **Run**.
4. In **Project Settings > API**, copy:
   - **Project URL** (e.g., `https://xyz.supabase.co`)
   - **anon / public key**
   - **service_role key** (keep secret!)

---

## 🐍 Step 2: Deploy Backend to Railway

Railway is the simplest and fastest platform for FastAPI + Python:

1. Go to [railway.app](https://railway.app/) and sign in with GitHub.
2. Click **New Project > Deploy from GitHub repo**.
3. Select your `VibeMusic` repository.
4. Go to **Settings > General**:
   - Set **Root Directory** to `/backend`.
5. Under **Variables**, add these environment variables:
   ```env
   PORT=8000
   ENVIRONMENT=production
   CORS_ORIGINS=https://your-frontend-domain.vercel.app,http://localhost:3000
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_KEY=your-supabase-service-role-or-anon-key
   JWT_SECRET=generate-a-strong-random-32-char-string
   ```
6. Under **Settings > Networking > Public Networking**:
   - Click **Generate Domain**.
   - Note down the generated domain (e.g. `https://vibemusic-backend.up.railway.app`).
7. Test the deployment:
   - Open `https://vibemusic-backend.up.railway.app/docs` in your browser.
   - If the FastAPI Swagger docs appear, your backend is live!

---

## ⚡ Step 3: Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com/) and sign in with GitHub.
2. Click **Add New... > Project**.
3. Select your `VibeMusic` repository.
4. In the project configuration:
   - **Root Directory**: Click *Edit* and select `frontend`.
   - **Framework Preset**: *Next.js* (auto-detected).
   - **Build Command**: `next build --turbopack` (default).
5. Open the **Environment Variables** accordion and add:
   | Key | Value | Description |
   | :--- | :--- | :--- |
   | `NEXT_PUBLIC_API_URL` | `https://vibemusic-backend.up.railway.app` | Your Railway backend URL |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` | Your Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `your-supabase-anon-key` | Your Supabase public key |
6. Click **Deploy**.
7. Once the build finishes, Vercel gives you a production URL (e.g. `https://vibemusic.vercel.app`).

---

## 🔄 Step 4: Final Wire-up (CORS Update)

Now that you have your live Vercel URL:

1. Return to your **Railway** backend project.
2. Go to **Variables > CORS_ORIGINS**.
3. Update the value to include your production Vercel domain:
   ```env
   CORS_ORIGINS=https://vibemusic.vercel.app,https://your-custom-domain.com
   ```
4. Railway will automatically redeploy the backend in ~10 seconds.

---

## 📱 Step 5: Test Live Application

1. Open your Vercel URL in your browser.
2. Test **Search**: Search for any artist or track (e.g. "Blinding Lights").
3. Test **Audio Playback**: Click Play and verify audio streams smoothly.
4. Test **Lyrics**: Expand player and open synced lyrics.
5. Test **Library & Auth**: Click "Sign In", create an account or log in, and test saving a track to favorites.
6. Test **PWA**: Look for the "Install App" button in Chrome/Safari/Edge to test progressive web app installation.

🎉 **Your VibeMusic platform is now live for listeners worldwide!**
