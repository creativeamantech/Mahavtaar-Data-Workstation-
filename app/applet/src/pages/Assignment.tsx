/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useMemo } from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  getExpandedRowModel,
  ExpandedState,
  RowSelectionState,
} from "@tanstack/react-table";
import { AppLayout } from '../components/layout/AppLayout';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { fmtCur } from '../lib/formatters';
import { calculateRow } from '../lib/calculations';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AssignmentDialog } from '../components/AssignmentDialog';
import { CaseInformationTable } from '../components/CaseInformationTable';
import { 
  Building2, 
  Filter, 
  Plus, 
  UserCircle2, 
  Download, 
  Calendar, 
  LayoutList,
  ChevronDown,
  ChevronRight,
  ArrowUpDown,
  Undo2,
  Users,
  Layers,
  Sparkles,
  Scale,
  CheckSquare,
  FileText,
  Eye,
  ListOrdered
} from 'lucide-react';
import { toast } from 'sonner';

export type BucketAggregate = {
  id: string;
  bucketName: string;
  cityName: string;
  loanIdCount: number;
  totalPOS: number;
  unallocatedCount: number;
  unallocatedPOS: number;
  allocatedCount: number;
  allocatedPOS: number;
  execs: Record<string, number>;
  customers: any[];
  unallocatedCases: any[];
};

export type CityAggregate = {
  id: string;
  cityName: string;
  loanIdCount: number;
  totalPOS: number;
  unallocatedCount: number;
  unallocatedPOS: number;
  allocatedCount: number;
  allocatedPOS: number;
  execs: Record<string, number>;
  customers: any[];
  unallocatedCases: any[];
  subRows?: BucketAggregate[];
};

export default function Assignment() {
  const { records, updateRecord, bulkUpdateRecords, auditLog, globalBucket, undo, canUndo } = useData();
  const { user, users } = useAuth();
  
  // Primary Navigation View Switcher: 'matrix' (City/Bucket Hierarchy) vs 'cases' (Case Information & Specific Assignment)
  const [activeTab, setActiveTab] = useState<'matrix' | 'cases'>('matrix');

  // Filters & Toggles
  const [excludePaid, setExcludePaid] = useState(false);
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const [reportDate, setReportDate] = useState<string>(new Date().toLocaleDateString('en-CA'));
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Filters passed from Matrix drilldown into Case Table
  const [caseTableCityFilter, setCaseTableCityFilter] = useState<string>('all');
  const [caseTableBucketFilter, setCaseTableBucketFilter] = useState<string>('all');

  // TanStack Table states for Matrix
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'unallocatedCount', desc: true }
  ]);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // Assignment Dialog state (Multi-Agent Distribution Modal)
  const [isAssignDialogOpen, setAssignDialogOpen] = useState(false);
  const [dialogCases, setDialogCases] = useState<any[]>([]);

  // List of all active agents from Auth Context and existing records
  const availableAgents = useMemo(() => {
    const set = new Set<string>();
    
    // Auth context users
    if (users && users.length > 0) {
      users.forEach(u => {
        if (u.name && u.name.trim()) {
          set.add(u.name.trim());
        }
      });
    }

    // Historical records executives
    records.forEach(r => {
      const e = String(r.executive_name || r['Executive Name'] || r.EXECUTIVE_NAME || '').trim();
      if (e) set.add(e);
    });

    return Array.from(set).sort();
  }, [users, records]);

  // Filtered active records respecting Global Bucket and Paid status
  const activeRecords = useMemo(() => {
    return records.filter(r => {
      if (globalBucket !== 'ALL' && String(r.bom_bkt || r.bucket || '').trim().toUpperCase() !== globalBucket) {
        return false;
      }
      if (excludePaid) {
        const c = calculateRow(r);
        if (c.mainPaid === 1) return false;
      }
      return true;
    });
  }, [records, globalBucket, excludePaid]);

  // Extract all unallocated cases across the entire active dataset
  const allUnallocatedCases = useMemo(() => {
    return activeRecords.filter(r => {
      const exec = String(r.executive_name || r['Executive Name'] || r.EXECUTIVE_NAME || '').trim();
      return !exec;
    });
  }, [activeRecords]);

  const totalUnallocatedCount = allUnallocatedCases.length;
  const totalUnallocatedPOS = useMemo(() => {
    return allUnallocatedCases.reduce((sum, r) => sum + (Number(r.principal_outstanding) || Number(r.amount) || 0), 0);
  }, [allUnallocatedCases]);

  // Overall KPI metrics
  const kpis = useMemo(() => {
    let totalCount = 0;
    let totalPos = 0;
    let unallocatedCount = 0;
    let unallocatedPos = 0;
    let allocatedCount = 0;
    let allocatedPos = 0;
    const activeExecs = new Set<string>();

    activeRecords.forEach(r => {
      totalCount++;
      const pos = Number(r.principal_outstanding) || Number(r.amount) || 0;
      totalPos += pos;

      const exec = String(r.executive_name || r['Executive Name'] || '').trim();
      if (exec) {
        allocatedCount++;
        allocatedPos += pos;
        activeExecs.add(exec);
      } else {
        unallocatedCount++;
        unallocatedPos += pos;
      }
    });

    return {
      totalCount,
      totalPos,
      unallocatedCount,
      unallocatedPos,
      allocatedCount,
      allocatedPos,
      activeExecsCount: activeExecs.size,
    };
  }, [activeRecords]);

  // Aggregate Hierarchical Data: City -> Bucket subRows
  const tableData: CityAggregate[] = useMemo(() => {
    const cityMap: Record<string, { customers: any[] }> = {};

    activeRecords.forEach(r => {
      const city = String(r.city || r.City || r.location || 'Unknown').trim();
      if (!cityMap[city]) {
        cityMap[city] = { customers: [] };
      }
      cityMap[city].customers.push(r);
    });

    const result: CityAggregate[] = Object.keys(cityMap).map(city => {
      const cityCustomers = cityMap[city].customers;
      const bucketMap: Record<string, { customers: any[] }> = {};
      const cityExecs: Record<string, number> = {};

      let cityUnallocatedCount = 0;
      let cityUnallocatedPos = 0;
      let cityAllocatedCount = 0;
      let cityAllocatedPos = 0;
      const cityUnallocatedCases: any[] = [];

      cityCustomers.forEach(c => {
        const bkt = String(c.bom_bkt || c.bucket || c.Bucket || 'Unknown').trim();
        if (!bucketMap[bkt]) {
          bucketMap[bkt] = { customers: [] };
        }
        bucketMap[bkt].customers.push(c);

        const exec = String(c.executive_name || c['Executive Name'] || '').trim();
        const pos = Number(c.principal_outstanding) || Number(c.amount) || 0;

        if (exec) {
          cityAllocatedCount++;
          cityAllocatedPos += pos;
          cityExecs[exec] = (cityExecs[exec] || 0) + 1;
        } else {
          cityUnallocatedCount++;
          cityUnallocatedPos += pos;
          cityUnallocatedCases.push(c);
        }
      });

      const subRows: BucketAggregate[] = Object.keys(bucketMap).map(bucket => {
        const bktCustomers = bucketMap[bucket].customers;
        const bktExecs: Record<string, number> = {};
        let bktUnallocatedCount = 0;
        let bktUnallocatedPos = 0;
        let bktAllocatedCount = 0;
        let bktAllocatedPos = 0;
        const bktUnallocatedCases: any[] = [];

        bktCustomers.forEach(c => {
          const exec = String(c.executive_name || c['Executive Name'] || '').trim();
          const pos = Number(c.principal_outstanding) || Number(c.amount) || 0;

          if (exec) {
            bktAllocatedCount++;
            bktAllocatedPos += pos;
            bktExecs[exec] = (bktExecs[exec] || 0) + 1;
          } else {
            bktUnallocatedCount++;
            bktUnallocatedPos += pos;
            bktUnallocatedCases.push(c);
          }
        });

        return {
          id: `${city}-${bucket}`,
          bucketName: bucket,
          cityName: city,
          loanIdCount: bktCustomers.length,
          totalPOS: bktCustomers.reduce((s, c) => s + (Number(c.principal_outstanding) || Number(c.amount) || 0), 0),
          unallocatedCount: bktUnallocatedCount,
          unallocatedPOS: bktUnallocatedPos,
          allocatedCount: bktAllocatedCount,
          allocatedPOS: bktAllocatedPos,
          execs: bktExecs,
          customers: bktCustomers,
          unallocatedCases: bktUnallocatedCases,
        };
      }).sort((a, b) => b.unallocatedCount - a.unallocatedCount || a.bucketName.localeCompare(b.bucketName));

      return {
        id: city,
        cityName: city,
        loanIdCount: cityCustomers.length,
        totalPOS: cityCustomers.reduce((s, c) => s + (Number(c.principal_outstanding) || Number(c.amount) || 0), 0),
        unallocatedCount: cityUnallocatedCount,
        unallocatedPOS: cityUnallocatedPos,
        allocatedCount: cityAllocatedCount,
        allocatedPOS: cityAllocatedPos,
        execs: cityExecs,
        customers: cityCustomers,
        unallocatedCases: cityUnallocatedCases,
        subRows,
      };
    });

    if (onlyUnassigned) {
      return result.filter(c => c.unallocatedCount > 0);
    }

    return result.sort((a, b) => b.unallocatedCount - a.unallocatedCount || b.loanIdCount - a.loanIdCount);
  }, [activeRecords, onlyUnassigned]);

  // Executive Matrix for Sidebar
  const execStatsList = useMemo(() => {
    const stats: Record<string, { total: number; totalPos: number; cities: Record<string, number> }> = {};
    activeRecords.forEach(r => {
      const exec = String(r.executive_name || r['Executive Name'] || '').trim();
      if (!exec) return;
      const city = String(r.city || r.City || 'Unknown').trim();
      const pos = Number(r.principal_outstanding) || Number(r.amount) || 0;
      
      if (!stats[exec]) stats[exec] = { total: 0, totalPos: 0, cities: {} };
      stats[exec].total += 1;
      stats[exec].totalPos += pos;
      stats[exec].cities[city] = (stats[exec].cities[city] || 0) + 1;
    });

    const rows: { exec: string; city: string; count: number; execTotal: number; execPos: number }[] = [];
    Object.entries(stats).forEach(([exec, data]) => {
      Object.entries(data.cities).forEach(([city, count]) => {
        rows.push({ exec, city, count, execTotal: data.total, execPos: data.totalPos });
      });
    });

    return rows.sort((a, b) => b.execTotal - a.execTotal || a.exec.localeCompare(b.exec) || b.count - a.count);
  }, [activeRecords]);

  // Daily Stats from Audit Log
  const dailyReport = useMemo(() => {
    const dailyLogs = auditLog.filter(log => {
      if (log.field !== 'executive_name') return false;
      if (!log.newValue || String(log.newValue).trim() === '') return false;
      const logDate = new Date(log.createdAt).toLocaleDateString('en-CA');
      return logDate === reportDate;
    });

    const aggregated: Record<string, { exec: string; city: string; count: number; pos: number }> = {};
    
    dailyLogs.forEach(log => {
      const exec = String(log.newValue).trim();
      const record = records.find(r => String(r.agreementid || r.agreement_no || r.id) === log.agreementid);
      if (!record) return;
      if (globalBucket !== 'ALL' && String(record.bom_bkt).trim().toUpperCase() !== globalBucket) return;
      const city = String(record.city || record.City || 'Unknown').trim();
      const pos = Number(record.principal_outstanding) || Number(record.amount) || 0;
      const key = `${exec}|${city}`;
      
      if (!aggregated[key]) {
        aggregated[key] = { exec, city, count: 0, pos: 0 };
      }
      aggregated[key].count += 1;
      aggregated[key].pos += pos;
    });

    return Object.values(aggregated).sort((a, b) => b.count - a.count);
  }, [auditLog, records, reportDate, globalBucket]);

  // Drilldown to Case Table for specific city or bucket
  const handleDrilldownToCases = (city: string, bucket: string = 'all') => {
    setCaseTableCityFilter(city);
    setCaseTableBucketFilter(bucket);
    setActiveTab('cases');
    toast.info(`Switched to Case Information Table filtered for ${city}${bucket !== 'all' ? ` • Bucket ${bucket}` : ''}`);
  };

  // TanStack Table Column Definitions
  const columns = useMemo<ColumnDef<CityAggregate | BucketAggregate>[]>(() => [
    {
      id: 'select',
      header: ({ table }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={table.getIsAllRowsSelected() || (table.getIsSomeRowsSelected() && "indeterminate")}
            onCheckedChange={(value) => table.toggleAllRowsSelected(!!value)}
            aria-label="Select all rows"
            className="border-muted-foreground data-[state=checked]:bg-primary"
          />
        </div>
      ),
      cell: ({ row }) => {
        const hasUnallocated = row.original.unallocatedCount > 0;
        return (
          <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={row.getIsSelected()}
              disabled={!hasUnallocated}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label="Select row"
              className={!hasUnallocated ? "opacity-30 cursor-not-allowed" : "border-muted-foreground data-[state=checked]:bg-primary"}
            />
          </div>
        );
      },
      enableSorting: false,
    },
    {
      id: 'expander',
      header: () => null,
      cell: ({ row }) => {
        if (row.getCanExpand()) {
          return (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={(e) => { 
                e.stopPropagation(); 
                row.toggleExpanded(); 
              }} 
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            >
              {row.getIsExpanded() ? (
                <ChevronDown className="h-4 w-4 text-primary" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          );
        }
        return <div className="w-7 h-7" />;
      },
      enableSorting: false,
    },
    {
      accessorKey: 'cityName',
      header: ({ column }) => (
        <Button 
          variant="ghost" 
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="px-2 font-bold text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          City / Bucket Breakdown
          <ArrowUpDown className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      ),
      cell: ({ row }) => {
        const isBucket = 'bucketName' in row.original;
        const indentPadding = `${row.depth * 1.5}rem`;

        return (
          <div 
            className="flex items-center gap-2 py-1"
            style={{ paddingLeft: indentPadding }}
          >
            {isBucket ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-muted text-foreground border border-border">
                <Layers className="h-3 w-3 text-primary" />
                Bucket: {row.original.bucketName}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-foreground">
                <Building2 className="h-4 w-4 text-primary" />
                {row.original.cityName}
              </span>
            )}
            
            {row.original.unallocatedCount > 0 && (
              <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                {row.original.unallocatedCount} Pending
              </span>
            )}
          </div>
        );
      }
    },
    {
      accessorKey: 'loanIdCount',
      header: ({ column }) => (
        <Button 
          variant="ghost" 
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} 
          className="w-full justify-center px-2 font-bold text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          Total Loan IDs
          <ArrowUpDown className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="text-center font-semibold text-foreground">
          {row.getValue("loanIdCount")}
        </div>
      )
    },
    {
      accessorKey: 'unallocatedCount',
      header: ({ column }) => (
        <Button 
          variant="ghost" 
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} 
          className="w-full justify-center px-2 font-bold text-xs uppercase tracking-wider text-amber-600 dark:text-amber-400 hover:text-foreground"
        >
          Unallocated Cases
          <ArrowUpDown className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      ),
      cell: ({ row }) => {
        const count = row.original.unallocatedCount;
        return (
          <div className="text-center">
            {count > 0 ? (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 font-bold px-2 py-0.5">
                {count}
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground font-medium">0</span>
            )}
          </div>
        );
      }
    },
    {
      accessorKey: 'totalPOS',
      header: ({ column }) => (
        <Button 
          variant="ghost" 
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} 
          className="w-full justify-end px-2 font-bold text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          Total Portfolio POS
          <ArrowUpDown className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      ),
      cell: ({ row }) => {
        const amount = Number(row.getValue("totalPOS")) || 0;
        return (
          <div className="text-right font-semibold text-foreground">
            {fmtCur(amount)}
          </div>
        );
      },
    },
    {
      accessorKey: 'unallocatedPOS',
      header: ({ column }) => (
        <Button 
          variant="ghost" 
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} 
          className="w-full justify-end px-2 font-bold text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          Pending POS (₹)
          <ArrowUpDown className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      ),
      cell: ({ row }) => {
        const amount = Number(row.original.unallocatedPOS) || 0;
        return (
          <div className="text-right font-bold text-primary">
            {amount > 0 ? fmtCur(amount) : '₹0'}
          </div>
        );
      },
    },
    {
      id: 'allocationStatus',
      header: () => (
        <div className="text-left font-bold text-xs uppercase tracking-wider text-muted-foreground px-2">
          Current Assignment
        </div>
      ),
      cell: ({ row }) => {
        const { allocatedCount, execs } = row.original;
        const execEntries = Object.entries(execs);

        if (allocatedCount === 0) {
          return <span className="text-xs text-muted-foreground italic">Unassigned</span>;
        }

        return (
          <div className="flex flex-wrap gap-1 items-center max-w-xs">
            {execEntries.slice(0, 3).map(([name, count]) => (
              <span 
                key={name} 
                className="inline-flex items-center text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20"
              >
                {name}: {count}
              </span>
            ))}
            {execEntries.length > 3 && (
              <span className="text-[10px] text-muted-foreground font-medium">
                +{execEntries.length - 3} more
              </span>
            )}
          </div>
        );
      }
    },
    {
      id: 'action',
      header: () => (
        <div className="text-center font-bold text-xs uppercase tracking-wider text-muted-foreground px-2">
          Actions
        </div>
      ),
      cell: ({ row }) => {
        const { unallocatedCount, unallocatedCases } = row.original;
        const isBucket = 'bucketName' in row.original;
        const city = isBucket ? (row.original as BucketAggregate).cityName : (row.original as CityAggregate).cityName;
        const bucket = isBucket ? (row.original as BucketAggregate).bucketName : 'all';

        return (
          <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            {/* View Cases button that drills into the case table */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDrilldownToCases(city, bucket)}
              className="h-7 text-xs font-semibold px-2 hover:text-primary hover:border-primary"
              title="Inspect Case Information Table"
            >
              <Eye className="h-3.5 w-3.5 mr-1 text-primary" />
              Cases
            </Button>

            {/* Quick Bulk Assign */}
            {unallocatedCount > 0 ? (
              <Button
                size="sm"
                variant="default"
                onClick={() => {
                  setDialogCases(unallocatedCases);
                  setAssignDialogOpen(true);
                }}
                className="h-7 text-xs font-bold px-2.5 shadow-xs bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Assign ({unallocatedCount})
              </Button>
            ) : (
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium px-2">
                100% Done
              </span>
            )}
          </div>
        );
      }
    }
  ], []);

  const table = useReactTable({
    data: tableData,
    columns,
    state: { sorting, expanded, rowSelection },
    getSubRows: (row) => row.subRows,
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    autoResetPageIndex: false,
    enableRowSelection: true,
    getRowId: (row) => row.id,
  });

  // Extract selected unallocated customers from table selection
  const selectedUnallocatedCustomers = useMemo(() => {
    const selectedRows = table.getSelectedRowModel().rows;
    const caseMap = new Map<string, any>();

    selectedRows.forEach(r => {
      r.original.unallocatedCases.forEach(c => {
        const id = String(c.agreementid || c.agreement_no || c.id || c.loan_id);
        caseMap.set(id, c);
      });
    });

    return Array.from(caseMap.values());
  }, [rowSelection, tableData]);

  const selectedCount = selectedUnallocatedCustomers.length;
  const selectedPOS = useMemo(() => {
    return selectedUnallocatedCustomers.reduce((s, c) => s + (Number(c.principal_outstanding) || Number(c.amount) || 0), 0);
  }, [selectedUnallocatedCustomers]);

  // Allocate all unallocated cases at once
  const handleAssignAllUnallocated = () => {
    if (totalUnallocatedCount === 0) {
      toast.info("There are no unallocated cases to assign.");
      return;
    }
    setDialogCases(allUnallocatedCases);
    setAssignDialogOpen(true);
  };

  // Bulk assignment handler
  const handleAssignSubmit = async (updates: { agreementid: string; field: string; value: string }[]) => {
    await bulkUpdateRecords(updates, user?.name || 'System');
    table.resetRowSelection();
  };

  // Single Case Assignment Handler
  const handleAssignSingleCase = async (agreementId: string, agentName: string) => {
    await updateRecord(agreementId, 'executive_name', agentName, user?.name || 'System');
  };

  // Multiple Case Assignment Handler
  const handleAssignMultipleCases = async (agreementIds: string[], agentName: string) => {
    const updates = agreementIds.map(id => ({
      agreementid: id,
      field: 'executive_name',
      value: agentName,
    }));
    await bulkUpdateRecords(updates, user?.name || 'System');
  };

  // Open multi distribute from case table
  const handleOpenMultiDistributeCases = (casesToDistribute: any[]) => {
    setDialogCases(casesToDistribute);
    setAssignDialogOpen(true);
  };

  // Undo handler
  const handleUndo = async () => {
    try {
      await undo();
      toast.success("Previous assignment action reverted successfully.");
    } catch (e: any) {
      console.error("Error undoing assignment:", e);
      toast.error(e.message || "Could not undo last assignment.");
    }
  };

  // CSV Export for Matrix
  const handleExport = () => {
    let csv = "RESOURCE ALLOCATION SUMMARY (CITY & BUCKET BREAKDOWN)\n";
    csv += "City,Bucket,Total Cases,Unallocated,Allocated,Total POS (Rs),Unallocated POS (Rs)\n";

    tableData.forEach(cityRow => {
      csv += `"${cityRow.cityName}","ALL",${cityRow.loanIdCount},${cityRow.unallocatedCount},${cityRow.allocatedCount},${cityRow.totalPOS},${cityRow.unallocatedPOS}\n`;
      if (cityRow.subRows) {
        cityRow.subRows.forEach(bktRow => {
          csv += `"${cityRow.cityName}","${bktRow.bucketName}",${bktRow.loanIdCount},${bktRow.unallocatedCount},${bktRow.allocatedCount},${bktRow.totalPOS},${bktRow.unallocatedPOS}\n`;
        });
      }
    });

    csv += "\nEXECUTIVE LIVE PORTFOLIO\n";
    csv += "Executive,City,Count,Executive Total Cases,Executive Total POS\n";
    execStatsList.forEach(row => {
      csv += `"${row.exec}","${row.city}",${row.count},${row.execTotal},${row.execPos}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Allocation_Master_Export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("Allocation data exported to CSV.");
  };

  return (
    <AppLayout>
      {/* Header & Controls */}
      <div className="mb-5 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Resource Allocation Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Hierarchical portfolio management with automated Equal, POS Load-Balanced, and Percentage allocation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto">
          {/* Top Reports Drawer */}
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="default" className="bg-primary text-primary-foreground font-bold text-xs uppercase tracking-wider shadow-sm">
                <LayoutList className="h-4 w-4 mr-1.5" />
                Live Stats & Reports
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-2xl bg-card p-0 border-l border-border flex flex-col h-full z-[100]">
              <SheetHeader className="p-6 border-b border-border bg-muted/10">
                <SheetTitle className="text-xl font-heading font-bold text-foreground flex items-center gap-2">
                  <LayoutList className="h-5 w-5 text-primary" /> Allocation Analytics & Daily Logs
                </SheetTitle>
                <SheetDescription className="font-sans text-sm font-medium">
                  Live field coverage matrix and historical assignment logs.
                </SheetDescription>
              </SheetHeader>

              <ScrollArea className="flex-1 p-6">
                <div className="space-y-8">
                  {/* Current Active Portfolios */}
                  <div className="bg-card border border-border rounded-xl shadow-xs flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <UserCircle2 className="h-5 w-5 text-primary" />
                        <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                          Executive Live Coverage ({execStatsList.length} Portfolios)
                        </h2>
                      </div>
                    </div>
                    <div className="overflow-y-auto max-h-[350px]">
                      {execStatsList.length === 0 ? (
                        <div className="text-center text-muted-foreground py-10 text-sm">No allocated executives found.</div>
                      ) : (
                        <table className="w-full text-xs text-left whitespace-nowrap">
                          <thead className="bg-muted/30 text-muted-foreground uppercase tracking-widest text-[10px] sticky top-0 border-b border-border">
                            <tr>
                              <th className="px-4 py-3 font-bold">Executive</th>
                              <th className="px-4 py-3 font-bold">City</th>
                              <th className="px-4 py-3 font-bold text-center">Cases</th>
                              <th className="px-4 py-3 font-bold text-right">POS</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {execStatsList.map((row, i) => {
                              const isFirstForExec = i === 0 || execStatsList[i - 1].exec !== row.exec;
                              return (
                                <tr key={i} className="hover:bg-muted/10 transition-colors">
                                  <td className="px-4 py-3 font-medium text-foreground">
                                    {isFirstForExec ? row.exec : ''}
                                  </td>
                                  <td className="px-4 py-3 font-semibold text-muted-foreground">{row.city}</td>
                                  <td className="px-4 py-3 text-center font-bold text-primary">{row.count}</td>
                                  <td className="px-4 py-3 text-right font-medium text-foreground">
                                    {isFirstForExec ? fmtCur(row.execPos) : ''}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                  {/* Daily Assignment Audit History */}
                  <div className="bg-card border border-border rounded-xl shadow-xs flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-border bg-muted/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-amber-500" />
                        <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Daily Activity Logs</h2>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-muted-foreground uppercase">Date:</span>
                        <input 
                          type="date"
                          value={reportDate}
                          onChange={e => setReportDate(e.target.value)}
                          className="h-8 px-2.5 rounded-md bg-background border border-border text-xs outline-none focus:border-primary cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="overflow-auto max-h-[350px]">
                      <table className="w-full text-left border-collapse whitespace-nowrap text-xs">
                        <thead className="bg-muted/50 border-b border-border sticky top-0">
                          <tr>
                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Executive</th>
                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">City</th>
                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-center">Assigned</th>
                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-right">POS Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {dailyReport.length === 0 ? (
                            <tr><td colSpan={4} className="px-6 py-10 text-center text-muted-foreground">No assignments logged on this date.</td></tr>
                          ) : (
                            dailyReport.map((row, idx) => (
                              <tr key={idx} className="hover:bg-muted/20 transition-colors">
                                <td className="px-4 py-3 font-semibold text-foreground">{row.exec}</td>
                                <td className="px-4 py-3 text-muted-foreground">{row.city}</td>
                                <td className="px-4 py-3 text-center font-bold text-primary">{row.count}</td>
                                <td className="px-4 py-3 text-right font-medium">{fmtCur(row.pos)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>

          {/* Undo button */}
          <Button
            onClick={handleUndo}
            variant="outline"
            size="sm"
            disabled={!canUndo}
            className="h-9 text-xs font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
          >
            <Undo2 className="h-3.5 w-3.5 mr-1" />
            Undo
          </Button>

          {/* Filter Toggles */}
          <Button
            variant={excludePaid ? "default" : "outline"}
            onClick={() => setExcludePaid(!excludePaid)}
            className="text-xs font-bold uppercase tracking-wider h-9"
          >
            <Filter className="h-3.5 w-3.5 mr-1.5" />
            {excludePaid ? 'Unpaid Only' : 'All Cases'}
          </Button>

          <Button
            variant={onlyUnassigned ? "default" : "outline"}
            onClick={() => setOnlyUnassigned(!onlyUnassigned)}
            className="text-xs font-bold uppercase tracking-wider h-9"
          >
            {onlyUnassigned ? 'Pending Only' : 'All Cities'}
          </Button>

          <Button 
            variant="outline"
            onClick={handleExport}
            className="text-xs font-bold uppercase tracking-wider h-9"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* TOP PRIMARY VIEW SWITCHER TABS - Prominently Displayed */}
      <div className="bg-card border-2 border-primary/20 rounded-2xl p-2 mb-6 shadow-md flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 bg-muted/70 p-1.5 rounded-xl border border-border flex-1">
          <button
            type="button"
            id="tab-matrix-view"
            onClick={() => setActiveTab('matrix')}
            className={`flex-1 flex items-center justify-center gap-2.5 px-4 py-3 rounded-lg text-xs md:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'matrix'
                ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30 font-extrabold'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/90'
            }`}
          >
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="truncate">City & Bucket Portfolio Matrix</span>
            <Badge 
              variant="outline" 
              className={`text-[10px] font-bold px-2 py-0.5 shrink-0 ${
                activeTab === 'matrix' 
                  ? 'bg-primary-foreground/20 text-primary-foreground border-transparent' 
                  : 'bg-background text-muted-foreground'
              }`}
            >
              {tableData.length} Cities
            </Badge>
          </button>

          <button
            type="button"
            id="tab-case-information-view"
            onClick={() => {
              setCaseTableCityFilter('all');
              setCaseTableBucketFilter('all');
              setActiveTab('cases');
            }}
            className={`flex-1 flex items-center justify-center gap-2.5 px-4 py-3 rounded-lg text-xs md:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'cases'
                ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30 font-extrabold'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/90'
            }`}
          >
            <FileText className="h-4 w-4 shrink-0" />
            <span className="truncate">Case Information & Specific Assignment</span>
            <Badge 
              variant="outline" 
              className={`text-[10px] font-bold px-2 py-0.5 shrink-0 ${
                activeTab === 'cases' 
                  ? 'bg-primary-foreground/20 text-primary-foreground border-transparent' 
                  : 'bg-background text-muted-foreground'
              }`}
            >
              {activeRecords.length} Cases
            </Badge>
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 shrink-0 px-1">
          {activeTab === 'matrix' ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveTab('cases')}
              className="h-10 text-xs font-bold text-primary border-primary/30 hover:bg-primary/10"
            >
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              Open Case Table
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveTab('matrix')}
              className="h-10 text-xs font-bold text-primary border-primary/30 hover:bg-primary/10"
            >
              <Building2 className="h-3.5 w-3.5 mr-1.5" />
              Open Portfolio Matrix
            </Button>
          )}
        </div>
      </div>

      {/* Global Unallocated Alert Banner */}
      {totalUnallocatedCount > 0 ? (
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-primary/10 border border-amber-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Scale className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-foreground">
                  {totalUnallocatedCount} Unallocated Cases Awaiting Assignment
                </span>
                <Badge variant="outline" className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 font-bold text-xs">
                  Pending POS: {fmtCur(totalUnallocatedPOS)}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Distribute all remaining unallocated loans across executives evenly, by POS load, or custom percentage split in one single operation.
              </p>
            </div>
          </div>

          <Button
            onClick={handleAssignAllUnallocated}
            className="w-full md:w-auto bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs uppercase tracking-wider px-4 py-2 shadow-md shrink-0 flex items-center justify-center gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Allocate All ({totalUnallocatedCount}) Once
          </Button>
        </div>
      ) : (
        <div className="mb-6 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between gap-3 text-xs text-emerald-700 dark:text-emerald-300">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="font-semibold">Complete Coverage: 100% of cases in active view are allocated to field executives.</span>
          </div>
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-bold">
            0 Pending Cases
          </Badge>
        </div>
      )}

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
        <Card className="border border-border/70 shadow-xs bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total Portfolio</p>
              <h3 className="text-xl font-bold text-foreground mt-0.5">{kpis.totalCount} Cases</h3>
              <p className="text-xs font-medium text-muted-foreground mt-0.5">{fmtCur(kpis.totalPos)}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center text-primary">
              <Layers className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-amber-500/30 shadow-xs bg-card relative overflow-hidden group">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Total Unallocated</p>
                <h3 className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">{kpis.unallocatedCount} Cases</h3>
                <p className="text-xs font-medium text-muted-foreground mt-0.5">{fmtCur(kpis.unallocatedPos)}</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Scale className="h-5 w-5" />
              </div>
            </div>
            {kpis.unallocatedCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAssignAllUnallocated}
                className="mt-3 w-full h-7 text-[11px] font-bold text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-300 flex items-center justify-center gap-1"
              >
                <Sparkles className="h-3 w-3" />
                Allocate All ({kpis.unallocatedCount})
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="border border-emerald-500/20 shadow-xs bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Assigned In Field</p>
              <h3 className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{kpis.allocatedCount} Cases</h3>
              <p className="text-xs font-medium text-muted-foreground mt-0.5">{fmtCur(kpis.allocatedPos)}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Sparkles className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/70 shadow-xs bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Active Field Agents</p>
              <h3 className="text-xl font-bold text-foreground mt-0.5">{kpis.activeExecsCount} Agents</h3>
              <p className="text-xs font-medium text-muted-foreground mt-0.5">Coverage Active</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center text-primary">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* VIEW 1: City & Bucket Hierarchy Matrix View */}
      {activeTab === 'matrix' && (
        <div className="space-y-3">
          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/40 p-3 rounded-xl border border-border">
            <div className="flex flex-wrap items-center gap-2">
              {/* Allocate All button */}
              <Button
                variant="default"
                onClick={handleAssignAllUnallocated}
                disabled={totalUnallocatedCount === 0}
                className="bg-amber-600 hover:bg-amber-500 text-white font-bold shadow-sm h-9 text-xs"
              >
                <Sparkles className="h-4 w-4 mr-1.5" />
                Allocate All Unallocated ({totalUnallocatedCount})
                {totalUnallocatedCount > 0 && (
                  <span className="ml-1.5 opacity-90 font-normal">
                    • {fmtCur(totalUnallocatedPOS)}
                  </span>
                )}
              </Button>

              {/* Assign Selected button */}
              <Button
                variant={selectedCount > 0 ? "default" : "outline"}
                onClick={() => {
                  setDialogCases(selectedUnallocatedCustomers);
                  setAssignDialogOpen(true);
                }}
                disabled={selectedCount === 0}
                className={`font-bold shadow-sm h-9 text-xs ${
                  selectedCount > 0 
                    ? 'bg-primary text-primary-foreground' 
                    : 'text-muted-foreground'
                }`}
              >
                <CheckSquare className="h-4 w-4 mr-1.5" />
                Assign Selected ({selectedCount})
                {selectedCount > 0 && (
                  <span className="ml-1.5 opacity-90 font-normal">
                    • {fmtCur(selectedPOS)}
                  </span>
                )}
              </Button>

              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => table.toggleAllRowsExpanded()}
                className="h-9 text-xs font-semibold"
              >
                Toggle All (Expand/Collapse)
              </Button>

              {selectedCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => table.resetRowSelection()}
                  className="h-9 text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear Selection
                </Button>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveTab('cases')}
              className="h-9 text-xs font-bold text-primary hover:bg-primary/10"
            >
              <FileText className="h-3.5 w-3.5 mr-1" />
              Switch to Case Information Table
            </Button>
          </div>

          {/* Main Hierarchical Tree Table */}
          <Card className="border border-border shadow-sm overflow-hidden bg-card">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/50 border-b border-border">
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <TableHead key={header.id} className="h-11">
                            {header.isPlaceholder
                              ? null
                              : flexRender(header.column.columnDef.header, header.getContext())}
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {table.getRowModel().rows?.length ? (
                      table.getRowModel().rows.map((row) => (
                        <TableRow
                          key={row.id}
                          data-state={row.getIsSelected() && "selected"}
                          className={`hover:bg-muted/30 transition-colors cursor-pointer ${
                            row.depth > 0 ? 'bg-muted/10 font-normal' : 'font-medium'
                          } ${row.getIsSelected() ? 'bg-primary/5' : ''}`}
                          onClick={() => row.toggleExpanded()}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id} className="py-2.5">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground">
                          No resource allocation data matching your current filters.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* VIEW 2: Granular Case Information Table & Specific Assignment */}
      {activeTab === 'cases' && (
        <CaseInformationTable
          records={activeRecords}
          availableAgents={availableAgents}
          onAssignSingle={handleAssignSingleCase}
          onAssignBatch={handleAssignMultipleCases}
          onOpenMultiDistribute={handleOpenMultiDistributeCases}
          onSwitchToMatrix={() => setActiveTab('matrix')}
          initialCityFilter={caseTableCityFilter}
          initialBucketFilter={caseTableBucketFilter}
        />
      )}

      {/* Multi-Agent Distribution Dialog */}
      <AssignmentDialog
        isOpen={isAssignDialogOpen}
        onClose={() => setAssignDialogOpen(false)}
        casesToAssign={dialogCases}
        availableAgents={availableAgents}
        onAssign={handleAssignSubmit}
      />
    </AppLayout>
  );
}
