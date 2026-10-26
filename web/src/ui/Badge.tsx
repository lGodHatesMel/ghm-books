import type { ReactNode } from 'react';
import { cn } from '../utils/cn';

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-white/[0.06] text-dark-300',
  accent: 'bg-accent/15 text-accent-light',
  success: 'bg-success/12 text-success',
  warning: 'bg-warning/12 text-warning',
  danger: 'bg-danger/12 text-danger',
  info: 'bg-info/12 text-info',
};

export function Badge({ children, tone = 'neutral', className, mono }: { children: ReactNode; tone?: BadgeTone; className?: string; mono?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        mono && 'font-mono normal-case tracking-normal',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusDot({ tone = 'success', className }: { tone?: 'success' | 'warning' | 'danger' | 'neutral'; className?: string }) {
  const color = { success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger', neutral: 'bg-dark-400' }[tone];
  return <span className={cn('inline-block h-1.5 w-1.5 shrink-0 rounded-full', color, className)} />;
}
