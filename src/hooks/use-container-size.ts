import { useEffect, useState, type RefObject } from "react";

export interface ContainerSize {
  width: number;
  height: number;
}

const DEFAULT_FALLBACK: ContainerSize = { width: 640, height: 220 };

/**
 * Tracks a container element's pixel dimensions using ResizeObserver.
 * Suppresses < 2px deltas to prevent subpixel jitter loops.
 */
export function useContainerSize<T extends HTMLElement>(
  ref: RefObject<T | null>,
  fallback: ContainerSize = DEFAULT_FALLBACK
): ContainerSize {
  const [size, setSize] = useState<ContainerSize>(fallback);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);
      if (width <= 0 || height <= 0) return;

      setSize(prev => {
        if (Math.abs(width - prev.width) < 2 && Math.abs(height - prev.height) < 2) {
          return prev;
        }
        return { width, height };
      });
    };

    measure();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }

    const observer = new ResizeObserver(() => measure());
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}
