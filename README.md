# 🎵 VibeMusic — Streaming Web App

> **Your Music Universe. Pure sound. Zero limits.**  
> A high-performance, ad-free music streaming platform with synchronized live lyrics, Spotify playlist importing, personal cloud library sync, and progressive web app (PWA) capabilities.

---

## ✨ Features

- 🎧 **High-Fidelity Audio Engine**: Stream in up to 320kbps high bitrate with balanced volume leveling and continuous autoplay.
- 🎤 **Live Synchronized Lyrics**: Real-time word-by-word synced lyrics with immersive album-tinted full-screen ambient visuals.
- ✨ **1-Click Spotify Playlist Import**: Paste any public Spotify playlist URL to instantly load 1,000+ tracks with metadata and album artwork.
- ☁️ **Cloud Database Synchronization**: Safe, real-time sync for custom playlists, favorites, and followed artists powered by Supabase Cloud PostgreSQL (with seamless local SQLite fallback).
- 🧭 **Refined Ergonomic Navigation**: Desktop sidebar with circular active indicators, streamlined mobile bottom bar, and single-window zero-scroll fullscreen authentication.
- 📱 **Progressive Web App (PWA)**: Installable as a native app on iOS, Android, macOS, and Windows with offline caching and media session controls.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: [Next.js 15](https://nextjs.org/) (App Router, Turbopack)
- **Language**: TypeScript 5
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **PWA**: `next-pwa` with custom service worker caching

### Backend
- **Framework**: [FastAPI](https://fastapi.tiangolo.com/) (Python 3.11+)
- **ASGI Server**: Uvicorn
- **Audio Extraction**: `yt-dlp` & `ytmusicapi`
- **Spotify Scraper**: `spotapi` & `curl_cffi`
- **Database**: Supabase Cloud PostgreSQL (`@supabase/supabase-js`, `supabase-py`) + SQLite local fallback
- **Authentication**: JWT token verification + Supabase Auth
- **Caching**: Multi-tier in-memory and disk cache store

---

## 📁 Repository Structure

```
VibeMusic/
├── backend/                  # FastAPI python backend
│   ├── api/                  # API routers & endpoints
│   ├── services/             # Audio, lyrics, Spotify & DB services
│   ├── main.py               # Application entrypoint & CORS config
│   ├── railway.toml          # Railway Nixpacks deployment config
│   └── requirements.txt      # Python dependencies
├── frontend/                 # Next.js 15 client
│   ├── src/
│   │   ├── app/              # App router pages (Home, Search, Library)
│   │   ├── components/       # Layout, player, modals, and UI components
│   │   ├── store/            # Zustand state stores (audio, auth, player)
│   │   └── lib/              # Audio engine, color extractor, smooth scroll
│   ├── public/               # Static assets, logos, favicon, PWA manifest
│   └── package.json          # Node dependencies & build scripts
├── DEVELOPMENT_PROGRESS.md   # Chronological development history & phase checkpoints
├── DEPLOYMENT.md             # Production deployment guide
└── supabase_schema.sql       # Database table schemas & RLS policies
```

---

## 🚀 Deployment Guide

### 1. Deploy Backend (Railway / Render / VPS)

#### Option A: Railway (Recommended)
1. Create a new project on [Railway](https://railway.app/).
2. Connect your GitHub repository.
3. Set the **Root Directory** to `/backend`.
4. Railway will automatically detect `railway.toml` and `requirements.txt` using the Nixpacks builder.
5. In the Railway dashboard under **Variables**, set:
   ```env
   PORT=8000
   CORS_ORIGINS=https://your-frontend-domain.vercel.app,http://localhost:3000
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_KEY=your-supabase-service-role-or-anon-key
   JWT_SECRET=your-random-production-secret-key
   ```
6. Generate a public domain under **Settings > Networking** (e.g. `https://vibemusic-backend.up.railway.app`).

#### Option B: Docker / Linux VPS
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

---

### 2. Deploy Frontend (Vercel)

1. Import your GitHub repository into [Vercel](https://vercel.com/).
2. Set **Root Directory** to `frontend`.
3. Framework Preset: **Next.js**.
4. In **Environment Variables**, add:
   ```env
   NEXT_PUBLIC_API_URL=https://vibemusic-backend.up.railway.app
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```
5. Click **Deploy**. Vercel will build and launch your production application.

---

## 💻 Local Development

### Prerequisites
- Node.js 18+ & npm
- Python 3.10+
- FFmpeg (for local audio streaming utilities)

### 1. Start the Backend
```bash
cd backend
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```
API documentation will be available at `http://127.0.0.1:8000/docs`.

### 2. Start the Frontend
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:3000` to start listening.

---

## 🔒 Security & Best Practices

- **CORS Restricted**: Backend CORS is explicitly restricted to production frontend domains.
- **Environment Secrets**: Never commit `.env` or `.env.local` files containing production secrets.
- **Edge Protection**: Run frontend traffic through Cloudflare or Vercel Edge Network for volumetric DDoS protection and global asset caching.

---

## 📄 License
MIT License. Created with ❤️ for music listeners everywhere.

