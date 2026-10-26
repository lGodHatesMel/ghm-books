import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Bold, Check, Image as ImageIcon, Italic, Link2, RotateCcw, Trash2, Type } from 'lucide-react';
import type { CoverDesign, CoverElement, CoverFrame, CoverText, Limits } from '../types';
import { Button, IconButton } from '../ui/Button';
import { Field, Input, Segmented, Select } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { cn } from '../utils/cn';
import {
  COVER_FONTS, COVER_TEXTURES, COVER_TEXT_COLORS, coverImageCount, hostAllowed, hostsHint, isValidUrl, newCoverImage, newCoverText,
} from '../utils/book';
import CoverRender from './CoverRender';

interface Props {
  design: CoverDesign;
  limits: Limits;
  presetColors: string[];
  onChange: (design: CoverDesign) => void;
  onReset: () => void;
  onDone: () => void;
}

const FRAMES: { value: CoverFrame; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'line', label: 'Line' },
  { value: 'double', label: 'Double' },
  { value: 'corners', label: 'Corners' },
];

/** Full-height editor for a custom cover: background, texture, frame, and draggable text and images. */
export default function CoverDesigner({ design, limits, presetColors, onChange, onReset, onDone }: Props) {
  const [selected, setSelected] = useState<string | null>(design.elements[0]?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [urlOpen, setUrlOpen] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);

  const sel = design.elements.find((e) => e.id === selected) ?? null;
  const images = coverImageCount(design);

  const patch = (next: Partial<CoverDesign>) => onChange({ ...design, ...next });
  const patchEl = (id: string, next: Partial<CoverElement>) =>
    patch({ elements: design.elements.map((e) => (e.id === id ? ({ ...e, ...next } as CoverElement) : e)) });

  const addElement = (el: CoverElement) => {
    if (design.elements.length >= limits.maxCoverElements) return setError(`A cover holds at most ${limits.maxCoverElements} elements`);
    setError(null);
    patch({ elements: [...design.elements, el] });
    setSelected(el.id);
  };

  const addImage = (src: string) => {
    if (images >= limits.maxCoverImages) return setError(`A cover holds at most ${limits.maxCoverImages} images`);
    addElement(newCoverImage(src));
  };

  const move = (id: string, delta: number) => {
    const i = design.elements.findIndex((e) => e.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= design.elements.length) return;
    const next = design.elements.slice();
    [next[i], next[j]] = [next[j], next[i]];
    patch({ elements: next });
  };

  const startDrag = (id: string, e: React.PointerEvent) => {
    e.preventDefault();
    setSelected(id);
    const box = boxRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    const el = design.elements.find((x) => x.id === id);
    if (!el) return;
    const start = { px: e.clientX, py: e.clientY, x: el.x, y: el.y };

    const onMove = (ev: PointerEvent) => {
      const x = start.x + ((ev.clientX - start.px) / rect.width) * 100;
      const y = start.y + ((ev.clientY - start.py) / rect.height) * 100;
      onChange({
        ...design,
        elements: design.elements.map((it) => (it.id === id ? { ...it, x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) } : it)),
      });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const text: CoverText | null = sel && sel.type === 'text' ? sel : null;

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-[300px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-white/[0.06] p-4">
        <Field label="Background">
          <div className="flex items-center gap-1.5">
            {presetColors.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => patch({ bg: c })}
                className={cn('h-6 w-6 rounded border', design.bg === c ? 'border-accent-light ring-1 ring-accent-light' : 'border-white/10')}
                style={{ background: c }}
              />
            ))}
            <input
              type="color"
              value={design.bg}
              onChange={(e) => patch({ bg: e.target.value })}
              className="h-6 w-9 shrink-0 cursor-pointer rounded border border-white/10 bg-transparent p-0"
              aria-label="Custom background colour"
            />
          </div>
        </Field>
        <Field label="Texture">
          <Segmented value={design.texture} onChange={(v) => patch({ texture: v })} options={COVER_TEXTURES.map((t) => ({ value: t.id, label: t.label }))} />
        </Field>
        <Field label="Frame">
          <Segmented value={design.frame} onChange={(v) => patch({ frame: v })} options={FRAMES} />
        </Field>
        {design.frame !== 'none' && (
          <Field label="Frame colour">
            <input
              type="color"
              value={design.frameColor}
              onChange={(e) => patch({ frameColor: e.target.value })}
              className="h-7 w-full cursor-pointer rounded border border-white/10 bg-transparent p-0"
              aria-label="Frame colour"
            />
          </Field>
        )}

        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-dark-300">Elements ({design.elements.length}/{limits.maxCoverElements})</span>
          <div className="flex gap-1.5">
            <Button size="sm" icon={<Type size={12} />} onClick={() => addElement(newCoverText())}>Text</Button>
            <Button size="sm" icon={<Link2 size={12} />} onClick={() => { setUrlValue(''); setUrlOpen(true); }}>Image</Button>
          </div>
          <div className="flex flex-col gap-1">
            {design.elements.map((el) => (
              <button
                key={el.id}
                type="button"
                onClick={() => setSelected(el.id)}
                className={cn('flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs', el.id === selected ? 'border-accent/40 bg-accent/10 text-white' : 'border-white/[0.06] bg-dark-800 text-gray-300 hover:bg-dark-700')}
              >
                {el.type === 'text' ? <Type size={11} className="shrink-0" /> : <ImageIcon size={11} className="shrink-0" />}
                <span className="min-w-0 flex-1 truncate">{el.type === 'text' ? el.text : 'Image'}</span>
              </button>
            ))}
          </div>
        </div>

        {sel && (
          <div className="flex flex-col gap-3 border-t border-white/[0.06] pt-3">
            <div className="flex items-center gap-1">
              <span className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-dark-300">Selected</span>
              <IconButton className="h-6 w-6" onClick={() => move(sel.id, 1)} aria-label="Bring forward"><ArrowUp size={12} /></IconButton>
              <IconButton className="h-6 w-6" onClick={() => move(sel.id, -1)} aria-label="Send back"><ArrowDown size={12} /></IconButton>
              <IconButton
                className="h-6 w-6 text-danger hover:text-danger"
                aria-label="Remove element"
                onClick={() => { patch({ elements: design.elements.filter((e) => e.id !== sel.id) }); setSelected(null); }}
              >
                <Trash2 size={12} />
              </IconButton>
            </div>

            {text ? (
              <>
                <Field label="Text" hint={<span className="font-mono">{text.text.length}/{limits.maxCoverText}</span>}>
                  <textarea
                    value={text.text}
                    maxLength={limits.maxCoverText}
                    rows={2}
                    onChange={(e) => patchEl(text.id, { text: e.target.value })}
                    className="w-full resize-none rounded-md border border-white/10 bg-dark-900 p-2 text-xs text-gray-100 focus:border-accent/50 focus:outline-none"
                  />
                </Field>
                <Field label="Font">
                  <Select value={text.font} onChange={(e) => patchEl(text.id, { font: e.target.value as CoverText['font'] })}>
                    {COVER_FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                  </Select>
                </Field>
                <Field label={`Size ${text.size.toFixed(1)}`}>
                  <input type="range" min={2} max={20} step={0.5} value={text.size} onChange={(e) => patchEl(text.id, { size: Number(e.target.value) })} />
                </Field>
                <div className="flex items-center gap-1.5">
                  {COVER_TEXT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => patchEl(text.id, { color: c })}
                      className={cn('h-5 w-5 rounded-sm border', text.color === c ? 'border-accent-light ring-1 ring-accent-light' : 'border-white/20')}
                      style={{ background: c }}
                      aria-label={`Colour ${c}`}
                    />
                  ))}
                  <input type="color" value={text.color} onChange={(e) => patchEl(text.id, { color: e.target.value })} className="h-5 w-7 cursor-pointer rounded border border-white/10 bg-transparent p-0" aria-label="Custom text colour" />
                  <div className="flex-1" />
                  <IconButton className={cn('h-6 w-6', text.bold && 'bg-white/10 text-white')} onClick={() => patchEl(text.id, { bold: !text.bold })} aria-label="Bold"><Bold size={12} /></IconButton>
                  <IconButton className={cn('h-6 w-6', text.italic && 'bg-white/10 text-white')} onClick={() => patchEl(text.id, { italic: !text.italic })} aria-label="Italic"><Italic size={12} /></IconButton>
                </div>
              </>
            ) : (
              sel.type === 'image' && (
                <Field label={`Width ${Math.round(sel.w)}%`}>
                  <input type="range" min={5} max={100} step={1} value={sel.w} onChange={(e) => patchEl(sel.id, { w: Number(e.target.value) })} />
                </Field>
              )
            )}
          </div>
        )}
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-white/[0.06] px-4">
          <span className="font-mono text-[11px] text-dark-300">Drag text and images on the cover to place them</span>
          <div className="flex-1" />
          <Button size="sm" icon={<RotateCcw size={12} />} onClick={onReset}>Use automatic cover</Button>
          <Button size="sm" variant="primary" icon={<Check size={12} />} onClick={onDone}>Done</Button>
        </div>
        <div className="flex flex-1 items-center justify-center overflow-hidden p-4" onPointerDown={() => setSelected(null)}>
          <div ref={boxRef} className="relative border border-black/60" style={{ width: 380, height: 545 }} onPointerDown={(e) => e.stopPropagation()}>
            <CoverRender design={design} selectedId={selected} onElementPointerDown={startDrag} />
          </div>
        </div>
        {error && <p className="shrink-0 px-4 pb-2 text-xs text-danger">{error}</p>}
      </main>

      {urlOpen && (
        <Modal
          title="Add Cover Image"
          icon={<Link2 size={14} />}
          onClose={() => setUrlOpen(false)}
          footer={
            <>
              <Button onClick={() => setUrlOpen(false)}>Cancel</Button>
              <Button variant="primary" disabled={!isValidUrl(urlValue) || urlValue.length > limits.maxUrlLength || !hostAllowed(urlValue, limits.imageHosts)} onClick={() => { addImage(urlValue.trim()); setUrlOpen(false); }}>
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
    </div>
  );
}
