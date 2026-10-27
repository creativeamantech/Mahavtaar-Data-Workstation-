import { db, SyncPeerRecord } from '../db';
import { processCRDTIncomingEntry } from './crdtEngine';
import { getLocalDeviceIdentity } from './deviceIdentity';
import { getLamportClock, getUnsyncedJournalEntries, incrementLamportClock, markJournalEntriesSynced, recordJournalChange } from './journal';
import { TransportManager } from './transports/TransportManager';
import {
  ConflictStrategy,
  DeviceIdentity,
  DeviceSession,
  JournalEntry,
  NetworkMode,
  PeerInfo,
  PeerStatus,
  SyncDirection,
  SyncMessageEnvelope,
  SyncStats,
  TableSyncName
} from './types';

export class SyncEngine {
  private deviceIdentity: DeviceIdentity;
  private transportManager: TransportManager;
  private isInitialized: boolean = false;
  private syncTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private sessionMap = new Map<string, DeviceSession>();
  private listeners = new Set<() => void>();
  private defaultConflictRule: ConflictStrategy = 'FIELD_MERGE';
  private currentUserSession: { email?: string; name?: string; role?: string } = {};

  constructor() {
    this.deviceIdentity = getLocalDeviceIdentity();
    this.transportManager = new TransportManager(this.deviceIdentity.peerId);
  }

  getIdentity(): DeviceIdentity {
    return this.deviceIdentity;
  }

  getTransportManager(): TransportManager {
    return this.transportManager;
  }

  async init(): Promise<void> {
    if (this.isInitialized) return;

    // Register local device self-entry in peers table if missing
    const selfRecord = await db.sync_peers.get(this.deviceIdentity.peerId);
    if (!selfRecord) {
      const initialSelf: SyncPeerRecord = {
        peerId: this.deviceIdentity.peerId,
        deviceId: this.deviceIdentity.deviceId,
        deviceName: this.deviceIdentity.deviceName,
        status: 'APPROVED',
        connectionType: 'LOCAL_LAN',
        os: this.deviceIdentity.os,
        browser: this.deviceIdentity.browser,
        appVersion: this.deviceIdentity.appVersion,
        approvedAt: new Date().toISOString(),
        approvedBy: 'System Self',
        lastSeen: new Date().toISOString(),
        syncDirection: 'BIDIRECTIONAL',
        autoSyncEnabled: true
      };
      await db.sync_peers.put(initialSelf);
    }

    // Initialize transport manager with incoming message handler
    await this.transportManager.init({
      onMessage: (msg) => this.handleIncomingMessage(msg),
      onPeerConnected: (peerId, type, metadata) => this.handlePeerConnected(peerId, type, metadata),
      onPeerDisconnected: (peerId) => this.handlePeerDisconnected(peerId)
    });

    // Start background sync queue worker & heartbeat
    this.startBackgroundSync(10); // Check every 10 seconds
    this.startHeartbeat(8); // Send heartbeat every 8 seconds

    this.isInitialized = true;

    // Send initial handshake / discovery broadcast
    setTimeout(() => {
      this.broadcastHandshake();
    }, 500);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(fn => {
      try { fn(); } catch (e) { console.error(e); }
    });
  }

  setCurrentUser(user: { email?: string; name?: string; role?: string } | null) {
    if (user) {
      this.currentUserSession = {
        email: user.email,
        name: user.name,
        role: user.role
      };
    } else {
      this.currentUserSession = {};
    }
    this.broadcastSessionUpdate();
  }

  private async broadcastHandshake() {
    const envelope: SyncMessageEnvelope = {
      id: `MSG-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: 'HANDSHAKE',
      senderPeerId: this.deviceIdentity.peerId,
      senderDeviceId: this.deviceIdentity.deviceId,
      timestamp: new Date().toISOString(),
      lamport: getLamportClock(),
      payload: {
        deviceInfo: {
          deviceName: this.deviceIdentity.deviceName,
          os: this.deviceIdentity.os,
          browser: this.deviceIdentity.browser,
          appVersion: this.deviceIdentity.appVersion,
          publicKeyFingerprint: this.deviceIdentity.publicKeyFingerprint
        },
        userSession: this.currentUserSession
      }
    };
    await this.transportManager.broadcast(envelope);
  }

  private async broadcastSessionUpdate() {
    const envelope: SyncMessageEnvelope = {
      id: `MSG-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: 'USER_SESSION_UPDATE',
      senderPeerId: this.deviceIdentity.peerId,
      senderDeviceId: this.deviceIdentity.deviceId,
      timestamp: new Date().toISOString(),
      lamport: getLamportClock(),
      payload: {
        userSession: this.currentUserSession,
        deviceName: this.deviceIdentity.deviceName,
        os: this.deviceIdentity.os,
        browser: this.deviceIdentity.browser
      }
    };
    await this.transportManager.broadcast(envelope);
  }

  private async handleIncomingMessage(msg: SyncMessageEnvelope) {
    incrementLamportClock(msg.lamport);

    switch (msg.type) {
      case 'HANDSHAKE':
        await this.onHandshakeReceived(msg);
        break;
      case 'HANDSHAKE_ACK':
        await this.onHandshakeAckReceived(msg);
        break;
      case 'HEARTBEAT':
        await this.onHeartbeatReceived(msg);
        break;
      case 'HEARTBEAT_ACK':
        // Handled in transport manager
        break;
      case 'USER_SESSION_UPDATE':
        this.onSessionUpdateReceived(msg);
        break;
      case 'PAIRING_REQUEST':
        await this.onPairingRequestReceived(msg);
        break;
      case 'PAIRING_RESPONSE':
        await this.onPairingResponseReceived(msg);
        break;
      case 'JOURNAL_PUSH':
        await this.onJournalPushReceived(msg);
        break;
      case 'JOURNAL_ACK':
        await this.onJournalAckReceived(msg);
        break;
    }

    this.notify();
  }

  private async handlePeerConnected(peerId: string, type: any, metadata?: any) {
    let peer = await db.sync_peers.get(peerId);
    if (!peer) {
      peer = {
        peerId,
        deviceId: metadata?.deviceId || `DEV-${peerId.slice(-4)}`,
        deviceName: metadata?.deviceName || `Peer-${peerId.slice(-4)}`,
        status: 'PENDING_APPROVAL',
        connectionType: type,
        os: metadata?.os || 'Unknown OS',
        browser: metadata?.browser || 'Unknown',
        lastSeen: new Date().toISOString(),
        syncDirection: 'BIDIRECTIONAL',
        autoSyncEnabled: true
      };
      await db.sync_peers.put(peer);
    } else {
      peer.lastSeen = new Date().toISOString();
      peer.connectionType = type;
      await db.sync_peers.put(peer);
    }
    this.notify();
  }

  private handlePeerDisconnected(peerId: string) {
    this.sessionMap.delete(peerId);
    this.notify();
  }

  private async onHandshakeReceived(msg: SyncMessageEnvelope) {
    const { deviceInfo, userSession } = msg.payload || {};
    let peer = await db.sync_peers.get(msg.senderPeerId);

    if (!peer) {
      peer = {
        peerId: msg.senderPeerId,
        deviceId: msg.senderDeviceId,
        deviceName: deviceInfo?.deviceName || `Peer-${msg.senderDeviceId.slice(-4)}`,
        status: 'PENDING_APPROVAL', // Requires Admin Approval
        connectionType: this.transportManager.getPeerConnectionType(msg.senderPeerId),
        os: deviceInfo?.os,
        browser: deviceInfo?.browser,
        appVersion: deviceInfo?.appVersion,
        userEmail: userSession?.email,
        userName: userSession?.name,
        userRole: userSession?.role,
        publicKey: deviceInfo?.publicKeyFingerprint,
        lastSeen: new Date().toISOString(),
        syncDirection: 'BIDIRECTIONAL',
        autoSyncEnabled: true
      };
      await db.sync_peers.put(peer);
    } else {
      peer.lastSeen = new Date().toISOString();
      peer.userName = userSession?.name || peer.userName;
      peer.userEmail = userSession?.email || peer.userEmail;
      peer.userRole = userSession?.role || peer.userRole;
      peer.connectionType = this.transportManager.getPeerConnectionType(msg.senderPeerId);
      await db.sync_peers.put(peer);
    }

    // Track in live session map
    this.sessionMap.set(msg.senderPeerId, {
      deviceId: msg.senderDeviceId,
      peerId: msg.senderPeerId,
      deviceName: peer.deviceName,
      userEmail: userSession?.email,
      userName: userSession?.name,
      userRole: userSession?.role,
      os: peer.os,
      browser: peer.browser,
      lastActive: new Date().toISOString(),
      status: 'ONLINE',
      connectionType: peer.connectionType
    });

    // Send Handshake ACK back
    const ackEnvelope: SyncMessageEnvelope = {
      id: `ACK-${Date.now()}`,
      type: 'HANDSHAKE_ACK',
      senderPeerId: this.deviceIdentity.peerId,
      senderDeviceId: this.deviceIdentity.deviceId,
      targetPeerId: msg.senderPeerId,
      timestamp: new Date().toISOString(),
      lamport: getLamportClock(),
      payload: {
        isApproved: peer.status === 'APPROVED',
        deviceInfo: {
          deviceName: this.deviceIdentity.deviceName,
          os: this.deviceIdentity.os,
          browser: this.deviceIdentity.browser
        },
        userSession: this.currentUserSession
      }
    };

    await this.transportManager.send(msg.senderPeerId, ackEnvelope);

    // If already approved, trigger initial sync exchange
    if (peer.status === 'APPROVED') {
      this.syncWithPeer(msg.senderPeerId);
    }
  }

  private async onHandshakeAckReceived(msg: SyncMessageEnvelope) {
    const { isApproved, deviceInfo, userSession } = msg.payload || {};
    const peer = await db.sync_peers.get(msg.senderPeerId);

    if (peer) {
      peer.lastSeen = new Date().toISOString();
      peer.userName = userSession?.name || peer.userName;
      peer.userRole = userSession?.role || peer.userRole;
      await db.sync_peers.put(peer);
    }

    this.sessionMap.set(msg.senderPeerId, {
      deviceId: msg.senderDeviceId,
      peerId: msg.senderPeerId,
      deviceName: deviceInfo?.deviceName || peer?.deviceName || msg.senderDeviceId,
      userEmail: userSession?.email,
      userName: userSession?.name,
      userRole: userSession?.role,
      os: deviceInfo?.os || peer?.os,
      browser: deviceInfo?.browser,
      lastActive: new Date().toISOString(),
      status: 'ONLINE',
      connectionType: this.transportManager.getPeerConnectionType(msg.senderPeerId)
    });

    if (isApproved && peer?.status === 'APPROVED') {
      this.syncWithPeer(msg.senderPeerId);
    }
  }

  private async onHeartbeatReceived(msg: SyncMessageEnvelope) {
    const peer = await db.sync_peers.get(msg.senderPeerId);
    if (peer) {
      peer.lastSeen = new Date().toISOString();
      await db.sync_peers.put(peer);
    }

    const sess = this.sessionMap.get(msg.senderPeerId);
    if (sess) {
      sess.lastActive = new Date().toISOString();
      sess.status = 'ONLINE';
    }

    // Reply ACK
    const ack: SyncMessageEnvelope = {
      id: `HBA-${Date.now()}`,
      type: 'HEARTBEAT_ACK',
      senderPeerId: this.deviceIdentity.peerId,
      senderDeviceId: this.deviceIdentity.deviceId,
      targetPeerId: msg.senderPeerId,
      timestamp: new Date().toISOString(),
      lamport: getLamportClock(),
      payload: { pingTimestamp: msg.payload?.pingTimestamp }
    };
    await this.transportManager.send(msg.senderPeerId, ack);
  }

  private onSessionUpdateReceived(msg: SyncMessageEnvelope) {
    const { userSession, deviceName, os, browser } = msg.payload || {};
    this.sessionMap.set(msg.senderPeerId, {
      deviceId: msg.senderDeviceId,
      peerId: msg.senderPeerId,
      deviceName: deviceName || `Device-${msg.senderDeviceId.slice(-4)}`,
      userEmail: userSession?.email,
      userName: userSession?.name,
      userRole: userSession?.role,
      os,
      browser,
      lastActive: new Date().toISOString(),
      status: 'ONLINE',
      connectionType: this.transportManager.getPeerConnectionType(msg.senderPeerId)
    });
  }

  private async onPairingRequestReceived(msg: SyncMessageEnvelope) {
    const { pairingCode, deviceName, os } = msg.payload || {};
    let peer = await db.sync_peers.get(msg.senderPeerId);
    if (!peer) {
      peer = {
        peerId: msg.senderPeerId,
        deviceId: msg.senderDeviceId,
        deviceName: deviceName || `Peer-${msg.senderDeviceId.slice(-4)}`,
        status: 'PENDING_APPROVAL',
        connectionType: this.transportManager.getPeerConnectionType(msg.senderPeerId),
        os,
        lastSeen: new Date().toISOString(),
        syncDirection: 'BIDIRECTIONAL',
        autoSyncEnabled: true
      };
      await db.sync_peers.put(peer);
    }
  }

  private async onPairingResponseReceived(msg: SyncMessageEnvelope) {
    const { approved, approvedBy } = msg.payload || {};
    const peer = await db.sync_peers.get(msg.senderPeerId);
    if (peer && approved) {
      peer.status = 'APPROVED';
      peer.approvedAt = new Date().toISOString();
      peer.approvedBy = approvedBy || 'Admin';
      await db.sync_peers.put(peer);
      this.syncWithPeer(msg.senderPeerId);
    }
  }

  private async onJournalPushReceived(msg: SyncMessageEnvelope) {
    // CRITICAL SECURITY RULE: Only APPROVED peers can push CRM data changes!
    const peer = await db.sync_peers.get(msg.senderPeerId);
    if (!peer || peer.status !== 'APPROVED') {
      console.warn(`[SyncEngine] Rejected unauthorized journal push from unapproved peer ${msg.senderPeerId}`);
      return;
    }

    const incomingEntries: JournalEntry[] = msg.payload?.entries || [];
    const appliedEntryIds: string[] = [];

    for (const entry of incomingEntries) {
      const table = (db as any)[entry.tableName];
      if (!table) continue;

      const currentRecord = await table.get(entry.recordId);
      const mergeResult = await processCRDTIncomingEntry(entry, currentRecord, this.defaultConflictRule);

      if (mergeResult.applied) {
        if (entry.action === 'DELETE') {
          if (currentRecord) {
            await table.put({ 
              ...currentRecord, 
              status: 'DELETED', 
              isDeleted: true, 
              deletedAt: new Date().toISOString(),
              deletedByRemotePeer: msg.senderPeerId 
            });
          }
        } else {
          await table.put(mergeResult.mergedData);
        }
      }

      appliedEntryIds.push(entry.id);
    }

    // Send ACK back
    const ackEnvelope: SyncMessageEnvelope = {
      id: `JRN-ACK-${Date.now()}`,
      type: 'JOURNAL_ACK',
      senderPeerId: this.deviceIdentity.peerId,
      senderDeviceId: this.deviceIdentity.deviceId,
      targetPeerId: msg.senderPeerId,
      timestamp: new Date().toISOString(),
      lamport: getLamportClock(),
      payload: { appliedEntryIds }
    };
    await this.transportManager.send(msg.senderPeerId, ackEnvelope);

    peer.lastSync = new Date().toISOString();
    await db.sync_peers.put(peer);
  }

  private async onJournalAckReceived(msg: SyncMessageEnvelope) {
    const appliedEntryIds: string[] = msg.payload?.appliedEntryIds || [];
    if (appliedEntryIds.length > 0) {
      await markJournalEntriesSynced(appliedEntryIds, msg.senderPeerId);
    }
    const peer = await db.sync_peers.get(msg.senderPeerId);
    if (peer) {
      peer.lastSync = new Date().toISOString();
      await db.sync_peers.put(peer);
    }
  }

  // --- External Sync Actions ---

  async syncWithPeer(targetPeerId: string): Promise<boolean> {
    const peer = await db.sync_peers.get(targetPeerId);
    if (!peer || peer.status !== 'APPROVED' || peer.status === 'DISABLED') {
      return false;
    }

    const unsynced = await getUnsyncedJournalEntries(targetPeerId);
    if (unsynced.length === 0) return true;

    const envelope: SyncMessageEnvelope = {
      id: `PUSH-${Date.now()}`,
      type: 'JOURNAL_PUSH',
      senderPeerId: this.deviceIdentity.peerId,
      senderDeviceId: this.deviceIdentity.deviceId,
      targetPeerId,
      timestamp: new Date().toISOString(),
      lamport: getLamportClock(),
      payload: { entries: unsynced }
    };

    return await this.transportManager.send(targetPeerId, envelope);
  }

  async triggerGlobalSync(): Promise<number> {
    const approvedPeers = await db.sync_peers.where('status').equals('APPROVED').toArray();
    let count = 0;
    for (const p of approvedPeers) {
      if (p.peerId !== this.deviceIdentity.peerId) {
        const success = await this.syncWithPeer(p.peerId);
        if (success) count++;
      }
    }
    return count;
  }

  async notifyLocalChange(tableName: TableSyncName, recordId: string, action: 'INSERT' | 'UPDATE' | 'DELETE', data: any) {
    // Record into journal
    await recordJournalChange(tableName, recordId, action, data);
    // Push immediately to all approved peers
    this.triggerGlobalSync();
  }

  async requestPairingFromPayload(payloadStr: string): Promise<void> {
    try {
      // Handle 6-digit code format directly
      if (/^\d{3}-\d{3}$/.test(payloadStr.trim())) {
        const req: SyncMessageEnvelope = {
          id: `PAIR-REQ-${Date.now()}`,
          type: 'PAIRING_REQUEST',
          senderPeerId: this.deviceIdentity.peerId,
          senderDeviceId: this.deviceIdentity.deviceId,
          targetPeerId: 'BROADCAST',
          timestamp: new Date().toISOString(),
          lamport: getLamportClock(),
          payload: {
            pairingCode: payloadStr.trim(),
            deviceName: this.deviceIdentity.deviceName,
            os: this.deviceIdentity.os
          }
        };
        await this.transportManager.broadcast(req);
        this.notify();
        return;
      }

      const payload = JSON.parse(payloadStr);
      if (!payload.peerId || !payload.code) {
        throw new Error('Invalid payload format');
      }

      let peer = await db.sync_peers.get(payload.peerId);
      if (!peer) {
        peer = {
          peerId: payload.peerId,
          deviceId: payload.deviceId || 'UNKNOWN',
          deviceName: payload.deviceName || `Peer-${payload.peerId.slice(-4)}`,
          status: 'PENDING_APPROVAL',
          connectionType: 'UNKNOWN',
          os: 'Unknown',
          lastSeen: new Date().toISOString(),
          syncDirection: 'BIDIRECTIONAL',
          autoSyncEnabled: true
        };
        await db.sync_peers.put(peer);
      }

      const req: SyncMessageEnvelope = {
        id: `PAIR-REQ-${Date.now()}`,
        type: 'PAIRING_REQUEST',
        senderPeerId: this.deviceIdentity.peerId,
        senderDeviceId: this.deviceIdentity.deviceId,
        targetPeerId: payload.peerId,
        timestamp: new Date().toISOString(),
        lamport: getLamportClock(),
        payload: {
          pairingCode: payload.code,
          deviceName: this.deviceIdentity.deviceName,
          os: this.deviceIdentity.os
        }
      };
      
      const sent = await this.transportManager.send(payload.peerId, req);
      if (!sent) {
        // Fallback to broadcast if direct send fails
        await this.transportManager.broadcast(req);
      }
      this.notify();
    } catch (err: any) {
      throw new Error('Failed to request pairing: ' + err.message);
    }
  }

  // --- Admin Peer Management Methods ---

  async approvePeer(peerId: string, approvedBy: string = 'Admin'): Promise<void> {
    const peer = await db.sync_peers.get(peerId);
    if (!peer) throw new Error('Peer not found');

    peer.status = 'APPROVED';
    peer.approvedAt = new Date().toISOString();
    peer.approvedBy = approvedBy;
    await db.sync_peers.put(peer);

    // Notify peer of approval
    const resp: SyncMessageEnvelope = {
      id: `PAIR-RESP-${Date.now()}`,
      type: 'PAIRING_RESPONSE',
      senderPeerId: this.deviceIdentity.peerId,
      senderDeviceId: this.deviceIdentity.deviceId,
      targetPeerId: peerId,
      timestamp: new Date().toISOString(),
      lamport: getLamportClock(),
      payload: { approved: true, approvedBy }
    };
    await this.transportManager.send(peerId, resp);

    // Trigger immediate sync
    await this.syncWithPeer(peerId);
    this.notify();
  }

  async rejectPeer(peerId: string): Promise<void> {
    const peer = await db.sync_peers.get(peerId);
    if (peer) {
      peer.status = 'REJECTED';
      await db.sync_peers.put(peer);
    }
    this.notify();
  }

  async disablePeer(peerId: string): Promise<void> {
    const peer = await db.sync_peers.get(peerId);
    if (peer) {
      peer.status = 'DISABLED';
      await db.sync_peers.put(peer);
    }
    this.notify();
  }

  async reEnablePeer(peerId: string): Promise<void> {
    const peer = await db.sync_peers.get(peerId);
    if (peer) {
      peer.status = 'APPROVED';
      await db.sync_peers.put(peer);
      this.syncWithPeer(peerId);
    }
    this.notify();
  }

  async removePeer(peerId: string): Promise<void> {
    await db.sync_peers.delete(peerId);
    this.sessionMap.delete(peerId);
    this.notify();
  }

  async updatePeerSettings(peerId: string, updates: Partial<SyncPeerRecord>): Promise<void> {
    const peer = await db.sync_peers.get(peerId);
    if (peer) {
      Object.assign(peer, updates);
      await db.sync_peers.put(peer);
      this.notify();
    }
  }

  // --- Getters & Metrics ---

  async getAllPeers(): Promise<PeerInfo[]> {
    const records = await db.sync_peers.toArray();
    return records.map(r => ({
      ...r,
      latencyMs: this.transportManager.getPeerLatency(r.peerId),
      isSelf: r.peerId === this.deviceIdentity.peerId
    }));
  }

  getLiveSessions(): DeviceSession[] {
    const selfSession: DeviceSession = {
      deviceId: this.deviceIdentity.deviceId,
      peerId: this.deviceIdentity.peerId,
      deviceName: this.deviceIdentity.deviceName,
      userEmail: this.currentUserSession.email || 'Current Session',
      userName: this.currentUserSession.name || 'Local Administrator',
      userRole: this.currentUserSession.role || 'ADMIN',
      os: this.deviceIdentity.os,
      browser: this.deviceIdentity.browser,
      lastActive: new Date().toISOString(),
      status: 'ONLINE',
      connectionType: 'LOCAL_LAN'
    };

    const remoteSessions = Array.from(this.sessionMap.values());
    return [selfSession, ...remoteSessions];
  }

  async getSyncStats(): Promise<SyncStats> {
    const peers = await db.sync_peers.toArray();
    const approved = peers.filter(p => p.status === 'APPROVED');
    const pending = peers.filter(p => p.status === 'PENDING_APPROVAL');

    const journal = await db.sync_journal.toArray();
    const queued = journal.filter(j => j.status === 'QUEUED' || j.status === 'RETRY').length;

    const conflicts = await db.sync_conflicts.where('status').equals('OPEN').count();

    const lastSyncDates = approved.map(p => p.lastSync).filter(Boolean) as string[];
    const lastSyncTime = lastSyncDates.sort().reverse()[0];

    return {
      totalPeers: peers.length,
      approvedPeers: approved.length,
      onlinePeers: 1 + this.sessionMap.size,
      pendingApproval: pending.length,
      queuedChanges: queued,
      openConflicts: conflicts,
      lastSyncTime,
      syncInProgress: false,
      totalSyncedTransactions: journal.length,
      networkMode: this.transportManager.getNetworkMode()
    };
  }

  private startBackgroundSync(intervalSec: number) {
    if (this.syncTimer) clearInterval(this.syncTimer);
    this.syncTimer = setInterval(() => {
      this.triggerGlobalSync();
    }, intervalSec * 1000);
  }

  private startHeartbeat(intervalSec: number) {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      const pingEnvelope: SyncMessageEnvelope = {
        id: `PING-${Date.now()}`,
        type: 'HEARTBEAT',
        senderPeerId: this.deviceIdentity.peerId,
        senderDeviceId: this.deviceIdentity.deviceId,
        timestamp: new Date().toISOString(),
        lamport: getLamportClock(),
        payload: { pingTimestamp: Date.now() }
      };
      this.transportManager.broadcast(pingEnvelope);
    }, intervalSec * 1000);
  }

  destroy() {
    if (this.syncTimer) clearInterval(this.syncTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.transportManager.destroy();
    this.listeners.clear();
  }
}

export const syncEngine = new SyncEngine();
