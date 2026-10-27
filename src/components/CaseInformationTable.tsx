import React, { useState, useMemo } from 'react';
import { Search, Filter, CheckSquare, UserCircle2, ArrowUpDown, Undo2, Building2 } from 'lucide-react';
import { fmtCur } from '../lib/formatters';
import { Button } from './ui/button';

export default function CaseInformationTable({ 
  records, 
  executives, 
  initialCityFilter, 
  initialBucketFilter,
  onSwitchToMatrix,
  onAssignSingle,
  onAssignBatch
}: any) {
  const [searchTerm, setSearchTerm] = useState('');
  const [cityFilter, setCityFilter] = useState(initialCityFilter || 'all');
  const [bucketFilter, setBucketFilter] = useState(initialBucketFilter || 'all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedCases, setSelectedCases] = useState<Set<string>>(new Set());
  const [batchExec, setBatchExec] = useState('');

  const filteredRecords = useMemo(() => {
    return records.filter((r: any) => {
      const city = String(r.city || r.City || r.location || '').trim();
      const bucket = String(r.bom_bkt || '').trim();
      const exec = String(r.executive_name || r['Executive Name'] || r.EXECUTIVE_NAME || '').trim();
      const name = String(r.customer_name || '').toLowerCase();
      const agreement = String(r.agreementid || r.agreement_no || r.id || '').toLowerCase();

      if (cityFilter !== 'all' && city !== cityFilter) return false;
      if (bucketFilter !== 'all' && bucket !== bucketFilter) return false;
      if (statusFilter === 'unallocated' && exec) return false;
      if (statusFilter === 'allocated' && !exec) return false;
      
      if (searchTerm) {
        const lowerSearch = searchTerm.toLowerCase();
        if (!name.includes(lowerSearch) && !agreement.includes(lowerSearch) && !city.toLowerCase().includes(lowerSearch)) {
          return false;
        }
      }

      return true;
    });
  }, [records, cityFilter, bucketFilter, statusFilter, searchTerm]);

  const uniqueCities = useMemo(() => Array.from(new Set(records.map((r:any) => String(r.city || r.City || r.location || '').trim()).filter(Boolean))).sort(), [records]);
  const uniqueBuckets = useMemo(() => Array.from(new Set(records.map((r:any) => String(r.bom_bkt || '').trim()).filter(Boolean))).sort(), [records]);

  const handleToggleSelectAll = () => {
    if (selectedCases.size === filteredRecords.length && filteredRecords.length > 0) {
      setSelectedCases(new Set());
    } else {
      setSelectedCases(new Set(filteredRecords.map((r:any) => String(r.agreementid || r.agreement_no || r.id))));
    }
  };

  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedCases);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedCases(next);
  };

  const handleBatchAssign = () => {
    if (selectedCases.size === 0 || !batchExec) return;
    onAssignBatch(Array.from(selectedCases), batchExec);
    setSelectedCases(new Set());
    setBatchExec('');
  };

  return (
    <div className="space-y-4">
      {/* Filters and Actions */}
      <div className="bg-card border border-border p-4 rounded-xl shadow-sm flex flex-col xl:flex-row gap-4 justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-2.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search cases..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="h-9 pl-9 pr-4 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary w-64"
            />
          </div>
          
          <select value={cityFilter} onChange={e => setCityFilter(e.target.value)} className="h-9 px-3 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary">
            <option value="all">All Cities</option>
            {uniqueCities.map((c:any) => <option key={c} value={c}>{c}</option>)}
          </select>

          <select value={bucketFilter} onChange={e => setBucketFilter(e.target.value)} className="h-9 px-3 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary">
            <option value="all">All Buckets</option>
            {uniqueBuckets.map((b:any) => {
              const str = String(b).trim();
              const label = str.toUpperCase().startsWith('BKT') || str.toUpperCase().startsWith('BUCKET')
                ? str
                : !isNaN(Number(str))
                ? `BKT ${str}`
                : str;
              return <option key={b} value={b}>{label}</option>;
            })}
          </select>

          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-9 px-3 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary">
            <option value="all">All Statuses</option>
            <option value="unallocated">Unallocated Only</option>
            <option value="allocated">Allocated Only</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          {onSwitchToMatrix && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSwitchToMatrix}
              className="h-9 text-xs font-bold text-primary border-primary/30 hover:bg-primary/10"
              title="Switch back to City & Bucket Portfolio Matrix"
            >
              <Building2 className="h-3.5 w-3.5 mr-1.5" />
              Portfolio Matrix
            </Button>
          )}

          {selectedCases.size > 0 && (
            <div className="flex items-center gap-2 bg-primary/10 p-1.5 rounded-lg border border-primary/20">
              <span className="text-xs font-bold text-primary px-2">{selectedCases.size} selected</span>
              <select value={batchExec} onChange={e => setBatchExec(e.target.value)} className="h-7 px-2 py-0 text-xs rounded bg-background border border-border outline-none focus:border-primary">
                <option value="">Select Executive...</option>
                {executives.map((e:any) => <option key={e} value={e}>{e}</option>)}
              </select>
              <Button size="sm" className="h-7 text-xs px-3" disabled={!batchExec} onClick={handleBatchAssign}>Assign Batch</Button>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 w-10 text-center font-black uppercase tracking-widest text-[10px] text-muted-foreground">S.No.</th>
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" checked={selectedCases.size === filteredRecords.length && filteredRecords.length > 0} onChange={handleToggleSelectAll} className="rounded border-border" />
                </th>
                <th className="px-4 py-3 font-black uppercase tracking-widest text-[10px] text-muted-foreground">Agreement ID</th>
                <th className="px-4 py-3 font-black uppercase tracking-widest text-[10px] text-muted-foreground">Customer Name</th>
                <th className="px-4 py-3 font-black uppercase tracking-widest text-[10px] text-muted-foreground">City</th>
                <th className="px-4 py-3 font-black uppercase tracking-widest text-[10px] text-muted-foreground">Bucket</th>
                <th className="px-4 py-3 font-black uppercase tracking-widest text-[10px] text-muted-foreground text-right">POS Amount</th>
                <th className="px-4 py-3 font-black uppercase tracking-widest text-[10px] text-muted-foreground">Assigned Executive</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredRecords.slice(0, 100).map((r:any, i:number) => {
                const id = String(r.agreementid || r.agreement_no || r.id);
                const pos = Number(r.principal_outstanding) || Number(r.amount) || 0;
                const exec = String(r.executive_name || r['Executive Name'] || r.EXECUTIVE_NAME || '').trim();
                const isSelected = selectedCases.has(id);
                
                return (
                  <tr key={id} className={`hover:bg-muted/30 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}>
                    
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={isSelected} onChange={() => handleToggleSelect(id)} className="rounded border-border" />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{id}</td>
                    <td className="px-4 py-3 font-medium">{r.customer_name || 'N/A'}</td>
                    <td className="px-4 py-3">{r.city || r.City || r.location}</td>
                    <td className="px-4 py-3 text-center"><span className="bg-muted text-muted-foreground text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">{r.bom_bkt}</span></td>
                    <td className="px-4 py-3 text-right font-medium">{fmtCur(pos)}</td>
                    <td className="px-4 py-3">
                      <select 
                        value={exec} 
                        onChange={(e) => onAssignSingle(id, e.target.value)}
                        className={`h-8 px-2 py-1 text-xs rounded border outline-none w-48 ${exec ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-bold' : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400 font-bold'}`}
                      >
                        <option value="">-- Unallocated --</option>
                        {executives.map((e:any) => <option key={e} value={e}>{e}</option>)}
                      </select>
                    </td>
                  </tr>
                );
              })}
              {filteredRecords.length > 100 && (
                <tr>
                  
                    <td colSpan={8} className="px-4 py-4 text-center text-xs text-muted-foreground font-medium">
                    Showing 100 of {filteredRecords.length} records. Use filters to narrow down the results.
                  </td>
                </tr>
              )}
              {filteredRecords.length === 0 && (
                <tr>
                  
                    <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground font-medium">
                    No cases match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
