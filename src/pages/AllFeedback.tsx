import React, { useState, useMemo } from 'react';
import { AppLayout } from '../components/layout/AppLayout';
import { DataTable } from '../components/ui/DataTable';
import { db, CustomerFeedback } from '../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { Download, Eye, CalendarIcon, Layers, FileText } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import Papa from 'papaparse';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';
import { ALL_STANDARD_FEEDBACKS, AVAILABILITY_OPTIONS } from '../constants/feedbackConfig';

export default function AllFeedback() {
  const feedbacks = useLiveQuery(
    () => db.customer_feedbacks.orderBy('createdAt').reverse().toArray(),
    [],
    [] as CustomerFeedback[]
  );
  const isLoading = feedbacks === undefined;
  
  // Filters
  const [availabilityFilter, setAvailabilityFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  
  // Dialog State
  const [selectedFeedback, setSelectedFeedback] = useState<CustomerFeedback | null>(null);

  const filteredFeedbacks = useMemo(() => {
    return feedbacks.filter(f => {
      // Availability Filter
      if (availabilityFilter !== "ALL" && f.availability !== availabilityFilter) return false;

      // Status/Standard Feedback Filter
      const fbStatus = f.standardFeedback || f.status;
      if (statusFilter !== "ALL" && fbStatus !== statusFilter) return false;
      
      // Date Range Filter
      if (dateRange?.from) {
        const feedbackDate = parseISO(f.createdAt);
        if (dateRange.to) {
          if (!isWithinInterval(feedbackDate, { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to) })) {
            return false;
          }
        } else {
          if (!isWithinInterval(feedbackDate, { start: startOfDay(dateRange.from), end: endOfDay(dateRange.from) })) {
            return false;
          }
        }
      }
      return true;
    });
  }, [feedbacks, availabilityFilter, statusFilter, dateRange]);

  const handleExportCSV = () => {
    if (filteredFeedbacks.length === 0) return;
    const csv = Papa.unparse(filteredFeedbacks.map(f => ({
      'Date': format(parseISO(f.createdAt), "yyyy-MM-dd HH:mm"),
      'Agent': f.agentName,
      'Agreement ID': f.agreementid,
      'Contact Number': f.contactNumber || 'N/A',
      'Availability': f.availability || 'N/A',
      'Standard Feedback': f.standardFeedback || f.status || 'N/A',
      'Detailed Feedback': f.detailedFeedback || f.overallDetailedFeedback || 'N/A',
    })));
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `feedback_export_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const columns = useMemo(() => [
    { key: 'createdAt', label: 'Date', render: (val: string) => format(parseISO(val), "PPP p") },
    { key: 'agentName', label: 'Agent' },
    { key: 'agreementid', label: 'Agreement ID' },
    { key: 'contactNumber', label: 'Contact Number' },
    { key: 'availability', label: 'Availability', render: (val: string) => (
      <span className="font-semibold text-xs px-2 py-0.5 rounded bg-muted/60 border border-border">
        {val || 'N/A'}
      </span>
    ) },
    { key: 'standardFeedback', label: 'Standard Feedback', render: (_: any, row: CustomerFeedback) => (
      <span className="font-bold text-xs text-foreground">
        {row.standardFeedback || row.status || 'N/A'}
      </span>
    ) },
    { key: 'detailedFeedback', label: 'Detailed Feedback', render: (_: any, row: CustomerFeedback) => (
      <span className="text-xs text-muted-foreground truncate max-w-[200px] block" title={row.detailedFeedback || row.overallDetailedFeedback || ''}>
        {row.detailedFeedback || row.overallDetailedFeedback || '—'}
      </span>
    ) },
    { key: 'actions', label: 'Actions', render: (_: any, row: CustomerFeedback) => (
      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setSelectedFeedback(row); }} title="View Full Feedback Details">
        <Eye className="h-4 w-4" />
      </Button>
    ) },
  ], []);

  return (
    <AppLayout title="Feedback Log">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-headline font-bold tracking-tight mb-2">All Feedback</h1>
            <p className="text-muted-foreground">View and export all agent feedback records.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Availability Filter */}
            <Select value={availabilityFilter} onValueChange={setAvailabilityFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Availability" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Availability</SelectItem>
                {AVAILABILITY_OPTIONS.map(opt => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Standard Feedbacks Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Standard Feedback" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Standard Feedbacks</SelectItem>
                {ALL_STANDARD_FEEDBACKS.map(fb => (
                  <SelectItem key={fb} value={fb}>{fb}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant={"outline"}
                  className={cn("w-[260px] justify-start text-left font-normal", !dateRange && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y")} -{" "}
                        {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Filter by Date Range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>

            <Button onClick={handleExportCSV} variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : (
            <DataTable columns={columns} data={filteredFeedbacks} pageSize={50} />
          )}
        </div>
      </div>

      <Dialog open={!!selectedFeedback} onOpenChange={(open) => !open && setSelectedFeedback(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              Feedback Details
            </DialogTitle>
            <DialogDescription>
              Agreement ID: <span className="font-mono font-bold text-foreground">{selectedFeedback?.agreementid}</span>
            </DialogDescription>
          </DialogHeader>
          {selectedFeedback && (
            <div className="space-y-4 mt-2">
              {/* Primary Feedback */}
              <div className="bg-muted/30 border border-border rounded-lg p-3 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-primary">Logged Feedback</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Agent:</span> <span className="font-semibold text-foreground">{selectedFeedback.agentName}</span></div>
                  <div><span className="text-muted-foreground">Date:</span> <span className="font-semibold text-foreground">{format(parseISO(selectedFeedback.createdAt), "PPP p")}</span></div>
                  <div><span className="text-muted-foreground">Contact:</span> <span className="font-mono font-semibold text-foreground">{selectedFeedback.contactNumber || 'N/A'}</span></div>
                  <div><span className="text-muted-foreground">Availability:</span> <span className="font-bold text-primary">{selectedFeedback.availability}</span></div>
                  <div className="col-span-2"><span className="text-muted-foreground">Standard Feedback:</span> <span className="font-bold text-foreground">{selectedFeedback.standardFeedback || selectedFeedback.status}</span></div>
                </div>
                
                {/* Detailed Feedback (Free text) */}
                <div className="pt-2 border-t border-border/50">
                  <div className="text-muted-foreground text-[11px] font-bold uppercase mb-1 flex items-center gap-1">
                    <FileText className="h-3 w-3" /> Detailed Feedback (Remarks)
                  </div>
                  <p className="text-xs bg-background p-2.5 rounded-md border border-border text-foreground font-sans">
                    {selectedFeedback.detailedFeedback || selectedFeedback.overallDetailedFeedback || 'No detailed remarks provided.'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
