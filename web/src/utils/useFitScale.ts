import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

// The admin panel sizes itself with `calc(100vw - 80px)` / `calc(100vh -
// 60px)` (capped at 1500x900) — but the Sidebar has a fixed 200px width and
// panel content isn't guaranteed to reflow below some minimum, so a small
// windowed-mode viewport can still end up narrower/shorter than what the
// panel actually needs, clipping or squishing content instead of shrinking.
// This measures the panel's natural (unscaled) footprint on every resize
// and scales + recenters it down just enough to fit both axes when it
// doesn't fit natively, leaving normal desktop sizes untouched.
export function useFitScale<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [style, setStyle] = useState<CSSProperties>({});

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const recalculate = () => {
      // Reset to measure the natural, unscaled/uncentered footprint.
      el.style.transform = 'none';
      el.style.transformOrigin = '';

      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const scale = Math.min(1, window.innerWidth / rect.width, window.innerHeight / rect.height);

      let nextStyle: CSSProperties = {};

      if (scale < 1) {
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        nextStyle = {
          transformOrigin: `${centerX - rect.left}px ${centerY - rect.top}px`,
          transform: `translate(${window.innerWidth / 2 - centerX}px, ${window.innerHeight / 2 - centerY}px) scale(${scale})`,
        };
      }

      // Apply directly rather than relying solely on the `style` state: if
      // the newly computed style equals the current one, React bails out of
      // re-rendering and the reset from above would otherwise stick instead
      // of being restored.
      el.style.transformOrigin = (nextStyle.transformOrigin as string) ?? '';
      el.style.transform = nextStyle.transform ?? '';

      setStyle(nextStyle);
    };

    recalculate();

    const observer = new ResizeObserver(recalculate);
    observer.observe(el);
    window.addEventListener('resize', recalculate);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', recalculate);
    };
  }, []);

  return { ref, style };
}
