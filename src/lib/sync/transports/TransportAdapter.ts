import { ConnectionType, SyncMessageEnvelope } from '../types';

export interface TransportEventHandler {
  onMessage: (message: SyncMessageEnvelope) => void;
  onPeerConnected?: (peerId: string, type: ConnectionType, metadata?: any) => void;
  onPeerDisconnected?: (peerId: string) => void;
  onError?: (err: Error) => void;
}

export interface TransportAdapter {
  readonly type: ConnectionType;
  readonly name: string;
  isSupported(): boolean;
  init(handler: TransportEventHandler): Promise<void>;
  send(targetPeerId: string, message: SyncMessageEnvelope): Promise<boolean>;
  broadcast(message: SyncMessageEnvelope): Promise<boolean>;
  disconnect(): Promise<void>;
  getStatus(): { active: boolean; connectedPeers: string[] };
}
