import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RelayFallbackTransport } from './RelayFallbackTransport';
import type { SyncMessageEnvelope } from '../types';

class MockBroadcastChannel {
  static channels = new Set<MockBroadcastChannel>();
  onmessage: ((event: MessageEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;
  readonly name: string;
  closed = false;

  constructor(name: string) {
    this.name = name;
    MockBroadcastChannel.channels.add(this);
  }

  postMessage(data: unknown) {
    for (const channel of MockBroadcastChannel.channels) {
      if (channel !== this && !channel.closed && channel.name === this.name) {
        channel.onmessage?.({ data } as MessageEvent);
      }
    }
  }

  close() {
    this.closed = true;
    MockBroadcastChannel.channels.delete(this);
  }
}

function message(senderPeerId: string, targetPeerId?: string): SyncMessageEnvelope {
  return {
    id: crypto.randomUUID(),
    type: 'HEARTBEAT',
    senderPeerId,
    senderDeviceId: `device-${senderPeerId}`,
    targetPeerId,
    timestamp: new Date().toISOString(),
    lamport: 1,
    payload: { ok: true },
  };
}

describe('RelayFallbackTransport', () => {
  const originalBroadcastChannel = globalThis.BroadcastChannel;

  beforeEach(() => {
    MockBroadcastChannel.channels.clear();
    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);
  });

  afterEach(() => {
    for (const channel of [...MockBroadcastChannel.channels]) channel.close();
    vi.unstubAllGlobals();
    if (originalBroadcastChannel) {
      vi.stubGlobal('BroadcastChannel', originalBroadcastChannel);
    }
  });

  it('delivers broadcast messages to another peer on the same origin', async () => {
    const receiver = new RelayFallbackTransport('peer-b');
    const onMessage = vi.fn();
    await receiver.init({ onMessage });

    const sender = new RelayFallbackTransport('peer-a');
    await sender.init({ onMessage: vi.fn() });

    const envelope = message('peer-a');
    expect(await sender.broadcast(envelope)).toBe(true);
    expect(onMessage).toHaveBeenCalledWith(envelope);
    expect(receiver.getStatus().connectedPeers).toContain('peer-a');

    await sender.disconnect();
    await receiver.disconnect();
  });

  it('delivers targeted messages only to the addressed peer', async () => {
    const peerB = new RelayFallbackTransport('peer-b');
    const peerC = new RelayFallbackTransport('peer-c');
    const onMessageB = vi.fn();
    const onMessageC = vi.fn();
    await peerB.init({ onMessage: onMessageB });
    await peerC.init({ onMessage: onMessageC });

    const sender = new RelayFallbackTransport('peer-a');
    await sender.init({ onMessage: vi.fn() });
    const envelope = message('peer-a', 'peer-b');

    expect(await sender.send('peer-b', envelope)).toBe(true);
    expect(onMessageB).toHaveBeenCalledTimes(1);
    expect(onMessageC).not.toHaveBeenCalled();

    await sender.disconnect();
    await peerB.disconnect();
    await peerC.disconnect();
  });

  it('returns false after disconnecting', async () => {
    const transport = new RelayFallbackTransport('peer-a');
    await transport.init({ onMessage: vi.fn() });
    await transport.disconnect();

    expect(await transport.broadcast(message('peer-a'))).toBe(false);
    expect(transport.getStatus()).toEqual({ active: false, connectedPeers: [] });
  });
});
