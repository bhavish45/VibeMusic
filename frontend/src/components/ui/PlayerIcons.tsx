import React from 'react';

/**
 * Spotify-styled Skip Back (Previous Track) icon with solid filled triangle and vertical end-bar.
 */
export function SkipBackIcon({ className = 'w-6 h-6', ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg 
      viewBox="0 0 16 16" 
      fill="currentColor" 
      className={className} 
      aria-hidden="true"
      {...props}
    >
      <path d="M3.3 1a.7.7 0 0 1 .7.7v5.15l9.95-5.744a.7.7 0 0 1 1.05.606v12.575a.7.7 0 0 1-1.05.607L4 9.149V14.3a.7.7 0 0 1-.7.7H1.7a.7.7 0 0 1-.7-.7V1.7a.7.7 0 0 1 .7-.7h1.6z" />
    </svg>
  );
}

/**
 * Spotify-styled Skip Forward (Next Track) icon with solid filled triangle and vertical end-bar.
 */
export function SkipForwardIcon({ className = 'w-6 h-6', ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg 
      viewBox="0 0 16 16" 
      fill="currentColor" 
      className={className} 
      aria-hidden="true"
      {...props}
    >
      <path d="M12.7 1a.7.7 0 0 0-.7.7v5.15L2.05 1.107A.7.7 0 0 0 1 1.712v12.575a.7.7 0 0 0 1.05.607L12 9.149V14.3a.7.7 0 0 0 .7.7h1.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7h-1.6z" />
    </svg>
  );
}
