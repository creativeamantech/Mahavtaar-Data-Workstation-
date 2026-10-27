import Dexie, { Table } from 'dexie';

export interface LoanRecord {
  agreementid: string;
  [key: string]: any;
}

export interface CustomerFeedback {
  id: string;
  agreementid: string;
  contactNumber: string;
  availability: string;
  status: string;
  standardFeedback?: string;
  detailedFeedback?: string;
  ref1Availability?: string;
  ref1Feedback?: string;
  ref2Availability?: string;
  ref2Feedback?: string;
  ref1?: {
    availability: string;
    feedback: string;
  };
  ref2?: {
    availability: string;
    feedback: string;
  };
  paidSubStatus?: string;
  amountPaid?: number;
  paymentMode?: string;
  approvedAmount?: number;
  nonContactableSubStatus?: string;
  ptpDate?: string;
  cbDate?: string;
  detailedFeedbackThirdParty?: string;
  detailedFeedbackAgentDispute?: string;
  overallDetailedFeedback?: string;
  concernNumber?: string;
  relationName?: string;
  agentId: string;
  agentName: string;
  createdAt: string;
}

export interface UploadSession {
  id: string;
  type: string;
  fileName: string;
  recordCount: number;
  uploadedBy: string;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  agreementid: string;
  field: string;
  oldValue: string;
  newValue: string;
  changedBy: string;
  createdAt: string;
  source: string;
}

export interface StateTarget {
  key: string;
  pct: number;
  updatedBy?: string;
  updatedAt?: string;
}

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  role: string;
  passwordHash: string;
  salt?: string;
  iterations?: number;
  permissions: { views: string[] };
  assignedExecutiveName?: string;
  maintenanceMode?: boolean;
}

export interface AttendanceLog {
  id: string;
  userId: string;
  userName: string;
  date: string;
  loginTime: string;
  logoutTime?: string;
  breakDuration?: number;
  currentBreakStart?: string;
}

export interface SyncPeerRecord {
  peerId: string;
  deviceId: string;
  deviceName: string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'DISABLED' | 'BLOCKED';
  connectionType: 'LOCAL_LAN' | 'INTERNET_P2P' | 'RELAY_FALLBACK' | 'OFFLINE';
  ipAddress?: string;
  os?: string;
  browser?: string;
  appVersion?: string;
  userEmail?: string;
  userName?: string;
  userRole?: string;
  publicKey?: string;
  approvedAt?: string;
  approvedBy?: string;
  lastSeen: string;
  lastSync?: string;
  latencyMs?: number;
  syncDirection?: 'BIDIRECTIONAL' | 'PUSH_ONLY' | 'PULL_ONLY';
  autoSyncEnabled?: boolean;
}

export interface SyncJournalRecord {
  id: string;
  timestamp: string;
  lamport: number;
  tableName: 'loan_records' | 'customer_feedbacks' | 'attendance_logs' | 'state_targets' | 'users';
  recordId: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  data: any;
  diff?: any;
  peerId: string;
  deviceId: string;
  status: 'QUEUED' | 'SYNCED' | 'FAILED' | 'RETRY';
  syncedPeers?: string[];
  hash: string;
  retryCount?: number;
}

export interface SyncConflictRecord {
  id: string;
  tableName: string;
  recordId: string;
  localData: any;
  remoteData: any;
  fieldConflicts: { field: string; localVal: any; remoteVal: any }[];
  localTimestamp: string;
  remoteTimestamp: string;
  localPeerId: string;
  remotePeerId: string;
  status: 'OPEN' | 'RESOLVED' | 'AUTO_RESOLVED';
  detectedAt: string;
  resolvedAt?: string;
  resolutionStrategy?: 'KEEP_LOCAL' | 'KEEP_REMOTE' | 'FIELD_MERGE' | 'MANUAL' | 'LWW';
  resolvedData?: any;
  resolvedBy?: string;
}

export interface SyncSettingsRecord {
  key: string;
  value: any;
}

export interface BackupSnapshotRecord {
  id: string;
  timestamp: string;
  type: 'MANUAL' | 'SCHEDULED' | 'PEER_SNAPSHOT';
  label?: string;
  sizeBytes: number;
  recordCounts: {
    records: number;
    feedbacks: number;
    attendance: number;
    users: number;
  };
  checksum: string;
  status: 'VALID' | 'RESTORED' | 'CORRUPTED';
  location: 'LOCAL_STORAGE' | 'EXTERNAL_DRIVE' | 'PEER_TRANSFER';
  encrypted: boolean;
  dataPayload?: string;
}

class MahavtaarDB extends Dexie {
  loan_records!: Table<LoanRecord, string>;
  upload_sessions!: Table<UploadSession, string>;
  audit_log!: Table<AuditEntry, string>;
  state_targets!: Table<StateTarget, string>;
  customer_feedbacks!: Table<CustomerFeedback, string>;
  users!: Table<StoredUser, string>;
  attendance_logs!: Table<AttendanceLog, string>;
  sync_peers!: Table<SyncPeerRecord, string>;
  sync_journal!: Table<SyncJournalRecord, string>;
  sync_conflicts!: Table<SyncConflictRecord, string>;
  sync_settings!: Table<SyncSettingsRecord, string>;
  backup_snapshots!: Table<BackupSnapshotRecord, string>;

  constructor() {
    super('mahavtaar_tracker_db');
    this.version(3).stores({
      customer_feedbacks: 'id, agreementid, createdAt',
      loan_records: 'agreementid, city, state, bom_bkt, executive_name',
      upload_sessions: 'id, createdAt, type',
      audit_log: 'id, agreementid, createdAt',
      state_targets: 'key',
      users: 'id, email',
      attendance_logs: 'id, userId, date'
    });

    this.version(4).stores({
      customer_feedbacks: 'id, agreementid, createdAt',
      loan_records: 'agreementid, city, state, bom_bkt, executive_name',
      upload_sessions: 'id, createdAt, type',
      audit_log: 'id, agreementid, createdAt',
      state_targets: 'key',
      users: 'id, email',
      attendance_logs: 'id, userId, date',
      sync_peers: 'peerId, deviceId, status, connectionType, lastSeen, approvedAt',
      sync_journal: 'id, timestamp, tableName, recordId, action, peerId, status, lamport',
      sync_conflicts: 'id, tableName, recordId, status, detectedAt',
      sync_settings: 'key',
      backup_snapshots: 'id, timestamp, type, status'
    });
  }
}

export const db = new MahavtaarDB();

import { sha256Fallback } from './authCrypto';

export async function backupSystemData() {
  const records = await db.loan_records.toArray();
  const sessions = await db.upload_sessions.toArray();
  const audit = await db.audit_log.toArray();
  const targets = await db.state_targets.toArray();
  
  const dataPayload = {
    loan_records: records,
    upload_sessions: sessions,
    audit_log: audit,
    state_targets: targets
  };

  const payloadString = JSON.stringify(dataPayload);
  const checksum = await sha256Fallback(payloadString);

  const backup = {
    timestamp: new Date().toISOString(),
    version: 2,
    checksum,
    data: dataPayload
  };
  
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mahavtaar_backup_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function resetSystemData() {
  await db.transaction('rw', db.loan_records, db.upload_sessions, db.audit_log, db.state_targets, async () => {
    await db.loan_records.clear();
    await db.upload_sessions.clear();
    await db.audit_log.clear();
    await db.state_targets.clear();
  });
}

export async function restoreSystemData(fileBuffer: ArrayBuffer) {
  try {
    const text = new TextDecoder().decode(fileBuffer);
    const backup = JSON.parse(text);
    
    if (backup.version === 2) {
      const payloadString = JSON.stringify(backup.data);
      const computedHash = await sha256Fallback(payloadString);
      if (computedHash !== backup.checksum) {
        throw new Error('Backup file is corrupted or tampered with. Checksum validation failed.');
      }
    }

    const data = backup.data;
    if (!data.loan_records || !data.audit_log) {
      throw new Error('Invalid backup file format.');
    }

    await db.transaction('rw', db.loan_records, db.upload_sessions, db.audit_log, db.state_targets, async () => {
      await db.loan_records.clear();
      await db.upload_sessions.clear();
      await db.audit_log.clear();
      await db.state_targets.clear();

      await db.loan_records.bulkAdd(data.loan_records);
      await db.upload_sessions.bulkAdd(data.upload_sessions);
      await db.audit_log.bulkAdd(data.audit_log);
      await db.state_targets.bulkAdd(data.state_targets);
    });

    return { success: true };
  } catch (err: any) {
    console.error('Restore failed:', err);
    throw new Error(err.message || 'Failed to restore backup');
  }
}
