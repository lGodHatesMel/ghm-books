import { AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowUp, Link2, Trash2, Type } from 'lucide-react';
import type { Block, Limits, Page, TextAlign, TextStyle } from '../types';
import { cn } from '../utils/cn';

export interface PageActions {
  updateBlock: (pageId: string, blockId: string, patch: Partial<Block>) => void;
  moveBlock: (pageId: string, from: number, to: number) => void;
  removeBlock: (pageId: string, blockId: string) => void;
  addText: (pageId: string) => void;
  addUrl: (pageId: string) => void;
}

const STYLES: { value: TextStyle; label: string }[] = [
  { value: 'body', label: 'Body' },
  { value: 'heading', label: 'Head' },
  { value: 'quote', label: 'Quote' },
];
const ALIGNS: { value: TextAlign; icon: typeof AlignLeft }[] = [
  { value: 'left', icon: AlignLeft },
  { value: 'center', icon: AlignCenter },
  { value: 'right', icon: AlignRight },
];

const btn = 'paper-btn';

/** One page of the book, edited in place on paper. */
export default function PageEditor({ page, actions, limits }: { page: Page; actions: PageActions; limits: Limits }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-9 pb-3">
        {page.blocks.length === 0 && <p className="mt-10 text-center paper-muted text-sm italic">Empty page. Add text or an image below.</p>}
        {page.blocks.map((b, i) => (
          <div key={b.id} className="group/block relative">
            <div className="mb-1 flex items-center gap-1 opacity-40 transition-opacity group-focus-within/block:opacity-100 group-hover/block:opacity-100">
              {b.type === 'text' ? (
                <>
                  {STYLES.map((s) => (
                    <button key={s.value} type="button" className={cn(btn, b.style === s.value && 'on')} onClick={() => actions.updateBlock(page.id, b.id, { style: s.value })}>
                      {s.label}
                    </button>
                  ))}
                  <span className="mx-0.5 h-4 w-px bg-current opacity-20" />
                  {ALIGNS.map(({ value, icon: Icon }) => (
                    <button key={value} type="button" aria-label={`Align ${value}`} className={cn(btn, b.align === value && 'on')} onClick={() => actions.updateBlock(page.id, b.id, { align: value })}>
                      <Icon size={12} />
                    </button>
                  ))}
                </>
              ) : (
                <span className="paper-muted font-mono text-[10px] uppercase">Image</span>
              )}
              <div className="flex-1" />
              <button type="button" aria-label="Move up" className={btn} disabled={i === 0} onClick={() => actions.moveBlock(page.id, i, i - 1)}><ArrowUp size={12} /></button>
              <button type="button" aria-label="Move down" className={btn} disabled={i === page.blocks.length - 1} onClick={() => actions.moveBlock(page.id, i, i + 1)}><ArrowDown size={12} /></button>
              <button type="button" aria-label="Remove" className={btn} onClick={() => actions.removeBlock(page.id, b.id)}><Trash2 size={12} /></button>
            </div>

            {b.type === 'text' ? (
              <textarea
                value={b.text}
                maxLength={limits.maxTextLength}
                onChange={(e) => actions.updateBlock(page.id, b.id, { text: e.target.value })}
                rows={b.style === 'heading' ? 2 : 5}
                placeholder="Start writing..."
                className={cn(
                  'paper-field w-full resize-y p-2',
                  `paper-${b.style}`,
                )}
                style={{ textAlign: b.align, fontFamily: 'inherit' }}
              />
            ) : (
              <figure className="m-0">
                <img src={b.src} alt="" className="mx-auto max-h-[200px] max-w-full border border-black/30 object-contain" />
                <input
                  value={b.caption}
                  maxLength={limits.maxCaption}
                  onChange={(e) => actions.updateBlock(page.id, b.id, { caption: e.target.value })}
                  placeholder="Caption (optional)"
                  className="paper-field paper-muted mt-1.5 w-full border-0 border-b px-1 py-0.5 text-center text-xs italic"
                />
              </figure>
            )}
          </div>
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-1.5 px-9 pb-9 pt-1">
        <button type="button" className={btn} onClick={() => actions.addText(page.id)}><Type size={11} /> Text</button>
        <button type="button" className={btn} onClick={() => actions.addUrl(page.id)}><Link2 size={11} /> Image</button>
      </div>
    </div>
  );
}
