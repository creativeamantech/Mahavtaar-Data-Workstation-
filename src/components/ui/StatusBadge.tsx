import React from 'react';
import { cn } from '@/lib/utils';

export type StatusBadgeVariant =
  | 'paid'
  | 'unpaid'
  | 'bucket'
  | 'manual'
  | 'file'
  | 'info'
  | 'admin'
  | 'manager'
  | 'executive'
  | 'viewer'
  | 'healthy'
  | 'warning'
  | 'critical'
  | 'ptp'
  | 'rnr'
  | 'rtp'
  | 'settled';

const variantConfig: Record<
  StatusBadgeVariant,
  { bg: string; text: string; border: string; dot: string }
> = {
  paid: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-500/25',
    dot: 'bg-emerald-500',
  },
  settled: {
    bg: 'bg-teal-500/10 dark:bg-teal-500/15',
    text: 'text-teal-700 dark:text-teal-300',
    border: 'border-teal-500/25',
    dot: 'bg-teal-500',
  },
  unpaid: {
    bg: 'bg-rose-500/10 dark:bg-rose-500/15',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-500/25',
    dot: 'bg-rose-500',
  },
  bucket: {
    bg: 'bg-blue-500/10 dark:bg-blue-500/15',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-500/25',
    dot: 'bg-blue-500',
  },
  ptp: {
    bg: 'bg-blue-500/10 dark:bg-blue-500/15',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-500/25',
    dot: 'bg-blue-500',
  },
  rtp: {
    bg: 'bg-amber-500/10 dark:bg-amber-500/15',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-500/25',
    dot: 'bg-amber-500',
  },
  rnr: {
    bg: 'bg-slate-500/10 dark:bg-slate-500/15',
    text: 'text-slate-700 dark:text-slate-300',
    border: 'border-slate-500/25',
    dot: 'bg-slate-500',
  },
  manual: {
    bg: 'bg-sky-500/10 dark:bg-sky-500/15',
    text: 'text-sky-700 dark:text-sky-300',
    border: 'border-sky-500/25',
    dot: 'bg-sky-500',
  },
  file: {
    bg: 'bg-purple-500/10 dark:bg-purple-500/15',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-500/25',
    dot: 'bg-purple-500',
  },
  info: {
    bg: 'bg-sky-500/10 dark:bg-sky-500/15',
    text: 'text-sky-700 dark:text-sky-300',
    border: 'border-sky-500/25',
    dot: 'bg-sky-500',
  },
  admin: {
    bg: 'bg-purple-500/10 dark:bg-purple-500/15',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-500/25',
    dot: 'bg-purple-500',
  },
  manager: {
    bg: 'bg-sky-500/10 dark:bg-sky-500/15',
    text: 'text-sky-700 dark:text-sky-300',
    border: 'border-sky-500/25',
    dot: 'bg-sky-500',
  },
  executive: {
    bg: 'bg-blue-500/10 dark:bg-blue-500/15',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-500/25',
    dot: 'bg-blue-500',
  },
  viewer: {
    bg: 'bg-muted',
    text: 'text-muted-foreground',
    border: 'border-border',
    dot: 'bg-muted-foreground',
  },
  healthy: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-500/25',
    dot: 'bg-emerald-500',
  },
  warning: {
    bg: 'bg-amber-500/10 dark:bg-amber-500/15',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-500/25',
    dot: 'bg-amber-500',
  },
  critical: {
    bg: 'bg-rose-500/10 dark:bg-rose-500/15',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-500/25',
    dot: 'bg-rose-500',
  },
};

interface StatusBadgeProps {
  variant: StatusBadgeVariant | string;
  children: React.ReactNode;
  showDot?: boolean;
  className?: string;
}

export function StatusBadge({
  variant,
  children,
  showDot = true,
  className,
}: StatusBadgeProps) {
  const normalizedKey = (variant?.toLowerCase() || 'info') as StatusBadgeVariant;
  const config = variantConfig[normalizedKey] || variantConfig.info;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wider',
        config.bg,
        config.text,
        config.border,
        className
      )}
    >
      {showDot && (
        <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', config.dot)} />
      )}
      <span>{children}</span>
    </span>
  );
}
