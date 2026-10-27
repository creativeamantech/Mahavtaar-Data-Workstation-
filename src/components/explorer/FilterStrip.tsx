import React, { useState } from 'react';
import { Search, X, Plus, DollarSign, Filter, ChevronDown, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Checkbox } from '../ui/checkbox';
import { ScrollArea } from '../ui/scroll-area';

interface FilterStripProps {
  availableStates: string[];
  selectedState: string;
  onStateChange: (state: string) => void;

  availableCities: string[];
  selectedCity: string;
  onCityChange: (city: string) => void;

  availableBuckets: string[];
  selectedBucket: string;
  onBucketChange: (bucket: string) => void;

  availableExecutives: string[];
  selectedExecutive: string;
  onExecutiveChange: (exec: string) => void;

  selectedAllocation: string;
  onAllocationChange: (alloc: string) => void;

  selectedPaidStatus: string;
  onPaidStatusChange: (status: string) => void;

  minPos: string;
  maxPos: string;
  onPosRangeChange: (min: string, max: string) => void;

  schema: string[];
  standardKeys: string[];
  activeCustomFilters: string[];
  customFilterValues: Record<string, string>;
  onAddCustomFilter: (col: string) => void;
  onRemoveCustomFilter: (col: string) => void;
  onCustomFilterValueChange: (col: string, val: string) => void;
  baseRecords: any[];

  onClearSecondary: () => void;
  activeFilterCount: number;
}

const formatBucketLabel = (b: string) => {
  if (b === 'All') return 'All Buckets';
  const str = String(b).trim();
  if (str.toUpperCase().startsWith('BKT') || str.toUpperCase().startsWith('BUCKET')) {
    return str;
  }
  if (!isNaN(Number(str))) {
    return `BKT ${str}`;
  }
  return str;
};

export function FilterStrip({
  availableStates,
  selectedState,
  onStateChange,
  availableCities,
  selectedCity,
  onCityChange,
  availableBuckets,
  selectedBucket,
  onBucketChange,
  availableExecutives,
  selectedExecutive,
  onExecutiveChange,
  selectedAllocation,
  onAllocationChange,
  selectedPaidStatus,
  onPaidStatusChange,
  minPos,
  maxPos,
  onPosRangeChange,
  schema,
  standardKeys,
  activeCustomFilters,
  customFilterValues,
  onAddCustomFilter,
  onRemoveCustomFilter,
  onCustomFilterValueChange,
  baseRecords,
  onClearSecondary,
  activeFilterCount
}: FilterStripProps) {
  const [posPopoverOpen, setPosPopoverOpen] = useState(false);
  const [tempMinPos, setTempMinPos] = useState(minPos);
  const [tempMaxPos, setTempMaxPos] = useState(maxPos);
  const [posError, setPosError] = useState<string | null>(null);

  const [customFilterSearch, setCustomFilterSearch] = useState('');
  const [columnFilterSearches, setColumnFilterSearches] = useState<Record<string, string>>({});

  const handleApplyPosRange = () => {
    const minVal = tempMinPos ? Number(tempMinPos) : null;
    const maxVal = tempMaxPos ? Number(tempMaxPos) : null;
    if (minVal !== null && maxVal !== null && minVal > maxVal) {
      setPosError('Min POS must be ≤ Max POS');
      return;
    }
    setPosError(null);
    onPosRangeChange(tempMinPos, tempMaxPos);
    setPosPopoverOpen(false);
  };

  const handleQuickPos = (min: string, max: string) => {
    setTempMinPos(min);
    setTempMaxPos(max);
    setPosError(null);
    onPosRangeChange(min, max);
    setPosPopoverOpen(false);
  };

  const isPosActive = Boolean(minPos || maxPos);
  const posLabel = isPosActive
    ? `POS: ${minPos ? `₹${(Number(minPos)/1000).toFixed(0)}k` : '0'} - ${maxPos ? `₹${(Number(maxPos)/1000).toFixed(0)}k` : '∞'}`
    : 'POS Range';

  return (
    <div className="bg-card border border-border rounded-xl p-3 mb-3 shadow-xs">
      <div className="flex flex-wrap items-center gap-2">
        {/* Bucket Filter */}
        <div className="relative">
          <select
            value={selectedBucket}
            onChange={(e) => onBucketChange(e.target.value)}
            className={`h-8 rounded-lg border px-2.5 pr-7 text-xs font-semibold outline-none cursor-pointer transition-colors appearance-none ${
              selectedBucket !== 'All'
                ? 'bg-primary/10 border-primary text-primary'
                : 'bg-muted/40 border-border text-foreground hover:bg-muted/70'
            }`}
          >
            <option value="All">All Buckets</option>
            {availableBuckets.filter(b => b !== 'All').map(b => (
              <option key={b} value={b}>{formatBucketLabel(b)}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none opacity-60" />
        </div>

        {/* State Filter */}
        <div className="relative">
          <select
            value={selectedState}
            onChange={(e) => onStateChange(e.target.value)}
            className={`h-8 rounded-lg border px-2.5 pr-7 text-xs font-semibold outline-none cursor-pointer transition-colors appearance-none ${
              selectedState !== 'All'
                ? 'bg-primary/10 border-primary text-primary'
                : 'bg-muted/40 border-border text-foreground hover:bg-muted/70'
            }`}
          >
            {availableStates.map(s => (
              <option key={s} value={s}>{s === 'All' ? 'All States' : s}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none opacity-60" />
        </div>

        {/* City Filter */}
        <div className="relative">
          <select
            value={selectedCity}
            onChange={(e) => onCityChange(e.target.value)}
            className={`h-8 rounded-lg border px-2.5 pr-7 text-xs font-semibold outline-none cursor-pointer transition-colors appearance-none ${
              selectedCity !== 'All'
                ? 'bg-primary/10 border-primary text-primary'
                : 'bg-muted/40 border-border text-foreground hover:bg-muted/70'
            }`}
          >
            {availableCities.map(c => (
              <option key={c} value={c}>{c === 'All' ? 'All Cities' : c}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none opacity-60" />
        </div>

        {/* Executive Filter */}
        <div className="relative">
          <select
            value={selectedExecutive}
            onChange={(e) => onExecutiveChange(e.target.value)}
            className={`h-8 rounded-lg border px-2.5 pr-7 text-xs font-semibold outline-none cursor-pointer transition-colors appearance-none ${
              selectedExecutive !== 'All'
                ? 'bg-primary/10 border-primary text-primary'
                : 'bg-muted/40 border-border text-foreground hover:bg-muted/70'
            }`}
          >
            {availableExecutives.map(e => (
              <option key={e} value={e}>{e === 'All' ? 'All Executives' : e}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none opacity-60" />
        </div>

        {/* Paid Status Filter */}
        <div className="relative">
          <select
            value={selectedPaidStatus}
            onChange={(e) => onPaidStatusChange(e.target.value)}
            className={`h-8 rounded-lg border px-2.5 pr-7 text-xs font-semibold outline-none cursor-pointer transition-colors appearance-none ${
              selectedPaidStatus !== 'All'
                ? 'bg-primary/10 border-primary text-primary'
                : 'bg-muted/40 border-border text-foreground hover:bg-muted/70'
            }`}
          >
            <option value="All">All Status</option>
            <option value="Paid">Paid Only</option>
            <option value="Unpaid">Unpaid Only</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none opacity-60" />
        </div>

        {/* Allocation Filter */}
        <div className="relative">
          <select
            value={selectedAllocation}
            onChange={(e) => onAllocationChange(e.target.value)}
            className={`h-8 rounded-lg border px-2.5 pr-7 text-xs font-semibold outline-none cursor-pointer transition-colors appearance-none ${
              selectedAllocation !== 'All'
                ? 'bg-primary/10 border-primary text-primary'
                : 'bg-muted/40 border-border text-foreground hover:bg-muted/70'
            }`}
          >
            <option value="All">All Allocations</option>
            <option value="Allocated">Allocated</option>
            <option value="Unallocated">Unallocated</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none opacity-60" />
        </div>

        {/* POS Range Popover */}
        <Popover open={posPopoverOpen} onOpenChange={(open) => {
          setPosPopoverOpen(open);
          if (open) {
            setTempMinPos(minPos);
            setTempMaxPos(maxPos);
            setPosError(null);
          }
        }}>
          <PopoverTrigger asChild>
            <button
              className={`h-8 px-2.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                isPosActive
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'bg-muted/40 border-border text-foreground hover:bg-muted/70'
              }`}
            >
              <span>{posLabel}</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3" align="start">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 text-primary" /> POS Exposure Range
            </h4>

            {/* Quick Chips */}
            <div className="grid grid-cols-2 gap-1.5 mb-3">
              <button
                onClick={() => handleQuickPos('0', '50000')}
                className="px-2 py-1 text-[11px] font-medium bg-muted/50 hover:bg-muted border border-border/60 rounded text-center"
              >
                ₹0 - 50k
              </button>
              <button
                onClick={() => handleQuickPos('50000', '100000')}
                className="px-2 py-1 text-[11px] font-medium bg-muted/50 hover:bg-muted border border-border/60 rounded text-center"
              >
                ₹50k - 1L
              </button>
              <button
                onClick={() => handleQuickPos('100000', '500000')}
                className="px-2 py-1 text-[11px] font-medium bg-muted/50 hover:bg-muted border border-border/60 rounded text-center"
              >
                ₹1L - 5L
              </button>
              <button
                onClick={() => handleQuickPos('500000', '')}
                className="px-2 py-1 text-[11px] font-medium bg-muted/50 hover:bg-muted border border-border/60 rounded text-center"
              >
                ₹5L+
              </button>
            </div>

            <div className="space-y-2 mb-3">
              <div>
                <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Min POS (₹)</label>
                <input
                  type="number"
                  placeholder="e.g. 10000"
                  value={tempMinPos}
                  onChange={(e) => {
                    setTempMinPos(e.target.value);
                    setPosError(null);
                  }}
                  className="w-full h-8 px-2.5 text-xs font-mono border border-border rounded bg-muted/20 outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Max POS (₹)</label>
                <input
                  type="number"
                  placeholder="e.g. 100000"
                  value={tempMaxPos}
                  onChange={(e) => {
                    setTempMaxPos(e.target.value);
                    setPosError(null);
                  }}
                  className="w-full h-8 px-2.5 text-xs font-mono border border-border rounded bg-muted/20 outline-none focus:border-primary"
                />
              </div>
              {posError && (
                <p className="text-[11px] font-medium text-destructive">{posError}</p>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <button
                onClick={() => {
                  setTempMinPos('');
                  setTempMaxPos('');
                  onPosRangeChange('', '');
                  setPosPopoverOpen(false);
                }}
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
              <button
                onClick={handleApplyPosRange}
                className="px-3 py-1 text-xs font-bold uppercase tracking-wider bg-primary text-primary-foreground rounded hover:bg-primary/90"
              >
                Apply
              </button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Custom Column Filters */}
        {activeCustomFilters.map(col => {
          const options = Array.from(new Set(baseRecords.map((r: any) => String(r[col] || 'UNKNOWN').trim().toUpperCase()).filter(Boolean))).sort();
          const currentVal = customFilterValues[col] || 'All';
          const isColActive = currentVal !== 'All';

          return (
            <div key={col} className="flex items-center bg-muted/40 border border-border rounded-lg pl-2 pr-1 py-0.5 gap-1.5">
              <span className="text-[11px] font-bold text-foreground truncate max-w-[100px]" title={col}>
                {col}:
              </span>
              <Popover>
                <PopoverTrigger asChild>
                  <button className={`h-6 px-1.5 text-xs font-semibold rounded truncate max-w-[90px] transition-colors ${
                    isColActive ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'
                  }`}>
                    {currentVal}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2" align="start">
                  <div className="relative mb-2">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search values..."
                      className="w-full pl-6 pr-2 py-1.5 text-xs border border-border rounded bg-muted/20 outline-none focus:border-primary transition-colors"
                      value={columnFilterSearches[col] || ''}
                      onChange={e => setColumnFilterSearches(prev => ({...prev, [col]: e.target.value}))}
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto no-scrollbar flex flex-col gap-0.5">
                    <button
                      onClick={() => onCustomFilterValueChange(col, 'All')}
                      className={`text-left px-2 py-1.5 text-xs rounded hover:bg-muted transition-colors ${currentVal === 'All' ? 'bg-primary/10 text-primary font-bold' : 'text-foreground'}`}
                    >
                      All
                    </button>
                    {options.filter(o => o.toLowerCase().includes((columnFilterSearches[col] || '').toLowerCase())).map(o => (
                      <button
                        key={o}
                        onClick={() => onCustomFilterValueChange(col, o)}
                        className={`text-left px-2 py-1.5 text-xs rounded hover:bg-muted transition-colors truncate ${currentVal === o ? 'bg-primary/10 text-primary font-bold' : 'text-foreground'}`}
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              <button
                onClick={() => onRemoveCustomFilter(col)}
                className="text-muted-foreground hover:text-destructive p-0.5 rounded transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}

        {/* Add Custom Filter Button */}
        <Popover>
          <PopoverTrigger asChild>
            <button className="h-8 px-2.5 rounded-lg border border-dashed border-border/80 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 flex items-center gap-1 transition-colors">
              <Plus className="h-3 w-3" />
              <span>Custom</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="start">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Select Column to Filter</h4>
            <div className="relative mb-2">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search columns..."
                className="w-full pl-6 pr-2 py-1 text-xs border border-border rounded bg-muted/20 outline-none focus:border-primary transition-colors"
                value={customFilterSearch}
                onChange={e => setCustomFilterSearch(e.target.value)}
              />
            </div>
            <ScrollArea className="h-48 pr-1">
              <div className="flex flex-col gap-1">
                {schema
                  .filter(col => !standardKeys.includes(col) && !col.startsWith('_'))
                  .filter(col => col.toLowerCase().includes(customFilterSearch.toLowerCase()))
                  .map(col => (
                    <div
                      key={col}
                      className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded transition-colors cursor-pointer"
                      onClick={() => onAddCustomFilter(col)}
                    >
                      <Checkbox className="pointer-events-none" checked={activeCustomFilters.includes(col)} />
                      <span className="text-xs truncate flex-1">{col}</span>
                    </div>
                  ))}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>

        {/* Reset / Clear Button */}
        {activeFilterCount > 0 && (
          <button
            onClick={onClearSecondary}
            className="ml-auto text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
          >
            Clear Filters ({activeFilterCount})
          </button>
        )}
      </div>
    </div>
  );
}
