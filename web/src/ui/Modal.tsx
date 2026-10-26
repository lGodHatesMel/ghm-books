import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { IconButton } from './Button';
import { cn } from '../utils/cn';

interface ModalProps {
  title: string;
  icon?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/**
 * Centred dialog. Portals to <body> so it escapes the panel's fit-scale transform stacking,
 * and swallows Escape in the capture phase so closing a modal never also closes the menu.
 */
export function Modal({ title, icon, onClose, children, footer, className }: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={cn('animate-panelIn w-[420px] max-w-full rounded-lg border border-white/10 bg-dark-800', className)}>
        <header className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
          {icon && <span className="text-accent-light">{icon}</span>}
          <h3 className="flex-1 text-[13px] font-semibold text-white">{title}</h3>
          <IconButton onClick={onClose} aria-label="Close">
            <X size={14} />
          </IconButton>
        </header>
        <div className="p-4">{children}</div>
        {footer && <footer className="flex items-center justify-end gap-2 border-t border-white/[0.06] px-4 py-3">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
