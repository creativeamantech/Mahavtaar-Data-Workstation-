import React, { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MetricModuleProps {
  id?: string;
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  iconColor?: string;
  badge?: {
    text: string;
    variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  };
  trend?: {
    value: string;
    isPositive?: boolean;
    label?: string;
  };
  progress?: {
    value: number; // 0 - 100
    color?: string;
  };
  footer?: ReactNode;
  onClick?: () => void;
  className?: string;
}

export function MetricModule({
  id,
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = 'text-primary',
  badge,
  trend,
  progress,
  footer,
  onClick,
  className,
}: MetricModuleProps) {
  const badgeColors = {
    success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    danger: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    info: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
    neutral: 'bg-muted text-muted-foreground border-border',
  };

  return (
    <div
      id={id}
      onClick={onClick}
      className={cn(
        'bg-card border border-border/80 rounded-xl p-4 shadow-xs flex flex-col justify-between transition-all duration-200',
        onClick ? 'cursor-pointer hover:border-primary/50 hover:shadow-sm' : '',
        className
      )}
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            {Icon && <Icon className={cn('h-3.5 w-3.5', iconColor)} />}
            {title}
          </span>
          {badge && (
            <span
              className={cn(
                'text-[10px] font-semibold px-2 py-0.5 rounded-full border',
                badgeColors[badge.variant || 'neutral']
              )}
            >
              {badge.text}
            </span>
          )}
        </div>

        <div className="flex items-baseline justify-between gap-2 mt-1">
          <div className="text-2xl font-extrabold text-foreground tracking-tight font-tabular">
            {value}
          </div>
          {trend && (
            <span
              className={cn(
                'text-xs font-bold font-tabular flex items-center gap-0.5',
                trend.isPositive
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              )}
            >
              {trend.value}
            </span>
          )}
        </div>

        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{subtitle}</p>
        )}
      </div>

      {progress && (
        <div className="mt-3">
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div
              className={cn('h-full transition-all duration-500 rounded-full', progress.color || 'bg-primary')}
              style={{ width: `${Math.min(100, Math.max(0, progress.value))}%` }}
            />
          </div>
        </div>
      )}

      {footer && (
        <div className="mt-3 pt-2.5 border-t border-border/60 text-xs text-muted-foreground flex items-center justify-between">
          {footer}
        </div>
      )}
    </div>
  );
}
