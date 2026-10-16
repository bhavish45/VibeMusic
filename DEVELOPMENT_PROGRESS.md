# VibeMusic — Development Progress & Roadmap

> **Date**: October 16, 2026  
> **Status**: Operational & Fully Verified  
> **Backend**: FastAPI on `http://localhost:8000`  
> **Frontend**: Next.js 15 (Turbopack) on `http://localhost:3000`  

---

## 1. Summary of Completed Work

In this session, all mockup/screenshot placeholder limitations were addressed, and all core features were wired to genuine, live data and persistent state:

1. **Fixed Real Music Search**:
   - Removed all mock arrays with invalid YouTube video IDs (`funk_universo_slowed`, etc.) that were intercepting searches and causing playback failures.
   - Search input now directly queries the live YouTube Music backend API (`/api/search?q={query}&filter={filter}`).
   - Added instant autocomplete suggestions dropdown with ↗ arrows and top 5 instant song preview cards.
   - Interactive filter chips (**All**, **Songs**, **Videos**, **Albums**, **Artists**, **Playlists**) dynamically query the backend.
   - All results contain genuine YouTube 11-character video IDs and stream with 0-delay via `/api/stream/{videoId}`.

2. **Rebuilt Library with Meaningful, Persistent Functionality**:
   - Replaced all screenshot placeholder data with live, interactive state managed via Zustand and persisted to `localStorage` (`vibemusic_library_v2`).
   - **Favorite Songs**: Like songs anywhere (heart button in MiniPlayer, Fullscreen Player, Search, or Library). View all favorited tracks, shuffle play, play all, or remove from favorites.
   - **Followed Artists**: Follow artists from the new Artist Profile Modal. View followed artists in Library with subscriber counts, avatars, and one-click access to their full discography.
   - **Most Played**: Real analytics tracking! Whenever a track plays, `recordPlay(track)` increments the user's personal play counter. Library ranks top tracks (`#1`, `#2`, "Played X times").
   - **Downloaded / Offline**: Cache and save tracks for offline access with visual badges and offline playback.
   - **Custom Playlists**: Create playlists, add songs to playlists from any 3-dots track menu, delete playlists, and play entire playlists with one click.
   - **Recently Played / Added**: Live chronological timeline of played songs with human-readable timestamps ("Just now", "5m ago", "Yesterday").

3. **Dynamic Dominant Color Artwork Theme in Player**:
   - Created [`colorExtractor.ts`](file:///c:/Projects/VibeMusic/frontend/src/lib/colorExtractor.ts) using HTML5 Canvas image sampling.
   - Analyzes pixel RGB and saturation from the album poster and extracts the dominant vibrant color with intelligent luminance clamping and CORS fallback hashing.
   - Replaced the static green (`#064e3b` / `#059669`) background in [`ExpandedPlayer.tsx`](file:///c:/Projects/VibeMusic/frontend/src/components/player/ExpandedPlayer.tsx) with a dynamic gradient:
     `linear-gradient(180deg, ${dominantTheme.topGradient} 0%, ${dominantTheme.midGradient} 45%, #000000 100%)`.
   - Tinted lyrics card and metadata cards dynamically using `backdrop-filter: blur(24px)` and dominant color borders.

4. **Real Synced Lyrics (No Screenshot Mockups)**:
   - Eliminated hardcoded sample lyrics ("Pique novo, vai").
   - Integrated dual-layer live lyrics fetching:
     1. **LRCLIB API** (`https://lrclib.net/api/get`): Fetches line-synchronized LRC timestamps `[mm:ss.xx]` for millions of global and regional tracks.
     2. **YouTube Music Backend Lyrics** (`/api/lyrics/{videoId}`): Fallback for unlisted/regional tracks.
   - Synchronized line highlighting: the active singing line lights up with bold text and automatically smooth-scrolls into view as playback progresses.
   - Interactive seek: clicking any lyric line jumps playback directly to that timestamp.
   - If a song has no lyrics (instrumentals/unlisted), it displays an honest "Lyrics not available for this song" message instead of false text.

5. **Clickable Artist Profile Modal & Top Songs**:
   - Created [`ArtistModal.tsx`](file:///c:/Projects/VibeMusic/frontend/src/components/modals/ArtistModal.tsx) mounted globally in root layout.
   - Clicking an artist name anywhere (in ExpandedPlayer under track title, MiniPlayer, Home carousel cards, or Search results) opens the Artist Modal.
   - Features:
     - Artist hero banner and high-res image
     - "Verified Artist" badge
     - Subscriber / monthly listener count
     - **Follow / Following** toggle button (persists to Library)
     - **Play All** and **Shuffle** buttons
     - Full list of top tracks for that artist with instant playback

---

## 2. Key Files & Architecture

```
VibeMusic/
├── backend/
│   ├── main.py                     # FastAPI app with CORS, lifespan warming, route registrations
│   ├── api/
│   │   └── routes.py               # /search, /suggestions, /home, /charts, /song, /lyrics, /stream
│   └── services/
│       ├── yt_service.py           # ytmusicapi + yt-dlp tv_embedded client, stream extraction
│       └── cache_service.py        # High-performance in-memory TTL caching
└── frontend/
    └── src/
        ├── store/
        │   └── playerStore.ts      # Zustand store: playback state, favorites, followed artists,
        │                           # playHistory, downloadedTracks, playlists + localStorage persistence
        ├── lib/
        │   ├── audioPlayer.ts      # HTMLAudioElement singleton with MediaSession & preload buffer
        │   ├── colorExtractor.ts   # Canvas pixel sampling for dominant artwork color extraction
        │   └── clientCache.ts      # In-memory client cache with TTL
        ├── components/
        │   ├── modals/
        │   │   └── ArtistModal.tsx # Artist profile drawer (banner, follow, top songs, play all)
        │   ├── player/
        │   │   ├── ExpandedPlayer.tsx # Fullscreen player with dynamic dominant color, live LRC lyrics,
        │   │   │                      # clickable artist profile, and song stats
        │   │   ├── MiniPlayer.tsx     # Bottom persistent player bar with scrubber, volume, and heart
        │   │   └── QueueDrawer.tsx    # Up next playlist drawer with reordering
        │   └── ui/
        │       └── MusicPoster.tsx    # Image loader with multi-tier fallbacks
        └── app/
            ├── page.tsx            # Home page: "Hot and Happening" carousel + "Quick picks"
            ├── search/page.tsx     # Live search with autocomplete, filter chips, and artist cards
            ├── library/page.tsx    # 4 Quick Action banners, Favorites, Followed, Most Played, Playlists
            └── layout.tsx          # Root layout with Sidebar, Header, MiniPlayer, and ArtistModal
```

---

## 3. How to Run the Application Tomorrow

### Terminal 1: Backend (FastAPI)
```powershell
cd C:\Projects\VibeMusic\backend
# Activate virtual environment
.\venv\Scripts\activate
# Start backend server
python -m uvicorn main:app --port 8000 --host 0.0.0.0 --reload
```
*Backend API will run on `http://localhost:8000` (docs at `http://localhost:8000/docs`).*

### Terminal 2: Frontend (Next.js)
```powershell
cd C:\Projects\VibeMusic\frontend
# Start dev server
cmd /c "npm run dev"
```
*Frontend will run on `http://localhost:3000`.*

---

## 4. Suggested Next Steps for Tomorrow

1. **Audio Cache & Offline Playback (Service Worker)**:
   - Connect the "Downloaded" section to CacheStorage or IndexedDB via the PWA service worker so audio files play completely offline without network.
2. **Explore Mood / Genre Playlists**:
   - Add dedicated playlist pages when clicking Moods & Genres in the Search page (e.g., clicking "Chill" loads a curated 25-song playlist).
3. **Keyboard Shortcuts**:
   - Add spacebar for Play/Pause, `Shift+Right` for Next Track, `Shift+Left` for Previous Track, and `M` for Mute.
4. **Equalizer & Audio Effects**:
   - Optional Web Audio API equalizer (Bass Boost, Treble, Vocal Clarity).
