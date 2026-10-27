import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { AppLayout } from '../components/layout/AppLayout';
import { BucketFilter, FloatingBucketFilter } from '../components/BucketFilter';
import { fmtCur, fmtPct } from '../lib/formatters';
import { calculateRow } from '../lib/calculations';
import { 
  BarChart3, 
  AlertCircle, 
  Database, 
  ChevronRight, 
  ChevronDown, 
  Download,
  Filter,
  CheckCircle2,
  TrendingUp,
  Layers,
  Building2,
  PieChart as PieChartIcon
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  ComposedChart, 
  Bar, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  CartesianGrid 
} from 'recharts';
import { TargetProgressCard, ProgressRing } from '../components/dashboard/TargetProgressCard';
import { SectionHeader } from '../components/ui/SectionHeader';
import { MetricModule } from '../components/ui/MetricModule';

export default function Dashboard() {
  const { records, targets, globalBucket, isLoading } = useData();
  const navigate = useNavigate();
  const [expandedCities, setExpandedCities] = useState<Record<string, boolean>>({});
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());

  const filteredRecords = useMemo(() => {
    if (!records) return [];
    if (globalBucket === 'ALL') return records;
    return records.filter((r: any) => String(r.bom_bkt).trim().toUpperCase() === globalBucket);
  }, [records, globalBucket]);

  const toggleCity = (city: string) => {
    setExpandedCities(prev => ({ ...prev, [city]: !prev[city] }));
  };

  const handleCellClick = (city: string, band: string) => {
    const id = `${city}:::${band}`;
    const next = new Set(selectedCells);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedCells(next);
  };

  // Primary Metrics calculation
  const stats = useMemo(() => {
    let totalCollection = 0;
    let totalPaidPOS = 0;
    let smallCasesEMI = 0;
    let smallCasesPOS = 0;
    let smallCasesBoth = 0;
    let totalSmallCases = 0;

    const bktMap: Record<string, { bucket: string; cases: number; pos: number; paid: number; unpaid: number; paidPos: number; unpaidPos: number }> = {};
    const cityMap: Record<string, { 
      city: string; 
      cases: number; 
      pos: number; 
      bands: Record<string, { cases: number; pos: number }>;
      buckets: Record<string, { cases: number; pos: number; paid: number; unpaid: number }>;
    }> = {};

    const allBands = new Set<string>();

    filteredRecords.forEach(r => {
      const c = calculateRow(r);
      const pos = Number(r.principal_outstanding || 0);
      const rowCollection = c.total;
      const isPaid = c.mainPaid === 1;
      const emi = Number(r.emi_amt || 0);

      totalCollection += rowCollection;
      if (isPaid) {
        totalPaidPOS += pos;
      }

      // Small accounts logic
      const isEmiSmall = emi > 0 && emi < 500;
      const isPosSmall = pos > 0 && pos < 1000;
      if (isEmiSmall) smallCasesEMI++;
      if (isPosSmall) smallCasesPOS++;
      if (isEmiSmall && isPosSmall) smallCasesBoth++;
      if (isEmiSmall || isPosSmall) totalSmallCases++;

      // Bucket aggregation
      const bkt = r.bom_bkt ? String(r.bom_bkt) : 'Other';
      if (!bktMap[bkt]) {
        bktMap[bkt] = { bucket: bkt, cases: 0, pos: 0, paid: 0, unpaid: 0, paidPos: 0, unpaidPos: 0 };
      }
      bktMap[bkt].cases++;
      bktMap[bkt].pos += pos;
      if (isPaid) {
        bktMap[bkt].paid++;
        bktMap[bkt].paidPos += pos;
      } else {
        bktMap[bkt].unpaid++;
        bktMap[bkt].unpaidPos += pos;
      }

      // City aggregation
      const city = r.city ? String(r.city).trim().toUpperCase() : 'UNKNOWN';
      if (!cityMap[city]) {
        cityMap[city] = { city, cases: 0, pos: 0, bands: {}, buckets: {} };
      }
      cityMap[city].cases++;
      cityMap[city].pos += pos;

      // City bucket breakdown
      if (!cityMap[city].buckets[bkt]) {
        cityMap[city].buckets[bkt] = { cases: 0, pos: 0, paid: 0, unpaid: 0 };
      }
      cityMap[city].buckets[bkt].cases++;
      cityMap[city].buckets[bkt].pos += pos;
      if (isPaid) {
        cityMap[city].buckets[bkt].paid++;
      } else {
        cityMap[city].buckets[bkt].unpaid++;
      }

      // Band calculation
      let bandKey = 'Other';
      if (pos < 1000) bandKey = '< 1k';
      else if (pos < 10000) {
        const lower = Math.floor(pos / 1000);
        bandKey = `${lower}k-${lower + 1}k`;
      } else {
        const lower = Math.floor(pos / 5000) * 5;
        bandKey = `${lower}k-${lower + 5}k`;
      }

      if (!cityMap[city].bands[bandKey]) {
        cityMap[city].bands[bandKey] = { cases: 0, pos: 0 };
      }
      cityMap[city].bands[bandKey].cases++;
      cityMap[city].bands[bandKey].pos += pos;

      allBands.add(bandKey);
    });

    const bucketData = Object.values(bktMap).sort((a, b) => a.bucket.localeCompare(b.bucket));
    const cityData = Object.values(cityMap).sort((a, b) => b.pos - a.pos);

    // Sort bands numerically
    const sortedBands = Array.from(allBands).sort((a, b) => {
      if (a === '< 1k') return 1;
      if (b === '< 1k') return -1;
      const valA = parseInt(a.split('k')[0]) || 0;
      const valB = parseInt(b.split('k')[0]) || 0;
      return valB - valA;
    });

    const totalPOS = bucketData.reduce((acc, b) => acc + b.pos, 0);
    const paidPOS = totalPaidPOS;

    // Target Calculation
    let totalTargetPOS = 0;
    bucketData.forEach(b => {
      const bkt = b.bucket;
      const pct = targets?.bucketTargets?.[bkt] ?? targets?.defaultTargetPct ?? 85;
      totalTargetPOS += (b.pos * pct) / 100;
    });
    const neededPOS = Math.max(0, totalTargetPOS - paidPOS);
    const targetDate = targets?.targetDate ? new Date(targets.targetDate) : new Date();
    const today = new Date();
    const diffTime = Math.max(1, targetDate.getTime() - today.getTime());
    const remainingDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    const dailyRequiredPOS = neededPOS / remainingDays;

    return {
      totalCollection,
      bucketData,
      cityData,
      smallCasesEMI,
      smallCasesPOS,
      totalSmallCases,
      smallCasesBoth,
      sortedBands,
      totalPOS,
      paidPOS,
      totalTargetPOS,
      neededPOS,
      dailyRequiredPOS,
      remainingDays,
      targetPct: targets?.defaultTargetPct ?? 85,
    };
  }, [filteredRecords, targets]);

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

  const navigateToExplorer = (filters: { city?: string; band?: string; bucket?: string; paid?: string; allocated?: string }) => {
    const params = new URLSearchParams();
    if (globalBucket !== 'ALL') params.set('bucket', globalBucket);
    if (filters.bucket) params.set('bucket', filters.bucket);
    if (filters.city) params.set('city', filters.city);
    if (filters.paid) params.set('paid', filters.paid);
    if (filters.allocated) params.set('allocated', filters.allocated);
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
        <div className="flex h-[50vh] items-center justify-center text-muted-foreground animate-pulse font-medium">
          Loading portfolio intelligence...
        </div>
      </AppLayout>
    );
  }

  if (filteredRecords.length === 0) {
    return (
      <AppLayout>
        <SectionHeader
          title="Portfolio Analytics Cockpit"
          subtitle="Real-time recovery velocity, bucket distribution, and city bifurcation"
          icon={BarChart3}
        />
        <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
          <BucketFilter />
        </div>
        <div className="flex flex-col items-center justify-center h-[45vh] text-muted-foreground space-y-4 bg-card border border-border/80 rounded-2xl p-8 shadow-xs">
          <Database className="h-12 w-12 opacity-20" />
          <div className="text-center space-y-1">
            <h3 className="text-sm font-semibold text-foreground">
              No Records Found for {globalBucket === 'ALL' ? 'Current Portfolio' : `Bucket ${globalBucket}`}
            </h3>
            <p className="text-xs text-muted-foreground max-w-md">
              There are no loan cases matching the active bucket filter. Click a bucket button above to switch or view all cases.
            </p>
          </div>
        </div>
        <FloatingBucketFilter />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <SectionHeader
        title="Portfolio Analytics Cockpit"
        subtitle="Real-time recovery velocity, bucket distribution, and city bifurcation"
        icon={BarChart3}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const csv = ['Bucket,Cases,POS Amount,Paid,Unpaid', ...stats.bucketData.map(b => `"${b.bucket}",${b.cases},${b.pos},${b.paid},${b.unpaid}`)].join('\n');
                const a = document.createElement('a');
                a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
                a.download = 'Portfolio_Summary.csv';
                a.click();
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold bg-card border border-border px-3 py-1.5 rounded-lg hover:bg-muted text-foreground transition-colors shadow-xs"
            >
              <Download className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Export Summary</span>
            </button>
          </div>
        }
      />

      {/* Top Bucket Filter Strip */}
      <div className="mb-5">
        <BucketFilter showCounts={true} />
      </div>

      {/* Top Cockpit KPI Metric Modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Metric 1: Target Velocity & DRR */}
        <TargetProgressCard
          totalPOS={stats.totalPOS}
          paidPOS={stats.paidPOS}
          totalCollection={stats.totalCollection}
          neededPOS={stats.neededPOS}
          dailyRequiredPOS={stats.dailyRequiredPOS}
          targetPct={stats.targetPct}
          remainingDays={stats.remainingDays}
        />

        {/* Metric 2: Total Collection (DAC) */}
        <div className="bg-card border border-border/80 rounded-xl p-4 shadow-xs flex flex-col justify-between hover:border-border transition-all">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Total Collection (DAC)
              </span>
              <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-tabular tracking-tight">
                {fmtCur(stats.totalCollection)}
              </div>
            </div>
            <ProgressRing
              percentage={stats.totalPOS > 0 ? (stats.paidPOS / stats.totalPOS) * 100 : 0}
              size={44}
              strokeWidth={4}
            />
          </div>
          <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
            <span>Paid POS: <strong className="text-foreground font-tabular">{fmtCur(stats.paidPOS)}</strong></span>
            <span className="font-tabular text-emerald-600 dark:text-emerald-400 font-bold">{fmtPct(stats.totalPOS ? stats.paidPOS / stats.totalPOS : 0)}</span>
          </div>
        </div>

        {/* Metric 3: Small Accounts / Low Ticket */}
        <div className="bg-card border border-border/80 rounded-xl p-4 shadow-xs flex flex-col justify-between hover:border-border transition-all">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-amber-500" /> Small Accounts
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                Low Ticket
              </span>
            </div>
            <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 font-tabular tracking-tight">
              {stats.totalSmallCases.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              EMI &lt; ₹500 or POS &lt; ₹1k
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-border/60 grid grid-cols-3 text-[10px] text-muted-foreground">
            <div>EMI: <strong className="text-foreground font-tabular">{(stats.smallCasesEMI - stats.smallCasesBoth).toLocaleString()}</strong></div>
            <div className="text-center">POS: <strong className="text-foreground font-tabular">{(stats.smallCasesPOS - stats.smallCasesBoth).toLocaleString()}</strong></div>
            <div className="text-right">Both: <strong className="text-foreground font-tabular">{stats.smallCasesBoth.toLocaleString()}</strong></div>
          </div>
        </div>

        {/* Metric 4: Total Portfolio Outstanding */}
        <div className="bg-card border border-border/80 rounded-xl p-4 shadow-xs flex flex-col justify-between hover:border-border transition-all">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5 text-primary" /> Total Portfolio
              </span>
              <span className="text-[10px] font-tabular font-medium text-muted-foreground">
                {filteredRecords.length.toLocaleString()} cases
              </span>
            </div>
            <div className="text-2xl font-extrabold text-foreground font-tabular tracking-tight">
              {fmtCur(stats.totalPOS)}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Principal outstanding balance
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
            <span>Buckets Active: <strong className="text-foreground">{stats.bucketData.length}</strong></span>
            <span
              className="text-[11px] text-primary font-semibold cursor-pointer hover:underline"
              onClick={() => navigate('/explorer')}
            >
              Explore Grid →
            </span>
          </div>
        </div>
      </div>

      {/* Bucket wise Collections & POS Performance */}
      <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden mb-6">
        <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            Bucket-wise Collections & Outstanding Portfolio
          </h3>
          <span className="text-xs text-muted-foreground">Comparative Volume vs Amount</span>
        </div>

        <div className="p-4 h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={stats.bucketData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-border/60" />
              <XAxis dataKey="bucket" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `₹${(v / 100000).toFixed(0)}L`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  borderColor: 'hsl(var(--border))',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  fontSize: '12px',
                  color: 'hsl(var(--foreground))'
                }}
                formatter={(value: any, name: string) => {
                  if (name === 'POS Outstanding') return [fmtCur(value), name];
                  return [Number(value).toLocaleString(), name];
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="pos" name="POS Outstanding" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Line yAxisId="right" type="monotone" dataKey="paid" name="Paid Cases" stroke="hsl(var(--success))" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line yAxisId="right" type="monotone" dataKey="unpaid" name="Unpaid Cases" stroke="hsl(var(--destructive))" strokeWidth={2.5} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Bucket Table */}
        <div className="overflow-x-auto border-t border-border">
          <table className="w-full text-xs text-left">
            <colgroup>
              <col className="w-32" />
              <col />
              <col />
              <col />
              <col />
              <col />
            </colgroup>
            <thead className="bg-muted/40 text-muted-foreground font-semibold uppercase text-[10px] tracking-wider border-b border-border">
              <tr>
                <th className="px-4 py-2.5">Bucket</th>
                <th className="px-4 py-2.5 text-right">Total Cases</th>
                <th className="px-4 py-2.5 text-right">Total POS</th>
                <th className="px-4 py-2.5 text-right text-emerald-600 dark:text-emerald-400">Paid Cases</th>
                <th className="px-4 py-2.5 text-right text-rose-600 dark:text-rose-400">Unpaid Cases</th>
                <th className="px-4 py-2.5 text-right">Recovery %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {stats.bucketData.map(b => {
                const recPct = b.pos > 0 ? (b.paidPos / b.pos) * 100 : 0;
                return (
                  <tr
                    key={b.bucket}
                    onClick={() => navigateToExplorer({ bucket: b.bucket })}
                    className="hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-2 font-bold text-foreground">Bkt {b.bucket}</td>
                    <td className="px-4 py-2 text-right font-tabular">{b.cases.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right font-tabular font-medium">{fmtCur(b.pos)}</td>
                    <td className="px-4 py-2 text-right font-tabular text-emerald-600 dark:text-emerald-400 font-semibold">{b.paid.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right font-tabular text-rose-600 dark:text-rose-400">{b.unpaid.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right font-tabular font-bold text-primary">{recPct.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-muted/30 font-bold border-t border-border">
              <tr>
                <td className="px-4 py-2.5 uppercase text-primary">Grand Total</td>
                <td className="px-4 py-2.5 text-right font-tabular">{stats.bucketData.reduce((a, b) => a + b.cases, 0).toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right font-tabular">{fmtCur(stats.bucketData.reduce((a, b) => a + b.pos, 0))}</td>
                <td className="px-4 py-2.5 text-right font-tabular text-emerald-600 dark:text-emerald-400">{stats.bucketData.reduce((a, b) => a + b.paid, 0).toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right font-tabular text-rose-600 dark:text-rose-400">{stats.bucketData.reduce((a, b) => a + b.unpaid, 0).toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right font-tabular text-primary">
                  {stats.totalPOS > 0 ? `${((stats.paidPOS / stats.totalPOS) * 100).toFixed(1)}%` : '—'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Top Cities & Bandwise Bifurcation Matrix */}
      <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden mb-6">
        <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Top Cities & Bandwise Bifurcation</h3>
          </div>
          <span className="text-xs text-muted-foreground font-tabular">
            {stats.cityData.length} active locations
          </span>
        </div>

        <div className="overflow-x-auto max-h-[420px] scrollbar-thin">
          <table className="w-full text-xs text-left whitespace-nowrap">
            <thead className="bg-muted/70 text-muted-foreground uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-border backdrop-blur-xs">
              <tr>
                <th className="px-3 py-2.5 text-center w-12 font-bold">#</th>
                <th className="px-4 py-2.5 font-bold">City</th>
                <th className="px-4 py-2.5 text-right font-bold">Total Cases</th>
                <th className="px-4 py-2.5 text-right font-bold">Total POS</th>
                <th className="px-3 py-2.5 text-center font-bold" colSpan={stats.sortedBands.length}>
                  POS Bands (Cases)
                </th>
              </tr>
              <tr className="border-t border-border/50 text-[9px] bg-muted/90">
                <th colSpan={4} className="bg-muted/90"></th>
                {stats.sortedBands.map((band, idx) => (
                  <th
                    key={band}
                    className={`px-2 py-1 text-center font-bold ${idx === 0 ? 'border-l border-border' : ''} ${idx === stats.sortedBands.length - 1 ? 'border-r border-border' : ''}`}
                  >
                    {band}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {stats.cityData.slice(0, 50).map((c, i) => (
                <tr key={c.city} className="hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 text-center text-muted-foreground font-tabular">{i + 1}</td>
                  <td
                    className="px-4 py-2 font-semibold text-foreground hover:text-primary cursor-pointer hover:underline"
                    onClick={() => navigateToExplorer({ city: c.city })}
                  >
                    {c.city}
                  </td>
                  <td
                    className="px-4 py-2 text-right font-tabular hover:text-primary cursor-pointer"
                    onClick={() => navigateToExplorer({ city: c.city })}
                  >
                    {c.cases.toLocaleString()}
                  </td>
                  <td
                    className="px-4 py-2 text-right font-tabular font-medium hover:text-primary cursor-pointer"
                    onClick={() => navigateToExplorer({ city: c.city })}
                  >
                    {fmtCur(c.pos)}
                  </td>
                  {stats.sortedBands.map((band, idx) => {
                    const cell = c.bands[band];
                    const val = cell ? cell.cases : 0;
                    const isSelected = selectedCells.has(`${c.city}:::${band}`);
                    return (
                      <td
                        key={band}
                        className={`px-2 py-1.5 text-center text-xs cursor-pointer font-tabular transition-colors ${idx === 0 ? 'border-l border-border/50' : ''} ${idx === stats.sortedBands.length - 1 ? 'border-r border-border/50' : ''} ${
                          isSelected
                            ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                            : 'hover:bg-primary/10 hover:text-primary'
                        }`}
                        onClick={() => handleCellClick(c.city, band)}
                      >
                        {val > 0 ? val : '—'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted/60 font-bold sticky bottom-0 z-10 border-t border-border shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
              <tr>
                <td className="px-3 py-2 text-center"></td>
                <td className="px-4 py-2 text-primary uppercase">Grand Total</td>
                <td className="px-4 py-2 text-right font-tabular">{stats.cityData.reduce((a, c) => a + c.cases, 0).toLocaleString()}</td>
                <td className="px-4 py-2 text-right font-tabular">{fmtCur(stats.cityData.reduce((a, c) => a + c.pos, 0))}</td>
                {stats.sortedBands.map(band => (
                  <td
                    key={'ft' + band}
                    className="px-2 py-2 text-center font-tabular hover:bg-primary/10 hover:text-primary cursor-pointer transition-colors"
                    onClick={() => navigateToExplorer({ band })}
                  >
                    {stats.cityData.reduce((a, c) => a + (c.bands[band] ? c.bands[band].cases : 0), 0).toLocaleString()}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="p-3 border-t border-border bg-muted/10 flex justify-between items-center text-xs text-muted-foreground">
          <span>Showing top 50 of {stats.cityData.length} cities</span>
          <button
            onClick={() => {
              const csv = ['City,Cases,Total POS,' + stats.sortedBands.join(','), ...stats.cityData.map(c => `"${c.city}",${c.cases},${c.pos},${stats.sortedBands.map(b => c.bands[b] ? c.bands[b].cases : 0).join(',')}`)].join('\n');
              const a = document.createElement('a');
              a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
              a.download = 'City_Bandwise.csv';
              a.click();
            }}
            className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
          >
            <Download className="h-3.5 w-3.5" /> Export Grid Data
          </button>
        </div>
      </div>

      {/* City by Bucket Paid/Unpaid Drilldown */}
      <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden mb-6">
        <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PieChartIcon className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">City & Bucket Paid vs Unpaid Deep Drilldown</h3>
          </div>
          <span className="text-xs text-muted-foreground">Click a city to inspect granular recovery status</span>
        </div>

        <div className="divide-y divide-border max-h-[400px] overflow-y-auto scrollbar-thin">
          {stats.cityData.slice(0, 20).map(c => {
            const isExpanded = !!expandedCities[c.city];
            const cityBuckets = Object.entries(c.buckets).sort(([a], [b]) => a.localeCompare(b));
            const cityPaid = cityBuckets.reduce((acc, [, v]) => acc + v.paid, 0);
            const cityUnpaid = cityBuckets.reduce((acc, [, v]) => acc + v.unpaid, 0);
            const recoveryPct = c.cases > 0 ? (cityPaid / c.cases) * 100 : 0;

            return (
              <div key={c.city} className="bg-card">
                <div
                  onClick={() => toggleCity(c.city)}
                  className="px-4 py-3 flex items-center justify-between hover:bg-muted/30 cursor-pointer transition-colors select-none"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-primary" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="font-bold text-sm text-foreground">{c.city}</span>
                    <span className="text-xs text-muted-foreground font-tabular">({c.cases} cases)</span>
                  </div>

                  <div className="flex items-center gap-6 text-xs font-tabular">
                    <span className="text-muted-foreground">POS: <strong className="text-foreground">{fmtCur(c.pos)}</strong></span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Paid: {cityPaid}</span>
                    <span className="text-rose-600 dark:text-rose-400 font-semibold">Unpaid: {cityUnpaid}</span>
                    <span className="font-bold text-primary">{recoveryPct.toFixed(1)}%</span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-6 py-3 bg-muted/20 border-t border-border animate-in fade-in duration-200">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                      {cityBuckets.map(([bktName, bktVal]) => (
                        <div
                          key={bktName}
                          onClick={() => navigateToExplorer({ city: c.city, bucket: bktName })}
                          className="bg-card border border-border/70 rounded-lg p-2.5 hover:border-primary/50 cursor-pointer transition-all shadow-2xs"
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-bold uppercase text-muted-foreground">Bkt {bktName}</span>
                            <span className="text-[10px] font-semibold text-primary font-tabular">{bktVal.cases} cases</span>
                          </div>
                          <div className="text-xs font-bold font-tabular text-foreground">{fmtCur(bktVal.pos)}</div>
                          <div className="flex justify-between text-[10px] font-tabular mt-1 pt-1 border-t border-border/50">
                            <span className="text-emerald-600 dark:text-emerald-400">Paid: {bktVal.paid}</span>
                            <span className="text-rose-600 dark:text-rose-400">Unpaid: {bktVal.unpaid}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Persistent Floating Bucket Filter (Accessible from anywhere on the page as you scroll) */}
      <FloatingBucketFilter className={selectedCells.size > 0 ? 'bottom-26 md:bottom-22' : ''} />

      {/* Floating Selected Cells Action Bar */}
      {selectedCells.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="bg-foreground text-background px-6 py-3.5 rounded-xl shadow-2xl flex items-center gap-6 font-medium border border-border/20">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center bg-background/20 text-background rounded-full w-7 h-7 font-bold text-xs font-tabular">
                {selectedCells.size}
              </span>
              <span className="text-xs uppercase font-bold tracking-wider">Cells Selected</span>
            </div>
            <div className="w-px h-5 bg-background/20"></div>
            <div className="flex flex-col">
              <span className="text-[10px] text-background/70 uppercase tracking-wider">Total Cases</span>
              <span className="font-extrabold text-sm leading-none font-tabular">{selectionStats.cases.toLocaleString()}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-background/70 uppercase tracking-wider">Total POS</span>
              <span className="font-extrabold text-sm leading-none font-tabular">{fmtCur(selectionStats.pos)}</span>
            </div>
            <div className="w-px h-5 bg-background/20"></div>
            <button
              onClick={() => setSelectedCells(new Set())}
              className="text-xs px-2.5 py-1 rounded-md hover:bg-background/20 transition-colors font-semibold"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
