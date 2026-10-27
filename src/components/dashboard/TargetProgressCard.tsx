import React from 'react';
import { Target, Clock } from 'lucide-react';
import { fmtCur } from '../../lib/formatters';

interface ProgressRingProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  bgColor?: string;
  children?: React.ReactNode;
}

export function ProgressRing({
  percentage,
  size = 52,
  strokeWidth = 4.5,
  color,
  bgColor = 'stroke-muted/40',
  children,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPct = Math.min(Math.max(percentage, 0), 100);
  const strokeDashoffset = circumference - (clampedPct / 100) * circumference;
  const defaultColor =
    clampedPct >= 80
      ? 'stroke-emerald-500'
      : clampedPct >= 50
      ? 'stroke-amber-500'
      : 'stroke-rose-500';

  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg className="-rotate-90" width={size} height={size}>
        <circle
          className={bgColor}
          strokeWidth={strokeWidth}
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className={`${color || defaultColor} transition-all duration-700 ease-out`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children || (
          <span className="text-[11px] font-bold font-tabular tracking-tight">
            {Math.round(clampedPct)}%
          </span>
        )}
      </div>
    </div>
  );
}

interface TargetProgressCardProps {
  totalPOS: number;
  paidPOS: number;
  totalCollection: number;
  neededPOS: number;
  dailyRequiredPOS: number;
  targetPct?: number;
  remainingDays?: number;
}

export function TargetProgressCard({
  totalPOS,
  paidPOS,
  neededPOS,
  dailyRequiredPOS,
  targetPct = 85,
  remainingDays = 7,
}: TargetProgressCardProps) {
  const currentPct = totalPOS > 0 ? (paidPOS / totalPOS) * 100 : 0;
  const isTargetAchieved = neededPOS <= 0;
  const status = isTargetAchieved
    ? { text: 'Target Achieved', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25', dot: 'bg-emerald-500' }
    : currentPct >= targetPct * 0.7
    ? { text: 'On Track', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25', dot: 'bg-blue-500' }
    : { text: 'Pacing Deficit', color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25', dot: 'bg-rose-500' };

  return (
    <div className="bg-card border border-border/80 rounded-xl p-4 shadow-xs flex flex-col justify-between relative overflow-hidden group hover:border-border transition-all">
      {/* Top row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Target Velocity & DRR</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${status.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                {status.text}
              </span>
            </div>
          </div>
        </div>

        {/* Progress Ring */}
        <ProgressRing percentage={currentPct} size={48} strokeWidth={4}>
          <span className="text-[11px] font-bold font-tabular">
            {currentPct.toFixed(1)}%
          </span>
        </ProgressRing>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-3 py-2 border-y border-border/50 bg-muted/20 -mx-4 px-4 my-1">
        <div>
          <span className="text-[10px] uppercase font-bold text-muted-foreground block">Needed Recovery</span>
          <span className="text-sm font-bold font-tabular text-rose-600 dark:text-rose-400">
            {isTargetAchieved ? '₹0' : fmtCur(neededPOS)}
          </span>
        </div>
        <div className="text-right">
          <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center justify-end gap-1">
            <Clock className="w-3 h-3 text-amber-500" /> Daily Run-Rate
          </span>
          <span className="text-sm font-bold font-tabular text-amber-600 dark:text-amber-400">
            {isTargetAchieved ? 'Goal Met' : `${fmtCur(dailyRequiredPOS)}/d`}
          </span>
        </div>
      </div>

      {/* Footer bar */}
      <div className="mt-2.5 flex items-center justify-between text-xs text-muted-foreground">
        <span>Target: <strong className="text-foreground">{targetPct}%</strong> of POS</span>
        <span className="font-tabular font-medium">{remainingDays} days left</span>
      </div>
    </div>
  );
}
