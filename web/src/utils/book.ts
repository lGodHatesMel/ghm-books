import type { Block, CoverDesign, CoverElement, CoverFont, CoverId, CoverTexture, Page, PageFont, PaperId } from '../types';

let counter = 0;
export const uid = () => `${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const COVER_COLORS: Record<CoverId, { bg: string; label: string }> = {
  oxblood: { bg: '#6e2430', label: 'Oxblood' },
  forest: { bg: '#24473a', label: 'Forest' },
  navy: { bg: '#223552', label: 'Navy' },
  slate: { bg: '#3b4250', label: 'Slate' },
  ochre: { bg: '#8a6a24', label: 'Ochre' },
  black: { bg: '#17181c', label: 'Black' },
};

export const newTextBlock = (): Block => ({ id: uid(), type: 'text', text: '', style: 'body', align: 'left' });
export const newImageBlock = (src: string): Block => ({ id: uid(), type: 'image', src, caption: '' });
export const newPage = (): Page => ({ id: uid(), blocks: [newTextBlock()] });

/** Server pages carry no ids; give each page and block one so React can key them. */
export function withIds(pages: Page[]): Page[] {
  return pages.map((p) => ({
    id: p.id || uid(),
    blocks: (p.blocks ?? []).map((b) => ({ ...b, id: b.id || uid() })),
  }));
}

export function countImages(pages: Page[]): number {
  return pages.reduce((n, p) => n + p.blocks.filter((b) => b.type === 'image').length, 0);
}

// With picture hosting on, a picture added from the computer is stored as a link, not as its data.
const LINK_BYTES = 120;
const srcBytes = (src: string, hosted: boolean) => (hosted && src.startsWith('data:') ? LINK_BYTES : src.length);

export function estimateBytes(pages: Page[], cover?: CoverDesign | null, hosted = false): number {
  const coverBytes = cover
    ? cover.elements.reduce((n, e) => n + (e.type === 'image' ? srcBytes(e.src, hosted) : e.text.length) + 60, 0)
    : 0;
  return coverBytes + estimatePages(pages, hosted);
}

function estimatePages(pages: Page[], hosted: boolean): number {
  return pages.reduce(
    (n, p) => n + p.blocks.reduce((m, b) => m + (b.type === 'image' ? srcBytes(b.src, hosted) : b.text.length) + 40, 0),
    0,
  );
}

export const formatKB = (bytes: number) => `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;

/**
 * Downscale and re-encode a picked file so it fits the per-image budget (JPEG for pages, WebP for covers so
 * logos keep their transparency).
 * Tries progressively smaller dimensions/quality until under maxBytes.
 */
export async function compressImage(file: File, maxBytes: number, format: 'jpeg' | 'webp' = 'jpeg'): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('That file is not an image');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not read that image'));
      el.src = url;
    });

    let maxSide = 900;
    for (let attempt = 0; attempt < 6; attempt++) {
      const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable');
      if (format === 'jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      for (const q of [0.78, 0.62, 0.48]) {
        const data = canvas.toDataURL(`image/${format}`, q);
        if (data.length <= maxBytes) return data;
      }
      maxSide = Math.round(maxSide * 0.75);
    }
    throw new Error('Image is too large even after compression');
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const isValidUrl = (v: string) => /^https?:\/\/[^\s"'<>]+$/.test(v);

/** Is this link from a site the server allows? (No list = any site.) */
export function hostAllowed(url: string, hosts?: string[]): boolean {
  if (!hosts || hosts.length === 0) return true;
  const m = /^https?:\/\/([^/:?#]+)/i.exec(url);
  if (!m) return false;
  const host = m[1].toLowerCase();
  return hosts.some((h) => host === h.toLowerCase() || host.endsWith(`.${h.toLowerCase()}`));
}

/** What to tell the player about where a picture link may come from. */
export const hostsHint = (hosts?: string[]) =>
  hosts && hosts.length > 0 ? `Direct link to the picture, from: ${hosts.join(', ')}` : 'Direct link to the picture, starting with http:// or https://';

export const PAPERS: { id: PaperId; label: string; hint: string }[] = [
  { id: 'blank', label: 'Blank', hint: 'Plain cream paper' },
  { id: 'lined', label: 'Lined', hint: 'Ruled lines for notes and letters' },
  { id: 'grid', label: 'Grid', hint: 'Squared paper for plans and sketches' },
  { id: 'dotted', label: 'Dotted', hint: 'Dot grid for journals' },
  { id: 'old', label: 'Old', hint: 'Aged, yellowed parchment' },
  { id: 'black', label: 'Black', hint: 'Dark pages with light ink' },
];

export const PAGE_FONTS: { id: PageFont; label: string; hint: string }[] = [
  { id: 'serif', label: 'Print', hint: 'Clean serif type' },
  { id: 'hand', label: 'Handwriting', hint: 'Written by hand, in ink' },
  { id: 'old', label: 'Old print', hint: 'Antique book type' },
  { id: 'mono', label: 'Typewriter', hint: 'Typed on a typewriter' },
];

export const COVER_FONTS: { id: CoverFont; label: string; stack: string }[] = [
  { id: 'serif', label: 'Serif', stack: "'Lora', Georgia, 'Times New Roman', serif" },
  { id: 'display', label: 'Capitals', stack: "'Cinzel', 'Trajan Pro', Georgia, serif" },
  { id: 'old', label: 'Old print', stack: "'IM Fell English', 'Palatino Linotype', Georgia, serif" },
  { id: 'hand', label: 'Handwritten', stack: "'Caveat', 'Segoe Script', 'Comic Sans MS', cursive" },
  { id: 'sans', label: 'Sans', stack: "'Inter', system-ui, 'Segoe UI', sans-serif" },
  { id: 'mono', label: 'Typewriter', stack: "'JetBrains Mono', 'Courier New', monospace" },
];
export const fontStack = (id: CoverFont) => COVER_FONTS.find((f) => f.id === id)?.stack ?? COVER_FONTS[0].stack;

export const COVER_TEXTURES: { id: CoverTexture; label: string }[] = [
  { id: 'plain', label: 'Plain' },
  { id: 'cloth', label: 'Cloth' },
  { id: 'leather', label: 'Leather' },
  { id: 'linen', label: 'Linen' },
];

export const COVER_TEXT_COLORS = ['#f1e9d6', '#e7d9a8', '#d8c58a', '#ffffff', '#1a1a1a', '#c9a0a0'];

/** The automatic cover: title, description and author centred on the preset colour. */
export function defaultCover(cover: CoverId, title: string, description: string, author: string): CoverDesign {
  const els: CoverElement[] = [
    { id: uid(), type: 'text', text: title || 'Untitled', font: 'serif', size: 8, color: '#f1e9d6', bold: true, italic: false, x: 50, y: 40 },
  ];
  if (description) els.push({ id: uid(), type: 'text', text: description, font: 'serif', size: 3.6, color: '#f1e9d6', bold: false, italic: true, x: 50, y: 52 });
  els.push({ id: uid(), type: 'text', text: author, font: 'mono', size: 3.2, color: '#d8c58a', bold: false, italic: false, x: 50, y: 78 });
  return { bg: COVER_COLORS[cover].bg, frameColor: '#f1e9d6', texture: 'plain', frame: 'none', elements: els };
}

export const newCoverText = (): CoverElement => ({
  id: uid(), type: 'text', text: 'New text', font: 'serif', size: 7, color: '#f1e9d6', bold: false, italic: false, x: 50, y: 50,
});
export const newCoverImage = (src: string): CoverElement => ({ id: uid(), type: 'image', src, w: 40, x: 50, y: 50 });

export function coverWithIds(design: CoverDesign | null | undefined): CoverDesign | null {
  if (!design) return null;
  return { ...design, elements: (design.elements ?? []).map((e) => ({ ...e, id: e.id || uid() })) };
}

export function coverImageCount(design: CoverDesign | null): number {
  return design ? design.elements.filter((e) => e.type === 'image').length : 0;
}
