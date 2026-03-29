import { useEffect, useState } from "react";

interface UseSquareGridRowHeightOptions {
  columns?: number;
  gap?: number;
  rowPadding?: number;
  fallback?: number;
}

export function useSquareGridRowHeight(
  parentRef: { current: HTMLElement | null },
  {
    columns = 6,
    gap = 8,
    rowPadding = 8,
    fallback = 120,
  }: UseSquareGridRowHeightOptions = {}
) {
  const [rowHeight, setRowHeight] = useState(fallback);

  useEffect(() => {
    const element = parentRef.current;
    if (!element) return;

    const updateRowHeight = () => {
      const width = element.clientWidth;
      if (!width) {
        setRowHeight(fallback);
        return;
      }

      const totalGapWidth = gap * (columns - 1);
      const tileWidth = (width - rowPadding - totalGapWidth) / columns;

      if (tileWidth > 0) {
        setRowHeight(Math.ceil(tileWidth + rowPadding));
      }
    };

    updateRowHeight();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateRowHeight);
      return () => window.removeEventListener("resize", updateRowHeight);
    }

    const observer = new ResizeObserver(updateRowHeight);
    observer.observe(element);

    return () => observer.disconnect();
  }, [parentRef, columns, gap, rowPadding, fallback]);

  return rowHeight;
}