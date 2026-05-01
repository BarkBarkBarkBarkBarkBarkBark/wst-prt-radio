'use client';

/**
 * AudioVisualizer — plugs into an <audio> element via Web Audio API.
 *
 * Modes:
 *   bars   — frequency bars (react-audio-visualize LiveAudioVisualizer via MediaRecorder)
 *   wave   — waveform oscilloscope (canvas)
 *   scope  — zoomed waveform (canvas)
 *   phase  — stereo Lissajous (canvas)
 *
 * Presets control bar width, gap, fftSize, smoothing, and color palette.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

const LiveAudioVisualizer = dynamic(
  () => import('react-audio-visualize').then((m) => ({ default: m.LiveAudioVisualizer })),
  { ssr: false, loading: () => <div className="h-full w-full bg-[#0e0e0e]" /> },
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type VisMode = 'bars' | 'wave' | 'scope' | 'phase';

interface Preset {
  label: string;
  barWidth: number;
  gap: number;
  fftSize: number;
  smoothing: number;
  barColor: string;
}

interface AudioVisualizerProps {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  className?: string;
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

const PRESETS: Preset[] = [
  { label: 'Classic',  barWidth: 4,  gap: 1, fftSize: 2048, smoothing: 0.82, barColor: 'rgba(255,120,40,0.92)'   },
  { label: 'Chunky',   barWidth: 12, gap: 3, fftSize: 512,  smoothing: 0.74, barColor: 'rgba(183,53,36,0.95)'    },
  { label: 'Slim',     barWidth: 2,  gap: 0, fftSize: 4096, smoothing: 0.88, barColor: 'rgba(87,255,204,0.90)'   },
  { label: 'Micro',    barWidth: 1,  gap: 0, fftSize: 8192, smoothing: 0.92, barColor: 'rgba(255,220,80,0.85)'   },
  { label: 'Neon',     barWidth: 3,  gap: 2, fftSize: 1024, smoothing: 0.65, barColor: 'rgba(180,60,255,0.93)'   },
];

const MODES: { id: VisMode; label: string }[] = [
  { id: 'bars',  label: '▌ Bars'  },
  { id: 'wave',  label: '∿ Wave'  },
  { id: 'scope', label: '◌ Scope' },
  { id: 'phase', label: '⊕ Phase' },
];

const BG = '#0e0e0e';

// ---------------------------------------------------------------------------
// Helper — canvas draw functions
// ---------------------------------------------------------------------------

function drawWave(
  ctx: CanvasRenderingContext2D,
  data: Uint8Array,
  w: number,
  h: number,
  color: string,
  label: string,
) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, w, h);
  // subtle grid
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y < h; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  // centre line
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
  // waveform
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < data.length; i++) {
    const x = (i / (data.length - 1)) * w;
    const y = (data[i]! / 255) * h;
    if (i === 0) { ctx.moveTo(x, y); } else { ctx.lineTo(x, y); }
  }
  ctx.stroke();
  // label
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '10px ui-monospace, Menlo, monospace';
  ctx.fillText(label, 8, 14);
}

function drawPhase(
  ctx: CanvasRenderingContext2D,
  left: Uint8Array,
  right: Uint8Array,
  w: number,
  h: number,
  color: string,
) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, w, h);
  // axes
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
  // dots
  ctx.fillStyle = color;
  const step = Math.max(1, Math.floor(left.length / 512));
  for (let i = 0; i < left.length; i += step) {
    const x = (left[i]! / 255) * w;
    const y = (right[i]! / 255) * h;
    ctx.fillRect(x - 1, y - 1, 2, 2);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '10px ui-monospace, Menlo, monospace';
  ctx.fillText('PHASE', 8, 14);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AudioVisualizer({ audioRef, className = '' }: AudioVisualizerProps) {
  const [mode, setMode] = useState<VisMode>('bars');
  const [presetIdx, setPresetIdx] = useState(0);
  const preset = PRESETS[presetIdx]!;

  // MediaRecorder for LiveAudioVisualizer (bars mode)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

  // Canvas for wave/scope/phase modes
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);

  // Web Audio graph (shared for canvas modes)
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const leftRef = useRef<AnalyserNode | null>(null);
  const rightRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  // Build the Web Audio graph once
  const buildGraph = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || audioCtxRef.current) return;

    const AudioCtxClass =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtxClass) return;

    const ctx = new AudioCtxClass();
    const source = ctx.createMediaElementSource(audio);
    const analyser = ctx.createAnalyser();
    const left = ctx.createAnalyser();
    const right = ctx.createAnalyser();
    const splitter = ctx.createChannelSplitter(2);

    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.82;
    left.fftSize = 1024; left.smoothingTimeConstant = 0.7;
    right.fftSize = 1024; right.smoothingTimeConstant = 0.7;

    source.connect(analyser);
    analyser.connect(ctx.destination);
    source.connect(splitter);
    splitter.connect(left, 0);
    splitter.connect(right, 1);

    const resume = () => { if (ctx.state !== 'running') void ctx.resume(); };
    audio.addEventListener('play', resume);
    audio.addEventListener('canplay', resume);

    audioCtxRef.current = ctx;
    analyserRef.current = analyser;
    leftRef.current = left;
    rightRef.current = right;
    sourceRef.current = source;

    // Also build MediaRecorder for bars mode using captureStream
    if (typeof (audio as HTMLAudioElement & { captureStream?: () => MediaStream }).captureStream === 'function') {
      try {
        const stream = (audio as HTMLAudioElement & { captureStream: () => MediaStream }).captureStream();
        const recorder = new MediaRecorder(stream);
        recorder.start();
        setMediaRecorder(recorder);
      } catch {
        // captureStream not supported — bars mode will fall back to canvas
      }
    }
  }, [audioRef]);

  // Resume AudioContext on any user interaction
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => {
      if (!audioCtxRef.current) buildGraph();
      if (audioCtxRef.current?.state !== 'running') void audioCtxRef.current?.resume();
    };
    audio.addEventListener('play', onPlay);
    return () => audio.removeEventListener('play', onPlay);
  }, [audioRef, buildGraph]);

  // Canvas animation loop for wave / scope / phase
  useEffect(() => {
    if (mode === 'bars') {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const loop = () => {
      frameRef.current = requestAnimationFrame(loop);
      const analyser = analyserRef.current;
      if (!analyser) { buildGraph(); return; }

      const ctx2d = canvas.getContext('2d');
      if (!ctx2d) return;
      const { width: w, height: h } = canvas;

      if (mode === 'wave' || mode === 'scope') {
        const data = new Uint8Array(analyser.fftSize);
        analyser.getByteTimeDomainData(data);
        const sliceData = mode === 'scope' ? data.slice(0, data.length >> 2) : data;
        drawWave(ctx2d, sliceData, w, h, preset.barColor, mode === 'scope' ? 'SCOPE' : 'WAVEFORM');
      } else if (mode === 'phase') {
        const l = leftRef.current;
        const r = rightRef.current;
        if (!l || !r) return;
        const ld = new Uint8Array(l.fftSize);
        const rd = new Uint8Array(r.fftSize);
        l.getByteTimeDomainData(ld);
        r.getByteTimeDomainData(rd);
        drawPhase(ctx2d, ld, rd, w, h, preset.barColor);
      }
    };

    frameRef.current = requestAnimationFrame(loop);
    return () => { if (frameRef.current !== null) cancelAnimationFrame(frameRef.current); };
  }, [mode, preset.barColor, buildGraph]);

  // Knob label for preset cycle
  const btnBase =
    'px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider rounded border transition-all ';

  const activeBtn = btnBase + 'border-amber-500/70 text-amber-400 bg-amber-500/10';
  const inactiveBtn = btnBase + 'border-white/10 text-white/40 hover:border-white/30 hover:text-white/70 bg-transparent';

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Mode buttons */}
        <div className="flex gap-1">
          {MODES.map(({ id, label }) => (
            <button key={id} onClick={() => setMode(id)} className={id === mode ? activeBtn : inactiveBtn}>
              {label}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-white/10" />

        {/* Preset buttons */}
        <div className="flex gap-1">
          {PRESETS.map((p, i) => (
            <button key={p.label} onClick={() => setPresetIdx(i)} className={i === presetIdx ? activeBtn : inactiveBtn}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Visualizer canvas area */}
      <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-[#0e0e0e] shadow-inner" style={{ height: 160 }}>
        {mode === 'bars' && mediaRecorder ? (
          <LiveAudioVisualizer
            mediaRecorder={mediaRecorder}
            width="100%"
            height={160}
            barWidth={preset.barWidth}
            gap={preset.gap}
            fftSize={preset.fftSize as 128|256|512|1024|2048|4096|8192|16384|32768}
            maxDecibels={-10}
            minDecibels={-90}
            smoothingTimeConstant={preset.smoothing}
            backgroundColor={BG}
            barColor={preset.barColor}
          />
        ) : mode === 'bars' ? (
          // captureStream not available — fall back to waveform canvas with a note
          <canvas
            ref={canvasRef}
            width={960}
            height={160}
            className="h-full w-full"
            style={{ imageRendering: 'pixelated' }}
          />
        ) : (
          <canvas
            ref={canvasRef}
            width={960}
            height={160}
            className="h-full w-full"
            style={{ imageRendering: 'pixelated' }}
          />
        )}
      </div>
    </div>
  );
}
