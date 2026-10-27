import { ConnectionType, SyncMessageEnvelope } from '../types';
import { TransportAdapter, TransportEventHandler } from './TransportAdapter';

export class BroadcastChannelTransport implements TransportAdapter {
  readonly type: ConnectionType = 'LOCAL_LAN';
  readonly name = 'Local Broadcast Mesh';
  private channel: BroadcastChannel | null = null;
  private handler: TransportEventHandler | null = null;
  private activePeers = new Set<string>();
  private localPeerId: string = '';

  constructor(localPeerId: string) {
    this.localPeerId = localPeerId;
  }

  isSupported(): boolean {
    return typeof window !== 'undefined' && 'BroadcastChannel' in window;
  }

  async init(handler: TransportEventHandler): Promise<void> {
    this.handler = handler;
    if (!this.isSupported()) return;

    try {
      this.channel = new BroadcastChannel('mahavtaar_p2p_mesh_v1');
      this.channel.onmessage = (event) => {
        try {
          const envelope: SyncMessageEnvelope = event.data;
          if (!envelope || !envelope.senderPeerId) return;

          // Ignore messages sent by self
          if (envelope.senderPeerId === this.localPeerId) return;

          // If message has targetPeerId specified and it's not us, ignore
          if (envelope.targetPeerId && envelope.targetPeerId !== this.localPeerId) return;

          // Register peer
          if (!this.activePeers.has(envelope.senderPeerId)) {
            this.activePeers.add(envelope.senderPeerId);
            this.handler?.onPeerConnected?.(envelope.senderPeerId, this.type, envelope.payload?.deviceInfo);
          }

          this.handler?.onMessage(envelope);
        } catch (e) {
          console.error('[BroadcastTransport] message parse error', e);
        }
      };
    } catch (err) {
      console.warn('[BroadcastTransport] initialization warning:', err);
    }
  }

  async send(targetPeerId: string, message: SyncMessageEnvelope): Promise<boolean> {
    if (!this.channel) return false;
    try {
      this.channel.postMessage(message);
      return true;
    } catch (e) {
      console.error('[BroadcastTransport] Send error', e);
      return false;
    }
  }

  async broadcast(message: SyncMessageEnvelope): Promise<boolean> {
    if (!this.channel) return false;
    try {
      this.channel.postMessage(message);
      return true;
    } catch (e) {
      console.error('[BroadcastTransport] Broadcast error', e);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    this.activePeers.clear();
  }

  getStatus(): { active: boolean; connectedPeers: string[] } {
    return {
      active: !!this.channel,
      connectedPeers: Array.from(this.activePeers)
    };
  }
}
