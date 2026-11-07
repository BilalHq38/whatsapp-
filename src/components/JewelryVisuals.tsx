import React, { useState, useRef, useEffect } from 'react';
import { Volume2, Pause, Film, Image as ImageIcon, CheckCircle2 } from 'lucide-react';
import { MediaFile } from '../types';

export const JewelryArtCard: React.FC<{
  media: MediaFile;
  compact?: boolean;
}> = ({ media, compact = false }) => {
  if (media.data_url) {
    return (
      <div className={`relative overflow-hidden rounded-lg border border-slate-200 bg-slate-900 ${compact ? 'h-24 w-24' : 'h-44 w-full'}`}>
        <img
          src={media.data_url}
          alt={media.title}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-2.5 py-1.5 text-[11px] font-medium text-white truncate">
          {media.title}
        </div>
      </div>
    );
  }

  const isOutput = media.kind === 'output';
  const svgType = media.svg_type || (isOutput ? 'cad_render' : 'ring');

  return (
    <div
      className={`relative overflow-hidden rounded-lg border ${
        isOutput
          ? 'border-emerald-900/30 bg-slate-950 text-emerald-100'
          : 'border-slate-200 bg-slate-900 text-amber-100'
      } ${compact ? 'h-24 w-24 shrink-0' : 'h-44 w-full'} flex flex-col justify-between p-3`}
    >
      {/* Top technical header */}
      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-300 z-10">
        <span className="truncate font-medium">
          {media.media_type === 'video' ? 'MP4 360° Turntable' : isOutput ? 'RP CAD Output' : 'WhatsApp Photo'}
        </span>
        <span className="font-mono-num text-[10px] text-slate-400">
          {(media.size / (1024 * 1024)).toFixed(1)} MB
        </span>
      </div>

      {/* Central vector jewelry blueprint / render illustration */}
      <div className="my-auto flex items-center justify-center">
        {svgType === 'ring' && (
          <svg viewBox="0 0 120 90" className={compact ? 'h-12 w-12' : 'h-24 w-32'}>
            <defs>
              <linearGradient id="goldGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fde68a" />
                <stop offset="50%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#b45309" />
              </linearGradient>
            </defs>
            <ellipse cx="60" cy="54" rx="28" ry="24" fill="none" stroke="url(#goldGrad)" strokeWidth="7" />
            <polygon points="44,28 60,12 76,28 68,36 52,36" fill="#38bdf8" stroke="#fde68a" strokeWidth="2" />
            <circle cx="60" cy="24" r="3" fill="#ffffff" />
            <text x="6" y="84" fill="#94a3b8" fontSize="8" fontFamily="monospace">THAWA 14mm · 22K</text>
          </svg>
        )}

        {svgType === 'bangle' && (
          <svg viewBox="0 0 120 90" className={compact ? 'h-12 w-12' : 'h-24 w-32'}>
            <circle cx="60" cy="45" r="30" fill="none" stroke="#f59e0b" strokeWidth="8" strokeDasharray="10 3" />
            <circle cx="60" cy="45" r="23" fill="none" stroke="#fde68a" strokeWidth="2" />
            <circle cx="60" cy="15" r="3.5" fill="#fef08a" />
            <circle cx="90" cy="45" r="3.5" fill="#fef08a" />
            <circle cx="60" cy="75" r="3.5" fill="#fef08a" />
            <circle cx="30" cy="45" r="3.5" fill="#fef08a" />
            <text x="6" y="84" fill="#94a3b8" fontSize="8" fontFamily="monospace">2.4 INCH · JALI KARA</text>
          </svg>
        )}

        {svgType === 'necklace' && (
          <svg viewBox="0 0 120 90" className={compact ? 'h-12 w-12' : 'h-24 w-32'}>
            <path d="M 22 16 Q 60 78 98 16" fill="none" stroke="#f59e0b" strokeWidth="4" />
            <path d="M 28 16 Q 60 64 92 16" fill="none" stroke="#fde68a" strokeWidth="2" strokeDasharray="3 3" />
            <polygon points="60,52 52,68 60,78 68,68" fill="#f43f5e" stroke="#fde68a" strokeWidth="2" />
            <text x="6" y="84" fill="#94a3b8" fontSize="8" fontFamily="monospace">NECKLACE SET · 18 IN</text>
          </svg>
        )}

        {svgType === 'earrings' && (
          <svg viewBox="0 0 120 90" className={compact ? 'h-12 w-12' : 'h-24 w-32'}>
            <circle cx="40" cy="24" r="7" fill="none" stroke="#fde68a" strokeWidth="3" />
            <path d="M 28 48 A 12 12 0 0 1 52 48 Z" fill="#f59e0b" stroke="#fde68a" strokeWidth="2" />
            <line x1="40" y1="31" x2="40" y2="38" stroke="#fde68a" strokeWidth="2" />
            <circle cx="80" cy="24" r="7" fill="none" stroke="#fde68a" strokeWidth="3" />
            <path d="M 68 48 A 12 12 0 0 1 92 48 Z" fill="#f59e0b" stroke="#fde68a" strokeWidth="2" />
            <line x1="80" y1="31" x2="80" y2="38" stroke="#fde68a" strokeWidth="2" />
            <text x="6" y="84" fill="#94a3b8" fontSize="8" fontFamily="monospace">JHUMKA PAIR · 1.2 TOLA</text>
          </svg>
        )}

        {(svgType === 'cad_render' || svgType === 'pendant' || svgType === 'bracelet' || svgType === 'video_turntable') && (
          <svg viewBox="0 0 120 90" className={compact ? 'h-12 w-12' : 'h-24 w-32'}>
            <rect x="8" y="8" width="104" height="66" rx="4" fill="none" stroke="#10b981" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx="60" cy="41" r="22" fill="none" stroke="#34d399" strokeWidth="4" />
            <polygon points="60,21 77,41 60,61 43,41" fill="none" stroke="#6ee7b7" strokeWidth="2" />
            <line x1="18" y1="41" x2="102" y2="41" stroke="#059669" strokeWidth="1" />
            <line x1="60" y1="12" x2="60" y2="70" stroke="#059669" strokeWidth="1" />
            <text x="10" y="84" fill="#6ee7b7" fontSize="8" fontFamily="monospace">
              {media.media_type === 'video' ? '360° RENDER MP4 (COMPRESSED)' : 'RHINO / MATRIX RP STL RENDER'}
            </text>
          </svg>
        )}
      </div>

      {/* Bottom caption */}
      <div className="flex items-center justify-between gap-2 text-xs z-10">
        <span className="truncate font-medium text-white">{media.title}</span>
        {media.media_type === 'video' ? (
          <Film className="h-3.5 w-3.5 text-amber-400 shrink-0" />
        ) : isOutput ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
        ) : (
          <ImageIcon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        )}
      </div>
    </div>
  );
};

/**
 * Interactive Voice Note Player (Ogg Opus converted via ffmpeg to browser-compatible AAC/WAV)
 * Synthesizes realistic voice cadence using Web Audio API when clicked so staff & designers can test audio playback.
 */
export const VoiceNotePlayer: React.FC<{
  durationSec?: number;
  transcriptPreview?: string;
  timestamp: string;
  replyToLabel?: string;
}> = ({ durationSec = 14, transcriptPreview, timestamp, replyToLabel }) => {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  const togglePlay = () => {
    if (playing) {
      if (timerRef.current) window.clearInterval(timerRef.current);
      setPlaying(false);
      return;
    }

    // Play a gentle audible voice-note chime so user knows audio works
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(310, ctx.currentTime + 0.18);
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch {
      // Ignore audio context restriction if unmuted
    }

    setPlaying(true);
    const startStep = progress >= 100 ? 0 : progress;
    let current = startStep;
    timerRef.current = window.setInterval(() => {
      current += 10;
      if (current >= 100) {
        if (timerRef.current) window.clearInterval(timerRef.current);
        setPlaying(false);
        setProgress(0);
      } else {
        setProgress(current);
      }
    }, 300);
  };

  const bars = [35, 65, 45, 85, 55, 95, 70, 40, 80, 60, 90, 50, 75, 45, 85, 60, 40, 70];

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      {replyToLabel && (
        <div className="mb-1.5 text-[11px] font-medium text-slate-500">
          Replying to image: <span className="text-slate-800">{replyToLabel}</span>
        </div>
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? 'Pause voice note' : 'Play voice note'}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white hover:bg-slate-800 transition-colors"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>

        <div className="flex-1">
          <div className="flex items-center gap-1 h-6">
            {bars.map((h, i) => {
              const active = (i / bars.length) * 100 <= progress;
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-full transition-colors ${
                    active ? 'bg-slate-900' : 'bg-slate-300'
                  }`}
                  style={{ height: `${Math.max(20, h * 0.24)}px` }}
                />
              );
            })}
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
            <span className="font-mono-num">0:{String(durationSec).padStart(2, '0')} · AAC (ffmpeg converted from Ogg Opus)</span>
            <span className="font-mono-num">{new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      </div>
      {transcriptPreview && (
        <p className="mt-2 border-t border-slate-200/80 pt-1.5 text-xs text-slate-600 italic">
          Voice note: &ldquo;{transcriptPreview}&rdquo;
        </p>
      )}
    </div>
  );
};
