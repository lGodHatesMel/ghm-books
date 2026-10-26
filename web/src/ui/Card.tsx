import type { ReactNode } from 'react';
import { cn } from '../utils/cn';

interface CardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
}

/** Flat surface with a 1px hairline: the base container for every dashboard/list block. */
export function Card({ title, subtitle, actions, children, className, bodyClassName }: CardProps) {
  const hasHeader = title !== undefined || actions !== undefined;
  return (
    <section className={cn('rounded-lg border border-white/[0.07] bg-dark-800', className)}>
      {hasHeader && (
        <header className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-2.5">
          <div className="min-w-0">
            <h3 className="truncate text-[11px] font-semibold uppercase tracking-wider text-dark-300">{title}</h3>
            {subtitle && <p className="mt-0.5 truncate text-[11px] text-dark-400">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </section>
  );
}

const TILE_TONES = {
  accent: 'text-accent-light bg-accent/12',
  danger: 'text-danger bg-danger/12',
  success: 'text-success bg-success/12',
  warning: 'text-warning bg-warning/12',
  info: 'text-info bg-info/12',
} as const;

export function StatTile({ icon, label, value, hint, tone = 'accent' }: { icon: ReactNode; label: string; value: ReactNode; hint?: ReactNode; tone?: keyof typeof TILE_TONES }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-white/[0.07] bg-dark-800 px-4 py-3.5">
      <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-md', TILE_TONES[tone])}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-dark-300">{label}</p>
        <p className="mt-0.5 flex items-baseline gap-2">
          <span className="font-mono text-xl font-semibold leading-none text-white">{value}</span>
          {hint && <span className="truncate text-[11px] text-dark-400">{hint}</span>}
        </p>
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, hint, action }: { icon?: ReactNode; title: string; hint?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      {icon && <span className="text-dark-400">{icon}</span>}
      <p className="text-xs font-medium text-gray-300">{title}</p>
      {hint && <p className="max-w-xs text-[11px] leading-relaxed text-dark-400">{hint}</p>}
      {action}
    </div>
  );
}
