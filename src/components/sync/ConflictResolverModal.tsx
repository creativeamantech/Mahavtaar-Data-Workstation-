import React, { useState } from 'react';
import { ConflictRecord } from '../../lib/sync/types';
import { 
  AlertTriangle, Check, ArrowRight, ShieldAlert, 
  Layers, GitMerge, FileText, CheckCircle2 
} from 'lucide-react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';

interface ConflictResolverModalProps {
  conflicts: ConflictRecord[];
  onResolve: (
    conflictId: string,
    resolution: 'KEEP_LOCAL' | 'KEEP_REMOTE' | 'FIELD_MERGE' | 'MANUAL',
    customData?: any
  ) => void;
}

export function ConflictResolverModal({ conflicts, onResolve }: ConflictResolverModalProps) {
  const [selectedConflict, setSelectedConflict] = useState<ConflictRecord | null>(null);
  const [fieldSelections, setFieldSelections] = useState<Record<string, 'local' | 'remote'>>({});

  const handleOpenConflict = (c: ConflictRecord) => {
    setSelectedConflict(c);
    const initial: Record<string, 'local' | 'remote'> = {};
    c.fieldConflicts.forEach(f => {
      initial[f.field] = 'local';
    });
    setFieldSelections(initial);
  };

  const handleCustomMerge = () => {
    if (!selectedConflict) return;
    const merged = { ...selectedConflict.localData };
    selectedConflict.fieldConflicts.forEach(f => {
      if (fieldSelections[f.field] === 'remote') {
        merged[f.field] = selectedConflict.remoteData[f.field];
      }
    });
    onResolve(selectedConflict.id, 'MANUAL', merged);
    setSelectedConflict(null);
  };

  return (
    <div className="space-y-4">
      {conflicts.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-8 text-center flex flex-col items-center justify-center">
          <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-3 border border-emerald-500/20">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-foreground mb-1">All Systems in Synchronization Harmony</h3>
          <p className="text-xs text-muted-foreground max-w-md">
            No concurrent data conflicts detected across connected peer terminals. All CRDT journals and deltas are cleanly resolved.
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-amber-500/30 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-border bg-amber-500/5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Detected Data Conflicts ({conflicts.length})
                </h3>
                <p className="text-xs text-muted-foreground">
                  Concurrent modifications require Administrator arbitration
                </p>
              </div>
            </div>
          </div>

          <div className="divide-y divide-border">
            {conflicts.map(c => (
              <div key={c.id} className="p-4 flex items-center justify-between flex-wrap gap-3 hover:bg-muted/20 transition-colors">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 uppercase font-mono">
                      {c.tableName}
                    </span>
                    <span className="text-sm font-bold text-foreground">
                      Record: {c.recordId}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground flex items-center gap-3">
                    <span>Conflicting Fields: <strong>{c.fieldConflicts.map(f => f.field).join(', ')}</strong></span>
                    <span>•</span>
                    <span>Detected: {new Date(c.detectedAt).toLocaleTimeString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 text-xs font-semibold"
                    onClick={() => onResolve(c.id, 'KEEP_LOCAL')}
                  >
                    Keep Local (This PC)
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-blue-500/30 text-blue-600 hover:bg-blue-500/10 text-xs font-semibold"
                    onClick={() => onResolve(c.id, 'KEEP_REMOTE')}
                  >
                    Keep Remote (Peer)
                  </Button>
                  <Button
                    size="sm"
                    className="bg-primary text-primary-foreground text-xs font-bold"
                    onClick={() => handleOpenConflict(c)}
                  >
                    <GitMerge className="w-3.5 h-3.5 mr-1.5" /> Diff & Merge
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Side-by-Side Diff Resolution Modal */}
      <Dialog open={!!selectedConflict} onOpenChange={() => setSelectedConflict(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <GitMerge className="w-5 h-5 text-primary" />
              Conflict Diff & Field Merge Studio
            </DialogTitle>
            <DialogDescription>
              Compare divergent values from both systems and select which field value to keep for the master record.
            </DialogDescription>
          </DialogHeader>

          {selectedConflict && (
            <div className="space-y-5 text-xs">
              <div className="grid grid-cols-2 gap-4">
                {/* System A (Local) */}
                <div className="p-3.5 rounded-xl bg-card border-2 border-primary/30 space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-border">
                    <span className="font-bold text-foreground">System A (Local Instance)</span>
                    <span className="text-[10px] text-muted-foreground">{new Date(selectedConflict.localTimestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Original terminal state on this host</p>
                </div>

                {/* System B (Remote) */}
                <div className="p-3.5 rounded-xl bg-card border-2 border-blue-500/30 space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-border">
                    <span className="font-bold text-foreground">System B (Remote Peer: {selectedConflict.remotePeerId})</span>
                    <span className="text-[10px] text-muted-foreground">{new Date(selectedConflict.remoteTimestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Incoming change from mesh peer</p>
                </div>
              </div>

              {/* Field comparison table */}
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 uppercase font-bold text-[10px] text-muted-foreground border-b border-border">
                    <tr>
                      <th className="p-3">Field</th>
                      <th className="p-3">System A (Local)</th>
                      <th className="p-3">System B (Remote)</th>
                      <th className="p-3 text-right">Selected Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {selectedConflict.fieldConflicts.map(fc => (
                      <tr key={fc.field} className="hover:bg-muted/20">
                        <td className="p-3 font-mono font-bold text-foreground">{fc.field}</td>
                        <td className="p-3 text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/5">
                          {String(fc.localVal ?? '-')}
                        </td>
                        <td className="p-3 text-blue-600 dark:text-blue-400 font-semibold bg-blue-500/5">
                          {String(fc.remoteVal ?? '-')}
                        </td>
                        <td className="p-3 text-right">
                          <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/40">
                            <button
                              onClick={() => setFieldSelections(prev => ({ ...prev, [fc.field]: 'local' }))}
                              className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-colors ${
                                fieldSelections[fc.field] === 'local'
                                  ? 'bg-card text-primary shadow-xs'
                                  : 'text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              Keep A
                            </button>
                            <button
                              onClick={() => setFieldSelections(prev => ({ ...prev, [fc.field]: 'remote' }))}
                              className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-colors ${
                                fieldSelections[fc.field] === 'remote'
                                  ? 'bg-card text-blue-600 shadow-xs'
                                  : 'text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              Keep B
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border">
                <Button variant="outline" size="sm" onClick={() => setSelectedConflict(null)}>
                  Cancel
                </Button>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 text-xs font-bold"
                    onClick={() => {
                      onResolve(selectedConflict.id, 'KEEP_LOCAL');
                      setSelectedConflict(null);
                    }}
                  >
                    Keep All Local (A)
                  </Button>
                  <Button
                    size="sm"
                    className="bg-primary text-primary-foreground text-xs font-bold"
                    onClick={handleCustomMerge}
                  >
                    <Check className="w-3.5 h-3.5 mr-1.5" /> Apply Merged Record
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
