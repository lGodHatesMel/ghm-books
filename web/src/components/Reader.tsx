import { useEffect, useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, Pencil, Printer, X } from 'lucide-react';
import type { Book } from '../types';
import { Button, IconButton } from '../ui/Button';
import FlipBook from './FlipBook';
import { BackCoverFace, CoverFace, InsideCover, PaperFace, faceCountFor, faceKind, resolveCover, sideOf } from './faces';
import { PageView } from './PageView';
import { computerMode } from '../utils/computer';

interface Props {
  book: Book;
  onClose: () => void;
  onEdit: () => void;
  /** Show only the book, floating over whatever is behind it (reading an item from the inventory). */
  bare?: boolean;
}

const PAGE_W = 420;
const PAGE_H = 580;

export default function Reader({ book, onClose, onEdit, bare }: Props) {
  const [spread, setSpread] = useState(0);
  const pages = book.pages.length;
  const faceCount = faceCountFor(pages);
  const design = resolveCover(book.coverDesign, book.cover, book.title, book.description, book.authorName);
  const paper = book.paper ?? 'blank';
  const font = book.font ?? 'serif';
  const last = faceCount / 2;

  const go = (delta: number) => setSpread((s) => Math.max(0, Math.min(last, s + delta)));

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const renderFace = (i: number) => {
    const f = faceKind(i, pages);
    switch (f.kind) {
      case 'cover':
        return <CoverFace design={design} />;
      case 'back':
        return <BackCoverFace design={design} />;
      case 'page':
        return (
          <PaperFace number={f.page + 1} side={sideOf(i)} paper={paper} font={font}>
            <div className="h-full overflow-y-auto p-9 pb-12">
              <PageView page={book.pages[f.page]} />
            </div>
          </PaperFace>
        );
      case 'inside':
        return (
          <InsideCover
            side={sideOf(i)} paper={paper} font={font} authorName={book.authorName} dedication={book.dedication}
            copy={book.copy} edition={book.edition} signed={book.signed} inscription={book.inscription}
          />
        );
      default:
        return <PaperFace side={sideOf(i)} paper={paper} font={font} />;
    }
  };

  const from = Math.max(1, 2 * spread - 2);
  const to = Math.min(pages, 2 * spread - 1);
  const status = spread === 0 ? 'Cover' : spread === last ? 'Back cover' : from >= to ? `Page ${to}` : `Pages ${from}-${to}`;

  const flipBook = (
    <FlipBook faceCount={faceCount} spread={spread} onSpreadChange={setSpread} renderFace={renderFace} pageW={PAGE_W} pageH={PAGE_H} grab="full" boardColor={design.bg} />
  );

  if (bare) {
    // Nothing but the book: no panel, header or footer, so the world shows through around it. The controls are small
    // pills with solid fills (the game's browser draws no blur), and the hint carries its own outline to stay readable.
    const pill = 'bg-black/70 border border-white/15 text-gray-100 hover:bg-black/85';
    return (
      <div className="relative flex h-full w-full items-center justify-center">
        <div className="flex items-center gap-3">
          <IconButton onClick={() => go(-1)} disabled={spread <= 0} aria-label="Previous" className={`h-10 w-10 shrink-0 ${pill}`}>
            <ChevronLeft size={18} />
          </IconButton>
          {flipBook}
          <IconButton onClick={() => go(1)} disabled={spread >= last} aria-label="Next" className={`h-10 w-10 shrink-0 ${pill}`}>
            <ChevronRight size={18} />
          </IconButton>
        </div>
        <div className="absolute left-1/2 top-1 flex -translate-x-1/2 items-center justify-end gap-1.5" style={{ width: PAGE_W * 2 }}>
          <span className="rounded border border-white/15 bg-black/70 px-2 py-1 font-mono text-[11px] text-gray-100">{status}</span>
          {book.canEdit && (
            <IconButton onClick={onEdit} aria-label="Edit" className={`h-7 w-7 ${pill}`}>
              <Pencil size={13} />
            </IconButton>
          )}
          <IconButton onClick={onClose} aria-label="Close" className={`h-7 w-7 ${pill}`}>
            <X size={14} />
          </IconButton>
        </div>
        <p className="absolute bottom-1 left-1/2 -translate-x-1/2 font-mono text-[11px] text-white" style={{ textShadow: '0 1px 3px #000, 0 0 2px #000' }}>
          Drag a page to turn it. Arrow keys also work. Esc to close.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-dark-900">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-white/[0.06] px-4">
        <BookOpen size={15} className="text-accent-light" />
        <h2 className="flex-1 truncate text-[13px] font-semibold text-white">{book.title}</h2>
        <span className="font-mono text-[11px] text-dark-300">{status}</span>
        {computerMode && book.id !== undefined && (
          <Button size="sm" icon={<Printer size={12} />} onClick={() => window.computer?.print({ title: book.title, data: { id: book.id } })}>
            Print text
          </Button>
        )}
        {book.canEdit && (
          <Button size="sm" icon={<Pencil size={12} />} onClick={onEdit}>
            Edit
          </Button>
        )}
        <IconButton onClick={onClose} aria-label={computerMode ? 'Back to My Books' : 'Close'}>
          <X size={14} />
        </IconButton>
      </header>

      <div className="flex min-h-0 flex-1 items-center justify-center gap-4 p-4">
        <IconButton onClick={() => go(-1)} disabled={spread <= 0} aria-label="Previous" className="h-10 w-10 shrink-0">
          <ChevronLeft size={18} />
        </IconButton>
        {flipBook}
        <IconButton onClick={() => go(1)} disabled={spread >= last} aria-label="Next" className="h-10 w-10 shrink-0">
          <ChevronRight size={18} />
        </IconButton>
      </div>

      <footer className="flex h-9 shrink-0 items-center justify-between border-t border-white/[0.06] px-4 text-[11px] text-dark-300">
        <span>Written by {book.authorName}</span>
        <span className="font-mono">Drag a page to turn it, or use the arrow keys</span>
      </footer>
    </div>
  );
}
