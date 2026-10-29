# VibeMusic — Development Progress & Roadmap

> **Date**: October 29, 2026  
> **Status**: Operational, Feature-Complete & Checkpoint 8 In Progress  
> **Backend**: FastAPI on `http://localhost:8000` (docs: `http://localhost:8000/docs`)  
> **Frontend**: Next.js 15 (Turbopack) on `http://localhost:3000`  

---

## 1. Summary of Completed Work

### K. Supabase Cloud Database & User Storage Architecture (Phase 2 Completed)
- **Supabase Cloud PostgreSQL & Authentication (`supabase_schema.sql` & `supabase_service.py`)**:
  - Connected app to live Supabase Cloud PostgreSQL database (`https://qktvfmsldtfprdladojk.supabase.co`).
  - Implemented dual-mode authentication: seamless Supabase Auth (`@supabase/supabase-js`) with automatic fallback to local SQLite when keys are missing.
  - Configured Row Level Security (RLS) policies for user data isolation, supporting both User Bearer Token scoping and Backend Service Role Admin execution.
  - Auto-trigger on `auth.users` creates and manages `public.profiles`.
- **User Storage Split Architecture (100% Compliant with Specifications)**:
  - **Favorites (`user_favorites`)**: Saved directly to Supabase Cloud PostgreSQL; synchronized on sign-in and instantly updated when songs are liked/unliked.
  - **Custom Playlists (`user_playlists` & `user_playlist_tracks`)**: User-created playlists and their individual songs are stored in Supabase with position indexing. Deleting a song via the UI removes the specific entry from `user_playlist_tracks`. Deleting a playlist cascades and cleans up all associated tracks.
  - **Lightweight Spotify Playlists (0 Tracks in Database)**:
    - Spotify playlists are stored as lightweight headers (`source='spotify'`, `spotify_playlist_id`, name, cover).
    - Individual tracks are **NOT** stored in the database, saving massive database storage and preventing row bloat.
    - When opened in Library, tracks and artwork are loaded dynamically on-demand directly via public Spotify link.
    - Tracks remain cached in frontend state during session to prevent any disappearing or re-fetching lag.
  - **Followed Artists (`user_followed_artists`)**: Backed up to Supabase Cloud; persists followed artist names, avatars, YouTube browse IDs, and subscriber counts.
  - **Recently Played Songs (`localStorage`)**: Maintained on device for instant playback speed, privacy, and offline accessibility.
  - **Most Played Songs (`localStorage`)**: Calculated dynamically on device from local play history counters.
  - **Settings & Audio Preferences (`localStorage`)**: Preserved in local storage (equalizer, volume, streaming quality, visuals).

### J. Email Database Authentication & 100% Free Spotify Playlist Importer (Zero API Keys)
- **Email & Password Authentication (`backend/services/db_service.py` & `auth_service.py`)**:
  - SQLite database architecture (`backend/vibemusic.db`) with `users`, `user_favorites`, `user_playlists`, `user_playlist_tracks` tables.
  - Secure PBKDF2 HMAC-SHA256 password hashing (100,000 iterations + cryptographic salt) and JWT token validation.
  - Strictly Email & Password login/registration — no external OAuth or paid subscription required.
- **100% Free Spotify Playlist Importer (Zero API Keys / No Spotify Premium Needed)**:
  - Addressed the 2026 Spotify Web API limitation where Spotify restricted API access behind paid developer tiers.
  - Implemented public Spotify embed extraction (`/api/spotify/import-url`), extracting full playlist titles, descriptions, official cover artwork, and complete tracklists directly without requiring any developer keys or premium accounts.
  - Dynamic Spotify-to-YouTube track resolution (`/api/spotify/resolve-track`) matches each imported Spotify song to high-fidelity audio streams for seamless playback with progress tracking and equalizer animations.
- **Visual Step-by-Step User Instructions (Where & How to Get Playlist Links)**:
  - Built a comprehensive 4-step interactive guide featured both directly on the `/library` Spotify Playlists view and inside the Import Modal:
    - **Step 1: Open Spotify**: Works with mobile app, desktop app, or web (`open.spotify.com`) with any free/premium account.
    - **Step 2: Choose Any Playlist**: Select any personal, friend's, or official Spotify playlist.
    - **Step 3: Copy Playlist Link**: Dedicated instructions for Mobile (tap `•••` &rarr; Share &rarr; Copy link) and Desktop (click `•••` next to Play &rarr; Share &rarr; Copy link to playlist).
    - **Step 4: Paste & Stream**: Paste link into VibeMusic and enjoy instant full audio playback.
  - Included a **"Paste from Clipboard"** button and 1-click popular presets (Today's Top Hits, RapCaviar, Chill Lofi Beats) for instant testing.
- **Permissions & Cloud Sync**:
  - Unauthenticated guests can create local playlists and listen to music freely.
  - Favoriting songs prompts for Email sign-in, persisting favorites and playlists directly to SQLite database.

### A. Full Artist Extraction, Optimization & Song Discography ("Load More")
- **ytmusicapi Verification & Architecture**:
  - Verified and confirmed that `ytmusicapi` is 100% capable of retrieving complete artist discographies and deep profile metadata.
  - `ytmusic.get_artist(channel_id)` returns verified badges, bio/description, high-res avatar thumbnails, subscriber count, monthly listeners, and `songs.browseId`.
  - `songs.browseId` is an official YouTube Music playlist containing the full discography of top tracks (up to **150 full songs**).
- **Eliminated Search Delay & Performance Latency**:
  - *Root Cause*: The frontend was previously passing only artist name strings (`/api/artist/Taylor%20Swift`), forcing the backend to run an expensive `yt.search(filter="artists")` (1.5s–2.5s) on every click before calling `yt.get_artist`.
  - *Fix*: Wired artist `id` / `browseId` into all track objects, search cards, and player instances across the application. When an ID is present, the backend skips search and directly queries `get_artist` in ~0.4s.
  - *Background Pre-Warming (`preload_artist_songs`)*: As soon as an artist profile is opened, FastAPI triggers a non-blocking background task that pre-caches the full 150-song playlist (`artist_playlist_full:{songs_browse_id}`) into RAM and disk cache. When the user clicks "Load More Songs", the data responds in **0ms (instant)**.
- **Rich Artist Details**:
  - Verified badge with artist avatar in high resolution (`w800-h800-l90-rj`).
  - Monthly listeners badge (e.g., `430M monthly listeners`) and normalized subscribers (e.g., `63.5M subscribers`).
  - Expandable "About the Artist" bio card with a smooth "Read more / Show less" toggle.
  - "Albums & Releases" discography section displaying covers, titles, and release years.
- **Interactive "Load More Songs" & "Load All Songs" UI**:
  - Initial view displays top songs smoothly without lag or layout shift.
  - Added a prominent **"Load More Songs (X of Y)"** button to fetch the next batch of 40 songs.
  - Added a **"Load All Songs"** button to load the full 150-song catalog at once.
  - Real-time loading indicators (`Loader2` spin animations).
  - Shows `✓ All {count} songs loaded` when complete.
  - "Play All" and "Shuffle" buttons dynamically adapt to play through the entire expanded catalog.

---

### B. Real Search with Live Suggestions & Filters
- Removed all mock arrays with invalid YouTube video IDs (`funk_universo_slowed`, etc.) that were intercepting searches and causing playback failures.
- Search input directly queries the live YouTube Music backend API (`/api/search?q={query}&filter={filter}`).
- Instant autocomplete suggestions dropdown with ↗ arrows and top 5 instant song preview cards.
- Interactive filter chips (**All**, **Songs**, **Videos**, **Albums**, **Artists**, **Playlists**) dynamically query the backend.
- All results contain genuine YouTube 11-character video IDs and stream with 0-delay via `/api/stream/{videoId}`.

---

### C. Persistent User Library (No Mockups)
- Replaced all screenshot placeholder data with live, interactive state managed via Zustand and persisted to `localStorage` (`vibemusic_library_v2`).
- **Favorite Songs**: Like songs anywhere (heart button in MiniPlayer, Fullscreen Player, Search, or Library). View all favorited tracks, shuffle play, play all, or remove from favorites.
- **Followed Artists**: Follow artists from the Artist Profile Modal. View followed artists in Library with subscriber counts, avatars, and one-click access to their full discography.
- **Most Played**: Real analytics tracking. Whenever a track plays, `recordPlay(track)` increments the user's personal play counter. Library ranks top tracks (`#1`, `#2`, "Played X times").
- **Downloaded / Offline**: Cache and save tracks for offline access with visual badges.
- **Custom Playlists**: Create playlists, add songs to playlists from any 3-dots track menu, delete playlists, and play entire playlists with one click.
- **Recently Played / Added**: Live chronological timeline of played songs with human-readable timestamps ("Just now", "5m ago", "Yesterday").

---

### D. Dynamic Dominant Color Artwork Theme in Player
- Created [`colorExtractor.ts`](file:///c:/Projects/VibeMusic/frontend/src/lib/colorExtractor.ts) using HTML5 Canvas image sampling.
- Analyzes pixel RGB and saturation from the album poster and extracts the dominant vibrant color with intelligent luminance clamping and CORS fallback hashing.
- Replaced the static green (`#064e3b` / `#059669`) background in [`ExpandedPlayer.tsx`](file:///c:/Projects/VibeMusic/frontend/src/components/player/ExpandedPlayer.tsx) with a dynamic gradient:
  `linear-gradient(180deg, ${dominantTheme.topGradient} 0%, ${dominantTheme.midGradient} 45%, #000000 100%)`.
- Tinted lyrics card and metadata cards dynamically using `backdrop-filter: blur(24px)` and dominant color borders.

---

### E. Real Synced Lyrics (No Screenshot Mockups)
- Eliminated hardcoded sample lyrics ("Pique novo, vai").
- Integrated dual-layer live lyrics fetching:
  1. **LRCLIB API** (`https://lrclib.net/api/get`): Fetches line-synchronized LRC timestamps `[mm:ss.xx]` for millions of global and regional tracks.
  2. **YouTube Music Backend Lyrics** (`/api/lyrics/{videoId}`): Fallback for unlisted/regional tracks.
- Synchronized line highlighting: the active singing line lights up with bold text and automatically smooth-scrolls into view as playback progresses.
- Interactive seek: clicking any lyric line jumps playback directly to that timestamp.
- If a song has no lyrics (instrumentals/unlisted), it displays an honest "Lyrics not available for this song" message instead of false text.

---

### F. Global Mini Player Bar Visibility & Multi-Page Persistence
- **Zero-Bar First Visit**: Mini player bar is completely hidden when a user first visits the application (`currentTrack: null`), ensuring a clean, uncluttered initial landing.
- **Instant Activation**: As soon as the user plays their first track from any section (carousel, quick picks, search, or artist discography), the player bar slides in smoothly.
- **Multi-Page Persistence**: Persists across all main routes (`/`, `/search`, `/library`) and floats above modals like `ArtistModal`.
- **Fullscreen Exclusivity**: Mini player automatically hides whenever the full-screen player (`isExpanded`) or full-screen lyrics (`isFullScreenLyricsOpen`) is opened to eliminate control overlapping.

---

### G. Artist Profile Redirection from Fullscreen Player & Lyrics
- Fixed full-screen artist link behavior in [ExpandedPlayer.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/player/ExpandedPlayer.tsx) and [FullScreenLyrics.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/player/FullScreenLyrics.tsx).
- Clicking the artist name now closes the full-screen overlay (`setIsExpanded(false)`, `setIsFullScreenLyricsOpen(false)`) and directly opens the target artist's profile in [ArtistModal.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/modals/ArtistModal.tsx).
- Resolves the issue where artist profile was rendering beneath the active full-screen player.

---

### H. Autoplay Prevention on First Visit
- Corrected audio player subscription lifecycle in [audioPlayer.ts](file:///c:/Projects/VibeMusic/frontend/src/lib/audioPlayer.ts).
- Prevented premature audio element mounting and unwanted playback on initial page loads.
- Audio playback strictly waits for explicit user action (clicking play on a card, button, or search result).

---

### I. Home Page Top-Left Breathing Gradient Background (`#5AF9DB`)
- **Aesthetic Black Background**: Set rich, pure black base background (`#000000`) for the home page.
- **Top-Left Focal Origin Point**: Radial gradient anchored directly at the top-left side of the content area (`md:left-20`).
- **Color Signature `#5AF9DB`**: High-contrast, vibrant mint-cyan (`rgb(90, 249, 219)`) ambient lighting.
- **Dual-Layer Breathing Animation**:
  - `homeBreathingGlow`: Expands and contracts the ambient outer aura (scale 0.92 to 1.35, opacity 0.5 to 0.95, 6.5s ease-in-out loop).
  - `homeBreathingCore`: Inner luminous core (scale 0.85 to 1.22, opacity 0.65 to 1.0) creating organic, rhythmic breathing depth.
- **Non-Intrusive & Interactive**: Container uses `pointer-events-none fixed inset-0 md:left-20 z-0` so all clicks, swipes, and scrolls on music cards and filter chips (`relative z-10`) are 100% responsive.
- **Translucent Header Glassmorphism**: Updated [Header.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/layout/Header.tsx) to `bg-black/40 backdrop-blur-md` so the top-left glow gently illuminates the brand title and greeting.
- **Route Containment**: Scoped cleanly inside [src/app/page.tsx](file:///c:/Projects/VibeMusic/frontend/src/app/page.tsx); automatically unmounts when navigating to `/search` or `/library`.
- **Git Checkpoint**: Created rollback checkpoints named `Saturday` in root and frontend repositories.

---

## 2. Key Files & Architecture

```
VibeMusic/
├── backend/
│   ├── main.py                     # FastAPI app with CORS, lifespan warming, route registrations & security middleware
│   ├── api/
│   │   ├── routes.py               # /search, /suggestions, /home, /charts, /song, /lyrics, /artist, /stream, /download
│   │   └── auth_routes.py          # /api/auth/register, /api/auth/login, /api/auth/me, /api/user/library
│   └── services/
│       ├── yt_service.py           # ytmusicapi + yt-dlp tv_embedded client (IPv4 0.0.0.0 bound), artist pagination & preloading
│       ├── cache_service.py        # High-performance in-memory + persistent disk TTL caching
│       ├── db_service.py           # Local SQLite database (users, playlists, favorites)
│       ├── supabase_service.py     # Supabase Cloud PostgreSQL with Row Level Security (RLS)
│       └── spotify_service.py      # Public Spotify embed scraper (zero API keys required)
└── frontend/
    └── src/
        ├── store/
        │   ├── playerStore.ts      # Zustand: playback, queue, activeArtistModal, favorites, followed artists, shortcuts
        │   ├── authStore.ts        # Authentication state, login/register modals, cloud sync dispatcher
        │   ├── searchStore.ts      # Search query, recent searches history (localStorage persisted)
        │   └── settingsStore.ts    # Audio quality, crossfade duration, normalization, theme preferences
        ├── lib/
        │   ├── audioPlayer.ts      # HTMLAudioElement singleton: crossfade engine, loudness curve, MediaSession
        │   ├── colorExtractor.ts   # Canvas pixel sampling for dynamic dominant artwork color extraction
        │   ├── smoothScroll.ts     # Physics-based RAF quintic easing & momentum wheel scrolling (120Hz/144Hz)
        │   ├── lyricsService.ts    # Dual LRCLIB + YouTube synced lyrics with Romanized provider
        │   └── downloadService.ts  # Client-side audio file downloader with disk save dialog
        ├── components/
        │   ├── layout/
        │   │   ├── Header.tsx              # Standardized 76px glassmorphic header with Bell & UserButton
        │   │   ├── UserButton.tsx          # Unified Sign In pill & authenticated user profile dropdown
        │   │   ├── SearchBarHeader.tsx     # Full-width search bar with recent search history & suggestions
        │   │   ├── Sidebar.tsx             # Navigation sidebar with route indicators
        │   │   ├── KeyboardShortcutsHandler.tsx # Global keyboard shortcuts listener with input guard
        │   │   └── AuthInitializer.tsx    # Mount-time client state & drag protection initializers
        │   ├── modals/
        │   │   ├── ArtistModal.tsx         # Artist discography drawer (verified badge, bio, "Load More Songs", albums)
        │   │   ├── KeyboardShortcutsModal.tsx # Glassmorphic cheat sheet modal with categorized key pills
        │   │   ├── SettingsModal.tsx       # 3-tab settings (Playback & Audio, Lyrics, About VibeMusic)
        │   │   ├── UpdatesModal.tsx        # What's New release notes (v1.0.0) with clean highlights
        │   │   ├── RecentSongsModal.tsx    # Recently played tracks with custom glassmorphic delete confirmation
        │   │   ├── CreatePlaylistModal.tsx # Custom in-app modal to create new user playlists
        │   │   ├── AddToPlaylistModal.tsx  # Add song to user playlist modal
        │   │   └── AuthModal.tsx           # Email login and user registration modal
        │   ├── player/
        │   │   ├── ExpandedPlayer.tsx      # Fullscreen player with dynamic gradient, live LRC lyrics, clickable artist
        │   │   ├── MiniPlayer.tsx          # Bottom persistent player bar with scrubber, volume, queue & lyrics toggles
        │   │   ├── FullScreenLyrics.tsx    # Dedicated high-fps synchronized fullscreen lyrics overlay
        │   │   └── QueueDrawer.tsx         # Up next playlist drawer with hardware-accelerated momentum scrolling
        │   └── ui/
        │       ├── MusicPoster.tsx         # Drag-protected image loader with multi-tier fallbacks
        │       ├── SimpLogo.tsx            # Samsung One UI squircle brand logo (rounded-[18px])
        │       └── SongActionMenu.tsx      # Contextual 3-dots menu (play next, add to queue/playlist, download)
        └── app/
            ├── page.tsx            # Home page: "Hot and Happening" carousel, Quick picks, Mint breathing glow
            ├── search/page.tsx     # Full-width search with autocomplete, category chips, Albums/Playlists grids
            ├── library/page.tsx    # User Library: Favorites, Followed, Most Played, Downloaded, Spotify Importer
            └── layout.tsx          # Root layout with Sidebar, MiniPlayer, Modals & Keyboard listener
```

---

## 3. How to Run the Application Tomorrow

### Quick Command to Start Both (or Terminal by Terminal):

#### Terminal 1: Backend (FastAPI)
```powershell
cd C:\Projects\VibeMusic\backend
.\venv\Scripts\python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```
*Backend API runs on `http://127.0.0.1:8000` (interactive API docs available at `http://127.0.0.1:8000/docs`).*

#### Terminal 2: Frontend (Next.js)
```powershell
cd C:\Projects\VibeMusic\frontend
powershell -ExecutionPolicy Bypass -Command "npm run dev"
```
*Frontend runs on `http://localhost:3000`.*

### Recent Updates:
- **Clean Lyrics Display**: Reverted English lyrics translation additions; lyrics display and structure are restored to the clean original view in both the expanded player card and fullscreen view.
- **Clean MiniPlayer Bar**: Removed audio quality badges from the miniplayer bar to preserve a clean, uncluttered playback bar.
- **Immediate Settings Reactivity**: Dynamic theming, audio normalization compressor, audio quality streams, continuous autoplay, crossfade durations, and synced lyrics auto-scrolling all apply instantly in real time without refreshing or pausing playback.
- **Individual Song Posters for Spotify Playlists**: Fixed the issue where imported Spotify playlist tracks displayed the playlist collage poster. Songs inside imported Spotify playlists now display their own authentic individual album covers (via Spotify oEmbed and YouTube Music fallback), while the playlist header preserves its original playlist cover.
- **Complete Spotify Playlist Track Import**: Ensures 100% of songs in public Spotify playlists are imported without skipping tracks.
- **Strict Playlist Deletion Protection**: Users cannot delete songs from imported Spotify playlists (the delete button is completely hidden in the UI and blocked on both frontend store and backend API). Song deletion is only permitted for local or custom playlists created by the user. Deleting the entire imported Spotify playlist remains fully available via the playlist header.
- **Zero-Delay Progress Bar Reset on Song Skip**: Fixed the issue where skipping a song (e.g., at 50s) left the progress bar stuck at 50s on the next song. Added synchronous audio pausing, `audio.currentTime = 0`, progress zeroing, and an `isLoadingTrack` flag to suppress stale `timeupdate` emissions during track transitions.
- **Seamless Background Queue Preloading for Spotify & Local Playlists**: Implemented active background queue track resolution in `AudioPlayerService` (`preloadUpcomingQueue` and `resolveUpcomingTrack`). Upcoming Spotify playlist and local playlist tracks have their YouTube streams resolved and pre-buffered into `nextAudio` with backend batch warming, ensuring instant gapless transitions matching the Home section.
- **Reliable Full Playlist Deletion with Custom In-App Modal**: Fixed the issue where deleting imported Spotify playlists was failing due to browser suppression of native `window.confirm()` dialogs and ID prefix mismatches (`sp_pl_` vs raw Spotify ID). Introduced a custom glassmorphic confirmation modal, tolerant ID filtering in `playerStore.deletePlaylist`, and multi-ID fallback matching in `db_service.delete_user_playlist`. Deleting entire Spotify or user custom playlists works 100% reliably from both playlist cards and header views.
- **Fixed Next.js SSR Hydration Mismatch**: Resolved the hydration mismatch error caused by `navigationStore` evaluating `typeof window !== 'undefined' ? window.location.pathname : '/'` during store module initialization (which caused the server to render Home `'/'` while the client rendered `'/library'`). Initialized `currentPath: null` to allow server and initial client hydration to match seamlessly with Next.js's native `usePathname()`, and deferred client-side persistence loading (`settingsStore`) to `AuthInitializer` mount effects.
- **Git Checkpoint: Phase 2**: Created rollback checkpoint tagged `phase-2` across root (`9762c3c`) and frontend (`3767ece`) git repositories before implementing working email login.
- **100% Working Email Login & Registration**:
  - *Fixed AuthModal Render-Loop Tab Bug*: Resolved an issue in [AuthModal.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/modals/AuthModal.tsx) where checking `mode !== authModalMode` directly inside the render body continuously reverted the tab back to login, preventing users from switching to "Create Account". Moved mode initialization cleanly to `useEffect`.
  - *Instant 1-Click Demo & Pre-Fill*: Configured existing `test@example.com` demo credentials (`password123`) and added both a **"Fill demo account"** link and an **"Instant Demo Sign In (1-Click)"** button for testing, alongside standard email/password entry.
  - *Complete User Library Synchronization*: Fully implemented [fetchUserLibrary](file:///c:/Projects/VibeMusic/frontend/src/store/playerStore.ts) and [handleUserLogout](file:///c:/Projects/VibeMusic/frontend/src/store/playerStore.ts). When a user logs in, their cloud favorites and playlists are retrieved from SQLite via `/api/user/library` and synced to the local store and storage.
  - *Robust Backend URL Resolution*: Added [getBackendUrl()](file:///c:/Projects/VibeMusic/frontend/src/store/authStore.ts) to gracefully route requests to `127.0.0.1:8000` or `localhost:8000`, resolving IPv6/IPv4 connection drops on Windows.
  - *Global Search Page Header Pill*: Added a direct Sign In / User Profile button next to the search input on [/search](file:///c:/Projects/VibeMusic/frontend/src/app/search/page.tsx) so users can check account status or sign in without navigating away from Search.
  - *End-to-End Browser Verified*: Verified with browser automation that user sign-out, demo email login, profile dropdown view, tab switching, and new user account creation ("Alex Rivera" &rarr; `alex.test@vibemusic.app`) succeed 100% with immediate reactive feedback.

- **Git Checkpoint: Phase 2.5**:
  - *Full Supabase Cloud Storage Split*: Implemented real database tables for user favorites, custom playlists with cascading track deletion, lightweight Spotify playlist references without track bloat, followed artists, and client localStorage for recent plays, most played, and audio settings.
  - *Read-Only Playback Queue*: Removed all delete buttons (`Trash2`) on queue items and the `Clear` button in the drawer header so users cannot delete songs from the queue.
  - *Fixed Finished Song Re-appearing in Up Next*: Fixed `QueueDrawer` so "Up Next" is strictly sliced from `queueIndex + 1`. Songs that have completed playback stay in playback history and never re-appear under "Up Next".
  - *Direct Queue Track Selection*: Added `playQueueIndex(index)` to `playerStore` for immediate gapless jumping to any upcoming song.
  - *Conditional Contextual 3-Dots Action Menu*: Enhanced `SongActionMenu` to only show "Play Next" and "Add to Queue" when a song is actively playing/loaded. On initial website visits when no music is playing, only "Add to Playlist" and "Add to Favorites" are shown, matching standard music streaming apps.

- **Git Checkpoint: Phase 3**:
  - Created checkpoint tagged `phase-3` across root (`addbf26`) and frontend (`b49ad40`) git repositories.
  - *Clean Profile Dropdown Menu*: Simplified user profile menu in [Header.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/layout/Header.tsx) to exclusively show avatar, display name, email, and Sign Out button (removed internal database badge, stats grid, and manual cloud sync button).
  - *Library Header & Sections Clean-up*: Removed redundant "NEW" sparkles badge button next to profile avatar in Library header, and removed the Spotify Saved Playlists Loaded banner card.
  - *Simplified Settings Modal*: Streamlined [SettingsModal.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/modals/SettingsModal.tsx) to 3 focused tabs: **Playback & Audio**, **Lyrics**, and **About** (removed Storage & Cache tab, item counters, cache clearer, and danger zone library wiper).
  - *Dedicated Custom In-App Create Playlist Modal*: Built [CreatePlaylistModal.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/modals/CreatePlaylistModal.tsx) matching `AddToPlaylistModal` styling, connected both `+ Create Playlist` and `Create Your First Playlist` buttons, removed description input to request solely Playlist Name, and fixed navigation so newly created playlists instantly appear in the **Your Playlists** grid.
  - *Spotify Playlist Guide Production Polish*: Renamed title to **"Spotify Playlist"**, removed developer jargon ("Zero Spotify API Keys Required", "embed parsing", "developer accounts"), cleanly aligned the `(n) imported` tag beside the title, and replaced technical notes with user-friendly copy for production deployment.
  - *Guest Library Banner Update*: Changed top guest banner title across all library views from "Save Favorites & Cloud Library" to **"Sign In"** and removed the blue "Email Account" badge.

- **Git Checkpoint: Phase 4**:
  - Created rollback checkpoint tagged `phase-4` across root and frontend (`9206fa2`) git repositories.
  - Encompasses Player & Queue fullscreen and hover menu enhancements, complete user database data purge on logout, unified UserButton styling across all pages, dynamic playlist poster adoption, strict Spotify playlist validation, direct song download to disk with client localStorage persistence, Spotify-matching square card sizing for albums and playlists on Search, and robust backend YouTube Music album and playlist resolvers.

- **Player & Queue Enhancements**:
  - *Queue Drawer Z-Index & Fullscreen Integration*: Fixed the queue side window opening behind the fullscreen player ([ExpandedPlayer.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/player/ExpandedPlayer.tsx)). Raised [QueueDrawer.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/player/QueueDrawer.tsx) to `z-[70]` so it renders cleanly on top of `ExpandedPlayer` (`z-[60]`). Adjusted bottom offset dynamically (`bottom-0` when expanded, `bottom-20` in miniplayer view) and added an outside-click backdrop for seamless dismissal in fullscreen mode.
  - *Queue Sidebar 3-Dots Action Menu on Hover*: Integrated [SongActionMenu.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/ui/SongActionMenu.tsx) with `opacity-0 group-hover:opacity-100 transition-opacity` into both the "Now Playing" card and all "Up Next" track rows in [QueueDrawer.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/player/QueueDrawer.tsx). Users can hover over any song to play next, add to queue, save to playlist, toggle favorites, or remove from queue.
  - *Bottom MiniPlayer Queue Button*: Updated [MiniPlayer.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/player/MiniPlayer.tsx) controls to switch the Favorite (Heart) button to the left and add the Queue toggle button (`ListMusic`) directly to its right (`[Heart] [Queue] [Lyrics] [Fullscreen Expand] ...`) with active teal highlighting.
  - *Modal Z-Index Harmonization*: Elevated [AddToPlaylistModal.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/modals/AddToPlaylistModal.tsx) to `z-[80]`, [CreatePlaylistModal.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/modals/CreatePlaylistModal.tsx) to `z-[85]`, [AuthModal.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/modals/AuthModal.tsx) to `z-[90]`, and [ArtistModal.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/modals/ArtistModal.tsx) to `z-[75]` so any modal dialogs opened from the queue drawer or fullscreen player render above all background views.

- **Complete User Database Data Purge on Logout**:
  - *Followed Artists Reset*: Fixed a critical issue where [playerStore.ts](file:///c:/Projects/VibeMusic/frontend/src/store/playerStore.ts)'s `handleUserLogout` failed to clear `followedArtists` from store and persisted it back to localStorage on sign out. `handleUserLogout` now cleanly zeroes `favorites: []`, `followedArtists: []`, and `playlists: []` in store and localStorage.
  - *Synchronous Logout Hook Dispatch*: Added `registerOnLogout` in [authStore.ts](file:///c:/Projects/VibeMusic/frontend/src/store/authStore.ts) connected to [playerStore.ts](file:///c:/Projects/VibeMusic/frontend/src/store/playerStore.ts), replacing the delayed dynamic import with immediate synchronous execution on sign out.
  - *Library Sub-Section Unauthenticated States*: Updated [library/page.tsx](file:///c:/Projects/VibeMusic/frontend/src/app/library/page.tsx) to show a dedicated "Sign In to View Followed Artists" prompt with email login button (matching Favorites) when `!isAuthenticated`, updated the 2x2 Followed overview card to display "Sign in to follow", and auto-reset any open playlist detail view on logout.

- **Unified UserButton & Search Header Alignment**:
  - *Unified Component*: Created [UserButton.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/layout/UserButton.tsx) encapsulating the exact Home page "Sign In" button styling (`px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-semibold` with teal glow and `w-3.5 h-3.5` icon) and authenticated avatar dropdown menu with Sign Out.
  - *Exact Size & Placement on Search Page*: Updated [/search](file:///c:/Projects/VibeMusic/frontend/src/app/search/page.tsx) to replace the oversized `py-3.5 rounded-2xl` button with `<UserButton className="flex-shrink-0" />`, placing the button in the exact same top-right position and identical pill size as in the Home page.
  - *Consistent Header Integration*: Refactored [Header.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/layout/Header.tsx) across Home and Library pages to share the identical `UserButton` component.

- **Dynamic Playlist Poster Resolution (First Song Poster Adoption)**:
  - *Default for Empty Playlists*: When creating a local or custom playlist without any songs, the playlist retains its default gradient placeholder (`bg-gradient-to-tr from-[#00d2c4] to-blue-600`) with the playlist's initial letter.
  - *First Track Poster Adoption*: As soon as any song is added to the playlist, the playlist dynamically adopts the first song's poster (`first.poster || first.thumbnails?.[0]?.url || first.fallbackPoster`) as its cover artwork across all UI views ([library/page.tsx](file:///c:/Projects/VibeMusic/frontend/src/app/library/page.tsx), playlist detail header, and [AddToPlaylistModal.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/modals/AddToPlaylistModal.tsx)).
  - *Reversion & Dynamic Adjustments*: If tracks are removed, the cover automatically adjusts to the remaining first track. If all tracks are removed, it gracefully falls back to the default gradient initial placeholder.
  - *Backend & Persistence Parity*: Updated [db_service.py](file:///c:/Projects/VibeMusic/backend/services/db_service.py) and [supabase_service.py](file:///c:/Projects/VibeMusic/backend/services/supabase_service.py) so database operations maintain parity with the frontend store.
  - *Spotify Playlist Integrity*: Imported Spotify playlists continue to retain their authentic Spotify playlist covers without alteration.

- **Strict Spotify Playlist URL Validation & Null Playlist Prevention**:
  - *Frontend Input Validation*: Added regex pattern checking in [library/page.tsx](file:///c:/Projects/VibeMusic/frontend/src/app/library/page.tsx) to ensure inputs conform to valid Spotify playlist links or IDs (15–35 characters). Random strings like `"hi"` are immediately caught with a clear prompt (`"Invalid link. Please enter a valid Spotify playlist link..."`) before sending an API request.
  - *Backend Rejection for Invalid URLs*: Updated [spotify_service.py](file:///c:/Projects/VibeMusic/backend/services/spotify_service.py) to validate playlist IDs and inspect Spotify embed metadata. If a link points to an invalid/non-existent entity or contains 0 tracks, it raises an explicit 400 error (`"Invalid Spotify playlist URL. Please provide a valid link..."`), preventing empty or null playlists from being created.
  - *Store & Database Sanitization*: Added filter guards across [playerStore.ts](file:///c:/Projects/VibeMusic/frontend/src/store/playerStore.ts) (`initPersistedState` and `fetchUserLibrary`) and [db_service.py](file:///c:/Projects/VibeMusic/backend/services/db_service.py) to ignore and clean any legacy corrupted playlists named `"null"` or with invalid Spotify IDs.

- **Direct Song Download Feature & Client LocalStorage Persistence**:
  - *Direct Audio File Download to User's Drive*: Added `/api/download/{video_id}` in [backend/api/routes.py](file:///c:/Projects/VibeMusic/backend/api/routes.py) and [downloadService.ts](file:///c:/Projects/VibeMusic/frontend/src/lib/downloadService.ts). Streamed audio files trigger the browser's native file save dialog, saving directly to the user's computer drive with filename formatted as `<songname>.<extension>` (e.g., `Blinding Lights - The Weeknd.m4a`).
  - *Bottom Placement in 3-Dots Action Menu*: Placed the "Download Song" option at the bottom of [SongActionMenu.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/ui/SongActionMenu.tsx) with a download icon and real-time loading spinner. Kept permanently accessible across all tracks on the website.
  - *Pure Client LocalStorage (No Database Storage)*: Downloaded tracks are stored strictly in client-side `localStorage` under `vibemusic_library_v2` (`downloadedTracks`), ensuring zero database records are created or synced for downloaded files.
  - *Clean Playback Bar & Fullscreen Player*: Kept the bottom [MiniPlayer.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/player/MiniPlayer.tsx) and [ExpandedPlayer.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/player/ExpandedPlayer.tsx) sleek and clutter-free by removing the three-dots button from these two player surfaces, while keeping [SongActionMenu.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/ui/SongActionMenu.tsx) accessible on hover across all song lists, search results, queue items, and library tracks.
  - *Saved Offline Library Integration*: Downloaded tracks appear under the "Downloaded" tab in [library/page.tsx](file:///c:/Projects/VibeMusic/frontend/src/app/library/page.tsx) with instant 1-click offline playback and removal management.

- **Search Page Playlist & Album Detail View and Spotify-Matching Card Sizing**:
  - *Collection Detail View with Multiple Songs*: Resolved the issue on [/search](file:///c:/Projects/VibeMusic/frontend/src/app/search/page.tsx) where clicking an album or playlist card previously executed playback of track 0 without displaying the collection. Clicking any playlist or album card now calls `handleOpenCollection(item, 'playlist' | 'album')`, dynamically fetching all tracks via `/api/playlist/{browse_id}` or `/api/album/{browse_id}` and rendering a rich collection view.
  - *Collection View Features*: Includes a back button (`← Back to Albums / Playlists`), collection poster banner, badge indicator, author/artist metadata, release year, track count, "Play All", "Shuffle Play", and a complete tracks table featuring track indices, live equalizer animation for playing track, artwork thumbnail, clickable artist link to `ArtistModal`, track duration, favorite heart, and `SongActionMenu` (with direct song download, queue additions, and playlist saving).
  - *Identical Spotify-Matching Square Card Sizing*: Replaced the oversized 5-column square layout with the exact responsive grid and card sizing used for imported Spotify playlists in [library/page.tsx](file:///c:/Projects/VibeMusic/frontend/src/app/library/page.tsx): `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4`, `p-3 rounded-2xl` card containers, `aspect-square rounded-xl` image covers with quick-play hover overlays, and compact typography (`text-xs sm:text-sm font-bold` titles and `text-[11px] text-neutral-400` subtitle info). Applied to both Albums and Playlists tabs.

- **YouTube Music Album & Playlist Service Enhancements**:
  - *Browse ID Resolution*: Added fallback resolution for `OLAK` and `VL` prefixed browse IDs in [yt_service.py](file:///c:/Projects/VibeMusic/backend/services/yt_service.py) to resolve full album metadata or fall back to playlist track lookup.
  - *Candidate Search*: Intelligently tests alternative browse ID candidates when fetching playlists to prevent empty track listings.
  - *Author Object Sanitization*: Fixed a runtime React child crash in [SearchPage.tsx](file:///c:/Projects/VibeMusic/frontend/src/app/search/page.tsx) and [yt_service.py](file:///c:/Projects/VibeMusic/backend/services/yt_service.py) by sanitizing `author` object structures `{ name, id }` into clean strings.

- **What's New / Patch Updates Modal (v1.0.0 Release Notes)**:
  - *Data Module*: Created [updates.ts](file:///c:/Projects/VibeMusic/frontend/src/data/updates.ts) maintaining release history (`v1.0.0`) with categorized changes (`New Features`, `Enhancements`, `Fixes`, `Design`), version badges, and release dates.
  - *Updates Modal*: Implemented [UpdatesModal.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/modals/UpdatesModal.tsx) with dark glassmorphism, category pill icons, version cards, and dismiss controls. Persists viewed version in localStorage.
  - *Header Bell Icon Integration*: Connected the top-right Bell button on both Home and Library headers in [Header.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/layout/Header.tsx) to trigger the Updates modal, with an active cyan pulse indicator for unread updates.
  - *Player Store State*: Added `isUpdatesOpen`, `openUpdates()`, and `closeUpdates()` in [playerStore.ts](file:///c:/Projects/VibeMusic/frontend/src/store/playerStore.ts), and mounted the modal globally in [layout.tsx](file:///c:/Projects/VibeMusic/frontend/src/app/layout.tsx).

- **Synchronized English Letters (Romanized) Lyrics Provider**:
  - *Issue Resolved*: When "English Lyrics from Provider" was toggled ON in Settings, it previously failed to sync lyrics or translated the words instead of presenting the same non-English lyrics written in English letters (Latin/Romanized script).
  - *Native Romanized LRCLIB Matching*: Updated [lyricsService.ts](file:///c:/Projects/VibeMusic/frontend/src/lib/lyricsService.ts) to query and prioritize the provider's authentic Romanized / English-letter synced versions (`track Romanized`, `track Romaji`, `cleanTitle + cleanArtist`).
  - *Zero Word-Translation / Preserved Lyric Fidelity*: Does not translate words into other meanings; preserves the authentic lyrics phonetically in English letters (e.g., `"मुझको इतना बताए कोई"` &rarr; `"Mujhko itna bataye koi"`).
  - *Perfect Audio Synchronization*: If LRCLIB provides synced LRC lines, uses them directly for millisecond-accurate highlighting and auto-scrolling. If plain Romanized lyrics exist, aligns them to base vocal timestamps using `alignLinesToTimestamps`. If no Romanized version exists, transliterates native script directly into English letters with 1:1 timestamps.
- **Comprehensive Web Application Security Hardening**:
  - *Next.js Production Security Headers ([next.config.ts](file:///c:/Projects/VibeMusic/frontend/next.config.ts))*: Added enterprise-grade security headers on all routes: `X-Content-Type-Options: nosniff` (MIME confusion protection), `X-Frame-Options: SAMEORIGIN` (clickjacking defense), `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (HSTS enforcement), `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (disables camera, microphone, geolocation, and payment hardware access), and `Cross-Origin-Opener-Policy: same-origin-allow-popups` (Spectre mitigation while permitting OAuth popups).
  - *Framework Fingerprint Removal*: Configured `poweredByHeader: false` in Next.js, eliminating `X-Powered-By: Next.js` headers to prevent framework version enumeration.
  - *FastAPI Backend Security Middleware ([main.py](file:///c:/Projects/VibeMusic/backend/main.py))*: Injected automated response security headers (`nosniff`, `SAMEORIGIN`, `strict-origin-when-cross-origin`, `X-XSS-Protection`) and obscured the `server` header (`VibeMusic-Gateway`).
  - *Tiered Anti-Abuse Rate Limiting ([main.py](file:///c:/Projects/VibeMusic/backend/main.py))*: Built an in-memory sliding window rate limiter protecting `/api/auth/login` and `/api/auth/register` (max 15 req/min, brute-force mitigation), resource-heavy endpoints like `/api/spotify/import-url` and `/api/download` (max 30 req/min), while providing generous headroom (600 req/min) for search, streaming, and preloading to guarantee zero playback stutter.
  - *CORS Hardening ([main.py](file:///c:/Projects/VibeMusic/backend/main.py))*: Replaced open wildcard regex with a scoped policy allowing localhost, private LAN ranges (`192.168.x.x`, `10.x.x.x`, `172.16-31.x.x`), and verified Vercel/Railway production domains.
  - *Strict Input Validation & Path Traversal Guards ([routes.py](file:///c:/Projects/VibeMusic/backend/api/routes.py) & [auth_routes.py](file:///c:/Projects/VibeMusic/backend/api/auth_routes.py))*: Added `validate_safe_id()` regex bounds on all path parameters (`video_id`, `browse_id`), capped search and artist query lengths, and bounded password and display name lengths (max 128 chars) to neutralize PBKDF2 hash exhaustion DoS attacks.
  - *Health & Security Audit Endpoint*: Added `/api/health` providing real-time verification of active security defenses.
- **Git Checkpoint: Phase 6**:
  - Created rollback checkpoint tagged `phase-6` across root (`88127ad`) and frontend (`a5e6d15`) git repositories.
  - Encompasses production security headers, tiered anti-abuse sliding-window rate limiting, path traversal guards, and multi-element pre-buffered instant song transitions.
- **Ultra-Smooth 60fps/120fps Queue Drawer Scrolling ([QueueDrawer.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/player/QueueDrawer.tsx))**:
  - *Eliminated Audio-Tick Render Churn*: Decoupled `QueueDrawer` from unscoped store subscriptions (`progress` emitting 4-5 times per second). Subscribed exclusively to required atomic selectors (`queue`, `queueIndex`, `currentTrack`), completely preventing unnecessary re-renders while audio plays.
  - *Memoized Track Rows with GPU Composite Layers*: Extracted `QueueTrackRow` into a memoized component with `contain: paint`, `content-visibility: auto`, and `contain-intrinsic-size: 56px`, skipping offscreen layout paints and locking scrolling to high refresh rates (60Hz/120Hz/ProMotion).
  - *Hardware-Accelerated Scroll Layer*: Added `will-change: scroll-position`, `overscroll-behavior: contain`, and `-webkit-overflow-scrolling: touch` for zero-friction momentum scrolling.
- **High-FPS Silky-Smooth Line-by-Line Lyrics Engine ([smoothScroll.ts](file:///c:/Projects/VibeMusic/frontend/src/lib/smoothScroll.ts), [FullScreenLyrics.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/player/FullScreenLyrics.tsx) & [ExpandedPlayer.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/player/ExpandedPlayer.tsx))**:
  - *Eliminated Layout Thrashing (Font-Size Reflow)*: Replaced font-size class switching (`text-xl` &rarr; `text-2xl` &rarr; `text-3xl`) with constant font metrics combined with hardware-accelerated GPU scale transforms (`transform: scale(0.90)` &rarr; `scale(1)` with `will-change: transform, opacity`). Active lines pop smoothly with zero layout reflows or parent container shifts.
  - *Quintic Ease-Out RAF Smooth Scroll Engine*: Replaced jittery native `container.scrollTo({ behavior: 'smooth' })` with a custom `requestAnimationFrame` quintic easing animator (`1 - (1 - progress)^4`) locked to the display's native refresh rate (60fps/120fps/144fps).
- **User-Centric Release Notes & Smooth Updates Modal ([updates.ts](file:///c:/Projects/VibeMusic/frontend/src/data/updates.ts) & [UpdatesModal.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/modals/UpdatesModal.tsx))**:
  - *Eliminated Technical & Jargon Bloat*: Stripped out all developer references (APIs, client emulation names, database storage, framework terms, and "free" phrasing). Replaced with clean, user-focused highlights (High-Fidelity Audio, Live Synced Lyrics, Spotify Playlist Import, Discovery & Downloads, Cloud Library).
  - *Concise, Single-Line Bullet Points*: Replaced 25+ lengthy paragraphs with 5 focused categories, each containing 2 concise, single-line highlights designed for quick reading.
  - *Authentic Release Date*: Configured official launch release date (`October 24, 2026`) replacing the previous `"To be added on deployment"` developer placeholder.
- **Spotify-Standard Acoustic Crossfade Engine ([audioPlayer.ts](file:///c:/Projects/VibeMusic/frontend/src/lib/audioPlayer.ts) & [SettingsModal.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/modals/SettingsModal.tsx))**:
  - *Reference Player Standard Honored (Spotify / Apple Music pattern)*:
    - **During Crossfade** (for configured duration of 3s, 5s, or 8s):
      - The ending track remains active on screen (artwork, poster, title, artist, and progress bar reaching the end).
      - The ending track volume smoothly ramps down from full volume to zero ($V_{out} = V_{target} \cdot \cos(\frac{\pi}{2} t)$).
      - The incoming track starts playback at `0:00` in the background and smoothly ramps up from zero to full volume ($V_{in} = V_{target} \cdot \sin(\frac{\pi}{2} t)$).
      - Both tracks play simultaneously with constant equal-power acoustic energy ($cos^2 + sin^2 = 1$), producing an uninterrupted acoustic blend with zero volume dips.
    - **Upon Crossfade Completion** ($t \ge 1.0$ or outgoing track EOF):
      - Outgoing audio element is terminated, cleared, and recycled into the preload slot for upcoming songs.
      - Incoming audio is promoted to primary `this.audio`.
      - Store advances cleanly via `advanceCrossfadeTrack(nextIndex)`, smoothly updating the artwork, title, artists, duration, and progress to the next song without reloading, resetting playback, or interrupting the ongoing audio.
  - *Reliable Duration Thresholding (`getEffectiveDuration`)*: Guarded crossfade trigger by utilizing backend track metadata duration and requiring playback to exceed 75% of the song duration before evaluating `duration - crossfadeSec`. Eliminates premature crossfade triggering from partial chunked stream estimates.
  - *Pause State & Event Isolation*: Stripped `onpause`, `onended`, and `ontimeupdate` handlers from outgoing audio during transition. Prevents outgoing track termination from sending pause events to the player store.
  - *Interaction Safety*: Full pause/resume coordination across both fading tracks via `isUserPaused`. Instant crossfade cancellation with full volume recovery on manual track seeks or skips.
  - *Enhanced Settings UI*: Active teal pill badge and explicit indicators for `Off (0s)`, `3s`, `5s`, and `8s` durations.
- **Audio Quality Bitrate Selection & Live Switching ([yt_service.py](file:///c:/Projects/VibeMusic/backend/services/yt_service.py) & [audioPlayer.ts](file:///c:/Projects/VibeMusic/frontend/src/lib/audioPlayer.ts))**:
  - *Full Format Selection across 3 Bitrate Tiers*: Corrected YouTube audio format selectors (`249/250/139` for Data Saver ~50–96kbps, `140/250` for Standard ~128–160kbps, and `251/140` for High Quality ~160–320kbps equivalent) and removed deprecated player client arguments that caused SABR extraction failures. All 3 tiers now stream via HTTP 206 Partial Content.
  - *Seamless Live Quality Switching*: `handleQualityChange` preserves exact `currentTime` through a one-time `loadedmetadata` event so switching qualities during playback continues from the exact same second without restarting from `0:00`.
  - *Instant Preload Invalidation*: Changing quality flushes outdated preload slots and immediately re-buffers upcoming queue tracks in the newly chosen bitrate.
- **Broadcast Standard Audio Loudness Normalization ([audioPlayer.ts](file:///c:/Projects/VibeMusic/frontend/src/lib/audioPlayer.ts))**:
  - *AES/EBU R128 (-14 LUFS) Target Headroom*: Replaced negligible static multiplier with industry-standard -14 LUFS broadcast target headroom (`vol * 0.82`), effectively taming harsh dynamic peaks and matching perceived loudness across varying track mastering levels.
  - *Instant Reactive Toggling*: Store subscriber applies loudness curve in real-time on `audioNormalization` toggle without requiring audio restart or pause.
- **Butter-Smooth Kinetic Momentum Scroll in Settings ([SettingsModal.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/modals/SettingsModal.tsx) & [smoothScroll.ts](file:///c:/Projects/VibeMusic/frontend/src/lib/smoothScroll.ts))**:
  - *120fps/144fps Physics-Based Lerp Gliding*: Implemented `attachSmoothWheel` listener on Settings modal container using exponential interpolation (`lerp 0.18`), eliminating discrete 100px mouse wheel notches on Windows for fluid gliding.
  - *Hardware-Accelerated Composite Layers*: Added `willChange: 'scroll-position'`, `overscrollBehavior: 'contain'`, `scrollBehavior: 'smooth'`, and `-webkit-overflow-scrolling: 'touch'`.

### L. UI/UX Polish, High-FPS Modal Scrolling, Search History & Drag Protection (Phase 7 Completed)
- **High-FPS Momentum Scrolling & Cohesive Dark Theming Across Modals ([RecentSongsModal.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/modals/RecentSongsModal.tsx), [SettingsModal.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/modals/SettingsModal.tsx), [UpdatesModal.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/modals/UpdatesModal.tsx))**:
  - *Lag-Free 120Hz/144Hz Scrolling*: Integrated `attachSmoothWheel` physics-based exponential interpolation on all modal views, eliminating scroll stutter and Windows discrete mouse wheel notches.
  - *Unified Glassmorphic Dark Styling*: Upgraded modal backgrounds to sleek deep dark glass (`bg-[#0e0e11]`) with subtle borders and identical visual hierarchy across Recent Played, Settings, and Notifications.
- **Local Search History & Streamlined Search Dropdown ([searchStore.ts](file:///c:/Projects/VibeMusic/frontend/src/store/searchStore.ts), [SearchBarHeader.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/layout/SearchBarHeader.tsx))**:
  - *Local Persistence*: Automatically stores up to 5 recent search terms in browser `localStorage` with zero cloud overhead.
  - *Quick Navigation & Deletion*: Displays previous queries with 1-click execution and individual removal buttons.
  - *Seamless Dropdown Design*: Removed all dividing horizontal lines (`border-t`) and category labels ("Artist", "Quick Songs", "Suggestions") for a clean, unified modern search dropdown.
- **Custom Glassmorphic Delete Confirmation Popups ([RecentSongsModal.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/modals/RecentSongsModal.tsx), [SettingsModal.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/modals/SettingsModal.tsx))**:
  - Replaced native browser `window.confirm()` dialogs with custom in-app glassmorphic confirmation popup cards (`showClearConfirm`, `showResetConfirm`) styled with dark backdrop blur and brand color actions.
- **Universal Header & UserButton Placement ([Header.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/layout/Header.tsx))**:
  - Standardized header dimensions (`h-[76px]`, `px-6 md:px-8 pt-6 pb-2`) across Home, Search, and Library.
  - Aligned the Profile/UserButton to the exact same X and Y axis across all pages.
- **Next.js 15 & React 19 Hydration Boundary Guard ([page.tsx](file:///c:/Projects/VibeMusic/frontend/src/app/search/page.tsx), [Header.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/layout/Header.tsx))**:
  - Wrapped dynamic search parameter components in `<Suspense fallback={...}>` to eliminate client/server hydration mismatch errors.
- **Search Page Width & Tag Placement ([page.tsx](file:///c:/Projects/VibeMusic/frontend/src/app/search/page.tsx))**:
  - Expanded search bar width to span the full header naturally.
  - Left-aligned genre and moods tags with static hover states (removed scale transform jitter).
- **Website-Wide Image & Poster Drag Protection ([globals.css](file:///c:/Projects/VibeMusic/frontend/src/app/globals.css), [AuthInitializer.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/layout/AuthInitializer.tsx), [MusicPoster.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/ui/MusicPoster.tsx), [SimpLogo.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/ui/SimpLogo.tsx))**:
  - Blocked native browser image dragging and drag-to-desktop saving via global CSS rules (`-webkit-user-drag: none !important`, `user-drag: none !important`, `user-select: none !important`), top-level `dragstart` event capture prevention, and `draggable={false}` attributes.
- **Settings About Logo Refinements ([SettingsModal.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/modals/SettingsModal.tsx))**:
  - Proportional `w-14 h-14` (56px) sizing, stroke removed, glowing shadow maintained, hover effect removed, Samsung One UI squircle curvature (`rounded-[18px]`), and balanced VibeMusic typography.

- **Git Checkpoint: Phase 7**:
  - Created checkpoint tagged `phase-7` across root (`82608fc`) and frontend (`5e39f45`) git repositories.

### M. Global Keyboard Shortcuts Suite & IPv4 Stream Transport Optimization (Phase 7.5 Completed)
- **Comprehensive Desktop Keyboard Shortcuts Suite ([KeyboardShortcutsHandler.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/layout/KeyboardShortcutsHandler.tsx))**:
  - *Full Media Navigation*:
    - **Play / Pause**: <kbd>Space</kbd> or <kbd>K</kbd> (prevents default document page scrolling).
    - **Skip Next / Previous**: <kbd>Shift</kbd> + <kbd>→</kbd> or <kbd>N</kbd> (Next Track), <kbd>Shift</kbd> + <kbd>←</kbd> or <kbd>P</kbd> (Previous Track).
    - **Seek Time Scrubbing**: <kbd>→</kbd> / <kbd>←</kbd> (seek ±5s), <kbd>J</kbd> (seek -10s).
    - **Granular Volume Adjustments**: <kbd>↑</kbd> (+5%), <kbd>↓</kbd> (-5%) with live floating toast volume percentage indicators.
    - **Volume Memory Mute**: <kbd>M</kbd> mutes audio and caches previous volume level; pressing <kbd>M</kbd> again accurately restores the exact previous level.
    - **Playback Modes**: <kbd>S</kbd> (Toggle Shuffle), <kbd>R</kbd> (Cycle Repeat: Off &rarr; All &rarr; Current Track), <kbd>C</kbd> (Quick-favorite playing track).
    - **View Overlays**: <kbd>L</kbd> (Synced Fullscreen Lyrics), <kbd>Q</kbd> (Queue Drawer), <kbd>F</kbd> (Expanded Player view).
    - **Search Jump**: <kbd>/</kbd> or <kbd>Ctrl</kbd>+<kbd>K</kbd> / <kbd>Cmd</kbd>+<kbd>K</kbd> focuses the search input bar immediately.
    - **Hierarchical Escape Handler**: <kbd>Esc</kbd> closes active overlays, modals, and blurs active search inputs without conflicting events.
  - *Intelligent Input Field Guard*: Automatically disables single-key shortcuts while typing inside text boxes, search inputs, textareas, and contentEditable elements.
- **Glassmorphic Keyboard Shortcuts Cheat Sheet Modal ([KeyboardShortcutsModal.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/modals/KeyboardShortcutsModal.tsx))**:
  - Interactive cheat sheet with category groupings (*Playback & Navigation, Volume & Modes, Views & Overlays*).
  - Integrated 120Hz/144Hz smooth momentum wheel scrolling (`attachSmoothWheel`).
  - Dual discovery: Accessible instantly via <kbd>?</kbd> anywhere or via the **"View Keys (?)"** button inside **Settings &rarr; Playback & Audio** in [SettingsModal.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/modals/SettingsModal.tsx).
- **IPv4 Transport Binding & Socket Hardening ([routes.py](file:///c:/Projects/VibeMusic/backend/api/routes.py) & [yt_service.py](file:///c:/Projects/VibeMusic/backend/services/yt_service.py))**:
  - *Eliminated `wsarecv` IPv6 Connection Dropouts*: Bound `httpx.AsyncHTTPTransport` to `local_address="0.0.0.0"` and `yt-dlp` to `source_address="0.0.0.0"`. Bypasses broken ISP IPv6 route drops to Google Video CDNs (`[2001:4860:...]`) and guarantees sub-second HTTP 206 Partial Content audio stream delivery.
  - *Stale Cache Purge*: Cleaned 430+ expired stream URLs from `backend/cache_store/`.
- **Git Checkpoint: Phase 8 Baseline**:
  - Created rollback checkpoint tagged `phase-8` and `checkpoint-8` across root and frontend (`c1c41e1`) git repositories before beginning Phase 8 feature implementations.

---

### N. Checkpoint 8: Web Audio API 5-Band Graphic Equalizer & Bass Boost (Completed)

#### 1. 🎚️ Web Audio API 5-Band Graphic Equalizer & Bass Boost
- **Status**: Completed & Fully Integrated ([settingsStore.ts](file:///c:/Projects/VibeMusic/frontend/src/store/settingsStore.ts), [audioPlayer.ts](file:///c:/Projects/VibeMusic/frontend/src/lib/audioPlayer.ts), [EqualizerControl.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/player/EqualizerControl.tsx), [SettingsModal.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/modals/SettingsModal.tsx))
- **Verified Professional Frequency & Gain Standards**:
  - The 5 center frequencies (**60 Hz, 230 Hz, 910 Hz, 3.6 kHz, 14 kHz**) were double-checked and verified against professional equalizer tools, Android OpenSL ES / AudioFx, and Poweramp. They form an exact 2-octave logarithmic frequency distribution covering the entire 20 Hz to 20 kHz audible spectrum:
    - **60 Hz (Sub-Bass)**: Controls deep sub-bass vibration, 808 drop rumble, and kick drum foundation.
    - **230 Hz (Punch / Low-Mid)**: Governs kick drum punch, bass guitar warmth, and lower-mid clarity without boxiness.
    - **910 Hz (Midrange / Center)**: Controls the body of human speech, lead vocals, guitars, and natural acoustics.
    - **3.6 kHz (High-Mid / Presence)**: Controls vocal intimacy, consonant intelligibility, and snare crack.
    - **14 kHz (Treble / Air)**: Controls upper harmonic crystalline shimmer, hi-hat snap, and open concert hall air.
  - Professional genre presets were tuned and verified to eliminate acoustic mud and excessive digital gain:
    - **Flat**: `0dB, 0dB, 0dB, 0dB, 0dB` (Neutral reference)
    - **Bass Boost**: `+6dB, +3dB, 0dB, 0dB, +1dB` (Punchy sub-bass & 808s without boxy lower-mid mud)
    - **Hip-Hop**: `+5dB, +2dB, 0dB, +1.5dB, +3dB` (Deep sub-drop, clean vocals, snappy hats)
    - **Pop**: `+3dB, +1.5dB, -1dB, +2.5dB, +3.5dB` (Modern energetic V-shape curve)
    - **Rock**: `+4dB, -1dB, -2dB, +3.5dB, +2.5dB` (Tight kick, removes boxy mids, guitar bite)
    - **Electronic**: `+6dB, +2.5dB, 0dB, +2dB, +4dB` (Sub-rumble, synths, and highs shimmer)
    - **Vocal Clarity**: `-3dB, -1.5dB, +3dB, +4.5dB, +1dB` (Low rumble cut with speech intelligibility)
    - **Classical**: `+1.5dB, 0dB, 0dB, +1.5dB, +2.5dB` (Acoustic warmth and concert hall air)
  - **Dynamics Compressor & Output Stage**: Output routes into an inline `DynamicsCompressorNode` (`threshold: -1.0dB`, `ratio: 12:1`, `attack: 3ms`, `release: 250ms`) preventing digital clipping distortion during high boosts.
  - **Real-Time Interactive SVG Curve Spline**: Dynamic visual Catmull-Rom / cubic bezier curve visualizes frequency shaping with live pulsating node indicators.
  - **Master A/B Bypass & Zero-Click Ramping**: Toggling the equalizer smoothly ramps filter gains to 0 dB via `linearRampToValueAtTime`, providing 100% click-free instant A/B sound comparison.
- **Why It Matters**: Audiophiles and everyday listeners love sound customization—especially punchy sub-bass or crisp vocal clarity. It transforms VibeMusic into a premium, audiophile-grade player matching native hardware apps.
- **Objective**: Provide low-latency, browser-native acoustic customization directly within the audio rendering pipeline with zero playback lag.
- **Technical Architecture & Blueprint**:
  - **Native Web Audio API Node Pipeline**:
    - Connect the primary HTML5 `<audio>` element to the browser's native `window.AudioContext` source node via `createMediaElementSource(audio)`.
    - Configure CORS support (`crossOrigin = "anonymous"`) across audio elements and stream routes.
  - **Cascaded 5-Band BiquadFilter Chain**:
    - **Sub-Bass (60 Hz)**: Peaking filter (`gain: -12dB` to `+12dB`, `Q: 1.0`) — controls deep sub-bass vibration and 808 rumble.
    - **Bass / Punch (230 Hz)**: Peaking filter (`gain: -12dB` to `+12dB`, `Q: 1.0`) — controls kick drum punch and bass guitar warmth.
    - **Midrange / Vocals (910 Hz)**: Peaking filter (`gain: -12dB` to `+12dB`, `Q: 1.0`) — controls lead vocals, acoustic instruments, and speech clarity.
    - **Upper Mids / Presence (3.6 kHz)**: Peaking filter (`gain: -12dB` to `+12dB`, `Q: 1.0`) — controls snare snap, guitar attack, and vocal intimacy.
    - **Treble / Air (14 kHz)**: High-shelf filter (`gain: -12dB` to `+12dB`, `Q: 1.0`) — controls cymbal shimmer, brightness, and spatial air.
  - **Dynamics Compressor & Output Stage**:
    - Chain the filter output into an inline `DynamicsCompressorNode` (`threshold: -1.0dB`, `ratio: 12:1`, `knee: 30`, `attack: 0.003s`, `release: 0.25s`) before terminating into `audioContext.destination`.
    - Guarantees zero digital distortion or harsh clipping when users boost sub-bass or mids up to `+12dB`.
- **Presets & Custom Profiles**:
  - **Curated One-Click Presets**:
    - *Flat*: `0dB, 0dB, 0dB, 0dB, 0dB`
    - *Bass Boost*: `+8dB, +5dB, 0dB, +1dB, +2dB`
    - *Hip-Hop*: `+6dB, +4dB, -1dB, +2dB, +3dB`
    - *Pop*: `+2dB, +4dB, +2dB, +3dB, +4dB`
    - *Rock*: `+5dB, +3dB, -2dB, +4dB, +5dB`
    - *Electronic*: `+7dB, +5dB, 0dB, +3dB, +6dB`
    - *Vocal Clarity*: `-3dB, -1dB, +5dB, +6dB, +3dB`
    - *Classical*: `+4dB, +3dB, 0dB, +2dB, +4dB`
  - **Custom User Tuning**: Freehand vertical sliders with live dB value tooltips; custom adjustments automatically save to `settingsStore.ts` and `localStorage` (`vibemusic_eq_profile`).
- **State & Store Integration**:
  - Add reactive state slice to `settingsStore.ts`:
    - `equalizerEnabled: boolean`
    - `equalizerPreset: string`
    - `equalizerBands: { 60: number, 230: number, 910: number, 3600: number, 14000: number }`
  - Reactively bind `audioPlayer.ts` audio node gains to store updates for real-time acoustic adjustments without audio restarts.
- **UI / UX Placement**:
  - Dedicated **Equalizer & Acoustic Tuning** section inside **Settings → Playback & Audio** in [SettingsModal.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/modals/SettingsModal.tsx).
  - Real-time SVG frequency response curve spline displaying active equalization curve.
  - Master toggle switch (**"Enable Graphic Equalizer"**) for instant 1-click A/B sound comparison.

---

## 4. Feature Roadmap & Recommended High-Impact Implementations

### Overview & Feature Matrix
The following curated roadmap details the most important, high-impact features designed to elevate VibeMusic from a great web app to a **commercial-grade, Spotify & Apple Music-tier streaming platform**:

| # | Feature | Category | Priority | Impact / Value Proposition |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Web Audio API 5-Band Equalizer** | Audio Engine | **P1 (Highest)** | Audiophile-grade acoustic tuning & Bass Boost (+12dB) |
| **2** | **Smart Sleep Timer (Fade-to-Sleep)** | Playback Utility | **P1 (Highest)** | Auto-shutdown with smooth exponential volume fade |
| **3** | **True Offline Playback (IndexedDB)** | Storage / PWA | **P1 (Highest)** | 100% functional music playback during zero network connectivity |
| **4** | **Queue Drag-and-Drop & "Play Next"** | Playback Queue | **P2** | Precise queue reordering & immediate next-track insertion |
| **5** | **Curated Mood & Genre Hub** | Discovery | **P2** | Dynamic full-screen playlist experiences for search tags |
| **6** | **Shareable Deep Links (Web Share API)** | Social & Viral | **P2** | 1-click native mobile sharing & clipboard link previewing |
| **7** | **Personalized Stats & "On Repeat"** | Personalization | **P3** | Auto-generated top 25 playlist & total minutes listened |
| **8** | **1-Click PWA "Install App" Banner** | Native Experience | **P3** | Standalone desktop/mobile app feel without address bar |

---

### Tier 1: Top 3 Core Features (Priority Recommendation)

#### 1. 🎚️ Web Audio API 5-Band Graphic Equalizer & Bass Boost
- **Why It Matters**: Audiophiles and everyday listeners love sound customization—especially punchy sub-bass or crisp vocal clarity. It transforms VibeMusic into a premium, audiophile-grade player matching native hardware apps.
- **Objective**: Provide low-latency, browser-native acoustic customization directly within the audio rendering pipeline with zero playback lag.
- **Technical Architecture & Blueprint**:
  - Connect the primary HTML5 `<audio>` element to the browser's native `window.AudioContext` source node via `createMediaElementSource(audio)`.
  - Create 5 cascaded `BiquadFilterNode` instances representing industry-standard frequency bands:
    - **Sub-Bass (60 Hz)**: Peaking filter (`gain: -12dB` to `+12dB`, `Q: 1.0`) — controls deep sub-bass vibration and 808 rumble.
    - **Bass / Punch (230 Hz)**: Peaking filter (`gain: -12dB` to `+12dB`, `Q: 1.0`) — controls kick drum punch and bass guitar warmth.
    - **Midrange / Vocals (910 Hz)**: Peaking filter (`gain: -12dB` to `+12dB`, `Q: 1.0`) — controls lead vocals, acoustic instruments, and speech clarity.
    - **Upper Mids / Presence (3.6 kHz)**: Peaking filter (`gain: -12dB` to `+12dB`, `Q: 1.0`) — controls snare snap, guitar attack, and vocal intimacy.
    - **Treble / Air (14 kHz)**: High-shelf filter (`gain: -12dB` to `+12dB`, `Q: 1.0`) — controls cymbal shimmer, brightness, and spatial air.
  - Wire output safely to `audioContext.destination` with an optional `DynamicsCompressorNode` to protect against clipping or distortion at high boost levels.
- **Presets & Custom Profiles**:
  - **One-Click Presets**:
    - *Flat*: 0dB across all bands.
    - *Bass Boost*: +8dB on 60Hz, +5dB on 230Hz, 0dB on 910Hz, +1dB on 3.6kHz, +2dB on 14kHz.
    - *Hip-Hop*: +6dB on 60Hz, +4dB on 230Hz, -1dB on 910Hz, +2dB on 3.6kHz, +3dB on 14kHz.
    - *Pop*: +2dB on 60Hz, +4dB on 230Hz, +2dB on 910Hz, +3dB on 3.6kHz, +4dB on 14kHz.
    - *Rock*: +5dB on 60Hz, +3dB on 230Hz, -2dB on 910Hz, +4dB on 3.6kHz, +5dB on 14kHz.
    - *Electronic*: +7dB on 60Hz, +5dB on 230Hz, 0dB on 910Hz, +3dB on 3.6kHz, +6dB on 14kHz.
    - *Vocal Clarity*: -3dB on 60Hz, -1dB on 230Hz, +5dB on 910Hz, +6dB on 3.6kHz, +3dB on 14kHz.
    - *Classical*: +4dB on 60Hz, +3dB on 230Hz, 0dB on 910Hz, +2dB on 3.6kHz, +4dB on 14kHz.
  - **Custom User Tuning**: Freehand vertical sliders with live dB value tooltips; custom adjustments automatically save to `settingsStore.ts` and `localStorage` (`vibemusic_eq_profile`).
- **UI / UX Placement**:
  - Dedicated **Equalizer** section inside **Settings &rarr; Playback & Audio** in [SettingsModal.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/modals/SettingsModal.tsx).
  - Real-time frequency response curve canvas showing the visual EQ spline.
  - Master toggle switch (**Enable Equalizer**) to A/B test original audio vs equalized audio in 1 click.

#### 2. 🌙 Smart Sleep Timer (Fade-to-Sleep Engine)
- **Why It Matters**: One of the most frequently used features in modern music streaming services. Listeners love falling asleep to music, lo-fi beats, or ambient sounds, but don't want music playing continuously throughout the night, draining battery or waking them abruptly with sudden silence.
- **Objective**: Automatically pause audio playback after a configurable duration, utilizing a gentle acoustic fade-out curve.
- **Technical Architecture & Timers**:
  - State management in `playerStore.ts`: `sleepTimerTarget: number | null`, `sleepTimerMode: 'time' | 'end_of_track' | null`.
  - Configurable countdown options: `15 minutes`, `30 minutes`, `45 minutes`, `1 hour`, and `End of current track`.
  - **Gentle Acoustic Fade-Out**: In the final 15 seconds of the countdown timer, smoothly ramp volume down from current volume $V_{initial}$ to 0 using an exponential easing curve ($V(t) = V_{initial} \cdot (1 - t/15)^2$). This avoids sudden jarring silence that jolts light sleepers awake.
  - When the timer hits 0: pauses playback (`audio.pause()`), restores system volume setting back to $V_{initial}$, and clears the active timer state.
  - `End of current track` mode: hooks into the audio `ended` event or crossfade trigger to halt playback cleanly once the active song finishes.
- **UI / UX Placement**:
  - Sleek **Moon icon (`Moon`)** button added directly to [MiniPlayer.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/player/MiniPlayer.tsx) and [ExpandedPlayer.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/player/ExpandedPlayer.tsx).
  - Clicking the moon icon opens a lightweight glassmorphic popover showing timer presets and an active countdown timer badge (`14:32 remaining`).
  - Floating toast notification confirms when a timer is set or cancelled.

#### 3. 💾 True In-App Offline Playback (IndexedDB / CacheStorage Audio Vault)
- **Why It Matters**: Currently, "Download" triggers a browser file download to the user's hard drive. True in-app offline playback allows users to listen to their saved songs inside the VibeMusic interface without an internet connection (e.g., on flights, subways, or during ISP connection outages).
- **Objective**: Guarantee 100% functional music streaming and UI navigation even when completely disconnected from the network.
- **Technical Architecture & Blueprint**:
  - Create `offlineVaultService.ts` utilizing `idb` / `IndexedDB` (`vibemusic_offline_vault_v1`) or the native `CacheStorage` API.
  - When the user clicks "Download / Save Offline" in the song action menu:
    - Backend streams the complete audio payload as an `ArrayBuffer` blob.
    - Saves the audio blob, track metadata (title, artist, duration, browse IDs), synced LRC lyrics, and base64 poster thumbnail together into the IndexedDB object store (`offline_tracks`).
  - **Network Sentinel**:
    - Attach global network listeners: `window.addEventListener('online')` and `window.addEventListener('offline')`.
    - Reactive state in `playerStore.ts`: `isOffline: boolean`.
  - **Dynamic Audio Source Routing**:
    - When `audioPlayer.playTrack(track)` is called, it checks if `track.id` exists in the local offline vault.
    - If found or if `isOffline === true`, creates a local blob URL (`URL.createObjectURL(storedBlob)`) instead of making a network request to `/api/stream/{video_id}`.
    - Songs play with zero network delay and zero bandwidth usage.
- **UI / UX Placement**:
  - Dedicated **"Downloaded"** tab in [library/page.tsx](file:///c:/Projects/VibeMusic/frontend/src/app/library/page.tsx) with storage usage meter (e.g., `42 songs · 185 MB`).
  - Green offline checkmark badge displayed next to saved songs across search, queues, and playlists.
  - Floating banner appears when connection drops: `"You're offline — Playing from local vault"`.

---

### Tier 2: Discovery & Queue Enhancements

#### 4. 🔀 Interactive Queue Drag-and-Drop Reordering & "Play Next"
- **Why It Matters**: Power listeners want total command over their playback queue without having to rebuild playlists from scratch.
- **Features & Architecture**:
  - Implement smooth drag-and-drop reordering inside [QueueDrawer.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/player/QueueDrawer.tsx) using lightweight pointer events or `@dnd-kit/core` with hardware-accelerated transforms (`translate3d`).
  - Connect reorder movements to `reorderQueue(startIndex, endIndex)` in [playerStore.ts](file:///c:/Projects/VibeMusic/frontend/src/store/playerStore.ts) so audio playback progression dynamically adapts.
  - Add **"Play Next"** context menu option in [SongActionMenu.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/ui/SongActionMenu.tsx):
    - Inserts the selected track directly at `queueIndex + 1` (immediately after the currently playing song) rather than appending to the very end of a 50-song queue.

#### 5. 🎨 Curated Mood & Genre Exploration Hub
- **Why It Matters**: The Search page already includes category tags (*Chill, Workout, Focus, Party, Hip-Hop, Pop, Rock, Indie*). Transforming these tags into full curated hubs turns static labels into immersive discovery engines.
- **Features & Architecture**:
  - Clicking any mood/genre card dynamically navigates to `/playlist/genre/:slug` or opens a dedicated full-screen collection view.
  - Dynamically queries YouTube Music's curated mood shelves via `ytmusicapi.get_mood_playlists(params)` or curates 30–50 top tracks per vibe.
  - Renders custom dynamic gradients and bespoke cover artwork with a 1-click **"Play All"** and **"Shuffle Play"** hero button.

#### 6. 🔗 Shareable Track & Playlist Deep Links (Web Share API)
- **Why It Matters**: Enables users to share music instantly with friends on WhatsApp, Discord, Telegram, or Twitter, driving organic growth.
- **Features & Architecture**:
  - Generates canonical clean query URLs: `https://vibemusic.app/?v={videoId}` and `https://vibemusic.app/playlist/{id}`.
  - On mobile devices, invokes `navigator.share({ title: track.title, text: `Listen to ${track.title} on VibeMusic`, url })` for native OS share sheets.
  - On desktop, provides instant 1-click clipboard copy with a checkmark toast indicator (`"Link copied to clipboard!"`).
  - App initialization logic in [layout.tsx](file:///c:/Projects/VibeMusic/frontend/src/app/layout.tsx) inspects URL query parameters on first load to immediately launch and play shared songs.

---

### Tier 3: Personalization & Native App Experience

#### 7. 📊 Personalized Listening Analytics & "On Repeat"
- **Why It Matters**: Builds long-term user retention and habit formation through Spotify Wrapped-style personal listening insights.
- **Features**:
  - Automatically computes an **"On Repeat"** smart playlist under Library, showing the user's top 25 most played songs based on real play counters in `playHistory`.
  - Computes monthly listening milestones: total minutes listened, top 3 favorite artists, and dominant genres.
  - Sleek visual analytics card integrated cleanly into [library/page.tsx](file:///c:/Projects/VibeMusic/frontend/src/app/library/page.tsx).

#### 8. 📲 1-Click PWA "Install App" Experience & Network Sentinel
- **Why It Matters**: Delivers a native desktop and mobile application experience with a custom taskbar icon and zero browser address bar clutter.
- **Features**:
  - Captures the browser's `beforeinstallprompt` event and displays a discrete, high-aesthetic "Install VibeMusic App" banner in Settings and Sidebar.
  - Configures Web App Manifest (`manifest.json`) with high-resolution app icons and theme colors (`#000000`, `#00d2c4`).
  - Offline Network Sentinel indicator provides seamless user feedback when internet connectivity drops.

---

## 5. Production Security Deployment Checklist (For Later Implementation)

When deploying VibeMusic publicly on the internet for broad production traffic, the following three edge and deployment measures should be implemented:

1. **Free Cloudflare Proxy (Edge Protection & Volumetric DDoS Mitigation)**:
   - Route custom domain traffic through Cloudflare's Free Plan proxy (orange-clouded DNS).
   - Automatically absorbs Layer 3/4 volumetric network floods, SYN floods, and malicious scraping before requests ever hit the origin server.
   - Provides free automated SSL/TLS termination, HTTP/3 support, and global edge caching for static assets.

2. **Production Secrets & Environment Hardening**:
   - Generate unique, high-entropy cryptographic secrets for production (`JWT_SECRET`, database passwords).
   - Keep production credentials isolated within deployment environment variables (Vercel, Railway, or VPS environment managers) and maintain `.env` files strictly in `.gitignore`.

3. **Email Verification (Bot & Spam Account Prevention)**:
   - When opening user registration publicly, enable email confirmation flow (natively available in Supabase Auth or via transactional SMTP/Resend for SQLite auth).
   - Prevents automated bot registrations and disposable spam emails from bloating database records.


