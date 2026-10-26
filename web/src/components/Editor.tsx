import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, FilePlus2, Link2, Palette, Plus, Save, Trash2, X } from 'lucide-react';
import type { Block, Book, CoverDesign, CoverId, Limits, Page, PageFont, PaperId, SaveResult } from '../types';
import { computerMode } from '../utils/computer';
import { Badge } from '../ui/Badge';
import { Button, IconButton } from '../ui/Button';
import { Field, Input, Segmented } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { cn } from '../utils/cn';
import { fetchNui } from '../utils/nui';
import {
  COVER_COLORS, PAGE_FONTS, PAPERS, countImages, coverImageCount, coverWithIds, defaultCover, estimateBytes, formatKB, hostAllowed, hostsHint, isValidUrl,
  newImageBlock, newPage, newTextBlock, withIds,
} from '../utils/book';
import FlipBook from './FlipBook';
import PageEditor, { type PageActions } from './PageEditor';
import CoverDesigner from './CoverDesigner';
import { BackCoverFace, CoverFace, InsideCover, PaperFace, faceCountFor, faceKind, resolveCover, sideOf, spreadForFace } from './faces';

interface Props {
  initial?: Book;
  slot: number | string;
  limits: Limits;
  covers: CoverId[];
  onClose: () => void;
  onSaved: (info: { bookId?: number; isNew: boolean }) => void;
}

const PAGE_W = 380;
const PAGE_H = 545;

function move<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export default function Editor({ initial, slot, limits, covers, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [cover, setCover] = useState<CoverId>(initial?.cover ?? covers[0] ?? 'oxblood');
  const [paper, setPaper] = useState<PaperId>(initial?.paper ?? 'blank');
  const [font, setFont] = useState<PageFont>(initial?.font ?? 'serif');
  const [dedication, setDedication] = useState(initial?.dedication ?? '');
  const [printLimit, setPrintLimit] = useState(initial?.printLimit ?? 0);
  const [shared, setShared] = useState(initial?.shared ?? false);
  const [publish, setPublish] = useState(false);
  const [anonymous, setAnonymous] = useState(initial?.anonymous ?? false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [signCopy, setSignCopy] = useState(false);
  const [inscription, setInscription] = useState('');
  const [coverDesign, setCoverDesign] = useState<CoverDesign | null>(() => coverWithIds(initial?.coverDesign));
  const [designing, setDesigning] = useState(false);
  const [pages, setPages] = useState<Page[]>(() => (initial ? withIds(initial.pages) : [newPage()]));
  const [spread, setSpread] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlTarget, setUrlTarget] = useState<string | null>(null);
  const [urlValue, setUrlValue] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);
  const [dirty, setDirty] = useState(false);

  const images = countImages(pages);
  const bytes = useMemo(() => estimateBytes(pages, coverDesign, limits.uploads), [pages, coverDesign, limits.uploads]);
  const isEdit = initial?.id !== undefined;
  // Editing someone else's shared book: only the pages, cover and look can change, not who may edit or the print run.
  const guest = isEdit && initial?.isAuthor === false;
  const realName = initial?.authorName ?? 'You';
  const authorName = anonymous && !publish ? 'Anonymous' : realName;
  const faceCount = faceCountFor(pages.length);
  const design = resolveCover(coverDesign, cover, title, description, authorName);
  const presetColors = covers.map((c) => COVER_COLORS[c].bg);
  const overBudget = bytes > limits.maxBookBytes;

  const edit = <T,>(fn: (v: T) => void) => (v: T) => {
    setDirty(true);
    setError(null);
    fn(v);
  };

  const mutatePage = (pageId: string, fn: (p: Page) => Page) => {
    setDirty(true);
    setError(null);
    setPages((prev) => prev.map((p) => (p.id === pageId ? fn(p) : p)));
  };

  const pageOf = (pageId: string) => pages.find((p) => p.id === pageId);

  const addBlock = (pageId: string, block: Block) => {
    const page = pageOf(pageId);
    if (!page) return;
    if (page.blocks.length >= limits.maxBlocksPerPage) return setError(`A page holds at most ${limits.maxBlocksPerPage} blocks`);
    mutatePage(pageId, (p) => ({ ...p, blocks: [...p.blocks, block] }));
  };

  const addImage = (pageId: string, src: string) => {
    if (images >= limits.maxImages) return setError(`A book holds at most ${limits.maxImages} images`);
    addBlock(pageId, newImageBlock(src));
  };

  const actions: PageActions = {
    updateBlock: (pageId, blockId, patch) =>
      mutatePage(pageId, (p) => ({ ...p, blocks: p.blocks.map((b) => (b.id === blockId ? ({ ...b, ...patch } as Block) : b)) })),
    moveBlock: (pageId, from, to) => mutatePage(pageId, (p) => ({ ...p, blocks: move(p.blocks, from, to) })),
    removeBlock: (pageId, blockId) => mutatePage(pageId, (p) => ({ ...p, blocks: p.blocks.filter((b) => b.id !== blockId) })),
    addText: (pageId) => addBlock(pageId, newTextBlock()),
    addUrl: (pageId) => {
      setUrlValue('');
      setUrlTarget(pageId);
    },
  };

  const addPageAtEnd = () => {
    if (pages.length >= limits.maxPages) return setError(`A book holds at most ${limits.maxPages} pages`);
    setDirty(true);
    setPages((prev) => [...prev, newPage()]);
    // The new page is face (pages.length + 2); turn to the spread that shows it.
    setSpread(spreadForFace(pages.length + 2));
  };

  const deletePage = (i: number) => {
    if (pages.length === 1) return;
    setDirty(true);
    setPages((prev) => prev.filter((_, idx) => idx !== i));
    setSpread((s) => Math.min(s, faceCountFor(pages.length - 1) / 2));
  };

  const shiftPage = (i: number, delta: number) => {
    setDirty(true);
    setPages((prev) => move(prev, i, i + delta));
    setSpread(spreadForFace(i + delta + 2));
  };

  const save = async (confirmed = false) => {
    if (!title.trim()) return setError('Give the book a title');
    if (publish && !confirmed) return setConfirmPublish(true);
    setConfirmPublish(false);
    setSaving(true);
    setError(null);
    const res = await fetchNui<SaveResult>('save', {
      bookId: initial?.id,
      slot,
      title: title.trim(),
      description: description.trim(),
      cover,
      paper,
      font,
      dedication: dedication.trim(),
      printLimit,
      shared: shared && !publish,
      published: publish,
      anonymous: anonymous && !publish,
      revision: initial?.revision,
      signed: signCopy && !(anonymous && !publish),
      inscription: inscription.trim(),
      coverDesign: coverDesign ? { ...coverDesign, elements: coverDesign.elements.map(({ id: _id, ...rest }) => rest) } : null,
      pages: pages.map((p) => ({ blocks: p.blocks.map(({ id: _id, ...rest }) => rest) })),
    });
    setSaving(false);
    if (!res?.ok) return setError(res?.error ?? 'Could not save the book');
    onSaved({ bookId: res.bookId, isNew: !isEdit });
  };

  const requestClose = () => (dirty ? setConfirmClose(true) : onClose());

  // Inside an SD Computers window, closing the window with unsaved changes asks first.
  useEffect(() => {
    if (!computerMode) return;
    window.computer?.window.preventClose(dirty ? 'Discard your unsaved changes to this book?' : false);
    return () => { window.computer?.window.preventClose(false); };
  }, [dirty]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const renderFace = (i: number) => {
    const f = faceKind(i, pages.length);
    switch (f.kind) {
      case 'cover':
        return <CoverFace design={design} />;
      case 'back':
        return <BackCoverFace design={design} />;
      case 'page': {
        const page = pages[f.page];
        return (
          <PaperFace number={f.page + 1} side={sideOf(i)} paper={paper} font={font}>
            <PageEditor page={page} actions={actions} limits={limits} />
          </PaperFace>
        );
      }
      case 'inside':
        return (
          <InsideCover
            side={sideOf(i)} paper={paper} font={font} authorName={authorName} dedication={dedication.trim()}
            copy={!isEdit && !computerMode ? 1 : undefined} edition={printLimit || undefined}
            signed={!isEdit && signCopy && !(anonymous && !publish)} inscription={isEdit ? undefined : inscription.trim()}
          />
        );
      case 'pad':
        return (
          <PaperFace side={sideOf(i)} paper={paper} font={font}>
            <div className="grid h-full place-items-center">
              <button
                type="button"
                onClick={addPageAtEnd}
                className="inline-flex items-center gap-1.5 rounded-sm border border-dashed border-black/30 px-3 py-2 text-xs paper-muted hover:bg-black/5"
              >
                <Plus size={13} /> Add a page
              </button>
            </div>
          </PaperFace>
        );
      default:
        return <PaperFace side={sideOf(i)} paper={paper} font={font} />;
    }
  };

  return (
    <div className="flex h-full w-full flex-col bg-dark-900">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-white/[0.06] px-4">
        <FilePlus2 size={15} className="text-accent-light" />
        <h2 className="text-[13px] font-semibold text-white">{isEdit ? 'Edit Book' : 'Book Creator'}</h2>
        <Badge tone="neutral" mono>{isEdit ? `#${initial?.id}` : 'New'}</Badge>
        <div className="flex-1" />
        <span className="font-mono text-[11px] text-dark-300">{designing ? 'Cover designer' : 'Drag a page edge to turn it'}</span>
        <Button variant="primary" icon={<Save size={13} />} busy={saving} disabled={overBudget} onClick={() => save()}>
          {isEdit ? 'Save Changes' : 'Save Book'}
        </Button>
        <IconButton onClick={requestClose} aria-label="Close">
          <X size={14} />
        </IconButton>
      </header>

      {designing && coverDesign ? (
        <CoverDesigner
          design={coverDesign}
          limits={limits}
          presetColors={presetColors}
          onChange={(d) => { setDirty(true); setCoverDesign(d); }}
          onReset={() => { setCoverDesign(null); setDesigning(false); }}
          onDone={() => setDesigning(false)}
        />
      ) : (
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[270px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-white/[0.06] p-4">
          {guest && (
            <p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              This is a shared book by {initial?.authorName}. Your changes are saved to the one book every copy opens, and the author can restore the earlier version.
            </p>
          )}
          <Field label="Title" hint={<span className="font-mono">{title.length}/{limits.maxTitle}</span>}>
            <Input value={title} maxLength={limits.maxTitle} onChange={(e) => edit(setTitle)(e.target.value)} placeholder="Book title" />
          </Field>
          <Field label="Description" hint={<span className="font-mono">{description.length}/{limits.maxDescription}</span>}>
            <textarea
              value={description}
              maxLength={limits.maxDescription}
              onChange={(e) => edit(setDescription)(e.target.value)}
              rows={2}
              placeholder="Shown on the cover"
              className="w-full resize-none rounded-md border border-white/10 bg-dark-900 p-2.5 text-xs text-gray-100 placeholder:text-dark-400 focus:border-accent/50 focus:outline-none"
            />
          </Field>
          {!guest && (
            <Field label="Who can edit" hint={shared ? 'Anyone holding a copy can change the pages. You can restore the previous version.' : 'Only you can edit this book.'}>
              <Segmented
                value={shared ? 'shared' : 'locked'}
                onChange={(v) => edit(setShared)(v === 'shared')}
                options={[{ value: 'locked', label: 'Only me' }, { value: 'shared', label: 'Anyone with a copy' }]}
              />
            </Field>
          )}
          {!guest && (
            <Field label="Author name" hint={publish ? 'A published book always shows its author.' : anonymous ? 'Readers see Anonymous, and the book item shows no author. Staff can still see who wrote it.' : 'Shown on the cover, inside and on the book item.'}>
              <Segmented
                value={anonymous && !publish ? 'anonymous' : 'named'}
                onChange={(v) => { if (!publish) edit(setAnonymous)(v === 'anonymous'); }}
                options={[{ value: 'named', label: 'My name' }, { value: 'anonymous', label: 'Anonymous' }]}
              />
            </Field>
          )}
          {!guest && computerMode && (
            <Field label="Publishing" hint={publish ? 'Final. After saving, nobody can edit this book again, you included. It can still be read and printed.' : 'A draft can be edited later. Publish it when it is finished.'}>
              <Segmented
                value={publish ? 'publish' : 'draft'}
                onChange={(v) => edit(setPublish)(v === 'publish')}
                options={[{ value: 'draft', label: 'Draft' }, { value: 'publish', label: 'Publish' }]}
              />
            </Field>
          )}
          <Field label="Cover">
            <div className="grid grid-cols-6 gap-1.5">
              {covers.map((c) => (
                <button
                  key={c}
                  type="button"
                  title={COVER_COLORS[c].label}
                  onClick={() => { edit(setCover)(c); if (coverDesign) setCoverDesign({ ...coverDesign, bg: COVER_COLORS[c].bg }); }}
                  className={cn('h-7 rounded border', c === cover ? 'border-accent-light ring-1 ring-accent-light' : 'border-white/10')}
                  style={{ background: COVER_COLORS[c].bg }}
                />
              ))}
            </div>
            <Button
              size="sm"
              icon={<Palette size={12} />}
              onClick={() => { if (!coverDesign) setCoverDesign(defaultCover(cover, title, description, authorName)); setDirty(true); setDesigning(true); }}
            >
              {coverDesign ? 'Edit custom cover' : 'Design custom cover'}
            </Button>
          </Field>
          <Field label="Paper">
            <div className="grid grid-cols-3 gap-1.5">
              {PAPERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  title={p.hint}
                  onClick={() => edit(setPaper)(p.id)}
                  className={cn('flex h-12 flex-col justify-end rounded border p-1 text-left', p.id === paper ? 'border-accent-light ring-1 ring-accent-light' : 'border-white/10')}
                >
                  <span className={`paper paper-t-${p.id} block h-full w-full rounded-sm`} style={{ border: 'none', backgroundSize: p.id === 'dotted' ? '8px 8px' : undefined }} />
                  <span className="mt-0.5 text-[10px] font-medium text-gray-300">{p.label}</span>
                </button>
              ))}
            </div>
          </Field>

          <Field label="Page text">
            <div className="grid grid-cols-2 gap-1.5">
              {PAGE_FONTS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  title={f.hint}
                  onClick={() => edit(setFont)(f.id)}
                  className={cn('rounded border px-2 py-1.5 text-left', f.id === font ? 'border-accent-light bg-accent/10' : 'border-white/10 bg-dark-800 hover:bg-dark-700')}
                >
                  <span className={`paper-f-${f.id} block text-base leading-none text-white`}>Aa</span>
                  <span className="mt-1 block text-[10px] text-gray-300">{f.label}</span>
                </button>
              ))}
            </div>
          </Field>
          {!guest && <Field label="Dedication" hint={<span className="font-mono">{dedication.length}/{limits.maxDedication}</span>}>
            <textarea
              value={dedication}
              maxLength={limits.maxDedication}
              onChange={(e) => edit(setDedication)(e.target.value)}
              rows={2}
              placeholder="For..."
              className="w-full resize-none rounded-md border border-white/10 bg-dark-900 p-2.5 text-xs text-gray-100 placeholder:text-dark-400 focus:border-accent/50 focus:outline-none"
            />
          </Field>}
          {!guest && <Field
            label="Limited edition"
            hint={isEdit ? `${initial?.copies ?? 0} printed so far. 0 means no limit.` : '0 means no limit. Copies are numbered "Copy 3 of 10".'}
          >
            <Input
              type="number"
              min={isEdit ? (initial?.copies ?? 0) : 0}
              max={limits.maxEdition}
              value={printLimit}
              onChange={(e) => edit(setPrintLimit)(Math.max(0, Math.min(limits.maxEdition, Math.floor(Number(e.target.value) || 0))))}
              mono
            />
          </Field>}
          {!isEdit && !computerMode && (
            <Field label="Your copy" hint="A signed copy shows your signature on the inside cover.">
              <label className="flex items-center gap-2 text-xs text-gray-300">
                <input type="checkbox" checked={signCopy && !(anonymous && !publish)} disabled={anonymous && !publish} onChange={(e) => edit(setSignCopy)(e.target.checked)} />
                {anonymous && !publish ? 'Signing is off for anonymous books' : 'Sign my copy'}
              </label>
              <Input
                value={inscription}
                maxLength={limits.maxInscription}
                onChange={(e) => edit(setInscription)(e.target.value)}
                placeholder="Inscription (optional)"
              />
            </Field>
          )}

          <div className="flex min-h-0 flex-1 flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-dark-300">Pages</span>
              <Button size="sm" icon={<Plus size={12} />} onClick={addPageAtEnd}>Add</Button>
            </div>
            <div className="flex flex-col gap-1 overflow-y-auto">
              <button
                type="button"
                onClick={() => setSpread(0)}
                className={cn('rounded-md border px-2 py-1.5 text-left text-xs text-gray-200', spread === 0 ? 'border-accent/40 bg-accent/10' : 'border-white/[0.06] bg-dark-800 hover:bg-dark-700')}
              >
                <span className="mr-2 font-mono text-dark-300">--</span>Cover
              </button>
              {pages.map((p, i) => {
                const active = spread === spreadForFace(i + 2);
                const firstText = p.blocks.find((b) => b.type === 'text' && b.text);
                return (
                  <div
                    key={p.id}
                    className={cn('group flex items-center gap-1.5 rounded-md border px-2 py-1.5', active ? 'border-accent/40 bg-accent/10' : 'border-white/[0.06] bg-dark-800 hover:bg-dark-700')}
                  >
                    <button type="button" className="flex-1 truncate text-left text-xs text-gray-200" onClick={() => setSpread(spreadForFace(i + 2))}>
                      <span className="mr-2 font-mono text-dark-300">{String(i + 1).padStart(2, '0')}</span>
                      {firstText && firstText.type === 'text' ? firstText.text.slice(0, 22) : <span className="text-dark-400">Empty page</span>}
                    </button>
                    <IconButton className="h-5 w-5 opacity-0 group-hover:opacity-100" onClick={() => shiftPage(i, -1)} disabled={i === 0} aria-label="Move page up"><ArrowUp size={11} /></IconButton>
                    <IconButton className="h-5 w-5 opacity-0 group-hover:opacity-100" onClick={() => shiftPage(i, 1)} disabled={i === pages.length - 1} aria-label="Move page down"><ArrowDown size={11} /></IconButton>
                    <IconButton className="h-5 w-5 opacity-0 group-hover:opacity-100" onClick={() => deletePage(i)} disabled={pages.length === 1} aria-label="Delete page"><Trash2 size={11} /></IconButton>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-1 items-center justify-center overflow-hidden">
            <FlipBook faceCount={faceCount} spread={spread} onSpreadChange={setSpread} renderFace={renderFace} pageW={PAGE_W} pageH={PAGE_H} grab="edge" boardColor={design.bg} />
          </div>

          <footer className="flex h-9 shrink-0 items-center gap-4 border-t border-white/[0.06] px-4 font-mono text-[11px] text-dark-300">
            <span>PAGES {pages.length}/{limits.maxPages}</span>
            <span>IMAGES {images}/{limits.maxImages}</span>
            <span>COVER IMAGES {coverImageCount(coverDesign)}/{limits.maxCoverImages}</span>
            <span className={overBudget ? 'text-danger' : ''}>SIZE {formatKB(bytes)}/{formatKB(limits.maxBookBytes)}</span>
            <div className="flex-1" />
            {error && <span className="font-sans text-xs text-danger">{error}</span>}
          </footer>
        </main>
      </div>
      )}

      {urlTarget && (
        <Modal
          title="Add Image"
          icon={<Link2 size={14} />}
          onClose={() => setUrlTarget(null)}
          footer={
            <>
              <Button onClick={() => setUrlTarget(null)}>Cancel</Button>
              <Button
                variant="primary"
                disabled={!isValidUrl(urlValue) || urlValue.length > limits.maxUrlLength || !hostAllowed(urlValue, limits.imageHosts)}
                onClick={() => { addImage(urlTarget, urlValue.trim()); setUrlTarget(null); }}
              >
                Add Image
              </Button>
            </>
          }
        >
          <Field
            label="Direct image link"
            hint={isValidUrl(urlValue) && !hostAllowed(urlValue, limits.imageHosts) ? <span className="text-danger">That site is not allowed. {hostsHint(limits.imageHosts)}</span> : hostsHint(limits.imageHosts)}
          >
            <Input autoFocus value={urlValue} onChange={(e) => setUrlValue(e.target.value)} placeholder="https://i.imgur.com/..." mono />
          </Field>
        </Modal>
      )}

      {confirmPublish && (
        <Modal
          title="Publish Book"
          onClose={() => setConfirmPublish(false)}
          footer={
            <>
              <Button onClick={() => setConfirmPublish(false)}>Keep Editing</Button>
              <Button variant="danger" onClick={() => save(true)}>Publish</Button>
            </>
          }
        >
          <p className="text-xs text-gray-300">
            Publishing is final. Once "{title.trim()}" is published, nobody can change its pages, cover or settings again, including you. Check the pages and the print run first.
          </p>
        </Modal>
      )}

      {confirmClose && (
        <Modal
          title="Discard Changes"
          onClose={() => setConfirmClose(false)}
          footer={
            <>
              <Button onClick={() => setConfirmClose(false)}>Keep Editing</Button>
              <Button variant="danger" onClick={onClose}>Discard</Button>
            </>
          }
        >
          <p className="text-xs text-gray-300">Your unsaved changes to this book will be lost.</p>
        </Modal>
      )}
    </div>
  );
}
