import React, { useState, useRef } from 'react';
import { BackupSnapshotRecord } from '../../lib/db';
import { 
  Database, Download, Upload, ShieldCheck, 
  Trash2, RefreshCw, Clock, HardDrive, CheckCircle2, AlertCircle, FileJson 
} from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';

interface BackupRecoverySectionProps {
  backups: BackupSnapshotRecord[];
  scheduleMinutes: number;
  onSetSchedule: (minutes: number) => void;
  onCreateBackup: (label?: string) => Promise<void>;
  onRestoreBackup: (payload: string, mode: 'MERGE' | 'REPLACE') => Promise<void>;
  onVerifyBackup: (backupId: string) => Promise<{ valid: boolean; details: string }>;
  onDownloadBackup: (backupId: string) => Promise<void>;
  onDeleteBackup: (backupId: string) => Promise<void>;
}

export function BackupRecoverySection({
  backups,
  scheduleMinutes,
  onSetSchedule,
  onCreateBackup,
  onRestoreBackup,
  onVerifyBackup,
  onDownloadBackup,
  onDeleteBackup,
}: BackupRecoverySectionProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [backupLabel, setBackupLabel] = useState('');
  const [restoreMode, setRestoreMode] = useState<'MERGE' | 'REPLACE'>('MERGE');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCreate = async () => {
    try {
      setIsCreating(true);
      await onCreateBackup(backupLabel.trim() || undefined);
      setBackupLabel('');
    } finally {
      setIsCreating(false);
    }
  };

  const handleVerify = async (id: string) => {
    const res = await onVerifyBackup(id);
    if (res.valid) {
      toast.success(res.details);
    } else {
      toast.error(res.details);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (!content) return;
      if (confirm(`Restore data from file "${file.name}" in ${restoreMode} mode?`)) {
        await onRestoreBackup(content, restoreMode);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Top Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Create Manual Backup */}
        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground">Create Snapshot Now</h4>
              <p className="text-[11px] text-muted-foreground">Snapshot all CRM tables locally</p>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Optional label (e.g. Pre-Import)"
              value={backupLabel}
              onChange={(e) => setBackupLabel(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-muted/40 text-xs"
            />
            <Button size="sm" onClick={handleCreate} disabled={isCreating} className="font-bold text-xs">
              {isCreating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Backup Now'}
            </Button>
          </div>
        </div>

        {/* Scheduled Backups */}
        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground">Automated Schedule</h4>
              <p className="text-[11px] text-muted-foreground">Recurring local snapshots</p>
            </div>
          </div>
          <select
            value={scheduleMinutes}
            onChange={(e) => onSetSchedule(parseInt(e.target.value, 10))}
            className="w-full px-3 py-2 rounded-lg border border-border bg-muted/40 text-xs font-semibold"
          >
            <option value="0">Disabled (Manual Only)</option>
            <option value="15">Every 15 Minutes (High Frequency)</option>
            <option value="60">Every 1 Hour (Recommended)</option>
            <option value="360">Every 6 Hours</option>
            <option value="1440">Daily (Every 24 Hours)</option>
          </select>
        </div>

        {/* Disaster Recovery Import */}
        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground">External Drive Restore</h4>
              <p className="text-[11px] text-muted-foreground">Recover database from external file</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={restoreMode}
              onChange={(e) => setRestoreMode(e.target.value as any)}
              className="px-2.5 py-1.5 rounded-lg border border-border bg-muted/40 text-[11px] font-semibold"
            >
              <option value="MERGE">Merge Mode</option>
              <option value="REPLACE">Clean Replace</option>
            </select>
            <input
              type="file"
              ref={fileInputRef}
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-xs font-semibold"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-3.5 h-3.5 mr-1" /> Choose File
            </Button>
          </div>
        </div>
      </div>

      {/* Backup History Table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-foreground">Backup & Disaster Recovery History</h3>
            <p className="text-xs text-muted-foreground">Indexed local snapshots with SHA-256 cryptographic checksums</p>
          </div>
          <span className="text-xs font-semibold text-muted-foreground">
            {backups.length} Snapshots Available
          </span>
        </div>

        {backups.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No backup snapshots generated yet. Click "Backup Now" above to create your first baseline snapshot.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground uppercase font-bold tracking-wider text-[10px] border-b border-border">
                <tr>
                  <th className="py-3 px-4">Backup Label / ID</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Records / Size</th>
                  <th className="py-3 px-4">Checksum</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {backups.map(b => (
                  <tr key={b.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-foreground">{b.label || b.id}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{b.id}</div>
                    </td>

                    <td className="py-3 px-4 text-muted-foreground">
                      {new Date(b.timestamp).toLocaleString()}
                    </td>

                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        b.type === 'SCHEDULED' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-primary/10 text-primary'
                      }`}>
                        {b.type}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-foreground">
                      <div className="font-semibold">{b.recordCounts?.records || 0} loans • {b.recordCounts?.feedbacks || 0} feedback</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{(b.sizeBytes / 1024).toFixed(1)} KB</div>
                    </td>

                    <td className="py-3 px-4 font-mono text-[10px] text-primary">
                      {b.checksum}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-muted-foreground hover:text-foreground"
                          title="Verify Integrity"
                          onClick={() => handleVerify(b.id)}
                        >
                          <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-500" /> Verify
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-muted-foreground hover:text-foreground"
                          title="Download to External Drive"
                          onClick={() => onDownloadBackup(b.id)}
                        >
                          <Download className="w-3.5 h-3.5 mr-1 text-blue-500" /> Export
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          title="Delete Snapshot"
                          onClick={() => {
                            if (confirm('Delete this backup snapshot?')) {
                              onDeleteBackup(b.id);
                            }
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
