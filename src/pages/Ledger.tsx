import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { AppLayout } from '../components/layout/AppLayout';
import { fmtCur } from '../lib/formatters';
import { FileText, Search, Download, ExternalLink, Hash, DollarSign, CreditCard, Layers } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { BucketFilter } from '../components/BucketFilter';
import { Card, CardContent } from '../components/ui/card';
import { LoanRecord } from '../types/domain';
import Papa from 'papaparse';
import { toast } from 'sonner';

export default function Ledger() {
  const navigate = useNavigate();
  const { records, isLoading, globalBucket } = useData();
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const itemsPerPage = 100;

  const filteredRecords = useMemo(() => {
    if (!records) return [];
    
    let result = records as unknown as LoanRecord[];
    if (globalBucket !== 'ALL') {
      result = result.filter(r => String(r.bom_bkt ?? '').trim().toUpperCase() === globalBucket);
    }
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => {
        const id = String(r.agreementid || r.agreement_no || '').toLowerCase();
        const name = String(r.customer_name || '').toLowerCase();
        const city = String(r.city || '').toLowerCase();
        const exec = String(r.executive_name || '').toLowerCase();
        return id.includes(q) || name.includes(q) || city.includes(q) || exec.includes(q);
      });
    }
    
    // Sort by POS descending
    return [...result].sort((a, b) => {
      const posA = Number(a.principal_outstanding) || 0;
      const posB = Number(b.principal_outstanding) || 0;
      return posB - posA;
    });
  }, [records, globalBucket, searchQuery]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const totalCases = filteredRecords.length;
    let totalPOS = 0;
    let totalEMI = 0;

    for (let i = 0; i < filteredRecords.length; i++) {
      totalPOS += Number(filteredRecords[i].principal_outstanding) || 0;
      totalEMI += Number(filteredRecords[i].emi_amt) || 0;
    }

    const avgPOS = totalCases > 0 ? totalPOS / totalCases : 0;

    return { totalCases, totalPOS, totalEMI, avgPOS };
  }, [filteredRecords]);

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const paginatedRecords = filteredRecords.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const handleExportCSV = () => {
    if (filteredRecords.length === 0) {
      toast.error('No records to export');
      return;
    }

    const exportData = filteredRecords.map(r => ({
      'Agreement ID': r.agreementid || r.agreement_no || '',
      'Customer Name': r.customer_name || '',
      'State': r.state || '',
      'City': r.city || '',
      'BOM Bucket': r.bom_bkt ?? '',
      'Executive Name': r.executive_name || '',
      'EMI Amount': Number(r.emi_amt) || 0,
      'Principal Outstanding (POS)': Number(r.principal_outstanding) || 0,
      'Foreclosure (Approx)': Number(r.approx_forclosure) || 0,
      'DAC': Number(r.dac) || 0,
    }));

    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `case_ledger_export_${globalBucket}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredRecords.length} records to CSV`);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="mb-4"><BucketFilter /></div>
        <div className="flex h-[50vh] items-center justify-center text-muted-foreground animate-pulse">
          Loading ledger data...
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-4">
        <BucketFilter />
      </div>

      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-extrabold uppercase tracking-wide flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" /> Case Ledger
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Detailed breakdown of EMI, Principal Outstanding, and allocations per agreement</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="gap-2 text-xs font-semibold"
          >
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search ID, Name, City, Executive..." 
              className="pl-9 text-xs"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="border border-border/70 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
              <Hash className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Filtered Cases</p>
              <p className="text-lg font-bold font-data">{metrics.totalCases.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/70 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total POS Exposure</p>
              <p className="text-lg font-bold font-data text-emerald-600 dark:text-emerald-400">{fmtCur(metrics.totalPOS)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/70 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-600">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total EMI Due</p>
              <p className="text-lg font-bold font-data text-blue-600 dark:text-blue-400">{fmtCur(metrics.totalEMI)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/70 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-600">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Avg POS / Ticket</p>
              <p className="text-lg font-bold font-data">{fmtCur(metrics.avgPOS)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col h-[calc(100vh-320px)]">
        <div className="overflow-auto flex-1 relative">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase sticky top-0 z-10 shadow-sm bg-muted text-muted-foreground font-semibold">
              <tr>
                <th className="px-5 py-3.5 border-b border-border">Agreement ID</th>
                <th className="px-5 py-3.5 border-b border-border">Customer Name</th>
                <th className="px-5 py-3.5 border-b border-border">Location / City</th>
                <th className="px-5 py-3.5 border-b border-border">Executive</th>
                <th className="px-5 py-3.5 text-right border-b border-border">EMI Amount</th>
                <th className="px-5 py-3.5 text-right border-b border-border">Principal Outstanding (POS)</th>
                <th className="px-4 py-3.5 text-center border-b border-border">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              {paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                    No records found matching your search.
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((r, idx) => {
                  const agreementId = r.agreementid || r.agreement_no || '';
                  return (
                    <tr 
                      key={agreementId || idx} 
                      className="hover:bg-muted/40 transition-colors cursor-pointer group"
                      onClick={() => agreementId && navigate(`/customer/${agreementId}`)}
                    >
                      <td className="px-5 py-3 font-semibold text-primary flex items-center gap-1.5">
                        {agreementId || '-'}
                      </td>
                      <td className="px-5 py-3 font-medium">
                        {r.customer_name || '-'}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {r.city ? `${r.city}${r.state ? `, ${r.state}` : ''}` : (r.state || '-')}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {r.executive_name || '-'}
                      </td>
                      <td className="px-5 py-3 text-right font-medium font-data">
                        {fmtCur(Number(r.emi_amt) || 0)}
                      </td>
                      <td className="px-5 py-3 text-right font-bold font-data text-foreground">
                        {fmtCur(Number(r.principal_outstanding) || 0)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 opacity-70 group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (agreementId) navigate(`/customer/${agreementId}`);
                          }}
                        >
                          <ExternalLink className="h-3.5 w-3.5 text-primary" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-border bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
            <div className="text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{((page - 1) * itemsPerPage) + 1}</span> to <span className="font-semibold text-foreground">{Math.min(page * itemsPerPage, filteredRecords.length)}</span> of <span className="font-semibold text-foreground">{filteredRecords.length.toLocaleString()}</span> entries
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="h-8 px-3 text-xs"
              >
                Previous
              </Button>
              <span className="px-2 text-muted-foreground font-medium">Page {page} of {totalPages}</span>
              <Button 
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="h-8 px-3 text-xs"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
