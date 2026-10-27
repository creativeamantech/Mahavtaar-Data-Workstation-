/**
 * Mahavtaar Enterprise Design Tokens & Theme Constants
 */

export const BUCKET_COLORS: Record<string, { bg: string; text: string; border: string; hex: string }> = {
  CURRENT: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-500/30',
    hex: '#10b981',
  },
  '1-30': {
    bg: 'bg-blue-500/10 dark:bg-blue-500/15',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-500/30',
    hex: '#3b82f6',
  },
  '31-60': {
    bg: 'bg-amber-500/10 dark:bg-amber-500/15',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-500/30',
    hex: '#f59e0b',
  },
  '61-90': {
    bg: 'bg-orange-500/10 dark:bg-orange-500/15',
    text: 'text-orange-700 dark:text-orange-300',
    border: 'border-orange-500/30',
    hex: '#ea580c',
  },
  NPA: {
    bg: 'bg-rose-500/10 dark:bg-rose-500/15',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-500/30',
    hex: '#e11d48',
  },
};

export const DISP_COLORS: Record<string, { bg: string; text: string; border: string; hex: string }> = {
  Paid: {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-500/30',
    hex: '#10b981',
  },
  Settled: {
    bg: 'bg-teal-500/15',
    text: 'text-teal-600 dark:text-teal-400',
    border: 'border-teal-500/30',
    hex: '#14b8a6',
  },
  PTP: {
    bg: 'bg-blue-500/15',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-500/30',
    hex: '#3b82f6',
  },
  RTP: {
    bg: 'bg-amber-500/15',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-500/30',
    hex: '#f59e0b',
  },
  RNR: {
    bg: 'bg-slate-500/15',
    text: 'text-slate-600 dark:text-slate-400',
    border: 'border-slate-500/30',
    hex: '#64748b',
  },
  NC: {
    bg: 'bg-rose-500/15',
    text: 'text-rose-600 dark:text-rose-400',
    border: 'border-rose-500/30',
    hex: '#f43f5e',
  },
};

export const ROLE_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  ADMIN: {
    bg: 'bg-purple-500/15 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300 border-purple-500/30',
    text: 'text-purple-600 dark:text-purple-300',
    label: 'Administrator',
  },
  MANAGER: {
    bg: 'bg-sky-500/15 dark:bg-sky-500/20 text-sky-600 dark:text-sky-300 border-sky-500/30',
    text: 'text-sky-600 dark:text-sky-300',
    label: 'Operations Manager',
  },
  EXECUTIVE: {
    bg: 'bg-blue-500/15 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 border-blue-500/30',
    text: 'text-blue-600 dark:text-blue-300',
    label: 'Collection Executive',
  },
  VIEWER: {
    bg: 'bg-slate-500/15 dark:bg-slate-500/20 text-slate-600 dark:text-slate-300 border-slate-500/30',
    text: 'text-slate-600 dark:text-slate-300',
    label: 'Auditor / Viewer',
  },
};
