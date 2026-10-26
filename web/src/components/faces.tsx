import type { ReactNode } from 'react';
import type { CoverDesign, CoverId, PageFont, PaperId } from '../types';
import { COVER_COLORS, defaultCover } from '../utils/book';
import CoverRender from './CoverRender';

export type FaceKind = { kind: 'cover' } | { kind: 'inside' } | { kind: 'page'; page: number } | { kind: 'pad' } | { kind: 'back' };

/** Faces of a book: front cover, inside cover, one per page, an optional blank to even the count, back cover. */
export function faceCountFor(pages: number): number {
  return pages % 2 === 0 ? pages + 4 : pages + 3;
}

export function faceKind(index: number, pages: number): FaceKind {
  if (index === 0) return { kind: 'cover' };
  if (index === 1) return { kind: 'inside' };
  if (index - 2 < pages) return { kind: 'page', page: index - 2 };
  return index === faceCountFor(pages) - 1 ? { kind: 'back' } : { kind: 'pad' };
}

/** The spread that shows a given face. */
export const spreadForFace = (face: number) => (face % 2 === 0 ? face / 2 : (face + 1) / 2);

/** The design a book is shown with: its custom one, or the automatic one built from its details. */
export function resolveCover(design: CoverDesign | null | undefined, cover: CoverId, title: string, description: string, author: string): CoverDesign {
  return design ?? defaultCover(cover, title, description, author);
}

export function CoverFace({ design }: { design: CoverDesign }) {
  return (
    <div className="relative h-full w-full">
      <CoverRender design={design} />
      {/* hinge groove where the board bends at the spine */}
      <div className="pointer-events-none absolute inset-y-0 left-3 w-px bg-black/35" />
      <div className="pointer-events-none absolute inset-y-0 left-[13px] w-px bg-white/10" />
    </div>
  );
}

export function BackCoverFace({ design }: { design: CoverDesign }) {
  return (
    <div className="relative h-full w-full">
      <CoverRender design={{ ...design, elements: [], frame: design.frame }} />
    </div>
  );
}

/** Paper page. `side` is the side of the spread it sits on; the spine edge gets the gutter shading of a bound page. */
export function PaperFace({ children, number, side, paper = 'blank', font = 'serif' }: { children?: ReactNode; number?: number; side: 'left' | 'right'; paper?: PaperId; font?: PageFont }) {
  return (
    <div className={`paper paper-t-${paper} paper-f-${font} relative h-full w-full`} style={{ borderWidth: 0 }}>
      {children}
      <div
        className="pointer-events-none absolute inset-y-0 w-12"
        style={{
          [side === 'left' ? 'right' : 'left']: 0,
          background: `linear-gradient(${side === 'left' ? 'to left' : 'to right'}, rgba(0,0,0,0.28), rgba(0,0,0,0.08) 30%, rgba(0,0,0,0))`,
        }}
      />
      {number !== undefined && (
        <span className={`paper-muted pointer-events-none absolute bottom-3 font-mono text-[11px] ${side === 'left' ? 'left-6' : 'right-6'}`}>{number}</span>
      )}
    </div>
  );
}

/**
 * The inside cover: the book's dedication, who wrote it, and what belongs to this copy: its number in a limited
 * print run, an inscription to its owner, and the author's signature.
 */
export function InsideCover({ side, paper, font, authorName, dedication, copy, edition, signed, inscription }: {
  side: 'left' | 'right';
  paper: PaperId;
  font: PageFont;
  authorName: string;
  dedication?: string;
  copy?: number;
  edition?: number;
  signed?: boolean;
  inscription?: string;
}) {
  return (
    <PaperFace side={side} paper={paper} font={font}>
      <div className="paper-muted flex h-full flex-col items-center justify-center gap-5 p-10 text-center">
        {dedication && <p className="paper-ink max-w-[85%] text-lg italic leading-snug">{dedication}</p>}
        <div>
          <p className="text-xs uppercase tracking-widest">Written by</p>
          <p className="paper-ink font-serif text-lg">{authorName}</p>
        </div>
        {copy !== undefined && (
          <p className="font-mono text-[11px] uppercase tracking-widest">
            {edition ? `Copy ${copy} of ${edition}` : `Copy ${copy}`}
          </p>
        )}
        {inscription && <p className="paper-ink paper-signature max-w-[85%] text-2xl leading-tight">{inscription}</p>}
        {signed && <p className="paper-ink paper-signature text-3xl">{authorName}</p>}
      </div>
    </PaperFace>
  );
}

/** Faces with even index are fronts of sheets (right-hand pages); odd ones are backs (left-hand pages). */
export const sideOf = (face: number): 'left' | 'right' => (face % 2 === 0 ? 'right' : 'left');

export const presetColor = (cover: CoverId) => COVER_COLORS[cover]?.bg ?? COVER_COLORS.oxblood.bg;
