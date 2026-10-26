import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../utils/cn';

const CONTROL =
  'w-full rounded-md border border-white/10 bg-dark-900 text-xs text-gray-100 placeholder:text-dark-400 ' +
  'transition-colors focus:border-accent/50 focus:outline-none focus-visible:outline-none disabled:opacity-50';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }>(function Input(
  { className, mono, ...rest },
  ref,
) {
  return <input ref={ref} className={cn(CONTROL, 'h-8 px-2.5', mono && 'font-mono', className)} {...rest} />;
});

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(CONTROL, 'h-8 px-2', className)} {...rest}>
      {children}
    </select>
  );
}

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}

export function SearchInput({ value, onChange, placeholder, autoFocus, className }: SearchInputProps) {
  return (
    <div className={cn('relative', className)}>
      <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-dark-400" />
      <input
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        className={cn(CONTROL, 'h-8 pl-8 pr-8')}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-1.5 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded text-dark-400 hover:bg-white/10 hover:text-gray-100"
          aria-label="Clear search"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn('flex flex-col gap-1', className)}>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-dark-300">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-dark-400">{hint}</span>}
    </label>
  );
}

export function Switch({ on, onChange, disabled }: { on: boolean; onChange: (on: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn('relative h-4 w-7 shrink-0 rounded-full transition-colors disabled:opacity-40', on ? 'bg-success' : 'bg-dark-600')}
    >
      <span className={cn('absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white transition-transform', on && 'translate-x-3')} />
    </button>
  );
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

export function Segmented<T extends string>({ value, options, onChange, className }: { value: T; options: SegmentedOption<T>[]; onChange: (value: T) => void; className?: string }) {
  return (
    <div className={cn('flex gap-0.5 rounded-md border border-white/10 bg-dark-900 p-0.5', className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'flex h-7 flex-1 items-center justify-center gap-1.5 rounded px-2 text-[11px] font-medium transition-colors',
            option.value === value ? 'bg-dark-600 text-white' : 'text-dark-300 hover:text-gray-100',
          )}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}
