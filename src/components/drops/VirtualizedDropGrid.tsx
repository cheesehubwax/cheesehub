import { useRef, useMemo, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { DropCard } from './DropCard';
import type { NFTDrop } from '@/types/drop';

interface VirtualizedDropGridProps {
  drops: NFTDrop[];
  isLoading?: boolean;
  progress?: { loaded: number; total: number };
}

const COLUMN_COUNTS = { sm: 1, md: 2, lg: 3, xl: 4 };
const ROW_HEIGHT = 480;
const GAP = 24;

export function VirtualizedDropGrid({ drops, isLoading, progress }: VirtualizedDropGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const loadedImagesRef = useRef<Set<string>>(new Set());
  
  const handleImageLoaded = useCallback((dropId: string) => {
    loadedImagesRef.current.add(dropId);
  }, []);

  const columnCount = useMemo(() => {
    if (typeof window === 'undefined') return 4;
    const width = window.innerWidth;
    if (width < 640) return COLUMN_COUNTS.sm;
    if (width < 1024) return COLUMN_COUNTS.md;
    if (width < 1280) return COLUMN_COUNTS.lg;
    return COLUMN_COUNTS.xl;
  }, []);

  const rows = useMemo(() => {
    const result: NFTDrop[][] = [];
    for (let i = 0; i < drops.length; i += columnCount) {
      result.push(drops.slice(i, i + columnCount));
    }
    return result;
  }, [drops, columnCount]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT + GAP,
    overscan: 2,
  });

  if (isLoading && progress && progress.total > 0) {
    return (
      <div className="py-12">
        <div className="max-w-md mx-auto space-y-4">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span>Loading drops... {progress.loaded} of {progress.total} templates</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${Math.round((progress.loaded / progress.total) * 100)}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (drops.length === 0) return null;

  return (
    <div
      ref={parentRef}
      className="w-full overflow-auto"
      style={{ height: '100%', maxHeight: 'calc(100vh - 400px)', minHeight: '600px' }}
    >
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const rowDrops = rows[virtualRow.index];
          return (
            <div
              key={virtualRow.key}
              className="absolute left-0 right-0 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              style={{ top: virtualRow.start, height: virtualRow.size }}
            >
              {rowDrops.map((drop) => (
                <DropCard 
                  key={drop.id} 
                  drop={drop}
                  isImageCached={loadedImagesRef.current.has(drop.id)}
                  onImageLoaded={handleImageLoaded}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SimpleDropGrid({ drops }: { drops: NFTDrop[] }) {
  const loadedImagesRef = useRef<Set<string>>(new Set());
  
  const handleImageLoaded = useCallback((dropId: string) => {
    loadedImagesRef.current.add(dropId);
  }, []);

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {drops.map((drop) => (
        <DropCard 
          key={drop.id} 
          drop={drop}
          isImageCached={loadedImagesRef.current.has(drop.id)}
          onImageLoaded={handleImageLoaded}
        />
      ))}
    </div>
  );
}
