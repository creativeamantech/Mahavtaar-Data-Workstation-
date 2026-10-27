import React from 'react';

interface BucketBadgeProps {
  bkt: string | number;
  className?: string;
}

export function BucketBadge({ bkt, className = '' }: BucketBadgeProps) {
  const strBkt = String(bkt ?? '').trim();
  const num = Number(strBkt);

  if (strBkt.toUpperCase() === 'NPA' || strBkt.toUpperCase().includes('NPA')) {
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border bg-rose-950/40 text-rose-400 border-rose-800/40 ${className}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0"></span>
        <span>NPA</span>
      </span>
    );
  }

  if (isNaN(num) || strBkt === '' || strBkt === '-') {
    return (
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground ${className}`}>
        -
      </span>
    );
  }

  if (num <= 1) {
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30 ${className}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-yellow-500 shrink-0"></span>
        <span>● {num}</span>
      </span>
    );
  }

  if (num === 2) {
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30 ${className}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-orange-500 shrink-0"></span>
        <span>● {num}</span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 ${className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0"></span>
      <span>● {num}</span>
    </span>
  );
}

export function getBucketRowBorder(bkt: string | number): string {
  const str = String(bkt ?? '').trim();
  const num = Number(str);
  if (str.toUpperCase().includes('NPA') || num >= 3) {
    return 'border-l-2 border-l-red-500';
  }
  if (num === 2) {
    return 'border-l-2 border-l-orange-500';
  }
  if (num <= 1 && !isNaN(num)) {
    return 'border-l-2 border-l-yellow-500';
  }
  return 'border-l-2 border-l-transparent';
}
