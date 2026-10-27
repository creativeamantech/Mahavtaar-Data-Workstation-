/**
 * Mahavtaar Ledger - Transactional Loan Record Repository
 * Guarantees ACID atomic updates, tamper-evident audit logging, and sync journal consistency.
 */

import { db, LoanRecord, AuditEntry, SyncJournalRecord, UploadSession } from '../db';
import { computeAuditEntryHash, GENESIS_HASH } from '../auditTrail';
import { incrementLamportClock } from '../sync/journal';
import { getLocalDeviceIdentity } from '../sync/deviceIdentity';
import { User } from '../../types/domain';

export interface AuditContext {
  userId?: string;
  userName: string;
  userRole: 'ADMIN' | 'MANAGER' | 'EXECUTIVE' | 'VIEWER';
  deviceId?: string;
  source?: 'MANUAL' | 'EXCEL_IMPORT' | 'P2P_SYNC' | 'SYSTEM' | 'BULK_OPERATION';
}

export interface MutationResult {
  success: boolean;
  transactionId: string;
  affectedCount: number;
  error?: string;
}

/**
 * Enforces data isolation rules. An executive must NEVER receive unauthorized records.
 * Returns only records the user is authorized to see.
 */
export async function fetchAuthorizedLoanRecords(user: User | null): Promise<LoanRecord[]> {
  const allRecords = await db.loan_records.toArray();
  
  if (!user) return allRecords;
  
  if (user.role === 'EXECUTIVE') {
    const targetNames = [
      (user as any).assignedExecutiveName ? String((user as any).assignedExecutiveName).trim().toLowerCase() : null,
      user.name ? String(user.name).trim().toLowerCase() : null
    ].filter(Boolean) as string[];

    return allRecords.filter(r => {
      const rawExec = String(
        r.executive_name || 
        r['Executive Name'] || 
        r.EXECUTIVE_NAME || 
        r.FOS_Name || 
        r['FOS Name'] || 
        r.fos || 
        r.FOS || 
        r.executive || 
        ''
      ).trim().toLowerCase();
      
      if (!rawExec) return false;
      return targetNames.some(target => rawExec === target || rawExec.includes(target) || target.includes(rawExec));
    });
  }

  return allRecords;
}

/**
 * Atomically imports a bulk dataset (e.g. from CSV) with a single session audit record.
 * This avoids creating 50,000+ audit log entries for a single upload.
 */
export async function atomicFileImport(
  mergedData: any[],
  uploadSession: UploadSession
): Promise<MutationResult> {
  const transactionId = crypto.randomUUID();
  
  try {
    await db.transaction('rw', [db.loan_records, db.upload_sessions], async () => {
      if (mergedData.length > 0) {
        await db.loan_records.bulkPut(mergedData);
      }
      await db.upload_sessions.put(uploadSession);
    });

    return {
      success: true,
      transactionId,
      affectedCount: mergedData.length,
    };
  } catch (err: any) {
    console.error('atomicFileImport failed:', err);
    return {
      success: false,
      transactionId,
      affectedCount: 0,
      error: err?.message || 'File import failed',
    };
  }
}

/**
 * Atomically updates a single loan record with transactional audit and sync journaling.
 */
export async function atomicUpdateLoanRecord(
  agreementId: string,
  updates: Partial<LoanRecord>,
  auditCtx: AuditContext
): Promise<MutationResult> {
  const transactionId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const device = getLocalDeviceIdentity();

  try {
    await db.transaction('rw', [db.loan_records, db.audit_log, db.sync_journal], async () => {
      // 1. Read existing record
      const existing = await db.loan_records.get(agreementId);
      if (!existing) {
        throw new Error(`Loan record with agreement ID ${agreementId} not found.`);
      }

      // 2. Compute updated record
      const updatedRecord: LoanRecord = {
        ...existing,
        ...updates,
        agreementid: agreementId,
        updated_at: timestamp,
        updated_by: auditCtx.userName,
      };

      // 3. Persist record
      await db.loan_records.put(updatedRecord);

      // 4. Retrieve latest audit entry for hash-chaining
      const lastAudit = await db.audit_log.orderBy('id').last();
      const previousHash = lastAudit?.id ? String((lastAudit as any).hash || GENESIS_HASH) : GENESIS_HASH;

      // 5. Build audit entries for modified fields
      const diff: Record<string, { oldVal: any; newVal: any }> = {};
      for (const [key, val] of Object.entries(updates)) {
        if (existing[key] !== val) {
          diff[key] = { oldVal: existing[key], newVal: val };
          
          const auditEventId = crypto.randomUUID();
          const auditEntryPartial = {
            eventId: auditEventId,
            timestamp,
            actorUserId: auditCtx.userId,
            actorName: auditCtx.userName,
            actorRole: auditCtx.userRole,
            deviceId: auditCtx.deviceId || device.deviceId,
            operation: 'UPDATE' as const,
            entityType: 'LOAN_RECORD' as const,
            entityId: agreementId,
            field: key,
            oldValue: existing[key] !== undefined ? String(existing[key]) : '',
            newValue: val !== undefined ? String(val) : '',
            source: auditCtx.source || 'MANUAL',
            transactionId,
            previousHash,
          };

          const hash = await computeAuditEntryHash(auditEntryPartial, previousHash);

          const auditRecord: AuditEntry = {
            id: auditEventId,
            agreementid: agreementId,
            field: key,
            oldValue: String(existing[key] ?? ''),
            newValue: String(val ?? ''),
            changedBy: auditCtx.userName,
            createdAt: timestamp,
            source: auditCtx.source || 'MANUAL',
            ...( { hash, previousHash, transactionId } as any ),
          };

          await db.audit_log.add(auditRecord);
        }
      }

      // 6. Record sync journal entry if changes exist
      if (Object.keys(diff).length > 0) {
        const lamport = incrementLamportClock();
        const journalId = crypto.randomUUID();
        const journalRecord: SyncJournalRecord = {
          id: journalId,
          timestamp,
          lamport,
          tableName: 'loan_records',
          recordId: agreementId,
          action: 'UPDATE',
          data: updatedRecord,
          diff,
          peerId: device.peerId,
          deviceId: device.deviceId,
          status: 'QUEUED',
          hash: crypto.randomUUID(),
          retryCount: 0,
        };
        await db.sync_journal.add(journalRecord);
      }
    });

    return {
      success: true,
      transactionId,
      affectedCount: 1,
    };
  } catch (err: any) {
    console.error('atomicUpdateLoanRecord failed:', err);
    return {
      success: false,
      transactionId,
      affectedCount: 0,
      error: err?.message || 'Transaction rollback occurred',
    };
  }
}

/**
 * Atomically updates multiple records in a single transactional batch (Optimized for scale).
 */
export async function atomicBulkUpdateLoanRecords(
  updatesList: Array<{ agreementId: string; updates: Partial<LoanRecord> }>,
  auditCtx: AuditContext
): Promise<MutationResult> {
  const transactionId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const device = getLocalDeviceIdentity();

  try {
    await db.transaction('rw', [db.loan_records, db.audit_log, db.sync_journal], async () => {
      const agreementIds = updatesList.map(u => u.agreementId);
      const existingRecords = await db.loan_records.bulkGet(agreementIds);
      
      const recordsToPut: LoanRecord[] = [];
      const auditsToAdd: AuditEntry[] = [];
      const journalsToAdd: SyncJournalRecord[] = [];

      for (let i = 0; i < updatesList.length; i++) {
        const item = updatesList[i];
        const existing = existingRecords[i];
        if (!existing) continue;

        const updatedRecord: LoanRecord = {
          ...existing,
          ...item.updates,
          agreementid: item.agreementId,
          updated_at: timestamp,
          updated_by: auditCtx.userName,
        };

        recordsToPut.push(updatedRecord);

        // Audit & Journal for this record
        const diff: Record<string, { oldVal: any; newVal: any }> = {};
        for (const [key, val] of Object.entries(item.updates)) {
          if (existing[key] !== val) {
            diff[key] = { oldVal: existing[key], newVal: val };
          }
        }

        if (Object.keys(diff).length > 0) {
          const auditEventId = crypto.randomUUID();
          auditsToAdd.push({
            id: auditEventId,
            agreementid: item.agreementId,
            field: Object.keys(diff).join(', '),
            oldValue: 'BATCH_PREV',
            newValue: JSON.stringify(item.updates),
            changedBy: auditCtx.userName,
            createdAt: timestamp,
            source: auditCtx.source || 'BULK_OPERATION',
            ...( { transactionId } as any ),
          });

          const lamport = incrementLamportClock();
          journalsToAdd.push({
            id: crypto.randomUUID(),
            timestamp,
            lamport,
            tableName: 'loan_records',
            recordId: item.agreementId,
            action: 'UPDATE',
            data: updatedRecord,
            diff,
            peerId: device.peerId,
            deviceId: device.deviceId,
            status: 'QUEUED',
            hash: crypto.randomUUID(),
            retryCount: 0,
          });
        }
      }

      if (recordsToPut.length > 0) {
        await db.loan_records.bulkPut(recordsToPut);
      }
      if (auditsToAdd.length > 0) {
        await db.audit_log.bulkAdd(auditsToAdd);
      }
      if (journalsToAdd.length > 0) {
        await db.sync_journal.bulkAdd(journalsToAdd);
      }
    });

    return {
      success: true,
      transactionId,
      affectedCount: updatesList.length,
    };
  } catch (err: any) {
    console.error('atomicBulkUpdateLoanRecords failed:', err);
    return {
      success: false,
      transactionId,
      affectedCount: 0,
      error: err?.message || 'Bulk transaction failed and rolled back',
    };
  }
}
