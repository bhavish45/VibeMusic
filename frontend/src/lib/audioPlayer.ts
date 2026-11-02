import { usePlayerStore, Track } from '@/store/playerStore';
import { useSettingsStore, AppSettings } from '@/store/settingsStore';

class AudioPlayer {
  private audio: HTMLAudioElement | null = null;
  private nextAudio: HTMLAudioElement | null = null;
  private nextNextAudio: HTMLAudioElement | null = null;
  private backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  private currentVideoId: string | null = null;
  private retryCount = 0;
  private maxRetries = 2;
  private isSubscribed = false;
  private isLoadingTrack = false;
  private preloadingIds = new Set<string>();
  private preloadedStreamIds = new Set<string>(); // Track which streams are already pre-buffered
  private preloadDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private isFetchingAutoplay = false;

  // Crossfade state
  private isCrossfading = false;
  private isTransitioningCrossfade = false;
  private isUserPaused = false;
  private crossfadeTimer: NodeJS.Timeout | null = null;
  private outgoingAudio: HTMLAudioElement | null = null;
  private incomingCrossfadeAudio: HTMLAudioElement | null = null;

  // Web Audio API 5-Band Equalizer & Dynamics Compressor
  private audioContext: AudioContext | null = null;
  private eqInputNode: GainNode | null = null;
  private eqFilters: {
    60: BiquadFilterNode;
    230: BiquadFilterNode;
    910: BiquadFilterNode;
    3600: BiquadFilterNode;
    14000: BiquadFilterNode;
  } | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private sourceNodeMap = new WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>();
  private isEqInitialized = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.audio = this.createAudioElement();
      this.nextAudio = this.createAudioElement();
      this.nextNextAudio = this.createAudioElement();
      this.applyVolume(usePlayerStore.getState().volume ?? 1.0);
      this.setupListeners();
      this.setupMediaSession();
      this.setupStoreSubscriber();
      this.setupSettingsSubscriber();
      this.setupQueueWatcher();
      this.initWebAudio();
    }
  }

  public resetPlaybackState() {
    if (this.isTransitioningCrossfade) {
      return;
    }
    if (this.isCrossfading) {
      this.cancelCrossfade();
    }
    this.isLoadingTrack = true;
    if (this.audio) {
      this.audio.pause();
      try {
        this.audio.currentTime = 0;
      } catch {}
    }
    usePlayerStore.getState().setProgress(0);
  }

  private setupSettingsSubscriber() {
    useSettingsStore.subscribe((state, prevState) => {
      // 1. Audio Normalization setting changed - apply immediately
      if (state.audioNormalization !== prevState.audioNormalization) {
        this.applyVolume(usePlayerStore.getState().volume ?? 1.0);
      }

      // 2. Audio Streaming Quality changed - immediately swap active stream
      if (state.audioQuality !== prevState.audioQuality) {
        this.handleQualityChange(state.audioQuality);
        // Invalidate preloaded streams since quality changed
        this.preloadedStreamIds.clear();
        this.preloadUpcomingQueue();
      }

      // 3. Autoplay enabled - immediately check if queue needs populating
      if (state.autoplay && !prevState.autoplay) {
        this.ensureAutoplayQueue();
      }

      // 4. Crossfade turned off mid-transition - cancel crossfade immediately
      if (state.crossfade === 0 && prevState.crossfade > 0 && this.isCrossfading) {
        this.cancelCrossfade();
      }

      // 5. Equalizer settings changed - apply immediately
      if (
        state.equalizerEnabled !== prevState.equalizerEnabled ||
        state.equalizerPreset !== prevState.equalizerPreset ||
        state.equalizerBands !== prevState.equalizerBands
      ) {
        this.applyEqualizerSettings();
      }
    });
  }

  /**
   * Immediately switches active audio stream to the new quality bitrate without losing playback position.
   */
  private handleQualityChange(newQuality: AppSettings['audioQuality']) {
    if (!this.audio || !this.currentVideoId) return;
    const curTime = this.audio.currentTime || 0;
    const wasPlaying = !this.audio.paused;

    // Reset pre-buffered audio elements so upcoming queue immediately buffers with the new quality
    if (this.nextAudio) {
      this.nextAudio.src = '';
    }
    if (this.nextNextAudio) {
      this.nextNextAudio.src = '';
    }

    const streamUrl = `${this.backendUrl}/api/stream/${this.currentVideoId}?quality=${newQuality}&t=${Date.now()}`;

    // Smoothly restore playback position as soon as metadata for the new quality stream is ready
    const onLoadedMetadata = () => {
      if (this.audio) {
        try {
          if (curTime > 0 && curTime < (this.audio.duration || Infinity)) {
            this.audio.currentTime = curTime;
          }
        } catch {}
        if (wasPlaying) {
          this.audio.play().catch(() => {});
        }
      }
    };

    this.audio.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
    this.audio.src = streamUrl;
    this.audio.load();
    if (wasPlaying) {
      this.audio.play().catch(() => {});
    }
  }

  /**
   * Watch for queue changes (add, reorder, new queue set) and proactively preload.
   */
  private setupQueueWatcher() {

    usePlayerStore.subscribe((state, prevState) => {
      const queueChanged = state.queue.length !== prevState.queue.length;
      const indexChanged = state.queueIndex !== prevState.queueIndex;

      if (queueChanged || indexChanged) {
        // Debounced preload to avoid hammering on rapid queue changes
        this.schedulePreload();
      }
    });
  }

  /**
   * Debounced preload scheduler - batches rapid queue changes into one preload call.
   */
  private schedulePreload() {
    if (this.preloadDebounceTimer) {
      clearTimeout(this.preloadDebounceTimer);
    }
    this.preloadDebounceTimer = setTimeout(() => {
      this.preloadDebounceTimer = null;
      this.preloadUpcomingQueue();
    }, 150);
  }

  private setupStoreSubscriber() {
    if (this.isSubscribed) return;
    this.isSubscribed = true;

    // Automatically trigger playback only when currentTrack changes and isPlaying is true
    usePlayerStore.subscribe((state, prevState) => {
      // Guard against interrupting active crossfade or crossfade transition handoff
      if (this.isCrossfading || this.isTransitioningCrossfade) {
        return;
      }

      const newId = state.currentTrack?.videoId;
      const oldId = prevState.currentTrack?.videoId;

      if (newId && newId !== oldId) {
        this.loadTrack(newId, state.isPlaying);
      } else if (state.isPlaying !== prevState.isPlaying) {
        if (state.isPlaying && this.audio?.paused) {
          this.play();
        } else if (!state.isPlaying && !this.audio?.paused) {
          this.pause();
        }
      }
    });
  }

  private setupListeners() {
    if (!this.audio) return;

    // Using property-based handlers (ontimeupdate, etc.) instead of addEventListener
    // to prevent duplicate listener stacking when audio elements are hot-swapped.
    // Property assignment automatically replaces the previous handler.

    this.audio.ontimeupdate = () => {
      if (this.isLoadingTrack) return;
      if (this.audio && !isNaN(this.audio.currentTime)) {
        usePlayerStore.getState().setProgress(this.audio.currentTime);

        // Check Crossfade transition if track is nearing end
        const crossfadeSec = useSettingsStore.getState().crossfade;
        if (
          crossfadeSec > 0 && 
          !this.isCrossfading && 
          !this.isLoadingTrack &&
          !this.isTransitioningCrossfade
        ) {
          const effectiveDur = this.getEffectiveDuration();
          // Song must be long enough for the crossfade
          if (effectiveDur >= crossfadeSec * 2) {
            // Must have played at least 75% of the song (guarantees NO early trigger during buffering or intro)
            const isNearEnd = this.audio.currentTime >= effectiveDur * 0.75;
            const remaining = effectiveDur - this.audio.currentTime;

            if (isNearEnd && remaining <= crossfadeSec && remaining > 0) {
              this.executeCrossfade(crossfadeSec);
            }
          }
        }

        // Trigger preloading when 70% through the track
        const effectiveDurForPreload = this.getEffectiveDuration();
        if (
          effectiveDurForPreload > 0 &&
          this.audio.currentTime > effectiveDurForPreload * 0.7
        ) {
          this.schedulePreload();
        }

        // Proactively replenish queue if approaching end of queue (<= 4 tracks remaining)
        const store = usePlayerStore.getState();
        const settings = useSettingsStore.getState();
        const remainingInQueue = store.queue.length - 1 - store.queueIndex;
        if (
          settings.autoplay &&
          remainingInQueue <= 4 &&
          !this.isFetchingAutoplay
        ) {
          this.ensureAutoplayQueue();
        }
      }
    };

    this.audio.onloadedmetadata = () => {
      this.isLoadingTrack = false;
      if (this.audio && !isNaN(this.audio.duration) && isFinite(this.audio.duration)) {
        usePlayerStore.getState().setTrackDuration(Math.round(this.audio.duration));
      }
      usePlayerStore.getState().setIsLoading(false);
    };

    this.audio.onloadeddata = () => {
      this.isLoadingTrack = false;
      usePlayerStore.getState().setIsLoading(false);
    };

    this.audio.oncanplay = () => {
      this.isLoadingTrack = false;
      usePlayerStore.getState().setIsLoading(false);
    };

    this.audio.onwaiting = () => {
      usePlayerStore.getState().setIsLoading(true);
    };

    // Native play event - ensures UI button always shows PAUSE icon when audio is active
    this.audio.onplay = () => {
      if (this.isCrossfading || this.isTransitioningCrossfade) return;
      usePlayerStore.getState().play();
      usePlayerStore.getState().setError(null);
    };

    // Native pause event - ensures UI button always shows PLAY icon when audio is paused
    this.audio.onpause = () => {
      if (this.isCrossfading || this.isTransitioningCrossfade) return;
      usePlayerStore.getState().pause();
    };

    this.audio.onplaying = () => {
      this.isLoadingTrack = false;
      usePlayerStore.getState().setIsLoading(false);
      usePlayerStore.getState().play();
      usePlayerStore.getState().setError(null);
      this.retryCount = 0;

      // Aggressively preload upcoming songs in queue
      this.preloadUpcomingQueue();
    };

    this.audio.onended = async () => {
      if (this.isCrossfading || this.isTransitioningCrossfade) return; // handled by crossfade

      const state = usePlayerStore.getState();
      const settings = useSettingsStore.getState();

      if (state.repeatMode === 'one') {
        if (this.audio) {
          this.audio.currentTime = 0;
          this.audio.play().catch(() => {});
        }
      } else {
        const isLastTrack = state.queueIndex >= state.queue.length - 1;
        if (!isLastTrack || state.repeatMode === 'all') {
          state.nextTrack();
        } else if (settings.autoplay) {
          // Autoplay is enabled: Fetch recommendations and keep continuous playback rolling!
          await this.ensureAutoplayQueue();
          const updatedState = usePlayerStore.getState();
          if (updatedState.queueIndex < updatedState.queue.length - 1) {
            updatedState.nextTrack();
          } else {
            updatedState.pause();
          }
        } else {
          state.pause();
        }
      }
    };

    this.audio.onerror = () => {
      const err = this.audio?.error;
      // Code 1 is MEDIA_ERR_ABORTED - normal cancellation when switching songs or seeking
      if (err && err.code === 1) {
        return;
      }

      const store = usePlayerStore.getState();
      const videoId = this.currentVideoId;
      if (!videoId) return;

      console.warn(`[AudioPlayer] Stream retry ${this.retryCount + 1}/${this.maxRetries} for ${videoId}`);

      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        store.setError(`Reconnecting stream (${this.retryCount}/${this.maxRetries})...`);

        setTimeout(() => {
          if (this.currentVideoId === videoId && this.audio) {
            const quality = useSettingsStore.getState().audioQuality;
            const streamUrl = `${this.backendUrl}/api/stream/${videoId}?retry=${this.retryCount}&quality=${quality}&t=${Date.now()}`;
            this.audio.src = streamUrl;
            this.audio.load();
            this.audio.play().catch(() => {});
          }
        }, 600);
      } else {
        console.warn(`[AudioPlayer] Track ${videoId} retry limit reached.`);
        store.setError('Connection issue. Click play to retry.');
        store.setIsLoading(false);
        this.retryCount = 0;
      }
    };
  }

  /**
   * Executes a seamless equal-power acoustic crossfade between the ending track and beginning of next track.
   * Reference player behavior (Spotify/Apple Music):
   * - Ending track remains displayed on screen (artwork, title, progress reaching 100%).
   * - Ending track volume smoothly ramps down (1.0 -> 0.0) via equal-power cosine curve.
   * - Upcoming track starts from 0:00 and smoothly ramps up (0.0 -> 1.0) via equal-power sine curve.
   * - When the crossfade interval completes, ending track is cleanly stopped and recycled,
   *   incoming track becomes primary, and the UI cleanly transitions to the new track without a hiccup.
   */
  private async executeCrossfade(durationSec: number) {
    if (this.isCrossfading || !this.audio || this.isLoadingTrack || this.isTransitioningCrossfade) return;

    const store = usePlayerStore.getState();
    const { queue, queueIndex, repeatMode, isShuffled } = store;
    if (!queue || queue.length === 0) {
      return;
    }

    if (repeatMode === 'one') {
      return;
    }

    let nextIndex = queueIndex + 1;
    if (isShuffled && queue.length > 1) {
      let rand = Math.floor(Math.random() * queue.length);
      while (rand === queueIndex && queue.length > 1) {
        rand = Math.floor(Math.random() * queue.length);
      }
      nextIndex = rand;
    } else if (nextIndex >= queue.length) {
      if (repeatMode === 'all') {
        nextIndex = 0;
      } else {
        // No upcoming track in queue to crossfade into
        return;
      }
    }

    const nextTrack = queue[nextIndex];
    if (!nextTrack || !nextTrack.videoId) {
      return;
    }

    this.isCrossfading = true;
    const currentPlayingId = this.currentVideoId;

    // 1. Resolve Spotify ID if needed
    let targetVideoId = nextTrack.videoId;
    if (targetVideoId.startsWith('sp_')) {
      try {
        const res = await fetch(`${this.backendUrl}/api/spotify/resolve-track`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: nextTrack.title,
            artist: nextTrack.artists?.[0]?.name || ''
          })
        });
        if (res.ok) {
          const match = await res.json();
          if (match && match.videoId) {
            targetVideoId = match.videoId;
            const matchPoster = match.poster || match.thumbnails?.[0]?.url;
            const matchFallback = match.fallbackPoster || `https://i.ytimg.com/vi/${match.videoId}/mqdefault.jpg`;
            store.updateTrackResolution(nextTrack.videoId, match.videoId, matchPoster, matchFallback, match.thumbnails);
          }
        }
      } catch (err) {
        console.warn('[AudioPlayer] Crossfade Spotify resolution failed:', err);
      }
    }

    // If still unresolved Spotify ID, abort crossfade gracefully
    if (targetVideoId.startsWith('sp_')) {
      this.isCrossfading = false;
      return;
    }

    // Abort if playback state changed while resolving (user paused, skipped, or stopped)
    if (!this.isCrossfading || !this.audio || this.audio.paused || this.currentVideoId !== currentPlayingId) {
      this.isCrossfading = false;
      return;
    }

    // 2. Prepare incoming audio element (reuse pre-buffered instance if available)
    let incomingAudio = this.getPreloadedAudio(targetVideoId);
    this.resumeAudioContext();
    if (incomingAudio) {
      this.connectElementToEq(incomingAudio);
    }
    if (!incomingAudio) {
      if (!this.nextAudio) {
        this.nextAudio = this.createAudioElement();
      }
      incomingAudio = this.nextAudio;
      const quality = useSettingsStore.getState().audioQuality;
      const streamUrl = `${this.backendUrl}/api/stream/${targetVideoId}?quality=${quality}`;
      if (!incomingAudio.src || !incomingAudio.src.includes(`/stream/${targetVideoId}`)) {
        incomingAudio.src = streamUrl;
        incomingAudio.load();
      }
    }

    // If incoming audio is not ready, wait briefly for data
    if (incomingAudio.readyState < 2) {
      await new Promise<void>((resolve) => {
        let done = false;
        const timer = setTimeout(() => {
          if (!done) {
            done = true;
            incomingAudio?.removeEventListener('canplay', onCanPlay);
            resolve();
          }
        }, 1200);
        const onCanPlay = () => {
          if (!done) {
            done = true;
            clearTimeout(timer);
            incomingAudio?.removeEventListener('canplay', onCanPlay);
            resolve();
          }
        };
        incomingAudio?.addEventListener('canplay', onCanPlay);
      });
    }

    // Verify state again after buffering wait
    if (!this.isCrossfading || !this.audio || this.audio.paused || this.currentVideoId !== currentPlayingId) {
      this.isCrossfading = false;
      return;
    }

    const outgoingAudio = this.audio;
    this.outgoingAudio = outgoingAudio;
    this.incomingCrossfadeAudio = incomingAudio;

    // Reset incoming audio position to start, volume to 0
    try {
      incomingAudio.currentTime = 0;
    } catch {}
    incomingAudio.volume = 0;

    // Start playback of incoming audio
    try {
      const playPromise = incomingAudio.play();
      if (playPromise !== undefined) {
        await playPromise;
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.warn('[AudioPlayer] Incoming audio play failed for crossfade:', err);
        this.cancelCrossfade();
        return;
      }
    }

    if (!this.isCrossfading || !this.audio || this.currentVideoId !== currentPlayingId) {
      incomingAudio.pause();
      try { incomingAudio.currentTime = 0; } catch {}
      this.cancelCrossfade();
      return;
    }

    // Preserve smooth progress updates for the outgoing song during crossfade
    outgoingAudio.ontimeupdate = () => {
      if (outgoingAudio && !isNaN(outgoingAudio.currentTime)) {
        usePlayerStore.getState().setProgress(outgoingAudio.currentTime);
      }
    };

    // If outgoing audio ends before the timer, finalize crossfade immediately
    outgoingAudio.onended = () => {
      if (this.isCrossfading) {
        if (this.crossfadeTimer) {
          clearInterval(this.crossfadeTimer);
          this.crossfadeTimer = null;
        }
        this.finishCrossfade(outgoingAudio, incomingAudio, nextIndex, targetVideoId, durationSec);
      }
    };

    // Detach onpause from outgoing so EOF buffering doesn't pause the player store
    outgoingAudio.onpause = null;

    const totalDurationMs = durationSec * 1000;
    let crossfadeElapsedMs = 0;
    let lastTick = performance.now();
    const intervalMs = 40; // 25 updates per second for smooth acoustic curve

    if (this.crossfadeTimer) {
      clearInterval(this.crossfadeTimer);
      this.crossfadeTimer = null;
    }

    this.crossfadeTimer = setInterval(() => {
      if (!this.isCrossfading) {
        if (this.crossfadeTimer) {
          clearInterval(this.crossfadeTimer);
          this.crossfadeTimer = null;
        }
        return;
      }

      const now = performance.now();
      const delta = now - lastTick;
      lastTick = now;

      // If user paused, do not advance elapsed crossfade time
      if (this.isUserPaused) {
        return;
      }

      crossfadeElapsedMs += delta;
      let progress = Math.min(1, Math.max(0, crossfadeElapsedMs / totalDurationMs));

      // If outgoing audio ended naturally, accelerate to 100%
      if (outgoingAudio.ended) {
        progress = 1;
      }

      const targetVol = this.getEffectiveVolume();

      // Equal-power crossfade curve: cos(t) for outgoing, sin(t) for incoming
      // cos^2(t) + sin^2(t) = 1 (constant sound energy level throughout)
      const outVol = targetVol * Math.cos(progress * 0.5 * Math.PI);
      const inVol = targetVol * Math.sin(progress * 0.5 * Math.PI);

      outgoingAudio.volume = Math.max(0, Math.min(1, outVol));
      incomingAudio.volume = Math.max(0, Math.min(1, inVol));

      if (progress >= 1) {
        if (this.crossfadeTimer) {
          clearInterval(this.crossfadeTimer);
          this.crossfadeTimer = null;
        }
        this.finishCrossfade(outgoingAudio, incomingAudio, nextIndex, targetVideoId, durationSec);
      }
    }, intervalMs) as any;
  }

  /**
   * Finalizes the crossfade transition, updates the player UI to the next track,
   * and recycles the outgoing audio element.
   */
  private finishCrossfade(
    outgoingAudio: HTMLAudioElement,
    incomingAudio: HTMLAudioElement,
    nextIndex: number,
    targetVideoId: string,
    durationSec: number
  ) {
    if (this.crossfadeTimer) {
      clearInterval(this.crossfadeTimer);
      this.crossfadeTimer = null;
    }

    const targetVol = this.getEffectiveVolume();
    incomingAudio.volume = targetVol;

    // 1. Terminate and cleanup outgoing audio element
    this.removeAllListeners(outgoingAudio);
    outgoingAudio.pause();
    try {
      outgoingAudio.currentTime = 0;
    } catch {}
    outgoingAudio.src = '';

    // 2. Recycle old element into the nextAudio preload slot
    this.nextAudio = outgoingAudio;
    this.nextAudio.preload = 'auto';

    this.outgoingAudio = null;
    this.incomingCrossfadeAudio = null;

    // 3. Promote incomingAudio to primary audio element
    this.audio = incomingAudio;
    this.currentVideoId = targetVideoId;
    this.setupListeners();

    // 4. Update the player store to advance to next track
    this.isTransitioningCrossfade = true;
    usePlayerStore.getState().advanceCrossfadeTrack(nextIndex);
    usePlayerStore.getState().setProgress(incomingAudio.currentTime || durationSec);
    usePlayerStore.getState().setIsLoading(false);
    usePlayerStore.getState().play();

    if (incomingAudio.duration && !isNaN(incomingAudio.duration) && isFinite(incomingAudio.duration)) {
      usePlayerStore.getState().setTrackDuration(Math.round(incomingAudio.duration));
    }

    const curTrack = usePlayerStore.getState().currentTrack;
    if (curTrack) {
      this.updateMediaSessionMetadata(curTrack);
    }

    this.isCrossfading = false;
    this.isTransitioningCrossfade = false;

    // 5. Preload subsequent upcoming tracks in queue
    this.schedulePreload();
  }

  /**
   * Immediately aborts any ongoing crossfade, restoring primary audio to full volume.
   */
  public cancelCrossfade() {
    if (this.crossfadeTimer) {
      clearInterval(this.crossfadeTimer);
      this.crossfadeTimer = null;
    }
    if (this.incomingCrossfadeAudio) {
      this.removeAllListeners(this.incomingCrossfadeAudio);
      this.incomingCrossfadeAudio.pause();
      try {
        this.incomingCrossfadeAudio.currentTime = 0;
      } catch {}
      this.incomingCrossfadeAudio.src = '';
      this.incomingCrossfadeAudio = null;
    }
    this.outgoingAudio = null;
    this.isCrossfading = false;
    this.isTransitioningCrossfade = false;
    this.isUserPaused = false;
    this.applyVolume(usePlayerStore.getState().volume ?? 1.0);
  }

  /**
   * Automatically fetches similar tracks and queues them when queue is at the end.
   */
  public async ensureAutoplayQueue() {
    const store = usePlayerStore.getState();
    const settings = useSettingsStore.getState();
    if (!settings.autoplay) return;

    const current = store.currentTrack;
    if (!current) return;
    if (this.isFetchingAutoplay) return;

    this.isFetchingAutoplay = true;

    try {
      const existingIds = new Set(store.queue.map(q => q.videoId));
      let similarSongs: Track[] = [];

      // 1. Try native YouTube Music Radio / Watch Playlist recommendations for this exact track
      try {
        const radioRes = await fetch(`${this.backendUrl}/api/radio/${encodeURIComponent(current.videoId)}`);
        if (radioRes.ok) {
          const radioData = await radioRes.json();
          const radioTracks = radioData?.tracks || [];
          if (Array.isArray(radioTracks) && radioTracks.length > 0) {
            similarSongs = radioTracks.filter((s: Track) => s.videoId && !existingIds.has(s.videoId));
          }
        }
      } catch {
        // radio endpoint fallback
      }

      // 2. If radio didn't produce enough new tracks, query artist mix or song mix
      if (similarSongs.length < 5) {
        const primaryArtist = typeof current.artists?.[0] === 'string' 
          ? current.artists[0] 
          : current.artists?.[0]?.name;
        const query = primaryArtist ? `${primaryArtist} mix` : `${current.title} song`;
        const res = await fetch(`${this.backendUrl}/api/search?q=${encodeURIComponent(query)}&filter=songs`);
        if (res.ok) {
          const songs = await res.json();
          if (Array.isArray(songs) && songs.length > 0) {
            const moreSongs = songs.filter((s: Track) => s.videoId && !existingIds.has(s.videoId) && !similarSongs.some(item => item.videoId === s.videoId));
            similarSongs = [...similarSongs, ...moreSongs];
          }
        }
      }

      // 3. Queue the fresh similar songs into the player queue
      if (similarSongs.length > 0) {
        const songsToAdd = similarSongs.slice(0, 8);
        songsToAdd.forEach((t: Track) => {
          store.addToQueue({
            ...t,
            poster: t.poster || t.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${t.videoId}/hqdefault.jpg`,
            fallbackPoster: t.fallbackPoster || `https://i.ytimg.com/vi/${t.videoId}/hqdefault.jpg`
          });
        });

        // Proactively schedule preload for upcoming audio streams
        this.schedulePreload();
      }
    } catch (err) {
      console.warn('[AudioPlayer] Autoplay queue replenish error:', err);
    } finally {
      this.isFetchingAutoplay = false;
    }
  }

  public setupMediaSession() {
    if (typeof window === 'undefined') return;
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => {
        this.play();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        this.pause();
      });
      navigator.mediaSession.setActionHandler('previoustrack', () =>
        usePlayerStore.getState().prevTrack()
      );
      navigator.mediaSession.setActionHandler('nexttrack', () =>
        usePlayerStore.getState().nextTrack()
      );
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) {
          this.seek(details.seekTime);
        }
      });
    }
  }

  private updateMediaSessionMetadata(track: any) {
    if (typeof window === 'undefined') return;
    if ('mediaSession' in navigator && track) {
      const artistNames = Array.isArray(track.artists)
        ? track.artists.map((a: any) => typeof a === 'string' ? a : a.name).join(', ')
        : (track.artist || 'Unknown Artist');

      const posterUrl =
        track.poster ||
        track.thumbnails?.[0]?.url ||
        `https://i.ytimg.com/vi/${track.videoId}/hqdefault.jpg`;

      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title || 'Unknown Title',
        artist: artistNames,
        album: track.album?.name || 'VibeMusic',
        artwork: [{ src: posterUrl, sizes: '512x512', type: 'image/jpeg' }],
      });
    }
  }

  /**
   * Gets the stream URL for the next audio element that matches the given videoId.
   * Returns the matching pre-buffered Audio element, or null.
   */
  private getPreloadedAudio(videoId: string): HTMLAudioElement | null {
    const quality = useSettingsStore.getState().audioQuality;
    const expectedUrl = `${this.backendUrl}/api/stream/${videoId}?quality=${quality}`;

    // Check nextAudio first (most likely match for immediate next track)
    if (this.nextAudio?.src && this.nextAudio.src.includes(`/stream/${videoId}`)) {
      return this.nextAudio;
    }
    // Check nextNextAudio (second-in-line)
    if (this.nextNextAudio?.src && this.nextNextAudio.src.includes(`/stream/${videoId}`)) {
      return this.nextNextAudio;
    }
    return null;
  }

  /**
   * Hot-swap: Replace the main audio element with a pre-buffered one for instant playback.
   */
  private hotSwapAudio(preloaded: HTMLAudioElement) {
    if (!this.audio) return;
    
    // Save reference to old audio before swapping
    const oldAudio = this.audio;
    
    // Pause and clean up old audio
    oldAudio.pause();
    try { oldAudio.currentTime = 0; } catch {}
    
    // Remove all listeners from old audio before it becomes a preload element
    // (new listeners will be on the promoted element which already inherits the main listeners)
    
    // Promote the preloaded element to main
    this.audio = preloaded;
    this.applyVolume(usePlayerStore.getState().volume ?? 1.0);
    
    // Re-attach all event listeners to the new main audio
    this.setupListeners();
    
    // Recycle old audio element as a preload slot
    oldAudio.src = '';
    if (preloaded === this.nextAudio) {
      this.nextAudio = oldAudio;
      this.nextAudio.preload = 'auto';
    } else if (preloaded === this.nextNextAudio) {
      this.nextNextAudio = oldAudio;
      this.nextNextAudio.preload = 'auto';
    }
  }

  public async preloadUpcomingQueue() {
    try {
      const { queue, queueIndex } = usePlayerStore.getState();
      if (!queue || queue.length === 0) return;

      // Preload up to 8 upcoming tracks for deep pipeline coverage
      const upcoming = queue.slice(queueIndex + 1, queueIndex + 9);
      if (upcoming.length === 0) return;

      const quality = useSettingsStore.getState().audioQuality;

      // 1. Resolve any upcoming Spotify tracks in the background (works for Spotify & Local playlists)
      for (const track of upcoming) {
        if (track.videoId && track.videoId.startsWith('sp_') && !this.preloadingIds.has(track.videoId)) {
          this.preloadingIds.add(track.videoId);
          this.resolveUpcomingTrack(track).catch(() => {});
        }
      }

      // 2. Batch warm cache on backend for all resolved YouTube IDs in upcoming queue
      const resolvedVideoIds = upcoming
        .map(t => t.videoId)
        .filter(id => id && !id.startsWith('sp_'));

      // Only send IDs that haven't been preloaded yet
      const newToPreload = resolvedVideoIds.filter(id => !this.preloadedStreamIds.has(`${id}:${quality}`));

      if (newToPreload.length > 0) {
        // Mark as preloaded immediately to prevent duplicate requests
        newToPreload.forEach(id => this.preloadedStreamIds.add(`${id}:${quality}`));
        
        fetch(`${this.backendUrl}/api/preload-batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ video_ids: newToPreload, quality })
        }).catch(() => {
          // Unmark on failure so they can be retried
          newToPreload.forEach(id => this.preloadedStreamIds.delete(`${id}:${quality}`));
        });
      }

      // 3. Pre-buffer the VERY NEXT track in the secondary hidden Audio element
      const nextTrack = upcoming[0];
      if (nextTrack && nextTrack.videoId && !nextTrack.videoId.startsWith('sp_')) {
        if (!this.nextAudio) {
          this.nextAudio = new Audio();
          this.nextAudio.preload = 'auto';
        }
        const nextStreamUrl = `${this.backendUrl}/api/stream/${nextTrack.videoId}?quality=${quality}`;
        if (!this.nextAudio.src.includes(`/stream/${nextTrack.videoId}`)) {
          this.nextAudio.src = nextStreamUrl;
          this.nextAudio.load();
        }
      }

      // 4. Pre-buffer the SECOND NEXT track in the third hidden Audio element
      const nextNextTrack = upcoming[1];
      if (nextNextTrack && nextNextTrack.videoId && !nextNextTrack.videoId.startsWith('sp_')) {
        if (!this.nextNextAudio) {
          this.nextNextAudio = new Audio();
          this.nextNextAudio.preload = 'auto';
        }
        const nnStreamUrl = `${this.backendUrl}/api/stream/${nextNextTrack.videoId}?quality=${quality}`;
        if (!this.nextNextAudio.src.includes(`/stream/${nextNextTrack.videoId}`)) {
          this.nextNextAudio.src = nnStreamUrl;
          this.nextNextAudio.load();
        }
      }

      // Keep preloaded set from growing unbounded (cap at 50 entries)
      if (this.preloadedStreamIds.size > 50) {
        const entries = Array.from(this.preloadedStreamIds);
        entries.slice(0, entries.length - 30).forEach(id => this.preloadedStreamIds.delete(id));
      }
    } catch {
      // Ignore background preload errors
    }
  }

  private async resolveUpcomingTrack(track: Track) {
    const rawId = track.videoId;
    try {
      const res = await fetch(`${this.backendUrl}/api/spotify/resolve-track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: track.title,
          artist: track.artists?.[0]?.name || ''
        })
      });
      if (!res.ok) return;
      const match = await res.json();
      if (!match || !match.videoId) return;

      const ytId = match.videoId;
      const matchPoster = match.poster || match.thumbnails?.[0]?.url;
      const matchFallback = match.fallbackPoster || `https://i.ytimg.com/vi/${ytId}/mqdefault.jpg`;

      // Update resolution in playerStore (queue + playlists)
      usePlayerStore.getState().updateTrackResolution(rawId, ytId, matchPoster, matchFallback, match.thumbnails);

      const quality = useSettingsStore.getState().audioQuality;

      // Warm backend stream cache for this newly resolved track
      if (!this.preloadedStreamIds.has(`${ytId}:${quality}`)) {
        this.preloadedStreamIds.add(`${ytId}:${quality}`);
        fetch(`${this.backendUrl}/api/preload-batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ video_ids: [ytId], quality })
        }).catch(() => {
          this.preloadedStreamIds.delete(`${ytId}:${quality}`);
        });
      }

      // If this track is the immediate next track, pre-buffer its audio now
      const state = usePlayerStore.getState();
      const currentNext = state.queue[state.queueIndex + 1];
      if (currentNext && (currentNext.videoId === ytId || currentNext.videoId === rawId)) {
        if (!this.nextAudio) {
          this.nextAudio = new Audio();
          this.nextAudio.preload = 'auto';
        }
        const nextStreamUrl = `${this.backendUrl}/api/stream/${ytId}?quality=${quality}`;
        if (!this.nextAudio.src.includes(`/stream/${ytId}`)) {
          this.nextAudio.src = nextStreamUrl;
          this.nextAudio.load();
        }
      }

      // If this track is the second-next track, pre-buffer in nextNextAudio
      const currentNextNext = state.queue[state.queueIndex + 2];
      if (currentNextNext && (currentNextNext.videoId === ytId || currentNextNext.videoId === rawId)) {
        if (!this.nextNextAudio) {
          this.nextNextAudio = new Audio();
          this.nextNextAudio.preload = 'auto';
        }
        const nnStreamUrl = `${this.backendUrl}/api/stream/${ytId}?quality=${quality}`;
        if (!this.nextNextAudio.src.includes(`/stream/${ytId}`)) {
          this.nextNextAudio.src = nnStreamUrl;
          this.nextNextAudio.load();
        }
      }
    } catch {
      // Ignore background resolve errors
    } finally {
      this.preloadingIds.delete(rawId);
    }
  }

  public preloadTrack(videoId: string) {
    if (!videoId) return;
    const quality = useSettingsStore.getState().audioQuality;
    fetch(`${this.backendUrl}/api/preload/${videoId}?quality=${quality}`).catch(() => {});
  }

  async loadTrack(videoId: string, autoPlay: boolean = true) {
    if (!this.audio || !videoId) return;

    // If crossfade is actively in progress or handoff is running, do not interrupt
    if (this.isCrossfading || this.isTransitioningCrossfade) {
      return;
    }

    // If this track is already playing or loaded, resume or do not interrupt
    if (this.currentVideoId === videoId && this.audio.src.includes(videoId)) {
      if (autoPlay && this.audio.paused) {
        this.play();
      }
      return;
    }

    // Immediately halt previous playback and reset progress to 0:00
    this.resetPlaybackState();
    this.currentVideoId = videoId;
    this.retryCount = 0;
    this.isCrossfading = false;
    const store = usePlayerStore.getState();
    store.setIsLoading(true);
    store.setError(null);

    let targetVideoId = videoId;
    if (videoId.startsWith('sp_')) {
      try {
        const res = await fetch(`${this.backendUrl}/api/spotify/resolve-track`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: store.currentTrack?.title || '',
            artist: store.currentTrack?.artists?.[0]?.name || ''
          })
        });
        if (res.ok) {
          const match = await res.json();
          if (match && match.videoId) {
            targetVideoId = match.videoId;
            this.currentVideoId = match.videoId;
            const matchPoster = match.poster || match.thumbnails?.[0]?.url;
            const matchFallback = match.fallbackPoster || `https://i.ytimg.com/vi/${match.videoId}/mqdefault.jpg`;
            store.updateTrackResolution(videoId, match.videoId, matchPoster, matchFallback, match.thumbnails);
          }
        }
      } catch (e) {
        console.warn('[AudioPlayer] Could not resolve Spotify track:', e);
      }
    }

    try {
      const quality = useSettingsStore.getState().audioQuality;

      // === INSTANT TRANSITION: Check if this track is already pre-buffered ===
      const preloaded = this.getPreloadedAudio(targetVideoId);
      if (preloaded && preloaded.readyState >= 2) {
        // readyState >= 2 (HAVE_CURRENT_DATA) means enough data is buffered
        // Hot-swap the pre-buffered element as the main audio
        this.isLoadingTrack = false;
        
        // Pause current audio
        this.audio.pause();
        try { this.audio.currentTime = 0; } catch {}

        // Swap: old main -> preload slot, preloaded -> main
        const oldAudio = this.audio;
        this.audio = preloaded;
        this.applyVolume(usePlayerStore.getState().volume ?? 1.0);

        // Re-attach all event listeners to the new main audio element
        this.removeAllListeners(oldAudio);
        this.setupListeners();

        // Recycle old element
        oldAudio.src = '';
        oldAudio.preload = 'auto';
        if (preloaded === this.nextAudio) {
          this.nextAudio = oldAudio;
        } else if (preloaded === this.nextNextAudio) {
          this.nextNextAudio = oldAudio;
        }

        // Update metadata
        const curTrack = usePlayerStore.getState().currentTrack;
        if (curTrack) {
          this.updateMediaSessionMetadata(curTrack);
        }

        // Immediately mark as loaded and start playing
        if (!isNaN(this.audio.duration) && isFinite(this.audio.duration)) {
          usePlayerStore.getState().setTrackDuration(Math.round(this.audio.duration));
        }
        store.setIsLoading(false);

        if (autoPlay) {
          this.play();
        }

        // Pre-buffer upcoming tracks now that we've consumed a slot
        this.preloadUpcomingQueue();
        return;
      }

      // === FALLBACK: Standard load (no pre-buffer available) ===
      const streamUrl = `${this.backendUrl}/api/stream/${targetVideoId}?quality=${quality}`;

      this.audio.pause();
      try {
        this.audio.currentTime = 0;
      } catch {}
      this.audio.src = streamUrl;
      this.audio.load();

      const curTrack = usePlayerStore.getState().currentTrack;
      if (curTrack) {
        this.updateMediaSessionMetadata(curTrack);
      }

      if (autoPlay) {
        this.play();
        this.preloadUpcomingQueue();
      } else {
        usePlayerStore.getState().setIsLoading(false);
      }
    } catch (err: any) {
      console.warn('[AudioPlayer] loadTrack error:', err);
    }
  }

  /**
   * Remove all event listeners from an audio element to prevent memory leaks
   * and ghost event firing when an element is recycled to a preload slot.
   */
  private removeAllListeners(element: HTMLAudioElement) {
    // Clone and replace: cheapest way to strip all listeners
    // But since we keep references, we use the abort approach instead
    // Just mute the element's events by removing individually
    const noop = () => {};
    element.ontimeupdate = null;
    element.onloadedmetadata = null;
    element.onloadeddata = null;
    element.oncanplay = null;
    element.onwaiting = null;
    element.onplay = null;
    element.onpause = null;
    element.onplaying = null;
    element.onended = null;
    element.onerror = null;
  }

  play() {
    if (!this.audio) return;
    this.resumeAudioContext();
    this.connectElementToEq(this.audio);
    this.isUserPaused = false;
    usePlayerStore.getState().play();
    const playPromise = this.audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err: any) => {
        if (err?.name === 'AbortError') {
          // Normal interruption
        } else if (err?.name === 'NotAllowedError') {
          usePlayerStore.getState().pause();
          usePlayerStore.getState().setIsLoading(false);
          usePlayerStore.getState().setError('Click play to listen');
        } else {
          console.warn('[AudioPlayer] Play exception:', err?.message);
        }
      });
    }
    if (this.isCrossfading && this.incomingCrossfadeAudio && this.incomingCrossfadeAudio.paused) {
      this.incomingCrossfadeAudio.play().catch(() => {});
    }
  }

  pause() {
    if (!this.audio) return;
    this.isUserPaused = true;
    usePlayerStore.getState().pause();
    this.audio.pause();
    if (this.isCrossfading && this.incomingCrossfadeAudio && !this.incomingCrossfadeAudio.paused) {
      this.incomingCrossfadeAudio.pause();
    }
  }

  seek(time: number) {
    if (this.isCrossfading) {
      this.cancelCrossfade();
    }
    if (this.audio) {
      this.audio.currentTime = time;
      usePlayerStore.getState().setProgress(time);
    }
  }

  public getEffectiveDuration(): number {
    const track = usePlayerStore.getState().currentTrack;
    const trackDur = track?.duration;
    const audioDur = this.audio?.duration;

    // 1. Prefer metadata duration from backend if valid (> 10s)
    if (trackDur && isFinite(trackDur) && !isNaN(trackDur) && trackDur > 10) {
      if (audioDur && isFinite(audioDur) && !isNaN(audioDur) && audioDur > trackDur) {
        return audioDur;
      }
      return trackDur;
    }

    // 2. Fall back to audio element duration if valid (> 10s)
    if (audioDur && isFinite(audioDur) && !isNaN(audioDur) && audioDur > 10) {
      return audioDur;
    }

    return 0;
  }

  public getEffectiveVolume(baseVol?: number): number {
    const vol = baseVol !== undefined ? baseVol : (usePlayerStore.getState().volume ?? 1.0);
    const isNorm = useSettingsStore.getState().audioNormalization;
    // Standard broadcast loudness normalization target (-14 LUFS standard headroom = 0.82)
    // Tames loud peak spikes and maintains uniform loudness across different tracks
    const effectiveVol = isNorm ? Math.min(1, vol * 0.82) : vol;
    return Math.max(0, Math.min(1, effectiveVol));
  }

  public applyVolume(baseVol: number) {
    if (!this.audio) return;
    const effectiveVol = this.getEffectiveVolume(baseVol);
    if (!this.isCrossfading) {
      this.audio.volume = effectiveVol;
    }
  }

  public getCurrentTime(): number {
    return this.audio?.currentTime || 0;
  }

  setVolume(volume: number) {
    const cleanVol = Math.max(0, Math.min(1, volume));
    this.applyVolume(cleanVol);
    usePlayerStore.getState().setVolume(cleanVol);
  }

  // ==================== WEB AUDIO API 5-BAND EQUALIZER ====================

  private createAudioElement(): HTMLAudioElement {
    const el = new Audio();
    el.preload = 'auto';
    el.crossOrigin = 'anonymous';
    return el;
  }

  private initWebAudio() {
    if (typeof window === 'undefined' || this.isEqInitialized) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) {
        console.warn('[WebAudio] AudioContext not supported in this browser.');
        return;
      }

      this.audioContext = new AudioCtx();
      this.eqInputNode = this.audioContext.createGain();

      // Band 1: 60 Hz (Sub-Bass peaking filter)
      const f60 = this.audioContext.createBiquadFilter();
      f60.type = 'peaking';
      f60.frequency.value = 60;
      f60.Q.value = 1.0;

      // Band 2: 230 Hz (Punch / Low-Mid peaking filter)
      const f230 = this.audioContext.createBiquadFilter();
      f230.type = 'peaking';
      f230.frequency.value = 230;
      f230.Q.value = 1.0;

      // Band 3: 910 Hz (Midrange / Center peaking filter)
      const f910 = this.audioContext.createBiquadFilter();
      f910.type = 'peaking';
      f910.frequency.value = 910;
      f910.Q.value = 1.0;

      // Band 4: 3.6 kHz (High-Mid / Presence peaking filter)
      const f3600 = this.audioContext.createBiquadFilter();
      f3600.type = 'peaking';
      f3600.frequency.value = 3600;
      f3600.Q.value = 1.0;

      // Band 5: 14 kHz (Treble / Air high-shelf filter)
      const f14000 = this.audioContext.createBiquadFilter();
      f14000.type = 'highshelf';
      f14000.frequency.value = 14000;

      // Output Stage: Dynamics compressor to eliminate clipping distortion on high boosts (+12dB)
      this.compressorNode = this.audioContext.createDynamicsCompressor();
      this.compressorNode.threshold.value = -1.0;
      this.compressorNode.knee.value = 30;
      this.compressorNode.ratio.value = 12;
      this.compressorNode.attack.value = 0.003;
      this.compressorNode.release.value = 0.25;

      // Cascaded wiring: eqInputNode -> 60 -> 230 -> 910 -> 3600 -> 14000 -> compressor -> destination
      this.eqInputNode.connect(f60);
      f60.connect(f230);
      f230.connect(f910);
      f910.connect(f3600);
      f3600.connect(f14000);
      f14000.connect(this.compressorNode);
      this.compressorNode.connect(this.audioContext.destination);

      this.eqFilters = {
        60: f60,
        230: f230,
        910: f910,
        3600: f3600,
        14000: f14000,
      };

      this.isEqInitialized = true;
      this.applyEqualizerSettings();
    } catch (e) {
      console.warn('[WebAudio] Failed to initialize AudioContext:', e);
    }
  }

  public connectElementToEq(audioEl: HTMLAudioElement | null) {
    if (!audioEl || typeof window === 'undefined') return;
    this.initWebAudio();
    if (!this.audioContext || !this.eqInputNode) return;

    try {
      if (!this.sourceNodeMap.has(audioEl)) {
        const source = this.audioContext.createMediaElementSource(audioEl);
        source.connect(this.eqInputNode);
        this.sourceNodeMap.set(audioEl, source);
      }
    } catch (e) {
      // Element may already be connected or detached
    }
  }

  public resumeAudioContext() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
  }

  public applyEqualizerSettings() {
    if (!this.audioContext || !this.eqFilters) return;
    const settings = useSettingsStore.getState();
    const isEnabled = settings.equalizerEnabled;
    const bands = settings.equalizerBands;
    const now = this.audioContext.currentTime;

    const freqs: (keyof typeof this.eqFilters)[] = [60, 230, 910, 3600, 14000];
    for (const freq of freqs) {
      const filter = this.eqFilters[freq];
      const targetGain = isEnabled ? (bands[freq] ?? 0) : 0;
      filter.gain.cancelScheduledValues(now);
      filter.gain.linearRampToValueAtTime(targetGain, now + 0.02);
    }
  }

  setYtPlayer(_player: any) {}
  setupMediaSessionPublic() { this.setupMediaSession(); }
}

// Singleton instance
export const audioPlayer = new AudioPlayer();
