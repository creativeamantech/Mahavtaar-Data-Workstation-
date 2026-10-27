import { describe, it, expect } from 'vitest';
import { computeAuditEntryHash, verifyAuditChainIntegrity, GENESIS_HASH } from '../auditTrail';
import { AuditEntry } from '../../types/domain';

describe('auditTrail.ts - Cryptographic Hash-Chain Verification', () => {
  it('computes consistent hashes for identical payloads', async () => {
    const entry: Omit<AuditEntry, 'hash'> = {
      eventId: 'evt-001',
      timestamp: '2026-08-27T10:00:00.000Z',
      actorUserId: 'user-admin',
      actorName: 'Admin User',
      actorRole: 'ADMIN',
      operation: 'UPDATE',
      entityType: 'LOAN_RECORD',
      entityId: 'AGR-100',
      field: 'dac',
      oldValue: '1000',
      newValue: '5000',
      source: 'MANUAL',
      transactionId: 'txn-1',
      previousHash: GENESIS_HASH,
    };

    const hash1 = await computeAuditEntryHash(entry, GENESIS_HASH);
    const hash2 = await computeAuditEntryHash(entry, GENESIS_HASH);
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64); // SHA-256 hex length
  });

  it('verifies a valid hash-chained sequence of audit entries', async () => {
    const e1Base: Omit<AuditEntry, 'hash'> = {
      eventId: 'evt-1',
      timestamp: '2026-08-27T10:00:00.000Z',
      actorName: 'Admin',
      actorRole: 'ADMIN',
      operation: 'CREATE',
      entityType: 'LOAN_RECORD',
      entityId: 'AGR-1',
      source: 'MANUAL',
      transactionId: 'tx-1',
      previousHash: GENESIS_HASH,
    };
    const hash1 = await computeAuditEntryHash(e1Base, GENESIS_HASH);
    const entry1: AuditEntry = { ...e1Base, hash: hash1 };

    const e2Base: Omit<AuditEntry, 'hash'> = {
      eventId: 'evt-2',
      timestamp: '2026-08-27T10:05:00.000Z',
      actorName: 'Admin',
      actorRole: 'ADMIN',
      operation: 'UPDATE',
      entityType: 'LOAN_RECORD',
      entityId: 'AGR-1',
      field: 'dac',
      oldValue: '0',
      newValue: '4000',
      source: 'MANUAL',
      transactionId: 'tx-2',
      previousHash: hash1,
    };
    const hash2 = await computeAuditEntryHash(e2Base, hash1);
    const entry2: AuditEntry = { ...e2Base, hash: hash2 };

    const check = await verifyAuditChainIntegrity([entry1, entry2]);
    expect(check.isValid).toBe(true);
    expect(check.totalVerified).toBe(2);
  });

  it('detects tampering in audit payload', async () => {
    const e1Base: Omit<AuditEntry, 'hash'> = {
      eventId: 'evt-1',
      timestamp: '2026-08-27T10:00:00.000Z',
      actorName: 'Admin',
      actorRole: 'ADMIN',
      operation: 'CREATE',
      entityType: 'LOAN_RECORD',
      entityId: 'AGR-1',
      source: 'MANUAL',
      transactionId: 'tx-1',
      previousHash: GENESIS_HASH,
    };
    const hash1 = await computeAuditEntryHash(e1Base, GENESIS_HASH);
    const entry1: AuditEntry = { ...e1Base, hash: hash1 };

    // Tampered entry2: malicious modification of newValue without valid hash
    const tamperedEntry2: AuditEntry = {
      eventId: 'evt-2',
      timestamp: '2026-08-27T10:05:00.000Z',
      actorName: 'Attacker',
      actorRole: 'ADMIN',
      operation: 'UPDATE',
      entityType: 'LOAN_RECORD',
      entityId: 'AGR-1',
      field: 'dac',
      oldValue: '0',
      newValue: '999999', // Malicious change
      source: 'MANUAL',
      transactionId: 'tx-2',
      previousHash: hash1,
      hash: 'fake_hash_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    };

    const check = await verifyAuditChainIntegrity([entry1, tamperedEntry2]);
    expect(check.isValid).toBe(false);
    expect(check.tamperedEntryIndex).toBe(1);
  });
});
