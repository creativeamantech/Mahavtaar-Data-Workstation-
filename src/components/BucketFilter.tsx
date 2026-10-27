import { useData } from '../contexts/DataContext';
import { useMemo, useState, useRef, useEffect } from 'react';
import { Filter, ChevronRight, ChevronLeft, ChevronDown, ChevronUp, Check, Layers } from 'lucide-react';

interface BucketFilterProps {
  className?: string;
  showCounts?: boolean;
  compact?: boolean;
}

export function BucketFilter({ className = '', showCounts = true, compact = false }: BucketFilterProps) {
  const { records, filteredRecords, globalBucket, setGlobalBucket } = useData();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const { availableBuckets, bucketCounts, totalCount } = useMemo(() => {
    const counts: Record<string, number> = {};
    let total = 0;
    (records || []).forEach((r: any) => {
      total++;
      if (r.bom_bkt !== undefined && r.bom_bkt !== null && String(r.bom_bkt).trim() !== '') {
        const b = String(r.bom_bkt).trim().toUpperCase();
        counts[b] = (counts[b] || 0) + 1;
      }
    });
    const bkts = Object.keys(counts).sort((a, b) => {
      const numA = Number(a);
      const numB = Number(b);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });
    return { availableBuckets: bkts, bucketCounts: counts, totalCount: total };
  }, [records]);

  const checkScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 4);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [availableBuckets]);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const offset = direction === 'left' ? -180 : 180;
    scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
  };

  if (availableBuckets.length === 0) return null;

  return (
    <div className={`w-full flex items-center justify-between gap-3 ${className}`}>
      {/* Scrollable Chip Filter Track */}
      <div className="relative flex-1 min-w-0 flex items-center">
        {/* Left Scroll Button if overflowed */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scroll('left')}
            className="absolute left-0 z-10 hidden sm:flex items-center justify-center h-8 w-6 bg-gradient-to-r from-background via-background/90 to-transparent text-muted-foreground hover:text-foreground"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}

        {/* Chips Container */}
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1 px-0.5 w-full scroll-smooth"
        >
          {/* Label Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-muted-foreground shrink-0 select-none">
            <Layers className="w-3.5 h-3.5 text-primary" />
            <span className="hidden sm:inline">Bucket:</span>
          </div>

          {/* ALL Option */}
          <button
            type="button"
            onClick={() => setGlobalBucket('ALL')}
            className={`group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all duration-150 active:scale-95 ${
              globalBucket === 'ALL'
                ? 'bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/30 font-bold'
                : 'bg-card text-foreground/80 hover:text-foreground hover:bg-muted/80 border border-border/80 hover:border-border'
            }`}
          >
            <span>All Buckets</span>
            {showCounts && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-md font-tabular ${
                  globalBucket === 'ALL'
                    ? 'bg-primary-foreground/20 text-primary-foreground font-bold'
                    : 'bg-muted text-muted-foreground group-hover:text-foreground'
                }`}
              >
                {totalCount.toLocaleString()}
              </span>
            )}
          </button>

          {/* Individual Buckets */}
          {availableBuckets.map(b => {
            const isSelected = globalBucket === b;
            const count = bucketCounts[b] || 0;
            return (
              <button
                type="button"
                key={b}
                onClick={() => setGlobalBucket(b)}
                className={`group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all duration-150 active:scale-95 ${
                  isSelected
                    ? 'bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/30 font-bold'
                    : 'bg-card text-foreground/80 hover:text-foreground hover:bg-muted/80 border border-border/80 hover:border-border'
                }`}
              >
                <span>Bkt {b}</span>
                {showCounts && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-md font-tabular ${
                      isSelected
                        ? 'bg-primary-foreground/20 text-primary-foreground font-bold'
                        : 'bg-muted text-muted-foreground group-hover:text-foreground'
                    }`}
                  >
                    {count.toLocaleString()}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right Scroll Button if overflowed */}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scroll('right')}
            className="absolute right-0 z-10 hidden sm:flex items-center justify-center h-8 w-6 bg-gradient-to-l from-background via-background/90 to-transparent text-muted-foreground hover:text-foreground"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Case Count Summary on wider screens */}
      {!compact && filteredRecords && (
        <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground font-medium shrink-0 pl-2">
          <span>Active:</span>
          <span className="text-foreground font-semibold font-tabular">
            {filteredRecords.length.toLocaleString()}
          </span>
          <span className="text-muted-foreground/60">/ {totalCount.toLocaleString()} cases</span>
        </div>
      )}
    </div>
  );
}

/**
 * Floating Bucket Filter Widget that stays persistently accessible anywhere on the page as you scroll.
 */
export function FloatingBucketFilter({ className = '' }: { className?: string }) {
  const { records, globalBucket, setGlobalBucket } = useData();
  const [isExpanded, setIsExpanded] = useState(false);

  const { availableBuckets, bucketCounts, totalCount } = useMemo(() => {
    const counts: Record<string, number> = {};
    let total = 0;
    (records || []).forEach((r: any) => {
      total++;
      if (r.bom_bkt !== undefined && r.bom_bkt !== null && String(r.bom_bkt).trim() !== '') {
        const b = String(r.bom_bkt).trim().toUpperCase();
        counts[b] = (counts[b] || 0) + 1;
      }
    });
    const bkts = Object.keys(counts).sort((a, b) => {
      const numA = Number(a);
      const numB = Number(b);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });
    return { availableBuckets: bkts, bucketCounts: counts, totalCount: total };
  }, [records]);

  if (availableBuckets.length === 0) return null;

  const currentCount = globalBucket === 'ALL' ? totalCount : (bucketCounts[globalBucket] || 0);

  return (
    <aside
      aria-label="Bucket Filter Navigation"
      className={`fixed bottom-[74px] md:bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-[96vw] transition-all duration-300 ${className}`}
      style={{ pointerEvents: 'auto' }}
    >
      <div className="flex items-center gap-1.5 p-1 rounded-full bg-card/95 dark:bg-slate-900/95 backdrop-blur-xl border border-border shadow-[0_8px_30px_rgb(0,0,0,0.18)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.6)] ring-1 ring-black/5 dark:ring-white/10">
        {/* Active Bucket Pill Header / Quick Indicator */}
        <button
          type="button"
          onClick={() => setIsExpanded(prev => !prev)}
          className="flex items-center gap-2 pl-3 pr-2.5 py-1.5 text-xs font-bold text-foreground hover:text-primary transition-colors rounded-full select-none active:scale-95"
          title="Toggle bucket selection options"
        >
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-muted-foreground uppercase text-[10px] tracking-wider hidden sm:inline">Filter:</span>
          <span className="text-primary font-bold whitespace-nowrap">
            {globalBucket === 'ALL' ? 'All Buckets' : `Bucket ${globalBucket}`}
          </span>
          <span className="text-[10px] font-tabular bg-muted dark:bg-muted/80 text-muted-foreground px-1.5 py-0.5 rounded-full font-medium">
            {currentCount.toLocaleString()}
          </span>
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </button>

        {/* Expanded Carousel / Quick Selector */}
        {isExpanded && (
          <>
            <div className="h-4 w-px bg-border/80 mx-0.5" />
            <div className="flex items-center gap-1 overflow-x-auto max-w-[62vw] sm:max-w-[70vw] md:max-w-none scrollbar-none py-0.5 px-1">
              <button
                type="button"
                onClick={() => {
                  setGlobalBucket('ALL');
                  setIsExpanded(false);
                }}
                className={`px-2.5 py-1 text-xs font-bold rounded-full transition-all duration-150 whitespace-nowrap flex items-center gap-1 shrink-0 ${
                  globalBucket === 'ALL'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
                }`}
              >
                {globalBucket === 'ALL' && <Check className="w-3 h-3 stroke-[3]" />}
                <span>All ({totalCount.toLocaleString()})</span>
              </button>

              {availableBuckets.map(b => {
                const isSelected = globalBucket === b;
                const count = bucketCounts[b] || 0;
                return (
                  <button
                    type="button"
                    key={b}
                    onClick={() => {
                      setGlobalBucket(b);
                      setIsExpanded(false);
                    }}
                    className={`px-2.5 py-1 text-xs font-bold rounded-full transition-all duration-150 whitespace-nowrap flex items-center gap-1 shrink-0 ${
                      isSelected
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    <span>Bkt {b}</span>
                    <span className="text-[10px] opacity-80 font-tabular font-normal">({count.toLocaleString()})</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
