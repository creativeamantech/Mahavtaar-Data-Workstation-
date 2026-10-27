import { useState, useEffect } from 'react';
import { runSystemIntegrityCheck, IntegrityReport } from '../../lib/integrityChecker';
import { Button } from '../ui/button';
import { ShieldCheck, AlertTriangle, XCircle, RefreshCw, Database, Activity, HardDrive, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export function SystemHealthDiagnostics() {
  const [report, setReport] = useState<IntegrityReport | null>(null);
  const [loading, setLoading] = useState(false);

  const runAudit = async () => {
    setLoading(true);
    try {
      const result = await runSystemIntegrityCheck();
      setReport(result);
      if (result.overallStatus === 'HEALTHY') {
        toast.success('System Integrity Audit: 100% Healthy');
      } else if (result.overallStatus === 'WARNING') {
        toast.warning(`System Integrity Audit: Warnings detected (${result.overallScore}/100)`);
      } else {
        toast.error(`System Integrity Audit: Critical issues found (${result.overallScore}/100)`);
      }
    } catch (e: any) {
      toast.error('Failed to complete diagnostic scan: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runAudit();
  }, []);

  if (!report && loading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground gap-3">
        <RefreshCw className="w-5 h-5 animate-spin text-primary" />
        <span>Scanning database structures and cryptographic hash chains...</span>
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Top Banner Score */}
      <div className="bg-card border rounded-xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className={`p-4 rounded-2xl ${
            report.overallStatus === 'HEALTHY' 
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
              : report.overallStatus === 'WARNING'
              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
              : 'bg-red-500/10 text-red-600 dark:text-red-400'
          }`}>
            {report.overallStatus === 'HEALTHY' ? (
              <ShieldCheck className="w-8 h-8" />
            ) : report.overallStatus === 'WARNING' ? (
              <AlertTriangle className="w-8 h-8" />
            ) : (
              <XCircle className="w-8 h-8" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold tracking-tight">System Integrity & Health</h2>
              <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full uppercase tracking-wider ${
                report.overallStatus === 'HEALTHY'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : report.overallStatus === 'WARNING'
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                  : 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300'
              }`}>
                {report.overallStatus}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Last scanned {new Date(report.timestamp).toLocaleTimeString()} · IndexedDB local state engine
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
          <div className="text-right">
            <span className="text-2xl font-bold font-mono">{report.overallScore}</span>
            <span className="text-sm text-muted-foreground font-mono">/100</span>
            <p className="text-[11px] text-muted-foreground uppercase font-medium">Health Score</p>
          </div>
          <Button onClick={runAudit} disabled={loading} size="sm" variant="outline" className="gap-2">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Re-scan
          </Button>
        </div>
      </div>

      {/* Database & Storage Telemetry */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
            <Database className="w-4 h-4 text-primary" />
            <span>Loan Records</span>
          </div>
          <div className="text-xl font-bold font-mono">{report.summary.totalRecords.toLocaleString()}</div>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
            <Activity className="w-4 h-4 text-emerald-500" />
            <span>Audit Trail Entries</span>
          </div>
          <div className="text-xl font-bold font-mono">{report.summary.totalAudits.toLocaleString()}</div>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
            <Activity className="w-4 h-4 text-blue-500" />
            <span>CRDT Journal Events</span>
          </div>
          <div className="text-xl font-bold font-mono">{report.summary.totalJournalEvents.toLocaleString()}</div>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
            <HardDrive className="w-4 h-4 text-indigo-500" />
            <span>IndexedDB Storage</span>
          </div>
          <div className="text-xl font-bold font-mono">
            {report.storageEstimate 
              ? `${Math.round(report.storageEstimate.usageBytes / 1024 / 1024 * 10) / 10} MB`
              : 'Local DB'}
          </div>
        </div>
      </div>

      {/* Integrity Checks Detailed List */}
      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b bg-muted/30">
          <h3 className="text-sm font-semibold">Integrity & Constraint Audits</h3>
        </div>
        <div className="divide-y">
          {report.checks.map((check) => (
            <div key={check.id} className="p-4 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  {check.status === 'PASSED' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : check.status === 'WARNING' ? (
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                  )}
                  <span className="text-sm font-semibold text-foreground">{check.name}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground uppercase">
                    {check.category}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground pl-6.5">{check.description}</p>
                {check.details && check.details.length > 0 && (
                  <div className="pl-6.5 pt-1">
                    <ul className="text-[11px] text-amber-600 dark:text-amber-400 font-mono list-disc list-inside space-y-0.5">
                      {check.details.map((d, idx) => (
                        <li key={idx}>{d}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {check.recommendation && (
                  <p className="text-[11px] text-primary font-medium pl-6.5 pt-0.5">
                    Action: {check.recommendation}
                  </p>
                )}
              </div>

              <div className="shrink-0">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  check.status === 'PASSED'
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                    : check.status === 'WARNING'
                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                    : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                }`}>
                  {check.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
