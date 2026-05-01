'use client';

/**
 * VolumeKnob — SVG rotary knob.
 *
 * - Drag vertically (or horizontally) to sweep 0–100.
 * - Turns from 7 o'clock (−135°) at 0 to 5 o'clock (+135°) at 100.
 * - At value === 0 the arc pulses amber; above 0 it glows solid.
 * - Touch-friendly via Pointer Events.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

interface VolumeKnobProps {
  value: number;          // 0–100
  onChange: (v: number) => void;
  size?: number;          // px, default 72
  label?: string;
}

const MIN_ANGLE = -135; // degrees, 7 o'clock
const MAX_ANGLE =  135; // degrees, 5 o'clock
const RANGE = MAX_ANGLE - MIN_ANGLE; // 270

function valueToAngle(v: number) {
  return MIN_ANGLE + (v / 100) * RANGE;
}

function polarToXY(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const s = polarToXY(cx, cy, r, startDeg);
  const e = polarToXY(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

export function VolumeKnob({ value, onChange, size = 72, label = 'VOL' }: VolumeKnobProps) {
  const knobRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ startY: number; startVal: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const angle = valueToAngle(value);
  const cx = size / 2;
  const cy = size / 2;
  const trackR = size * 0.34;
  const knobR  = size * 0.28;
  const dotR   = size * 0.18;

  // Pointer on SVG element
  const onPointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startY: e.clientY, startVal: value };
    setDragging(true);
  }, [value]);

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: PointerEvent) => {
      if (!dragRef.current) return;
      const dy = dragRef.current.startY - e.clientY; // up = louder
      const delta = (dy / 120) * 100;
      const next = Math.max(0, Math.min(100, dragRef.current.startVal + delta));
      onChange(Math.round(next));
    };

    const onUp = () => {
      dragRef.current = null;
      setDragging(false);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging, onChange]);

  // Tick mark position (shows current value)
  const tick = polarToXY(cx, cy, dotR, angle);

  // Filled arc from MIN to current angle
  const filledArc = value > 0
    ? describeArc(cx, cy, trackR, MIN_ANGLE, Math.min(angle, MAX_ANGLE - 0.01))
    : '';

  const trackArc = describeArc(cx, cy, trackR, MIN_ANGLE, MAX_ANGLE - 0.01);

  const arcColor = value === 0 ? '#78350f' : '#f59e0b'; // amber-900 / amber-400
  const glowColor = value > 0 ? 'drop-shadow(0 0 6px rgba(245,158,11,0.7))' : 'none';

  return (
    <div className="flex flex-col items-center gap-1 select-none" style={{ width: size }}>
      <svg
        ref={knobRef}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        onPointerDown={onPointerDown}
        className={`cursor-grab ${dragging ? 'cursor-grabbing' : ''}`}
        style={{ filter: glowColor, touchAction: 'none' }}
        aria-label={`${label} ${value}`}
        role="slider"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {/* Track arc */}
        <path d={trackArc} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth={size * 0.055} strokeLinecap="round" />

        {/* Filled arc */}
        {value > 0 && (
          <path d={filledArc} fill="none" stroke={arcColor} strokeWidth={size * 0.055} strokeLinecap="round" />
        )}

        {/* Knob body */}
        <circle cx={cx} cy={cy} r={knobR} fill="#1a1a1a" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
        <circle cx={cx} cy={cy} r={knobR - 2} fill="url(#knobGrad)" />

        {/* Tick (indicator line) */}
        <line
          x1={cx}
          y1={cy}
          x2={tick.x}
          y2={tick.y}
          stroke={value === 0 ? 'rgba(255,255,255,0.25)' : arcColor}
          strokeWidth={size * 0.045}
          strokeLinecap="round"
        />

        {/* Pulse ring at 0 */}
        {value === 0 && (
          <circle cx={cx} cy={cy} r={knobR + 2} fill="none" stroke="rgba(245,158,11,0.25)" strokeWidth={1}>
            <animate attributeName="r" values={`${knobR}; ${knobR + 5}; ${knobR}`} dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.4; 0.1; 0.4" dur="2s" repeatCount="indefinite" />
          </circle>
        )}

        <defs>
          <radialGradient id="knobGrad" cx="38%" cy="32%" r="70%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.12)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
        </defs>
      </svg>

      {/* Label + value */}
      <div className="text-center font-mono text-[9px] uppercase tracking-widest text-white/40">
        {label}
      </div>
      <div className="font-mono text-[11px] text-amber-400/80">
        {value === 0 ? '—' : value}
      </div>
    </div>
  );
}
