import React from 'react';

interface StatusBadgeProps {
  isPaid: boolean;
  isPartial?: boolean;
  className?: string;
}

export function StatusBadge({ isPaid, isPartial = false, className = '' }: StatusBadgeProps) {
  if (isPaid) {
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 uppercase tracking-wide ${className}`}>
        <span className="text-[10px]">✓</span> PAID
      </span>
    );
  }

  if (isPartial) {
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 uppercase tracking-wide ${className}`}>
        <span className="text-[10px]">~</span> PARTIAL
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted/40 text-muted-foreground uppercase tracking-wide border border-border/40 ${className}`}>
      UNPAID
    </span>
  );
}
