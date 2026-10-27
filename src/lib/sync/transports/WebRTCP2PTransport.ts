import { ConnectionType, SyncMessageEnvelope } from '../types';
import { TransportAdapter, TransportEventHandler } from './TransportAdapter';

export interface WebRTCConnectionOffer {
  senderPeerId: string;
  targetPeerId: string;
  sdp: RTCSessionDescriptionInit;
  iceCandidates?: RTCIceCandidateInit[];
}

export class WebRTCP2PTransport implements TransportAdapter {
  readonly type: ConnectionType = 'INTERNET_P2P';
  readonly name = 'WebRTC P2P DataChannel';
  private handler: TransportEventHandler | null = null;
  private peerConnections = new Map<string, RTCPeerConnection>();
  private dataChannels = new Map<string, RTCDataChannel>();
  private localPeerId: string = '';
  private isAvailable: boolean = false;

  constructor(localPeerId: string) {
    this.localPeerId = localPeerId;
    this.isAvailable = typeof window !== 'undefined' && 'RTCPeerConnection' in window;
  }

  isSupported(): boolean {
    return this.isAvailable;
  }

  async init(handler: TransportEventHandler): Promise<void> {
    this.handler = handler;
  }

  /**
   * Create an offer for establishing a P2P DataChannel to another peer
   */
  async createOfferForPeer(targetPeerId: string): Promise<string> {
    if (!this.isSupported()) throw new Error('WebRTC not supported on this platform');

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    this.peerConnections.set(targetPeerId, pc);

    const dc = pc.createDataChannel('mahavtaar_sync_channel', {
      ordered: true
    });
    this.setupDataChannel(targetPeerId, dc);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Wait briefly for ICE gathering
    await new Promise<void>(resolve => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
      } else {
        const checkState = () => {
          if (pc.iceGatheringState === 'complete') {
            pc.removeEventListener('icegatheringstatechange', checkState);
            resolve();
          }
        };
        pc.addEventListener('icegatheringstatechange', checkState);
        setTimeout(resolve, 1500); // 1.5s timeout for fast signaling
      }
    });

    const payload = {
      senderPeerId: this.localPeerId,
      targetPeerId,
      sdp: pc.localDescription
    };

    return btoa(JSON.stringify(payload));
  }

  /**
   * Accept an incoming offer and generate an answer
   */
  async acceptOfferAndCreateAnswer(offerBase64: string): Promise<string> {
    if (!this.isSupported()) throw new Error('WebRTC not supported');

    const parsed = JSON.parse(atob(offerBase64));
    const targetPeerId = parsed.senderPeerId;

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    this.peerConnections.set(targetPeerId, pc);

    pc.ondatachannel = (event) => {
      this.setupDataChannel(targetPeerId, event.channel);
    };

    await pc.setRemoteDescription(new RTCSessionDescription(parsed.sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    // Wait for ICE
    await new Promise<void>(resolve => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
      } else {
        const checkState = () => {
          if (pc.iceGatheringState === 'complete') {
            pc.removeEventListener('icegatheringstatechange', checkState);
            resolve();
          }
        };
        pc.addEventListener('icegatheringstatechange', checkState);
        setTimeout(resolve, 1500);
      }
    });

    const payload = {
      senderPeerId: this.localPeerId,
      targetPeerId,
      sdp: pc.localDescription
    };

    return btoa(JSON.stringify(payload));
  }

  /**
   * Complete handshake with received answer
   */
  async acceptAnswer(answerBase64: string): Promise<void> {
    const parsed = JSON.parse(atob(answerBase64));
    const targetPeerId = parsed.senderPeerId;
    const pc = this.peerConnections.get(targetPeerId);
    if (!pc) throw new Error('No pending peer connection found for ' + targetPeerId);

    await pc.setRemoteDescription(new RTCSessionDescription(parsed.sdp));
  }

  private setupDataChannel(peerId: string, dc: RTCDataChannel) {
    this.dataChannels.set(peerId, dc);

    dc.onopen = () => {
      this.handler?.onPeerConnected?.(peerId, this.type);
    };

    dc.onclose = () => {
      this.dataChannels.delete(peerId);
      this.handler?.onPeerDisconnected?.(peerId);
    };

    dc.onmessage = (event) => {
      try {
        const envelope: SyncMessageEnvelope = JSON.parse(event.data);
        this.handler?.onMessage(envelope);
      } catch (err) {
        console.error('[WebRTC] message receive error', err);
      }
    };
  }

  async send(targetPeerId: string, message: SyncMessageEnvelope): Promise<boolean> {
    const dc = this.dataChannels.get(targetPeerId);
    if (!dc || dc.readyState !== 'open') return false;

    try {
      dc.send(JSON.stringify(message));
      return true;
    } catch (e) {
      console.error('[WebRTC] Send error', e);
      return false;
    }
  }

  async broadcast(message: SyncMessageEnvelope): Promise<boolean> {
    let anySuccess = false;
    for (const [peerId, dc] of this.dataChannels.entries()) {
      if (dc.readyState === 'open') {
        try {
          dc.send(JSON.stringify(message));
          anySuccess = true;
        } catch {
          // Continue to next
        }
      }
    }
    return anySuccess;
  }

  async disconnect(): Promise<void> {
    for (const dc of this.dataChannels.values()) {
      try { dc.close(); } catch { /* ignore close error */ }
    }
    for (const pc of this.peerConnections.values()) {
      try { pc.close(); } catch { /* ignore close error */ }
    }
    this.dataChannels.clear();
    this.peerConnections.clear();
  }

  getStatus(): { active: boolean; connectedPeers: string[] } {
    const active = Array.from(this.dataChannels.entries())
      .filter(([_, dc]) => dc.readyState === 'open')
      .map(([peerId]) => peerId);

    return {
      active: active.length > 0,
      connectedPeers: active
    };
  }
}
