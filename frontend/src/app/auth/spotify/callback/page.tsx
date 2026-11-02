"use client";

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { usePlayerStore } from '@/store/playerStore';
import { Loader2, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

function SpotifyCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { handleSpotifyCallback } = useAuthStore();
  const { fetchUserLibrary } = usePlayerStore();

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setStatus('error');
      setErrorMessage(`Spotify authorization was denied: ${errorParam}`);
      return;
    }

    if (!code) {
      setStatus('error');
      setErrorMessage('No authorization code received from Spotify.');
      return;
    }

    const processAuth = async () => {
      try {
        const res = await handleSpotifyCallback(code);
        if (res.success) {
          setStatus('success');
          const token = useAuthStore.getState().token;
          if (token) {
            await fetchUserLibrary(token);
          }
          setTimeout(() => {
            router.push('/library');
          }, 1500);
        } else {
          setStatus('error');
          setErrorMessage(res.error || 'Failed to authenticate with Spotify.');
        }
      } catch (err: any) {
        setStatus('error');
        setErrorMessage(err.message || 'An unexpected error occurred.');
      }
    };

    processAuth();
  }, [searchParams, handleSpotifyCallback, fetchUserLibrary, router]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-[#121216] border border-white/10 rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-20 bg-[#1DB954]/20 blur-3xl pointer-events-none rounded-full" />

        {status === 'loading' && (
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-[#1DB954]/10 border border-[#1DB954]/30 flex items-center justify-center mx-auto text-[#1DB954]">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-white">Connecting with Spotify...</h2>
            <p className="text-sm text-neutral-400">
              Importing your saved playlists and tracks into VibeMusic.
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-[#1DB954]/20 border border-[#1DB954]/40 flex items-center justify-center mx-auto text-[#1DB954]">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-white">Connected Successfully!</h2>
            <p className="text-sm text-neutral-400">
              Your Spotify playlists have been loaded. Taking you to your library...
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-white">Authentication Failed</h2>
            <p className="text-sm text-neutral-400">{errorMessage}</p>
            <button
              onClick={() => router.push('/')}
              className="mt-4 px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-colors"
            >
              Return Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SpotifyCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[70vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#1DB954]" />
      </div>
    }>
      <SpotifyCallbackContent />
    </Suspense>
  );
}
