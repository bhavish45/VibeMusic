"use client";

import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { User as UserIcon, LogOut } from 'lucide-react';

interface UserButtonProps {
  className?: string;
}

export default function UserButton({ className = "" }: UserButtonProps) {
  const { user, isAuthenticated, openAuthModal, logout } = useAuthStore();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isUserMenuOpen]);

  if (!isAuthenticated || !user) {
    return (
      <button
        type="button"
        onClick={() => openAuthModal('login')}
        className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 rounded-full bg-gradient-to-r from-teal-500/10 to-[#5AF9DB]/20 hover:from-teal-500/20 hover:to-[#5AF9DB]/30 border border-[#5AF9DB]/40 hover:border-[#5AF9DB] text-xs font-semibold text-white transition-all shadow-[0_0_15px_rgba(90,249,219,0.15)] active:scale-95 cursor-pointer whitespace-nowrap select-none ${className}`}
        title="Sign In / Register"
      >
        <UserIcon className="w-3.5 h-3.5 text-[#5AF9DB]" />
        <span className="tracking-tight">Sign In</span>
      </button>
    );
  }

  return (
    <div className={`relative ${className}`} ref={userMenuRef}>
      <button
        type="button"
        onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
        className="flex items-center justify-center rounded-full transition-transform hover:scale-105 active:scale-95 cursor-pointer focus:outline-none"
        title={user.displayName}
        aria-label={user.displayName}
      >
        {user.avatarUrl ? (
          <img 
            src={user.avatarUrl} 
            alt={user.displayName} 
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover shadow-[0_0_15px_rgba(90,249,219,0.25)] ring-2 ring-[#5AF9DB]/40 hover:ring-[#5AF9DB] transition-all" 
          />
        ) : (
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-[#5AF9DB] to-teal-300 text-black font-black text-sm sm:text-base flex items-center justify-center shadow-[0_0_15px_rgba(90,249,219,0.3)] ring-2 ring-[#5AF9DB]/40 hover:ring-[#5AF9DB] transition-all">
            {user.displayName.charAt(0).toUpperCase()}
          </div>
        )}
      </button>

      {/* User Profile Dropdown Menu */}
      {isUserMenuOpen && (
        <div className="absolute right-0 top-12 w-64 bg-[#141419] border border-white/10 rounded-2xl shadow-2xl p-4 z-40 animate-in fade-in zoom-in-95 duration-150 select-none">
          {/* User Info Header */}
          <div className="flex items-center gap-3 pb-3 border-b border-white/10">
            {user.avatarUrl ? (
              <img 
                src={user.avatarUrl} 
                alt={user.displayName} 
                className="w-10 h-10 rounded-full object-cover" 
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#5AF9DB] to-teal-400 text-black font-bold text-sm flex items-center justify-center">
                {user.displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{user.displayName}</p>
              <p className="text-xs text-neutral-400 truncate">{user.email}</p>
            </div>
          </div>

          {/* Sign Out Button */}
          <button
            type="button"
            onClick={() => {
              logout();
              setIsUserMenuOpen(false);
            }}
            className="w-full mt-2.5 flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-red-500/10 text-xs font-semibold text-red-400 hover:text-red-300 transition-colors cursor-pointer text-left"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
}
