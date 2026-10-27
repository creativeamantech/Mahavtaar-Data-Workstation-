/**
 * Mahavtaar Ledger - Cryptographic Audit Trail Engine
 * Guarantees tamper-evident audit logging with verifiable SHA-256 hash chains.
 */

import { sha256Fallback } from './authCrypto';
import { AuditEntry } from '../types/domain';

export const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Computes cryptographic hash of an audit entry linked to the previous entry hash
 */
export async function computeAuditEntryHash(
  entry: Omit<AuditEntry, 'hash'>,
  previousHash: string = GENESIS_HASH
): Promise<string> {
  const payload = JSON.stringify({
    eventId: entry.eventId,
    timestamp: entry.timestamp,
    actorUserId: entry.actorUserId || '',
    actorName: entry.actorName,
    actorRole: entry.actorRole,
    deviceId: entry.deviceId || '',
    operation: entry.operation,
    entityType: entry.entityType,
    entityId: entry.entityId,
    field: entry.field || '',
    oldValue: entry.oldValue ?? null,
    newValue: entry.newValue ?? null,
    source: entry.source,
    transactionId: entry.transactionId,
    previousHash,
  });

  return await sha256Fallback(previousHash + ':' + payload);
}

/**
 * Verifies the integrity of an entire sequence of audit log entries
 */
export async function verifyAuditChainIntegrity(
  entries: AuditEntry[]
): Promise<{
  isValid: boolean;
  tamperedEntryIndex?: number;
  expectedHash?: string;
  actualHash?: string;
  totalVerified: number;
}> {
  if (!entries || entries.length === 0) {
    return { isValid: true, totalVerified: 0 };
  }

  // Sort ascending by timestamp / sequence if needed
  let expectedPrevHash = GENESIS_HASH;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    
    // Check previousHash pointer
    if (entry.previousHash && entry.previousHash !== expectedPrevHash) {
      return {
        isValid: false,
        tamperedEntryIndex: i,
        expectedHash: expectedPrevHash,
        actualHash: entry.previousHash,
        totalVerified: i,
      };
    }

    // Re-calculate entry hash
    const recomputedHash = await computeAuditEntryHash(entry, expectedPrevHash);
    if (recomputedHash !== entry.hash) {
      return {
        isValid: false,
        tamperedEntryIndex: i,
        expectedHash: recomputedHash,
        actualHash: entry.hash,
        totalVerified: i,
      };
    }

    expectedPrevHash = entry.hash;
  }

  return {
    isValid: true,
    totalVerified: entries.length,
  };
}
