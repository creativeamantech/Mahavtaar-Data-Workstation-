import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { useData } from '../contexts/DataContext';
import { useNavigate } from 'react-router-dom';
import { fmtCur } from '../lib/formatters';
import { Search, Download, Plus, X, ArrowUp, ArrowDown, Filter, MapPin, Database, DollarSign, Activity, FileText, Settings2 } from 'lucide-react';
import { Checkbox } from '../components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Link } from 'react-router-dom';
import { Slider } from '../components/ui/slider';
import { BucketFilter } from '../components/BucketFilter';

export default function BandExplorer() {
  const navigate = useNavigate();
  const { records, globalBucket, isLoading } = useData();

  const filteredRecords = useMemo(() => {
    if (!records) return [];
    if (globalBucket === 'ALL') return records;
    return records.filter((r: any) => String(r.bom_bkt).trim().toUpperCase() === globalBucket);
  }, [records, globalBucket]);

  const dataWithBands = useMemo(() => {
    return filteredRecords.map((r: any) => {
        return {
            ...r,
            _posVal: Number(r.principal_outstanding) || 0,
            _emiVal: Number(r.emi_amt) || 0,
            _aggr: r.agreementid || r.agreement_no || r.AGREEMENTNO || r.AGREEMENTID || '-',
            _name: r.customer_name || r.CUSTOMERNAME || r['Customer Name'] || r.CUSTOMER_NAME || '-',
            _city: (r.city || r.City || 'Unknown').trim().toUpperCase()
        };
    });
  }, [filteredRecords]);

  const [searchParams, setSearchParams] = useSearchParams();
  const absoluteMaxPos = useMemo(() => {
    let m = 50000;
    if (dataWithBands && dataWithBands.length > 0) {
      dataWithBands.forEach(r => {
        if (r._posVal > m) m = r._posVal;
      });
    }
    return Math.ceil(m / 5000) * 5000;
  }, [dataWithBands]);
  
  const minPos = Number(searchParams.get('minPos')) || 0;
  const maxPos = searchParams.has('maxPos') ? Number(searchParams.get('maxPos')) : absoluteMaxPos;
  const [tempMin, setTempMin] = useState<string>(String(minPos));
  const [tempMax, setTempMax] = useState<string>(String(searchParams.has('maxPos') ? maxPos : absoluteMaxPos));
  
  useEffect(() => {
    setTempMin(String(minPos));
    setTempMax(String(maxPos));
  }, [minPos, maxPos]);

  const [sortSearch, setSortSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc'|'desc'}[]>([{ key: 'city', direction: 'asc' }]);

  const handleApply = () => {
    const mn = Number(tempMin) || 0;
    const mx = Number(tempMax) || 0;
    const finalMin = Math.min(mn, mx);
    const finalMax = Math.max(mn, mx);
    if (mn > mx) {
        setTempMin(String(finalMin));
        setTempMax(String(finalMax));
    }
    const params = new URLSearchParams(searchParams);
    params.set('minPos', String(finalMin));
    params.set('maxPos', String(finalMax));
    setSearchParams(params, { replace: true });
  };


  useEffect(() => {
    const timer = setTimeout(() => {
      const mn = Number(tempMin) || 0;
      const mx = Number(tempMax) || 0;
      const finalMin = Math.min(mn, mx);
      const finalMax = Math.max(mn, mx);
      if (finalMin !== minPos || finalMax !== maxPos) {
        handleApply();
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [tempMin, tempMax, minPos, maxPos]);

  
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleApply();
  };

  const bandData = useMemo(() => {
     const filtered = dataWithBands.filter(r => r._posVal >= minPos && r._posVal <= maxPos);
     
     const cityCounts: Record<string, number> = {};
     filtered.forEach(r => {
        cityCounts[r._city] = (cityCounts[r._city] || 0) + 1;
     });

          return filtered.sort((a, b) => {
         for (const sort of sortConfig) {
             let comparison = 0;
             switch (sort.key) {
                case 'city_count':
                    comparison = (cityCounts[a._city] || 0) - (cityCounts[b._city] || 0);
                    if (comparison === 0) comparison = a._posVal - b._posVal;
                    break;
                case 'aggr':
                    comparison = (a._aggr || '').localeCompare(b._aggr || '');
                    break;
                case 'name':
                    comparison = (a._name || '').localeCompare(b._name || '');
                    break;
                case 'city':
                    comparison = (a._city || '').localeCompare(b._city || '');
                    break;
                case 'pos':
                case '_posVal':
                    comparison = a._posVal - b._posVal;
                    break;
                case 'emi':
                case '_emiVal':
                    comparison = a._emiVal - b._emiVal;
                    break;
             }
             if (comparison !== 0) {
                 return sort.direction === 'asc' ? comparison : -comparison;
             }
         }
         return 0;
     });
  }, [dataWithBands, minPos, maxPos, sortConfig]);

  const stats = useMemo(() => {
     const uniqueCities = new Set(bandData.map(r => r._city));
     const totalPos = bandData.reduce((sum, r) => sum + r._posVal, 0);
     return {
        count: bandData.length,
        citiesCount: uniqueCities.size,
        totalPos
     };
  }, [bandData]);

  const handleExport = () => {
     if (bandData.length === 0) return;
     const headers = ['Agreement Number', 'Customer Name', 'City', 'POS', 'EMI', 'Bucket'];
     const csv = [
        headers.join(','),
        ...bandData.map(r => [
            `"${r._aggr}"`,
            `"${r._name}"`,
            `"${r._city}"`,
            r._posVal,
            r._emiVal,
            `"${r.bom_bkt || ''}"`
        ].join(','))
     ].join('\n');
     const blob = new Blob([csv], { type: 'text/csv' });
     const url = URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = `Band_Export_${minPos}_to_${maxPos}.csv`;
     a.click();
  };

  if (isLoading) {
    return (
      <AppLayout>
      <div className="mb-4"><BucketFilter /></div>
        <div className="flex h-[50vh] items-center justify-center text-muted-foreground animate-pulse">
          Loading bandwidth data...
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
        <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
                <h1 className="font-sans text-2xl font-extrabold uppercase tracking-wide flex items-center gap-2">
                    <Activity className="h-6 w-6 text-primary" /> Top Cities & Bandwidth Explorer
                </h1>
                <p className="text-sm text-muted-foreground mt-1">Detailed bifurcation of cases by custom POS bandwidth range.</p>
            </div>
            <button onClick={handleExport} className="flex h-[34px] items-center gap-2 rounded-md bg-primary px-4 font-sans text-xs font-bold text-primary-foreground hover:opacity-90">
                <Download className="h-3.5 w-3.5" /> Export Cases
            </button>
        </div>

        {/* Filter Section */}
        <div className="bg-card border border-border p-4 rounded-xl shadow-sm mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <Settings2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-bold uppercase text-foreground whitespace-nowrap">Select Range:</span>
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-[400px]">
                    <div className="flex items-center gap-2 w-full">
                        <span className="text-xs font-bold text-muted-foreground min-w-[50px] text-right">{fmtCur(Number(tempMin))}</span>
                        <Slider 
                            min={0} 
                            max={absoluteMaxPos} 
                            step={500}
                            value={[Number(tempMin) || 0, Number(tempMax) || absoluteMaxPos]} 
                            onValueChange={(vals) => {
                                setTempMin(String(vals[0]));
                                setTempMax(String(vals[1]));
                            }}
                            className="flex-1 min-w-[150px]"
                        />
                        <span className="text-xs font-bold text-muted-foreground min-w-[60px]">{fmtCur(Number(tempMax))}</span>
                    </div>

                </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-4 sm:mt-0">
              <Popover>
                <PopoverTrigger asChild>
                  <button className="flex h-8 items-center gap-1.5 px-3 rounded-md border border-dashed border-border hover:bg-muted text-xs font-bold text-muted-foreground uppercase tracking-wider bg-card">
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
          <div className="flex flex-col gap-1 max-h-64 overflow-y-auto no-scrollbar pr-2">
            {[
              { key: 'aggr', label: 'Agreement Number' },
              { key: 'name', label: 'Customer Name' },
              { key: 'city', label: 'City' },
              { key: '_posVal', label: 'Principal (POS)' },
              { key: '_emiVal', label: 'EMI' }
            ].filter(opt => opt.label.toLowerCase().includes(sortSearch.toLowerCase())).map(opt => (
              <div key={opt.key} className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded transition-colors cursor-pointer" onClick={() => {
                setSortConfig(prev => {
                  const exists = prev.find(s => s.key === opt.key);
                  if (exists) return prev.filter(s => s.key !== opt.key);
                  return [...prev, { key: opt.key, direction: 'asc' }];
                });
              }}>
                <Checkbox className="pointer-events-none" checked={!!sortConfig.find(s => s.key === opt.key)} />
                <span className="text-xs truncate flex-1">{opt.label}</span>
              </div>
            ))}
          </div>
                </PopoverContent>
              </Popover>
              
    {sortConfig.map(sort => {
    const labels: Record<string, string> = { city: 'City', collection: 'Collection', count: 'Total Count', paidCount: 'Paid Count', totalPOS: 'Total POS', paidPOS: 'Paid POS', pct: 'Paid %', team: 'Team', exec: 'Executive', target: 'Target', ach: 'Achieved', _posVal: 'Principal (POS)', _emiVal: 'EMI', aggr: 'Agreement Number', name: 'Customer Name' };
    return (
      <div key={sort.key} className="flex h-8 items-center gap-1.5 bg-muted/50 border border-border px-2 rounded-md text-xs font-bold uppercase tracking-wider text-foreground">
          Sort: {labels[sort.key] || sort.key}
          <button onClick={() => setSortConfig(prev => prev.map(s => s.key === sort.key ? { ...s, direction: s.direction === 'asc' ? 'desc' : 'asc' } : s))} className="ml-1 text-muted-foreground hover:text-foreground">
            {sort.direction === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
          </button>
          <button onClick={() => setSortConfig(prev => prev.filter(s => s.key !== sort.key))} className="ml-1 text-muted-foreground hover:text-destructive">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
    );
  })}
  
            </div>
        </div>


        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-card border border-border p-6 rounded-xl shadow-sm flex flex-col justify-center transition-all hover:bg-muted/10">
                <div className="flex items-center gap-2 text-muted-foreground mb-2 font-medium">
                    <Database className="h-4 w-4" /> Total Count (In Range)
                </div>
                <div className="text-3xl font-bold">{stats.count.toLocaleString()}</div>
            </div>
            <div className="bg-card border border-border p-6 rounded-xl shadow-sm flex flex-col justify-center transition-all hover:bg-muted/10">
                <div className="flex items-center gap-2 text-muted-foreground mb-2 font-medium">
                    <DollarSign className="h-4 w-4" /> Principal Outstanding
                </div>
                <div className="text-3xl font-bold text-warning">{fmtCur(stats.totalPos)}</div>
            </div>
            <div className="bg-card border border-border p-6 rounded-xl shadow-sm flex flex-col justify-center transition-all hover:bg-muted/10">
                <div className="flex items-center gap-2 text-muted-foreground mb-2 font-medium">
                    <MapPin className="h-4 w-4" /> Cities Involved
                </div>
                <div className="text-3xl font-bold text-info">{stats.citiesCount.toLocaleString()}</div>
            </div>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/20 flex justify-between items-center">
                <h3 className="font-semibold flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4" /> Actual Cases for Range {fmtCur(minPos)} - {fmtCur(maxPos)}
                </h3>
                <span className="text-xs font-bold text-muted-foreground bg-background px-2 py-1 rounded-md border border-border">
                    {stats.count} Records
                </span>
            </div>
            <div className="overflow-x-auto max-h-[600px] relative scrollbar-thin">
                <table className="w-full text-sm text-left whitespace-nowrap">
                    <thead className="text-xs uppercase sticky top-0 z-20 shadow-md">
                        <tr className="bg-muted text-muted-foreground">
                            <th className="px-4 py-3 font-semibold border-b border-border bg-muted">
                                <div className="flex items-center">Agreement Number</div>
                            </th>
                            <th className="px-4 py-3 font-semibold border-b border-border bg-muted">
                                <div className="flex items-center">Customer Name</div>
                            </th>
                            <th className="px-4 py-3 font-semibold border-b border-border bg-muted">
                                <div className="flex items-center">City</div>
                            </th>
                            <th className="px-4 py-3 font-semibold border-b border-border bg-muted">
                                <div className="flex items-center justify-end">Principal (POS)</div>
                            </th>
                            <th className="px-4 py-3 font-semibold border-b border-border bg-muted">
                                <div className="flex items-center justify-end">EMI</div>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {bandData.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                                    No cases found for this range.
                                </td>
                            </tr>
                        ) : (
                            bandData.map((row, idx) => (
                                <tr key={idx} className="hover:bg-muted/30 transition-colors group cursor-pointer" onClick={() => { navigate(`/explorer?q=${encodeURIComponent(row._aggr)}`); }}>
                                    <td className="px-4 py-3 font-medium">
                                        <Link to={`/explorer?q=${encodeURIComponent(row._aggr)}`} className="text-primary hover:underline group-hover:text-primary/80 transition-colors" onClick={(e) => e.stopPropagation()}>
                                            {row._aggr}
                                        </Link>
                                    </td>
                                    <td className="px-4 py-3 truncate max-w-[200px]">{row._name}</td>
                                    <td className="px-4 py-3">{row._city}</td>
                                    <td className="px-4 py-3 text-right font-semibold text-foreground">{fmtCur(row._posVal)}</td>
                                    <td className="px-4 py-3 text-right text-muted-foreground">{fmtCur(row._emiVal)}</td>
                                </tr>
                            ))
                        )}
                    </tbody>

                    <tfoot className="bg-primary/10 font-bold sticky bottom-0 z-10 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] cursor-pointer hover:bg-primary/20 transition-colors" onClick={() => { navigate(`/explorer?minPos=${minPos}&maxPos=${maxPos}${globalBucket !== 'ALL' ? `&bucket=${globalBucket}` : ''}`); }}>
                        <tr>
                            <td colSpan={1} className="px-4 py-3 text-right sm:hidden">Total</td><td colSpan={2} className="px-4 py-3 text-right md:hidden">Total</td><td colSpan={3} className="px-4 py-3 text-right">Grand Total (Click to view all)</td>
                            <td className="px-4 py-3 text-right text-warning">{fmtCur(stats.totalPos)}</td>
                            <td className="px-4 py-3 text-right text-muted-foreground">{fmtCur(bandData.reduce((sum, r) => sum + r._emiVal, 0))}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    </AppLayout>
  );
}
