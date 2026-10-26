import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookCopy, BookOpen, EyeOff, Lock, Pencil, Plus, RefreshCw, RotateCcw, Trash2, Users, X } from 'lucide-react';
import type { BookSummary, PrinterChoice, PrintResult } from '../types';
import { Badge } from '../ui/Badge';
import { Button, IconButton } from '../ui/Button';
import { EmptyState } from '../ui/Card';
import { Field, Input, SearchInput, Select } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { COVER_COLORS } from '../utils/book';
import { fetchNui } from '../utils/nui';
import { computerMode } from '../utils/computer';

const GRID = 'grid-cols-[36px_minmax(0,1.6fr)_60px_60px_90px_150px_290px]';

interface Props {
  /** Absent inside an SD Computers window, which has a close button of its own. */
  onClose?: () => void;
  /** Present where books are written from this list (SD Computers). */
  onCreate?: () => void;
  onRead: (id: number) => void;
  onEdit: (id: number) => void;
  /** Bump to force a reload, e.g. after returning from the editor. */
  refreshKey: number;
  /** A book just published at a computer: its print dialog opens straight away. */
  printAfter?: number | null;
  onPrintAfterHandled?: () => void;
}

/** Books the current character wrote: edit without needing a copy, print more copies, delete. */
export default function MyBooks({ onClose, onCreate, onRead, onEdit, refreshKey, printAfter, onPrintAfterHandled }: Props) {
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [blank, setBlank] = useState(0);
  const [freePrint, setFreePrint] = useState(false);
  const [printing, setPrinting] = useState<BookSummary | null>(null);
  const [inscription, setInscription] = useState('');
  const [signCopy, setSignCopy] = useState(false);
  const [printers, setPrinters] = useState<PrinterChoice[]>([]);
  const [printerId, setPrinterId] = useState<number | null>(null);
  // at a computer, copies come out of a printer unless the server has none (then they are handed over at once)
  const [direct, setDirect] = useState(true);
  const [printersLoaded, setPrintersLoaded] = useState(!computerMode);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; bad?: boolean } | null>(null);
  const [search, setSearch] = useState('');
  const [pendingDelete, setPendingDelete] = useState<BookSummary | null>(null);
  const [pendingRestore, setPendingRestore] = useState<BookSummary | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchNui<{ success: boolean; books?: BookSummary[]; blankBooks?: number; freePrint?: boolean; error?: string }>('mineList');
    setLoading(false);
    if (!res?.success) return setError(res?.error ?? 'Could not load your books');
    setError(null);
    setBooks(res.books ?? []);
    setBlank(res.blankBooks ?? 0);
    setFreePrint(res.freePrint === true);
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? books.filter((b) => b.title.toLowerCase().includes(q)) : books;
  }, [books, search]);

  const openPrint = async (b: BookSummary) => {
    setInscription('');
    setSignCopy(false);
    setPrinting(b);
    if (!computerMode) return;
    setPrintersLoaded(false);
    const res = await fetchNui<{ printers: PrinterChoice[]; direct: boolean }>('printers');
    setPrinters(res?.printers ?? []);
    setDirect(res?.direct ?? true);
    setPrinterId(res?.printers?.[0]?.id ?? null);
    setPrintersLoaded(true);
  };

  // A book just published: offer to print copies of it right away.
  useEffect(() => {
    if (printAfter == null) return;
    const book = books.find((b) => b.id === printAfter);
    if (!book) return;
    onPrintAfterHandled?.();
    openPrint(book);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [printAfter, books]);

  const print = async () => {
    const b = printing;
    if (!b) return;
    setBusyId(b.id);
    const res = await fetchNui<PrintResult>('minePrint', { id: b.id, inscription: inscription.trim(), signed: signCopy && !b.anonymous, printer: computerMode && !direct ? printerId : undefined });
    setBusyId(null);
    setPrinting(null);
    if (!res?.success) return setNotice({ text: res?.error ?? 'Could not print a copy', bad: true });
    setNotice({ text: res.queued ? `Copy ${res.copy} is printing at ${res.printer}. Wait at the printer: it is handed to you in about ${res.seconds} seconds.` : `Printed copy ${res.copy} of "${b.title}"` });
    load();
  };

  const restore = async () => {
    const b = pendingRestore;
    if (!b) return;
    const res = await fetchNui<{ success: boolean; error?: string }>('mineRestore', { id: b.id });
    setPendingRestore(null);
    if (!res?.success) return setNotice({ text: res?.error ?? 'Could not restore the book', bad: true });
    setNotice({ text: `Restored the earlier version of "${b.title}"` });
    load();
  };

  const soldOut = (b: BookSummary) => (b.printLimit ?? 0) > 0 && (b.copies ?? 0) >= (b.printLimit ?? 0);

  const remove = async () => {
    const b = pendingDelete;
    if (!b) return;
    const res = await fetchNui<{ success: boolean; error?: string }>('mineDelete', { id: b.id });
    setPendingDelete(null);
    if (!res?.success) return setNotice({ text: res?.error ?? 'Could not delete the book', bad: true });
    setNotice({ text: `Deleted "${b.title}"` });
    load();
  };

  return (
    <div className="flex h-full w-full flex-col bg-dark-900">
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-white/[0.06] px-4">
        <BookOpen size={15} className="text-accent-light" />
        <h2 className="shrink-0 whitespace-nowrap text-[13px] font-semibold uppercase tracking-wide text-white">My Books</h2>
        {!freePrint && <Badge tone={blank > 0 ? 'accent' : 'neutral'} mono>{blank} blank {blank === 1 ? 'book' : 'books'}</Badge>}
        {notice ? (
          <span className={`min-w-0 flex-1 truncate text-xs ${notice.bad ? 'text-danger' : 'text-accent-light'}`}>{notice.text}</span>
        ) : (
          <span className="min-w-0 flex-1 truncate text-xs text-dark-300">{freePrint ? 'Books you wrote.' : 'Books you wrote. Printing a copy uses one blank book.'}</span>
        )}
        <SearchInput value={search} onChange={setSearch} placeholder="Search your books" className="w-60" />
        <IconButton onClick={load} aria-label="Refresh"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></IconButton>
        {onCreate && <Button variant="primary" size="sm" icon={<Plus size={12} />} onClick={onCreate}>New book</Button>}
        {onClose && <IconButton onClick={onClose} aria-label="Close"><X size={14} /></IconButton>}
      </header>

      <div className="flex min-h-0 flex-1 flex-col p-4">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-white/[0.07] bg-dark-800">
          <div className={`grid ${GRID} gap-3 border-b border-white/[0.06] bg-dark-700/50 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-dark-300`}>
            <span />
            <span>Title</span>
            <span>Pages</span>
            <span>Images</span>
            <span>Copies</span>
            <span>Last edited</span>
            <span className="text-right">Actions</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {error ? (
              <EmptyState title="Books unavailable" hint={error} />
            ) : !loading && filtered.length === 0 ? (
              <EmptyState
                icon={<BookOpen size={20} />}
                title={search ? 'No books match your search' : 'You have not written a book yet'}
                hint={search ? undefined : 'Use a blank book from your inventory to start one.'}
              />
            ) : (
              filtered.map((b) => (
                <div key={b.id} className={`grid ${GRID} items-center gap-3 border-b border-white/[0.04] px-4 py-2.5 hover:bg-white/[0.02]`}>
                  <span className="h-7 w-5 border border-black/40" style={{ background: COVER_COLORS[b.cover]?.bg }} />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-white">{b.title}</p>
                    <p className="flex items-center gap-1.5 font-mono text-[10px] text-dark-300">
                      <span className="shrink-0">#{b.id}</span>
                      {b.anonymous && <Badge tone="neutral" className="shrink-0"><EyeOff size={9} />Anonymous</Badge>}
                      {b.published && <Badge tone="success" className="shrink-0"><Lock size={9} />Published</Badge>}
                      {b.shared && <Badge tone="info" className="shrink-0"><Users size={9} />Shared</Badge>}
                      {b.description && <span className="truncate">{b.description}</span>}
                    </p>
                    {b.shared && b.lastEditor && b.lastEditor !== b.authorName && (
                      <p className="truncate text-[10px] text-warning">Last edited by {b.lastEditor}</p>
                    )}
                  </div>
                  <span className="font-mono text-xs text-gray-300">{b.pageCount}</span>
                  <span className="font-mono text-xs text-gray-300">{b.imageCount}</span>
                  <span className="font-mono text-xs text-gray-300">{b.printLimit ? `${b.copies ?? 0} / ${b.printLimit}` : (b.copies ?? 0)}</span>
                  <span className="font-mono text-[11px] text-dark-300">{b.updatedAt}</span>
                  <div className="flex justify-end gap-1.5">
                    <Button size="sm" icon={<BookOpen size={12} />} onClick={() => onRead(b.id)}>Read</Button>
                    <Button size="sm" icon={<Pencil size={12} />} disabled={b.published} title={b.published ? 'A published book can no longer be edited' : undefined} onClick={() => onEdit(b.id)}>Edit</Button>
                    <Button size="sm" icon={<BookCopy size={12} />} busy={busyId === b.id} disabled={(!freePrint && blank < 1) || soldOut(b)} title={soldOut(b) ? 'Edition sold out' : !freePrint && blank < 1 ? 'Needs a blank book' : undefined} onClick={() => openPrint(b)}>Print</Button>
                    {b.hasBackup ? <IconButton onClick={() => setPendingRestore(b)} aria-label="Restore earlier version" title="Restore the version from before the last edit by someone else"><RotateCcw size={13} /></IconButton> : <span className="h-7 w-7 shrink-0" />}
                    <IconButton onClick={() => setPendingDelete(b)} aria-label="Delete" className="text-danger hover:text-danger"><Trash2 size={13} /></IconButton>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {printing && (
        <Modal
          title="Print a Copy"
          icon={<BookCopy size={14} />}
          onClose={() => setPrinting(null)}
          footer={
            <>
              <Button onClick={() => setPrinting(null)}>Cancel</Button>
              <Button variant="primary" icon={<BookCopy size={12} />} disabled={computerMode && (!printersLoaded || (!direct && printerId === null))} onClick={print}>Print copy</Button>
            </>
          }
        >
          <p className="mb-3 text-xs text-gray-300">
            "{printing.title}" will be copy{' '}
            <span className="font-mono text-white">{(printing.copies ?? 0) + 1}{printing.printLimit ? ` of ${printing.printLimit}` : ''}</span>
            {freePrint ? '.' : ', and uses one blank book.'}
          </p>
          <div className="flex flex-col gap-3">
            {computerMode && printersLoaded && !direct && (
              printers.length === 0 ? (
                <p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                  No printer is in range of this computer. Use a computer closer to a printer.
                </p>
              ) : (
                <Field label="Printer" hint="The copy comes out of this printer. Stand at it to receive the copy.">
                  <Select value={printerId ?? ''} onChange={(e) => setPrinterId(Number(e.target.value))}>
                    {printers.map((p) => <option key={p.id} value={p.id}>{p.label} ({p.distance} m)</option>)}
                  </Select>
                </Field>
              )
            )}
            <Field label="Inscription" hint="Written by hand on the inside cover of this copy only.">
              <Input value={inscription} maxLength={120} onChange={(e) => setInscription(e.target.value)} placeholder="To Sam, with thanks" />
            </Field>
            <label className="flex items-center gap-2 text-xs text-gray-300">
              <input type="checkbox" checked={signCopy && !printing?.anonymous} disabled={printing?.anonymous} onChange={(e) => setSignCopy(e.target.checked)} />
              {printing?.anonymous ? 'Signing is off for anonymous books' : 'Sign this copy'}
            </label>
          </div>
        </Modal>
      )}

      {pendingRestore && (
        <Modal
          title="Restore Earlier Version"
          icon={<RotateCcw size={14} />}
          onClose={() => setPendingRestore(null)}
          footer={
            <>
              <Button onClick={() => setPendingRestore(null)}>Cancel</Button>
              <Button variant="primary" icon={<RotateCcw size={12} />} onClick={restore}>Restore</Button>
            </>
          }
        >
          <p className="text-xs text-gray-300">
            Put "{pendingRestore.title}" back to how it was before {pendingRestore.lastEditor || 'the last editor'} changed it.
            The current version is kept, so you can undo this by restoring again.
          </p>
        </Modal>
      )}

      {pendingDelete && (
        <Modal
          title="Delete Book"
          onClose={() => setPendingDelete(null)}
          footer={
            <>
              <Button onClick={() => setPendingDelete(null)}>Cancel</Button>
              <Button variant="danger" icon={<Trash2 size={12} />} onClick={remove}>Delete</Button>
            </>
          }
        >
          <p className="text-xs text-gray-300">
            Delete "{pendingDelete.title}"? Every copy, including ones you gave away, will have its pages torn out. This cannot be undone.
          </p>
        </Modal>
      )}
    </div>
  );
}
