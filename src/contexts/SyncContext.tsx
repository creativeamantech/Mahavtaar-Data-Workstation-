import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
  ConflictRecord,
  DeviceIdentity,
  DeviceSession,
  NetworkMode,
  PeerInfo,
  SyncStats
} from '../lib/sync/types';
import { syncEngine } from '../lib/sync/syncEngine';
import { backupManager } from '../lib/sync/backupManager';
import { getLocalDeviceIdentity, updateLocalDeviceName } from '../lib/sync/deviceIdentity';
import { resolveConflictRecord } from '../lib/sync/crdtEngine';
import { BackupSnapshotRecord, db } from '../lib/db';
import { toast } from 'sonner';

interface SyncContextType {
  identity: DeviceIdentity;
  peers: PeerInfo[];
  sessions: DeviceSession[];
  stats: SyncStats;
  conflicts: ConflictRecord[];
  backups: BackupSnapshotRecord[];
  isSyncing: boolean;
  scheduleBackupMinutes: number;
  // Actions
  triggerManualSync: () => Promise<void>;
  approvePeer: (peerId: string) => Promise<void>;
  rejectPeer: (peerId: string) => Promise<void>;
  disablePeer: (peerId: string) => Promise<void>;
  reEnablePeer: (peerId: string) => Promise<void>;
  removePeer: (peerId: string) => Promise<void>;
  resolveConflict: (conflictId: string, resolution: 'KEEP_LOCAL' | 'KEEP_REMOTE' | 'FIELD_MERGE' | 'MANUAL', customData?: any) => Promise<void>;
  createBackup: (label?: string) => Promise<void>;
  restoreBackup: (payload: string, mode: 'MERGE' | 'REPLACE') => Promise<void>;
  verifyBackup: (backupId: string) => Promise<{ valid: boolean; details: string }>;
  downloadBackup: (backupId: string) => Promise<void>;
  deleteBackup: (backupId: string) => Promise<void>;
  setNetworkMode: (mode: NetworkMode) => void;
  setScheduleBackupMinutes: (mins: number) => void;
  updateDeviceName: (name: string) => void;
  // WebRTC P2P Direct Pairing
  generatePairingOffer: (targetPeerId: string) => Promise<string>;
  acceptPairingOffer: (offerBase64: string) => Promise<string>;
  acceptPairingAnswer: (answerBase64: string) => Promise<void>;
  requestPairingFromPayload: (payload: string) => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [identity, setIdentity] = useState<DeviceIdentity>(() => getLocalDeviceIdentity());
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [conflicts, setConflicts] = useState<ConflictRecord[]>([]);
  const [backups, setBackups] = useState<BackupSnapshotRecord[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [scheduleBackupMinutes, setScheduleBackupMinutesState] = useState<number>(() => backupManager.getScheduleInterval());

  const [stats, setStats] = useState<SyncStats>({
    totalPeers: 1,
    approvedPeers: 1,
    onlinePeers: 1,
    pendingApproval: 0,
    queuedChanges: 0,
    openConflicts: 0,
    syncInProgress: false,
    totalSyncedTransactions: 0,
    networkMode: 'ALL'
  });

  const refreshSyncData = useCallback(async () => {
    try {
      const allPeers = await syncEngine.getAllPeers();
      setPeers(allPeers);

      const liveSessions = syncEngine.getLiveSessions();
      setSessions(liveSessions);

      const currentStats = await syncEngine.getSyncStats();
      setStats(currentStats);

      const openConflicts = (await db.sync_conflicts.where('status').equals('OPEN').toArray()) as ConflictRecord[];
      setConflicts(openConflicts);

      const history = await backupManager.getBackupHistory();
      setBackups(history);
    } catch (e) {
      console.error('[SyncContext] refresh error', e);
    }
  }, []);

  useEffect(() => {
    syncEngine.init().then(() => {
      refreshSyncData();
    });

    const unsubscribe = syncEngine.subscribe(() => {
      refreshSyncData();
    });

    return () => {
      unsubscribe();
    };
  }, [refreshSyncData]);

  // Update current user session in sync engine when user logs in or out
  useEffect(() => {
    syncEngine.setCurrentUser(user ? { email: user.email, name: user.name, role: user.role } : null);
  }, [user]);

  const triggerManualSync = async () => {
    setIsSyncing(true);
    try {
      const count = await syncEngine.triggerGlobalSync();
      if (count > 0) {
        toast.success(`Sync dispatched across ${count} connected peer(s)`);
      } else {
        toast.info('No approved peers connected for mesh sync.');
      }
      await refreshSyncData();
    } catch (e: any) {
      toast.error('Sync failed: ' + (e.message || 'Unknown error'));
    } finally {
      setIsSyncing(false);
    }
  };

  const approvePeer = async (peerId: string) => {
    try {
      await syncEngine.approvePeer(peerId, user?.name || 'Admin');
      toast.success('Peer device approved for CRM synchronization');
      await refreshSyncData();
    } catch (e: any) {
      toast.error('Failed to approve peer: ' + e.message);
    }
  };

  const rejectPeer = async (peerId: string) => {
    try {
      await syncEngine.rejectPeer(peerId);
      toast.info('Peer device rejected');
      await refreshSyncData();
    } catch (e: any) {
      toast.error('Failed to reject peer: ' + e.message);
    }
  };

  const disablePeer = async (peerId: string) => {
    try {
      await syncEngine.disablePeer(peerId);
      toast.warning('Peer device synchronization disabled');
      await refreshSyncData();
    } catch (e: any) {
      toast.error('Failed to disable peer: ' + e.message);
    }
  };

  const reEnablePeer = async (peerId: string) => {
    try {
      await syncEngine.reEnablePeer(peerId);
      toast.success('Peer device re-enabled and synchronized');
      await refreshSyncData();
    } catch (e: any) {
      toast.error('Failed to re-enable peer: ' + e.message);
    }
  };

  const removePeer = async (peerId: string) => {
    try {
      await syncEngine.removePeer(peerId);
      toast.success('Peer removed from registry');
      await refreshSyncData();
    } catch (e: any) {
      toast.error('Failed to remove peer: ' + e.message);
    }
  };

  const resolveConflict = async (
    conflictId: string,
    resolution: 'KEEP_LOCAL' | 'KEEP_REMOTE' | 'FIELD_MERGE' | 'MANUAL',
    customData?: any
  ) => {
    try {
      await resolveConflictRecord(conflictId, resolution, customData, user?.name || 'Admin');
      toast.success(`Conflict resolved with strategy: ${resolution}`);
      await refreshSyncData();
    } catch (e: any) {
      toast.error('Failed to resolve conflict: ' + e.message);
    }
  };

  const createBackup = async (label?: string) => {
    try {
      const snap = await backupManager.createBackup('MANUAL', label);
      toast.success(`Backup created: ${snap.checksum} (${snap.recordCounts.records} records)`);
      await refreshSyncData();
    } catch (e: any) {
      toast.error('Failed to create backup: ' + e.message);
    }
  };

  const restoreBackup = async (payload: string, mode: 'MERGE' | 'REPLACE') => {
    try {
      const result = await backupManager.restoreBackupFromPayload(payload, mode);
      toast.success(`Backup restored successfully (${result.restoredRecords} records, ${result.restoredFeedbacks} feedbacks)`);
      await refreshSyncData();
    } catch (e: any) {
      toast.error('Restore failed: ' + e.message);
    }
  };

  const verifyBackup = async (backupId: string) => {
    return await backupManager.verifyBackupIntegrity(backupId);
  };

  const downloadBackup = async (backupId: string) => {
    try {
      await backupManager.downloadBackupAsFile(backupId);
      toast.success('Backup file downloaded to local drive');
    } catch (e: any) {
      toast.error('Download failed: ' + e.message);
    }
  };

  const deleteBackup = async (backupId: string) => {
    try {
      await backupManager.deleteBackup(backupId);
      toast.info('Backup snapshot deleted');
      await refreshSyncData();
    } catch (e: any) {
      toast.error('Failed to delete backup: ' + e.message);
    }
  };

  const setNetworkMode = (mode: NetworkMode) => {
    syncEngine.getTransportManager().setNetworkMode(mode);
    setStats(prev => ({ ...prev, networkMode: mode }));
    toast.info(`P2P Network Mode set to: ${mode}`);
  };

  const setScheduleBackupMinutes = (mins: number) => {
    backupManager.setScheduleInterval(mins);
    setScheduleBackupMinutesState(mins);
    if (mins > 0) {
      toast.success(`Automated backups scheduled every ${mins} minutes`);
    } else {
      toast.info('Automated backup schedule disabled');
    }
  };

  const updateDeviceName = (name: string) => {
    const updated = updateLocalDeviceName(name);
    setIdentity(updated);
    toast.success(`Device name updated to: ${updated.deviceName}`);
    refreshSyncData();
  };

  const generatePairingOffer = async (targetPeerId: string) => {
    return await syncEngine.getTransportManager().getWebRTCTransport().createOfferForPeer(targetPeerId);
  };

  const acceptPairingOffer = async (offerBase64: string) => {
    return await syncEngine.getTransportManager().getWebRTCTransport().acceptOfferAndCreateAnswer(offerBase64);
  };

  const acceptPairingAnswer = async (answerBase64: string) => {
    await syncEngine.getTransportManager().getWebRTCTransport().acceptAnswer(answerBase64);
  };

  const requestPairingFromPayload = async (payload: string) => {
    await syncEngine.requestPairingFromPayload(payload);
  };

  return (
    <SyncContext.Provider
      value={{
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
        requestPairingFromPayload
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}
