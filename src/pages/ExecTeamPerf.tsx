import React, { useState, useMemo } from 'react';
import { AppLayout } from '../components/layout/AppLayout';
import { useData } from '../contexts/DataContext';
import { useNavigate } from 'react-router-dom';
import { buildExecCityPivot } from '../lib/pivots';
import { fmtCur, fmtPct, pctColor } from '../lib/formatters';
import { exportExecCityPivot } from '../lib/exporter';
import { Download, Plus, Search, ArrowUp, ArrowDown, X, Users } from 'lucide-react';
import { Checkbox } from '../components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { BucketFilter } from '../components/BucketFilter';
import { SectionHeader } from '../components/ui/SectionHeader';

export default function ExecTeamPerf() {
  const navigate = useNavigate();
  const { records, targets, isLoading, globalBucket } = useData();
  const [filterText, setFilterText] = useState('');
  const [sortSearch, setSortSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }[]>([]);

  const rawCityData = useMemo(() => buildExecCityPivot(records, targets), [records, targets]);

  const cityData = useMemo(() => {
    let data = [...rawCityData];
    if (filterText) {
      data = data.filter(d => d.city.toLowerCase().includes(filterText.toLowerCase()));
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
  }, [rawCityData, filterText, sortConfig]);

  const globalCityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    records.forEach(r => {
      const city = (r.city || r.City || 'UNKNOWN').trim().toUpperCase();
      counts[city] = (counts[city] || 0) + 1;
    });
    return counts;
  }, [records]);

  // Group by bucket
  const grouped = useMemo(() => {
    const groups: Record<number, any[]> = {};
    cityData.forEach(t => {
      if (!groups[t.bkt]) groups[t.bkt] = [];
      groups[t.bkt].push(t);
    });

    return Object.entries(groups)
      .map(([bkt, items]) => {
        const sorted = sortConfig.length > 0 ? items : [...items].sort((a, b) => b.count - a.count);
        const bucketSortedItems = [...items].sort((a, b) => b.count - a.count);
        const getBucketRank = (name: string) => bucketSortedItems.findIndex(i => i.city === name) + 1;
        const itemsWithRank = sorted.map(item => ({ ...item, globalRank: getBucketRank(item.city) }));

        return [bkt, itemsWithRank] as [string, any[]];
      })
      .sort(([a], [b]) => Number(a) - Number(b));
  }, [cityData, sortConfig]);

  const grandTotal = useMemo(
    () => ({
      collection: cityData.reduce((s, t) => s + t.collection, 0),
      count: cityData.reduce((s, t) => s + t.count, 0),
      paid: cityData.reduce((s, t) => s + t.paid, 0),
      totalPOS: cityData.reduce((s, t) => s + t.totalPOS, 0),
      paidPOS: cityData.reduce((s, t) => s + t.paidPOS, 0),
      posPaidOnlyCount: cityData.reduce((s, t) => s + t.posPaidOnlyCount, 0),
      posPaidOnlyPOS: cityData.reduce((s, t) => s + t.posPaidOnlyPOS, 0),
      target: cityData.reduce((s, t) => s + t.target, 0),
      dailyRequiredPOS: cityData.reduce((s, t) => s + (t.dailyRequiredPOS || 0), 0),
    }),
    [cityData]
  );

  const navigateToExplorer = (filters: { executive?: string; city?: string; bucket?: string; paid?: string }) => {
    const params = new URLSearchParams();
    if (globalBucket !== 'ALL') params.set('bucket', globalBucket);
    if (filters.bucket) params.set('bucket', filters.bucket);
    if (filters.executive) params.set('exec', filters.executive);
    if (filters.city) params.set('city', filters.city);
    if (filters.paid) params.set('paid', filters.paid);
    navigate(`/explorer?${params.toString()}`);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="mb-4"><BucketFilter /></div>
        <div className="flex h-[50vh] items-center justify-center text-muted-foreground animate-pulse font-medium">
          Loading team performance matrix...
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <SectionHeader
        title="Team & Location Performance Matrix"
        subtitle="Granular bucket-by-location recovery, daily run rates, and clearance metrics"
        icon={Users}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportExecCityPivot(rawCityData)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 shadow-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Matrix</span>
            </button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card border border-border/80 rounded-xl p-4 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Total POS</div>
          <div className="text-2xl font-extrabold font-tabular text-foreground">{fmtCur(grandTotal.totalPOS)}</div>
        </div>
        <div className="bg-card border border-border/80 rounded-xl p-4 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Paid POS</div>
          <div className="text-2xl font-extrabold font-tabular text-emerald-600 dark:text-emerald-400">{fmtCur(grandTotal.paidPOS)}</div>
        </div>
        <div className="bg-card border border-border/80 rounded-xl p-4 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Needed POS</div>
          <div className="text-2xl font-extrabold font-tabular text-rose-600 dark:text-rose-400">{fmtCur(grandTotal.target)}</div>
        </div>
        <div className="bg-card border border-border/80 rounded-xl p-4 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Recovery %</div>
          <div className="text-2xl font-extrabold font-tabular text-primary">
            {fmtPct(grandTotal.totalPOS ? grandTotal.paidPOS / grandTotal.totalPOS : 0)}
          </div>
        </div>
      </div>

      {/* Filters Strip */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter location..."
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
              className="pl-8 pr-3 py-1.5 h-8 text-xs bg-card border border-border rounded-lg outline-none focus:border-primary w-48 shadow-2xs font-medium"
            />
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <button className="flex h-8 items-center gap-1.5 px-3 rounded-lg border border-dashed border-border hover:bg-muted text-xs font-bold text-muted-foreground uppercase tracking-wider bg-card shadow-2xs">
                <Plus className="h-3.5 w-3.5" /> Add Sort
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-3" align="start">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Sort By Column</h4>
              <div className="relative mb-2">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search columns..."
                  className="w-full pl-6 pr-2 py-1 text-xs border border-border rounded bg-muted/20 outline-none focus:border-primary transition-colors"
                  value={sortSearch}
                  onChange={e => setSortSearch(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1 max-h-56 overflow-y-auto scrollbar-thin pr-1">
                {[
                  { key: 'city', label: 'Location' },
                  { key: 'collection', label: 'Collection' },
                  { key: 'count', label: 'Total Count' },
                  { key: 'paid', label: 'Paid Count' },
                  { key: 'posPaidOnlyCount', label: 'POS Paid Only Count' },
                  { key: 'totalPOS', label: 'Total POS' },
                  { key: 'paidPOS', label: 'Paid POS' },
                  { key: 'target', label: 'Needed POS' },
                  { key: 'dailyRequiredPOS', label: 'Daily Required POS' },
                  { key: 'posPaidOnlyPOS', label: 'POS Paid Only POS' },
                  { key: 'pct', label: 'Total %' },
                ]
                  .filter(opt => opt.label.toLowerCase().includes(sortSearch.toLowerCase()))
                  .map(opt => (
                    <div
                      key={opt.key}
                      className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded transition-colors cursor-pointer text-xs"
                      onClick={() => {
                        setSortConfig(prev => {
                          const exists = prev.find(s => s.key === opt.key);
                          if (exists) return prev.filter(s => s.key !== opt.key);
                          return [...prev, { key: opt.key, direction: 'asc' }];
                        });
                      }}
                    >
                      <Checkbox className="pointer-events-none" checked={!!sortConfig.find(s => s.key === opt.key)} />
                      <span>{opt.label}</span>
                    </div>
                  ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Active sort badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {sortConfig.map(s => (
            <div
              key={s.key}
              className="inline-flex items-center gap-1 text-[11px] font-semibold bg-muted px-2 py-1 rounded-md border border-border"
            >
              <span className="capitalize">{s.key}</span>
              <button
                onClick={() =>
                  setSortConfig(prev =>
                    prev.map(item => (item.key === s.key ? { ...item, direction: item.direction === 'asc' ? 'desc' : 'asc' } : item))
                  )
                }
              >
                {s.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
              </button>
              <button
                onClick={() => setSortConfig(prev => prev.filter(item => item.key !== s.key))}
                className="hover:text-destructive ml-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-280px)] scrollbar-thin">
          <table className="w-full text-xs text-left whitespace-nowrap">
            <colgroup>
              <col className="w-12" />
              <col className="w-48" />
              <col className="w-28" />
              <col className="w-24" />
              <col className="w-24" />
              <col className="w-28" />
              <col className="w-32" />
              <col className="w-32" />
              <col className="w-32" />
              <col className="w-28" />
              <col className="w-28" />
              <col className="w-32" />
              <col className="w-24" />
            </colgroup>
            <thead className="sticky top-0 z-30 bg-muted/80 backdrop-blur-xs border-b border-border shadow-xs text-muted-foreground uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-3 py-2.5 text-center font-bold">Rank</th>
                <th className="px-3 py-2.5 font-bold">Bucket / Location</th>
                <th className="px-3 py-2.5 text-right font-bold">Collection</th>
                <th className="px-3 py-2.5 text-right font-bold">Total Count</th>
                <th className="px-3 py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">Paid Count</th>
                <th className="px-3 py-2.5 text-right font-bold">POS Paid Only</th>
                <th className="px-3 py-2.5 text-right font-bold">Total POS</th>
                <th className="px-3 py-2.5 text-right font-bold">Paid POS</th>
                <th className="px-3 py-2.5 text-right font-bold">Needed POS</th>
                <th className="px-3 py-2.5 text-right font-bold">Target Date</th>
                <th className="px-3 py-2.5 text-right font-bold text-amber-600 dark:text-amber-400">DRR</th>
                <th className="px-3 py-2.5 text-right font-bold">POS Paid Only Amt</th>
                <th className="px-3 py-2.5 text-right font-bold">Total %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {grouped.map(([bkt, items]) => {
                const sub = {
                  collection: items.reduce((s: number, i: any) => s + i.collection, 0),
                  count: items.reduce((s: number, i: any) => s + i.count, 0),
                  paid: items.reduce((s: number, i: any) => s + i.paid, 0),
                  totalPOS: items.reduce((s: number, i: any) => s + i.totalPOS, 0),
                  paidPOS: items.reduce((s: number, i: any) => s + i.paidPOS, 0),
                  posPaidOnlyCount: items.reduce((s: number, i: any) => s + i.posPaidOnlyCount, 0),
                  posPaidOnlyPOS: items.reduce((s: number, i: any) => s + i.posPaidOnlyPOS, 0),
                  target: items.reduce((s: number, i: any) => s + i.target, 0),
                  dailyRequiredPOS: items.reduce((s: number, i: any) => s + (i.dailyRequiredPOS || 0), 0),
                };
                const subPct = sub.totalPOS ? sub.paidPOS / sub.totalPOS : 0;

                return (
                  <React.Fragment key={bkt}>
                    <tr className="bg-primary/10 border-b border-border">
                      <td colSpan={13} className="px-3 py-2 font-sans text-[11px] font-bold text-primary uppercase tracking-wider">
                        BUCKET {bkt}
                      </td>
                    </tr>
                    {items.map((item: any) => (
                      <tr key={item.city} className="hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-2 text-center font-bold text-muted-foreground font-tabular">{item.globalRank}</td>
                        <td
                          className="px-3 py-2 font-medium text-foreground hover:text-primary cursor-pointer hover:underline"
                          onClick={() => navigateToExplorer({ city: item.city, bucket: bkt })}
                        >
                          {item.city}
                        </td>
                        <td className="px-3 py-2 text-right font-tabular font-semibold text-primary">{fmtCur(item.collection)}</td>
                        <td className="px-3 py-2 text-right font-tabular">{item.count}</td>
                        <td className="px-3 py-2 text-right font-tabular font-semibold text-emerald-600 dark:text-emerald-400">{item.paid}</td>
                        <td className="px-3 py-2 text-right font-tabular text-blue-600 dark:text-blue-400">{item.posPaidOnlyCount}</td>
                        <td className="px-3 py-2 text-right font-tabular font-medium">{fmtCur(item.totalPOS)}</td>
                        <td className="px-3 py-2 text-right font-tabular">{fmtCur(item.paidPOS)}</td>
                        <td className="px-3 py-2 text-right font-tabular">
                          {item.target <= 0 ? (
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Achieved</span>
                          ) : (
                            <span className="text-rose-600 dark:text-rose-400 font-bold">{fmtCur(item.target)}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-[11px] text-muted-foreground">{item.targetDate || '—'}</td>
                        <td className="px-3 py-2 text-right font-tabular font-bold text-amber-600 dark:text-amber-400">{fmtCur(item.dailyRequiredPOS || 0)}</td>
                        <td className="px-3 py-2 text-right font-tabular text-blue-600 dark:text-blue-400">{fmtCur(item.posPaidOnlyPOS)}</td>
                        <td className={`px-3 py-2 text-right font-tabular font-bold ${pctColor(item.pct)}`}>{fmtPct(item.pct)}</td>
                      </tr>
                    ))}
                    <tr className="bg-muted/40 font-semibold border-b border-border">
                      <td className="px-3 py-2 text-center"></td>
                      <td className="px-3 py-2 text-muted-foreground uppercase text-[11px]">Bucket {bkt} Total</td>
                      <td className="px-3 py-2 text-right font-tabular text-primary">{fmtCur(sub.collection)}</td>
                      <td className="px-3 py-2 text-right font-tabular">{sub.count}</td>
                      <td className="px-3 py-2 text-right font-tabular text-emerald-600 dark:text-emerald-400">{sub.paid}</td>
                      <td className="px-3 py-2 text-right font-tabular text-blue-600 dark:text-blue-400">{sub.posPaidOnlyCount}</td>
                      <td className="px-3 py-2 text-right font-tabular">{fmtCur(sub.totalPOS)}</td>
                      <td className="px-3 py-2 text-right font-tabular">{fmtCur(sub.paidPOS)}</td>
                      <td className="px-3 py-2 text-right font-tabular">
                        {sub.target <= 0 ? (
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Achieved</span>
                        ) : (
                          <span className="text-rose-600 dark:text-rose-400 font-bold">{fmtCur(sub.target)}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground">—</td>
                      <td className="px-3 py-2 text-right font-tabular font-bold text-amber-600 dark:text-amber-400">{fmtCur(sub.dailyRequiredPOS)}</td>
                      <td className="px-3 py-2 text-right font-tabular text-blue-600 dark:text-blue-400">{fmtCur(sub.posPaidOnlyPOS)}</td>
                      <td className={`px-3 py-2 text-right font-tabular font-bold ${pctColor(subPct)}`}>{fmtPct(subPct)}</td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot className="sticky bottom-0 z-20 bg-muted/90 backdrop-blur-xs font-bold border-t border-border shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
              <tr>
                <td className="px-3 py-2.5 text-center"></td>
                <td className="px-3 py-2.5 uppercase text-primary text-[11px]">Grand Total</td>
                <td className="px-3 py-2.5 text-right font-tabular text-primary">{fmtCur(grandTotal.collection)}</td>
                <td className="px-3 py-2.5 text-right font-tabular">{grandTotal.count}</td>
                <td className="px-3 py-2.5 text-right font-tabular text-emerald-600 dark:text-emerald-400">{grandTotal.paid}</td>
                <td className="px-3 py-2.5 text-right font-tabular text-blue-600 dark:text-blue-400">{grandTotal.posPaidOnlyCount}</td>
                <td className="px-3 py-2.5 text-right font-tabular">{fmtCur(grandTotal.totalPOS)}</td>
                <td className="px-3 py-2.5 text-right font-tabular">{fmtCur(grandTotal.paidPOS)}</td>
                <td className="px-3 py-2.5 text-right font-tabular">
                  {grandTotal.target <= 0 ? (
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Achieved</span>
                  ) : (
                    <span className="text-rose-600 dark:text-rose-400 font-bold">{fmtCur(grandTotal.target)}</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right text-muted-foreground">—</td>
                <td className="px-3 py-2.5 text-right font-tabular font-bold text-amber-600 dark:text-amber-400">{fmtCur(grandTotal.dailyRequiredPOS)}</td>
                <td className="px-3 py-2.5 text-right font-tabular text-blue-600 dark:text-blue-400">{fmtCur(grandTotal.posPaidOnlyPOS)}</td>
                <td className={`px-3 py-2.5 text-right font-tabular font-bold ${pctColor(grandTotal.totalPOS ? grandTotal.paidPOS / grandTotal.totalPOS : 0)}`}>
                  {fmtPct(grandTotal.totalPOS ? grandTotal.paidPOS / grandTotal.totalPOS : 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
