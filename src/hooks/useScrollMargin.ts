import { useState, useEffect, useCallback, type RefObject } from 'react';

/**
 * Accurately calculates the vertical offset (scrollMargin) of a virtual container
 * relative to its scrolling parent container (.main-content).
 * Continuously tracks updates via ResizeObserver and window resize events.
 */
export function useScrollMargin(containerRef: RefObject<HTMLElement | null>, deps: unknown[] = []): number {
  const [scrollMargin, setScrollMargin] = useState<number>(0);

  const measure = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const scrollEl = el.closest<HTMLElement>('.main-content') || document.querySelector<HTMLElement>('.main-content');
    if (!scrollEl) return;

    const elRect = el.getBoundingClientRect();
    const scrollRect = scrollEl.getBoundingClientRect();
    const computedMargin = Math.max(0, elRect.top - scrollRect.top + scrollEl.scrollTop);

    setScrollMargin((prev) => {
      if (Math.abs(prev - computedMargin) > 0.5) {
        return Math.round(computedMargin);
      }
      return prev;
    });
  }, [containerRef]);

  useEffect(() => {
    measure();

    const el = containerRef.current;
    if (!el) return;

    const scrollEl = el.closest<HTMLElement>('.main-content') || document.querySelector<HTMLElement>('.main-content');
    if (!scrollEl) return;

    const ro = new ResizeObserver(() => {
      measure();
    });

    ro.observe(scrollEl);
    if (el.parentElement) {
      ro.observe(el.parentElement);
    }

    const handleResize = () => measure();
    window.addEventListener('resize', handleResize, { passive: true });

    // Double check after immediate layout pass in case fonts/styles loaded
    const rafId = requestAnimationFrame(measure);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, measure, ...deps]);

  return scrollMargin;
}
