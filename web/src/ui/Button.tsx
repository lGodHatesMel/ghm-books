import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../utils/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-dark-900 hover:bg-accent-light border-transparent font-semibold',
  secondary: 'bg-dark-700 text-gray-200 border-white/10 hover:bg-dark-600 hover:border-white/20',
  ghost: 'bg-transparent text-dark-300 border-transparent hover:bg-white/5 hover:text-gray-100',
  danger: 'bg-danger/10 text-danger border-danger/25 hover:bg-danger/20',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-[11px] gap-1.5',
  md: 'h-8 px-3 text-xs gap-2',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  busy?: boolean;
  icon?: ReactNode;
}

export function Button({ variant = 'secondary', size = 'md', busy, icon, className, children, disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || busy}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md border font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-40',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {busy ? <Loader2 size={13} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function IconButton({ className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        'grid h-7 w-7 shrink-0 place-items-center rounded-md text-dark-300 transition-colors',
        'hover:bg-white/5 hover:text-gray-100 disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
