export type PeerStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'DISABLED' | 'BLOCKED';

export type ConnectionType = 'LOCAL_LAN' | 'INTERNET_P2P' | 'RELAY_FALLBACK' | 'OFFLINE';

export type NetworkMode = 'ALL' | 'LOCAL_ONLY' | 'INTERNET_ONLY' | 'DISABLED';

export type SyncDirection = 'BIDIRECTIONAL' | 'PUSH_ONLY' | 'PULL_ONLY';

export type ConflictStrategy = 'LWW' | 'SOURCE_PRIORITY' | 'FIELD_MERGE' | 'MANUAL';

export interface DeviceIdentity {
  deviceId: string;
  peerId: string;
  deviceName: string;
  os: string;
  browser: string;
  appVersion: string;
  publicKeyFingerprint: string;
  ipHint?: string;
  createdDate: string;
}

export interface PeerInfo {
  peerId: string;
  deviceId: string;
  deviceName: string;
  status: PeerStatus;
  connectionType: ConnectionType;
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
  syncDirection?: SyncDirection;
  autoSyncEnabled?: boolean;
  isSelf?: boolean;
}

export type TableSyncName = 'loan_records' | 'customer_feedbacks' | 'attendance_logs' | 'state_targets' | 'users';

export interface JournalEntry {
  id: string;
  timestamp: string;
  lamport: number;
  tableName: TableSyncName;
  recordId: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  data: any;
  diff?: Record<string, { oldVal: any; newVal: any }>;
  peerId: string;
  deviceId: string;
  status: 'QUEUED' | 'SYNCED' | 'FAILED' | 'RETRY';
  syncedPeers?: string[];
  hash: string;
  retryCount?: number;
}

export interface ConflictFieldDiff {
  field: string;
  localVal: any;
  remoteVal: any;
}

export interface ConflictRecord {
  id: string;
  tableName: string;
  recordId: string;
  localData: any;
  remoteData: any;
  fieldConflicts: ConflictFieldDiff[];
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

export type MessageType =
  | 'HANDSHAKE'
  | 'HANDSHAKE_ACK'
  | 'PAIRING_REQUEST'
  | 'PAIRING_RESPONSE'
  | 'HEARTBEAT'
  | 'HEARTBEAT_ACK'
  | 'JOURNAL_PULL'
  | 'JOURNAL_PUSH'
  | 'JOURNAL_ACK'
  | 'DATA_RECONCILE'
  | 'DISCONNECT'
  | 'USER_SESSION_UPDATE';

export interface SyncMessageEnvelope {
  id: string;
  type: MessageType;
  senderPeerId: string;
  senderDeviceId: string;
  targetPeerId?: string; // Broadcast if undefined
  timestamp: string;
  lamport: number;
  payload: any;
  signature?: string;
}

export interface DeviceSession {
  deviceId: string;
  peerId: string;
  deviceName: string;
  userEmail?: string;
  userName?: string;
  userRole?: string;
  os?: string;
  browser?: string;
  ipAddress?: string;
  lastActive: string;
  status: 'ONLINE' | 'OFFLINE' | 'IDLE';
  connectionType: ConnectionType;
}

export interface SyncStats {
  totalPeers: number;
  approvedPeers: number;
  onlinePeers: number;
  pendingApproval: number;
  queuedChanges: number;
  openConflicts: number;
  lastSyncTime?: string;
  syncInProgress: boolean;
  totalSyncedTransactions: number;
  networkMode: NetworkMode;
}

export interface SyncSettingsState {
  networkMode: NetworkMode;
  allowLocalLan: boolean;
  allowInternetP2p: boolean;
  allowRelay: boolean;
  autoSyncIntervalSec: number;
  defaultConflictRule: ConflictStrategy;
  pairingCode: string;
  pairingCodeExpires: string;
  autoApproveLocalSubnet: boolean;
  encryptionEnabled: boolean;
  relayServerUrl: string;
  stunServers: string[];
}

export interface BackupSnapshot {
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
}
