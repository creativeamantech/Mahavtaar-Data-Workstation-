import { describe, it, expect } from 'vitest';
import {
  derivePasswordHash,
  verifyPassword,
  constantTimeEquals,
  generateSalt,
  bufferToHex,
  hexToBuffer,
} from '../authCrypto';

describe('authCrypto.ts - Enterprise PBKDF2 Web Crypto Engine', () => {
  it('generates random salts of expected byte lengths', () => {
    const salt16 = generateSalt(16);
    expect(salt16).toHaveLength(32); // 16 bytes = 32 hex chars
    const salt32 = generateSalt(32);
    expect(salt32).toHaveLength(64); // 32 bytes = 64 hex chars
    expect(salt16).not.toBe(salt32);
  });

  it('converts between Buffer and Hex correctly', () => {
    const original = new Uint8Array([0, 15, 255, 128, 64]);
    const hex = bufferToHex(original.buffer);
    expect(hex).toBe('000fff8040');
    const restored = hexToBuffer(hex);
    expect(Array.from(restored)).toEqual(Array.from(original));
  });

  it('constantTimeEquals compares strings securely', () => {
    expect(constantTimeEquals('secret123', 'secret123')).toBe(true);
    expect(constantTimeEquals('secret123', 'secret124')).toBe(false);
    expect(constantTimeEquals('short', 'longerstring')).toBe(false);
  });

  it('derives and verifies PBKDF2 passwords with unique salts', async () => {
    const password = 'CorporateSecurePassword@2026';
    const derived = await derivePasswordHash(password, undefined, 1000); // 1000 iter for fast unit test
    expect(derived.hash).toBeDefined();
    expect(derived.salt).toBeDefined();

    // Verify valid password
    const resultValid = await verifyPassword(password, derived.hash, derived.salt, 1000);
    expect(resultValid.isValid).toBe(true);

    // Reject wrong password
    const resultInvalid = await verifyPassword('WrongPassword', derived.hash, derived.salt, 1000);
    expect(resultInvalid.isValid).toBe(false);
  });

  it('detects legacy unsalted SHA-256 hashes and flags for re-hashing', async () => {
    const password = 'Admin@123';
    // Legacy SHA-256 hash of 'Admin@123'
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(password));
    const legacyHash = bufferToHex(hashBuffer);

    const verification = await verifyPassword(password, legacyHash);
    expect(verification.isValid).toBe(true);
    expect(verification.needsRehash).toBe(true);
  });
});
