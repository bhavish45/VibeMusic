"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useSettingsStore } from '@/store/settingsStore';

interface SmoothBackgroundProps {
  /** The CSS background-image string (e.g., linear-gradient(...)) */
  gradient: string;
  /** Optional color for a blurred ambient top glow orb */
  glowColor?: string;
  /** Duration of crossfade in milliseconds (default: 700ms for smooth transition) */
  durationMs?: number;
  /** Optional track key (e.g. videoId) */
  trackKey?: string;
  /** Optional additional class names for the outer container */
  className?: string;
}

/**
 * High-performance dual-layer crossfading background.
 * Smoothly morphs from one gradient to the next using GPU-accelerated opacity
 * transitions when songs finish or skip.
 */
export default function SmoothBackground({
  gradient,
  glowColor,
  durationMs = 700,
  trackKey,
  className = ''
}: SmoothBackgroundProps) {
  const { dynamicTheming } = useSettingsStore();

  const effectiveGradient = dynamicTheming ? gradient : 'linear-gradient(to bottom, #000000 0%, #000000 100%)';
  const effectiveGlow = dynamicTheming ? glowColor : 'transparent';

  const [layer0, setLayer0] = useState({ gradient: effectiveGradient, glow: effectiveGlow });
  const [layer1, setLayer1] = useState({ gradient: effectiveGradient, glow: effectiveGlow });
  const [activeLayer, setActiveLayer] = useState<0 | 1>(0);

  const prevGradientRef = useRef(effectiveGradient);
  const prevGlowRef = useRef(effectiveGlow);

  useEffect(() => {
    // Only crossfade if the gradient or glow color genuinely changed
    if (effectiveGradient === prevGradientRef.current && effectiveGlow === prevGlowRef.current) return;
    prevGradientRef.current = effectiveGradient;
    prevGlowRef.current = effectiveGlow;

    if (activeLayer === 0) {
      setLayer1({ gradient: effectiveGradient, glow: effectiveGlow });
      setActiveLayer(1);
    } else {
      setLayer0({ gradient: effectiveGradient, glow: effectiveGlow });
      setActiveLayer(0);
    }
  }, [effectiveGradient, effectiveGlow, activeLayer]);

  return (
    <div 
      className={`fixed inset-0 pointer-events-none -z-10 overflow-hidden bg-[#0a0a0c] select-none ${className}`}
      aria-hidden="true"
    >
      {/* Layer 0 */}
      <div 
        className="absolute inset-0 transform-gpu"
        style={{
          backgroundImage: layer0.gradient,
          opacity: activeLayer === 0 ? 1 : 0,
          zIndex: activeLayer === 0 ? 2 : 1,
          transition: `opacity ${durationMs}ms cubic-bezier(0.4, 0, 0.2, 1)`,
          willChange: 'opacity'
        }}
      >
        {layer0.glow && (
          <div 
            className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full blur-[120px] opacity-25 transform-gpu"
            style={{ backgroundColor: layer0.glow }}
          />
        )}
      </div>

      {/* Layer 1 */}
      <div 
        className="absolute inset-0 transform-gpu"
        style={{
          backgroundImage: layer1.gradient,
          opacity: activeLayer === 1 ? 1 : 0,
          zIndex: activeLayer === 1 ? 2 : 1,
          transition: `opacity ${durationMs}ms cubic-bezier(0.4, 0, 0.2, 1)`,
          willChange: 'opacity'
        }}
      >
        {layer1.glow && (
          <div 
            className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full blur-[120px] opacity-25 transform-gpu"
            style={{ backgroundColor: layer1.glow }}
          />
        )}
      </div>
    </div>
  );
}
