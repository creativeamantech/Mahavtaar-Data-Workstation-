/**
 * Mahavtaar Ledger — Institutional Financial & Data Formatters
 * Fully backwards-compatible with existing domain tests and components.
 */

export const fmtCur = (n: number | null | undefined): string => {
  if (n == null || isNaN(n) || n === 0) return '—';
  return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
};

export const fmtCompactCur = (n: number | null | undefined): string => {
  if (n == null || isNaN(n) || n === 0) return '—';
  const val = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (val >= 10000000) {
    return `${sign}₹${(val / 10000000).toFixed(2)}Cr`;
  }
  if (val >= 100000) {
    return `${sign}₹${(val / 100000).toFixed(2)}L`;
  }
  if (val >= 1000) {
    return `${sign}₹${(val / 1000).toFixed(1)}k`;
  }
  return `${sign}₹${val.toLocaleString('en-IN')}`;
};

export const fmtPct = (n: number | null | undefined): string => {
  if (n == null || isNaN(n)) return '0.00%';
  return (n * 100).toFixed(2) + '%';
};

export const fmtNum = (n: number | null | undefined): string => {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
};

export const fmtDate = (d: string | Date | null | undefined): string => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
};

export const fmtDateTime = (d: string | Date | null | undefined): string => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('en-IN', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return '—';
  }
};

export const pctColor = (pct: number): string => {
  if (pct >= 0.5) return 'text-success font-semibold';
  if (pct >= 0.3) return 'text-primary font-semibold';
  return 'text-destructive font-semibold';
};

export const targetColor = (target: number): string =>
  target <= 0 ? 'text-success font-semibold' : 'text-primary font-semibold';

export const getVarianceBadge = (current: number, target: number) => {
  const diff = current - target;
  const pct = target > 0 ? (diff / target) * 100 : 0;
  const isAhead = diff >= 0;
  return {
    isAhead,
    diff,
    pct,
    label: isAhead ? `+${pct.toFixed(1)}%` : `${pct.toFixed(1)}%`,
    statusText: isAhead ? 'Ahead of Target' : 'Below Target',
    badgeClass: isAhead 
      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
  };
};
