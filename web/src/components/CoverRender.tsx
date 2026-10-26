import type { CSSProperties } from 'react';
import type { CoverDesign, CoverTexture } from '../types';
import { fontStack } from '../utils/book';

const TEXTURE: Record<CoverTexture, CSSProperties> = {
  plain: {},
  cloth: {
    backgroundImage:
      'repeating-linear-gradient(0deg, rgba(0,0,0,0.12) 0, rgba(0,0,0,0.12) 1px, transparent 1px, transparent 3px), repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 3px)',
  },
  leather: {
    backgroundImage:
      'radial-gradient(rgba(0,0,0,0.22) 1px, transparent 1.6px), radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1.6px)',
    backgroundSize: '7px 7px, 7px 7px',
    backgroundPosition: '0 0, 3px 3px',
  },
  linen: {
    backgroundImage:
      'repeating-linear-gradient(45deg, rgba(255,255,255,0.06) 0, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 4px), repeating-linear-gradient(-45deg, rgba(0,0,0,0.1) 0, rgba(0,0,0,0.1) 1px, transparent 1px, transparent 4px)',
  },
};

interface Props {
  design: CoverDesign;
  /** Element currently selected in the designer, drawn with an outline. */
  selectedId?: string | null;
  /** When set, elements become draggable via this handler (the designer). */
  onElementPointerDown?: (id: string, e: React.PointerEvent) => void;
}

/**
 * Renders a cover. Sizes are in container-query width units (cqw), so the same design scales from the
 * thumbnail in a list to the full-size book cover.
 */
export default function CoverRender({ design, selectedId, onElementPointerDown }: Props) {
  const fc = design.frameColor;
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: design.bg, containerType: 'size' }}>
      <div className="absolute inset-0" style={TEXTURE[design.texture]} />

      {design.frame === 'line' && <div className="absolute" style={{ inset: '5cqw', border: `0.35cqw solid ${fc}`, opacity: 0.8 }} />}
      {design.frame === 'double' && (
        <>
          <div className="absolute" style={{ inset: '4cqw', border: `0.7cqw solid ${fc}`, opacity: 0.8 }} />
          <div className="absolute" style={{ inset: '6.5cqw', border: `0.25cqw solid ${fc}`, opacity: 0.8 }} />
        </>
      )}
      {design.frame === 'corners' &&
        (['tl', 'tr', 'bl', 'br'] as const).map((c) => (
          <div
            key={c}
            className="absolute"
            style={{
              width: '9cqw',
              height: '9cqw',
              top: c[0] === 't' ? '5cqw' : undefined,
              bottom: c[0] === 'b' ? '5cqw' : undefined,
              left: c[1] === 'l' ? '5cqw' : undefined,
              right: c[1] === 'r' ? '5cqw' : undefined,
              borderStyle: 'solid',
              borderColor: fc,
              borderWidth: `${c[0] === 't' ? '0.5cqw' : '0'} ${c[1] === 'r' ? '0.5cqw' : '0'} ${c[0] === 'b' ? '0.5cqw' : '0'} ${c[1] === 'l' ? '0.5cqw' : '0'}`,
              opacity: 0.85,
            }}
          />
        ))}

      {design.elements.map((el, i) => {
        const base: CSSProperties = {
          position: 'absolute',
          left: `${el.x}%`,
          top: `${el.y}%`,
          transform: 'translate(-50%, -50%)',
          outline: selectedId === el.id ? '1px dashed rgba(255,255,255,0.8)' : undefined,
          outlineOffset: 3,
          cursor: onElementPointerDown ? 'move' : undefined,
          touchAction: 'none',
          userSelect: 'none',
        };
        const down = onElementPointerDown ? (e: React.PointerEvent) => onElementPointerDown(el.id, e) : undefined;
        return el.type === 'text' ? (
          <div
            key={el.id || `e${i}`}
            onPointerDown={down}
            style={{
              ...base,
              width: 'max-content',
              maxWidth: '88%',
              textAlign: 'center',
              whiteSpace: 'pre-wrap',
              lineHeight: 1.15,
              fontSize: `${el.size}cqw`,
              fontFamily: fontStack(el.font),
              fontWeight: el.bold ? 700 : 400,
              fontStyle: el.italic ? 'italic' : 'normal',
              color: el.color,
            }}
          >
            {el.text}
          </div>
        ) : (
          <img key={el.id || `e${i}`} src={el.src} alt="" draggable={false} onPointerDown={down} style={{ ...base, width: `${el.w}%`, height: 'auto' }} />
        );
      })}
    </div>
  );
}
