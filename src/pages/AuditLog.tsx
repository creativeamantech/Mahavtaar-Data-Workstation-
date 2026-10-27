import { useState, useMemo } from 'react';
import { AppLayout } from '../components/layout/AppLayout';
import { useData } from '../contexts/DataContext';
import { fmtDate } from '../lib/formatters';
import { Search, UserCircle, Edit3, ArrowRight, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';
import { verifyAuditChainIntegrity } from '../lib/repositories/auditRepository';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';

export default function AuditLog() {
  const { auditLog } = useData();
  const [search, setSearch] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    valid: boolean;
    totalEntries: number;
    message: string;
  } | null>(null);

  const filtered = useMemo(() => {
    if (!search) return auditLog;
    const s = search.toLowerCase();
    return auditLog.filter(a => a.agreementid.toLowerCase().includes(s) || a.changedBy.toLowerCase().includes(s));
  }, [auditLog, search]);

  const handleVerifyChain = async () => {
    setIsVerifying(true);
    try {
      const res = await verifyAuditChainIntegrity();
      setVerificationResult(res);
      if (res.valid) {
        toast.success(`Audit chain verified: ${res.totalEntries} records intact.`);
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <AppLayout>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-xl font-extrabold uppercase tracking-wide">Audit Log</h1>
            {verificationResult && (
              <Badge variant={verificationResult.valid ? "default" : "destructive"} className={verificationResult.valid ? "bg-emerald-600 hover:bg-emerald-600 gap-1 text-xs" : "gap-1 text-xs"}>
                {verificationResult.valid ? <ShieldCheck className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                {verificationResult.valid ? 'Cryptographically Sealed' : 'Tampering Detected'}
              </Badge>
            )}
          </div>
          <p className="font-data text-xs text-muted-foreground mt-1">Track all manual data changes, overrides, and cryptographic SHA-256 hash-chains</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleVerifyChain}
            disabled={isVerifying}
            className="gap-2 text-xs font-semibold"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isVerifying ? 'animate-spin' : ''}`} />
            Verify Chain
          </Button>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search agreement ID or user..."
              className="h-10 w-full glass-input pl-9 pr-3 font-data text-sm outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center text-center glass-panel rounded-xl">
          <Edit3 className="h-8 w-8 text-muted-foreground/30 mb-4" />
          <h3 className="font-heading text-lg font-bold">No Records</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">No audit entries found. Manual edits and data overrides will appear here in chronological order.</p>
        </div>
      ) : (
        <div className="relative ml-4 pl-4 border-l border-[rgba(255,255,255,0.08)] space-y-6 before:content-[''] before:absolute before:top-0 before:left-[-1px] before:w-[2px] before:h-8 before:bg-gradient-to-b before:from-primary before:to-transparent">
          {filtered.map(entry => (
            <div key={entry.id} className="relative group">
              {/* Timeline Dot */}
              <div className="absolute -left-[23px] top-1.5 h-3 w-3 rounded-full border-2 border-surface-0 bg-primary shadow-[0_0_8px_rgba(245,158,11,0.5)] group-hover:scale-125 transition-transform" />
              
              <div className="glass-card p-4 transition-all hover:translate-x-1 hover:shadow-glass-hover">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
                  <div className="flex items-center gap-2">
                    <UserCircle className="h-4 w-4 text-muted-foreground" />
                    <span className="font-heading text-sm font-bold text-foreground">{entry.changedBy}</span>
                    <span className="font-data text-[10px] text-muted-foreground">via {entry.source}</span>
                  </div>
                  <span className="font-data text-xs text-muted-foreground/70">{fmtDate(entry.createdAt)}</span>
                </div>
                
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 bg-surface-0/30 rounded-lg p-3 border border-[rgba(255,255,255,0.03)]">
                  <div>
                    <span className="block font-heading text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1">Agreement ID</span>
                    <span className="font-data text-sm font-medium">{entry.agreementid}</span>
                  </div>
                  
                  <div className="hidden sm:block w-[1px] h-8 bg-[rgba(255,255,255,0.06)]" />
                  
                  <div>
                    <span className="block font-heading text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1">Field</span>
                    <span className="font-data text-sm font-bold text-primary uppercase">{entry.field}</span>
                  </div>
                  
                  <div className="hidden sm:block w-[1px] h-8 bg-[rgba(255,255,255,0.06)]" />
                  
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex-1">
                      <span className="block font-heading text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1">Old Value</span>
                      <span className="font-data text-sm text-muted-foreground line-through">{entry.oldValue || 'Empty'}</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                    <div className="flex-1">
                      <span className="block font-heading text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1">New Value</span>
                      <span className="font-data text-sm font-bold text-success">{entry.newValue}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
