import { getUnsyncedJournalEntries } from './journal';
import { getLocalDeviceIdentity } from './deviceIdentity';
import { RelayFallbackTransport } from './transports/RelayFallbackTransport';
import { TransportEventHandler } from './transports/TransportAdapter';
import { SyncMessageEnvelope } from './types';

const POLL_INTERVAL_MS = 2000;

/**
 * Same-origin tab invalidation only.
 *
 * IndexedDB is already shared by tabs on the same origin, so this engine sends
 * only a lightweight notification when queued local changes appear. It never
 * broadcasts loan/customer data and does not mark journal entries synced.
 * Cross-device sync requires a separately authenticated transport.
 */
export class SyncEngine {
  private readonly identity = getLocalDeviceIdentity();
  private readonly transport: RelayFallbackTransport;
  private readonly tabPeerId: string;
  private onDataChanged?: () => void;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private started = false;
  private polling = false;
  private readonly notifiedJournalIds = new Set<string>();
  private readonly seenMessageIds = new Set<string>();

  constructor(onDataChanged?: () => void) {
    this.onDataChanged = onDataChanged;
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
    await this.notifyLocalChanges();
    this.pollTimer = setInterval(() => { void this.notifyLocalChanges(); }, POLL_INTERVAL_MS);
  }

  async stop(): Promise<void> {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
    await this.transport.disconnect();
    this.started = false;
  }

  async notifyLocalChanges(): Promise<number> {
    if (!this.started || this.polling) return 0;
    this.polling = true;
    let notified = 0;
    try {
      const entries = (await getUnsyncedJournalEntries())
        .filter(entry => entry.tableName === 'loan_records' && !this.notifiedJournalIds.has(entry.id));
      for (const entry of entries) {
        const message: SyncMessageEnvelope = {
          id: crypto.randomUUID(),
          type: 'HEARTBEAT',
          senderPeerId: this.tabPeerId,
          senderDeviceId: this.identity.deviceId,
          timestamp: new Date().toISOString(),
          lamport: Math.max(0, entry.lamport),
          payload: { kind: 'LOCAL_DATA_CHANGED' },
        };
        if (await this.transport.broadcast(message)) {
          this.notifiedJournalIds.add(entry.id);
          notified++;
        }
      }
      if (this.notifiedJournalIds.size > 5000) this.notifiedJournalIds.clear();
    } catch (error) {
      console.error('[SyncEngine] failed to notify local changes', error);
    } finally {
      this.polling = false;
    }
    return notified;
  }

  private async handleMessage(message: SyncMessageEnvelope): Promise<void> {
    if (!this.started || !message || !message.id || this.seenMessageIds.has(message.id)) return;
    this.seenMessageIds.add(message.id);
    if (this.seenMessageIds.size > 2000) this.seenMessageIds.clear();

    if (message.type !== 'HEARTBEAT' ||
        message.payload?.kind !== 'LOCAL_DATA_CHANGED' ||
        !message.senderPeerId ||
        message.senderPeerId === this.tabPeerId) return;

    // Tabs share the same IndexedDB database; only refresh UI state.
    // No incoming record payload is accepted or written from BroadcastChannel.
    this.onDataChanged?.();
  }
}
