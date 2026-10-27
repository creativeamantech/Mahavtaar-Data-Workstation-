/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useMemo } from 'react';
import { fmtCur } from '../lib/formatters';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription 
} from '@/components/ui/sheet';
import { 
  Search, 
  Filter, 
  X, 
  UserCheck, 
  UserX, 
  User, 
  MapPin, 
  Phone, 
  IndianRupee, 
  Building2, 
  Layers, 
  Sparkles, 
  ArrowUpDown, 
  ChevronLeft, 
  ChevronRight, 
  Eye, 
  CheckCircle2, 
  Clock, 
  Download,
  AlertCircle,
  FileSpreadsheet,
  SlidersHorizontal
} from 'lucide-react';
import { toast } from 'sonner';

interface CaseInformationTableProps {
  records: any[];
  availableAgents: string[];
  onAssignSingle: (agreementId: string, agentName: string) => Promise<void> | void;
  onAssignBatch: (agreementIds: string[], agentName: string) => Promise<void> | void;
  onOpenMultiDistribute?: (cases: any[]) => void;
  onSwitchToMatrix?: () => void;
  initialCityFilter?: string;
  initialBucketFilter?: string;
}

export function CaseInformationTable({
  records,
  availableAgents,
  onAssignSingle,
  onAssignBatch,
  onOpenMultiDistribute,
  onSwitchToMatrix,
  initialCityFilter = 'all',
  initialBucketFilter = 'all',
}: CaseInformationTableProps) {
  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCity, setSelectedCity] = useState<string>(initialCityFilter);
  const [selectedBucket, setSelectedBucket] = useState<string>(initialBucketFilter);
  const [allocationStatus, setAllocationStatus] = useState<'all' | 'unallocated' | 'allocated'>('all');
  const [selectedExecutive, setSelectedExecutive] = useState<string>('all');

  // Sorting
  const [sortField, setSortField] = useState<string>('pos');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Selection
  const [selectedCaseIds, setSelectedCaseIds] = useState<Set<string>>(new Set());

  // Batch action state
  const [batchTargetAgent, setBatchTargetAgent] = useState('');
  const [isBatchApplying, setIsBatchApplying] = useState(false);

  // Inspect Dossier Sheet
  const [inspectCase, setInspectCase] = useState<any | null>(null);

  // Extract distinct lists for filters
  const cities = useMemo(() => {
    const s = new Set<string>();
    records.forEach(r => {
      const c = r.city || r.City || r.location;
      if (c) s.add(String(c).trim());
    });
    return Array.from(s).sort();
  }, [records]);

  const buckets = useMemo(() => {
    const s = new Set<string>();
    records.forEach(r => {
      const b = r.bom_bkt || r.bucket || r.Bucket;
      if (b) s.add(String(b).trim());
    });
    return Array.from(s).sort();
  }, [records]);

  const executives = useMemo(() => {
    const s = new Set<string>();
    records.forEach(r => {
      const e = r.executive_name || r['Executive Name'] || r.EXECUTIVE_NAME;
      if (e && String(e).trim()) s.add(String(e).trim());
    });
    return Array.from(s).sort();
  }, [records]);

  // Combined agent options (from available agents prop + existing)
  const allAgentOptions = useMemo(() => {
    const s = new Set<string>([...availableAgents, ...executives]);
    return Array.from(s).filter(Boolean).sort();
  }, [availableAgents, executives]);

  // Filtered dataset
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      // City filter
      if (selectedCity !== 'all') {
        const c = String(r.city || r.City || '').trim().toLowerCase();
        if (c !== selectedCity.toLowerCase()) return false;
      }

      // Bucket filter
      if (selectedBucket !== 'all') {
        const b = String(r.bom_bkt || r.bucket || '').trim().toLowerCase();
        if (b !== selectedBucket.toLowerCase()) return false;
      }

      // Executive filter
      if (selectedExecutive !== 'all') {
        const e = String(r.executive_name || r['Executive Name'] || '').trim().toLowerCase();
        if (e !== selectedExecutive.toLowerCase()) return false;
      }

      // Allocation status
      const currentExec = String(r.executive_name || r['Executive Name'] || '').trim();
      if (allocationStatus === 'unallocated' && currentExec !== '') return false;
      if (allocationStatus === 'allocated' && currentExec === '') return false;

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const agreementId = String(r.agreementid || r.agreement_no || r.id || r.loan_id || '').toLowerCase();
        const customerName = String(r.customer_name || r['Customer Name'] || r.name || '').toLowerCase();
        const phone = String(r.phone_no || r.mobile || r.phone || r.contact || '').toLowerCase();
        const city = String(r.city || r.City || '').toLowerCase();

        if (
          !agreementId.includes(q) &&
          !customerName.includes(q) &&
          !phone.includes(q) &&
          !city.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [records, selectedCity, selectedBucket, selectedExecutive, allocationStatus, searchTerm]);

  // Sorted dataset
  const sortedRecords = useMemo(() => {
    const list = [...filteredRecords];
    list.sort((a, b) => {
      let valA: any = 0;
      let valB: any = 0;

      if (sortField === 'pos') {
        valA = Number(a.principal_outstanding) || Number(a.amount) || 0;
        valB = Number(b.principal_outstanding) || Number(b.amount) || 0;
      } else if (sortField === 'agreementid') {
        valA = String(a.agreementid || a.agreement_no || a.id || '');
        valB = String(b.agreementid || b.agreement_no || b.id || '');
      } else if (sortField === 'customer') {
        valA = String(a.customer_name || a['Customer Name'] || '');
        valB = String(b.customer_name || b['Customer Name'] || '');
      } else if (sortField === 'city') {
        valA = String(a.city || a.City || '');
        valB = String(b.city || b.City || '');
      } else if (sortField === 'bucket') {
        valA = String(a.bom_bkt || a.bucket || '');
        valB = String(b.bom_bkt || b.bucket || '');
      } else if (sortField === 'executive') {
        valA = String(a.executive_name || a['Executive Name'] || '');
        valB = String(b.executive_name || b['Executive Name'] || '');
      }

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDir === 'asc' ? valA - valB : valB - valA;
      }
      return sortDir === 'asc' 
        ? String(valA).localeCompare(String(valB)) 
        : String(valB).localeCompare(String(valA));
    });
    return list;
  }, [filteredRecords, sortField, sortDir]);

  // Paginated dataset
  const totalItems = sortedRecords.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRecords.slice(start, start + pageSize);
  }, [sortedRecords, currentPage, pageSize]);

  // Summary Metrics of filtered subset
  const filteredMetrics = useMemo(() => {
    let unallocatedCount = 0;
    let unallocatedPOS = 0;
    let totalPOS = 0;

    filteredRecords.forEach(r => {
      const pos = Number(r.principal_outstanding) || Number(r.amount) || 0;
      totalPOS += pos;
      const exec = String(r.executive_name || r['Executive Name'] || '').trim();
      if (!exec) {
        unallocatedCount++;
        unallocatedPOS += pos;
      }
    });

    return {
      totalCount: filteredRecords.length,
      totalPOS,
      unallocatedCount,
      unallocatedPOS,
      allocatedCount: filteredRecords.length - unallocatedCount,
    };
  }, [filteredRecords]);

  // Selected cases calculation
  const selectedRecords = useMemo(() => {
    if (selectedCaseIds.size === 0) return [];
    return records.filter(r => {
      const id = String(r.agreementid || r.agreement_no || r.id || r.loan_id);
      return selectedCaseIds.has(id);
    });
  }, [records, selectedCaseIds]);

  const selectedTotalPOS = useMemo(() => {
    return selectedRecords.reduce((sum, r) => sum + (Number(r.principal_outstanding) || Number(r.amount) || 0), 0);
  }, [selectedRecords]);

  // Handle Sort Toggle
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  // Toggle selection for all visible or all filtered
  const handleSelectAllVisible = (checked: boolean) => {
    const next = new Set(selectedCaseIds);
    if (checked) {
      pagedRecords.forEach(r => {
        const id = String(r.agreementid || r.agreement_no || r.id || r.loan_id);
        next.add(id);
      });
    } else {
      pagedRecords.forEach(r => {
        const id = String(r.agreementid || r.agreement_no || r.id || r.loan_id);
        next.delete(id);
      });
    }
    setSelectedCaseIds(next);
  };

  const handleSelectAllFiltered = () => {
    const next = new Set<string>();
    sortedRecords.forEach(r => {
      const id = String(r.agreementid || r.agreement_no || r.id || r.loan_id);
      next.add(id);
    });
    setSelectedCaseIds(next);
    toast.success(`Selected all ${sortedRecords.length} filtered cases.`);
  };

  const handleClearSelection = () => {
    setSelectedCaseIds(new Set());
  };

  const handleToggleRow = (id: string) => {
    const next = new Set(selectedCaseIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedCaseIds(next);
  };

  // Inline assignment change
  const handleInlineAssign = async (agreementId: string, newAgent: string) => {
    try {
      await onAssignSingle(agreementId, newAgent);
      toast.success(`Case ${agreementId} assigned to ${newAgent || 'Unallocated'}`);
    } catch (e: any) {
      toast.error(e.message || "Failed to update case assignment.");
    }
  };

  // Batch assign selected
  const handleApplyBatchAssign = async () => {
    if (selectedCaseIds.size === 0) {
      toast.error("No cases selected.");
      return;
    }
    if (!batchTargetAgent) {
      toast.error("Please select a target executive for assignment.");
      return;
    }

    try {
      setIsBatchApplying(true);
      const ids = Array.from(selectedCaseIds);
      await onAssignBatch(ids, batchTargetAgent);
      toast.success(`Successfully assigned ${ids.length} cases to ${batchTargetAgent}!`);
      setSelectedCaseIds(new Set());
    } catch (e: any) {
      toast.error(e.message || "Batch assignment failed.");
    } finally {
      setIsBatchApplying(false);
    }
  };

  // Export filtered cases to CSV
  const handleExportFiltered = () => {
    let csv = "Agreement ID,Customer Name,Phone,City,Bucket,POS (Rs),EMI,Executive Name,Status\n";
    sortedRecords.forEach(r => {
      const id = String(r.agreementid || r.agreement_no || r.id || '');
      const name = String(r.customer_name || r['Customer Name'] || '').replace(/"/g, '""');
      const phone = String(r.phone_no || r.mobile || r.phone || '');
      const city = String(r.city || r.City || '');
      const bucket = String(r.bom_bkt || r.bucket || '');
      const pos = Number(r.principal_outstanding) || Number(r.amount) || 0;
      const emi = Number(r.emi_amount) || Number(r.emi) || 0;
      const exec = String(r.executive_name || r['Executive Name'] || 'Unassigned').replace(/"/g, '""');
      const status = exec !== 'Unassigned' ? 'Allocated' : 'Unallocated';

      csv += `"${id}","${name}","${phone}","${city}","${bucket}",${pos},${emi},"${exec}","${status}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Case_Information_Export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success(`Exported ${sortedRecords.length} cases.`);
  };

  const isAllVisibleSelected = pagedRecords.length > 0 && pagedRecords.every(r => {
    const id = String(r.agreementid || r.agreement_no || r.id || r.loan_id);
    return selectedCaseIds.has(id);
  });

  return (
    <div className="space-y-4">
      {/* Header Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-3.5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Showing Cases</p>
            <h4 className="text-lg font-bold text-foreground mt-0.5">{filteredMetrics.totalCount}</h4>
            <p className="text-xs font-semibold text-muted-foreground">{fmtCur(filteredMetrics.totalPOS)}</p>
          </div>
          <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <FileSpreadsheet className="h-4 w-4" />
          </div>
        </div>

        <div className="bg-card border border-amber-500/30 rounded-xl p-3.5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Pending Assignment</p>
            <h4 className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-0.5">{filteredMetrics.unallocatedCount}</h4>
            <p className="text-xs font-semibold text-muted-foreground">{fmtCur(filteredMetrics.unallocatedPOS)}</p>
          </div>
          <div className="h-9 w-9 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <UserX className="h-4 w-4" />
          </div>
        </div>

        <div className="bg-card border border-emerald-500/20 rounded-xl p-3.5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Allocated to Agents</p>
            <h4 className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{filteredMetrics.allocatedCount}</h4>
            <p className="text-xs font-semibold text-muted-foreground">{fmtCur(filteredMetrics.totalPOS - filteredMetrics.unallocatedPOS)}</p>
          </div>
          <div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <UserCheck className="h-4 w-4" />
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-3.5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Selected For Batch</p>
            <h4 className="text-lg font-bold text-primary mt-0.5">{selectedCaseIds.size} Cases</h4>
            <p className="text-xs font-semibold text-muted-foreground">{fmtCur(selectedTotalPOS)}</p>
          </div>
          <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <CheckCircle2 className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* Search & Filter Controls Toolbar */}
      <div className="bg-card border border-border rounded-xl p-3.5 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center gap-2.5 justify-between">
          {/* Main Search Input */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="h-4 w-4 absolute left-3 top-2.5 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              placeholder="Search Agreement ID, Customer Name, Phone, City..."
              className="h-9 pl-9 text-xs"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Allocation Status Toggle */}
            <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/30">
              <button
                type="button"
                onClick={() => { setAllocationStatus('all'); setPage(1); }}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                  allocationStatus === 'all' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                All ({records.length})
              </button>
              <button
                type="button"
                onClick={() => { setAllocationStatus('unallocated'); setPage(1); }}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                  allocationStatus === 'unallocated' ? 'bg-amber-600 text-white shadow-xs' : 'text-amber-600 dark:text-amber-400 hover:text-foreground'
                }`}
              >
                Pending
              </button>
              <button
                type="button"
                onClick={() => { setAllocationStatus('allocated'); setPage(1); }}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                  allocationStatus === 'allocated' ? 'bg-emerald-600 text-white shadow-xs' : 'text-emerald-600 dark:text-emerald-400 hover:text-foreground'
                }`}
              >
                Allocated
              </button>
            </div>

            {/* City Filter */}
            <select
              value={selectedCity}
              onChange={(e) => { setSelectedCity(e.target.value); setPage(1); }}
              className="h-9 px-2.5 rounded-lg border border-border bg-background text-xs font-medium text-foreground outline-none focus:border-primary"
            >
              <option value="all">All Cities ({cities.length})</option>
              {cities.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* Bucket Filter */}
            <select
              value={selectedBucket}
              onChange={(e) => { setSelectedBucket(e.target.value); setPage(1); }}
              className="h-9 px-2.5 rounded-lg border border-border bg-background text-xs font-medium text-foreground outline-none focus:border-primary"
            >
              <option value="all">All Buckets</option>
              {buckets.map(b => (
                <option key={b} value={b}>Bucket {b}</option>
              ))}
            </select>

            {/* Executive Filter */}
            <select
              value={selectedExecutive}
              onChange={(e) => { setSelectedExecutive(e.target.value); setPage(1); }}
              className="h-9 px-2.5 rounded-lg border border-border bg-background text-xs font-medium text-foreground outline-none focus:border-primary"
            >
              <option value="all">All Executives</option>
              {executives.map(e => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>

            {/* Reset Filters */}
            {(selectedCity !== 'all' || selectedBucket !== 'all' || selectedExecutive !== 'all' || allocationStatus !== 'all' || searchTerm) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedCity('all');
                  setSelectedBucket('all');
                  setSelectedExecutive('all');
                  setAllocationStatus('all');
                  setSearchTerm('');
                  setPage(1);
                }}
                className="h-9 text-xs text-muted-foreground hover:text-destructive"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Reset
              </Button>
            )}

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

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportFiltered}
              className="h-9 text-xs font-semibold"
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              Export
            </Button>
          </div>
        </div>

        {/* Batch Operations Bar (When cases are selected) */}
        {selectedCaseIds.size > 0 && (
          <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="bg-primary text-primary-foreground font-bold">
                {selectedCaseIds.size} Selected
              </Badge>
              <span className="text-xs font-semibold text-foreground">
                Total Value: <span className="font-bold text-primary">{fmtCur(selectedTotalPOS)}</span>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground uppercase">Assign To:</span>
              <select
                value={batchTargetAgent}
                onChange={(e) => setBatchTargetAgent(e.target.value)}
                className="h-8 px-2.5 rounded-md border border-border bg-background text-xs font-medium text-foreground outline-none focus:border-primary"
              >
                <option value="">-- Choose Executive --</option>
                {allAgentOptions.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>

              <Button
                size="sm"
                onClick={handleApplyBatchAssign}
                disabled={!batchTargetAgent || isBatchApplying}
                className="h-8 text-xs font-bold bg-primary text-primary-foreground shadow-xs"
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                {isBatchApplying ? 'Assigning...' : `Apply Assignment`}
              </Button>

              {onOpenMultiDistribute && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onOpenMultiDistribute(selectedRecords)}
                  className="h-8 text-xs font-bold border-primary text-primary hover:bg-primary/10"
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                  Split Across Multiple Agents
                </Button>
              )}

              <Button
                size="sm"
                variant="ghost"
                onClick={handleClearSelection}
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Case Data Table */}
      <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/40 border-b border-border text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3 w-10 text-center">
                  <Checkbox
                    checked={isAllVisibleSelected}
                    onCheckedChange={(checked) => handleSelectAllVisible(!!checked)}
                    className="border-muted-foreground data-[state=checked]:bg-primary"
                    aria-label="Select visible rows"
                  />
                </th>
                <th className="p-3 cursor-pointer hover:text-foreground" onClick={() => handleSort('agreementid')}>
                  <div className="flex items-center gap-1">
                    Agreement ID
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="p-3 cursor-pointer hover:text-foreground" onClick={() => handleSort('customer')}>
                  <div className="flex items-center gap-1">
                    Customer Particulars
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="p-3 cursor-pointer hover:text-foreground" onClick={() => handleSort('city')}>
                  <div className="flex items-center gap-1">
                    City / Location
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="p-3 text-center cursor-pointer hover:text-foreground" onClick={() => handleSort('bucket')}>
                  <div className="flex items-center justify-center gap-1">
                    Bucket
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="p-3 text-right cursor-pointer hover:text-foreground" onClick={() => handleSort('pos')}>
                  <div className="flex items-center justify-end gap-1">
                    Principal POS (₹)
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="p-3 cursor-pointer hover:text-foreground" onClick={() => handleSort('executive')}>
                  <div className="flex items-center gap-1">
                    Assigned Field Executive
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="p-3 text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pagedRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    <AlertCircle className="h-6 w-6 mx-auto mb-2 opacity-50" />
                    No cases match the current filter criteria.
                  </td>
                </tr>
              ) : (
                pagedRecords.map((record) => {
                  const id = String(record.agreementid || record.agreement_no || record.id || record.loan_id);
                  const isSelected = selectedCaseIds.has(id);
                  const customerName = record.customer_name || record['Customer Name'] || record.name || 'N/A';
                  const phone = record.phone_no || record.mobile || record.phone || record.contact;
                  const city = record.city || record.City || record.location || 'Unknown';
                  const bucket = record.bom_bkt || record.bucket || record.Bucket || '1';
                  const pos = Number(record.principal_outstanding) || Number(record.amount) || 0;
                  const currentExec = String(record.executive_name || record['Executive Name'] || '').trim();

                  return (
                    <tr
                      key={id}
                      className={`hover:bg-muted/30 transition-colors ${
                        isSelected ? 'bg-primary/5' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-3 text-center">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggleRow(id)}
                          className="border-muted-foreground data-[state=checked]:bg-primary"
                        />
                      </td>

                      {/* Agreement ID with Quick Click to Dossier */}
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => setInspectCase(record)}
                          className="font-mono font-bold text-primary hover:underline text-left"
                        >
                          {id}
                        </button>
                      </td>

                      {/* Customer Details */}
                      <td className="p-3">
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground">{customerName}</span>
                          {phone && (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Phone className="h-3 w-3" />
                              {phone}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* City */}
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 text-muted-foreground font-medium">
                          <MapPin className="h-3 w-3 text-primary" />
                          {city}
                        </span>
                      </td>

                      {/* Bucket */}
                      <td className="p-3 text-center">
                        <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 bg-muted">
                          BKT {bucket}
                        </Badge>
                      </td>

                      {/* POS Amount */}
                      <td className="p-3 text-right">
                        <span className="font-bold text-foreground">{fmtCur(pos)}</span>
                      </td>

                      {/* Inline Executive Assignment Dropdown */}
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <select
                            value={currentExec}
                            onChange={(e) => handleInlineAssign(id, e.target.value)}
                            className={`h-8 px-2 rounded-md border text-xs font-semibold outline-none transition-all cursor-pointer ${
                              currentExec
                                ? 'bg-primary/10 border-primary/30 text-primary font-bold'
                                : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            <option value="">-- Unassigned --</option>
                            {allAgentOptions.map((agent) => (
                              <option key={agent} value={agent}>
                                {agent}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setInspectCase(record)}
                          className="h-7 w-7 text-muted-foreground hover:text-primary"
                          title="View Case Dossier"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer / Pagination */}
        <div className="p-3.5 border-t border-border bg-muted/20 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>
              Showing <span className="font-bold text-foreground">{(currentPage - 1) * pageSize + 1}</span> to{' '}
              <span className="font-bold text-foreground">{Math.min(currentPage * pageSize, totalItems)}</span> of{' '}
              <span className="font-bold text-foreground">{totalItems}</span> cases
            </span>

            {totalItems > pageSize && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAllFiltered}
                className="h-6 text-[11px] font-semibold text-primary"
              >
                Select All {totalItems} Filtered
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="h-7 px-2 rounded-md border border-border bg-background text-xs font-semibold text-foreground outline-none"
            >
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>

            <div className="flex items-center gap-1 ml-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-7 w-7"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="px-2 font-bold text-foreground">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-7 w-7"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Case Dossier Slide-Over Sheet */}
      <Sheet open={!!inspectCase} onOpenChange={(open) => !open && setInspectCase(null)}>
        <SheetContent className="w-full sm:max-w-md bg-card p-0 border-l border-border flex flex-col h-full z-[110]">
          {inspectCase && (
            <>
              <SheetHeader className="p-5 border-b border-border bg-muted/20">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-mono text-xs font-bold">
                    Loan ID: {inspectCase.agreementid || inspectCase.agreement_no || inspectCase.id}
                  </Badge>
                  <Badge variant="outline" className="text-xs font-bold">
                    BOM BKT: {inspectCase.bom_bkt || inspectCase.bucket || '1'}
                  </Badge>
                </div>
                <SheetTitle className="text-lg font-bold text-foreground mt-2">
                  {inspectCase.customer_name || inspectCase['Customer Name'] || 'Account Particulars'}
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground">
                  Complete recovery record details, loan balances, and agent assignment.
                </SheetDescription>
              </SheetHeader>

              <div className="p-5 overflow-y-auto space-y-5 flex-1 text-xs">
                {/* Financial Summary Box */}
                <div className="bg-muted/40 border border-border rounded-xl p-4 space-y-3">
                  <h5 className="font-bold uppercase tracking-wider text-muted-foreground text-[10px]">
                    Financial Balances
                  </h5>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Principal Outstanding</span>
                      <span className="text-base font-bold text-foreground">
                        {fmtCur(Number(inspectCase.principal_outstanding) || Number(inspectCase.amount) || 0)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Monthly EMI</span>
                      <span className="text-base font-bold text-foreground">
                        {fmtCur(Number(inspectCase.emi_amount) || Number(inspectCase.emi) || 0)}
                      </span>
                    </div>
                    {inspectCase.bcc && (
                      <div>
                        <span className="text-muted-foreground block text-[11px]">BCC / Charges</span>
                        <span className="font-semibold text-foreground">{fmtCur(Number(inspectCase.bcc) || 0)}</span>
                      </div>
                    )}
                    {inspectCase.total_due && (
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Total Overdue</span>
                        <span className="font-semibold text-destructive">{fmtCur(Number(inspectCase.total_due) || 0)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Assignment Management Box */}
                <div className="bg-card border border-border rounded-xl p-4 space-y-2.5">
                  <h5 className="font-bold uppercase tracking-wider text-muted-foreground text-[10px]">
                    Field Agent Allocation
                  </h5>
                  <div>
                    <label className="text-muted-foreground block text-[11px] mb-1">Assigned Executive:</label>
                    <select
                      value={String(inspectCase.executive_name || inspectCase['Executive Name'] || '').trim()}
                      onChange={async (e) => {
                        const newAgent = e.target.value;
                        const caseId = String(inspectCase.agreementid || inspectCase.agreement_no || inspectCase.id);
                        await handleInlineAssign(caseId, newAgent);
                        setInspectCase({ ...inspectCase, executive_name: newAgent });
                      }}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs font-semibold text-foreground outline-none focus:border-primary"
                    >
                      <option value="">-- Unallocated / Vacant --</option>
                      {allAgentOptions.map(a => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Contact & Location Info */}
                <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                  <h5 className="font-bold uppercase tracking-wider text-muted-foreground text-[10px]">
                    Borrower & Location Particulars
                  </h5>
                  <div className="space-y-2">
                    <div className="flex justify-between py-1 border-b border-border/50">
                      <span className="text-muted-foreground">Contact Phone</span>
                      <span className="font-semibold text-foreground">{inspectCase.phone_no || inspectCase.mobile || inspectCase.phone || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/50">
                      <span className="text-muted-foreground">City</span>
                      <span className="font-semibold text-foreground">{inspectCase.city || inspectCase.City || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/50">
                      <span className="text-muted-foreground">State / Region</span>
                      <span className="font-semibold text-foreground">{inspectCase.state || inspectCase.State || 'N/A'}</span>
                    </div>
                    {inspectCase.address && (
                      <div className="py-1">
                        <span className="text-muted-foreground block mb-0.5">Address</span>
                        <span className="font-medium text-foreground">{inspectCase.address}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
