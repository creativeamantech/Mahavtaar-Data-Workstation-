/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useMemo } from "react";
import { AppLayout } from "../components/layout/AppLayout";
import { BucketFilter } from "../components/BucketFilter";
import { useData } from "../contexts/DataContext";
import { useAuth } from "../contexts/AuthContext";
import { fmtCur } from "../lib/formatters";
import { calculateRow } from "../lib/calculations";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from "../components/ui/sheet";
import { ScrollArea } from "../components/ui/scroll-area";
import {
  Building2,
  Filter,
  X,
  Plus,
  CheckCircle2,
  UserCircle2,
  Download,
  Calendar,
  BarChart3,
  PieChart,
  Scale,
  Equal,
  LayoutList,
  Sparkles,
  Layers,
  FileText,
  CheckSquare,
  
} from "lucide-react";
import { toast } from "sonner";

import CaseInformationTable from '../components/CaseInformationTable';

export default function Assignment() {
  const { records, bulkUpdateRecords, auditLog, globalBucket } = useData();
  const { user, users } = useAuth();

  // Filters & Toggles
  const [excludePaid, setExcludePaid] = useState(false);
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const [viewMode, setViewMode] = useState<"LIVE" | "DAILY">("LIVE");
  const [reportDate, setReportDate] = useState<string>(
    new Date().toLocaleDateString("en-CA"),
  ); // YYYY-MM-DD
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // View Switcher State
  const [activeTab, setActiveTab] = useState<"matrix" | "cases">("matrix");
  const [caseTableCityFilter, setCaseTableCityFilter] = useState("all");
  const [caseTableBucketFilter, setCaseTableBucketFilter] = useState("all");


  const existingExecutives = useMemo(() => {
    const execs = new Set<string>();
    // First, add all actual user accounts that are executives
    users.filter(u => u.role === 'EXECUTIVE').forEach(u => execs.add(u.name));
    
    // Then add any legacy executives that exist in the records
    records.forEach((r) => {
      const e = String(
        r.executive_name || r["Executive Name"] || r.EXECUTIVE_NAME || "",
      ).trim();
      if (e) execs.add(e);
    });
    return Array.from(execs).sort();
  }, [records, users]);

  // Active records respecting Bucket and Paid filters
  const activeRecords = useMemo(() => {
    return records.filter((r) => {
      if (
        globalBucket !== "ALL" &&
        String(r.bom_bkt).trim().toUpperCase() !== globalBucket
      ) {
        return false;
      }
      if (excludePaid) {
        const c = calculateRow(r);
        if (c.mainPaid === 1) return false;
      }
      return true;
    });
  }, [records, globalBucket, excludePaid]);

  // Extract all unallocated cases across the active dataset
  const allUnallocatedCases = useMemo(() => {
    return activeRecords.filter((r) => {
      const exec = String(
        r.executive_name || r["Executive Name"] || r.EXECUTIVE_NAME || "",
      ).trim();
      return !exec;
    });
  }, [activeRecords]);

  const totalUnallocatedCount = allUnallocatedCases.length;
  const totalUnallocatedPOS = useMemo(() => {
    return allUnallocatedCases.reduce(
      (sum, r) =>
        sum + (Number(r.principal_outstanding) || Number(r.amount) || 0),
      0,
    );
  }, [allUnallocatedCases]);

  // Total Portfolio KPIs
  const totalPortfolioCount = activeRecords.length;
  const totalPortfolioPOS = useMemo(() => {
    return activeRecords.reduce(
      (sum, r) =>
        sum + (Number(r.principal_outstanding) || Number(r.amount) || 0),
      0,
    );
  }, [activeRecords]);

  const totalAllocatedCount = totalPortfolioCount - totalUnallocatedCount;
  const totalAllocatedPOS = totalPortfolioPOS - totalUnallocatedPOS;

  // LIVE STATS: City Aggregation (Master Table)
  const cityStats = useMemo(() => {
    const stats: Record<
      string,
      {
        total: number;
        totalPos: number;
        unallocated: number;
        unallocatedPos: number;
        allocated: number;
        allocatedPos: number;
        execs: Record<string, number>;
        unallocatedCases: any[];
      }
    > = {};

    activeRecords.forEach((r) => {
      const city = String(r.city || r.City || r.location || "Unknown").trim();
      const exec = String(
        r.executive_name || r["Executive Name"] || r.EXECUTIVE_NAME || "",
      ).trim();
      const pos = Number(r.principal_outstanding) || Number(r.amount) || 0;

      if (!stats[city]) {
        stats[city] = {
          total: 0,
          totalPos: 0,
          unallocated: 0,
          unallocatedPos: 0,
          allocated: 0,
          allocatedPos: 0,
          execs: {},
          unallocatedCases: [],
        };
      }

      stats[city].total += 1;
      stats[city].totalPos += pos;

      if (exec) {
        stats[city].allocated += 1;
        stats[city].allocatedPos += pos;
        stats[city].execs[exec] = (stats[city].execs[exec] || 0) + 1;
      } else {
        stats[city].unallocated += 1;
        stats[city].unallocatedPos += pos;
        stats[city].unallocatedCases.push(r);
      }
    });

    let list = Object.entries(stats).map(([city, data]) => ({ city, ...data }));
    if (onlyUnassigned) {
      list = list.filter((item) => item.unallocated > 0);
    }
    return list.sort(
      (a, b) => b.total - a.total,
    );
  }, [activeRecords, onlyUnassigned]);

  // LIVE STATS: Executive Matrix (Sidebar)
  const execStatsList = useMemo(() => {
    const stats: Record<
      string,
      { total: number; totalPos: number; cities: Record<string, number> }
    > = {};
    activeRecords.forEach((r) => {
      const exec = String(
        r.executive_name || r["Executive Name"] || r.EXECUTIVE_NAME || "",
      ).trim();
      if (!exec) return;
      const city = String(r.city || r.City || r.location || "Unknown").trim();
      const pos = Number(r.principal_outstanding) || Number(r.amount) || 0;

      if (!stats[exec]) stats[exec] = { total: 0, totalPos: 0, cities: {} };
      stats[exec].total += 1;
      stats[exec].totalPos += pos;
      stats[exec].cities[city] = (stats[exec].cities[city] || 0) + 1;
    });

    // Flatten into rows: Executive | City | Count | Total
    const rows: {
      exec: string;
      city: string;
      count: number;
      execTotal: number;
    }[] = [];
    Object.entries(stats).forEach(([exec, data]) => {
      Object.entries(data.cities).forEach(([city, count]) => {
        rows.push({ exec, city, count, execTotal: data.total });
      });
    });

    // Sort by Executive Total Desc, then Executive Name, then Count Desc
    return rows.sort(
      (a, b) =>
        b.execTotal - a.execTotal ||
        a.exec.localeCompare(b.exec) ||
        b.count - a.count,
    );
  }, [activeRecords]);

  // DAILY STATS: Based on Audit Log
  const dailyReport = useMemo(() => {
    const dailyLogs = auditLog.filter((log) => {
      if (log.field !== "executive_name") return false;
      if (!log.newValue || String(log.newValue).trim() === "") return false;
      const logDate = new Date(log.createdAt).toLocaleDateString("en-CA");
      return logDate === reportDate;
    });

    const aggregated: Record<
      string,
      { exec: string; city: string; count: number; pos: number }
    > = {};

    dailyLogs.forEach((log) => {
      const exec = String(log.newValue).trim();
      const record = records.find(
        (r) =>
          String(r.agreementid || r.agreement_no || r.id) === log.agreementid,
      );
      if (!record) return;

      if (
        globalBucket !== "ALL" &&
        String(record.bom_bkt).trim().toUpperCase() !== globalBucket
      )
        return;
      const city = String(
        record.city || record.City || record.location || "Unknown",
      ).trim();
      const pos =
        Number(record.principal_outstanding) || Number(record.amount) || 0;
      const key = `${exec}|${city}`;

      if (!aggregated[key]) {
        aggregated[key] = { exec, city, count: 0, pos: 0 };
      }
      aggregated[key].count += 1;
      aggregated[key].pos += pos;
    });

    return Object.values(aggregated).sort((a, b) => b.count - a.count);
  }, [auditLog, records, reportDate, globalBucket]);

  // Modal State
  const [assignModal, setAssignModal] = useState<{
    title: string;
    cases: any[];
  } | null>(null);
  const [selectedExecs, setSelectedExecs] = useState<
    { name: string; val: string }[]
  >([{ name: "", val: "" }]);
  const [distMode, setDistMode] = useState<
    "EQUAL" | "CUSTOM" | "PERCENT" | "POS"
  >("EQUAL");

  // Distribution Logic Info
  const DIST_INFO = {
    EQUAL:
      "Equally divides the case count among all listed executives. Any remainder is distributed 1-by-1 to the first few.",
    CUSTOM:
      "Assigns exactly the specific number of cases you input for each executive.",
    PERCENT:
      "Distributes cases based on a percentage (e.g., 60% to Exec A, 40% to Exec B). Ensure totals equal 100%.",
    POS: "Load balances based on monetary value. It intelligently assigns high-value cases to ensure all executives receive a roughly equal total Principal Outstanding (POS) amount, rather than just equal case counts.",
  };

  const openAssignModal = (title: string, cases: any[]) => {
    setAssignModal({ title, cases });
    setSelectedExecs([{ name: existingExecutives[0] || "", val: "" }]);
    setDistMode("EQUAL");
  };

  const handleAssignAllUnallocated = () => {
    if (totalUnallocatedCount === 0) {
      toast.info("No unallocated cases found in current view.");
      return;
    }
    openAssignModal(
      "All Unallocated Cases (Entire Portfolio)",
      allUnallocatedCases,
    );
  };

  const handleConfirmAssignment = async () => {
    if (!assignModal) return;
    const validExecs = selectedExecs.filter((e) => e.name.trim() !== "");
    if (validExecs.length === 0) {
      toast.error("Please enter or select at least one executive.");
      return;
    }

    const availableCases = [...assignModal.cases];
    const updates: { agreementid: string; field: string; value: string }[] = [];

    if (distMode === "EQUAL") {
      const N = validExecs.length;
      const base = Math.floor(availableCases.length / N);
      let remainder = availableCases.length % N;
      let caseIdx = 0;

      validExecs.forEach((exec) => {
        const count = base + (remainder > 0 ? 1 : 0);
        if (remainder > 0) remainder--;
        for (let i = 0; i < count; i++) {
          if (caseIdx < availableCases.length) {
            const c = availableCases[caseIdx++];
            updates.push({
              agreementid: String(c.agreementid || c.agreement_no || c.id),
              field: "executive_name",
              value: exec.name.trim(),
            });
          }
        }
      });
    } else if (distMode === "CUSTOM") {
      const totalReq = validExecs.reduce(
        (s, e) => s + (parseInt(e.val) || 0),
        0,
      );
      if (totalReq > availableCases.length) {
        toast.error(
          `Requested ${totalReq} cases, but only ${availableCases.length} available.`,
        );
        return;
      }

      let caseIdx = 0;
      validExecs.forEach((exec) => {
        const count = parseInt(exec.val) || 0;
        for (let i = 0; i < count; i++) {
          if (caseIdx < availableCases.length) {
            const c = availableCases[caseIdx++];
            updates.push({
              agreementid: String(c.agreementid || c.agreement_no || c.id),
              field: "executive_name",
              value: exec.name.trim(),
            });
          }
        }
      });
    } else if (distMode === "PERCENT") {
      const totalPct = validExecs.reduce(
        (s, e) => s + (parseFloat(e.val) || 0),
        0,
      );
      if (Math.abs(totalPct - 100) > 0.1) {
        toast.error(`Percentages must equal 100%. Currently: ${totalPct}%`);
        return;
      }

      let caseIdx = 0;
      const totalCases = availableCases.length;
      let assignedCount = 0;

      validExecs.forEach((exec, index) => {
        let count = Math.round(
          totalCases * ((parseFloat(exec.val) || 0) / 100),
        );
        // Adjustment for rounding errors on the last executive
        if (index === validExecs.length - 1) {
          count = totalCases - assignedCount;
        }
        for (let i = 0; i < count; i++) {
          if (caseIdx < availableCases.length) {
            const c = availableCases[caseIdx++];
            updates.push({
              agreementid: String(c.agreementid || c.agreement_no || c.id),
              field: "executive_name",
              value: exec.name.trim(),
            });
            assignedCount++;
          }
        }
      });
    } else if (distMode === "POS") {
      // Sort cases by POS descending
      availableCases.sort(
        (a, b) =>
          (Number(b.principal_outstanding) || Number(b.amount) || 0) -
          (Number(a.principal_outstanding) || Number(a.amount) || 0),
      );

      // Track running POS for each exec
      const execLoads = validExecs.map((e) => ({
        name: e.name.trim(),
        currentPos: 0,
      }));

      availableCases.forEach((c) => {
        // Find exec with minimum load
        execLoads.sort((a, b) => a.currentPos - b.currentPos);
        const chosenExec = execLoads[0];

        updates.push({
          agreementid: String(c.agreementid || c.agreement_no || c.id),
          field: "executive_name",
          value: chosenExec.name,
        });
        chosenExec.currentPos +=
          Number(c.principal_outstanding) || Number(c.amount) || 0;
      });
    }

    if (updates.length > 0) {
      await bulkUpdateRecords(updates, user?.name || "System");
      toast.success(
        `Successfully allocated ${updates.length} cases to ${validExecs.length} executive(s)!`,
      );
    }
    setAssignModal(null);
  };

  // CSV Export
  const handleExport = () => {
    let csv = "";
    if (viewMode === "LIVE") {
      csv += "EXECUTIVE SIDEBAR PORTFOLIO\n";
      csv += "Executive,City,Allocated Cases,Total\n";
      execStatsList.forEach((row) => {
        csv += `"${row.exec}","${row.city}",${row.count},${row.execTotal}\n`;
      });
      csv += "\nCITY ALLOCATION OVERVIEW\n";
      csv += "City,Total Cases,Allocated,Unallocated,Unallocated POS\n";
      cityStats.forEach((stat) => {
        csv += `"${stat.city}",${stat.total},${stat.allocated},${stat.unallocated},${stat.unallocatedPos}\n`;
      });
    } else {
      csv += `DAILY ASSIGNMENT REPORT - ${reportDate}\n`;
      csv += "Executive,City,Cases Assigned,Principal (POS)\n";
      dailyReport.forEach((row) => {
        csv += `"${row.exec}","${row.city}",${row.count},${row.pos}\n`;
      });
    }

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Allocation_Export_${viewMode}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <AppLayout>
      <div className="mb-4"><BucketFilter /></div>
      {/* Header & Controls */}
      <div className="mb-6 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold uppercase tracking-wider text-foreground">
              Resource Allocation
            </h1>
            <span className="bg-primary/10 text-primary text-xs font-bold px-2.5 py-0.5 rounded-full">
              Engine v2.0
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Multi-logic portfolio distribution, POS load-balancing, and pending
            backlog resolution.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto">
          {/* Allocate All Direct Button */}
          <button
            onClick={handleAssignAllUnallocated}
            disabled={totalUnallocatedCount === 0}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-sm ${
              totalUnallocatedCount > 0
                ? "bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20 shadow-md animate-pulse"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            }`}
          >
            <Sparkles className="h-4 w-4" /> Allocate All (
            {totalUnallocatedCount})
          </button>

          {/* Reports Sidebar */}
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm border border-transparent">
                <LayoutList className="h-4 w-4" /> Live Stats & Reports
              </button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-full sm:max-w-xl md:max-w-2xl bg-card p-0 border-l border-border flex flex-col h-full z-[100]"
            >
              <SheetHeader className="p-6 border-b border-border bg-muted/10">
                <SheetTitle className="text-xl font-heading font-bold text-foreground flex items-center gap-2">
                  <LayoutList className="h-5 w-5 text-primary" /> Reports
                  Sidebar
                </SheetTitle>
                <SheetDescription className="font-sans text-sm font-medium">
                  Live Executive Allocations & Daily History
                </SheetDescription>
              </SheetHeader>
              <ScrollArea className="flex-1 p-6">
                <div className="space-y-8">
                  {/* Live Stats */}
                  <div className="bg-card border border-border rounded-xl shadow-sm flex flex-col overflow-hidden max-h-[500px]">
                    <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <UserCircle2 className="h-5 w-5 text-info" />
                        <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                          Current Live Allocations
                        </h2>
                      </div>
                    </div>
                    <div className="overflow-y-auto scrollbar-thin">
                      {execStatsList.length === 0 ? (
                        <div className="text-center text-muted-foreground py-12 text-sm">
                          No allocated executives found.
                        </div>
                      ) : (
                        <table className="w-full text-xs text-left whitespace-nowrap">
                          <thead className="bg-muted/30 text-muted-foreground uppercase tracking-widest text-[10px] sticky top-0 border-b border-border">
                            <tr>
                              <th className="px-4 py-3 font-semibold text-center w-12 bg-muted/90 text-muted-foreground uppercase text-[10px]">S.No.</th>
                  <th className="px-4 py-3 font-bold">Executive</th>
                              <th className="px-4 py-3 font-bold">City</th>
                              <th className="px-4 py-3 font-bold text-center">
                                Count
                              </th>
                              <th className="px-4 py-3 font-bold text-center hidden md:table-cell">
                                Total
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {execStatsList.map((row, i) => {
                              const isFirstForExec =
                                i === 0 ||
                                execStatsList[i - 1].exec !== row.exec;
                              return (
                                <tr
                                  key={i}
                                  className="hover:bg-muted/10 transition-colors"
                                >
                                  <td className="px-4 py-3 text-center text-xs font-bold text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-foreground">
                                    {isFirstForExec ? row.exec : ""}
                                  </td>
                                  <td className="px-4 py-3 font-semibold">
                                    {row.city}
                                  </td>
                                  <td className="px-4 py-3 text-center font-bold">
                                    {row.count}
                                  </td>
                                  <td
                                    className={`px-4 py-3 text-center font-black hidden md:table-cell ${isFirstForExec ? "text-primary bg-primary/5 rounded-md" : "text-transparent"}`}
                                  >
                                    {isFirstForExec ? row.execTotal : ""}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                  {/* Daily Report */}
                  <div className="bg-card border border-border rounded-xl shadow-sm flex flex-col overflow-hidden max-h-[500px]">
                    <div className="p-4 border-b border-border bg-muted/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-warning" />
                        <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                          Daily History
                        </h2>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          Date:
                        </span>
                        <input
                          type="date"
                          value={reportDate}
                          onChange={(e) => setReportDate(e.target.value)}
                          className="h-9 px-3 rounded bg-background border border-border text-sm outline-none focus:border-primary shadow-sm cursor-pointer"
                        />
                      </div>
                    </div>
                    <div className="overflow-auto scrollbar-thin">
                      <table className="w-full text-left border-collapse whitespace-nowrap">
                        <thead className="bg-muted/50 border-b border-border sticky top-0">
                          <tr>
                            <th className="px-4 py-3 font-semibold text-center w-12 bg-muted/90 text-muted-foreground uppercase text-[10px]">S.No.</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                              Executive
                            </th>
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                              City
                            </th>
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">
                              Assigned
                            </th>
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right hidden sm:table-cell">
                              Total POS
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border text-sm">
                          {dailyReport.length === 0 ? (
                            <tr>
                              <td
                                colSpan={4}
                                className="px-6 py-12 text-center text-muted-foreground"
                              >
                                No assignments recorded on this date.
                              </td>
                            </tr>
                          ) : (
                            dailyReport.map((row, i) => (
                              <tr
                                key={i}
                                className="hover:bg-muted/20 transition-colors"
                              >
                                <td className="px-4 py-3 text-center text-xs font-bold text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-3 font-semibold text-foreground">
                                  {row.exec}
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">
                                  {row.city}
                                </td>
                                <td className="px-4 py-3 text-center font-bold text-primary">
                                  {row.count}
                                </td>
                                <td className="px-4 py-3 text-right font-medium text-info hidden sm:table-cell">
                                  {fmtCur(row.pos)}
                                </td>
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

          <button
            onClick={() => setOnlyUnassigned(!onlyUnassigned)}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-sm border ${
              onlyUnassigned
                ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40"
                : "bg-card text-foreground border-border hover:bg-muted"
            }`}
          >
            <CheckSquare className="h-4 w-4" />{" "}
            {onlyUnassigned ? "Pending Only" : "All Cities"}
          </button>

          <button
            onClick={() => setExcludePaid(!excludePaid)}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-sm border ${
              excludePaid
                ? "bg-primary/10 text-primary border-primary"
                : "bg-card text-foreground border-border hover:bg-muted"
            }`}
          >
            <Filter className="h-4 w-4" />{" "}
            {excludePaid ? "Unpaid Only" : "All Statuses"}
          </button>

          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all bg-card border border-border hover:bg-muted text-foreground"
          >
            <Download className="h-4 w-4" /> Export
          </button>
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
          </button>
        </div>
      </div>

      {/* Global Filter Indicator (For when User works with the Global Bucket Filter) */}
      {globalBucket !== "ALL" && (
        <div className="mb-6 bg-primary/10 border border-primary/20 rounded-lg p-3 flex items-center justify-between shadow-sm animate-in fade-in zoom-in duration-300">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold text-primary">
              Active Bucket Filter:{" "}
              <span className="uppercase tracking-widest bg-primary text-primary-foreground px-2 py-0.5 rounded ml-1 text-xs">
                {globalBucket}
              </span>
            </span>
          </div>
          <p className="text-xs font-medium text-primary/80 hidden sm:block">
            All views and exports below are currently restricted to this bucket.
          </p>
        </div>
      )}

      {/* Prominent Global Unallocated Summary Banner */}
      {totalUnallocatedCount > 0 ? (
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-primary/10 border border-amber-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Scale className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-foreground">
                  {totalUnallocatedCount} Unallocated Cases Awaiting Assignment
                </span>
                <span className="bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-[11px] font-bold px-2 py-0.5 rounded-full">
                  Pending POS: {fmtCur(totalUnallocatedPOS)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Distribute all remaining unallocated loans across executives
                evenly, by POS load, or custom percentage split in one single
                operation.
              </p>
            </div>
          </div>

          <button
            onClick={handleAssignAllUnallocated}
            className="w-full md:w-auto bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs uppercase tracking-wider px-5 py-2.5 rounded-xl shadow-md shrink-0 flex items-center justify-center gap-2 hover:scale-[1.02] transition-all"
          >
            <Sparkles className="h-4 w-4" />
            Allocate All ({totalUnallocatedCount}) Cases
          </button>
        </div>
      ) : (
        <div className="mb-6 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between gap-3 text-xs text-emerald-700 dark:text-emerald-300">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="font-semibold">
              Complete Coverage: 100% of cases in active portfolio are allocated
              to field executives.
            </span>
          </div>
          <span className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-bold text-[11px]">
            0 Pending Cases
          </span>
        </div>
      )}

      
      {activeTab === 'matrix' && (
        <div className="space-y-6">

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
        <div className="bg-card border border-border rounded-xl p-4 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Total Portfolio
          </p>
          <h3 className="text-xl font-bold text-foreground mt-0.5">
            {totalPortfolioCount} Cases
          </h3>
          <p className="text-xs font-medium text-muted-foreground mt-0.5">
            {fmtCur(totalPortfolioPOS)}
          </p>
        </div>

        <div className="bg-card border border-amber-500/30 rounded-xl p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Total Unallocated
              </p>
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping"></span>
            </div>
            <h3 className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">
              {totalUnallocatedCount} Cases
            </h3>
            <p className="text-xs font-medium text-muted-foreground mt-0.5">
              {fmtCur(totalUnallocatedPOS)}
            </p>
          </div>
          {totalUnallocatedCount > 0 && (
            <button
              onClick={handleAssignAllUnallocated}
              className="mt-3 w-full py-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 rounded-md transition-colors flex items-center justify-center gap-1"
            >
              <Sparkles className="h-3 w-3" /> Allocate All
            </button>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
            Allocated Portfolio
          </p>
          <h3 className="text-xl font-bold text-primary mt-0.5">
            {totalAllocatedCount} Cases
          </h3>
          <p className="text-xs font-medium text-muted-foreground mt-0.5">
            {fmtCur(totalAllocatedPOS)}
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Active Cities
          </p>
          <h3 className="text-xl font-bold text-foreground mt-0.5">
            {cityStats.length} Regions
          </h3>
          <p className="text-xs font-medium text-muted-foreground mt-0.5">
            {existingExecutives.length} Field Executives
          </p>
        </div>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 w-full">
        {/* Main Content: City Grid */}
        <div className="w-full bg-card border border-border rounded-xl shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                City Allocation Master
              </h2>
            </div>
            {totalUnallocatedCount > 0 && (
              <button
                onClick={handleAssignAllUnallocated}
                className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Allocate All Unallocated ({totalUnallocatedCount})
              </button>
            )}
          </div>
          <div className="overflow-x-auto scrollbar-thin max-h-[800px]">
            <table className="w-full text-left border-collapse whitespace-nowrap min-w-[650px]">
              <thead className="bg-muted/50 border-b border-border sticky top-0">
                <tr>
                  <th className="px-4 py-3 font-semibold text-center w-12 bg-muted/90 text-muted-foreground uppercase text-[10px]">S.No.</th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-muted-foreground">
                    City
                  </th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-muted-foreground text-center">
                    Total Cases
                  </th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-muted-foreground text-center text-primary">
                    Allocated
                  </th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-muted-foreground text-center text-amber-600 dark:text-amber-400">
                    Unallocated Backlog
                  </th>
                  <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-muted-foreground text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {cityStats.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-12 text-center text-muted-foreground"
                    >
                      No cases found matching filters.
                    </td>
                  </tr>
                ) : (
                  cityStats.map((stat, i) => (
                    <tr
                      key={stat.city}
                      className="hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-4 py-3 text-center text-xs font-bold text-muted-foreground">{i + 1}</td>
                  <td className="px-6 py-4 font-bold text-foreground">
                        <div>
                          <span>{stat.city}</span>
                          <p className="text-[11px] font-normal text-muted-foreground">
                            Total POS: {fmtCur(stat.totalPos)}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center font-semibold">
                        {stat.total}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col gap-1 items-center justify-center">
                          <span className="font-bold text-primary">
                            {stat.allocated}
                          </span>
                          {stat.allocated > 0 && (
                            <div className="flex flex-wrap justify-center gap-1 mt-1 max-w-[280px]">
                              {Object.entries(stat.execs).map(
                                ([exec, count]) => (
                                  <span
                                    key={exec}
                                    className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary"
                                  >
                                    {exec}: {count}
                                  </span>
                                ),
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {stat.unallocated > 0 ? (
                          <div>
                            <span className="font-bold text-amber-600 dark:text-amber-400">
                              {stat.unallocated} Cases
                            </span>
                            <p className="text-[11px] font-medium text-muted-foreground">
                              {fmtCur(stat.unallocatedPos)}
                            </p>
                          </div>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                            Fully Allocated
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {stat.unallocated > 0 ? (
                          <button
                            onClick={() =>
                              openAssignModal(
                                `City: ${stat.city}`,
                                stat.unallocatedCases,
                              )
                            }
                            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold hover:bg-amber-600 hover:text-white transition-all shadow-xs text-xs"
                          >
                            <Plus className="h-3.5 w-3.5" /> Allocate (
                            {stat.unallocated})
                          </button>
                        ) : (
                          <span className="text-muted-foreground/40 text-xs">
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Assignment Modal overlay */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[95vh]">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-border bg-muted/30 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  Distribute Portfolio:{" "}
                  <span className="text-primary">{assignModal.title}</span>
                </h2>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="inline-flex items-center rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-xs font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300">
                    {assignModal.cases.length} Pending Cases
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">
                    Total POS:{" "}
                    {fmtCur(
                      assignModal.cases.reduce(
                        (s, c) =>
                          s +
                          (Number(c.principal_outstanding) ||
                            Number(c.amount) ||
                            0),
                        0,
                      ),
                    )}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setAssignModal(null)}
                className="p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 bg-background">
              {/* Distribution Mode Tabs */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                {[
                  { id: "EQUAL", label: "Equal Split", icon: Equal },
                  { id: "POS", label: "POS Balance", icon: Scale },
                  { id: "PERCENT", label: "Percentage (%)", icon: PieChart },
                  { id: "CUSTOM", label: "Custom Count", icon: BarChart3 },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setDistMode(mode.id as any)}
                    className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all ${distMode === mode.id ? "bg-primary/10 border-primary text-primary shadow-sm scale-[1.02] font-bold" : "bg-card border-border text-muted-foreground hover:bg-muted"}`}
                  >
                    <mode.icon className="h-6 w-6" />
                    <span className="text-[11px] font-bold uppercase tracking-wider">
                      {mode.label}
                    </span>
                  </button>
                ))}
              </div>

              {/* Mode Info Box */}
              <div className="mb-6 p-4 rounded-xl bg-primary/5 border border-primary/20 text-sm text-foreground/90 flex items-start gap-3 shadow-inner">
                <div className="shrink-0 mt-0.5 text-primary">
                  <Scale className="h-5 w-5" />
                </div>
                <p className="leading-relaxed font-medium text-xs">
                  {DIST_INFO[distMode]}
                </p>
              </div>

              {/* Executives List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Select Agents & Distribution Parameters
                  </label>
                  <span className="text-xs text-muted-foreground">
                    {selectedExecs.filter((e) => e.name.trim()).length} agent(s)
                    selected
                  </span>
                </div>

                {selectedExecs.map((exec, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 animate-in slide-in-from-left-2"
                  >
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={exec.name}
                        onChange={(e) => {
                          const n = [...selectedExecs];
                          n[idx].name = e.target.value;
                          setSelectedExecs(n);
                        }}
                        placeholder="Select or enter agent name..."
                        list="modal-exec-list"
                        className="w-full h-11 px-4 rounded-xl bg-card border border-border text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                      />
                    </div>

                    {distMode === "CUSTOM" && (
                      <div className="w-32 relative">
                        <input
                          type="number"
                          min="1"
                          max={assignModal.cases.length}
                          value={exec.val}
                          placeholder="Count"
                          onChange={(e) => {
                            const n = [...selectedExecs];
                            n[idx].val = e.target.value;
                            setSelectedExecs(n);
                          }}
                          className="w-full h-11 px-4 rounded-xl bg-card border border-border text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                        />
                      </div>
                    )}

                    {distMode === "PERCENT" && (
                      <div className="w-32 relative flex items-center">
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={exec.val}
                          placeholder="0"
                          onChange={(e) => {
                            const n = [...selectedExecs];
                            n[idx].val = e.target.value;
                            setSelectedExecs(n);
                          }}
                          className="w-full h-11 px-4 pr-8 rounded-xl bg-card border border-border text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                        />
                        <span className="absolute right-3 text-muted-foreground font-bold text-xs">
                          %
                        </span>
                      </div>
                    )}

                    {(distMode === "EQUAL" || distMode === "POS") && (
                      <div className="w-32 h-11 px-4 flex items-center justify-center bg-muted/50 rounded-xl text-xs font-bold uppercase tracking-widest text-muted-foreground border border-border">
                        Auto Split
                      </div>
                    )}

                    <button
                      onClick={() => {
                        const n = [...selectedExecs];
                        n.splice(idx, 1);
                        if (n.length === 0) n.push({ name: "", val: "" });
                        setSelectedExecs(n);
                      }}
                      className="shrink-0 p-2.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={() =>
                  setSelectedExecs([...selectedExecs, { name: "", val: "" }])
                }
                className="mt-5 flex items-center justify-center w-full sm:w-auto gap-2 text-xs font-bold uppercase tracking-wider text-primary hover:text-primary/80 transition-colors bg-primary/5 border border-primary/20 px-5 py-2.5 rounded-xl hover:bg-primary/10"
              >
                <Plus className="h-4 w-4" /> Add Another Agent
              </button>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-5 border-t border-border bg-muted/30 flex flex-wrap justify-end gap-3">
              <button
                onClick={() => setAssignModal(null)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-muted-foreground hover:bg-muted transition-colors border border-transparent"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAssignment}
                className="flex items-center gap-2 px-7 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider shadow-md hover:bg-primary/90 transition-all hover:scale-[1.02]"
              >
                <CheckCircle2 className="h-4 w-4" />
                Distribute & Save ({assignModal.cases.length} Cases)
              </button>
            </div>
          </div>
        </div>
      )}

      <datalist id="modal-exec-list">
        {existingExecutives.map((e) => (
          <option key={e} value={e} />
        ))}
      </datalist>

        </div>
      )}
      {activeTab === 'cases' && (
        <CaseInformationTable 
          records={activeRecords}
          executives={existingExecutives}
          initialCityFilter={caseTableCityFilter}
          initialBucketFilter={caseTableBucketFilter}
          onSwitchToMatrix={() => setActiveTab('matrix')}
          onAssignSingle={async (id, exec) => {
            await bulkUpdateRecords([{ agreementid: id, field: 'executive_name', value: exec }], user?.name || "System");
          }}
          onAssignBatch={async (ids, exec) => {
            const updates = ids.map(id => ({ agreementid: id, field: 'executive_name', value: exec }));
            await bulkUpdateRecords(updates, user?.name || "System");
          }}
        />
      )}

    </AppLayout>
  );
}
