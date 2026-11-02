"use client";

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { usePlayerStore } from '@/store/playerStore';
import { 
  Mail, 
  Lock, 
  User as UserIcon, 
  Eye, 
  EyeOff, 
  Loader2, 
  AlertCircle, 
  Info,
  ArrowLeft,
  Sparkles,
  Music,
  Mic2,
  ListMusic,
  Radio,
  CheckCircle2
} from 'lucide-react';

export default function AuthModal() {
  const { 
    isAuthModalOpen, 
    authModalMode, 
    authPromptReason, 
    closeAuthModal, 
    login, 
    register, 
    isLoading
  } = useAuthStore();

  const { fetchUserLibrary } = usePlayerStore();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync mode with store when modal opens
  useEffect(() => {
    if (isAuthModalOpen) {
      if (authModalMode === 'login' || authModalMode === 'register') {
        setMode(authModalMode);
      }
      setError(null);
    }
  }, [isAuthModalOpen, authModalMode]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAuthModalOpen) {
        closeAuthModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthModalOpen, closeAuthModal]);

  if (!isAuthModalOpen) return null;

  const handleClose = () => {
    setError(null);
    closeAuthModal();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    try {
      if (mode === 'register') {
        if (!displayName.trim()) {
          setError('Please enter your display name.');
          return;
        }
        const res = await register(cleanEmail, password, displayName.trim());
        if (!res.success) {
          setError(res.error || 'Registration failed.');
          return;
        }
        const token = useAuthStore.getState().token;
        if (token) {
          await fetchUserLibrary(token);
        }
      } else {
        const res = await login(cleanEmail, password);
        if (!res.success) {
          setError(res.error || 'Invalid email or password.');
          return;
        }
        const token = useAuthStore.getState().token;
        if (token) {
          await fetchUserLibrary(token);
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication error. Please check your backend connection.');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] w-screen h-screen bg-[#07070a] text-white flex flex-col overflow-hidden select-none animate-in fade-in duration-300">
      {/* Background Ambient Glow Orbs */}
      <div className="fixed top-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#00d2c4]/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-sky-600/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-teal-500/10 rounded-full blur-[160px] pointer-events-none" />

      {/* Top Navigation Bar */}
      <header className="relative flex-shrink-0 w-full backdrop-blur-xl bg-black/40 border-b border-white/5 px-4 sm:px-8 py-2.5 sm:py-3 flex items-center justify-between z-20">
        <button
          onClick={handleClose}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/10 text-xs font-semibold backdrop-blur-md transition-all cursor-pointer hover:scale-105 active:scale-95"
          title="Back to music player"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Music</span>
        </button>

        {/* Center Brand */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 pointer-events-none">
          <img 
            src="/logo.png" 
            alt="VibeMusic" 
            className="w-6 h-6 object-contain" 
          />
          <span className="text-sm sm:text-base font-extrabold tracking-tight text-white">
            Vibe<span className="text-[#00d2c4]">Music</span>
          </span>
        </div>
      </header>

      {/* Main Single-Window Content: No scrollbars on desktop */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-8 py-3 sm:py-6 flex flex-col lg:flex-row items-center justify-between gap-6 lg:gap-12 min-h-0 overflow-y-auto lg:overflow-hidden z-10">
        
        {/* Left Side: Brand Showcase & 4 Listener-Centric Feature Boxes */}
        <div className="flex-1 w-full max-w-xl text-center lg:text-left space-y-4 sm:space-y-5">
          {/* Logo & Live Soundwave Pill */}
          <div className="flex items-center justify-center lg:justify-start gap-3">
            <img 
              src="/logo.png" 
              alt="VibeMusic" 
              className="w-12 h-12 sm:w-14 sm:h-14 object-contain" 
            />
            <div className="flex items-center gap-1 h-7 px-3 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
              <span className="w-1 h-2.5 bg-[#00d2c4] rounded-full animate-wave-1" />
              <span className="w-1 h-4 bg-[#00d2c4] rounded-full animate-wave-2" />
              <span className="w-1 h-3 bg-[#00d2c4] rounded-full animate-wave-3" />
              <span className="w-1 h-5 bg-[#00d2c4] rounded-full animate-wave-1" />
              <span className="w-1 h-2.5 bg-[#00d2c4] rounded-full animate-wave-2" />
              <span className="text-[10px] font-bold text-neutral-300 ml-1.5 uppercase tracking-wider">
                Unlimited Music
              </span>
            </div>
          </div>

          {/* Hero Headings */}
          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-[1.1]">
              Your Music Universe.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d2c4] via-teal-300 to-sky-400">
                Pure sound. Zero limits.
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-neutral-400 max-w-lg leading-relaxed mx-auto lg:mx-0">
              Stream millions of songs with real-time lyrics, smart taste discovery, and unlimited personal playlists.
            </p>
          </div>

          {/* 4 Listener-Centric Feature Boxes (No tech stack/database/spotify import jargon) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
            {/* Box 1: Ad-Free Music */}
            <div className="p-3 sm:p-3.5 rounded-2xl bg-white/[0.04] border border-white/5 backdrop-blur-md space-y-1 text-left hover:border-white/10 transition-colors">
              <div className="flex items-center gap-2 text-[#00d2c4]">
                <Music className="w-4 h-4" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-white">Ad-Free Streaming</h4>
              </div>
              <p className="text-[11px] sm:text-xs text-neutral-400 leading-normal">
                Listen to millions of songs, top hits, and albums with zero audio ads or interruptions.
              </p>
            </div>

            {/* Box 2: Synced Live Lyrics */}
            <div className="p-3 sm:p-3.5 rounded-2xl bg-white/[0.04] border border-white/5 backdrop-blur-md space-y-1 text-left hover:border-white/10 transition-colors">
              <div className="flex items-center gap-2 text-sky-400">
                <Mic2 className="w-4 h-4" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-white">Live Synced Lyrics</h4>
              </div>
              <p className="text-[11px] sm:text-xs text-neutral-400 leading-normal">
                Sing along to every beat with real-time word-by-word lyrics for songs in any language.
              </p>
            </div>

            {/* Box 3: Smart Radio & Discovery */}
            <div className="p-3 sm:p-3.5 rounded-2xl bg-white/[0.04] border border-white/5 backdrop-blur-md space-y-1 text-left hover:border-white/10 transition-colors">
              <div className="flex items-center gap-2 text-[#facc15]">
                <Radio className="w-4 h-4" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-white">Smart Radio Mixes</h4>
              </div>
              <p className="text-[11px] sm:text-xs text-neutral-400 leading-normal">
                Enjoy endless auto-generated music queues tuned perfectly to your unique music vibe.
              </p>
            </div>

            {/* Box 4: Custom Playlists & Favorites */}
            <div className="p-3 sm:p-3.5 rounded-2xl bg-white/[0.04] border border-white/5 backdrop-blur-md space-y-1 text-left hover:border-white/10 transition-colors">
              <div className="flex items-center gap-2 text-purple-400">
                <ListMusic className="w-4 h-4" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-white">Personal Playlists</h4>
              </div>
              <p className="text-[11px] sm:text-xs text-neutral-400 leading-normal">
                Save songs you love with one tap and create custom playlists for workouts, focus, and chill.
              </p>
            </div>
          </div>

          {/* Trust Banner */}
          <div className="flex items-center justify-center lg:justify-start gap-2 text-[11px] text-neutral-400 pt-0.5">
            <Sparkles className="w-3.5 h-3.5 text-[#00d2c4] flex-shrink-0" />
            <span>Free forever &bull; Unlimited skips &bull; No payment required</span>
          </div>
        </div>

        {/* Right Side: Compact, Single-Window Auth Form Card */}
        <div className="w-full max-w-md flex-shrink-0">
          <div className="relative bg-[#121217]/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-5 sm:p-7 shadow-[0_20px_50px_rgba(0,0,0,0.8)] space-y-4 overflow-hidden">
            
            {/* Top Card Ambient Highlight */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-12 bg-[#00d2c4]/20 blur-2xl pointer-events-none rounded-full" />

            {/* Header Title & Subtitle */}
            <div className="text-center space-y-1 relative">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {mode === 'login' ? 'Welcome Back' : 'Create Free Account'}
              </h2>
              <p className="text-xs text-neutral-400 max-w-xs mx-auto">
                {authPromptReason || (mode === 'login' 
                  ? 'Sign in to access your saved playlists and favorites' 
                  : 'Join to save favorite songs and sync playlists across all your devices')}
              </p>
            </div>

            {/* Context Prompt Banner if triggered by action */}
            {authPromptReason && (
              <div className="p-2.5 rounded-xl bg-[#00d2c4]/10 border border-[#00d2c4]/20 text-[#00d2c4] text-xs flex items-center gap-2">
                <Info className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{authPromptReason}</span>
              </div>
            )}

            {/* Segmented Tab Switcher */}
            <div className="grid grid-cols-2 p-1 bg-black/50 border border-white/5 rounded-xl">
              <button
                type="button"
                onClick={() => { setMode('login'); setError(null); }}
                className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  mode === 'login'
                    ? 'bg-[#1e1e24] text-white shadow border border-white/10'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setMode('register'); setError(null); }}
                className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  mode === 'register'
                    ? 'bg-[#1e1e24] text-white shadow border border-white/10'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Create Account
              </button>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2 animate-in fade-in duration-150">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Auth Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === 'register' && (
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-neutral-300 ml-1">
                    Your Name
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Alex Rivera"
                      className="w-full bg-black/60 border border-white/10 focus:border-[#00d2c4] focus:ring-1 focus:ring-[#00d2c4]/40 rounded-xl pl-9 pr-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-neutral-300 ml-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full bg-black/60 border border-white/10 focus:border-[#00d2c4] focus:ring-1 focus:ring-[#00d2c4]/40 rounded-xl pl-9 pr-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-neutral-300 ml-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full bg-black/60 border border-white/10 focus:border-[#00d2c4] focus:ring-1 focus:ring-[#00d2c4]/40 rounded-xl pl-9 pr-9 py-2.5 text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white cursor-pointer"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-1.5 py-3 px-4 rounded-xl bg-gradient-to-r from-[#00d2c4] via-teal-300 to-[#00d2c4] hover:brightness-110 text-black font-extrabold text-xs sm:text-sm transition-all shadow-[0_4px_20px_rgba(0,210,196,0.3)] hover:shadow-[0_4px_28px_rgba(0,210,196,0.45)] active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>{mode === 'login' ? 'Sign In to VibeMusic' : 'Create Free Account'}</span>
                )}
              </button>
            </form>

            {/* Guest fallback button */}
            <button
              type="button"
              onClick={handleClose}
              className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/10 text-xs font-semibold transition-all cursor-pointer"
            >
              Continue as Guest
            </button>

            {/* Footer switch prompt */}
            <div className="text-center text-xs text-neutral-400">
              {mode === 'login' ? (
                <p>
                  Don&apos;t have an account yet?{' '}
                  <button
                    type="button"
                    onClick={() => { setMode('register'); setError(null); }}
                    className="text-[#00d2c4] hover:underline font-bold cursor-pointer ml-1"
                  >
                    Sign up free
                  </button>
                </p>
              ) : (
                <p>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setError(null); }}
                    className="text-[#00d2c4] hover:underline font-bold cursor-pointer ml-1"
                  >
                    Sign in
                  </button>
                </p>
              )}
            </div>

            {/* Privacy note */}
            <p className="text-[10px] text-neutral-500 text-center leading-normal">
              Secure Cloud Account &bull; Protected by VibeMusic
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
