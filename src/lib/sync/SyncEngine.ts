import { db, SyncJournalRecord } from '../db';
import { getLocalDeviceIdentity } from './deviceIdentity';
import { getUnsyncedJournalEntries, markJournalEntriesSynced } from './journal';
import { RelayFallbackTransport } from './transports/RelayFallbackTransport';
import { TransportEventHandler } from './transports/TransportAdapter';
import { SyncMessageEnvelope } from './types';

const BATCH_SIZE = 100;
const POLL_INTERVAL_MS = 2000;

/**
 * Local-first journal sync coordinator.
 *
 * Current transport scope is same-origin browser tabs only. Incoming changes
 * are applied only when the sending peer is explicitly approved in local
 * sync_peers. This is not a cross-device internet relay.
 */
export class SyncEngine {
  private readonly identity = getLocalDeviceIdentity();
  private readonly transport: RelayFallbackTransport;
  private readonly tabPeerId: string;
  private onDataChanged?: () => void;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private started = false;
  private sending = false;
  private readonly seenMessageIds = new Set<string>();

  constructor(onDataChanged?: () => void) {
    this.onDataChanged = onDataChanged;
    // Include a per-tab identifier so tabs in the same browser do not mistake
    // each other for the same peer when localStorage device identity is shared.
    const tabId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.tabPeerId = `${this.identity.peerId}:${tabId}`;
    this.transport = new RelayFallbackTransport(this.tabPeerId);
  }

  async start(): Promise<void> {
    if (this.started) return;
    const handler: TransportEventHandler = {
      onMessage: (message) => { void this.handleMessage(message); },
      onError: (error) => console.error('[SyncEngine] transport error', error),
    };
    await this.transport.init(handler);
    this.started = true;
    await this.flushQueuedChanges();
    this.pollTimer = setInterval(() => { void this.flushQueuedChanges(); }, POLL_INTERVAL_MS);
  }

  async stop(): Promise<void> {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
    await this.transport.disconnect();
    this.started = false;
  }

  async flushQueuedChanges(): Promise<number> {
    if (!this.started || this.sending) return 0;
    this.sending = true;
    let sent = 0;
    try {
      const entries = (await getUnsyncedJournalEntries()).filter(entry => entry.tableName === 'loan_records');
      for (let offset = 0; offset < entries.length; offset += BATCH_SIZE) {
        const batch = entries.slice(offset, offset + BATCH_SIZE);
        const envelope: SyncMessageEnvelope = {
          id: crypto.randomUUID(),
          type: 'JOURNAL_PUSH',
          senderPeerId: this.tabPeerId,
          senderDeviceId: this.identity.deviceId,
          timestamp: new Date().toISOString(),
          lamport: Math.max(0, ...batch.map(entry => entry.lamport)),
          payload: { entries: batch },
        };
        // BroadcastChannel delivery is best-effort; don't mark as synced until
        // an approved peer acknowledges receipt.
        if (await this.transport.broadcast(envelope)) sent += batch.length;
      }
    } catch (error) {
      console.error('[SyncEngine] failed to flush journal', error);
    } finally {
      this.sending = false;
    }
    return sent;
  }

  private async handleMessage(message: SyncMessageEnvelope): Promise<void> {
    if (!this.started || !message || !message.id || this.seenMessageIds.has(message.id)) return;
    this.seenMessageIds.add(message.id);
    if (this.seenMessageIds.size > 2000) this.seenMessageIds.clear();

    if (message.type === 'JOURNAL_ACK' && Array.isArray(message.payload?.entryIds)) {
      await markJournalEntriesSynced(message.payload.entryIds, message.senderPeerId.split(':')[0]);
      return;
    }
    if (message.type !== 'JOURNAL_PUSH' || !Array.isArray(message.payload?.entries)) return;
    if (!message.senderPeerId || message.senderPeerId === this.tabPeerId) return;

    const approvedPeerId = message.senderPeerId.split(':')[0];
    const peer = await db.sync_peers.get(approvedPeerId);
    if (!peer || peer.status !== 'APPROVED') {
      console.warn('[SyncEngine] ignored journal from unapproved peer', message.senderPeerId);
      return;
    }

    const entries = message.payload.entries as SyncJournalRecord[];
    const acceptedIds: string[] = [];
    for (const entry of entries.slice(0, BATCH_SIZE)) {
      if (!entry || !entry.id || entry.tableName !== 'loan_records' ||
          !['INSERT', 'UPDATE', 'DELETE'].includes(entry.action)) continue;

      // Re-check approval immediately before each write.
      const currentPeer = await db.sync_peers.get(approvedPeerId);
      if (!currentPeer || currentPeer.status !== 'APPROVED') return;

      try {
        await db.transaction('rw', db.loan_records, db.sync_journal, async () => {
          const duplicate = await db.sync_journal.get(entry.id);
          if (duplicate) {
            acceptedIds.push(entry.id);
            return;
          }

          if (entry.action === 'DELETE') {
            await db.loan_records.delete(entry.recordId);
          } else if (entry.data && typeof entry.data === 'object' &&
                     String(entry.data.agreementid || '') === entry.recordId) {
            await db.loan_records.put(entry.data);
          } else {
            throw new Error('Invalid loan record journal payload');
          }

          await db.sync_journal.put({
            ...entry,
            peerId: approvedPeerId,
            status: 'SYNCED',
            syncedPeers: [this.identity.peerId],
          });
          acceptedIds.push(entry.id);
        });
      } catch (error) {
        console.error('[SyncEngine] rejected journal entry', entry.id, error);
      }
    }

    if (acceptedIds.length) {
      this.onDataChanged?.();
      const ack: SyncMessageEnvelope = {
        id: crypto.randomUUID(),
        type: 'JOURNAL_ACK',
        senderPeerId: this.tabPeerId,
        senderDeviceId: this.identity.deviceId,
        targetPeerId: message.senderPeerId,
        timestamp: new Date().toISOString(),
        lamport: message.lamport,
        payload: { entryIds: acceptedIds },
      };
      await this.transport.send(message.senderPeerId, ack);
    }
  }
}
