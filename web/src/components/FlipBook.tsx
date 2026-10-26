import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';

interface Props {
  /** Number of faces (individual pages incl. covers). Must be even: a sheet has a front and a back. */
  faceCount: number;
  /** Open spread: 0 = closed (front cover), faceCount/2 = closed on the back cover. */
  spread: number;
  onSpreadChange: (spread: number) => void;
  renderFace: (index: number) => ReactNode;
  pageW: number;
  pageH: number;
  /** 'edge' = only a strip at the outer edge of each page grabs (editing); 'full' = the whole page (reading). */
  grab: 'edge' | 'full';
  /** Hardcover board colour, shown around the pages and as the closed book's thickness. */
  boardColor: string;
}

type Side = 'left' | 'right';
interface Vec { x: number; y: number }

/**
 * A page being turned. Geometry lives in a "local" frame: the spine is x = 0 and the turning page
 * spans x = 0..W, whichever side it is on (a left page is mirrored into this frame). The grabbed
 * corner starts at (W, cy) and `p` is where it has been pulled to.
 */
interface Turn {
  side: Side;
  cy: number;
  p: Vec;
}

const EDGE = 32;
const HOVER_ZONE = 110;
const PEEL = 34;
const BOARD = 9;

const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k });
const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y;
const len = (a: Vec) => Math.hypot(a.x, a.y);
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Keep the part of a convex polygon where g(v) >= 0 (Sutherland-Hodgman against one line). */
function clip(poly: Vec[], g: (v: Vec) => number): Vec[] {
  const out: Vec[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const ga = g(a);
    const gb = g(b);
    if (ga >= 0) out.push(a);
    if (ga >= 0 !== gb >= 0) {
      const t = ga / (ga - gb);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

const polygon = (pts: Vec[]) => `polygon(${pts.map((v) => `${v.x.toFixed(2)}px ${v.y.toFixed(2)}px`).join(', ')})`;

/**
 * A book whose pages turn like paper. Pulling a corner folds the page along the perpendicular
 * bisector of (corner, pointer): the part past the fold is reflected across it, showing the back of
 * the sheet, while the page underneath shows through where the sheet has lifted. Shading along the
 * fold and a cast shadow on the page below sell the curl. The book starts closed and centred, and
 * slides to centre the open spread as the cover turns.
 */
export default function FlipBook({ faceCount, spread, onSpreadChange, renderFace, pageW: W, pageH: H, grab, boardColor }: Props) {
  const sheets = faceCount / 2;
  const outerRef = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(spread);
  const [turn, setTurn] = useState<Turn | null>(null);
  const shownRef = useRef(shown);
  const turnRef = useRef<Turn | null>(null);
  const offsetRef = useRef(0);
  const animating = useRef(false);
  const dragging = useRef(false);
  const hovering = useRef(false);
  const rafRef = useRef<number | null>(null);

  shownRef.current = shown;
  turnRef.current = turn;

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  /** Keep the corner where paper can actually reach without tearing off the spine. */
  const clampCorner = (p: Vec, cy: number): Vec => {
    const anchor = { x: 0, y: cy };
    const far = { x: 0, y: H - cy };
    let q = p;
    const d1 = sub(q, anchor);
    if (len(d1) > W) q = add(anchor, mul(d1, W / len(d1)));
    const diag = Math.hypot(W, H);
    const d2 = sub(q, far);
    if (len(d2) > diag) q = add(far, mul(d2, diag / len(d2)));
    return q;
  };

  const commit = (next: number) => {
    animating.current = false;
    setShown(next);
    setTurn(null);
    if (next !== spread) onSpreadChange(next);
  };

  /** Tween the corner along a path, then optionally land on a new spread. */
  const run = (side: Side, cy: number, path: (t: number) => Vec, ms: number, done: () => void) => {
    animating.current = true;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      setTurn({ side, cy, p: clampCorner(path(ease(t)), cy) });
      if (t < 1) rafRef.current = requestAnimationFrame(step);
      else done();
    };
    rafRef.current = requestAnimationFrame(step);
  };

  /** Full page turn from rest, lifting the corner in an arc as a hand would. */
  const autoTurn = (side: Side, from?: Vec, cyHint?: number) => {
    const s = shownRef.current;
    const cy = cyHint ?? H;
    const start = from ?? { x: W, y: cy };
    const lift = cy === H ? -1 : 1;
    run(
      side,
      cy,
      (t) => ({ x: start.x + (-W - start.x) * t, y: start.y + (cy - start.y) * t + lift * Math.sin(Math.PI * t) * H * 0.14 }),
      620,
      () => commit(side === 'right' ? s + 1 : s - 1),
    );
  };

  // Parent-driven navigation (arrow keys, page list): turn one page with animation, jump further ones.
  useEffect(() => {
    if (spread === shownRef.current || animating.current || dragging.current) return;
    const diff = spread - shownRef.current;
    if (Math.abs(diff) === 1) autoTurn(diff > 0 ? 'right' : 'left');
    else {
      setTurn(null);
      setShown(spread);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spread]);

  const canTurn = (side: Side) => (side === 'right' ? shownRef.current < sheets : shownRef.current > 0);

  /** Pointer position in a side's local frame (accounts for the fit-to-screen scale and the book slide). */
  const toLocal = (clientX: number, clientY: number, side: Side): Vec => {
    const r = outerRef.current!.getBoundingClientRect();
    const scale = r.width / (2 * W);
    const x = (clientX - r.left) / scale - offsetRef.current - W;
    return { x: side === 'right' ? x : -x, y: (clientY - r.top) / scale };
  };

  const begin = (e: ReactPointerEvent, side: Side) => {
    if (animating.current || !canTurn(side)) return;
    e.preventDefault();
    const s = shownRef.current;
    const start = toLocal(e.clientX, e.clientY, side);
    const cy = start.y < H / 2 ? 0 : H;
    const current = turnRef.current;
    const origin = current && current.side === side && current.cy === cy ? current.p : { x: W, y: cy };
    dragging.current = true;
    hovering.current = false;
    let moved = false;
    let last = start;
    let vx = 0;

    const onMove = (ev: PointerEvent) => {
      const now = toLocal(ev.clientX, ev.clientY, side);
      vx = now.x - last.x || vx * 0.6;
      last = now;
      if (!moved && len(sub(now, start)) > 4) moved = true;
      if (!moved) return;
      setTurn({ side, cy, p: clampCorner(add(origin, sub(now, start)), cy) });
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      dragging.current = false;

      const from = turnRef.current?.p ?? origin;
      if (!moved) return autoTurn(side, from, cy);

      const complete = vx < -4 ? true : vx > 4 ? false : from.x < 0;
      const target = complete ? { x: -W, y: cy } : { x: W, y: cy };
      const ms = 180 + (len(sub(target, from)) / (2 * W)) * 380;
      run(side, cy, (t) => add(from, mul(sub(target, from), t)), ms, () => commit(complete ? (side === 'right' ? s + 1 : s - 1) : s));
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  /** Lift the nearest corner a little while the cursor rests near it, inviting a drag. */
  const hover = (e: ReactPointerEvent, side: Side) => {
    if (e.buttons || dragging.current || animating.current || !canTurn(side)) return;
    const local = toLocal(e.clientX, e.clientY, side);
    const cy = local.y < HOVER_ZONE ? 0 : local.y > H - HOVER_ZONE ? H : null;
    if (cy === null) return unhover();
    hovering.current = true;
    setTurn({ side, cy, p: clampCorner({ x: W - PEEL, y: cy === 0 ? PEEL * 0.8 : H - PEEL * 0.8 }, cy) });
  };

  const unhover = () => {
    if (!hovering.current || dragging.current || animating.current) return;
    hovering.current = false;
    setTurn(null);
  };

  // ── Geometry for this frame ─────────────────────────────────────────────────

  const s = shown;
  const sigma = turn?.side === 'left' ? -1 : 1;
  const toBook = (v: Vec): Vec => ({ x: W + sigma * v.x, y: v.y });

  let fold: null | { keep: Vec[]; folded: Vec[]; reflect: (v: Vec) => Vec; mid: Vec; n: Vec } = null;
  if (turn) {
    const c0 = { x: W, y: turn.cy };
    const axis = sub(c0, turn.p);
    if (len(axis) > 0.5) {
      const n = mul(axis, 1 / len(axis));
      const mid = mul(add(c0, turn.p), 0.5);
      const page = [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }];
      const side = (v: Vec) => dot(sub(v, mid), n);
      fold = {
        keep: clip(page, (v) => -side(v)),
        folded: clip(page, side),
        reflect: (v) => sub(v, mul(n, 2 * side(v))),
        mid,
        n,
      };
    }
  }

  // Progress of the active turn (0 = at rest, 1 = landed on the other side), for the book's slide.
  const progress = turn ? Math.max(0, Math.min(1, (W - turn.p.x) / (2 * W))) : 0;
  const visual = turn ? s + (turn.side === 'right' ? progress : -progress) : s;
  const offset = visual < 1 ? (-W / 2) * (1 - visual) : visual > sheets - 1 ? (W / 2) * (visual - (sheets - 1)) : 0;
  offsetRef.current = offset;

  // Which face sits where this frame.
  type Slot = { face: number; style: CSSProperties };
  const slots: Slot[] = [];
  const at = (side: Side): CSSProperties => ({ position: 'absolute', top: 0, left: side === 'right' ? W : 0, width: W, height: H });
  const valid = (f: number) => f >= 0 && f < faceCount;

  let turning = -1;
  let flap = -1;
  if (turn && fold) {
    const right = turn.side === 'right';
    turning = right ? 2 * s : 2 * s - 1;
    flap = right ? 2 * s + 1 : 2 * s - 2;
    const under = right ? 2 * s + 2 : 2 * s - 3;
    const opposite = right ? 2 * s - 1 : 2 * s;
    if (valid(opposite) && (right ? s >= 1 : s < sheets)) slots.push({ face: opposite, style: { ...at(right ? 'left' : 'right'), zIndex: 1 } });
    if (valid(under)) slots.push({ face: under, style: { ...at(turn.side), zIndex: 1 } });

    // The turning page, minus the part that has folded over.
    const toElem = (v: Vec): Vec => (right ? v : { x: W - v.x, y: v.y });
    if (fold.keep.length >= 3) {
      slots.push({ face: turning, style: { ...at(turn.side), zIndex: 2, clipPath: polygon(fold.keep.map(toElem)) } });
    }

    // The back of the sheet: content point (a, b) lies on sheet point u, then gets reflected over the fold.
    const sheetOf = (a: number) => (right ? W - a : a);
    const place = (a: number, b: number) => toBook(fold!.reflect({ x: sheetOf(a), y: b }));
    const o = place(0, 0);
    const ex = sub(place(1, 0), o);
    const ey = sub(place(0, 1), o);
    if (fold.folded.length >= 3) {
      slots.push({
        face: flap,
        style: {
          position: 'absolute',
          top: 0,
          left: 0,
          width: W,
          height: H,
          zIndex: 4,
          transformOrigin: '0 0',
          transform: `matrix(${ex.x}, ${ex.y}, ${ey.x}, ${ey.y}, ${o.x}, ${o.y})`,
          clipPath: polygon(fold.folded.map((v) => ({ x: sheetOf(v.x), y: v.y }))),
        },
      });
    }
  } else {
    if (s >= 1 && valid(2 * s - 1)) slots.push({ face: 2 * s - 1, style: { ...at('left'), zIndex: 1 } });
    if (s < sheets && valid(2 * s)) slots.push({ face: 2 * s, style: { ...at('right'), zIndex: 1 } });
  }

  // Shading strips along the fold: a cast shadow on the page beneath, and the curl on the flap itself.
  const strips: ReactNode[] = [];
  if (turn && fold && fold.folded.length >= 3) {
    const midB = toBook(fold.mid);
    const nB = { x: sigma * fold.n.x, y: fold.n.y };
    const angle = Math.atan2(nB.x, -nB.y);
    const L = 2 * (W + H);
    const lift = Math.min(1, len(sub({ x: W, y: turn.cy }, turn.p)) / (W * 0.6));
    const strip = (towardFold: boolean, h: number, alpha: number) => ({
      position: 'absolute' as const,
      left: midB.x,
      top: midB.y,
      width: L,
      height: h,
      transformOrigin: '0 0',
      transform: `rotate(${angle}rad) translate(${-L / 2}px, ${towardFold ? -h : 0}px)`,
      background: `linear-gradient(${towardFold ? 'to top' : 'to bottom'}, rgba(0,0,0,${alpha}), rgba(0,0,0,0))`,
    });
    strips.push(
      <div key="cast" className="pointer-events-none absolute inset-0" style={{ zIndex: 3, clipPath: polygon(fold.folded.map(toBook)) }}>
        <div style={strip(true, 26 + 40 * lift, 0.18 + 0.22 * lift)} />
      </div>,
      <div key="curl" className="pointer-events-none absolute inset-0" style={{ zIndex: 5, clipPath: polygon(fold.folded.map((v) => toBook(fold!.reflect(v)))) }}>
        <div style={strip(false, 18 + 50 * lift, 0.12 + 0.18 * lift)} />
        <div className="absolute inset-0 bg-black" style={{ opacity: 0.04 }} />
      </div>,
    );
  }

  // Hardcover boards and page-stack edges reflect how much of the book lies on each side.
  const leftOpen = visual > 0.5;
  const rightOpen = visual < sheets - 0.5;
  const leftLayers = Math.min(3, Math.max(0, s - 1));
  const rightLayers = Math.min(3, Math.max(0, sheets - s - 1));
  const board: CSSProperties = { position: 'absolute', top: -BOARD, height: H + 2 * BOARD, width: W + BOARD, background: boardColor, border: '1px solid rgba(0,0,0,0.55)' };

  const stripW = grab === 'full' ? W : EDGE;

  return (
    <div ref={outerRef} className="relative select-none" style={{ width: 2 * W, height: H }}>
      <div
        className="absolute inset-0"
        style={{ transform: `translateX(${offset}px)`, transition: turn ? 'none' : 'transform 380ms cubic-bezier(0.4, 0, 0.2, 1)' }}
      >
        {leftOpen && <div style={{ ...board, left: -BOARD, borderRadius: '3px 0 0 3px' }} />}
        {rightOpen && <div style={{ ...board, left: W, borderRadius: '0 3px 3px 0' }} />}

        {Array.from({ length: leftLayers }, (_, j) => (
          <div key={`ls${j}`} className="absolute" style={{ left: -(j + 1) * 1.5, top: (j + 1) * 1.5, width: W, height: H, background: j % 2 ? '#d8cfb7' : '#e6dfca', border: '1px solid rgba(0,0,0,0.18)' }} />
        ))}
        {Array.from({ length: rightLayers }, (_, j) => (
          <div key={`rs${j}`} className="absolute" style={{ left: W + (j + 1) * 1.5, top: (j + 1) * 1.5, width: W, height: H, background: j % 2 ? '#d8cfb7' : '#e6dfca', border: '1px solid rgba(0,0,0,0.18)' }} />
        ))}

        {slots.map(({ face, style }) => (
          <div key={face} className="overflow-hidden" style={{ ...style, pointerEvents: face === turning || face === flap ? 'none' : 'auto' }}>
            {renderFace(face)}
          </div>
        ))}

        {strips}

        {/* centre crease */}
        {leftOpen && rightOpen && <div className="pointer-events-none absolute top-0 h-full w-px bg-black/45" style={{ left: W, zIndex: 3 }} />}

        {s > 0 && (
          <div
            onPointerDown={(e) => begin(e, 'left')}
            onPointerMove={(e) => hover(e, 'left')}
            onPointerLeave={unhover}
            className="absolute top-0 h-full cursor-grab active:cursor-grabbing"
            style={{ left: 0, width: stripW, zIndex: 10, touchAction: 'none' }}
            title="Drag to turn the page"
          />
        )}
        {s < sheets && (
          <div
            onPointerDown={(e) => begin(e, 'right')}
            onPointerMove={(e) => hover(e, 'right')}
            onPointerLeave={unhover}
            className="absolute top-0 h-full cursor-grab active:cursor-grabbing"
            style={{ left: 2 * W - stripW, width: stripW, zIndex: 10, touchAction: 'none' }}
            title="Drag to turn the page"
          />
        )}
      </div>
    </div>
  );
}
