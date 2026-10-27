/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { AppLayout } from '../components/layout/AppLayout';
import { calculateRow } from '../lib/calculations';
import { fmtCur } from '../lib/formatters';
import { 
  Database, Search, Columns, Plus, X, ArrowUp, ArrowDown, 
  CheckCircle2, AlignJustify, Rows, Layers, Bookmark, RotateCcw, 
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Filter, ArrowUpDown
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Checkbox } from '../components/ui/checkbox';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "../components/ui/sheet";
import { ScrollArea } from "../components/ui/scroll-area";
import { Badge } from "../components/ui/badge";

import { BucketBadge, getBucketRowBorder } from '../components/explorer/BucketBadge';
import { StatusBadge } from '../components/explorer/StatusBadge';
import { ContextStrip } from '../components/explorer/ContextStrip';
import { FilterStrip } from '../components/explorer/FilterStrip';
import { MultiCaseModal } from '../components/explorer/MultiCaseModal';

const STANDARD_KEYS = [
  "agreementid", "agreement_no", "AGREEMENTID", "AGREEMENTNO", "AGREEMENT_NO", "Agreement No", "loan_id", "Loan ID",
  "customer_name", "CUSTOMERNAME", "Customer Name", "CUSTOMER_NAME", "customername",
  "bom_bkt",
  "state", "State",
  "city", "City",
  "executive_name", "Executive Name", "Final EX. Name", "Final EX. name", "Final EX.NAME", "EX. Name", "EX. name", "EX.NAME", "Final Executive Name", "final_executive_name", "Final Executive", "final_executive", "Executive", "executive",
  "principal_outstanding",
  "emi_amt",
  "ecs", "ECS",
  "provisional_dac", "dac", "DAC",
  "mainPaid", "emiCount"
];

export default function DataExplorer() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { records, schema, isLoading, bulkUpdateRecords } = useData();
  const { user, isExecutive, users } = useAuth();
  const navigate = useNavigate();

  // Filter States
  const [selectedState, setSelectedState] = useState<string>(searchParams.get('state') || 'All');
  const [selectedCity, setSelectedCity] = useState<string>(searchParams.get('city') || 'All');
  const [selectedBucket, setSelectedBucket] = useState<string>(searchParams.get('bucket') || 'All');
  const [selectedExecutive, setSelectedExecutive] = useState<string>(searchParams.get('executive') || 'All');
  const [selectedAllocation, setSelectedAllocation] = useState<string>(searchParams.get('allocated') || 'All');
  const [selectedPaidStatus, setSelectedPaidStatus] = useState<string>(searchParams.get('paid') || 'All');
  const [searchQuery, setSearchQuery] = useState<string>(searchParams.get('q') || '');
  const [exactCustomerFingerprint, setExactCustomerFingerprint] = useState<string | null>(null);
  const [minPos, setMinPos] = useState<string>(searchParams.get('minPos') || '');
  const [maxPos, setMaxPos] = useState<string>(searchParams.get('maxPos') || '');
  const [activeCustomFilters, setActiveCustomFilters] = useState<string[]>([]);
  const [customFilterValues, setCustomFilterValues] = useState<Record<string, string>>({});

  const [selectedCases, setSelectedCases] = useState<Set<string>>(new Set());
  
  // 3-Tier View Density Switcher
  const [density, setDensity] = useState<'compact' | 'comfortable' | 'detailed'>(() => {
    const saved = localStorage.getItem('dataExplorerDensity');
    if (saved === 'compact' || saved === 'comfortable' || saved === 'detailed') return saved;
    return 'comfortable';
  });

  const thPad = density === 'detailed' ? 'py-3' : density === 'comfortable' ? 'py-2' : 'py-1.5';
  const tdPad = density === 'detailed' ? 'py-2.5' : density === 'comfortable' ? 'py-1.5' : 'py-1';
  const tableTextSize = density === 'detailed' ? 'text-xs' : density === 'comfortable' ? 'text-[11px]' : 'text-[10px]';

  const [draggedCol, setDraggedCol] = useState<string | null>(null);
  const [bulkAssignExec, setBulkAssignExec] = useState<string>('');
  const [newPresetName, setNewPresetName] = useState('');
  const [isPresetPopoverOpen, setIsPresetPopoverOpen] = useState(false);
  const [sortSearch, setSortSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }[]>([]);

  // Page & Items per page
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(() => {
    const saved = localStorage.getItem('dataExplorerPageSize');
    return saved ? Number(saved) : 50;
  });

  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [multiCaseModal, setMultiCaseModal] = useState<{ name: string; records: any[] } | null>(null);
  const [columnSearch, setColumnSearch] = useState('');
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Saved Filter Presets
  const [savedViews, setSavedViews] = useState<any[]>(() => {
    const saved = localStorage.getItem('dataExplorerSavedViews') || localStorage.getItem('dataExplorerSavedPresets');
    return saved ? JSON.parse(saved) : [];
  });

  const allExecutives = useMemo(() => {
    return Array.from(new Set(records.map((r: any) => String(r.executive_name || r['Executive Name'] || '').trim()).filter(Boolean))).sort();
  }, [records]);
  
  const allExtraKeys = useMemo(() => {
    return schema.filter(k => !STANDARD_KEYS.includes(k) && !k.startsWith('_'));
  }, [schema]);

  const [visibleExtraColumns, setVisibleExtraColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem('dataExplorerExtraColumns');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    if (visibleExtraColumns === null && allExtraKeys.length > 0) {
      setVisibleExtraColumns(allExtraKeys);
      localStorage.setItem('dataExplorerExtraColumns', JSON.stringify(allExtraKeys));
    }
  }, [allExtraKeys, visibleExtraColumns]);

  const toggleExtraColumn = (col: string) => {
    setVisibleExtraColumns(prev => {
      const safePrev = prev || [];
      const next = safePrev.includes(col) ? safePrev.filter(c => c !== col) : [...safePrev, col];
      localStorage.setItem('dataExplorerExtraColumns', JSON.stringify(next));
      return next;
    });
  };

  const scrollTable = (dir: 'left' | 'right') => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' });
    }
  };

  const jumpToColumn = (colName: string) => {
    const el = document.getElementById(`th-${colName}`);
    if (el && tableContainerRef.current) {
      const containerLeft = tableContainerRef.current.getBoundingClientRect().left;
      const elLeft = el.getBoundingClientRect().left;
      const scrollOffset = elLeft - containerLeft - 100;
      tableContainerRef.current.scrollBy({ left: scrollOffset, behavior: 'smooth' });
    }
  };

  // Synchronize URL query params
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedState !== 'All') params.set('state', selectedState);
    if (selectedCity !== 'All') params.set('city', selectedCity);
    if (selectedBucket !== 'All') params.set('bucket', selectedBucket);
    if (selectedExecutive !== 'All') params.set('executive', selectedExecutive);
    if (selectedPaidStatus !== 'All') params.set('paid', selectedPaidStatus);
    if (selectedAllocation !== 'All') params.set('allocated', selectedAllocation);
    if (searchQuery) params.set('q', searchQuery);
    if (minPos) params.set('minPos', minPos);
    if (maxPos) params.set('maxPos', maxPos);
    setSearchParams(params, { replace: false });
    setPage(1);
  }, [selectedState, selectedCity, selectedBucket, selectedExecutive, selectedAllocation, selectedPaidStatus, searchQuery, minPos, maxPos, setSearchParams]);

  const baseRecords = useMemo(() => {
    if (isExecutive() && user) return records.filter((r: any) => r.executive_name === user.name);
    return records;
  }, [records, user, isExecutive]);

  // Address and Contact key resolver
  const { addressKey, contactKey } = useMemo(() => {
    return {
      addressKey: schema.find(k => k.toLowerCase() === 'mailingaddress') || schema.find(k => k.toLowerCase().includes('address') || k.toLowerCase() === 'add1' || k.toLowerCase().includes('add_1') || k.toLowerCase().includes('res_add')) || null,
      contactKey: schema.find(k => k.toLowerCase().includes('mobile') || k.toLowerCase().includes('phone') || k.toLowerCase().includes('contact')) || null
    };
  }, [schema]);

  const availableStates = useMemo(() => ['All', ...Array.from(new Set(baseRecords.map((r: any) => String(r.state || r.State || 'UNKNOWN').trim().toUpperCase()).filter(Boolean))).sort()], [baseRecords]);
  
  const availableCities = useMemo(() => {
    const stateFiltered = selectedState === 'All' 
      ? baseRecords 
      : baseRecords.filter((r: any) => String(r.state || r.State || 'UNKNOWN').trim().toUpperCase() === selectedState);
    return ['All', ...Array.from(new Set(stateFiltered.map((r: any) => String(r.city || r.City || 'UNKNOWN').trim().toUpperCase()).filter(Boolean))).sort()];
  }, [baseRecords, selectedState]);

  const availableBuckets = useMemo(() => ['All', ...Array.from(new Set(baseRecords.map((r: any) => String(r.bom_bkt || 'UNKNOWN').trim()).filter(Boolean))).sort((a,b) => Number(a) - Number(b))], [baseRecords]);

  const availableExecutives = useMemo(() => {
    const execs = new Set<string>();
    users.filter(u => u.role === 'EXECUTIVE').forEach(u => execs.add(u.name));
    baseRecords.forEach((r: any) => {
      const e = String(r.executive_name || r['Executive Name'] || 'UNKNOWN').trim();
      if (e && e !== 'UNKNOWN') execs.add(e);
    });
    return ['All', ...Array.from(execs).sort()];
  }, [baseRecords, users]);

  // Customer Case Grouping Stats
  const customerStats = useMemo(() => {
    const stats: Record<string, { count: number, totalPos: number }> = {};
    baseRecords.forEach((r: any) => {
      const rawName = r.customer_name || r.CUSTOMERNAME || r['Customer Name'] || r.CUSTOMER_NAME || r.customername || '';
      const name = String(rawName).trim().toUpperCase();
      const address = addressKey ? String(r[addressKey] || '').trim().toUpperCase() : '';
      const contact = contactKey ? String(r[contactKey] || '').trim().toUpperCase() : '';
      const fingerprint = `${name}||${contact}||${address}`;
      
      if (name && name !== '-') {
        if (!stats[fingerprint]) stats[fingerprint] = { count: 0, totalPos: 0 };
        stats[fingerprint].count += 1;
        stats[fingerprint].totalPos += Number(r.principal_outstanding) || 0;
      }
    });
    return stats;
  }, [baseRecords, addressKey, contactKey]);

  // Filter Pipeline
  const filteredRecords = useMemo(() => {
    return baseRecords.filter((r: any) => {
      if (exactCustomerFingerprint) {
        const rawName = r.customer_name || r.CUSTOMERNAME || r['Customer Name'] || r.CUSTOMER_NAME || r.customername || '';
        const name = String(rawName).trim().toUpperCase();
        const address = addressKey ? String(r[addressKey] || '').trim().toUpperCase() : '';
        const contact = contactKey ? String(r[contactKey] || '').trim().toUpperCase() : '';
        if (`${name}||${contact}||${address}` !== exactCustomerFingerprint) return false;
      }
      if (selectedState !== 'All' && String(r.state || r.State || 'UNKNOWN').trim().toUpperCase() !== selectedState) return false;
      if (selectedCity !== 'All' && String(r.city || r.City || 'UNKNOWN').trim().toUpperCase() !== selectedCity) return false;
      if (selectedBucket !== 'All' && String(r.bom_bkt || 'UNKNOWN').trim() !== selectedBucket) return false;
      if (selectedExecutive !== 'All' && String(r.executive_name || r['Executive Name'] || 'UNKNOWN').trim() !== selectedExecutive) return false;
      
      const execName = String(r.executive_name || r['Executive Name'] || r.EXECUTIVE_NAME || '').trim();
      const isAllocated = execName.length > 0;
      if (selectedAllocation === 'Allocated' && !isAllocated) return false;
      if (selectedAllocation === 'Unallocated' && isAllocated) return false;
      
      const c = calculateRow(r);
      const isPaid = c.mainPaid === 1;
      if (selectedPaidStatus === 'Paid' && !isPaid) return false;
      if (selectedPaidStatus === 'Unpaid' && isPaid) return false;

      const pos = Number(r.principal_outstanding) || 0;
      if (minPos && pos < Number(minPos)) return false;
      if (maxPos && pos > Number(maxPos)) return false;
      
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const name = String(r.customer_name || r.CUSTOMERNAME || r['Customer Name'] || r.CUSTOMER_NAME || '').toLowerCase();
        const id = String(r.agreementid || r.agreement_no || r.AGREEMENTNO || r.AGREEMENTID || '').toLowerCase();
        if (!name.includes(q) && !id.includes(q)) return false;
      }
      
      for (const col of activeCustomFilters) {
        const filterVal = customFilterValues[col];
        if (filterVal && filterVal !== 'All') {
          if (String(r[col] || '').trim().toUpperCase() !== filterVal.trim().toUpperCase()) {
            return false;
          }
        }
      }
      
      return true;
    });
  }, [baseRecords, selectedState, selectedCity, selectedBucket, selectedExecutive, selectedAllocation, selectedPaidStatus, searchQuery, minPos, maxPos, activeCustomFilters, customFilterValues, exactCustomerFingerprint, addressKey, contactKey]);

  // Context Metrics
  const contextMetrics = useMemo(() => {
    let totalPos = 0;
    let paidCount = 0;
    let clearedAmount = 0;
    filteredRecords.forEach((r: any) => {
      totalPos += Number(r.principal_outstanding) || 0;
      const c = calculateRow(r);
      if (c.mainPaid === 1) paidCount += 1;
      clearedAmount += c.totalCleared || (Number(r.dac ?? r.DAC) || 0);
    });
    return { totalPos, paidCount, clearedAmount };
  }, [filteredRecords]);

  // Sorting
  const sortedRecords = useMemo(() => {
    if (sortConfig.length === 0) return filteredRecords;
    return [...filteredRecords].sort((a: any, b: any) => {
      for (const sort of sortConfig) {
        let valA = a[sort.key];
        let valB = b[sort.key];
        
        const numA = Number(valA);
        const numB = Number(valB);
        let comp = 0;
        if (!isNaN(numA) && !isNaN(numB) && valA !== '' && valB !== '') {
          comp = sort.direction === 'asc' ? numA - numB : numB - numA;
        } else {
          valA = String(valA || '').toLowerCase();
          valB = String(valB || '').toLowerCase();
          comp = sort.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        if (comp !== 0) return comp;
      }
      return 0;
    });
  }, [filteredRecords, sortConfig]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedRecords.length / itemsPerPage));
  const paginatedRecords = useMemo(() => {
    return sortedRecords.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  }, [sortedRecords, page, itemsPerPage]);

  const handleRowClick = (r: any) => {
    sessionStorage.setItem('currentCaseList', JSON.stringify(filteredRecords.map(rec => rec.agreementid)));
    navigate(`/customer/${r.agreementid}?${searchParams.toString()}`);
  };

  const handleExport = React.useCallback(() => {
    if (filteredRecords.length === 0) return;
    const extraHeaders = allExtraKeys.filter(col => (visibleExtraColumns || []).includes(col));
    const headers = ['Agreement Number', 'Customer Name', 'State', 'City', 'Executive', 'Bucket', 'POS', 'EMI', 'DAC', 'ECS', 'Paid Status', ...extraHeaders];
    const csv = [
      headers.join(','),
      ...filteredRecords.map((r: any) => {
        const isPaid = calculateRow(r).mainPaid === 1;
        return [
          `"${r.agreementid || r.agreement_no || r.AGREEMENTNO || r.AGREEMENTID || ''}"`,
          `"${r.customer_name || r.CUSTOMERNAME || r['Customer Name'] || r.CUSTOMER_NAME || r.customername || ''}"`,
          `"${r.state || r.State || ''}"`,
          `"${r.city || r.City || ''}"`,
          `"${r.executive_name || r['Executive Name'] || ''}"`,
          `"${r.bom_bkt || ''}"`,
          Number(r.principal_outstanding) || 0,
          Number(r.emi_amt) || 0,
          Number(r.dac ?? r.DAC) || 0,
          Number(r.ecs ?? r.ECS) || 0,
          isPaid ? 'Paid' : 'Unpaid',
          ...extraHeaders.map(col => `"${String(r[col] || '').replace(/"/g, '""')}"`)
        ].join(',');
      })
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'Data_Explorer_Export.csv'; a.click();
  }, [filteredRecords, allExtraKeys, visibleExtraColumns]);

  const saveCurrentFiltersAsPreset = (presetName: string) => {
    if (!presetName.trim()) return;
    const newPreset = {
      id: Date.now().toString(),
      name: presetName.trim(),
      selectedState,
      selectedCity,
      selectedBucket,
      selectedExecutive,
      selectedAllocation,
      selectedPaidStatus,
      minPos,
      maxPos,
      searchQuery,
      activeCustomFilters,
      customFilterValues,
      sortConfig,
      density
    };
    const next = [...savedViews, newPreset];
    setSavedViews(next);
    localStorage.setItem('dataExplorerSavedViews', JSON.stringify(next));
    localStorage.setItem('dataExplorerSavedPresets', JSON.stringify(next));
    setNewPresetName('');
    setIsPresetPopoverOpen(false);
  };

  const applyPreset = (preset: any) => {
    if (preset.selectedState !== undefined) setSelectedState(preset.selectedState);
    if (preset.selectedCity !== undefined) setSelectedCity(preset.selectedCity);
    if (preset.selectedBucket !== undefined) setSelectedBucket(preset.selectedBucket);
    if (preset.selectedExecutive !== undefined) setSelectedExecutive(preset.selectedExecutive);
    if (preset.selectedAllocation !== undefined) setSelectedAllocation(preset.selectedAllocation);
    if (preset.selectedPaidStatus !== undefined) setSelectedPaidStatus(preset.selectedPaidStatus);
    if (preset.minPos !== undefined) setMinPos(preset.minPos);
    if (preset.maxPos !== undefined) setMaxPos(preset.maxPos);
    if (preset.searchQuery !== undefined) setSearchQuery(preset.searchQuery);
    if (preset.activeCustomFilters !== undefined) setActiveCustomFilters(preset.activeCustomFilters);
    if (preset.customFilterValues !== undefined) setCustomFilterValues(preset.customFilterValues);
    if (preset.sortConfig !== undefined) setSortConfig(preset.sortConfig);
    if (preset.density !== undefined && (preset.density === 'compact' || preset.density === 'comfortable' || preset.density === 'detailed')) {
      setDensity(preset.density);
      localStorage.setItem('dataExplorerDensity', preset.density);
    }
    setExactCustomerFingerprint(null);
    setPage(1);
  };

  const resetAllFilters = () => {
    setSelectedState('All');
    setSelectedCity('All');
    setSelectedBucket('All');
    setSelectedExecutive('All');
    setSelectedAllocation('All');
    setSelectedPaidStatus('All');
    setMinPos('');
    setMaxPos('');
    setSearchQuery('');
    setActiveCustomFilters([]);
    setCustomFilterValues({});
    setSortConfig([]);
    setExactCustomerFingerprint(null);
    setPage(1);
  };

  // Keyboard Shortcuts (Ctrl+K: Search, Ctrl+E: Export, Ctrl+Shift+R: Reset)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        handleExport();
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        resetAllFilters();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleExport]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedState !== 'All') count++;
    if (selectedCity !== 'All') count++;
    if (selectedBucket !== 'All') count++;
    if (selectedExecutive !== 'All') count++;
    if (selectedAllocation !== 'All') count++;
    if (selectedPaidStatus !== 'All') count++;
    if (minPos || maxPos) count++;
    if (searchQuery) count++;
    count += activeCustomFilters.length;
    return count;
  }, [selectedState, selectedCity, selectedBucket, selectedExecutive, selectedAllocation, selectedPaidStatus, minPos, maxPos, searchQuery, activeCustomFilters]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="animate-pulse flex flex-col gap-4">
          <div className="h-10 w-48 bg-muted rounded-md mb-4" />
          <div className="h-16 w-full bg-card border border-border rounded-xl" />
          <div className="h-20 w-full bg-card border border-border rounded-xl" />
          <div className="h-[500px] w-full bg-card border border-border rounded-xl" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* 1. Header Command Bar */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-foreground flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" /> Data Explorer
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time portfolio inspection, multi-criteria filtering, and customer drill-down
          </p>
        </div>

        {/* Global Dataset KPIs */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="bg-muted/40 border border-border px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Dataset:</span>
            <span className="font-mono font-bold text-foreground">{records.length.toLocaleString()} cases</span>
          </div>
        </div>
      </div>

      {/* 2. Filter Strip */}
      <FilterStrip
        availableStates={availableStates}
        selectedState={selectedState}
        onStateChange={setSelectedState}
        availableCities={availableCities}
        selectedCity={selectedCity}
        onCityChange={setSelectedCity}
        availableBuckets={availableBuckets}
        selectedBucket={selectedBucket}
        onBucketChange={setSelectedBucket}
        availableExecutives={availableExecutives}
        selectedExecutive={selectedExecutive}
        onExecutiveChange={setSelectedExecutive}
        selectedAllocation={selectedAllocation}
        onAllocationChange={setSelectedAllocation}
        selectedPaidStatus={selectedPaidStatus}
        onPaidStatusChange={setSelectedPaidStatus}
        minPos={minPos}
        maxPos={maxPos}
        onPosRangeChange={(min, max) => {
          setMinPos(min);
          setMaxPos(max);
        }}
        schema={schema}
        standardKeys={STANDARD_KEYS}
        activeCustomFilters={activeCustomFilters}
        customFilterValues={customFilterValues}
        onAddCustomFilter={(col) => {
          if (!activeCustomFilters.includes(col)) {
            setActiveCustomFilters(prev => [...prev, col]);
          }
        }}
        onRemoveCustomFilter={(col) => {
          setActiveCustomFilters(prev => prev.filter(c => c !== col));
          const next = { ...customFilterValues };
          delete next[col];
          setCustomFilterValues(next);
        }}
        onCustomFilterValueChange={(col, val) => {
          setCustomFilterValues(prev => ({ ...prev, [col]: val }));
        }}
        baseRecords={baseRecords}
        onClearSecondary={resetAllFilters}
        activeFilterCount={activeFilterCount}
      />

      {/* 3. Context Strip (Signature Live Aggregate Strip with Export CSV) */}
      <ContextStrip
        totalRecords={filteredRecords.length}
        totalPos={contextMetrics.totalPos}
        paidCount={contextMetrics.paidCount}
        clearedAmount={contextMetrics.clearedAmount}
        onExport={handleExport}
      />

      {/* 4. Toolbar: Presets & Controls Bar */}
      <div className="bg-card border border-border rounded-xl p-2.5 mb-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-xs">
        {/* Left: Saved Presets & Active Sorts */}
        <div className="flex flex-wrap items-center gap-2 flex-1 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground mr-1 shrink-0">
            <Bookmark className="h-3.5 w-3.5 text-primary" />
            <span className="uppercase text-[10px] tracking-wider">Presets:</span>
          </div>

          {/* User Saved Presets */}
          {savedViews.length === 0 ? (
            <span className="text-xs text-muted-foreground italic">
              No saved presets. Apply filters and save for 1-click access.
            </span>
          ) : (
            savedViews.map((view, i) => (
              <div 
                key={view.id || i} 
                className="flex items-center bg-muted/40 border border-border rounded-lg pl-2 pr-1 py-0.5 gap-1.5 shrink-0 hover:border-primary/50 transition-colors"
              >
                <button 
                  className="text-xs font-semibold text-foreground hover:text-primary truncate max-w-[130px]" 
                  title={`Apply preset: ${view.name}`} 
                  onClick={() => applyPreset(view)}
                >
                  {view.name}
                </button>
                <button 
                  className="text-muted-foreground hover:text-destructive p-0.5 rounded transition-colors" 
                  title="Delete preset"
                  onClick={() => {
                    const next = [...savedViews];
                    next.splice(i, 1);
                    setSavedViews(next);
                    localStorage.setItem('dataExplorerSavedViews', JSON.stringify(next));
                    localStorage.setItem('dataExplorerSavedPresets', JSON.stringify(next));
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))
          )}

          {/* Save Preset Button */}
          <Popover open={isPresetPopoverOpen} onOpenChange={setIsPresetPopoverOpen}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1 px-2 py-1 text-xs font-bold bg-primary/10 text-primary border border-primary/25 rounded-lg hover:bg-primary/20 transition-colors shrink-0">
                <Plus className="h-3 w-3" /> Save Preset
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-3" align="start">
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground mb-1.5 flex items-center gap-1.5">
                <Bookmark className="h-3.5 w-3.5 text-primary" /> Save Filter Combination
              </h4>
              <p className="text-[11px] text-muted-foreground mb-3">
                Save active bucket, state, city, executive, and POS boundaries for 1-click access.
              </p>
              <div className="space-y-2.5">
                <input
                  type="text"
                  placeholder="e.g. Critical BKT-2 Cases"
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveCurrentFiltersAsPreset(newPresetName);
                  }}
                  className="w-full px-2.5 py-1.5 text-xs border border-border rounded-md bg-muted/30 outline-none focus:border-primary"
                  autoFocus
                />
                <div className="flex justify-end gap-1.5">
                  <button
                    onClick={() => setIsPresetPopoverOpen(false)}
                    className="px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground rounded"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={!newPresetName.trim()}
                    onClick={() => saveCurrentFiltersAsPreset(newPresetName)}
                    className="px-3 py-1 text-xs font-bold uppercase tracking-wider bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Reset All Filters Button */}
          <button
            onClick={resetAllFilters}
            className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted transition-colors shrink-0"
            title="Reset all filters (Ctrl+Shift+R)"
          >
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
        </div>

        {/* Right Controls: Sort, Density, Columns, Search */}
        <div className="flex flex-wrap items-center gap-2 shrink-0 border-t lg:border-t-0 pt-2 lg:pt-0">
          {/* Active Sort Chips */}
          <Popover>
            <PopoverTrigger asChild>
              <button className={`h-8 px-2.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                sortConfig.length > 0
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'bg-muted/40 border-border text-foreground hover:bg-muted/70'
              }`}>
                <ArrowUpDown className="h-3.5 w-3.5" />
                <span>Sort {sortConfig.length > 0 ? `(${sortConfig.length})` : ''}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="end">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Sort by Column</h4>
              <div className="relative mb-2">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <input 
                  type="text" 
                  placeholder="Search column..." 
                  className="w-full pl-6 pr-2 py-1 text-xs border border-border rounded bg-muted/20 outline-none focus:border-primary"
                  value={sortSearch}
                  onChange={e => setSortSearch(e.target.value)}
                />
              </div>
              <ScrollArea className="h-48 pr-1">
                <div className="flex flex-col gap-1">
                  {schema.filter(col => col.toLowerCase().includes(sortSearch.toLowerCase())).map(col => (
                    <div 
                      key={col} 
                      className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded transition-colors cursor-pointer" 
                      onClick={() => {
                        setSortConfig(prev => {
                          const exists = prev.find(s => s.key === col);
                          if (exists) return prev.filter(s => s.key !== col);
                          return [...prev, { key: col, direction: 'asc' }];
                        });
                      }}
                    >
                      <Checkbox className="pointer-events-none" checked={!!sortConfig.find(s => s.key === col)} />
                      <span className="text-xs truncate flex-1">{col}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>

          {sortConfig.map(sort => (
            <div key={sort.key} className="flex items-center gap-1 bg-muted/60 border border-border px-2 py-1 rounded-lg text-xs font-medium text-foreground">
              <span className="truncate max-w-[80px]">{sort.key}</span>
              <button 
                onClick={() => setSortConfig(prev => prev.map(s => s.key === sort.key ? { ...s, direction: s.direction === 'asc' ? 'desc' : 'asc' } : s))} 
                className="text-muted-foreground hover:text-foreground p-0.5"
              >
                {sort.direction === 'asc' ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />}
              </button>
              <button 
                onClick={() => setSortConfig(prev => prev.filter(s => s.key !== sort.key))} 
                className="text-muted-foreground hover:text-destructive p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}

          {/* Density Switcher */}
          <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border border-border">
            <button
              onClick={() => { setDensity('compact'); localStorage.setItem('dataExplorerDensity', 'compact'); }}
              className={`flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded transition-all ${
                density === 'compact' ? 'bg-card text-primary shadow-xs border border-border/50' : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Compact: Maximum rows visible"
            >
              <AlignJustify className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Compact</span>
            </button>
            <button
              onClick={() => { setDensity('comfortable'); localStorage.setItem('dataExplorerDensity', 'comfortable'); }}
              className={`flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded transition-all ${
                density === 'comfortable' ? 'bg-card text-primary shadow-xs border border-border/50' : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Comfortable: Standard view"
            >
              <Rows className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Comfortable</span>
            </button>
            <button
              onClick={() => { setDensity('detailed'); localStorage.setItem('dataExplorerDensity', 'detailed'); }}
              className={`flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded transition-all ${
                density === 'detailed' ? 'bg-card text-primary shadow-xs border border-border/50' : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Detailed: Shows breakdown tags, POS recovery %, and rich indicators"
            >
              <Layers className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Detailed</span>
            </button>
          </div>

          {/* Scroll & Jump Table Navigation */}
          <div className="flex items-center gap-1">
            <button onClick={() => scrollTable('left')} className="h-8 w-7 border border-border rounded-lg bg-muted/40 hover:bg-muted text-muted-foreground flex items-center justify-center transition-colors" title="Scroll Left">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => scrollTable('right')} className="h-8 w-7 border border-border rounded-lg bg-muted/40 hover:bg-muted text-muted-foreground flex items-center justify-center transition-colors" title="Scroll Right">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="relative">
            <select 
              onChange={(e) => { if(e.target.value) jumpToColumn(e.target.value); e.target.value = ""; }} 
              className="h-8 w-24 rounded-lg bg-muted/40 border border-border px-2 text-xs font-medium outline-none focus:border-primary"
            >
              <option value="">Jump...</option>
              {(allExtraKeys.filter(c => (visibleExtraColumns || []).includes(c))).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Columns Selector */}
          <Popover>
            <PopoverTrigger asChild>
              <button className="h-8 px-2.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold flex items-center gap-1.5 transition-colors">
                <Columns className="h-3.5 w-3.5" />
                <span>Cols</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="end">
              <div className="mb-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input 
                    type="text" 
                    placeholder="Search columns..." 
                    className="w-full pl-7 pr-2 py-1 text-xs border border-border rounded bg-muted/20 outline-none focus:border-primary"
                    value={columnSearch}
                    onChange={e => setColumnSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Extra Columns</h4>
                <div className="flex gap-2">
                  <button 
                    onClick={() => { setVisibleExtraColumns(allExtraKeys); localStorage.setItem('dataExplorerExtraColumns', JSON.stringify(allExtraKeys)); }}
                    className="text-[10px] uppercase text-primary font-bold hover:underline"
                  >
                    All
                  </button>
                  <button 
                    onClick={() => { setVisibleExtraColumns([]); localStorage.setItem('dataExplorerExtraColumns', JSON.stringify([])); }}
                    className="text-[10px] uppercase text-muted-foreground hover:underline"
                  >
                    None
                  </button>
                </div>
              </div>
              <ScrollArea className="h-56 pr-2">
                <div className="space-y-1.5">
                  {allExtraKeys.length === 0 ? (
                    <div className="text-xs text-muted-foreground italic">No extra columns</div>
                  ) : (
                    allExtraKeys.filter(col => col.toLowerCase().includes(columnSearch.toLowerCase())).map(col => (
                      <div key={col} className="flex items-center gap-2">
                        <Checkbox 
                          id={`col-${col}`} 
                          checked={(visibleExtraColumns || []).includes(col)}
                          onCheckedChange={() => toggleExtraColumn(col)}
                        />
                        <label htmlFor={`col-${col}`} className="text-xs font-medium leading-none cursor-pointer select-none">
                          {col}
                        </label>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>

          {/* Quick Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input 
              ref={searchInputRef}
              type="text" 
              placeholder="Search (Ctrl+K)..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-8 w-44 rounded-lg bg-muted/40 border border-border pl-8 pr-2 text-xs font-medium outline-none focus:border-primary transition-colors"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 5. Bulk Assign Action Floating Strip */}
      {selectedCases.size > 0 && (
        <div className="bg-primary/10 border border-primary/30 p-2.5 mb-3 rounded-xl flex flex-wrap items-center gap-3 animate-in slide-in-from-top-2 shadow-sm">
          <div className="flex items-center gap-1.5 text-primary font-bold text-xs">
            <CheckCircle2 className="h-4 w-4" />
            <span>{selectedCases.size} cases selected</span>
          </div>
          <div className="h-5 w-px bg-primary/20"></div>
          <select 
            className="h-8 px-2.5 rounded-lg border border-border bg-card text-xs font-semibold outline-none focus:border-primary"
            value={bulkAssignExec}
            onChange={e => setBulkAssignExec(e.target.value)}
          >
            <option value="">-- Select Executive --</option>
            {allExecutives.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <button 
            className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
            disabled={!bulkAssignExec}
            onClick={async () => {
              const updates = Array.from(selectedCases).map(id => ({ agreementid: id, field: 'executive_name', value: bulkAssignExec }));
              await bulkUpdateRecords(updates, user?.name || "System");
              setSelectedCases(new Set());
              setBulkAssignExec('');
            }}
          >
            Assign Selected
          </button>
          <button 
            className="ml-auto text-xs font-semibold text-muted-foreground hover:text-foreground"
            onClick={() => setSelectedCases(new Set())}
          >
            Clear Selection
          </button>
        </div>
      )}

      {/* 6. Main Data Grid */}
      <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-auto scrollbar-thin max-h-[calc(100vh-340px)] min-h-[420px]" ref={tableContainerRef}>
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead className="sticky top-0 z-20 bg-muted/95 backdrop-blur border-b border-border shadow-xs">
              <tr>
                {/* 3 Frozen Columns */}
                <th className={`sticky left-0 top-0 z-30 bg-muted border-r border-border px-2.5 ${thPad} w-10`}>
                  <Checkbox 
                    checked={paginatedRecords.length > 0 && paginatedRecords.every((r:any) => selectedCases.has(r.agreementid || r.agreement_no || r.AGREEMENTNO || r.AGREEMENTID))}
                    onCheckedChange={(c) => {
                      if (c) {
                        const all = new Set(selectedCases);
                        paginatedRecords.forEach((r:any) => all.add(r.agreementid || r.agreement_no || r.AGREEMENTNO || r.AGREEMENTID));
                        setSelectedCases(all);
                      } else {
                        const remaining = new Set(selectedCases);
                        paginatedRecords.forEach((r:any) => remaining.delete(r.agreementid || r.agreement_no || r.AGREEMENTNO || r.AGREEMENTID));
                        setSelectedCases(remaining);
                      }
                    }}
                  />
                </th>
                <th className={`sticky left-10 top-0 z-30 bg-muted border-r border-border px-3 ${thPad} text-[10px] uppercase tracking-wider text-muted-foreground font-bold`}>
                  Aggr No
                </th>
                <th className={`sticky left-[142px] top-0 z-30 bg-muted border-r border-border px-3 ${thPad} text-[10px] uppercase tracking-wider text-muted-foreground font-bold min-w-[200px]`}>
                  Customer Name
                </th>

                {/* Standard Columns */}
                <th className={`px-2.5 ${thPad} text-[10px] uppercase tracking-wider text-muted-foreground font-bold`}>Bucket</th>
                <th className={`px-2.5 ${thPad} text-[10px] uppercase tracking-wider text-muted-foreground font-bold`}>State</th>
                <th className={`px-2.5 ${thPad} text-[10px] uppercase tracking-wider text-muted-foreground font-bold`}>City</th>
                <th className={`px-2.5 ${thPad} text-[10px] uppercase tracking-wider text-muted-foreground font-bold`}>Executive</th>
                <th className={`px-3 ${thPad} text-[10px] uppercase tracking-wider text-muted-foreground font-bold text-right`}>POS</th>
                <th className={`px-3 ${thPad} text-[10px] uppercase tracking-wider text-muted-foreground font-bold text-right`}>EMI</th>
                <th className={`px-3 ${thPad} text-[10px] uppercase tracking-wider text-muted-foreground font-bold text-right`}>ECS</th>
                <th className={`px-3 ${thPad} text-[10px] uppercase tracking-wider text-muted-foreground font-bold text-right`}>DAC</th>
                <th className={`px-3 ${thPad} text-[10px] uppercase tracking-wider text-muted-foreground font-bold text-right`}>Status</th>

                {/* Extra Columns with Drag-to-Reorder */}
                {(visibleExtraColumns || []).filter(col => allExtraKeys.includes(col)).map(col => (
                  <th 
                    key={col} 
                    id={`th-${col}`} 
                    draggable
                    onDragStart={(e) => {
                      setDraggedCol(col);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggedCol && draggedCol !== col) {
                        setVisibleExtraColumns(prev => {
                          const next = [...(prev || [])];
                          const fromIdx = next.indexOf(draggedCol);
                          const toIdx = next.indexOf(col);
                          if (fromIdx !== -1 && toIdx !== -1) {
                            next.splice(fromIdx, 1);
                            next.splice(toIdx, 0, draggedCol);
                            localStorage.setItem('dataExplorerExtraColumns', JSON.stringify(next));
                          }
                          return next;
                        });
                      }
                      setDraggedCol(null);
                    }}
                    onDragEnd={() => setDraggedCol(null)}
                    className={`px-3 ${thPad} text-[10px] uppercase tracking-wider text-muted-foreground font-bold cursor-move ${draggedCol === col ? 'opacity-50' : ''}`}
                    title="Drag column header to reorder"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={`divide-y divide-border/60 ${tableTextSize}`}>
              {paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={12 + (visibleExtraColumns || []).length} className="p-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center">
                      <Filter className="h-8 w-8 mb-2 opacity-40 text-muted-foreground" />
                      <p className="text-sm font-semibold">No records match your active filters</p>
                      <p className="text-xs text-muted-foreground mt-1">Try clearing some filter boundaries or resetting</p>
                      <button
                        onClick={resetAllFilters}
                        className="mt-3 px-3 py-1 text-xs font-bold uppercase tracking-wider bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
                      >
                        Reset All Filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((r: any, idx: number) => {
                  const c = calculateRow(r);
                  const isPaid = c.mainPaid === 1;
                  const isPartial = !isPaid && (c.totalCleared > 0 || (Number(r.dac ?? r.DAC) || 0) > 0);
                  const pos = Number(r.principal_outstanding) || 0;
                  const emi = Number(r.emi_amt) || 0;
                  const ecs = Number(r.ecs ?? r.ECS) || 0;
                  const dac = Number(r.dac ?? r.DAC) || 0;
                  const aggrId = r.agreementid || r.agreement_no || r.AGREEMENTNO || r.AGREEMENTID || '-';
                  const rowBorder = getBucketRowBorder(r.bom_bkt);

                  return (
                    <tr 
                      key={r.id || idx} 
                      className={`hover:bg-muted/30 transition-colors ${rowBorder}`}
                    >
                      {/* Frozen Col 1: Checkbox */}
                      <td className={`sticky left-0 z-10 bg-card border-r border-border px-2.5 ${tdPad}`} onClick={(e) => e.stopPropagation()}>
                        <Checkbox 
                          checked={selectedCases.has(aggrId)}
                          onCheckedChange={(chk) => {
                            const n = new Set(selectedCases);
                            if (chk) n.add(aggrId); else n.delete(aggrId);
                            setSelectedCases(n);
                          }}
                        />
                      </td>

                      {/* Frozen Col 2: Aggr No */}
                      <td 
                        className={`sticky left-10 z-10 bg-card border-r border-border px-3 ${tdPad} font-mono font-bold text-primary cursor-pointer hover:underline`} 
                        onClick={() => handleRowClick(r)}
                      >
                        {aggrId}
                      </td>

                      {/* Frozen Col 3: Customer Name */}
                      <td 
                        className={`sticky left-[142px] z-10 bg-card border-r border-border px-3 ${tdPad} cursor-pointer group`} 
                        onClick={() => {
                          const rawName = r.customer_name || r.CUSTOMERNAME || r['Customer Name'] || r.CUSTOMER_NAME || r.customername || '';
                          const name = String(rawName).trim().toUpperCase();
                          if (name !== '-' && name !== '') {
                            const address = addressKey ? String(r[addressKey] || '').trim().toUpperCase() : '';
                            const contact = contactKey ? String(r[contactKey] || '').trim().toUpperCase() : '';
                            const fingerprint = `${name}||${contact}||${address}`;
                            
                            const stats = customerStats[fingerprint];
                            if (stats && stats.count > 1) {
                              const matched = baseRecords.filter((rec: any) => {
                                const rRawName = rec.customer_name || rec.CUSTOMERNAME || rec['Customer Name'] || rec.CUSTOMER_NAME || rec.customername || '';
                                const rName = String(rRawName).trim().toUpperCase();
                                const rAddr = addressKey ? String(rec[addressKey] || '').trim().toUpperCase() : '';
                                const rCont = contactKey ? String(rec[contactKey] || '').trim().toUpperCase() : '';
                                return `${rName}||${rCont}||${rAddr}` === fingerprint;
                              });
                              setMultiCaseModal({ name: name, records: matched });
                            } else {
                              handleRowClick(r);
                            }
                          }
                        }}
                      >
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                            {r.customer_name || r.CUSTOMERNAME || r['Customer Name'] || r.CUSTOMER_NAME || r.customername || '-'}
                          </span>
                          {(() => {
                            const rawName = r.customer_name || r.CUSTOMERNAME || r['Customer Name'] || r.CUSTOMER_NAME || r.customername || '';
                            const name = String(rawName).trim().toUpperCase();
                            const address = addressKey ? String(r[addressKey] || '').trim().toUpperCase() : '';
                            const contact = contactKey ? String(r[contactKey] || '').trim().toUpperCase() : '';
                            const fingerprint = `${name}||${contact}||${address}`;
                            
                            const stats = customerStats[fingerprint];
                            if (stats && stats.count > 1) {
                              return (
                                <span className="text-[9px] font-bold text-muted-foreground mt-0.5 bg-muted/60 px-1 py-0.2 rounded w-fit group-hover:bg-primary/10 group-hover:text-primary transition-colors" title="Multiple cases linked to this customer">
                                  {stats.count} CASES • {fmtCur(stats.totalPos)}
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </td>

                      {/* Bucket */}
                      <td className={`px-2.5 ${tdPad}`}>
                        <BucketBadge bkt={r.bom_bkt} />
                      </td>

                      {/* State */}
                      <td className={`px-2.5 ${tdPad} text-muted-foreground font-medium`}>
                        {r.state || r.State || '-'}
                      </td>

                      {/* City */}
                      <td className={`px-2.5 ${tdPad} text-muted-foreground font-medium`}>
                        {r.city || r.City || '-'}
                      </td>

                      {/* Executive */}
                      <td className={`px-2.5 ${tdPad} text-muted-foreground font-medium`}>
                        {r.executive_name || r['Executive Name'] || '-'}
                      </td>

                      {/* POS (Right aligned, Mono) */}
                      <td className={`px-3 ${tdPad} text-right font-mono font-bold text-foreground`}>
                        <div>{fmtCur(pos)}</div>
                        {density === 'detailed' && (
                          <div className="flex items-center justify-end gap-1 mt-0.5">
                            {pos >= 50000 && (
                              <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1 py-0.2 rounded">
                                High POS
                              </span>
                            )}
                            {dac > 0 && (
                              <span className="text-[9px] font-bold text-sky-600 dark:text-sky-400 bg-sky-500/10 px-1 py-0.2 rounded">
                                Rec: {((dac / (pos || 1)) * 100).toFixed(0)}%
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* EMI (Right aligned, Mono) */}
                      <td className={`px-3 ${tdPad} text-right font-mono text-muted-foreground`}>
                        <div className="font-semibold text-foreground">{fmtCur(emi)}</div>
                        {density === 'detailed' && (
                          <div className="mt-0.5">
                            {ecs > 0 ? (
                              ecs >= emi ? (
                                <span className="inline-flex items-center text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded">
                                  ECS Full ({fmtCur(ecs)})
                                </span>
                              ) : (
                                <span className="inline-flex items-center text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1 py-0.2 rounded">
                                  ECS Part ({fmtCur(ecs)})
                                </span>
                              )
                            ) : (
                              <span className="inline-flex items-center text-[9px] font-medium text-muted-foreground bg-muted/60 px-1 py-0.2 rounded">
                                No ECS
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* ECS (Right aligned, Mono) */}
                      <td className={`px-3 ${tdPad} text-right font-mono text-muted-foreground`}>
                        {fmtCur(ecs)}
                      </td>

                      {/* DAC (Right aligned, Mono, Info) */}
                      <td className={`px-3 ${tdPad} text-right font-mono font-bold text-sky-600 dark:text-sky-400`}>
                        {fmtCur(dac)}
                      </td>

                      {/* Status */}
                      <td className={`px-3 ${tdPad} text-right`}>
                        <div className="flex flex-col items-end">
                          <StatusBadge isPaid={isPaid} isPartial={isPartial} />
                          {density === 'detailed' && (
                            <span className={`text-[9px] font-medium mt-0.5 ${isPaid ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                              {isPaid ? '100% Cleared' : `Bucket ${r.bom_bkt || '-'} Pending`}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Extra Dynamic Columns */}
                      {(visibleExtraColumns || []).filter(col => allExtraKeys.includes(col)).map(col => (
                        <td key={col} className={`px-3 ${tdPad} text-muted-foreground text-xs`}>
                          {r[col] !== undefined && r[col] !== null ? String(r[col]) : '-'}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* 7. Pagination & Page Size Control */}
        <div className="p-3 border-t border-border bg-muted/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              Showing <span className="font-mono font-bold text-foreground">{sortedRecords.length > 0 ? (page - 1) * itemsPerPage + 1 : 0}</span> to <span className="font-mono font-bold text-foreground">{Math.min(page * itemsPerPage, sortedRecords.length)}</span> of <span className="font-mono font-bold text-foreground">{sortedRecords.length}</span> rows
            </span>

            <div className="flex items-center gap-1.5 ml-2">
              <span className="text-[11px] font-medium">Per page:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  const size = Number(e.target.value);
                  setItemsPerPage(size);
                  localStorage.setItem('dataExplorerPageSize', size.toString());
                  setPage(1);
                }}
                className="h-7 rounded border border-border bg-card px-1.5 text-xs font-semibold outline-none focus:border-primary"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button 
              disabled={page === 1} 
              onClick={() => setPage(1)} 
              className="p-1 rounded border border-border bg-card hover:bg-muted disabled:opacity-40 transition-colors"
              title="First Page"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button 
              disabled={page === 1} 
              onClick={() => setPage(p => p - 1)} 
              className="px-2.5 py-1 text-xs font-semibold border border-border bg-card hover:bg-muted disabled:opacity-40 rounded transition-colors"
            >
              Prev
            </button>

            {/* Page indicator */}
            <span className="px-2 text-xs font-semibold text-foreground">
              Page {page} of {totalPages}
            </span>

            <button 
              disabled={page === totalPages} 
              onClick={() => setPage(p => p + 1)} 
              className="px-2.5 py-1 text-xs font-semibold border border-border bg-card hover:bg-muted disabled:opacity-40 rounded transition-colors"
            >
              Next
            </button>
            <button 
              disabled={page === totalPages} 
              onClick={() => setPage(totalPages)} 
              className="p-1 rounded border border-border bg-card hover:bg-muted disabled:opacity-40 transition-colors"
              title="Last Page"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 8. Multi-Case Modal for Customer Drilldown */}
      <MultiCaseModal
        data={multiCaseModal}
        onClose={() => setMultiCaseModal(null)}
        onSelectRecord={(r) => handleRowClick(r)}
      />
    </AppLayout>
  );
}
