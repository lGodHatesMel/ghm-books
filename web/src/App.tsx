import { useCallback, useEffect, useState } from 'react';
import { BookCopy, BookOpen, FilePlus2, ShieldCheck } from 'lucide-react';
import type { Book, CoverId, Limits } from './types';
import Editor from './components/Editor';
import Reader from './components/Reader';
import AdminBooks from './components/AdminBooks';
import MyBooks from './components/MyBooks';
import ComputerFrame from './components/ComputerFrame';
import { Button } from './ui/Button';
import { Kbd } from './ui/Kbd';
import { fetchNui, isEnvBrowser, onNuiEvent } from './utils/nui';
import { useFitScale } from './utils/useFitScale';
import { mockBooks, mockCovers, mockLimits } from './mockData';
import { withIds } from './utils/book';
import { computerMode } from './utils/computer';

const CANVAS_W = 1100;
const CANVAS_H = 720;
// The book on its own (reading an item): two pages, the page buttons, and a strip for the controls and the hint.
const BARE_W = 1000;
const BARE_H = 680;

type View =
  | { kind: 'closed' }
  | { kind: 'admin' }
  | { kind: 'mine' }
  | { kind: 'editor'; slot: number | string; book?: Book; fromMine?: boolean }
  | { kind: 'reader'; slot: number | string; book: Book; fromMine?: boolean };

export default function App() {
  const { ref, style } = useFitScale<HTMLDivElement>();
  // Inside an SD Computers window the book UI is always open, and starts on the author's library.
  const [view, setView] = useState<View>(computerMode ? { kind: 'mine' } : { kind: 'closed' });
  const [limits, setLimits] = useState<Limits>(mockLimits);
  const [covers, setCovers] = useState<CoverId[]>(mockCovers as CoverId[]);
  const [mineRefresh, setMineRefresh] = useState(0);
  const [printAfter, setPrintAfter] = useState<number | null>(null);

  const close = useCallback(() => {
    setView({ kind: 'closed' });
    fetchNui('close');
  }, []);

  useEffect(() => {
    const offs = [
      onNuiEvent('openEditor', (d) => {
        setLimits(d.limits);
        setCovers(d.covers);
        setView({ kind: 'editor', slot: d.slot });
      }),
      onNuiEvent('openReader', (d) => {
        setLimits(d.limits);
        setCovers(d.covers);
        setView({ kind: 'reader', slot: d.slot, book: { ...d.book, pages: withIds(d.book.pages) } });
      }),
      onNuiEvent('openMine', () => setView({ kind: 'mine' })),
      onNuiEvent('openAdmin', () => setView({ kind: 'admin' })),
      onNuiEvent('close', () => setView({ kind: 'closed' })),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  // Computers mode: the limits come from the server's endpoint instead of the open message.
  useEffect(() => {
    if (!computerMode) return;
    fetchNui<{ limits: Limits; covers: CoverId[] }>('limits').then((cfg) => {
      if (!cfg) return;
      setLimits(cfg.limits);
      setCovers(cfg.covers);
    });
  }, []);

  const backToMine = useCallback(() => {
    setMineRefresh((n) => n + 1);
    setView({ kind: 'mine' });
  }, []);

  /** Open one of the player's own books (read or edit) from the My Books list. */
  const openMine = async (id: number, as: 'reader' | 'editor') => {
    const res = await fetchNui<{ success: boolean; book?: Book; limits?: Limits; covers?: CoverId[] }>('mineGet', { id });
    if (!res?.success || !res.book) return;
    if (res.limits) setLimits(res.limits);
    if (res.covers) setCovers(res.covers);
    const book = { ...res.book, pages: withIds(res.book.pages) };
    setView(as === 'reader' ? { kind: 'reader', slot: 0, book, fromMine: true } : { kind: 'editor', slot: 0, book, fromMine: true });
  };

  // Escape closes the reader; the editor handles its own (it confirms before discarding edits).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (view.kind === 'reader') return view.fromMine ? backToMine() : close();
      if (!computerMode && (view.kind === 'admin' || view.kind === 'mine')) close();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [view, close, backToMine]);

  const open = view.kind !== 'closed';
  // Reading a book item from the inventory shows only the book, on a transparent background.
  const bareReader = view.kind === 'reader' && !computerMode && !view.fromMine;

  /** Back to the library inside a computer window or when opened from /mybooks; otherwise close the UI. */
  const leave = () => (computerMode || ((view.kind === 'editor' || view.kind === 'reader') && view.fromMine) ? backToMine() : close());
  const views = (
    <>
      {view.kind === 'editor' && (
        <Editor
          key={view.book?.id ?? 'new'}
          initial={view.book}
          slot={view.slot}
          limits={limits}
          covers={covers}
          onClose={leave}
          onSaved={(info) => {
            // A new book written at a computer has no copies yet: go straight to printing them.
            if (computerMode && info.isNew && info.bookId !== undefined) setPrintAfter(info.bookId);
            leave();
          }}
        />
      )}
      {view.kind === 'admin' && <AdminBooks onClose={close} />}
      {view.kind === 'mine' && (
        <MyBooks
          onClose={computerMode ? undefined : close}
          onCreate={computerMode ? () => setView({ kind: 'editor', slot: 0, fromMine: true }) : undefined}
          refreshKey={mineRefresh}
          printAfter={printAfter}
          onPrintAfterHandled={() => setPrintAfter(null)}
          onRead={(id) => openMine(id, 'reader')}
          onEdit={(id) => openMine(id, 'editor')}
        />
      )}
      {view.kind === 'reader' && (
        <Reader
          book={view.book}
          onClose={leave}
          onEdit={() => setView({ kind: 'editor', slot: view.slot, book: view.book, fromMine: view.fromMine })}
          bare={bareReader}
        />
      )}
    </>
  );

  return (
    <>
      {isEnvBrowser && !computerMode && (
        <div className="fixed inset-0 bg-[#08090b]">
          {!open && (
            <div className="absolute left-1/2 top-1/2 w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-white/10 bg-dark-800 p-5">
              <h1 className="mb-1 text-sm font-semibold text-white">Book Creator: browser mock mode</h1>
              <p className="mb-4 text-xs text-dark-300">Every action here uses mock data; nothing is saved.</p>
              <Button variant="primary" icon={<FilePlus2 size={13} />} className="mb-3 w-full" onClick={() => setView({ kind: 'editor', slot: 1 })}>
                Open editor (blank book)
              </Button>
              <Button icon={<BookCopy size={13} />} className="mb-3 w-full" onClick={() => setView({ kind: 'mine' })}>
                Open my books (/mybooks)
              </Button>
              <Button icon={<ShieldCheck size={13} />} className="mb-3 w-full" onClick={() => setView({ kind: 'admin' })}>
                Open admin books menu (/adminbooks)
              </Button>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-dark-300">Open reader</p>
              <div className="flex flex-col gap-1">
                {mockBooks.map((b) => (
                  <Button key={b.id} icon={<BookOpen size={12} />} className="w-full justify-start" onClick={() => setView({ kind: 'reader', slot: 1, book: { ...b, pages: withIds(b.pages) } })}>
                    {b.title}
                    <span className="ml-auto font-mono text-[10px] text-dark-300">{b.canEdit ? 'author' : 'reader'}</span>
                  </Button>
                ))}
              </div>
              <p className="mt-4 flex items-center gap-2 text-xs text-dark-400"><Kbd>ESC</Kbd> closes the book</p>
            </div>
          )}
        </div>
      )}

      {open && (computerMode ? <ComputerFrame width={CANVAS_W} height={CANVAS_H}>{views}</ComputerFrame> : bareReader ? (
        <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
          <div ref={ref} style={{ width: BARE_W, height: BARE_H, ...style }} className="pointer-events-auto">
            {views}
          </div>
        </div>
      ) : (
        <div className="fixed inset-0 flex items-center justify-center">
          <div ref={ref} style={{ width: CANVAS_W, height: CANVAS_H, ...style }} className="overflow-hidden rounded-lg border border-white/[0.09] bg-dark-900">
            {views}
          </div>
        </div>
      ))}
    </>
  );
}
