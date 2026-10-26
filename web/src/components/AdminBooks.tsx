import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Eye, Image as ImageIcon, Lock, RefreshCw, Trash2, User, Users, X } from 'lucide-react';
import type { AdminBookDetail, BookBlock, BookSummary } from '../types';
import { Badge } from '../ui/Badge';
import { Button, IconButton } from '../ui/Button';
import { EmptyState, StatTile } from '../ui/Card';
import { SearchInput } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { COVER_COLORS } from '../utils/book';
import { fetchNui } from '../utils/nui';

const GRID = 'grid-cols-[36px_minmax(0,1.6fr)_minmax(0,1fr)_60px_60px_80px_150px_80px]';

function BlockPreview({ block }: { block: BookBlock }) {
  if (block.type === 'image') {
    return (
      <figure className="m-0">
        <img src={block.src} alt="" className="max-h-52 max-w-full border border-white/10 object-contain" />
        {block.caption && <figcaption className="mt-1 text-[11px] italic text-dark-300">{block.caption}</figcaption>}
      </figure>
    );
  }
  const cls = block.style === 'heading' ? 'text-sm font-semibold text-white' : block.style === 'quote' ? 'text-xs italic text-dark-300' : 'text-xs text-gray-300';
  return <p className={`whitespace-pre-wrap ${cls}`} style={{ textAlign: block.align }}>{block.text}</p>;
}

/** Standalone admin window opened with /adminbooks: browse every written book, preview it, delete it. */
export default function AdminBooks({ onClose }: { onClose: () => void }) {
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [preview, setPreview] = useState<AdminBookDetail | null>(null);
  const [pendingDelete, setPendingDelete] = useState<BookSummary | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchNui<{ success: boolean; books?: BookSummary[]; error?: string }>('adminList');
    setLoading(false);
    if (!res?.success) return setError(res?.error ?? 'Could not load books');
    setError(null);
    setBooks(res.books ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return books;
    return books.filter((b) =>
      b.title.toLowerCase().includes(q) || b.authorName.toLowerCase().includes(q) ||
      b.authorCitizenId.toLowerCase().includes(q) || String(b.id) === q);
  }, [books, search]);

  const openPreview = async (id: number) => {
    const res = await fetchNui<{ success: boolean; book?: AdminBookDetail; error?: string }>('adminGet', { id });
    if (!res?.success || !res.book) return setNotice(res?.error ?? 'Could not load the book');
    setPreview(res.book);
  };

  const confirmDelete = async () => {
    const book = pendingDelete;
    if (!book) return;
    const res = await fetchNui<{ success: boolean; error?: string }>('adminDelete', { id: book.id });
    setPendingDelete(null);
    if (!res?.success) return setNotice(res?.error ?? 'Could not delete the book');
    setNotice(`Deleted "${book.title}"`);
    setPreview(null);
    load();
  };

  return (
    <div className="flex h-full w-full flex-col bg-dark-900">
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-white/[0.06] px-4">
        <BookOpen size={15} className="text-accent-light" />
        <h2 className="shrink-0 whitespace-nowrap text-[13px] font-semibold uppercase tracking-wide text-white">Admin Books</h2>
        <span className="min-w-0 flex-1 truncate text-xs text-dark-300">Review player-written books and remove anything that does not belong.</span>
        {notice && <span className="shrink-0 whitespace-nowrap text-xs text-accent-light">{notice}</span>}
        <SearchInput value={search} onChange={setSearch} placeholder="Title, author, citizen ID, #id" className="w-72" />
        <IconButton onClick={load} aria-label="Refresh"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></IconButton>
        <IconButton onClick={onClose} aria-label="Close"><X size={14} /></IconButton>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
        <div className="grid grid-cols-3 gap-3">
          <StatTile icon={<BookOpen size={16} />} label="Books" value={books.length} />
          <StatTile icon={<Eye size={16} />} label="Pages" value={books.reduce((n, b) => n + b.pageCount, 0)} tone="info" />
          <StatTile icon={<ImageIcon size={16} />} label="Images" value={books.reduce((n, b) => n + b.imageCount, 0)} tone="warning" />
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-white/[0.07] bg-dark-800">
          <div className={`grid ${GRID} gap-3 border-b border-white/[0.06] bg-dark-700/50 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-dark-300`}>
            <span />
            <span>Title</span>
            <span>Author</span>
            <span>Pages</span>
            <span>Images</span>
            <span>Copies</span>
            <span>Created</span>
            <span className="text-right">Actions</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {error ? (
              <EmptyState title="Books unavailable" hint={error} />
            ) : !loading && filtered.length === 0 ? (
              <EmptyState icon={<BookOpen size={20} />} title={search ? 'No books match your search' : 'No books have been written yet'} />
            ) : (
              filtered.map((b) => (
                <div key={b.id} className={`grid ${GRID} items-center gap-3 border-b border-white/[0.04] px-4 py-2.5 hover:bg-white/[0.02]`}>
                  <span className="h-7 w-5 border border-black/40" style={{ background: COVER_COLORS[b.cover]?.bg }} />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-white">{b.title}</p>
                    <p className="flex items-center gap-1.5 font-mono text-[10px] text-dark-300">
                      <span className="shrink-0">#{b.id}</span>
                      {b.published && <Badge tone="success" className="shrink-0"><Lock size={9} />Published</Badge>}
                      {b.shared && <Badge tone="info" className="shrink-0"><Users size={9} />Shared</Badge>}
                      {b.description && <span className="truncate">{b.description}</span>}
                    </p>
                    {b.shared && b.lastEditor && b.lastEditor !== b.authorName && (
                      <p className="truncate text-[10px] text-warning">Last edited by {b.lastEditor}</p>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1 truncate text-xs text-gray-300"><User size={11} className="shrink-0 text-accent-light" />{b.authorName}</p>
                    <p className="truncate font-mono text-[10px] text-dark-300">{b.authorCitizenId}</p>
                  </div>
                  <span className="font-mono text-xs text-gray-300">{b.pageCount}</span>
                  <span>{b.imageCount > 0 ? <Badge tone="warning" mono>{b.imageCount}</Badge> : <span className="font-mono text-xs text-dark-400">0</span>}</span>
                  <span className="font-mono text-xs text-gray-300">{b.printLimit ? `${b.copies ?? 0} / ${b.printLimit}` : (b.copies ?? 0)}</span>
                  <span className="font-mono text-[11px] text-dark-300">{b.createdAt}</span>
                  <div className="flex justify-end gap-1">
                    <IconButton onClick={() => openPreview(b.id)} aria-label="Preview"><Eye size={13} /></IconButton>
                    <IconButton onClick={() => setPendingDelete(b)} aria-label="Delete" className="text-danger hover:text-danger"><Trash2 size={13} /></IconButton>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {preview && (
        <Modal
          title={preview.title}
          icon={<BookOpen size={14} />}
          className="w-[640px]"
          onClose={() => setPreview(null)}
          footer={
            <>
              <Button onClick={() => setPreview(null)}>Close</Button>
              <Button variant="danger" icon={<Trash2 size={12} />} onClick={() => setPendingDelete(preview)}>Delete Book</Button>
            </>
          }
        >
          <p className="mb-3 font-mono text-[11px] text-dark-300">
            #{preview.id} · {preview.authorName} ({preview.authorCitizenId}) · {preview.pageCount} pages
          </p>
          <div className="flex max-h-[420px] flex-col gap-3 overflow-y-auto pr-1">
            {preview.pages.map((p, i) => (
              <section key={i} className="border border-white/[0.08] bg-dark-900 p-3">
                <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-dark-400">Page {i + 1}</p>
                <div className="flex flex-col gap-2">
                  {p.blocks.map((blk, j) => <BlockPreview key={j} block={blk} />)}
                </div>
              </section>
            ))}
          </div>
        </Modal>
      )}

      {pendingDelete && (
        <Modal
          title="Delete Book"
          onClose={() => setPendingDelete(null)}
          footer={
            <>
              <Button onClick={() => setPendingDelete(null)}>Cancel</Button>
              <Button variant="danger" icon={<Trash2 size={12} />} onClick={confirmDelete}>Delete</Button>
            </>
          }
        >
          <p className="text-xs text-gray-300">
            Delete "{pendingDelete.title}" by {pendingDelete.authorName}? Copies already in inventories stay, but can no longer be read. This cannot be undone.
          </p>
        </Modal>
      )}
    </div>
  );
}
