"use client";

import React from 'react';

export default function SimpLogo({ className = "w-12 h-12" }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <img 
        src="/logo.png" 
        alt="VibeMusic Logo" 
        draggable={false}
        className="w-full h-full object-contain select-none pointer-events-none hover:scale-105 transition-transform" 
      />
    </div>
  );
}
