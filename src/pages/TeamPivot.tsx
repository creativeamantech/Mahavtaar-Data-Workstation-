import React, { useState, useMemo } from 'react';
import { AppLayout } from '../components/layout/AppLayout';
import { useData } from '../contexts/DataContext';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { buildTeamPivot } from '../lib/pivots';
import { fmtCur, fmtPct, pctColor } from '../lib/formatters';
import { exportTeamPivot } from '../lib/exporter';
import {
  Download,
  Plus,
  Search,
  ArrowUp,
  ArrowDown,
  X,
  Users,
  ChevronDown,
  ChevronRight,
  SlidersHorizontal,
} from 'lucide-react';
import { Checkbox } from '../components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { HeatBar } from '../components/ui/HeatBar';
import { BucketFilter, FloatingBucketFilter } from '../components/BucketFilter';
import { PivotColumn, PivotDensity } from '../components/ui/EnterprisePivotTable';

export default function TeamPivot() {
  const navigate = useNavigate();
  const { records, targets, isLoading, globalBucket } = useData();
  const { user, isExecutive, users } = useAuth();

  const [filterText, setFilterText] = useState('');
  const [sortSearch, setSortSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [density, setDensity] = useState<PivotDensity>('comfortable');

  const navigateToExplorer = (filters: { executive?: string; bucket?: string; paid?: string }) => {
    const params = new URLSearchParams();
    if (globalBucket !== 'ALL') params.set('bucket', globalBucket);
    if (filters.bucket) params.set('bucket', filters.bucket);
    if (filters.executive) params.set('exec', filters.executive);
    if (filters.paid) params.set('paid', filters.paid);
    navigate(`/explorer?${params.toString()}`);
  };

  const filtered = useMemo(() => {
    if (isExecutive() && user) return records.filter(r => r.executive_name === user.name);
    return records;
  }, [records, user, isExecutive]);

  // Build raw team pivot using verified core calculation
  const rawTeamData = useMemo(() => {
    const data = buildTeamPivot(filtered, targets);
    
    // Add executives from User Management who have 0 assigned cases
    if (!isExecutive()) {
      const existingExecs = new Set(data.map((d: any) => d.exec));
      users.forEach(u => {
        if (u.role === 'EXECUTIVE' && !existingExecs.has(u.name)) {
          data.push({
            bkt: '-',
            exec: u.name,
            collection: 0, count: 0, totalPOS: 0, paid: 0, paidPOS: 0,
            posPaidOnlyCount: 0, posPaidOnlyPOS: 0, targetPOS: 0, cases: [],
            pct: 0, target: 0, dailyRequiredPOS: 0
          });
        }
      });
    }
    
    return data;
  }, [filtered, targets, isExecutive, users]);
  
  // Filtered & sorted data
  const teamData = useMemo(() => {
    let data = [...rawTeamData];
    
    if (filterText) {
      data = data.filter(d => d.exec.toLowerCase().includes(filterText.toLowerCase()));
    }
    
    if (sortConfig.length > 0) {
      data.sort((a: any, b: any) => {
        for (const sort of sortConfig) {
          let valA = a[sort.key];
          let valB = b[sort.key];
          
          if (sort.key === 'pct') {
            valA = a.totalPOS ? a.paidPOS / a.totalPOS : 0;
            valB = b.totalPOS ? b.paidPOS / b.totalPOS : 0;
          }

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
    }
    
    return data;
  }, [rawTeamData, filterText, sortConfig]);

  // Compute global rank
  const execTotalsForRank = useMemo(() => {
    const map: Record<string, { totalPOS: number; paidPOS: number }> = {};
    rawTeamData.forEach((d: any) => {
      if (!map[d.exec]) map[d.exec] = { totalPOS: 0, paidPOS: 0 };
      map[d.exec].totalPOS += (d.totalPOS || 0);
      map[d.exec].paidPOS  += (d.paidPOS  || 0);
    });
    return Object.entries(map)
      .map(([exec, s]) => ({ exec, pct: s.totalPOS > 0 ? s.paidPOS / s.totalPOS : 0, paidPOS: s.paidPOS }))
      .sort((a, b) => b.pct !== a.pct ? b.pct - a.pct : b.paidPOS - a.paidPOS)
      .reduce((acc, cur, idx) => { acc[cur.exec] = idx + 1; return acc; }, {} as Record<string, number>);
  }, [rawTeamData]);

  // Group by bucket
  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    teamData.forEach((item: any) => {
      const b = String(item.bkt || '-');
      if (!map[b]) map[b] = [];
      map[b].push({
        ...item,
        globalRank: execTotalsForRank[item.exec] ?? 999
      });
    });
    return Object.entries(map).sort(([a], [b]) => {
      const na = Number(a); const nb = Number(b);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });
  }, [teamData, execTotalsForRank]);

  // Grand totals
  const grandTotal = useMemo(() => {
    return rawTeamData.reduce(
      (acc: any, cur: any) => ({
        collection:       acc.collection       + (cur.collection       || 0),
        count:            acc.count            + (cur.count            || 0),
        paid:             acc.paid             + (cur.paid             || 0),
        totalPOS:         acc.totalPOS         + (cur.totalPOS         || 0),
        paidPOS:          acc.paidPOS          + (cur.paidPOS          || 0),
        posPaidOnlyCount: acc.posPaidOnlyCount + (cur.posPaidOnlyCount || 0),
        posPaidOnlyPOS:   acc.posPaidOnlyPOS   + (cur.posPaidOnlyPOS   || 0),
        target:           acc.target           + (cur.target           || 0),
        dailyRequiredPOS: acc.dailyRequiredPOS + (cur.dailyRequiredPOS || 0),
      }),
      { collection: 0, count: 0, paid: 0, totalPOS: 0, paidPOS: 0, posPaidOnlyCount: 0, posPaidOnlyPOS: 0, target: 0, dailyRequiredPOS: 0 }
    );
  }, [rawTeamData]);

  const gPct = grandTotal.totalPOS ? grandTotal.paidPOS / grandTotal.totalPOS : 0;

  const toggleSort = (key: string) => {
    setSortConfig(prev => {
      const exists = prev.find(s => s.key === key);
      if (!exists) return [...prev, { key, direction: 'asc' }];
      if (exists.direction === 'asc') return prev.map(s => s.key === key ? { ...s, direction: 'desc' } : s);
      return prev.filter(s => s.key !== key);
    });
  };

  const toggleBucket = (bkt: string) => {
    setCollapsed(prev => ({ ...prev, [bkt]: !prev[bkt] }));
  };

  // Shared single source of truth for column definitions and fixed proportion metrics
  const columns: PivotColumn[] = useMemo(() => [
    {
      key: 'globalRank',
      label: '#',
      align: 'center',
      width: 48,
      minWidth: 48,
      stickyLeft: true,
      stickyLeftOffset: 0,
      headerClassName: 'text-center',
    },
    {
      key: 'exec',
      label: 'Executive Name',
      align: 'left',
      width: 190,
      minWidth: 190,
      stickyLeft: true,
      stickyLeftOffset: 48,
      headerClassName: 'shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]',
    },
    {
      key: 'collection',
      label: 'Collection (DAC)',
      align: 'right',
      width: 135,
      minWidth: 135,
    },
    {
      key: 'count',
      label: 'Total Count',
      align: 'right',
      width: 95,
      minWidth: 95,
    },
    {
      key: 'paid',
      label: 'Paid Count',
      align: 'right',
      width: 95,
      minWidth: 95,
    },
    {
      key: 'posPaidOnlyCount',
      label: 'POS Paid Only',
      align: 'right',
      width: 105,
      minWidth: 105,
    },
    {
      key: 'totalPOS',
      label: 'Total POS',
      align: 'right',
      width: 135,
      minWidth: 135,
    },
    {
      key: 'paidPOS',
      label: 'Paid POS',
      align: 'right',
      width: 135,
      minWidth: 135,
    },
    {
      key: 'target',
      label: 'Needed / DRR',
      align: 'right',
      width: 145,
      minWidth: 145,
    },
    {
      key: 'posPaidOnlyPOS',
      label: 'POS Paid Only POS',
      align: 'right',
      width: 135,
      minWidth: 135,
    },
    {
      key: 'pct',
      label: 'Recovery %',
      align: 'right',
      width: 140,
      minWidth: 140,
    },
  ], []);

  const cellPadding = {
    compact: 'px-2.5 py-1.5 text-[11px]',
    comfortable: 'px-3 py-2 text-xs',
    detailed: 'px-3.5 py-2.5 text-xs',
  }[density];

  return (
    <AppLayout>
      <div className="mb-3"><BucketFilter /></div>
      <div className="space-y-3 flex flex-col min-h-0">
        {/* Page Title & Controls Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-border">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" /> Team Performance Pivot Matrix
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Individual executive recovery pace, needed targets, and daily required run-rates
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Density Selector */}
            <div className="hidden sm:flex items-center bg-muted/50 p-0.5 rounded-lg border border-border">
              {(['compact', 'comfortable', 'detailed'] as PivotDensity[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setDensity(d)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md capitalize transition-colors ${
                    density === d
                      ? 'bg-card text-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>

            <button
              onClick={() => exportTeamPivot(teamData, targets)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-xs"
            >
              <Download className="h-3.5 w-3.5" /> Export Excel
            </button>
          </div>
        </div>

        {/* Executive Summary Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            { label: 'Total Assigned POS', value: fmtCur(grandTotal.totalPOS), sub: `${grandTotal.count.toLocaleString()} cases`, color: 'text-foreground' },
            { label: 'Total Recovered', value: fmtCur(grandTotal.paidPOS), sub: `${grandTotal.paid.toLocaleString()} accounts paid`, color: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'Needed Target', value: fmtCur(grandTotal.target), sub: `DRR: ₹${fmtCur(grandTotal.dailyRequiredPOS)}/day`, color: 'text-rose-600 dark:text-rose-400' },
            { label: 'Team Recovery', value: fmtPct(gPct), sub: `${users.filter(u => u.role === 'EXECUTIVE').length || 1} field executives`, color: pctColor(gPct) },
          ].map((card, i) => (
            <div key={i} className="bg-card border border-border/80 rounded-lg p-3 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">{card.label}</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className={`text-base sm:text-lg font-bold font-mono ${card.color}`}>{card.value}</span>
              </div>
              <span className="text-[11px] text-muted-foreground block mt-0.5 font-mono">{card.sub}</span>
            </div>
          ))}
        </div>

        {/* Search & Sort Pill Strip */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] max-w-sm flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search executive name..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary shadow-xs"
            />
            {filterText && (
              <button
                onClick={() => setFilterText('')}
                className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <button className="flex h-8 items-center gap-1.5 px-3 bg-card border border-border rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground shadow-xs">
                <Plus className="h-3.5 w-3.5" /> Add Column Sort
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="start">
              <div className="space-y-1">
                <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Select column to sort:</div>
                <input
                  type="text"
                  placeholder="Filter sort options..."
                  value={sortSearch}
                  onChange={(e) => setSortSearch(e.target.value)}
                  className="w-full px-2 py-1 text-xs border rounded bg-background mb-1"
                />
                {[
                  { key: 'globalRank', label: 'Rank' },
                  { key: 'exec', label: 'Executive' },
                  { key: 'collection', label: 'Collection' },
                  { key: 'count', label: 'Total Cases' },
                  { key: 'paid', label: 'Paid Cases' },
                  { key: 'posPaidOnlyCount', label: 'POS Paid Count' },
                  { key: 'totalPOS', label: 'Total POS' },
                  { key: 'paidPOS', label: 'Paid POS' },
                  { key: 'target', label: 'Target Needed' },
                  { key: 'posPaidOnlyPOS', label: 'POS Paid POS' },
                  { key: 'pct', label: 'Recovery %' },
                ]
                  .filter(opt => opt.label.toLowerCase().includes(sortSearch.toLowerCase()))
                  .map(opt => (
                    <div
                      key={opt.key}
                      className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded cursor-pointer text-xs"
                      onClick={() => toggleSort(opt.key)}
                    >
                      <Checkbox className="pointer-events-none" checked={!!sortConfig.find(s => s.key === opt.key)} />
                      <span>{opt.label}</span>
                    </div>
                  ))}
              </div>
            </PopoverContent>
          </Popover>

          {sortConfig.map(sort => {
            const labels: Record<string, string> = {
              globalRank: 'Rank', exec: 'Executive', collection: 'Collection', count: 'Count', paid: 'Paid',
              totalPOS: 'Total POS', paidPOS: 'Paid POS', pct: 'Total %', target: 'Needed',
              posPaidOnlyCount: 'POS Paid Count', posPaidOnlyPOS: 'POS Paid POS',
              dailyRequiredPOS: 'DRR'
            };
            return (
              <div key={sort.key} className="flex h-8 items-center gap-1.5 bg-primary/10 border border-primary/20 text-primary px-2.5 rounded-lg text-xs font-bold uppercase tracking-wider">
                <span>{labels[sort.key] || sort.key}</span>
                <button onClick={() => toggleSort(sort.key)} className="hover:opacity-75">
                  {sort.direction === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={() => setSortConfig(prev => prev.filter(s => s.key !== sort.key))}
                  className="ml-0.5 hover:text-rose-500"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Enterprise Data Grid Container with Guaranteed Zero-Overlap Single Scroller */}
        <div className="rounded-xl border border-border/80 bg-card shadow-xs flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="overflow-auto flex-1 min-h-[400px] max-h-[calc(100vh-270px)] scrollbar-thin">
            <table className="w-full table-fixed border-collapse font-sans min-w-[1360px]">
              {/* Strictly Aligned Column Width Mapping */}
              <colgroup>
                {columns.map((col) => (
                  <col key={col.key} style={{ width: col.width, minWidth: col.minWidth }} />
                ))}
              </colgroup>

              {/* Sticky Top Header */}
              <thead className="sticky top-0 z-30 bg-[#f8f9fc] dark:bg-[#0d0f14] shadow-[0_1px_3px_rgba(0,0,0,0.08)] border-b border-border">
                <tr>
                  {columns.map((col) => {
                    const active = sortConfig.find((s) => s.key === col.key);
                    const alignClass = col.align === 'right' ? 'text-right justify-end' : col.align === 'center' ? 'text-center justify-center' : 'text-left justify-start';
                    const stickyStyle: React.CSSProperties = col.stickyLeft
                      ? { position: 'sticky', left: col.stickyLeftOffset ?? 0, zIndex: 35 }
                      : {};

                    return (
                      <th
                        key={col.key}
                        style={stickyStyle}
                        onClick={() => toggleSort(col.key)}
                        className={`
                          px-3 py-2.5 select-none font-bold uppercase tracking-wider text-[11px]
                          border-b border-border transition-colors whitespace-nowrap bg-[#f8f9fc] dark:bg-[#0d0f14]
                          cursor-pointer hover:text-foreground
                          ${active ? 'text-primary bg-primary/5' : 'text-muted-foreground'}
                          ${col.headerClassName || ''}
                        `}
                      >
                        <div className={`inline-flex items-center gap-1.5 w-full ${alignClass}`}>
                          <span>{col.label}</span>
                          {active && (
                            active.direction === 'asc' ? (
                              <ArrowUp className="h-3 w-3 text-primary shrink-0" />
                            ) : (
                              <ArrowDown className="h-3 w-3 text-primary shrink-0" />
                            )
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, idx) => (
                    <tr key={`loading-${idx}`} className="border-b border-border/40 animate-pulse">
                      {columns.map((col) => (
                        <td key={col.key} className={cellPadding}>
                          <div className="h-4 bg-muted/60 rounded w-4/5 my-1" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : grouped.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-16 text-center text-muted-foreground text-sm">
                      <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                        <Users className="w-10 h-10 text-muted-foreground/50" />
                        <p className="font-semibold text-foreground">No matching executives found</p>
                        <p className="text-xs text-muted-foreground">
                          {filterText ? `No executive matching "${filterText}". Try clearing your search.` : 'No portfolio records in current bucket view.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  grouped.map(([bkt, items]) => {
                    const isCollapsed = !!collapsed[bkt];
                    const sub = {
                      collection: items.reduce((s: number, i: any) => s + (i.collection || 0), 0),
                      count: items.reduce((s: number, i: any) => s + (i.count || 0), 0),
                      paid: items.reduce((s: number, i: any) => s + (i.paid || 0), 0),
                      totalPOS: items.reduce((s: number, i: any) => s + (i.totalPOS || 0), 0),
                      paidPOS: items.reduce((s: number, i: any) => s + (i.paidPOS || 0), 0),
                      posPaidOnlyCount: items.reduce((s: number, i: any) => s + (i.posPaidOnlyCount || 0), 0),
                      posPaidOnlyPOS: items.reduce((s: number, i: any) => s + (i.posPaidOnlyPOS || 0), 0),
                      target: items.reduce((s: number, i: any) => s + (i.target || 0), 0),
                      dailyRequiredPOS: items.reduce((s: number, i: any) => s + (i.dailyRequiredPOS || 0), 0),
                    };
                    const subPct = sub.totalPOS ? sub.paidPOS / sub.totalPOS : 0;

                    return (
                      <React.Fragment key={bkt}>
                        {/* Bucket Section Header */}
                        <tr
                          onClick={() => toggleBucket(bkt)}
                          className="bg-muted/60 border-y border-border/80 cursor-pointer select-none hover:bg-muted/80 transition-colors"
                        >
                          <td
                            colSpan={11}
                            className="px-3 py-2 font-bold text-xs uppercase tracking-wider text-foreground"
                          >
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-2">
                                {isCollapsed ? <ChevronRight className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                                <span>BUCKET {bkt}</span>
                                <span className="text-[11px] font-normal text-muted-foreground font-mono">({items.length} executives · {sub.count.toLocaleString()} cases)</span>
                              </span>
                              <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                {fmtPct(subPct)} Recovery
                              </span>
                            </div>
                          </td>
                        </tr>

                        {/* Executive Rows */}
                        {!isCollapsed && items.map((item: any) => {
                          const rowPct = item.totalPOS ? item.paidPOS / item.totalPOS : 0;
                          const isAchieved = item.target <= 0;

                          return (
                            <tr
                              key={item.exec + '-' + bkt}
                              className="border-b border-border/40 hover:bg-muted/30 transition-colors group"
                            >
                              {/* Sticky Rank */}
                              <td
                                style={{ position: 'sticky', left: 0, zIndex: 10 }}
                                className={`${cellPadding} text-center font-mono text-muted-foreground bg-card group-hover:bg-muted/30 border-r border-border/30`}
                              >
                                {item.globalRank}
                              </td>

                              {/* Sticky Executive Name */}
                              <td
                                style={{ position: 'sticky', left: 48, zIndex: 10 }}
                                className={`${cellPadding} font-semibold text-foreground bg-card group-hover:bg-muted/30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] border-r border-border/40`}
                              >
                                <span
                                  onClick={() => navigateToExplorer({ executive: item.exec, bucket: bkt })}
                                  className="cursor-pointer hover:text-primary hover:underline"
                                >
                                  {item.exec}
                                </span>
                              </td>

                              {/* Metrics with Tabular Numbers */}
                              <td className={`${cellPadding} text-right font-mono font-semibold text-foreground`}>{fmtCur(item.collection)}</td>
                              <td className={`${cellPadding} text-right font-mono tabular-nums text-muted-foreground`}>{item.count.toLocaleString()}</td>
                              <td className={`${cellPadding} text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold`}>{item.paid.toLocaleString()}</td>
                              <td className={`${cellPadding} text-right font-mono tabular-nums text-blue-600 dark:text-blue-400`}>{item.posPaidOnlyCount}</td>
                              <td className={`${cellPadding} text-right font-mono tabular-nums text-foreground`}>{fmtCur(item.totalPOS)}</td>
                              <td className={`${cellPadding} text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-bold`}>{fmtCur(item.paidPOS)}</td>

                              {/* Target / DRR */}
                              <td className={`${cellPadding} text-right font-mono tabular-nums`}>
                                {isAchieved ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                    Achieved
                                  </span>
                                ) : (
                                  <div className="flex flex-col items-end">
                                    <span className="font-bold text-rose-600 dark:text-rose-400">{fmtCur(item.target)}</span>
                                    <span className="text-[10px] text-amber-600 dark:text-amber-400">DRR: ₹{fmtCur(item.dailyRequiredPOS || 0)}/d</span>
                                  </div>
                                )}
                              </td>

                              <td className={`${cellPadding} text-right font-mono tabular-nums text-muted-foreground`}>{fmtCur(item.posPaidOnlyPOS)}</td>

                              {/* Recovery % with inline HeatBar */}
                              <td className={`${cellPadding} text-right font-mono tabular-nums`}>
                                <HeatBar pct={rowPct} showBar={true} showBadge={false} />
                              </td>
                            </tr>
                          );
                        })}

                        {/* Bucket Subtotal Row */}
                        <tr className="bg-muted/40 font-bold border-b border-border/80">
                          <td style={{ position: 'sticky', left: 0, zIndex: 10 }} className="bg-muted/40" />
                          <td
                            style={{ position: 'sticky', left: 48, zIndex: 10 }}
                            className={`${cellPadding} font-bold text-xs uppercase tracking-wider text-muted-foreground bg-muted/40 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]`}
                          >
                            Bucket {bkt} Subtotal
                          </td>
                          <td className={`${cellPadding} text-right font-mono font-bold`}>{fmtCur(sub.collection)}</td>
                          <td className={`${cellPadding} text-right font-mono font-bold`}>{sub.count.toLocaleString()}</td>
                          <td className={`${cellPadding} text-right font-mono font-bold text-emerald-600 dark:text-emerald-400`}>{sub.paid.toLocaleString()}</td>
                          <td className={`${cellPadding} text-right font-mono font-bold text-blue-600 dark:text-blue-400`}>{sub.posPaidOnlyCount}</td>
                          <td className={`${cellPadding} text-right font-mono font-bold`}>{fmtCur(sub.totalPOS)}</td>
                          <td className={`${cellPadding} text-right font-mono font-bold text-emerald-600 dark:text-emerald-400`}>{fmtCur(sub.paidPOS)}</td>
                          <td className={`${cellPadding} text-right font-mono font-bold text-rose-600 dark:text-rose-400`}>{fmtCur(sub.target)}</td>
                          <td className={`${cellPadding} text-right font-mono font-bold text-muted-foreground`}>{fmtCur(sub.posPaidOnlyPOS)}</td>
                          <td className={`${cellPadding} text-right font-mono font-bold`}>
                            <HeatBar pct={subPct} showBar={true} showBadge={true} />
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>

              {/* Sticky Grand Total Footer with Exact 1:1 Column Alignment and Zero Row Overlap */}
              <tfoot className="sticky bottom-0 z-30 bg-slate-900 dark:bg-[#070910] text-white font-bold shadow-[0_-3px_10px_rgba(0,0,0,0.25)] border-t-2 border-primary/40">
                <tr>
                  <td style={{ position: 'sticky', left: 0, zIndex: 35 }} className="bg-slate-900 dark:bg-[#070910]" />
                  <td
                    style={{ position: 'sticky', left: 48, zIndex: 35 }}
                    className="px-3 py-3 font-extrabold uppercase text-xs tracking-wider text-primary bg-slate-900 dark:bg-[#070910] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)] cursor-pointer hover:underline"
                    onClick={() => navigateToExplorer({})}
                  >
                    Grand Total
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-emerald-400">{fmtCur(grandTotal.collection)}</td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-slate-200">{grandTotal.count.toLocaleString()}</td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-emerald-400">{grandTotal.paid.toLocaleString()}</td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-blue-400">{grandTotal.posPaidOnlyCount}</td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-slate-200">{fmtCur(grandTotal.totalPOS)}</td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-emerald-400">{fmtCur(grandTotal.paidPOS)}</td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-rose-400">
                    <div className="flex flex-col items-end">
                      <span>{fmtCur(grandTotal.target)}</span>
                      <span className="text-[10px] text-amber-300 font-mono">DRR: ₹{fmtCur(grandTotal.dailyRequiredPOS)}/d</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-slate-400">{fmtCur(grandTotal.posPaidOnlyPOS)}</td>
                  <td className="px-3 py-3 text-right font-mono font-bold">
                    <HeatBar pct={gPct} showBar={true} showBadge={true} />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
      <FloatingBucketFilter />
    </AppLayout>
  );
}
