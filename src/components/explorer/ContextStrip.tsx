import React from 'react';
import { fmtCur } from '../../lib/formatters';
import { Download } from 'lucide-react';

interface ContextStripProps {
  totalRecords: number;
  totalPos: number;
  paidCount: number;
  clearedAmount: number;
  onExport: () => void;
  isLoading?: boolean;
}

export function ContextStrip({
  totalRecords,
  totalPos,
  paidCount,
  clearedAmount,
  onExport,
  isLoading = false
}: ContextStripProps) {
  const paidPct = totalRecords > 0 ? (paidCount / totalRecords) * 100 : 0;

  const getPaidPctColor = () => {
    if (paidPct >= 40) return 'text-emerald-600 dark:text-emerald-400';
    if (paidPct >= 20) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="w-full bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-border border-l-4 border-l-primary rounded-xl px-4 py-2.5 mb-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-medium">
        <div className="flex items-center gap-1.5">
          <span className="font-mono tabular-nums font-semibold text-foreground text-sm">
            {totalRecords.toLocaleString()}
          </span>
          <span className="text-muted-foreground uppercase text-[10px] font-bold tracking-wider">records</span>
        </div>

        <span className="text-muted-foreground/40 hidden sm:inline">·</span>

        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground text-[11px]">POS:</span>
          <span className="font-mono tabular-nums font-bold text-foreground text-sm">
            {fmtCur(totalPos)}
          </span>
        </div>

        <span className="text-muted-foreground/40 hidden sm:inline">·</span>

        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground text-[11px]">Paid:</span>
          <span className={`font-mono tabular-nums font-bold text-sm ${getPaidPctColor()}`}>
            {paidPct.toFixed(1)}%
          </span>
          <span className="text-[10px] text-muted-foreground font-mono">
            ({paidCount.toLocaleString()}/{totalRecords.toLocaleString()})
          </span>
        </div>

        <span className="text-muted-foreground/40 hidden sm:inline">·</span>

        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground text-[11px]">Cleared:</span>
          <span className="font-mono tabular-nums font-bold text-sky-600 dark:text-sky-400 text-sm">
            {fmtCur(clearedAmount)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
        <button
          onClick={onExport}
          disabled={totalRecords === 0 || isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-all shadow-xs"
          title="Export current filtered view to CSV (Ctrl+E)"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Export CSV</span>
        </button>
      </div>
    </div>
  );
}
