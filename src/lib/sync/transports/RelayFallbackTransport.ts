import { ConnectionType, SyncMessageEnvelope } from '../types';
import { TransportAdapter, TransportEventHandler } from './TransportAdapter';

/**
 * Same-origin cross-tab fallback transport.
 *
 * This uses BroadcastChannel to deliver actual envelopes between tabs/windows
 * running the app on the same origin. It is not an internet relay and does not
 * claim to connect separate devices. A remote relay requires a separately
 * deployed authenticated WebSocket service.
 */
export class RelayFallbackTransport implements TransportAdapter {
  readonly type: ConnectionType = 'RELAY_FALLBACK';
  readonly name = 'Cross-tab Broadcast Fallback';
  private handler: TransportEventHandler | null = null;
  private readonly localPeerId: string;
  private channel: BroadcastChannel | null = null;
  private isConnected = false;
  private activePeers = new Set<string>();

  constructor(localPeerId: string) {
    this.localPeerId = localPeerId;
  }

  isSupported(): boolean {
    return typeof BroadcastChannel !== 'undefined';
  }

  async init(handler: TransportEventHandler): Promise<void> {
    await this.disconnect();
    if (!this.isSupported()) {
      throw new Error('BroadcastChannel is not supported in this browser.');
    }

    this.handler = handler;
    this.channel = new BroadcastChannel('mahavtaar-sync-v1');
    this.channel.onmessage = (event: MessageEvent<SyncMessageEnvelope>) => {
      const message = event.data;
      if (!message || typeof message !== 'object' || !message.senderPeerId) return;
      if (message.senderPeerId === this.localPeerId) return;
      if (message.targetPeerId && message.targetPeerId !== this.localPeerId) return;

      if (!this.activePeers.has(message.senderPeerId)) {
        this.activePeers.add(message.senderPeerId);
        this.handler?.onPeerConnected?.(message.senderPeerId, this.type);
      }
      this.handler?.onMessage(message);
    };
    this.isConnected = true;
  }

  async send(targetPeerId: string, message: SyncMessageEnvelope): Promise<boolean> {
    if (!this.isConnected || !this.channel || !targetPeerId) return false;
    try {
      this.channel.postMessage({ ...message, targetPeerId });
      return true;
    } catch (error) {
      this.handler?.onError?.(error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  async broadcast(message: SyncMessageEnvelope): Promise<boolean> {
    if (!this.isConnected || !this.channel) return false;
    try {
      const { targetPeerId: _ignored, ...broadcastMessage } = message;
      this.channel.postMessage(broadcastMessage);
      return true;
    } catch (error) {
      this.handler?.onError?.(error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.channel?.close();
    this.channel = null;
    for (const peerId of this.activePeers) {
      this.handler?.onPeerDisconnected?.(peerId);
    }
    this.activePeers.clear();
    this.handler = null;
  }

  getStatus(): { active: boolean; connectedPeers: string[] } {
    return {
      active: this.isConnected,
      connectedPeers: Array.from(this.activePeers),
    };
  }
}
