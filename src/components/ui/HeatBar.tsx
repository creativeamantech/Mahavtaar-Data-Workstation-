import React from 'react';

interface HeatBarProps {
  pct: number;
  showBar?: boolean;
  showBadge?: boolean;
  className?: string;
}

export function HeatBar({ pct, showBar = true, showBadge = false, className = '' }: HeatBarProps) {
  const clamped = Math.min(1, Math.max(0, isNaN(pct) ? 0 : pct));
  const pctNum = Math.round(clamped * 100);

  // Sophisticated gradient and color tokens
  const color =
    clamped >= 0.85
      ? '#059669' // Emerald
      : clamped >= 0.70
      ? '#10b981' // Green
      : clamped >= 0.50
      ? '#d97706' // Amber
      : clamped >= 0.30
      ? '#ea580c' // Orange
      : '#e11d48'; // Rose

  const bgHue =
    clamped >= 0.85
      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
      : clamped >= 0.70
      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
      : clamped >= 0.50
      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
      : clamped >= 0.30
      ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30'
      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30';

  return (
    <div className={`flex items-center gap-2 justify-end ${className}`}>
      {showBar && (
        <div className="w-14 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden shrink-0">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${pctNum}%`, backgroundColor: color }}
          />
        </div>
      )}
      <span
        className={`font-mono font-bold tabular-nums text-xs text-right min-w-[38px] ${
          showBadge ? `px-1.5 py-0.5 rounded border text-[11px] ${bgHue}` : ''
        }`}
        style={!showBadge ? { color } : undefined}
      >
        {pctNum}%
      </span>
    </div>
  );
}

/**
 * Returns background and text color classes for entire table cells to create a heatmap matrix effect.
 */
export function getHeatmapCellClass(pct: number): string {
  const clamped = Math.min(1, Math.max(0, isNaN(pct) ? 0 : pct));
  if (clamped >= 0.85) return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold';
  if (clamped >= 0.70) return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold';
  if (clamped >= 0.50) return 'bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold';
  if (clamped >= 0.30) return 'bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold';
  return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold';
}
