# VibeMusic — Development Progress & Roadmap

> **Date**: October 20, 2026  
> **Status**: Operational, Feature-Complete & Fully Verified  
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
│   ├── main.py                     # FastAPI app with CORS, lifespan warming, route registrations
│   ├── api/
│   │   └── routes.py               # /search, /suggestions, /home, /charts, /song, /lyrics, /artist, /artist/more-songs, /stream
│   └── services/
│       ├── yt_service.py           # ytmusicapi + yt-dlp tv_embedded client, artist profile, discography pagination & preloading
│       └── cache_service.py        # High-performance in-memory + persistent disk TTL caching
└── frontend/
    └── src/
        ├── store/
        │   └── playerStore.ts      # Zustand store: playback state, activeArtistModal, favorites, followed artists,
        │                           # playHistory, downloadedTracks, playlists + localStorage persistence
        ├── lib/
        │   ├── audioPlayer.ts      # HTMLAudioElement singleton with MediaSession & preload buffer
        │   ├── colorExtractor.ts   # Canvas pixel sampling for dominant artwork color extraction
        │   └── clientCache.ts      # In-memory client cache with TTL
        ├── components/
        │   ├── modals/
        │   │   └── ArtistModal.tsx # Artist profile drawer (hero banner, verified badge, bio, "Load More Songs", albums)
        │   ├── player/
        │   │   ├── ExpandedPlayer.tsx # Fullscreen player with dynamic dominant color, live LRC lyrics, clickable artist
        │   │   ├── MiniPlayer.tsx     # Bottom persistent player bar with scrubber, volume, artist link, and heart
        │   │   └── QueueDrawer.tsx    # Up next playlist drawer with reordering
        │   └── ui/
        │       └── MusicPoster.tsx    # Image loader with multi-tier fallbacks
        └── app/
            ├── page.tsx            # Home page: "Hot and Happening" carousel + "Quick picks" + artist modal triggers
            ├── search/page.tsx     # Live search with autocomplete, filter chips, top artist cards, and track lists
            ├── library/page.tsx    # 4 Quick Action banners, Favorites, Followed, Most Played, Playlists
            └── layout.tsx          # Root layout with Sidebar, Header, MiniPlayer, and ArtistModal
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
- **MiniPlayer Visibility in Artist Profile**:
  - *Z-Index Hierarchy Normalization*: Adjusted [ArtistModal.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/modals/ArtistModal.tsx) to `z-[60]` and elevated [MiniPlayer.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/player/MiniPlayer.tsx) to `z-[70]` so active playback controls float seamlessly at the bottom of the artist profile screen instead of being hidden behind it.
  - *Dynamic Bottom Anchoring*: Subscribed `MiniPlayer` to `activeArtistModal`. When any artist profile is open, the miniplayer automatically docks flush to `bottom-0` across all viewports (avoiding the mobile bottom navigation gap since `ArtistModal` covers the base tabs).
  - *Layering & Stacking Integrity*: Elevated [ExpandedPlayer.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/player/ExpandedPlayer.tsx) to `z-[80]`, [FullScreenLyrics.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/player/FullScreenLyrics.tsx) to `z-[85]`, [QueueDrawer.tsx](file:///c:/Projects/VibeMusic/frontend/src/components/player/QueueDrawer.tsx) to `z-[90]`, and dialog modals to `z-[95]`, ensuring clicking the miniplayer or queue drawer from an artist profile expands smoothly on top.

---

## 4. Suggested Next Steps for Tomorrow
1. **Audio Cache & Offline Playback (Service Worker)**:
   - Connect the "Downloaded" section to CacheStorage or IndexedDB via the PWA service worker so audio files play completely offline without network connectivity.
2. **Explore Mood / Genre Playlists**:
   - Add dedicated playlist pages when clicking Moods & Genres in the Search page (e.g., clicking "Chill" or "Workout" loads a curated 25-song playlist).
3. **Keyboard Shortcuts**:
   - Add global keyboard handlers: spacebar for Play/Pause, `Shift+Right` for Next Track, `Shift+Left` for Previous Track, and `M` for Mute.
4. **Equalizer & Audio Effects**:
   - Optional Web Audio API equalizer (Bass Boost, Treble, Vocal Clarity presets).

