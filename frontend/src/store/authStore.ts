import { create } from 'zustand';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabaseClient';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
  provider: 'email' | 'spotify';
  spotifyConnected: boolean;
  createdAt?: number;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAuthModalOpen: boolean;
  authModalMode: 'login' | 'register';
  authPromptReason: string | null;
  spotifyConfigured: boolean;
  spotifyAuthUrl: string | null;
  supabaseConfigured: boolean;
  isSupabase: boolean;
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;

  // Actions
  openAuthModal: (mode?: 'login' | 'register', reason?: string) => void;
  closeAuthModal: () => void;
  setToast: (message: string | null, type?: 'success' | 'error' | 'info') => void;
  register: (email: string, password: string, displayName: string) => Promise<{ success: boolean; error?: string }>;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithSpotify: () => void;
  handleSpotifyCallback: (code: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  checkSpotifyStatus: () => Promise<void>;
}

const STORAGE_KEY_TOKEN = 'vibemusic_auth_token';

export const getBackendUrl = () => {
  if (process.env.NEXT_PUBLIC_BACKEND_URL) return process.env.NEXT_PUBLIC_BACKEND_URL;
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== 'undefined' && window.location.hostname === '127.0.0.1') {
    return 'http://127.0.0.1:8000';
  }
  return 'http://localhost:8000';
};

type LogoutCallback = () => void;
let onLogoutCallback: LogoutCallback | null = null;

export const registerOnLogout = (cb: LogoutCallback) => {
  onLogoutCallback = cb;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  isAuthModalOpen: false,
  authModalMode: 'login',
  authPromptReason: null,
  spotifyConfigured: false,
  spotifyAuthUrl: null,
  supabaseConfigured: isSupabaseConfigured(),
  isSupabase: false,
  toast: null,

  openAuthModal: (mode = 'login', reason) => {
    set({
      isAuthModalOpen: true,
      authModalMode: mode,
      authPromptReason: reason || null,
      supabaseConfigured: isSupabaseConfigured()
    });
    // Check Spotify status when modal opens
    get().checkSpotifyStatus();
  },

  closeAuthModal: () => {
    set({
      isAuthModalOpen: false,
      authPromptReason: null
    });
  },

  setToast: (message, type = 'info') => {
    if (!message) {
      set({ toast: null });
      return;
    }
    set({ toast: { message, type } });
    setTimeout(() => {
      const cur = get().toast;
      if (cur?.message === message) {
        set({ toast: null });
      }
    }, 4000);
  },

  checkSpotifyStatus: async () => {
    try {
      const res = await fetch(`${getBackendUrl()}/api/auth/spotify/status`);
      if (res.ok) {
        const data = await res.json();
        set({
          spotifyConfigured: Boolean(data.configured),
          spotifyAuthUrl: data.authUrl || null
        });
      }
    } catch {
      // Backend status probe failover
    }
  },

  checkAuth: async () => {
    if (typeof window === 'undefined') return;

    // 1. Check active Supabase session if configured
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) {
          const suUser = data.session.user;
          const authUser: AuthUser = {
            id: suUser.id,
            email: suUser.email || '',
            displayName: suUser.user_metadata?.displayName || suUser.user_metadata?.full_name || (suUser.email?.split('@')[0] || 'User'),
            avatarUrl: suUser.user_metadata?.avatar_url || null,
            provider: 'email',
            spotifyConnected: false,
            createdAt: Date.now()
          };
          set({
            user: authUser,
            token: data.session.access_token,
            isAuthenticated: true,
            isLoading: false,
            isSupabase: true
          });
          return;
        }
      } catch (e) {
        console.warn('Supabase session check error:', e);
      }
    }

    // 2. Check local backend session token
    const token = localStorage.getItem(STORAGE_KEY_TOKEN);
    if (!token) return;

    set({ isLoading: true });
    try {
      const res = await fetch(`${getBackendUrl()}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        set({
          user: data.user,
          token,
          isAuthenticated: true,
          isLoading: false,
          isSupabase: false
        });
      } else {
        localStorage.removeItem(STORAGE_KEY_TOKEN);
        set({ user: null, token: null, isAuthenticated: false, isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  register: async (email, password, displayName) => {
    set({ isLoading: true });

    // 1. If Supabase is configured, use Supabase Cloud Auth
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { displayName }
          }
        });
        if (error) {
          set({ isLoading: false });
          return { success: false, error: error.message };
        }
        if (data.user) {
          const authUser: AuthUser = {
            id: data.user.id,
            email: data.user.email || email,
            displayName: data.user.user_metadata?.displayName || displayName || 'User',
            avatarUrl: data.user.user_metadata?.avatar_url || null,
            provider: 'email',
            spotifyConnected: false,
            createdAt: Date.now()
          };
          const token = data.session?.access_token || `sb_${data.user.id}`;
          if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY_TOKEN, token);
          }
          set({
            user: authUser,
            token,
            isAuthenticated: true,
            isLoading: false,
            isAuthModalOpen: false,
            isSupabase: true
          });
          get().setToast(`Welcome to VibeMusic, ${authUser.displayName}!`, 'success');
          return { success: true };
        }
      } catch (err: any) {
        set({ isLoading: false });
        return { success: false, error: err.message || 'Supabase registration error.' };
      }
    }

    // 2. Fallback to FastAPI backend registration (SQLite)
    try {
      const res = await fetch(`${getBackendUrl()}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName })
      });
      const data = await res.json();

      if (!res.ok) {
        set({ isLoading: false });
        return { success: false, error: data.detail || 'Registration failed.' };
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_TOKEN, data.token);
      }
      set({
        user: data.user,
        token: data.token,
        isAuthenticated: true,
        isLoading: false,
        isAuthModalOpen: false,
        isSupabase: false
      });
      get().setToast(`Welcome to VibeMusic, ${data.user.displayName}!`, 'success');
      return { success: true };
    } catch (err: any) {
      set({ isLoading: false });
      return { success: false, error: err.message || 'Network error during registration.' };
    }
  },

  login: async (email, password) => {
    set({ isLoading: true });

    // 1. If Supabase is configured, use Supabase Cloud Auth
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (error) {
          set({ isLoading: false });
          return { success: false, error: error.message };
        }
        if (data.user) {
          const authUser: AuthUser = {
            id: data.user.id,
            email: data.user.email || email,
            displayName: data.user.user_metadata?.displayName || data.user.user_metadata?.full_name || (email.split('@')[0] || 'User'),
            avatarUrl: data.user.user_metadata?.avatar_url || null,
            provider: 'email',
            spotifyConnected: false,
            createdAt: Date.now()
          };
          const token = data.session?.access_token || `sb_${data.user.id}`;
          if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY_TOKEN, token);
          }
          set({
            user: authUser,
            token,
            isAuthenticated: true,
            isLoading: false,
            isAuthModalOpen: false,
            isSupabase: true
          });
          get().setToast(`Welcome back, ${authUser.displayName}!`, 'success');
          return { success: true };
        }
      } catch (err: any) {
        set({ isLoading: false });
        return { success: false, error: err.message || 'Supabase login error.' };
      }
    }

    // 2. Fallback to FastAPI backend login (SQLite)
    try {
      const res = await fetch(`${getBackendUrl()}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (!res.ok) {
        set({ isLoading: false });
        return { success: false, error: data.detail || 'Invalid email or password.' };
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_TOKEN, data.token);
      }
      set({
        user: data.user,
        token: data.token,
        isAuthenticated: true,
        isLoading: false,
        isAuthModalOpen: false,
        isSupabase: false
      });
      get().setToast(`Welcome back, ${data.user.displayName}!`, 'success');
      return { success: true };
    } catch (err: any) {
      set({ isLoading: false });
      return { success: false, error: err.message || 'Network error during login.' };
    }
  },

  loginWithSpotify: () => {
    const { spotifyConfigured, spotifyAuthUrl } = get();
    if (!spotifyConfigured || !spotifyAuthUrl) {
      get().setToast('Spotify Developer API credentials not configured yet.', 'info');
      return;
    }
    if (typeof window !== 'undefined') {
      window.location.href = spotifyAuthUrl;
    }
  },

  handleSpotifyCallback: async (code: string) => {
    set({ isLoading: true });
    try {
      const redirect_uri = typeof window !== 'undefined' 
        ? `${window.location.origin}/auth/spotify/callback`
        : undefined;

      const res = await fetch(`${getBackendUrl()}/api/auth/spotify/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, redirect_uri })
      });
      const data = await res.json();

      if (!res.ok) {
        set({ isLoading: false });
        return { success: false, error: data.detail || 'Spotify authentication failed.' };
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_TOKEN, data.token);
      }
      set({
        user: data.user,
        token: data.token,
        isAuthenticated: true,
        isLoading: false
      });
      get().setToast(`Connected with Spotify! Loaded ${data.importedPlaylistsCount || 0} Spotify playlists.`, 'success');
      return { success: true };
    } catch (err: any) {
      set({ isLoading: false });
      return { success: false, error: err.message || 'Error processing Spotify authorization.' };
    }
  },

  logout: () => {
    // 1. Sign out from Supabase if configured
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        supabase.auth.signOut().catch(() => {});
      } catch {}
    }

    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_TOKEN);
    }
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isSupabase: false
    });

    // Synchronously purge player store user library data
    try {
      onLogoutCallback?.();
    } catch (e) {
      console.warn('Error during onLogoutCallback:', e);
    }

    try {
      import('@/store/playerStore').then((mod) => {
        mod.usePlayerStore.getState().handleUserLogout?.();
      }).catch(() => {});
    } catch {}
    get().setToast('You have been signed out.', 'info');
  }
}));
