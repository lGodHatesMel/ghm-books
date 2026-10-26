import type { ReactNode } from 'react';

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-white/10 bg-dark-700 px-1.5 py-0.5 font-mono text-[10px] text-dark-300">{children}</kbd>
  );
}
