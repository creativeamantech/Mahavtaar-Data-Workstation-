import { db, SyncJournalRecord } from '../db';
import { getLocalDeviceIdentity } from './deviceIdentity';
import { JournalEntry, TableSyncName } from './types';
import { sha256Fallback } from '../authCrypto';

const LAMPORT_KEY = 'mahavtaar_lamport_clock_v1';

export function getLamportClock(): number {
  const val = localStorage.getItem(LAMPORT_KEY);
  return val ? parseInt(val, 10) || 0 : 0;
}

export function incrementLamportClock(receivedClock?: number): number {
  const current = getLamportClock();
  const next = Math.max(current, receivedClock || 0) + 1;
  localStorage.setItem(LAMPORT_KEY, next.toString());
  return next;
}

export async function calculateJournalHash(data: any): Promise<string> {
  const str = typeof data === 'string' ? data : JSON.stringify(data || {});
  return await sha256Fallback(str);
}

export async function recordJournalChange(
  tableName: TableSyncName,
  recordId: string,
  action: 'INSERT' | 'UPDATE' | 'DELETE',
  data: any,
  diff?: Record<string, { oldVal: any; newVal: any }>
): Promise<SyncJournalRecord> {
  const device = getLocalDeviceIdentity();
  const lamport = incrementLamportClock();
  const timestamp = new Date().toISOString();
  const id = `JRN-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const hash = await calculateJournalHash({ tableName, recordId, action, data, timestamp });

  const entry: SyncJournalRecord = {
    id,
    timestamp,
    lamport,
    tableName,
    recordId,
    action,
    data: data ? JSON.parse(JSON.stringify(data)) : null,
    diff,
    peerId: device.peerId,
    deviceId: device.deviceId,
    status: 'QUEUED',
    syncedPeers: [],
    hash,
    retryCount: 0
  };

  await db.sync_journal.put(entry);
  return entry;
}

export async function getUnsyncedJournalEntries(targetPeerId?: string): Promise<SyncJournalRecord[]> {
  const entries = await db.sync_journal.toArray();
  if (!targetPeerId) {
    return entries.filter(e => e.status === 'QUEUED' || e.status === 'RETRY');
  }
  return entries.filter(e => !e.syncedPeers || !e.syncedPeers.includes(targetPeerId));
}

export async function markJournalEntriesSynced(entryIds: string[], peerId: string): Promise<void> {
  await db.transaction('rw', db.sync_journal, async () => {
    for (const id of entryIds) {
      const entry = await db.sync_journal.get(id);
      if (entry) {
        const set = new Set(entry.syncedPeers || []);
        set.add(peerId);
        entry.syncedPeers = Array.from(set);
        entry.status = 'SYNCED';
        await db.sync_journal.put(entry);
      }
    }
  });
}

export async function getJournalCount(): Promise<{ queued: number; synced: number; total: number }> {
  const all = await db.sync_journal.toArray();
  const queued = all.filter(e => e.status === 'QUEUED' || e.status === 'RETRY').length;
  const synced = all.filter(e => e.status === 'SYNCED').length;
  return { queued, synced, total: all.length };
}
