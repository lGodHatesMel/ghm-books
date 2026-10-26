import type { Page } from '../types';
import { cn } from '../utils/cn';

const ALIGN = { left: 'text-left', center: 'text-center', right: 'text-right' } as const;

/** Renders one page on paper. Shared by the reader and the editor's preview. */
export function PageView({ page }: { page: Page }) {
  return (
    <div className="flex flex-col gap-4">
      {page.blocks.map((b) =>
        b.type === 'text' ? (
          <p key={b.id} className={cn(`paper-${b.style}`, ALIGN[b.align])}>
            {b.text}
          </p>
        ) : (
          <figure key={b.id} className="m-0">
            <img src={b.src} alt={b.caption || ''} className="mx-auto max-h-[300px] max-w-full border border-black/30 object-contain" />
            {b.caption && <figcaption className="mt-1.5 text-center paper-muted text-xs italic">{b.caption}</figcaption>}
          </figure>
        ),
      )}
    </div>
  );
}
