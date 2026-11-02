import { create } from 'zustand';

interface NavigationState {
  currentPath: string | null;
  navigate: (href: string) => void;
  syncWithLocation: () => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  currentPath: null,
  navigate: (href: string) => {
    if (typeof window !== 'undefined') {
      if (window.location.pathname !== href) {
        window.history.pushState({}, '', href);
      }
    }
    set({ currentPath: href });
  },
  syncWithLocation: () => {
    if (typeof window !== 'undefined') {
      set({ currentPath: window.location.pathname });
    }
  }
}));
