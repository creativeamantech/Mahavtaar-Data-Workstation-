import { DeviceIdentity } from './types';

const STORAGE_KEY = 'mahavtaar_device_identity_v1';

function generateRandomHex(len: number): string {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

function detectOS(): string {
  const ua = navigator.userAgent || '';
  if (/windows/i.test(ua)) return 'Windows 11/10';
  if (/android/i.test(ua)) return 'Android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
  if (/macintosh|mac os x/i.test(ua)) return 'macOS';
  if (/linux/i.test(ua)) return 'Linux';
  return 'Desktop Client';
}

function detectBrowser(): string {
  const ua = navigator.userAgent || '';
  if (/edg/i.test(ua)) return 'Edge';
  if (/chrome|crios/i.test(ua) && !/edge|opr/i.test(ua)) return 'Chrome';
  if (/firefox|fxios/i.test(ua)) return 'Firefox';
  if (/safari/i.test(ua) && !/chrome/i.test(ua)) return 'Safari';
  return 'Browser / Electron Host';
}

export function getLocalDeviceIdentity(): DeviceIdentity {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed.deviceId && parsed.peerId) {
        return parsed;
      }
    } catch {
      // Generate new if corrupted
    }
  }

  const deviceId = `DEV-${generateRandomHex(4).toUpperCase()}`;
  const peerId = `PEER-${generateRandomHex(6).toUpperCase()}`;
  const os = detectOS();
  const defaultName = os.includes('Windows') ? `Office-PC-${deviceId.slice(-4)}` : `${os}-Node-${deviceId.slice(-4)}`;

  const identity: DeviceIdentity = {
    deviceId,
    peerId,
    deviceName: defaultName,
    os,
    browser: detectBrowser(),
    appVersion: '2.4.0-P2P',
    publicKeyFingerprint: `FP-${generateRandomHex(8).toUpperCase()}`,
    createdDate: new Date().toISOString()
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  return identity;
}

export function updateLocalDeviceName(newName: string): DeviceIdentity {
  const identity = getLocalDeviceIdentity();
  identity.deviceName = newName.trim() || identity.deviceName;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  return identity;
}
