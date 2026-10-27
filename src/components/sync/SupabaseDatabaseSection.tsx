import React, { useState, useEffect } from 'react';
import { 
  Database, CheckCircle2, AlertCircle, RefreshCw, 
  ArrowUpRight, ArrowDownLeft, Cloud, CloudOff, 
  Copy, Check, ExternalLink, ShieldCheck, Terminal,
  Radio, HardDrive, Layers
} from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { 
  isSupabaseConfigured, 
  getSupabaseConfig, 
  testSupabaseConnection, 
  syncWithSupabase, 
  fetchSupabaseTableCounts,
  subscribeToSupabaseRealtime,
  ConnectionTestResult,
  SyncResult
} from '../../lib/supabase';
import { db } from '../../lib/db';

export function SupabaseDatabaseSection() {
  const config = getSupabaseConfig();
  const [isConfigured] = useState(config.isConfigured);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('');
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [realtimeActive, setRealtimeActive] = useState(false);
  const [recentEvents, setRecentEvents] = useState<{ id: string; table: string; type: string; time: string }[]>([]);

  const [localCounts, setLocalCounts] = useState<Record<string, number>>({});
  const [cloudCounts, setCloudCounts] = useState<Record<string, number>>({});

  const loadLocalCounts = async () => {
    try {
      const [loans, feedbacks, users, attendance, targets, audits, sessions] = await Promise.all([
        db.loan_records.count(),
        db.customer_feedbacks.count(),
        db.users.count(),
        db.attendance_logs.count(),
        db.state_targets.count(),
        db.audit_log.count(),
        db.upload_sessions.count(),
      ]);

      setLocalCounts({
        loan_records: loans,
        customer_feedbacks: feedbacks,
        users,
        attendance_logs: attendance,
        state_targets: targets,
        audit_log: audits,
        upload_sessions: sessions,
      });
    } catch (e) {
      console.error('Failed to load local counts', e);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      const res = await testSupabaseConnection();
      setTestResult(res);
      if (res.success) {
        toast.success(`Supabase connected (${res.latencyMs}ms)`);
        const remoteCounts = await fetchSupabaseTableCounts();
        setCloudCounts(remoteCounts);
      } else {
        toast.error(res.message || 'Supabase connection failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Connection test failed');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSync = async (direction: 'push' | 'pull' | 'bidirectional') => {
    if (!isConfigured) {
      toast.error('Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY first.');
      return;
    }

    setIsSyncing(true);
    setSyncStatus('Initializing sync...');
    try {
      const result = await syncWithSupabase(direction, (msg, curr, tot) => {
        setSyncStatus(msg);
        setSyncProgress({ current: curr, total: tot });
      });

      setLastSyncResult(result);
      if (result.success) {
        toast.success(`Sync completed: ${result.pushed} pushed, ${result.pulled} pulled in ${result.durationMs}ms`);
      } else {
        toast.warning(`Sync finished with warnings: ${result.errors.join(', ')}`);
      }

      await loadLocalCounts();
      const remoteCounts = await fetchSupabaseTableCounts();
      setCloudCounts(remoteCounts);
    } catch (err: any) {
      toast.error(err?.message || 'Sync failed');
    } finally {
      setIsSyncing(false);
      setSyncStatus('');
    }
  };

  useEffect(() => {
    loadLocalCounts();
    if (isConfigured) {
      handleTestConnection();
    }
  }, [isConfigured]);

  // Realtime subscription toggle
  useEffect(() => {
    if (!isConfigured || !realtimeActive) return;

    const unsubscribe = subscribeToSupabaseRealtime((table, eventType) => {
      setRecentEvents((prev) => [
        {
          id: crypto.randomUUID(),
          table,
          type: eventType,
          time: new Date().toLocaleTimeString(),
        },
        ...prev.slice(0, 9),
      ]);
      loadLocalCounts();
    });

    return () => {
      unsubscribe();
    };
  }, [isConfigured, realtimeActive]);

  const rawSqlSchema = `-- Mahavtaar Ledger - Supabase Schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.loan_records (
    agreementid TEXT PRIMARY KEY,
    customer_name TEXT,
    customer_no TEXT,
    mobile TEXT,
    city TEXT,
    state TEXT,
    pos NUMERIC DEFAULT 0,
    bom_pos NUMERIC DEFAULT 0,
    tos NUMERIC DEFAULT 0,
    bom_bkt TEXT,
    cur_bkt TEXT,
    allocated_agency TEXT,
    executive_name TEXT,
    last_action TEXT,
    last_disposition TEXT,
    ptp_date TIMESTAMPTZ,
    status TEXT DEFAULT 'ACTIVE',
    total_paid NUMERIC DEFAULT 0,
    waiver_amount NUMERIC DEFAULT 0,
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.customer_feedbacks (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    agreementid TEXT NOT NULL,
    "contactNumber" TEXT,
    availability TEXT,
    status TEXT,
    "standardFeedback" TEXT,
    "detailedFeedback" TEXT,
    "ref1Availability" TEXT,
    "ref1Feedback" TEXT,
    "ref2Availability" TEXT,
    "ref2Feedback" TEXT,
    "paidSubStatus" TEXT,
    "amountPaid" NUMERIC,
    "paymentMode" TEXT,
    "approvedAmount" NUMERIC,
    "nonContactableSubStatus" TEXT,
    "ptpDate" TEXT,
    "cbDate" TEXT,
    "detailedFeedbackThirdParty" TEXT,
    "detailedFeedbackAgentDispute" TEXT,
    "overallDetailedFeedback" TEXT,
    "concernNumber" TEXT,
    "relationName" TEXT,
    "agentId" TEXT,
    "agentName" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'VIEWER',
    "passwordHash" TEXT,
    salt TEXT,
    iterations INT,
    permissions JSONB DEFAULT '{"views":[]}'::jsonb,
    "assignedExecutiveName" TEXT,
    "maintenanceMode" BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.attendance_logs (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    date TEXT NOT NULL,
    "loginTime" TIMESTAMPTZ NOT NULL,
    "logoutTime" TIMESTAMPTZ,
    "breakDuration" NUMERIC DEFAULT 0,
    "currentBreakStart" TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.state_targets (
    key TEXT PRIMARY KEY,
    pct NUMERIC NOT NULL,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.upload_sessions (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    type TEXT,
    "fileName" TEXT,
    "recordCount" INT DEFAULT 0,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_log (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    agreementid TEXT,
    field TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "changedBy" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    source TEXT
);

-- Enable RLS & Policies
ALTER TABLE public.loan_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.state_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon for loan_records" ON public.loan_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon for customer_feedbacks" ON public.customer_feedbacks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon for users" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon for attendance_logs" ON public.attendance_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon for state_targets" ON public.state_targets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon for upload_sessions" ON public.upload_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon for audit_log" ON public.audit_log FOR ALL USING (true) WITH CHECK (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.loan_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_feedbacks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.state_targets;`;

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(rawSqlSchema);
    setCopiedSql(true);
    toast.success('Supabase SQL Schema copied to clipboard!');
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const tableList = [
    { key: 'loan_records', label: 'Loan Portfolio Records', desc: 'Active debt agreements and portfolio states' },
    { key: 'customer_feedbacks', label: 'Customer Feedbacks & PTPs', desc: 'Call dispositions and payment promises' },
    { key: 'users', label: 'System User Accounts', desc: 'Staff credentials and RBAC access roles' },
    { key: 'attendance_logs', label: 'Staff Attendance & Shifts', desc: 'Login punches and break timers' },
    { key: 'state_targets', label: 'Recovery Targets', desc: 'State and city target thresholds' },
    { key: 'upload_sessions', label: 'File Upload Sessions', desc: 'Batch file import ledger records' },
    { key: 'audit_log', label: 'Audit Trail Entries', desc: 'Tamper-evident change log history' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner / Status */}
      <div className="bg-card border border-border/80 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-2xl ${isConfigured ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'}`}>
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-lg font-bold text-foreground">Supabase PostgreSQL Cloud Database</h3>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                  isConfigured 
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                }`}>
                  {isConfigured ? (
                    <>
                      <Cloud className="w-3 h-3" />
                      Configured
                    </>
                  ) : (
                    <>
                      <CloudOff className="w-3 h-3" />
                      Needs Configuration
                    </>
                  )}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 max-w-xl">
                {isConfigured 
                  ? `Connected to Supabase project (${config.projectRef || 'Remote'}). Provides centralized cloud storage, automated backup, and live real-time sync.`
                  : 'Connect your Supabase project to enable centralized cloud PostgreSQL storage, live multi-device synchronization, and automated data durability.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleTestConnection} 
              disabled={isTesting}
              className="text-xs font-semibold"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isTesting ? 'animate-spin text-primary' : ''}`} />
              {isTesting ? 'Testing Ping...' : 'Test Connection'}
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={() => handleSync('bidirectional')}
              disabled={isSyncing || !isConfigured}
              className="text-xs font-semibold"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </Button>
          </div>
        </div>

        {/* Credentials Preview */}
        <div className="mt-5 pt-4 border-t border-border/60 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-muted/40 border border-border/60">
            <span className="text-[11px] font-medium text-muted-foreground block mb-0.5">Project URL</span>
            <span className="font-mono text-foreground break-all">{config.url || 'Not set (VITE_SUPABASE_URL)'}</span>
          </div>
          <div className="p-3 rounded-xl bg-muted/40 border border-border/60">
            <span className="text-[11px] font-medium text-muted-foreground block mb-0.5">Anon Public Key</span>
            <span className="font-mono text-foreground">{config.maskedKey || 'Not set (VITE_SUPABASE_ANON_KEY)'}</span>
          </div>
          <div className="p-3 rounded-xl bg-muted/40 border border-border/60 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-medium text-muted-foreground block mb-0.5">Realtime Stream</span>
              <span className="font-semibold text-foreground">{realtimeActive ? 'Listening to changes' : 'Inactive'}</span>
            </div>
            {isConfigured && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setRealtimeActive(!realtimeActive)}
                className={`text-[11px] h-7 px-2.5 ${realtimeActive ? 'text-emerald-600 bg-emerald-500/10' : 'text-muted-foreground'}`}
              >
                <Radio className={`w-3.5 h-3.5 mr-1 ${realtimeActive ? 'animate-pulse' : ''}`} />
                {realtimeActive ? 'Enabled' : 'Enable'}
              </Button>
            )}
          </div>
        </div>

        {/* Sync Progress Banner */}
        {isSyncing && (
          <div className="mt-4 p-3.5 rounded-xl bg-primary/10 border border-primary/20 flex items-center gap-3">
            <RefreshCw className="w-4 h-4 animate-spin text-primary shrink-0" />
            <div className="flex-1">
              <div className="flex justify-between text-xs font-semibold text-primary mb-1">
                <span>{syncStatus}</span>
                {syncProgress.total > 0 && (
                  <span>{syncProgress.current} / {syncProgress.total}</span>
                )}
              </div>
              <div className="w-full bg-primary/20 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-primary h-full transition-all duration-300 rounded-full"
                  style={{ width: `${syncProgress.total > 0 ? (syncProgress.current / syncProgress.total) * 100 : 50}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Last Sync Result */}
        {lastSyncResult && !isSyncing && (
          <div className="mt-4 p-3 rounded-xl bg-muted/40 border border-border/60 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-muted-foreground">Last Sync Result:</span>
              <span className="font-semibold text-foreground">
                ↑ {lastSyncResult.pushed} pushed &nbsp;|&nbsp; ↓ {lastSyncResult.pulled} pulled &nbsp;|&nbsp; {lastSyncResult.durationMs}ms
              </span>
            </div>
            {lastSyncResult.errors.length > 0 && (
              <span className="text-amber-500 text-[11px] font-medium">
                {lastSyncResult.errors.length} notices
              </span>
            )}
          </div>
        )}
      </div>

      {/* Sync Operations & Table Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Table Matrix Comparison */}
        <div className="lg:col-span-2 bg-card border border-border/80 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              <h4 className="text-sm font-bold text-foreground">Database Table Status & Comparison</h4>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleSync('push')}
                disabled={isSyncing || !isConfigured}
                className="text-xs h-8"
              >
                <ArrowUpRight className="w-3.5 h-3.5 mr-1 text-primary" />
                Push Local to Cloud
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleSync('pull')}
                disabled={isSyncing || !isConfigured}
                className="text-xs h-8"
              >
                <ArrowDownLeft className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                Pull Cloud to Local
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto border border-border/60 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/60 text-muted-foreground font-semibold border-b border-border/60">
                <tr>
                  <th className="py-2.5 px-3">Table Name</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3 text-right">
                    <span className="inline-flex items-center gap-1">
                      <HardDrive className="w-3 h-3 text-muted-foreground" /> Local (IndexedDB)
                    </span>
                  </th>
                  <th className="py-2.5 px-3 text-right">
                    <span className="inline-flex items-center gap-1">
                      <Cloud className="w-3 h-3 text-primary" /> Supabase (Cloud)
                    </span>
                  </th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {tableList.map((tbl) => {
                  const local = localCounts[tbl.key] || 0;
                  const cloud = cloudCounts[tbl.key] ?? (testResult?.tables?.[tbl.key]?.rowCount ?? '-');
                  const inSync = isConfigured && cloud !== '-' && local === cloud;

                  return (
                    <tr key={tbl.key} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-medium text-foreground">{tbl.key}</td>
                      <td className="py-2.5 px-3 text-muted-foreground">{tbl.desc}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-foreground">
                        {local.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-primary">
                        {typeof cloud === 'number' ? cloud.toLocaleString() : cloud}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {isConfigured ? (
                          inSync ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              Synced
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              Diff
                            </span>
                          )
                        ) : (
                          <span className="text-[10px] text-muted-foreground">Local Only</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right 1 Col: Quick Setup & Realtime Activity */}
        <div className="space-y-6">
          {/* Setup Guide */}
          <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <h4 className="text-sm font-bold text-foreground">Setup Instructions</h4>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={copySqlToClipboard}
                className="text-[11px] h-7 px-2.5"
              >
                {copiedSql ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                {copiedSql ? 'Copied SQL' : 'Copy Schema SQL'}
              </Button>
            </div>

            <div className="text-xs text-muted-foreground space-y-2.5">
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-[11px]">1</span>
                <span>Create a free project on <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-primary hover:underline font-semibold inline-flex items-center gap-0.5">supabase.com <ExternalLink className="w-2.5 h-2.5" /></a></span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-[11px]">2</span>
                <span>Copy the SQL script using the button above and run it in the <strong>Supabase SQL Editor</strong>.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-[11px]">3</span>
                <span>Set <code className="px-1 py-0.5 rounded bg-muted font-mono text-[10px]">VITE_SUPABASE_URL</code> and <code className="px-1 py-0.5 rounded bg-muted font-mono text-[10px]">VITE_SUPABASE_ANON_KEY</code> in project environment variables.</span>
              </div>
            </div>
          </div>

          {/* Realtime Event Stream */}
          <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className={`w-4 h-4 ${realtimeActive ? 'text-emerald-500 animate-pulse' : 'text-muted-foreground'}`} />
                <h4 className="text-sm font-bold text-foreground">Live Cloud Stream</h4>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">
                {realtimeActive ? 'Listening' : 'Idle'}
              </span>
            </div>

            {recentEvents.length === 0 ? (
              <div className="p-4 rounded-xl bg-muted/30 text-center text-xs text-muted-foreground">
                {realtimeActive ? 'Waiting for remote database changes...' : 'Enable Realtime Stream to view live sync events.'}
              </div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {recentEvents.map((evt) => (
                  <div key={evt.id} className="p-2 rounded-lg bg-muted/40 border border-border/60 text-[11px] flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary/10 text-primary uppercase">{evt.type}</span>
                      <span className="font-mono text-foreground">{evt.table}</span>
                    </div>
                    <span className="text-muted-foreground text-[10px]">{evt.time}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
