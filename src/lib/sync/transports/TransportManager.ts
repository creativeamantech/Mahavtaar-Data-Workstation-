import { ConnectionType, NetworkMode, SyncMessageEnvelope } from '../types';
import { BroadcastChannelTransport } from './BroadcastChannelTransport';
import { RelayFallbackTransport } from './RelayFallbackTransport';
import { TransportAdapter, TransportEventHandler } from './TransportAdapter';
import { WebRTCP2PTransport } from './WebRTCP2PTransport';

export class TransportManager {
  private transports: TransportAdapter[] = [];
  private broadcastTransport: BroadcastChannelTransport;
  private webrtcTransport: WebRTCP2PTransport;
  private relayTransport: RelayFallbackTransport;
  private localPeerId: string;
  private networkMode: NetworkMode = 'ALL';
  private peerConnectionMap = new Map<string, ConnectionType>();
  private peerLatencyMap = new Map<string, number>();

  constructor(localPeerId: string) {
    this.localPeerId = localPeerId;
    this.broadcastTransport = new BroadcastChannelTransport(localPeerId);
    this.webrtcTransport = new WebRTCP2PTransport(localPeerId);
    this.relayTransport = new RelayFallbackTransport(localPeerId);

    this.transports = [this.broadcastTransport, this.webrtcTransport, this.relayTransport];
  }

  async init(handler: TransportEventHandler): Promise<void> {
    const wrappedHandler: TransportEventHandler = {
      onMessage: (msg) => {
        // Record latency if it's a heartbeat/ping response
        if (msg.type === 'HEARTBEAT_ACK' && msg.payload?.pingTimestamp) {
          const latency = Math.max(1, Date.now() - msg.payload.pingTimestamp);
          this.peerLatencyMap.set(msg.senderPeerId, latency);
        }
        handler.onMessage(msg);
      },
      onPeerConnected: (peerId, type, metadata) => {
        this.peerConnectionMap.set(peerId, type);
        handler.onPeerConnected?.(peerId, type, metadata);
      },
      onPeerDisconnected: (peerId) => {
        this.peerConnectionMap.delete(peerId);
        this.peerLatencyMap.delete(peerId);
        handler.onPeerDisconnected?.(peerId);
      },
      onError: handler.onError
    };

    for (const transport of this.transports) {
      if (transport.isSupported()) {
        await transport.init(wrappedHandler);
      }
    }
  }

  setNetworkMode(mode: NetworkMode) {
    this.networkMode = mode;
  }

  getNetworkMode(): NetworkMode {
    return this.networkMode;
  }

  getPeerConnectionType(peerId: string): ConnectionType {
    return this.peerConnectionMap.get(peerId) || 'LOCAL_LAN';
  }

  getPeerLatency(peerId: string): number {
    return this.peerLatencyMap.get(peerId) || 12;
  }

  getWebRTCTransport(): WebRTCP2PTransport {
    return this.webrtcTransport;
  }

  async send(targetPeerId: string, message: SyncMessageEnvelope): Promise<boolean> {
    if (this.networkMode === 'DISABLED') return false;

    // Try Local Broadcast first
    if (this.networkMode === 'ALL' || this.networkMode === 'LOCAL_ONLY') {
      const sent = await this.broadcastTransport.send(targetPeerId, message);
      if (sent) return true;
    }

    // Try WebRTC next
    if (this.networkMode === 'ALL' || this.networkMode === 'INTERNET_ONLY') {
      const sent = await this.webrtcTransport.send(targetPeerId, message);
      if (sent) return true;
    }

    // Fallback to Relay
    if (this.networkMode === 'ALL') {
      return await this.relayTransport.send(targetPeerId, message);
    }

    return false;
  }

  async broadcast(message: SyncMessageEnvelope): Promise<boolean> {
    if (this.networkMode === 'DISABLED') return false;

    let success = false;
    if (this.networkMode === 'ALL' || this.networkMode === 'LOCAL_ONLY') {
      const bc = await this.broadcastTransport.broadcast(message);
      if (bc) success = true;
    }

    if (this.networkMode === 'ALL' || this.networkMode === 'INTERNET_ONLY') {
      const rtc = await this.webrtcTransport.broadcast(message);
      if (rtc) success = true;
    }

    return success;
  }

  async destroy(): Promise<void> {
    for (const transport of this.transports) {
      await transport.disconnect();
    }
    this.peerConnectionMap.clear();
    this.peerLatencyMap.clear();
  }
}
