import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSync } from '../contexts/SyncContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  Network, Wifi, Globe, Shield, RefreshCw, 
  Plus, Users, Database, AlertTriangle, Sliders, 
  Activity, CheckCircle2, Lock, Cpu, Server, Cloud 
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { MeshTopologyGraph } from '../components/sync/MeshTopologyGraph';
import { ConnectedPeersTable } from '../components/sync/ConnectedPeersTable';
import { WhoIsLoggedInTable } from '../components/sync/WhoIsLoggedInTable';
import { ConflictResolverModal } from '../components/sync/ConflictResolverModal';
import { BackupRecoverySection } from '../components/sync/BackupRecoverySection';
import { SyncSettingsTab } from '../components/sync/SyncSettingsTab';
import { PairDeviceModal } from '../components/sync/PairDeviceModal';
import { SupabaseDatabaseSection } from '../components/sync/SupabaseDatabaseSection';
import { AppLayout } from '../components/layout/AppLayout';

export default function ConnectivityHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'topology';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [pairModalOpen, setPairModalOpen] = useState(false);

  const {
    identity,
    peers,
    sessions,
    stats,
    conflicts,
    backups,
    isSyncing,
    scheduleBackupMinutes,
    triggerManualSync,
    approvePeer,
    rejectPeer,
    disablePeer,
    reEnablePeer,
    removePeer,
    resolveConflict,
    createBackup,
    restoreBackup,
    verifyBackup,
    downloadBackup,
    deleteBackup,
    setNetworkMode,
    setScheduleBackupMinutes,
    updateDeviceName,
    generatePairingOffer,
    acceptPairingOffer,
    acceptPairingAnswer,
    requestPairingFromPayload,
  } = useSync();

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-card rounded-2xl border border-border/80 p-6 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-xs">
            <Network className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-black text-foreground tracking-tight">
                Connectivity & Multi-System Hub
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                P2P Mesh v4.0
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Decentralized Local LAN & Encrypted WebRTC Peer-to-Peer Synchronization Engine
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => triggerManualSync()}
            disabled={isSyncing}
            className="text-xs font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isSyncing ? 'animate-spin text-primary' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync Mesh Now'}
          </Button>

          <Button
            size="sm"
            onClick={() => setPairModalOpen(true)}
            className="bg-primary text-primary-foreground font-bold text-xs shadow-sm hover:shadow transition-all"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Pair System / Terminal
          </Button>
        </div>
      </div>

      {/* Metrics Bento Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-card rounded-2xl border border-border p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Mesh Nodes</span>
            <Server className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-black text-foreground tracking-tight">
            {stats.onlinePeers} <span className="text-xs font-semibold text-muted-foreground">/ {stats.totalPeers} Systems</span>
          </div>
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {stats.approvedPeers} Authorized Peers
          </p>
        </div>

        {/* Metric 2 */}
        <div className="bg-card rounded-2xl border border-border p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Active Sessions</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-foreground tracking-tight">
            {sessions.length} <span className="text-xs font-semibold text-muted-foreground">Terminals</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 truncate">
            Host: {identity.deviceName}
          </p>
        </div>

        {/* Metric 3 */}
        <div className="bg-card rounded-2xl border border-border p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Data Conflicts</span>
            <AlertTriangle className={`w-4 h-4 ${conflicts.length > 0 ? 'text-amber-500' : 'text-emerald-500'}`} />
          </div>
          <div className="text-2xl font-black text-foreground tracking-tight">
            {conflicts.length}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            {conflicts.length === 0 ? 'Zero conflicts • Clean' : 'Arbitration required'}
          </p>
        </div>

        {/* Metric 4 */}
        <div className="bg-card rounded-2xl border border-border p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Disaster Recovery</span>
            <Database className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-black text-foreground tracking-tight">
            {backups.length} <span className="text-xs font-semibold text-muted-foreground">Snapshots</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            {scheduleBackupMinutes > 0 ? `Auto: Every ${scheduleBackupMinutes}m` : 'Manual snapshots'}
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-border gap-1 md:gap-2 overflow-x-auto pb-0">
        <button
          onClick={() => handleTabChange('topology')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-all ${
            activeTab === 'topology'
              ? 'border-primary text-primary bg-primary/5 rounded-t-xl'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Network className="w-4 h-4" /> Mesh Topology
        </button>

        <button
          onClick={() => handleTabChange('systems')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-all ${
            activeTab === 'systems'
              ? 'border-primary text-primary bg-primary/5 rounded-t-xl'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Server className="w-4 h-4" /> Registered Systems ({peers.length})
          {stats.pendingApproval > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-amber-500 text-white font-black animate-pulse">
              {stats.pendingApproval}
            </span>
          )}
        </button>

        <button
          onClick={() => handleTabChange('sessions')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-all ${
            activeTab === 'sessions'
              ? 'border-primary text-primary bg-primary/5 rounded-t-xl'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Users className="w-4 h-4" /> Who Is Logged In Where ({sessions.length})
        </button>

        <button
          onClick={() => handleTabChange('conflicts')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-all ${
            activeTab === 'conflicts'
              ? 'border-primary text-primary bg-primary/5 rounded-t-xl'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <AlertTriangle className="w-4 h-4" /> Conflicts
          {conflicts.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-destructive text-white font-black">
              {conflicts.length}
            </span>
          )}
        </button>

        <button
          onClick={() => handleTabChange('supabase')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-all ${
            activeTab === 'supabase'
              ? 'border-primary text-primary bg-primary/5 rounded-t-xl'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Cloud className="w-4 h-4" /> Cloud Database (Supabase)
        </button>

        <button
          onClick={() => handleTabChange('backups')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-all ${
            activeTab === 'backups'
              ? 'border-primary text-primary bg-primary/5 rounded-t-xl'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Database className="w-4 h-4" /> Backups & Disaster Recovery
        </button>

        <button
          onClick={() => handleTabChange('settings')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-all ${
            activeTab === 'settings'
              ? 'border-primary text-primary bg-primary/5 rounded-t-xl'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Sliders className="w-4 h-4" /> Mesh Protocols & Settings
        </button>
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === 'topology' && (
          <div className="space-y-6">
            <MeshTopologyGraph
              identity={identity}
              peers={peers}
              isSyncing={isSyncing}
              onRefresh={triggerManualSync}
            />

            {/* Quick table summary below graph */}
            <ConnectedPeersTable
              peers={peers}
              onApprove={approvePeer}
              onReject={rejectPeer}
              onDisable={disablePeer}
              onReEnable={reEnablePeer}
              onRemove={removePeer}
              onSyncWithPeer={triggerManualSync}
            />
          </div>
        )}

        {activeTab === 'systems' && (
          <ConnectedPeersTable
            peers={peers}
            onApprove={approvePeer}
            onReject={rejectPeer}
            onDisable={disablePeer}
            onReEnable={reEnablePeer}
            onRemove={removePeer}
            onSyncWithPeer={triggerManualSync}
          />
        )}

        {activeTab === 'sessions' && (
          <WhoIsLoggedInTable sessions={sessions} />
        )}

        {activeTab === 'conflicts' && (
          <ConflictResolverModal
            conflicts={conflicts}
            onResolve={resolveConflict}
          />
        )}

        {activeTab === 'supabase' && (
          <SupabaseDatabaseSection />
        )}

        {activeTab === 'backups' && (
          <BackupRecoverySection
            backups={backups}
            scheduleMinutes={scheduleBackupMinutes}
            onSetSchedule={setScheduleBackupMinutes}
            onCreateBackup={createBackup}
            onRestoreBackup={restoreBackup}
            onVerifyBackup={verifyBackup}
            onDownloadBackup={downloadBackup}
            onDeleteBackup={deleteBackup}
          />
        )}

        {activeTab === 'settings' && (
          <SyncSettingsTab
            identity={identity}
            networkMode={stats.networkMode}
            onSetNetworkMode={setNetworkMode}
            onUpdateDeviceName={updateDeviceName}
          />
        )}
      </div>

      {/* Pairing Modal */}
      <PairDeviceModal
        open={pairModalOpen}
        onOpenChange={setPairModalOpen}
        identity={identity}
        onGenerateOffer={generatePairingOffer}
        onAcceptOffer={acceptPairingOffer}
        onAcceptAnswer={acceptPairingAnswer}
        onRequestPairingFromPayload={requestPairingFromPayload}
      />
      </div>
    </AppLayout>
  );
}
