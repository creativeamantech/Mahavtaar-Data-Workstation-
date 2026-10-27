/**
 * Mahavtaar Ledger - Audit Repository
 * Provides append-only querying and cryptographic integrity verification of the audit log chain.
 */

import { db, AuditEntry } from '../db';
import { verifyAuditChainIntegrity as verifyAuditChain } from '../auditTrail';

export interface AuditQueryFilter {
  agreementid?: string;
  changedBy?: string;
  source?: string;
  limit?: number;
}

export async function getAuditEntries(filter?: AuditQueryFilter): Promise<AuditEntry[]> {
  const collection = db.audit_log.orderBy('createdAt').reverse();

  if (filter?.agreementid) {
    const records = await db.audit_log.where('agreementid').equals(filter.agreementid).reverse().sortBy('createdAt');
    return filter.limit ? records.slice(0, filter.limit) : records;
  }

  if (filter?.limit) {
    return await collection.limit(filter.limit).toArray();
  }

  return await collection.toArray();
}

export async function verifyAuditChainIntegrity(): Promise<{
  valid: boolean;
  totalEntries: number;
  brokenAtIndex?: number;
  message: string;
}> {
  const entries = await db.audit_log.orderBy('createdAt').toArray();
  // Map Dexie AuditEntry to domain format if needed
  const mapped = entries.map(e => ({
    eventId: e.id,
    timestamp: e.createdAt,
    actorName: e.changedBy,
    actorRole: 'ADMIN' as const,
    operation: 'UPDATE' as const,
    entityType: 'LOAN_RECORD' as const,
    entityId: e.agreementid,
    source: (e.source || 'SYSTEM') as any,
    transactionId: e.id,
    hash: (e as any).hash || '',
    previousHash: (e as any).previousHash || '',
  }));

  const res = await verifyAuditChain(mapped as any);
  return {
    valid: res.isValid,
    totalEntries: res.totalVerified,
    brokenAtIndex: res.tamperedEntryIndex,
    message: res.isValid ? 'Audit chain verified successfully' : `Tampering detected at entry index ${res.tamperedEntryIndex}`,
  };
}
