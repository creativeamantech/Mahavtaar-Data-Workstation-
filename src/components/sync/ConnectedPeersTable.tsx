import React, { useState } from 'react';
import { PeerInfo } from '../../lib/sync/types';
import { 
  Check, X, Power, Trash2, RefreshCw, Shield, 
  Wifi, Globe, Info, Clock, Monitor, Smartphone, Laptop 
} from 'lucide-react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';

interface ConnectedPeersTableProps {
  peers: PeerInfo[];
  onApprove: (peerId: string) => void;
  onReject: (peerId: string) => void;
  onDisable: (peerId: string) => void;
  onReEnable: (peerId: string) => void;
  onRemove: (peerId: string) => void;
  onSyncWithPeer: () => void;
}

export function ConnectedPeersTable({
  peers,
  onApprove,
  onReject,
  onDisable,
  onReEnable,
  onRemove,
  onSyncWithPeer,
}: ConnectedPeersTableProps) {
  const [selectedPeer, setSelectedPeer] = useState<PeerInfo | null>(null);

  const pendingPeers = peers.filter(p => !p.isSelf && p.status === 'PENDING_APPROVAL');
  const activePeers = peers.filter(p => p.status !== 'PENDING_APPROVAL');

  const getDeviceIcon = (os?: string) => {
    if (!os) return <Monitor className="w-4 h-4" />;
    if (os.toLowerCase().includes('android') || os.toLowerCase().includes('ios')) {
      return <Smartphone className="w-4 h-4" />;
    }
    if (os.toLowerCase().includes('mac') || os.toLowerCase().includes('laptop')) {
      return <Laptop className="w-4 h-4" />;
    }
    return <Monitor className="w-4 h-4" />;
  };

  const renderConnectionBadge = (type: string) => {
    if (type === 'LOCAL_LAN') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <Wifi className="w-3 h-3" /> Local Wi-Fi / LAN
        </span>
      );
    }
    if (type === 'INTERNET_P2P') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
          <Globe className="w-3 h-3" /> Internet P2P
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
        <Shield className="w-3 h-3" /> Secure Relay
      </span>
    );
  };

  const renderStatusBadge = (status: string, isSelf?: boolean) => {
    if (isSelf) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
          ● Host Node
        </span>
      );
    }
    if (status === 'APPROVED') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          ● Approved & Active
        </span>
      );
    }
    if (status === 'DISABLED') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground border border-border">
          ○ Disabled
        </span>
      );
    }
    if (status === 'REJECTED' || status === 'BLOCKED') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-destructive/10 text-destructive border border-destructive/20">
          ✕ Blocked
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse">
        ⏳ Approval Required
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Pending Approval Section */}
      {pendingPeers.length > 0 && (
        <div className="rounded-2xl border-2 border-amber-500/40 bg-amber-500/5 p-5 shadow-md animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
              </span>
              <h4 className="text-sm font-bold text-amber-700 dark:text-amber-400">
                New System Detected — Waiting for Admin Authorization ({pendingPeers.length})
              </h4>
            </div>
            <span className="text-xs text-muted-foreground">Only authorized peers can sync CRM customer data</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingPeers.map(p => (
              <div key={p.peerId} className="bg-card rounded-xl border border-amber-500/30 p-4 flex flex-col justify-between gap-3 shadow-sm">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-foreground flex items-center gap-1.5">
                      {getDeviceIcon(p.os)} {p.deviceName}
                    </span>
                    {renderConnectionBadge(p.connectionType)}
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground font-mono">
                    <p className="truncate">Peer ID: {p.peerId}</p>
                    <p>OS: {p.os || 'Desktop Host'}</p>
                    {p.userName && <p className="text-primary font-sans font-semibold">User: {p.userName} ({p.userRole || 'User'})</p>}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-border">
                  <Button
                    size="sm"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                    onClick={() => onApprove(p.peerId)}
                  >
                    <Check className="w-3.5 h-3.5 mr-1" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 border-destructive/30 text-destructive hover:bg-destructive/10 font-bold text-xs"
                    onClick={() => onReject(p.peerId)}
                  >
                    <X className="w-3.5 h-3.5 mr-1" /> Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Authorized Systems Table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-base font-bold text-foreground">Registered Mesh Systems</h3>
            <p className="text-xs text-muted-foreground">Authorized multi-system installations syncing with this instance</p>
          </div>
          <Button size="sm" variant="outline" onClick={onSyncWithPeer} className="text-xs font-semibold">
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Force Mesh Sync
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 text-muted-foreground uppercase font-bold tracking-wider text-[10px] border-b border-border">
              <tr>
                <th className="py-3 px-4">System / Device</th>
                <th className="py-3 px-4">Connection</th>
                <th className="py-3 px-4">Logged-In User</th>
                <th className="py-3 px-4">Latency</th>
                <th className="py-3 px-4">Last Sync</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {activePeers.map(p => (
                <tr key={p.peerId} className={`hover:bg-muted/30 transition-colors ${p.isSelf ? 'bg-primary/5' : ''}`}>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-muted text-foreground">
                        {getDeviceIcon(p.os)}
                      </div>
                      <div>
                        <div className="font-bold text-foreground text-sm flex items-center gap-1.5">
                          {p.deviceName}
                          {p.isSelf && <span className="text-[10px] font-bold text-primary px-1.5 py-0.2 rounded bg-primary/10">(You)</span>}
                        </div>
                        <div className="text-[11px] text-muted-foreground font-mono truncate max-w-[140px]">
                          {p.peerId}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="py-3 px-4">
                    {renderConnectionBadge(p.connectionType)}
                  </td>

                  <td className="py-3 px-4">
                    {p.userName ? (
                      <div>
                        <div className="font-semibold text-foreground">{p.userName}</div>
                        <div className="text-[10px] text-muted-foreground">{p.userRole || 'User'}</div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground italic">No active session</span>
                    )}
                  </td>

                  <td className="py-3 px-4 font-mono font-semibold text-muted-foreground">
                    {p.isSelf ? '0 ms' : `${p.latencyMs || 12} ms`}
                  </td>

                  <td className="py-3 px-4 text-muted-foreground">
                    {p.lastSync ? (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <span>{new Date(p.lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground italic">Initial</span>
                    )}
                  </td>

                  <td className="py-3 px-4">
                    {renderStatusBadge(p.status, p.isSelf)}
                  </td>

                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        title="View Peer Details & Keys"
                        onClick={() => setSelectedPeer(p)}
                      >
                        <Info className="w-4 h-4" />
                      </Button>

                      {!p.isSelf && (
                        <>
                          {p.status === 'APPROVED' ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
                              title="Disable Synchronization"
                              onClick={() => onDisable(p.peerId)}
                            >
                              <Power className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                              title="Re-enable Synchronization"
                              onClick={() => onReEnable(p.peerId)}
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                          )}

                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            title="Revoke & Remove Peer"
                            onClick={() => {
                              if (confirm(`Remove and revoke peer "${p.deviceName}"?`)) {
                                onRemove(p.peerId);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Peer Details Dialog */}
      <Dialog open={!!selectedPeer} onOpenChange={() => setSelectedPeer(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Peer Security & Node Identity
            </DialogTitle>
            <DialogDescription>
              Detailed cryptographic credentials and metadata for this node
            </DialogDescription>
          </DialogHeader>

          {selectedPeer && (
            <div className="space-y-4 text-xs">
              <div className="p-3 bg-muted/40 rounded-xl space-y-2 border border-border">
                <div className="flex justify-between">
                  <span className="font-semibold text-muted-foreground">Device Name:</span>
                  <span className="font-bold text-foreground">{selectedPeer.deviceName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-muted-foreground">Peer ID:</span>
                  <span className="font-mono text-foreground">{selectedPeer.peerId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-muted-foreground">Device ID:</span>
                  <span className="font-mono text-foreground">{selectedPeer.deviceId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-muted-foreground">Operating System:</span>
                  <span className="text-foreground">{selectedPeer.os || 'Desktop'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-muted-foreground">Connection Type:</span>
                  <span>{renderConnectionBadge(selectedPeer.connectionType)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-muted-foreground">Public Key Fingerprint:</span>
                  <span className="font-mono text-xs text-primary">{selectedPeer.publicKey || 'SHA256:ECDSA-FP-9901A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-muted-foreground">Approval Status:</span>
                  <span>{renderStatusBadge(selectedPeer.status, selectedPeer.isSelf)}</span>
                </div>
              </div>

              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setSelectedPeer(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
