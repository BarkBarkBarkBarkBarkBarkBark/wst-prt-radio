'use client';

import { useEffect, useRef } from 'react';

interface AudioMetersProps {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  className?: string;
}

type MeterGraph = {
  context: AudioContext;
  analyser: AnalyserNode;
  leftAnalyser: AnalyserNode;
  rightAnalyser: AnalyserNode;
  source: MediaElementAudioSourceNode;
  splitter: ChannelSplitterNode;
};

function drawRoundedBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.fillStyle = '#121212';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (let x = 0; x < width; x += 32) {
    ctx.fillRect(x, 0, 1, height);
  }
  for (let y = 0; y < height; y += 24) {
    ctx.fillRect(0, y, width, 1);
  }
}

export function AudioMeters({ audioRef, className = '' }: AudioMetersProps) {
  const spectrumCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const scopeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const graphRef = useRef<MeterGraph | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    const spectrumCanvas = spectrumCanvasRef.current;
    const scopeCanvas = scopeCanvasRef.current;
    const phaseCanvas = phaseCanvasRef.current;

    if (!audio || !spectrumCanvas || !scopeCanvas || !phaseCanvas) {
      return;
    }

    if (!graphRef.current) {
      const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) {
        return;
      }

      const context = new AudioContextClass();
      const source = context.createMediaElementSource(audio);
      const analyser = context.createAnalyser();
      const leftAnalyser = context.createAnalyser();
      const rightAnalyser = context.createAnalyser();
      const splitter = context.createChannelSplitter(2);

      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.82;
      leftAnalyser.fftSize = 1024;
      rightAnalyser.fftSize = 1024;
      leftAnalyser.smoothingTimeConstant = 0.68;
      rightAnalyser.smoothingTimeConstant = 0.68;

      source.connect(analyser);
      analyser.connect(context.destination);
      source.connect(splitter);
      splitter.connect(leftAnalyser, 0);
      splitter.connect(rightAnalyser, 1);

      const resume = () => {
        if (context.state !== 'running') {
          void context.resume();
        }
      };

      audio.addEventListener('play', resume);
      audio.addEventListener('canplay', resume);

      graphRef.current = {
        context,
        analyser,
        leftAnalyser,
        rightAnalyser,
        source,
        splitter,
      };
    }

    const graph = graphRef.current;
    if (!graph) {
      return;
    }

    const freqData = new Uint8Array(graph.analyser.frequencyBinCount);
    const waveformData = new Uint8Array(graph.analyser.fftSize);
    const leftData = new Uint8Array(graph.leftAnalyser.fftSize);
    const rightData = new Uint8Array(graph.rightAnalyser.fftSize);

    const draw = () => {
      animationFrameRef.current = window.requestAnimationFrame(draw);

      const spectrumCtx = spectrumCanvas.getContext('2d');
      const scopeCtx = scopeCanvas.getContext('2d');
      const phaseCtx = phaseCanvas.getContext('2d');
      if (!spectrumCtx || !scopeCtx || !phaseCtx) {
        return;
      }

      graph.analyser.getByteFrequencyData(freqData);
      graph.analyser.getByteTimeDomainData(waveformData);
      graph.leftAnalyser.getByteTimeDomainData(leftData);
      graph.rightAnalyser.getByteTimeDomainData(rightData);

      drawRoundedBackground(spectrumCtx, spectrumCanvas.width, spectrumCanvas.height);
      const barCount = 48;
      const step = Math.max(1, Math.floor(freqData.length / barCount));
      const barWidth = spectrumCanvas.width / barCount;
      for (let i = 0; i < barCount; i += 1) {
        const value = freqData[i * step] ?? 0;
        const height = (value / 255) * (spectrumCanvas.height - 18);
        const x = i * barWidth;
        const hue = 12 + i * 2.3;
        spectrumCtx.fillStyle = `hsla(${hue}, 85%, 58%, 0.95)`;
        spectrumCtx.fillRect(x + 2, spectrumCanvas.height - height - 8, Math.max(2, barWidth - 4), height);
      }
      spectrumCtx.fillStyle = 'rgba(255,255,255,0.75)';
      spectrumCtx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
      spectrumCtx.fillText('SPECTRUM', 10, 16);

      drawRoundedBackground(scopeCtx, scopeCanvas.width, scopeCanvas.height);
      scopeCtx.lineWidth = 2;
      scopeCtx.strokeStyle = 'rgba(87, 255, 204, 0.95)';
      scopeCtx.beginPath();
      for (let i = 0; i < waveformData.length; i += 1) {
        const x = (i / (waveformData.length - 1)) * scopeCanvas.width;
        const y = ((waveformData[i] ?? 128) / 255) * scopeCanvas.height;
        if (i === 0) {
          scopeCtx.moveTo(x, y);
        } else {
          scopeCtx.lineTo(x, y);
        }
      }
      scopeCtx.stroke();
      scopeCtx.fillStyle = 'rgba(255,255,255,0.75)';
      scopeCtx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
      scopeCtx.fillText('WAVEFORM', 10, 16);

      drawRoundedBackground(phaseCtx, phaseCanvas.width, phaseCanvas.height);
      phaseCtx.fillStyle = 'rgba(255,255,255,0.75)';
      phaseCtx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
      phaseCtx.fillText('STEREO PHASE', 10, 16);
      phaseCtx.strokeStyle = 'rgba(255,255,255,0.12)';
      phaseCtx.beginPath();
      phaseCtx.moveTo(phaseCanvas.width / 2, 0);
      phaseCtx.lineTo(phaseCanvas.width / 2, phaseCanvas.height);
      phaseCtx.moveTo(0, phaseCanvas.height / 2);
      phaseCtx.lineTo(phaseCanvas.width, phaseCanvas.height / 2);
      phaseCtx.stroke();
      phaseCtx.fillStyle = 'rgba(255, 90, 48, 0.38)';
      for (let i = 0; i < leftData.length; i += 8) {
        const x = ((leftData[i] ?? 128) / 255) * phaseCanvas.width;
        const y = ((rightData[i] ?? 128) / 255) * phaseCanvas.height;
        phaseCtx.fillRect(x, y, 2, 2);
      }
    };

    draw();

    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [audioRef]);

  return (
    <div className={`grid gap-3 md:grid-cols-[1.2fr_0.8fr] ${className}`}>
      <canvas ref={spectrumCanvasRef} width={960} height={180} className="h-36 w-full rounded-[1.4rem] border border-stone-700/20 bg-black shadow-inner" />
      <div className="grid gap-3">
        <canvas ref={scopeCanvasRef} width={520} height={110} className="h-[6.6rem] w-full rounded-[1.4rem] border border-stone-700/20 bg-black shadow-inner" />
        <canvas ref={phaseCanvasRef} width={520} height={110} className="h-[6.6rem] w-full rounded-[1.4rem] border border-stone-700/20 bg-black shadow-inner" />
      </div>
    </div>
  );
}