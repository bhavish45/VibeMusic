# 🌐 100% Free All-Time Hosting Guide for VibeMusic

This guide walks you through deploying VibeMusic **100% free forever** with **zero credit card required**:

| Component | Platform | Free Tier Specifications | Cost |
| :--- | :--- | :--- | :--- |
| **Frontend** | **Vercel** | Unlimited deployments, 100GB bandwidth/mo, global edge CDN | **$0 / month** |
| **Backend** | **Render** | Free Web Service (750 free hours/month = 24/7 coverage), Python 3.11 | **$0 / month** |
| **Keep-Alive** | **cron-job.org** | Free HTTP pinger (pings `/api/health` every 10 min to keep Render awake) | **$0 / month** |
| **Database** | **Supabase** | Free PostgreSQL, 500MB DB, 50,000 monthly active auth users | **$0 / month** |

---

## 🚀 Step 1: Set Up Free Database on Supabase (2 mins)

1. Go to [supabase.com](https://supabase.com/) and sign up for free (using your GitHub account).
2. Click **New Project** and name it `vibemusic`.
3. In the left sidebar, click **SQL Editor > New Query**.
4. Open [`supabase_schema.sql`](file:///c:/Projects/VibeMusic/supabase_schema.sql), copy everything, paste it into the Supabase SQL Editor, and click **Run**.
5. Go to **Project Settings > API** and copy:
   - **Project URL** (e.g. `https://your-id.supabase.co`)
   - **anon / public key**
   - **service_role key**

---

## 🐍 Step 2: Deploy Backend on Render (100% Free Forever)

1. Go to [render.com](https://render.com/) and click **Get Started for Free** (Sign in with your GitHub).
2. Click **New + > Web Service**.
3. Choose **Build and deploy from a Git repository** and select your `VibeMusic` repository.
4. Fill in the details:
   - **Name**: `vibemusic-backend`
   - **Region**: Choose closest to you (e.g., *Singapore*, *Frankfurt*, or *Oregon*)
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: Select **Free** ($0/month)
5. Under **Environment Variables**, add:
   ```env
   PORT=10000
   ENVIRONMENT=production
   SUPABASE_URL=https://your-id.supabase.co
   SUPABASE_KEY=your-supabase-service-role-or-anon-key
   JWT_SECRET=any-long-random-string-like-abc123xyz789
   ```
6. Click **Create Web Service**.
7. Render will build the environment and provide you with a free URL:
   `https://vibemusic-backend.onrender.com`
8. Verify it works: Visit `https://vibemusic-backend.onrender.com/api/health` in your browser. It should show:
   ```json
   {"status":"healthy"}
   ```

---

## ⏰ Step 3: Keep Backend Awake 24/7 (100% Free Trick)

Render's free tier goes to sleep after 15 minutes of no visitors. To prevent it from sleeping and ensure instant playback 24/7:

1. Go to [cron-job.org](https://cron-job.org/) (or [uptimerobot.com](https://uptimerobot.com/)) and create a free account.
2. Click **Create Cronjob**.
3. Set the URL to:
   ```
   https://vibemusic-backend.onrender.com/api/health
   ```
4. Schedule: **Every 10 minutes**.
5. Save the job!
> **Result**: Render will receive a tiny 1-millisecond ping every 10 minutes, keeping your music server awake and responsive all the time for $0.

---

## ⚡ Step 4: Deploy Frontend on Vercel (100% Free Forever)

1. Go to [vercel.com](https://vercel.com/) and sign in with GitHub.
2. Click **Add New... > Project**.
3. Select your `VibeMusic` repository.
4. In the setup panel:
   - **Root Directory**: Click **Edit** and choose `frontend`.
   - **Framework Preset**: Next.js (automatically detected).
5. Open the **Environment Variables** section and add:
   | Name | Value |
   | :--- | :--- |
   | `NEXT_PUBLIC_API_URL` | `https://vibemusic-backend.onrender.com` |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://your-id.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `your-supabase-anon-key` |
6. Click **Deploy**.
7. In ~60 seconds, your site is live at:
   `https://vibemusic.vercel.app` (or your chosen project name).

---

## 🎧 Step 5: Test Your Live App

1. Open your Vercel URL on your phone or desktop.
2. Try **Search** &mdash; search any song or artist.
3. Tap **Play** &mdash; audio will stream via your live Render backend.
4. Open **Lyrics** &mdash; live synced word-by-word lyrics will animate.
5. Click **Sign In** &mdash; test registration or login with Supabase Cloud.

Enjoy your 100% free, 24/7 music streaming platform!
