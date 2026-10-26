import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Fills an SD Computers app window with the book UI: the fixed-size canvas the screens are designed on is scaled
 * (up or down) to fit the window and centred, so resizing the window just resizes the book.
 */
export default function ComputerFrame({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: width, h: height });

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const measure = () => setBox({ w: host.clientWidth || width, h: host.clientHeight || height });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, [width, height]);

  const scale = Math.min(box.w / width, box.h / height);

  return (
    <div ref={hostRef} className="fixed inset-0 overflow-hidden bg-dark-900">
      <div
        className="absolute overflow-hidden bg-dark-900"
        style={{
          width,
          height,
          left: (box.w - width * scale) / 2,
          top: (box.h - height * scale) / 2,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {children}
      </div>
    </div>
  );
}
