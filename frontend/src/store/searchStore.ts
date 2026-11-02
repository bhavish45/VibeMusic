import { create } from 'zustand';
import { Track } from '@/store/playerStore';

interface SearchStore {
  query: string;
  submittedQuery: string;
  activeChip: string;
  recentSearches: string[];
  suggestions: string[];
  quickSongs: Track[];
  quickArtist: any | null;
  showDropdown: boolean;

  setQuery: (query: string) => void;
  setSubmittedQuery: (submittedQuery: string) => void;
  setActiveChip: (chip: string) => void;
  setShowDropdown: (show: boolean) => void;
  setSuggestions: (suggestions: string[]) => void;
  setQuickSongs: (songs: Track[]) => void;
  setQuickArtist: (artist: any | null) => void;
  
  initRecentSearches: () => void;
  saveRecentSearch: (term: string) => void;
  clearRecentSearches: () => void;
  removeRecentSearch: (term: string) => void;
  triggerSearch: (term: string) => void;
  clearSearch: () => void;
}

export const useSearchStore = create<SearchStore>((set, get) => ({
  query: '',
  submittedQuery: '',
  activeChip: 'All',
  recentSearches: [],
  suggestions: [],
  quickSongs: [],
  quickArtist: null,
  showDropdown: false,

  setQuery: (query) => set({ query }),
  setSubmittedQuery: (submittedQuery) => set({ submittedQuery }),
  setActiveChip: (activeChip) => set({ activeChip }),
  setShowDropdown: (showDropdown) => set({ showDropdown }),
  setSuggestions: (suggestions) => set({ suggestions }),
  setQuickSongs: (quickSongs) => set({ quickSongs }),
  setQuickArtist: (quickArtist) => set({ quickArtist }),

  initRecentSearches: () => {
    try {
      const stored = localStorage.getItem('vibemusic_recent_searches');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          set({ recentSearches: parsed.slice(0, 5) });
        }
      }
    } catch (e) {
      console.error('Failed to load recent searches from localStorage:', e);
    }
  },

  saveRecentSearch: (term: string) => {
    const clean = term.trim();
    if (!clean) return;
    const prev = get().recentSearches;
    const filtered = prev.filter(s => s.toLowerCase() !== clean.toLowerCase());
    const updated = [clean, ...filtered].slice(0, 5);
    try {
      localStorage.setItem('vibemusic_recent_searches', JSON.stringify(updated));
    } catch (e) {}
    set({ recentSearches: updated });
  },

  clearRecentSearches: () => {
    try {
      localStorage.removeItem('vibemusic_recent_searches');
    } catch (e) {}
    set({ recentSearches: [] });
  },

  removeRecentSearch: (termToRemove: string) => {
    const prev = get().recentSearches;
    const updated = prev.filter(s => s.toLowerCase() !== termToRemove.toLowerCase());
    try {
      localStorage.setItem('vibemusic_recent_searches', JSON.stringify(updated));
    } catch (e) {}
    set({ recentSearches: updated });
  },

  triggerSearch: (term: string) => {
    const clean = term.trim();
    if (!clean) return;
    get().saveRecentSearch(clean);
    set({
      query: clean,
      submittedQuery: clean,
      showDropdown: false
    });
  },

  clearSearch: () => {
    set({
      query: '',
      submittedQuery: '',
      suggestions: [],
      quickSongs: [],
      quickArtist: null,
      showDropdown: true
    });
  }
}));
