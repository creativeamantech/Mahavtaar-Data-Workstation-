import { Fragment, useState, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { useMediaQuery } from '../hooks/use-media-query';
import { calculateRow } from '../lib/calculations';
import { buildExecCityPivot } from '../lib/pivots';
import { fmtCur, fmtPct, pctColor } from '../lib/formatters';
import { DollarSign, AlertCircle, Database, BarChart3, TrendingUp, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ComposedChart, Line } from 'recharts';
import { AgentLiveDashboard } from '../components/agent/AgentLiveDashboard';
import { BucketFilter } from '../components/BucketFilter';

export default function ExecDashboard() {
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  
  const handleCellClick = (city: string, band: string) => {
    setSelectedCells(prev => {
      const next = new Set(prev);
      const id = `${city}:::${band}`;
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  
  const { records, isLoading, globalBucket, targets } = useData();

  const filteredRecords = useMemo(() => {
    if (!records) return [];
    if (globalBucket === 'ALL') return records;
    return records.filter((r: any) => String(r.bom_bkt).trim().toUpperCase() === globalBucket);
  }, [records, globalBucket]);
  const teamPerfData = useMemo(() => buildExecCityPivot(filteredRecords, targets), [filteredRecords, targets]);
  const teamPerfGrouped = useMemo(() => {
    const groups: Record<number, any[]> = {};
    teamPerfData.forEach(t => {
      if (!groups[t.bkt]) groups[t.bkt] = [];
      groups[t.bkt].push(t);
    });
    return Object.entries(groups).map(([bkt, items]) => [Number(bkt), items.sort((a: any, b: any) => b.collection - a.collection)] as const).sort((a, b) => a[0] - b[0]);
  }, [teamPerfData]);
  const teamPerfGrandTotal = useMemo(() => {
    return {
      collection: teamPerfData.reduce((s, i) => s + i.collection, 0),
      count: teamPerfData.reduce((s, i) => s + i.count, 0),
      paid: teamPerfData.reduce((s, i) => s + i.paid, 0),
      totalPOS: teamPerfData.reduce((s, i) => s + i.totalPOS, 0),
      paidPOS: teamPerfData.reduce((s, i) => s + i.paidPOS, 0),
      posPaidOnlyCount: teamPerfData.reduce((s, i) => s + i.posPaidOnlyCount, 0),
      posPaidOnlyPOS: teamPerfData.reduce((s, i) => s + i.posPaidOnlyPOS, 0),
      target: teamPerfData.reduce((s, i) => s + i.target, 0),
      dailyRequiredPOS: teamPerfData.reduce((s, i) => s + (i.dailyRequiredPOS || 0), 0),
    };
  }, [teamPerfData]);

  const stats = useMemo(() => {
    let totalCollection = 0;
    let teamPaidPosSum = 0;
    let posPaidOnlyPosSum = 0;
    
    const byBucket: Record<string, any> = {};
    const byCity: Record<string, any> = {};
    
    let smallCasesEMI = 0;
    let smallCasesPOS = 0;
    let totalSmallCases = 0;
    let smallCasesBoth = 0;
    
    filteredRecords.forEach((row: any) => {
        const c = calculateRow(row);
        const bucket = String(row.bom_bkt || 'Unknown').trim();
        const city = String(row.city || row.City || 'Unknown').trim().toUpperCase();
        const dac = Number(row.dac ?? row.DAC) || 0;
        const pos = Number(row.principal_outstanding) || 0;
        const emi = Number(row.emi_amt) || 0;

        const isTeamPaid = c.teamPaid === 1;
        const isPosPaidOnly = (c.posCleared <= 0 && c.teamPaid !== 1);
        
        if (isTeamPaid || isPosPaidOnly) totalCollection += dac;
        if (isTeamPaid) teamPaidPosSum += pos;
        if (isPosPaidOnly) posPaidOnlyPosSum += pos;
        
        if (emi < 500) smallCasesEMI++;
        if (pos < 1000) smallCasesPOS++;
        if (emi < 500 || pos < 1000) {
            totalSmallCases++;
            if (emi < 500 && pos < 1000) smallCasesBoth++;
        }
        
        if (!byBucket[bucket]) byBucket[bucket] = { collection: 0, cases: 0, pos: 0, teamPaid: 0, posPaidOnly: 0, unpaid: 0, paidPOS: 0, posPaidOnlyPOS: 0, unpaidPOS: 0 };
        byBucket[bucket].cases++;
        byBucket[bucket].pos += pos;
        
        if (isTeamPaid) {
            byBucket[bucket].collection += dac;
            byBucket[bucket].teamPaid++;
            byBucket[bucket].paidPOS += pos;
        } else if (isPosPaidOnly) {
            byBucket[bucket].collection += dac;
            byBucket[bucket].posPaidOnly++;
            byBucket[bucket].posPaidOnlyPOS += pos;
        } else {
            byBucket[bucket].unpaid++;
            byBucket[bucket].unpaidPOS += pos;
        }
        
        if (!byCity[city]) {
            byCity[city] = { 
                cases: 0, pos: 0, teamPaid: 0, posPaidOnly: 0, unpaid: 0, 
                paidPOS: 0, posPaidOnlyPOS: 0, unpaidPOS: 0,
                buckets: {} as Record<string, any>, 
                bands: {} as Record<string, { cases: number, pos: number }> 
            };
        }
        byCity[city].cases++;
        byCity[city].pos += pos;
        
        if (isTeamPaid) {
            byCity[city].teamPaid++;
            byCity[city].paidPOS += pos;
        } else if (isPosPaidOnly) {
            byCity[city].posPaidOnly++;
            byCity[city].posPaidOnlyPOS += pos;
        } else {
            byCity[city].unpaid++;
            byCity[city].unpaidPOS += pos;
        }
        
        if (!byCity[city].buckets[bucket]) byCity[city].buckets[bucket] = { teamPaid: 0, posPaidOnly: 0, unpaid: 0, paidPOS: 0, posPaidOnlyPOS: 0, unpaidPOS: 0 };
        if (isTeamPaid) {
            byCity[city].buckets[bucket].teamPaid++;
            byCity[city].buckets[bucket].paidPOS += pos;
        } else if (isPosPaidOnly) {
            byCity[city].buckets[bucket].posPaidOnly++;
            byCity[city].buckets[bucket].posPaidOnlyPOS += pos;
        } else {
            byCity[city].buckets[bucket].unpaid++;
            byCity[city].buckets[bucket].unpaidPOS += pos;
        }
        
        let band = '< 1k';
        if (pos >= 1000 && pos < 10000) {
            const lower = Math.floor(pos / 1000);
            band = `${lower}k-${lower + 1}k`;
        } else if (pos >= 10000) {
            const lower = Math.floor(pos / 5000) * 5;
            band = `${lower}k-${lower + 5}k`;
        }
        if (!byCity[city].bands[band]) byCity[city].bands[band] = { cases: 0, pos: 0 };
        byCity[city].bands[band].cases++;
        byCity[city].bands[band].pos += pos;
    });
    
    const bucketData = Object.keys(byBucket).map(k => ({ bucket: k, ...byBucket[k] })).sort((a,b) => a.bucket.localeCompare(b.bucket));
    const cityData = Object.keys(byCity).map(k => ({ city: k, ...byCity[k] })).sort((a,b) => b.cases !== a.cases ? b.cases - a.cases : b.pos - a.pos);

    const allBands = new Set<string>();
    filteredRecords.forEach((row: any) => {
        const pos = Number(row.principal_outstanding) || 0;
        if (pos < 1000) allBands.add('< 1k');
        else if (pos < 10000) {
            const lower = Math.floor(pos / 1000);
            allBands.add(`${lower}k-${lower + 1}k`);
        } else {
            const lower = Math.floor(pos / 5000) * 5;
            allBands.add(`${lower}k-${lower + 5}k`);
        }
    });
    
    const sortedBands = Array.from(allBands).sort((a, b) => {
        if (a === '< 1k') return 1;
        if (b === '< 1k') return -1;
        const valA = parseInt(a.split('k')[0]);
        const valB = parseInt(b.split('k')[0]);
        return valB - valA;
    });

    return { totalCollection, teamPaidPosSum, posPaidOnlyPosSum, bucketData, cityData, smallCasesEMI, smallCasesPOS, totalSmallCases, smallCasesBoth, sortedBands };
  }, [filteredRecords]);

  const selectionStats = useMemo(() => {
    let cases = 0;
    let pos = 0;
    selectedCells.forEach(id => {
      const [c, b] = id.split(':::');
      const cityRec = stats.cityData.find(x => x.city === c);
      if (cityRec && cityRec.bands[b]) {
        cases += cityRec.bands[b].cases;
        pos += cityRec.bands[b].pos;
      }
    });
    return { cases, pos };
  }, [selectedCells, stats.cityData]);



  const getBandRange = (band: string) => {
    if (band === '< 1k') return { min: 0, max: 999.99 };
    const parts = band.split('-');
    if (parts.length === 2) {
      const min = parseInt(parts[0].replace('k', '')) * 1000;
      const max = parseInt(parts[1].replace('k', '')) * 1000 - 0.01;
      return { min, max };
    }
    return null;
  };

  const navigateToExplorer = (filters: { city?: string, band?: string, bucket?: string, paid?: string }) => {
    const params = new URLSearchParams();
    if (globalBucket !== 'ALL') params.set('bucket', globalBucket);
    if (filters.bucket) params.set('bucket', filters.bucket);
    if (filters.city) params.set('city', filters.city);
    if (filters.paid) params.set('paid', filters.paid);
    if (filters.band) {
      const range = getBandRange(filters.band);
      if (range) {
        params.set('minPos', String(range.min));
        params.set('maxPos', String(range.max));
      }
    }
    navigate(`/explorer?${params.toString()}`);
  };

  if (isLoading) {
    return (
      <AppLayout>
      <div className="mb-4"><BucketFilter /></div>
        <div className="flex h-[50vh] items-center justify-center text-muted-foreground animate-pulse">
          Loading dashboard metrics...
        </div>
  
      {selectedCells.size > 0 && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="bg-foreground text-background px-6 py-4 rounded-xl shadow-2xl flex items-center gap-6 font-medium">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center bg-background/20 text-background rounded-full w-8 h-8 font-bold text-sm">
                {selectedCells.size}
              </span>
              <span>Cells Selected</span>
            </div>
            <div className="w-px h-6 bg-background/20"></div>
            <div className="flex flex-col">
              <span className="text-xs text-background/70 uppercase tracking-wider">Total Cases</span>
              <span className="font-bold text-lg leading-none">{selectionStats.cases.toLocaleString()}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-background/70 uppercase tracking-wider">Total POS</span>
              <span className="font-bold text-lg leading-none">{fmtCur(selectionStats.pos)}</span>
            </div>
            <div className="w-px h-6 bg-background/20 ml-2"></div>
            <button 
              onClick={() => setSelectedCells(new Set())}
              className="text-sm px-3 py-1.5 rounded-lg hover:bg-background/20 transition-colors ml-2"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}
      {/* Performance-Based Paid Cases */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden mb-8">
        <div className="p-4 border-b border-border bg-muted/20">
          <h3 className="font-semibold flex items-center gap-2">Performance-Based Paid Cases</h3>
          <p className="text-xs text-muted-foreground mt-1">Detailed performance tracking against collection targets</p>
        </div>
        <div className="overflow-x-auto max-h-[600px] relative">
          <table className="w-full font-sans text-xs min-w-[1000px]">
            <thead className="sticky top-0 z-30 bg-muted border-b border-border shadow-sm">
              <tr>
                <th className="text-muted-foreground font-semibold px-3 py-3 text-center w-12 bg-muted/90 text-xs uppercase text-[10px]">Rank</th>
                <th className="text-muted-foreground font-semibold px-3 py-3 text-left uppercase tracking-wider text-[11px] bg-muted/90">City</th>
                <th className="text-muted-foreground font-semibold px-3 py-3 text-right uppercase tracking-wider text-[11px] bg-muted/90">Collection</th>
                <th className="text-muted-foreground font-semibold px-3 py-3 text-right uppercase tracking-wider text-[11px] bg-muted/90">Total Cases</th>
                <th className="text-muted-foreground font-semibold px-3 py-3 text-right uppercase tracking-wider text-[11px] bg-muted/90">Paid Count</th>
                <th className="text-muted-foreground font-semibold px-3 py-3 text-right uppercase tracking-wider text-[11px] bg-muted/90">POS Paid Only Count</th>
                <th className="text-muted-foreground font-semibold px-3 py-3 text-right uppercase tracking-wider text-[11px] bg-muted/90">Total POS</th>
                <th className="text-muted-foreground font-semibold px-3 py-3 text-right uppercase tracking-wider text-[11px] bg-muted/90">Paid POS</th>
                <th className="text-muted-foreground font-semibold px-3 py-3 text-right uppercase tracking-wider text-[11px] bg-muted/90">Needed / DRR</th>
                <th className="text-muted-foreground font-semibold px-3 py-3 text-right uppercase tracking-wider text-[11px] bg-muted/90">Target Date</th>
                <th className="text-muted-foreground font-semibold px-3 py-3 text-right uppercase tracking-wider text-[11px] bg-muted/90">DRR</th>
                <th className="text-muted-foreground font-semibold px-3 py-3 text-right uppercase tracking-wider text-[11px] bg-muted/90">POS Paid Only POS</th>
                <th className="text-muted-foreground font-semibold px-3 py-3 text-right uppercase tracking-wider text-[11px] bg-muted/90">Total %</th>
              </tr>
            </thead>
            <tbody>
              {teamPerfGrouped.map(([bkt, items]) => {
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
                  <Fragment key={bkt}>
                    <tr className="bg-primary/10 border-b border-border">
                      <td colSpan={13} className="px-3 py-2.5 font-sans text-[11px] font-bold text-primary uppercase tracking-[0.1em]">BUCKET {bkt}</td>
                    </tr>
                    {items.map((item: any) => (
                      <tr key={item.city} className="border-b border-border transition-colors hover:bg-muted/30">
                        <td className="px-3 py-2 text-center font-bold text-muted-foreground text-xs">{item.globalRank}</td>
                        <td className="px-3 py-2 font-medium cursor-pointer hover:text-primary transition-colors hover:underline" onClick={() => navigateToExplorer({ city: item.city })}>{item.city}</td>
                        <td className="px-3 py-2 text-right text-primary font-tabular-nums font-semibold">{fmtCur(item.collection)}</td>
                        <td className="px-3 py-2 text-right cursor-pointer hover:text-primary transition-colors hover:bg-primary/5" onClick={() => navigateToExplorer({ city: item.city })}>{item.count}</td>
                        <td className="px-3 py-2 text-right font-tabular-nums font-medium text-emerald-600 dark:text-emerald-400 cursor-pointer hover:bg-success/10 transition-colors" onClick={() => navigateToExplorer({ city: item.city })}>{item.paid}</td>
                        <td className="px-3 py-2 text-right font-tabular-nums font-medium text-blue-600 dark:text-blue-400 cursor-pointer hover:bg-info/10 transition-colors" onClick={() => navigateToExplorer({ city: item.city })}>{item.posPaidOnlyCount}</td>
                        <td className="px-3 py-2 text-right font-tabular-nums">{fmtCur(item.totalPOS)}</td>
                        <td className="px-3 py-2 text-right font-tabular-nums text-emerald-600 dark:text-emerald-400 cursor-pointer hover:bg-success/10 transition-colors" onClick={() => navigateToExplorer({ city: item.city })}>{fmtCur(item.paidPOS)}</td>
                        <td className="px-3 py-2 text-right">{item.target <= 0 ? <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">Achieved</span> : <span className="text-rose-600 dark:text-rose-400 font-tabular-nums font-bold tracking-tight">{fmtCur(item.target)}</span>}</td>
                        <td className="px-3 py-2 text-right text-xs text-muted-foreground">{item.targetDate || "-"}</td>
                        <td className="px-3 py-2 text-right font-tabular-nums font-bold tracking-tight text-amber-600">{fmtCur(item.dailyRequiredPOS || 0)}</td>
                        <td className="px-3 py-2 text-right font-tabular-nums font-medium text-blue-600 dark:text-blue-400 cursor-pointer hover:bg-info/10 transition-colors" onClick={() => navigateToExplorer({ city: item.city })}>{fmtCur(item.posPaidOnlyPOS)}</td>
                        <td className={`px-3 py-2 text-right font-tabular-nums font-bold ${pctColor(item.pct)}`}>{fmtPct(item.pct)}</td>
                      </tr>
                    ))}
                    <tr className="border-b border-border bg-muted/10 font-medium">
                      <td className="px-3 py-2 text-center"></td>
                      <td className="px-3 py-2.5 text-muted-foreground uppercase text-xs tracking-wider">Bucket {bkt} Total</td>
                      <td className="px-3 py-2 text-right text-primary">{fmtCur(sub.collection)}</td>
                      <td className="px-3 py-2 text-right">{sub.count}</td>
                      <td className="px-3 py-2 text-right font-tabular-nums font-medium text-emerald-600 dark:text-emerald-400">{sub.paid}</td>
                      <td className="px-3 py-2 text-right font-tabular-nums font-medium text-blue-600 dark:text-blue-400">{sub.posPaidOnlyCount}</td>
                      <td className="px-3 py-2 text-right">{fmtCur(sub.totalPOS)}</td>
                      <td className="px-3 py-2 text-right">{fmtCur(sub.paidPOS)}</td>
                      <td className="px-3 py-2 text-right">{sub.target <= 0 ? <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">Achieved</span> : <span className="text-rose-600 dark:text-rose-400 font-tabular-nums font-bold tracking-tight">{fmtCur(sub.target)}</span>}</td>
                      <td className="px-3 py-2 text-right text-xs text-muted-foreground">-</td>
                      <td className="px-3 py-2 text-right font-tabular-nums font-bold tracking-tight text-amber-600">{fmtCur(sub.dailyRequiredPOS || 0)}</td>
                      <td className="px-3 py-2 text-right font-tabular-nums font-medium text-blue-600 dark:text-blue-400">{fmtCur(sub.posPaidOnlyPOS)}</td>
                      <td className={`px-3 py-2 text-right ${pctColor(subPct)}`}>{fmtPct(subPct)}</td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot className="bg-primary/10 font-bold sticky bottom-0 z-20 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] cursor-pointer hover:bg-primary/20 transition-colors" onClick={() => navigateToExplorer({})}>
              <tr>
                <td className="px-3 py-2 text-center"></td>
                <td className="px-3 py-2.5 font-bold uppercase text-primary">Grand Total</td>
                <td className="px-3 py-2.5 text-right text-primary font-tabular-nums">{fmtCur(teamPerfGrandTotal.collection)}</td>
                <td className="px-3 py-2.5 text-right font-tabular-nums">{teamPerfGrandTotal.count}</td>
                <td className="px-3 py-2.5 text-right font-tabular-nums text-emerald-600 dark:text-emerald-400">{teamPerfGrandTotal.paid}</td>
                <td className="px-3 py-2.5 text-right font-tabular-nums text-blue-600 dark:text-blue-400">{teamPerfGrandTotal.posPaidOnlyCount}</td>
                <td className="px-3 py-2.5 text-right font-tabular-nums">{fmtCur(teamPerfGrandTotal.totalPOS)}</td>
                <td className="px-3 py-2.5 text-right font-tabular-nums text-emerald-600 dark:text-emerald-400">{fmtCur(teamPerfGrandTotal.paidPOS)}</td>
                <td className="px-3 py-2.5 text-right">
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-rose-600 dark:text-rose-400 font-tabular-nums font-bold tracking-tight">{fmtCur(teamPerfGrandTotal.target)}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right text-xs text-muted-foreground">-</td>
                <td className="px-3 py-2.5 text-right">
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] font-tabular-nums font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900/50 px-1.5 py-0.5 rounded-sm shadow-sm">DRR: {fmtCur(teamPerfGrandTotal.dailyRequiredPOS || 0)}/d</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right font-tabular-nums text-blue-600 dark:text-blue-400">{fmtCur(teamPerfGrandTotal.posPaidOnlyPOS)}</td>
                <td className={"px-3 py-2.5 text-right font-tabular-nums " + pctColor(teamPerfGrandTotal.totalPOS ? teamPerfGrandTotal.paidPOS / teamPerfGrandTotal.totalPOS : 0)}>
                  {fmtPct(teamPerfGrandTotal.totalPOS ? teamPerfGrandTotal.paidPOS / teamPerfGrandTotal.totalPOS : 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="p-3 border-t border-border bg-muted/10 text-right">
          <button onClick={() => {
            const headerRow = "Bucket,Rank,City,Collection,Total Cases,Paid Count,POS Paid Only Count,Total POS,Paid POS,Needed/DRR,Target Date,DRR,POS Paid Only POS,Total %";
            const csv = [headerRow, ...teamPerfData.map((item: any) => `"${item.bkt}","${item.globalRank}","${item.city}",${item.collection},${item.count},${item.paid},${item.posPaidOnlyCount},${item.totalPOS},${item.paidPOS},${item.target},"${item.targetDate || ''}",${item.dailyRequiredPOS || 0},${item.posPaidOnlyPOS},${item.pct}`)].join("\n");
            const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "Performance_Paid_Cases.csv"; a.click();
          }} className="inline-flex items-center gap-1.5 text-xs font-bold bg-card border border-border px-3 py-1.5 rounded hover:bg-muted text-primary transition-colors">
            <Download className="h-3.5 w-3.5" /> Export Data
          </button>
</div></div></AppLayout>

    );
  }

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-sans text-2xl font-extrabold uppercase tracking-wide flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" /> Executive Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Live agent metrics, collection details, and geographical analytics</p>
        </div>
      </div>

      <AgentLiveDashboard />

      {filteredRecords.length === 0 ? (
        <div className="my-8 p-8 border border-dashed border-border rounded-2xl bg-card/40 text-center flex flex-col items-center justify-center space-y-3">
          <Database className="h-10 w-10 text-muted-foreground/40" />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">No Portfolio Data Assigned</h3>
            <p className="text-xs text-muted-foreground max-w-md">
              There are no active loan records matched with your executive profile in the current view. Contact your manager or system administrator to allocate cases to your account.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="my-10 border-t border-border"></div>

          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="font-sans text-xl font-bold uppercase tracking-wide flex items-center gap-2">
                Advanced Analytics
              </h2>
              <p className="text-sm text-muted-foreground mt-1">Deep dive into collection, buckets, and geographical metrics</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-card border border-border p-6 rounded-xl shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-2 text-muted-foreground mb-2 font-medium">
            <DollarSign className="h-4 w-4" /> Total Collection (DAC)
          </div>
          <div className="text-3xl font-bold text-success">{fmtCur(stats.totalCollection)}</div>
        </div>
        
        <div className="bg-card border border-border p-6 rounded-xl shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-2 text-muted-foreground mb-2 font-medium">
            <AlertCircle className="h-4 w-4" /> Total Small Cases
          </div>
          <div className="text-3xl font-bold text-warning">{stats.totalSmallCases.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground mt-1">
            Accounts with EMI &lt; ₹500 <strong>or</strong> POS &lt; ₹1k
          </div>
          <div className="text-[10px] text-muted-foreground mt-1 flex justify-between">
            <span>EMI only: {(stats.smallCasesEMI - stats.smallCasesBoth).toLocaleString()}</span>
            <span>POS only: {(stats.smallCasesPOS - stats.smallCasesBoth).toLocaleString()}</span>
            <span>Both: {stats.smallCasesBoth.toLocaleString()}</span>
          </div>
        </div>

        <div className="bg-card border border-border p-6 rounded-xl shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-2 text-muted-foreground mb-2 font-medium">
            <Database className="h-4 w-4" /> Total Outstanding (POS)
          </div>
          <div className="text-3xl font-bold text-destructive">{fmtCur(stats.bucketData.reduce((acc, b) => acc + b.pos, 0))}</div>
          <div className="text-xs text-muted-foreground mt-1">Total principal across all cases</div>
        </div>

        <div className="bg-card border border-border p-6 rounded-xl shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-2 text-muted-foreground mb-2 font-medium">
            <TrendingUp className="h-4 w-4" /> Total Cases Analyzed
          </div>
          <div className="text-3xl font-bold text-primary">{filteredRecords.length.toLocaleString()}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 mb-8">
        {/* Bucket Breakdown */}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-border bg-muted/20">
            <h3 className="font-semibold flex items-center gap-2">Bucket wise Collections & POS</h3>
          </div>
          <div className="p-4 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={stats.bucketData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="bucket" tick={{fontSize: 12}} stroke="hsl(var(--muted-foreground))" />
                <YAxis yAxisId="left" tickFormatter={(v) => `${v/1000}k`} tick={{fontSize: 12}} stroke="hsl(var(--muted-foreground))" />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v/1000}k`} tick={{fontSize: 12}} stroke="hsl(var(--muted-foreground))" />
                <Tooltip 
                  formatter={(value: number) => fmtCur(value)}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar yAxisId="left" dataKey="pos" name="Total POS" fill="hsl(var(--primary)/0.7)" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="teamPaid" name="Team Paid Cases" fill="hsl(var(--success)/0.8)" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="posPaidOnly" name="POS Paid Only Cases" fill="hsl(var(--info)/0.8)" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="collection" name="Collection (DAC)" stroke="hsl(var(--success))" strokeWidth={3} dot={{r: 4}} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="overflow-x-auto border-t border-border">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 font-semibold text-center w-12 bg-muted/90 text-muted-foreground uppercase text-[10px]">S.No.</th>
                  <th className="px-4 py-2 font-semibold">Bucket<span className="inline-flex items-center ml-1 opacity-40 hover:opacity-100 cursor-pointer transition-opacity"></span></th>
                  <th className="px-4 py-2 font-semibold text-right">Cases<span className="inline-flex items-center ml-1 opacity-40 hover:opacity-100 cursor-pointer transition-opacity"></span></th>
                  <th className="px-4 py-2 font-semibold text-right hidden sm:table-cell">POS Amount<span className="inline-flex items-center ml-1 opacity-40 hover:opacity-100 cursor-pointer transition-opacity"></span></th>
                  <th className="px-4 py-2 font-semibold text-right text-success">Paid Count<span className="inline-flex items-center ml-1 opacity-40 hover:opacity-100 cursor-pointer transition-opacity"></span></th>
                  <th className="px-4 py-2 font-semibold text-right text-success hidden sm:table-cell">Paid POS<span className="inline-flex items-center ml-1 opacity-40 hover:opacity-100 cursor-pointer transition-opacity"></span></th>
                  <th className="px-4 py-2 font-semibold text-right text-info">POS Paid Only Count<span className="inline-flex items-center ml-1 opacity-40 hover:opacity-100 cursor-pointer transition-opacity"></span></th>
                  <th className="px-4 py-2 font-semibold text-right text-info hidden sm:table-cell">POS Paid Only POS<span className="inline-flex items-center ml-1 opacity-40 hover:opacity-100 cursor-pointer transition-opacity"></span></th>
                  <th className="px-4 py-2 font-semibold text-right hidden sm:table-cell">Unpaid<span className="inline-flex items-center ml-1 opacity-40 hover:opacity-100 cursor-pointer transition-opacity"></span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stats.bucketData.map((b, i) => (
                  <tr key={b.bucket} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-center text-xs font-bold text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-2 font-medium cursor-pointer hover:text-primary transition-colors hover:underline" onClick={() => navigateToExplorer({ bucket: b.bucket })}>{b.bucket}</td>
                    <td className="px-4 py-2 text-right cursor-pointer hover:bg-primary/5 hover:text-primary transition-colors" onClick={() => navigateToExplorer({ bucket: b.bucket })}>{b.cases.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right cursor-pointer hover:bg-primary/5 hover:text-primary transition-colors" onClick={() => navigateToExplorer({ bucket: b.bucket })}>{fmtCur(b.pos)}</td>
                    <td className="px-4 py-2 text-right text-success font-medium cursor-pointer hover:bg-success/10 transition-colors" onClick={() => navigateToExplorer({ bucket: b.bucket })}>{b.teamPaid.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-success hidden sm:table-cell cursor-pointer hover:bg-success/10 transition-colors" onClick={() => navigateToExplorer({ bucket: b.bucket })}>{fmtCur(b.paidPOS)}</td>
                    <td className="px-4 py-2 text-right text-info font-medium cursor-pointer hover:bg-info/10 transition-colors" onClick={() => navigateToExplorer({ bucket: b.bucket })}>{b.posPaidOnly.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-info hidden sm:table-cell cursor-pointer hover:bg-info/10 transition-colors" onClick={() => navigateToExplorer({ bucket: b.bucket })}>{fmtCur(b.posPaidOnlyPOS)}</td>
                    <td className="px-4 py-2 text-right text-muted-foreground cursor-pointer hover:bg-primary/5 hover:text-primary transition-colors hidden sm:table-cell" onClick={() => navigateToExplorer({ bucket: b.bucket, paid: 'Unpaid' })}>{b.unpaid.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-primary/10 font-bold sticky bottom-0 z-10 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] cursor-pointer hover:bg-primary/20 transition-colors" onClick={() => navigateToExplorer({})}>
                <tr>
                  <td className="px-4 py-2 text-center text-xs text-muted-foreground"></td>
                  <td className="px-4 py-2 text-primary uppercase">Grand Total</td>
                  <td className="px-4 py-2 text-right">{stats.bucketData.reduce((a, b) => a + b.cases, 0).toLocaleString()}</td>
                  <td className="px-4 py-2 text-right">{fmtCur(stats.bucketData.reduce((a, b) => a + b.pos, 0))}</td>
                  <td className="px-4 py-2 text-right text-success font-bold">{stats.bucketData.reduce((a, b) => a + b.teamPaid, 0).toLocaleString()}</td>
                  <td className="px-4 py-2 text-right text-success hidden sm:table-cell">{fmtCur(stats.bucketData.reduce((a, b) => a + b.paidPOS, 0))}</td>
                  <td className="px-4 py-2 text-right text-info font-bold">{stats.bucketData.reduce((a, b) => a + b.posPaidOnly, 0).toLocaleString()}</td>
                  <td className="px-4 py-2 text-right text-info hidden sm:table-cell">{fmtCur(stats.bucketData.reduce((a, b) => a + b.posPaidOnlyPOS, 0))}</td>
                  <td className="px-4 py-2 text-right text-muted-foreground hover:bg-primary/10 transition-colors hidden sm:table-cell" onClick={(e) => { e.stopPropagation(); navigateToExplorer({ paid: 'Unpaid' }); }}>{stats.bucketData.reduce((a, b) => a + b.unpaid, 0).toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="p-3 border-t border-border bg-muted/10 text-right">
             <button onClick={() => {
                 const csv = ['Bucket,Cases,POS Amount,Paid Count,Paid POS,POS Paid Only Count,POS Paid Only POS,Unpaid', ...stats.bucketData.map((b, i) => `"${b.bucket}",${b.cases},${b.pos},${b.teamPaid},${b.paidPOS},${b.posPaidOnly},${b.posPaidOnlyPOS},${b.unpaid}`)].join('\n');
                 const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'Bucket_Performance.csv'; a.click();
             }} className="inline-flex items-center gap-1.5 text-xs font-bold bg-card border border-border px-3 py-1.5 rounded hover:bg-muted text-primary transition-colors">
               <Download className="h-3.5 w-3.5" /> Export Data
             </button>
          </div>
        </div>

        </div>
      <div className="mb-10">
        {/* City Top Level */}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-border bg-muted/20">
            <h3 className="font-semibold flex items-center gap-2">Top Cities & Bandwise Bifurcation</h3>
          </div>
          <div className="overflow-x-auto flex-1 h-[450px]">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-4 py-3 font-semibold text-center w-12 bg-muted/90 text-muted-foreground uppercase text-[10px]">S.No.</th>
                  <th className="px-4 py-3 font-semibold bg-muted/90">City<span className="inline-flex items-center ml-1 opacity-40 hover:opacity-100 cursor-pointer transition-opacity"></span></th>
                  <th className="px-4 py-3 font-semibold text-right bg-muted/90">Cases<span className="inline-flex items-center ml-1 opacity-40 hover:opacity-100 cursor-pointer transition-opacity"></span></th>
                  <th className="px-4 py-3 font-semibold text-right bg-muted/90">Total POS<span className="inline-flex items-center ml-1 opacity-40 hover:opacity-100 cursor-pointer transition-opacity"></span></th>
                  <th className="px-4 py-3 font-semibold text-center bg-muted" colSpan={stats.sortedBands.length}>POS Bands (Cases)<span className="inline-flex items-center ml-1 opacity-40 hover:opacity-100 cursor-pointer transition-opacity"></span></th>
                </tr>
                <tr className="border-t border-border/50 text-[10px]">
                  <th colSpan={6} className="bg-muted/90"></th>
                  {stats.sortedBands.map((band, idx) => (
                      <th key={band} className={`px-2 py-1 text-center font-medium bg-muted ${idx === 0 ? 'border-l border-border/30' : ''} ${idx === stats.sortedBands.length - 1 ? 'border-r border-border/30' : ''}`}>
                          {band}
                      </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stats.cityData.slice(0, 50).map((c, i) => (
                  <tr key={c.city} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-center text-xs font-bold text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-2 font-medium cursor-pointer hover:text-primary transition-colors hover:underline" onClick={() => navigateToExplorer({ city: c.city })}>{c.city}</td>
                    <td className="px-4 py-2 text-right cursor-pointer hover:text-primary transition-colors hover:bg-primary/5" onClick={() => navigateToExplorer({ city: c.city })}>{c.cases.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right font-medium cursor-pointer hover:text-primary transition-colors hover:bg-primary/5" onClick={() => navigateToExplorer({ city: c.city })}>{fmtCur(c.pos)}</td>
                    {stats.sortedBands.map((band, idx) => {
                        const cell = c.bands[band];
                        const val = cell ? cell.cases : 0;
                        const isSelected = selectedCells.has(`${c.city}:::${band}`);
                        return (
                          <td 
                            key={band} 
                            className={`px-2 py-2 text-center text-xs cursor-pointer transition-colors ${idx === 0 ? 'border-l border-border/30' : ''} ${idx === stats.sortedBands.length - 1 ? 'border-r border-border/30' : ''} ${isSelected ? 'bg-primary text-primary-foreground font-bold' : 'bg-muted/10 hover:bg-primary/10 hover:text-primary'}`} 
                            onClick={() => handleCellClick(c.city, band)}
                          >
                              {val > 0 ? val : '-'}
                          </td>
                        )
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-primary/10 font-bold sticky bottom-0 z-10 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] cursor-pointer hover:bg-primary/20 transition-colors" onClick={() => window.location.href = globalBucket === 'ALL' ? '/explorer' : `/explorer?bucket=${globalBucket}`}>
                <tr>
                  <td className="px-4 py-2 text-center text-xs text-muted-foreground"></td>
                  <td className="px-4 py-2 text-primary uppercase">Grand Total</td>
                  <td className="px-4 py-2 text-right hover:text-primary transition-colors hover:bg-primary/5">{stats.cityData.reduce((a, c) => a + c.cases, 0).toLocaleString()}</td>
                  <td className="px-4 py-2 text-right hover:text-primary transition-colors hover:bg-primary/5">{fmtCur(stats.cityData.reduce((a, c) => a + c.pos, 0))}</td>
                  {stats.sortedBands.map((band, idx) => (
                      <td key={'ft'+band} className="px-2 py-2 text-center hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer" onClick={(e) => { e.stopPropagation(); navigateToExplorer({ band }); }}>
                          {stats.cityData.reduce((a, c) => a + (c.bands[band] ? c.bands[band].cases : 0), 0).toLocaleString()}
                      </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="p-3 border-t border-border bg-muted/10 flex justify-between items-center">
             <span className="text-xs text-muted-foreground">{stats.cityData.length > 50 ? `Showing top 50 of ${stats.cityData.length} cities` : `Showing all ${stats.cityData.length} cities`}</span>
             <button onClick={() => {
                 const csv = ['City,Cases,Total POS,' + stats.sortedBands.join(','), ...stats.cityData.map((c, i) => `"${c.city}",${c.cases},${c.pos},${stats.sortedBands.map((b, i) => c.bands[b] ? c.bands[b].cases : 0).join(',')}`)].join('\n');
                 const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'City_Bandwise.csv'; a.click();
             }} className="inline-flex items-center gap-1.5 text-xs font-bold bg-card border border-border px-3 py-1.5 rounded hover:bg-muted text-primary transition-colors">
               <Download className="h-3.5 w-3.5" /> Export Full Data
             </button>
          </div>
        </div>
      </div>
      
      </>
      )}

      {/* Performance-Based Paid Cases */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden mb-8">
        <div className="p-4 border-b border-border bg-muted/20">
          <h3 className="font-semibold flex items-center gap-2">Performance-Based Paid Cases</h3>
          <p className="text-xs text-muted-foreground mt-1">Detailed performance tracking against collection targets</p>
        </div>
        <div className="overflow-x-auto max-h-[600px] relative">
          <table className="w-full font-sans text-xs min-w-[1000px]">
            <thead className="sticky top-0 z-30 bg-muted border-b border-border shadow-sm">
              <tr>
                <th className="text-muted-foreground font-semibold px-3 py-3 text-center w-12 bg-muted/90 text-xs uppercase text-[10px]">Rank</th>
                <th className="text-muted-foreground font-semibold px-3 py-3 text-left uppercase tracking-wider text-[11px] bg-muted/90">City</th>
                <th className="text-muted-foreground font-semibold px-3 py-3 text-right uppercase tracking-wider text-[11px] bg-muted/90">Collection</th>
                <th className="text-muted-foreground font-semibold px-3 py-3 text-right uppercase tracking-wider text-[11px] bg-muted/90">Total Cases</th>
                <th className="text-muted-foreground font-semibold px-3 py-3 text-right uppercase tracking-wider text-[11px] bg-muted/90">Paid Count</th>
                <th className="text-muted-foreground font-semibold px-3 py-3 text-right uppercase tracking-wider text-[11px] bg-muted/90">POS Paid Only Count</th>
                <th className="text-muted-foreground font-semibold px-3 py-3 text-right uppercase tracking-wider text-[11px] bg-muted/90">Total POS</th>
                <th className="text-muted-foreground font-semibold px-3 py-3 text-right uppercase tracking-wider text-[11px] bg-muted/90">Paid POS</th>
                <th className="text-muted-foreground font-semibold px-3 py-3 text-right uppercase tracking-wider text-[11px] bg-muted/90">Needed / DRR</th>
                <th className="text-muted-foreground font-semibold px-3 py-3 text-right uppercase tracking-wider text-[11px] bg-muted/90">Target Date</th>
                <th className="text-muted-foreground font-semibold px-3 py-3 text-right uppercase tracking-wider text-[11px] bg-muted/90">DRR</th>
                <th className="text-muted-foreground font-semibold px-3 py-3 text-right uppercase tracking-wider text-[11px] bg-muted/90">POS Paid Only POS</th>
                <th className="text-muted-foreground font-semibold px-3 py-3 text-right uppercase tracking-wider text-[11px] bg-muted/90">Total %</th>
              </tr>
            </thead>
            <tbody>
              {teamPerfGrouped.map(([bkt, items]) => {
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
                  <Fragment key={bkt}>
                    <tr className="bg-primary/10 border-b border-border">
                      <td colSpan={13} className="px-3 py-2.5 font-sans text-[11px] font-bold text-primary uppercase tracking-[0.1em]">BUCKET {bkt}</td>
                    </tr>
                    {items.map((item: any) => (
                      <tr key={item.city} className="border-b border-border transition-colors hover:bg-muted/30">
                        <td className="px-3 py-2 text-center font-bold text-muted-foreground text-xs">{item.globalRank}</td>
                        <td className="px-3 py-2 font-medium cursor-pointer hover:text-primary transition-colors hover:underline" onClick={() => navigateToExplorer({ city: item.city })}>{item.city}</td>
                        <td className="px-3 py-2 text-right text-primary font-tabular-nums font-semibold">{fmtCur(item.collection)}</td>
                        <td className="px-3 py-2 text-right cursor-pointer hover:text-primary transition-colors hover:bg-primary/5" onClick={() => navigateToExplorer({ city: item.city })}>{item.count}</td>
                        <td className="px-3 py-2 text-right font-tabular-nums font-medium text-emerald-600 dark:text-emerald-400 cursor-pointer hover:bg-success/10 transition-colors" onClick={() => navigateToExplorer({ city: item.city })}>{item.paid}</td>
                        <td className="px-3 py-2 text-right font-tabular-nums font-medium text-blue-600 dark:text-blue-400 cursor-pointer hover:bg-info/10 transition-colors" onClick={() => navigateToExplorer({ city: item.city })}>{item.posPaidOnlyCount}</td>
                        <td className="px-3 py-2 text-right font-tabular-nums">{fmtCur(item.totalPOS)}</td>
                        <td className="px-3 py-2 text-right font-tabular-nums text-emerald-600 dark:text-emerald-400 cursor-pointer hover:bg-success/10 transition-colors" onClick={() => navigateToExplorer({ city: item.city })}>{fmtCur(item.paidPOS)}</td>
                        <td className="px-3 py-2 text-right">{item.target <= 0 ? <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">Achieved</span> : <span className="text-rose-600 dark:text-rose-400 font-tabular-nums font-bold tracking-tight">{fmtCur(item.target)}</span>}</td>
                        <td className="px-3 py-2 text-right text-xs text-muted-foreground">{item.targetDate || "-"}</td>
                        <td className="px-3 py-2 text-right font-tabular-nums font-bold tracking-tight text-amber-600">{fmtCur(item.dailyRequiredPOS || 0)}</td>
                        <td className="px-3 py-2 text-right font-tabular-nums font-medium text-blue-600 dark:text-blue-400 cursor-pointer hover:bg-info/10 transition-colors" onClick={() => navigateToExplorer({ city: item.city })}>{fmtCur(item.posPaidOnlyPOS)}</td>
                        <td className={`px-3 py-2 text-right font-tabular-nums font-bold ${pctColor(item.pct)}`}>{fmtPct(item.pct)}</td>
                      </tr>
                    ))}
                    <tr className="border-b border-border bg-muted/10 font-medium">
                      <td className="px-3 py-2 text-center"></td>
                      <td className="px-3 py-2.5 text-muted-foreground uppercase text-xs tracking-wider">Bucket {bkt} Total</td>
                      <td className="px-3 py-2 text-right text-primary">{fmtCur(sub.collection)}</td>
                      <td className="px-3 py-2 text-right">{sub.count}</td>
                      <td className="px-3 py-2 text-right font-tabular-nums font-medium text-emerald-600 dark:text-emerald-400">{sub.paid}</td>
                      <td className="px-3 py-2 text-right font-tabular-nums font-medium text-blue-600 dark:text-blue-400">{sub.posPaidOnlyCount}</td>
                      <td className="px-3 py-2 text-right">{fmtCur(sub.totalPOS)}</td>
                      <td className="px-3 py-2 text-right">{fmtCur(sub.paidPOS)}</td>
                      <td className="px-3 py-2 text-right">{sub.target <= 0 ? <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">Achieved</span> : <span className="text-rose-600 dark:text-rose-400 font-tabular-nums font-bold tracking-tight">{fmtCur(sub.target)}</span>}</td>
                      <td className="px-3 py-2 text-right text-xs text-muted-foreground">-</td>
                      <td className="px-3 py-2 text-right font-tabular-nums font-bold tracking-tight text-amber-600">{fmtCur(sub.dailyRequiredPOS || 0)}</td>
                      <td className="px-3 py-2 text-right font-tabular-nums font-medium text-blue-600 dark:text-blue-400">{fmtCur(sub.posPaidOnlyPOS)}</td>
                      <td className={`px-3 py-2 text-right ${pctColor(subPct)}`}>{fmtPct(subPct)}</td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot className="bg-primary/10 font-bold sticky bottom-0 z-20 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] cursor-pointer hover:bg-primary/20 transition-colors" onClick={() => navigateToExplorer({})}>
              <tr>
                <td className="px-3 py-2 text-center"></td>
                <td className="px-3 py-2.5 font-bold uppercase text-primary">Grand Total</td>
                <td className="px-3 py-2.5 text-right text-primary font-tabular-nums">{fmtCur(teamPerfGrandTotal.collection)}</td>
                <td className="px-3 py-2.5 text-right font-tabular-nums">{teamPerfGrandTotal.count}</td>
                <td className="px-3 py-2.5 text-right font-tabular-nums text-emerald-600 dark:text-emerald-400">{teamPerfGrandTotal.paid}</td>
                <td className="px-3 py-2.5 text-right font-tabular-nums text-blue-600 dark:text-blue-400">{teamPerfGrandTotal.posPaidOnlyCount}</td>
                <td className="px-3 py-2.5 text-right font-tabular-nums">{fmtCur(teamPerfGrandTotal.totalPOS)}</td>
                <td className="px-3 py-2.5 text-right font-tabular-nums text-emerald-600 dark:text-emerald-400">{fmtCur(teamPerfGrandTotal.paidPOS)}</td>
                <td className="px-3 py-2.5 text-right">
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-rose-600 dark:text-rose-400 font-tabular-nums font-bold tracking-tight">{fmtCur(teamPerfGrandTotal.target)}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right text-xs text-muted-foreground">-</td>
                <td className="px-3 py-2.5 text-right">
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] font-tabular-nums font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900/50 px-1.5 py-0.5 rounded-sm shadow-sm">DRR: {fmtCur(teamPerfGrandTotal.dailyRequiredPOS || 0)}/d</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right font-tabular-nums text-blue-600 dark:text-blue-400">{fmtCur(teamPerfGrandTotal.posPaidOnlyPOS)}</td>
                <td className={"px-3 py-2.5 text-right font-tabular-nums " + pctColor(teamPerfGrandTotal.totalPOS ? teamPerfGrandTotal.paidPOS / teamPerfGrandTotal.totalPOS : 0)}>
                  {fmtPct(teamPerfGrandTotal.totalPOS ? teamPerfGrandTotal.paidPOS / teamPerfGrandTotal.totalPOS : 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

    </AppLayout>
  );
}