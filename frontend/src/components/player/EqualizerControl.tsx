'use client';

import React, { useMemo, useCallback, useRef } from 'react';
import { 
  useSettingsStore, 
  EQUALIZER_PRESETS, 
  EqualizerPresetKey, 
  EqualizerBands 
} from '@/store/settingsStore';
import { SlidersHorizontal, RotateCcw, Check } from 'lucide-react';

interface BandConfig {
  freq: keyof EqualizerBands;
  label: string;
  role: string;
}

const BANDS: BandConfig[] = [
  { freq: 60, label: '60 Hz', role: 'Sub-Bass' },
  { freq: 230, label: '230 Hz', role: 'Punch' },
  { freq: 910, label: '910 Hz', role: 'Vocals' },
  { freq: 3600, label: '3.6 kHz', role: 'Presence' },
  { freq: 14000, label: '14 kHz', role: 'Air' },
];

const N = 5;
const MAX = 12;
const STEP = 0.5;

const X0 = 65;
const X1 = 435;
const TOP = 30;
const BOT = 225;
const MID = (TOP + BOT) / 2; // 127.5

export const EqualizerControl: React.FC = () => {
  const {
    equalizerEnabled,
    equalizerPreset,
    equalizerBands,
    setEqualizerEnabled,
    setEqualizerPreset,
    setEqualizerBand,
    resetEqualizer,
  } = useSettingsStore();

  const svgRef = useRef<SVGSVGElement>(null);

  // Calculate X coordinates for the 5 bands
  const xs = useMemo(() => {
    return Array.from({ length: N }, (_, i) => X0 + (i / (N - 1)) * (X1 - X0));
  }, []);

  // Calculate Y coordinates based on current gain
  const ys = useMemo(() => {
    return BANDS.map((band) => {
      const gain = equalizerEnabled ? (equalizerBands[band.freq] ?? 0) : 0;
      const range = MID - TOP; // 97.5
      return MID - (gain / MAX) * range;
    });
  }, [equalizerEnabled, equalizerBands]);

  // Compute smooth cubic bezier path for curve and filled area
  const { curvePath, areaPath } = useMemo(() => {
    let curve = `M ${xs[0]} ${ys[0]}`;
    for (let i = 0; i < N - 1; i++) {
      const p0 = i > 0 ? { x: xs[i - 1], y: ys[i - 1] } : { x: xs[i], y: ys[i] };
      const p1 = { x: xs[i], y: ys[i] };
      const p2 = { x: xs[i + 1], y: ys[i + 1] };
      const p3 = i < N - 2 ? { x: xs[i + 2], y: ys[i + 2] } : { x: xs[i + 1], y: ys[i + 1] };

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      curve += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
    }

    const area = `${curve} L ${xs[N - 1]} ${MID} L ${xs[0]} ${MID} Z`;
    return { curvePath: curve, areaPath: area };
  }, [xs, ys]);

  // Interactive dragging mapped to SVG coordinates
  const handlePointerDown = useCallback((_bandIndex: number, freq: keyof EqualizerBands, e: React.PointerEvent) => {
    if (!equalizerEnabled) return;
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const updateFromPointer = (clientY: number) => {
      const pt = svgEl.createSVGPoint();
      pt.x = e.clientX;
      pt.y = clientY;
      const ctm = svgEl.getScreenCTM();
      if (!ctm) return;
      const svgPoint = pt.matrixTransform(ctm.inverse());

      const range = MID - TOP; // 97.5
      const rawVal = ((MID - svgPoint.y) / range) * MAX;
      const clamped = Math.max(-MAX, Math.min(MAX, rawVal));
      const snapped = Math.round(clamped / STEP) * STEP;
      setEqualizerBand(freq, snapped);
    };

    updateFromPointer(e.clientY);

    const onPointerMove = (moveEvt: PointerEvent) => {
      updateFromPointer(moveEvt.clientY);
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }, [equalizerEnabled, setEqualizerBand]);

  // Keyboard accessibility (ArrowUp/ArrowDown)
  const handleKeyDown = useCallback((freq: keyof EqualizerBands, e: React.KeyboardEvent) => {
    if (!equalizerEnabled) return;
    const current = equalizerBands[freq] ?? 0;
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setEqualizerBand(freq, Math.min(MAX, current + STEP));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setEqualizerBand(freq, Math.max(-MAX, current - STEP));
    }
  }, [equalizerEnabled, equalizerBands, setEqualizerBand]);

  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5 sm:p-6 space-y-6">
      <style jsx>{`
        .eq-panel {
          --bg: transparent;
          --panel: #0a0a0a;
          --grid: rgba(255, 255, 255, 0.07);
          --track: #212836;
          --accent: #00d2c4;
          --soft: rgba(0, 210, 196, 0.15);
        }

        .grid-line {
          stroke: var(--grid);
          stroke-width: 1;
        }

        .zero-line {
          stroke: #4a5468;
          stroke-width: 1.5;
          stroke-dasharray: 4 5;
        }

        .eq-track {
          stroke: var(--track);
          stroke-width: 4.5;
          stroke-linecap: round;
        }

        .eq-stem {
          stroke: var(--accent);
          stroke-width: 3.5;
          stroke-linecap: round;
          opacity: 0.75;
        }

        .eq-curve {
          fill: none;
          stroke: var(--accent);
          stroke-width: 3;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .eq-area {
          fill: var(--soft);
        }

        .eq-knob {
          fill: var(--accent);
          stroke: #0a0a0a;
          stroke-width: 2.5;
        }

        .eq-band-hit {
          fill: transparent;
          cursor: ns-resize;
          outline: none;
        }

        .eq-band-hit:focus-visible {
          fill: var(--soft);
        }
      `}</style>

      {/* Header & Master Bypass Switch */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 shrink-0">
            <SlidersHorizontal className="w-4 h-4" />
          </div>
          <h3 className="text-sm sm:text-base font-semibold text-white tracking-wide">
            Graphic Equalizer
          </h3>
        </div>

        {/* Master Toggle Switch */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-neutral-400 hidden sm:inline">
            {equalizerEnabled ? 'EQ On' : 'EQ Off'}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={equalizerEnabled}
            onClick={() => setEqualizerEnabled(!equalizerEnabled)}
            className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out shrink-0 ${
              equalizerEnabled ? 'bg-teal-500 justify-end' : 'bg-neutral-700 justify-start'
            }`}
          >
            <div className="w-4 h-4 rounded-full bg-white shadow-md transform transition-transform" />
          </button>
        </div>
      </div>

      {/* Medium Size SVG Equalizer (Directly within Graphic Equalizer Card Container, No Separate Inner Box) */}
      <div className={`eq-panel w-full max-w-[580px] mx-auto transition-opacity duration-200 ${
        equalizerEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'
      }`}>
        <svg
          ref={svgRef}
          id="eq"
          viewBox="0 0 500 275"
          role="group"
          aria-label="Graphic equalizer"
          className="w-full h-auto block touch-none select-none overflow-visible"
        >
          {/* Horizontal Grid Lines */}
          <g id="grid">
            {/* +12 dB Line */}
            <line x1={X0 - 25} y1={TOP} x2={X1 + 25} y2={TOP} className="grid-line" />
            <text x={X0 - 32} y={TOP + 4} textAnchor="end" fill="#64748b" fontSize="10" fontFamily="monospace">+12</text>

            {/* +6 dB Line */}
            <line x1={X0 - 25} y1={(TOP + MID) / 2} x2={X1 + 25} y2={(TOP + MID) / 2} className="grid-line" />
            <text x={X0 - 32} y={(TOP + MID) / 2 + 4} textAnchor="end" fill="#475569" fontSize="10" fontFamily="monospace">+6</text>

            {/* 0 dB Dashed Zero Line */}
            <line x1={X0 - 25} y1={MID} x2={X1 + 25} y2={MID} className="zero-line" />
            <text x={X0 - 32} y={MID + 4} textAnchor="end" fill="#94a3b8" fontSize="10" fontFamily="monospace" fontWeight="bold">0</text>

            {/* -6 dB Line */}
            <line x1={X0 - 25} y1={(MID + BOT) / 2} x2={X1 + 25} y2={(MID + BOT) / 2} className="grid-line" />
            <text x={X0 - 32} y={(MID + BOT) / 2 + 4} textAnchor="end" fill="#475569" fontSize="10" fontFamily="monospace">-6</text>

            {/* -12 dB Line */}
            <line x1={X0 - 25} y1={BOT} x2={X1 + 25} y2={BOT} className="grid-line" />
            <text x={X0 - 32} y={BOT + 4} textAnchor="end" fill="#64748b" fontSize="10" fontFamily="monospace">-12</text>
          </g>

          {/* Vertical Slider Tracks */}
          <g id="tracks">
            {BANDS.map((band, i) => (
              <line
                key={`track-${band.freq}`}
                className="eq-track"
                x1={xs[i]}
                y1={TOP}
                x2={xs[i]}
                y2={BOT}
              />
            ))}
          </g>

          {/* Filled Area under Curve */}
          <path className="eq-area" id="area" d={areaPath} />

          {/* Active Glowing Stems (Zero to Knob) */}
          <g id="stems">
            {BANDS.map((band, i) => (
              <line
                key={`stem-${band.freq}`}
                className="eq-stem"
                x1={xs[i]}
                y1={MID}
                x2={xs[i]}
                y2={ys[i]}
              />
            ))}
          </g>

          {/* Smooth Continuous Spline Curve */}
          <path className="eq-curve" id="curve" d={curvePath} />

          {/* Draggable Knobs */}
          <g id="knobs">
            {BANDS.map((band, i) => (
              <g key={`knob-group-${band.freq}`}>
                {/* Luminous Glow Halo */}
                <circle
                  cx={xs[i]}
                  cy={ys[i]}
                  r={11}
                  fill="#00d2c4"
                  opacity={0.25}
                  className="pointer-events-none"
                />
                {/* Knob Head */}
                <circle
                  className="eq-knob pointer-events-none"
                  cx={xs[i]}
                  cy={ys[i]}
                  r={8}
                />
              </g>
            ))}
          </g>

          {/* Hit Areas, Live Badges & Frequency Labels */}
          <g id="hits">
            {BANDS.map((band, i) => {
              const gain = equalizerEnabled ? (equalizerBands[band.freq] ?? 0) : 0;
              return (
                <g key={`hit-${band.freq}`}>
                  {/* Transparent Wide Vertical Drag Hit-Box */}
                  <rect
                    className="eq-band-hit"
                    x={xs[i] - 32}
                    y={TOP - 12}
                    width={64}
                    height={BOT - TOP + 24}
                    tabIndex={0}
                    role="slider"
                    aria-label={`${band.label} gain`}
                    aria-valuenow={gain}
                    aria-valuemin={-12}
                    aria-valuemax={12}
                    onPointerDown={(e) => handlePointerDown(i, band.freq, e)}
                    onKeyDown={(e) => handleKeyDown(band.freq, e)}
                  />

                  {/* Top Live dB Numeric Value */}
                  <text
                    x={xs[i]}
                    y={TOP - 12}
                    textAnchor="middle"
                    fill={gain !== 0 && equalizerEnabled ? '#00d2c4' : '#64748b'}
                    fontSize="11"
                    fontWeight="700"
                    fontFamily="monospace"
                    className="select-none pointer-events-none"
                  >
                    {gain > 0 ? `+${gain.toFixed(1)}` : gain.toFixed(1)}
                  </text>

                  {/* Frequency Center Label */}
                  <text
                    x={xs[i]}
                    y={BOT + 22}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="12"
                    fontWeight="700"
                    className="select-none pointer-events-none"
                  >
                    {band.label}
                  </text>

                  {/* Frequency Role Sub-Label */}
                  <text
                    x={xs[i]}
                    y={BOT + 36}
                    textAnchor="middle"
                    fill="#64748b"
                    fontSize="10"
                    fontWeight="500"
                    className="select-none pointer-events-none uppercase tracking-wider"
                  >
                    {band.role}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Preset Pill Selector */}
      <div className="space-y-2 pt-2 border-t border-white/5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider block">
            Acoustic Presets
          </label>

          {/* Reset Flat Action (When non-flat) */}
          {equalizerPreset !== 'flat' && (
            <button
              onClick={resetEqualizer}
              className="text-[11px] text-teal-400 hover:text-teal-300 font-medium shrink-0 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Reset Flat
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {(Object.keys(EQUALIZER_PRESETS) as (Exclude<EqualizerPresetKey, 'custom'>)[]).map((key) => {
            const isSelected = equalizerPreset === key;
            const preset = EQUALIZER_PRESETS[key];
            return (
              <button
                key={key}
                onClick={() => setEqualizerPreset(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-teal-500/20 border-teal-500/60 text-teal-300 shadow-sm shadow-teal-500/10 font-semibold'
                    : 'bg-white/[0.03] border-white/5 text-neutral-300 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  {isSelected && <Check className="w-3 h-3 text-teal-400" />}
                  <span>{preset.name}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
