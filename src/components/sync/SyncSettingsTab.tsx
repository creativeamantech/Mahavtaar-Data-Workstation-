import React, { useState } from 'react';
import { DeviceIdentity, NetworkMode, ConflictStrategy } from '../../lib/sync/types';
import { 
  Wifi, Globe, Shield, Sliders, Cpu, 
  Lock, Save, RefreshCw, KeyRound, Check 
} from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';

interface SyncSettingsTabProps {
  identity: DeviceIdentity;
  networkMode: NetworkMode;
  onSetNetworkMode: (mode: NetworkMode) => void;
  onUpdateDeviceName: (name: string) => void;
}

export function SyncSettingsTab({
  identity,
  networkMode,
  onSetNetworkMode,
  onUpdateDeviceName,
}: SyncSettingsTabProps) {
  const [deviceName, setDeviceName] = useState(identity.deviceName);
  const [conflictRule, setConflictRule] = useState<ConflictStrategy>('FIELD_MERGE');
  const [syncFreqSec, setSyncFreqSec] = useState('10');

  const handleSaveIdentity = () => {
    if (!deviceName.trim()) return toast.error('Device name cannot be empty');
    onUpdateDeviceName(deviceName.trim());
  };

  return (
    <div className="max-w-4xl space-y-6 text-xs">
      {/* Device Identity Card */}
      <div className="bg-card rounded-2xl border border-border p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-border">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Local System Identity</h3>
            <p className="text-[11px] text-muted-foreground">Unique machine signature advertised to other CRM mesh nodes</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="font-bold text-foreground">Device Hostname / Friendly Name</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border border-border bg-muted/40 text-xs font-semibold"
              />
              <Button size="sm" onClick={handleSaveIdentity} className="font-bold text-xs">
                <Save className="w-3.5 h-3.5 mr-1" /> Rename
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-foreground">Peer ID (Unique Mesh Identifier)</label>
            <div className="px-3 py-2 rounded-lg border border-border bg-muted text-xs font-mono font-bold text-primary select-all">
              {identity.peerId}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-foreground">Operating System</label>
            <div className="px-3 py-2 rounded-lg border border-border bg-muted text-xs text-foreground font-medium">
              {identity.os} • {identity.browser}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-foreground">Cryptographic Public Key Fingerprint</label>
            <div className="px-3 py-2 rounded-lg border border-border bg-muted text-xs font-mono text-muted-foreground select-all">
              {identity.publicKeyFingerprint}
            </div>
          </div>
        </div>
      </div>

      {/* Network & Connectivity Modes */}
      <div className="bg-card rounded-2xl border border-border p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-border">
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Network & Transport Channels</h3>
            <p className="text-[11px] text-muted-foreground">Admin-controlled connectivity protocols for multi-system communication</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Option: All Channels */}
          <div
            onClick={() => onSetNetworkMode('ALL')}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
              networkMode === 'ALL'
                ? 'border-primary bg-primary/5 shadow-xs'
                : 'border-border hover:border-border/80'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-foreground text-sm">Full Hybrid Mesh</span>
              {networkMode === 'ALL' && <Check className="w-4 h-4 text-primary" />}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Local Wi-Fi/LAN + Internet P2P with secure encrypted relay fallback.
            </p>
          </div>

          {/* Option: Local LAN Only */}
          <div
            onClick={() => onSetNetworkMode('LOCAL_ONLY')}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
              networkMode === 'LOCAL_ONLY'
                ? 'border-primary bg-primary/5 shadow-xs'
                : 'border-border hover:border-border/80'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-foreground text-sm flex items-center gap-1">
                <Wifi className="w-3.5 h-3.5 text-emerald-500" /> Air-Gapped LAN
              </span>
              {networkMode === 'LOCAL_ONLY' && <Check className="w-4 h-4 text-primary" />}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Restrict all sync strictly to the local office network / Wi-Fi subnet.
            </p>
          </div>

          {/* Option: Disabled */}
          <div
            onClick={() => onSetNetworkMode('DISABLED')}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
              networkMode === 'DISABLED'
                ? 'border-destructive bg-destructive/5 shadow-xs'
                : 'border-border hover:border-border/80'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-destructive text-sm">Offline Only</span>
              {networkMode === 'DISABLED' && <Check className="w-4 h-4 text-destructive" />}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Disable all peer-to-peer transmissions. Operate purely as an isolated offline terminal.
            </p>
          </div>
        </div>
      </div>

      {/* Synchronization Engine & Conflict Rules */}
      <div className="bg-card rounded-2xl border border-border p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-border">
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">CRDT & Conflict Rules</h3>
            <p className="text-[11px] text-muted-foreground">Resolution strategy when divergent modifications occur concurrently</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="font-bold text-foreground">Default Resolution Strategy</label>
            <select
              value={conflictRule}
              onChange={(e) => setConflictRule(e.target.value as any)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-muted/40 text-xs font-semibold"
            >
              <option value="FIELD_MERGE">Smart 3-Way Field-Level Merge (Recommended)</option>
              <option value="LWW">Last-Write-Wins (LWW by Millisecond Timestamp)</option>
              <option value="SOURCE_PRIORITY">HQ / Admin Authority Priority</option>
              <option value="MANUAL">Always Flag for Manual Admin Arbitration</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-foreground">Background Sync Interval</label>
            <select
              value={syncFreqSec}
              onChange={(e) => setSyncFreqSec(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-muted/40 text-xs font-semibold"
            >
              <option value="5">Every 5 Seconds (Real-Time Mesh)</option>
              <option value="10">Every 10 Seconds (Standard)</option>
              <option value="30">Every 30 Seconds (Low Bandwidth)</option>
              <option value="60">Every 60 Seconds</option>
            </select>
          </div>
        </div>
      </div>

      {/* Security & Cryptography Policies */}
      <div className="p-4 rounded-2xl bg-muted/30 border border-border flex items-start gap-3">
        <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="font-bold text-foreground">Enterprise Zero-Trust Cryptography</h4>
          <p className="text-[11px] text-muted-foreground">
            No system becomes trusted simply by joining the Wi-Fi. Every peer requires explicit cryptographic verification and Administrator approval. Synchronization payloads are delta-encoded and end-to-end verified with SHA-256 hashes.
          </p>
        </div>
      </div>
    </div>
  );
}
