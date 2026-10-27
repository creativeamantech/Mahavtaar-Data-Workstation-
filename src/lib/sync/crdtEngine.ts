import { db, SyncConflictRecord } from '../db';
import { ConflictFieldDiff, ConflictStrategy, JournalEntry } from './types';

export interface CRDTMergeResult {
  applied: boolean;
  mergedData: any;
  hasConflict: boolean;
  conflictRecord?: SyncConflictRecord;
}

export function detectFieldDifferences(localData: any, remoteData: any): ConflictFieldDiff[] {
  if (!localData || !remoteData) return [];
  const allKeys = new Set([...Object.keys(localData), ...Object.keys(remoteData)]);
  const diffs: ConflictFieldDiff[] = [];

  // Ignore internal metadata fields
  const ignoredKeys = new Set(['updatedAt', 'lastModified', '_syncId', 'syncedAt']);

  for (const key of allKeys) {
    if (ignoredKeys.has(key)) continue;
    const localVal = localData[key];
    const remoteVal = remoteData[key];

    // Loose equality check for primitive / JSON structures
    const localStr = typeof localVal === 'object' ? JSON.stringify(localVal) : String(localVal ?? '');
    const remoteStr = typeof remoteVal === 'object' ? JSON.stringify(remoteVal) : String(remoteVal ?? '');

    if (localStr !== remoteStr) {
      diffs.push({
        field: key,
        localVal,
        remoteVal
      });
    }
  }

  return diffs;
}

export async function processCRDTIncomingEntry(
  entry: JournalEntry,
  currentLocalRecord: any,
  strategy: ConflictStrategy = 'FIELD_MERGE'
): Promise<CRDTMergeResult> {
  const { tableName, recordId, action, data, timestamp: remoteTimestamp, lamport: remoteLamport, peerId: remotePeerId } = entry;

  // Case 1: Record does not exist locally -> direct apply
  if (!currentLocalRecord) {
    if (action === 'DELETE') {
      return { applied: false, mergedData: null, hasConflict: false };
    }
    return { applied: true, mergedData: data, hasConflict: false };
  }

  // Case 2: Incoming action is DELETE
  if (action === 'DELETE') {
    return { applied: true, mergedData: null, hasConflict: false };
  }

  // Case 3: Both local and remote exist -> check field differences
  const diffs = detectFieldDifferences(currentLocalRecord, data);
  if (diffs.length === 0) {
    // Exact match, no merge needed
    return { applied: false, mergedData: currentLocalRecord, hasConflict: false };
  }

  // Determine timestamps
  const localTimestamp = currentLocalRecord.updatedAt || currentLocalRecord.createdAt || new Date(0).toISOString();
  const remoteTime = new Date(remoteTimestamp).getTime();
  const localTime = new Date(localTimestamp).getTime();

  // If strategy is LWW (Last-Write-Wins)
  if (strategy === 'LWW') {
    if (remoteTime >= localTime) {
      return { applied: true, mergedData: data, hasConflict: false };
    } else {
      return { applied: false, mergedData: currentLocalRecord, hasConflict: false };
    }
  }

  // If strategy is FIELD_MERGE
  if (strategy === 'FIELD_MERGE') {
    // 1. Mandatory Conflict Fields (Category C)
    const financialCriticalFields = [
      'dac', 'provisional_dac', 'ecs', 'special', 'new_total', 'settlement_approved_amt',
      'last_month_paid_flag', 'target_pct', 'permissions', 'role', 'status'
    ];
    
    const hasCriticalCollision = diffs.some(d => financialCriticalFields.includes(d.field));

    // If there is ANY conflicting difference in a critical financial field, we MUST quarantine it
    if (hasCriticalCollision) {
      const conflictId = `CONF-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const conflictRecord: SyncConflictRecord = {
        id: conflictId,
        tableName,
        recordId,
        localData: currentLocalRecord,
        remoteData: data,
        fieldConflicts: diffs,
        localTimestamp,
        remoteTimestamp,
        localPeerId: 'LOCAL_PEER',
        remotePeerId,
        status: 'OPEN',
        detectedAt: new Date().toISOString()
      };

      await db.sync_conflicts.put(conflictRecord);

      return {
        applied: false,
        mergedData: currentLocalRecord,
        hasConflict: true,
        conflictRecord
      };
    }

    // 2. Safe descriptive fields (Category A / B)
    // For non-critical metadata (e.g., phone numbers, notes, generic flags), use LWW field-level resolution
    if (remoteTime >= localTime) {
      const merged = { ...currentLocalRecord, ...data };
      return { applied: true, mergedData: merged, hasConflict: false };
    } else {
      // Local is newer, keep local fields but allow remote to backfill missing fields
      const merged = { ...data, ...currentLocalRecord };
      return { applied: false, mergedData: merged, hasConflict: false };
    }
  }

  // Fallback default: LWW
  return {
    applied: remoteTime >= localTime,
    mergedData: remoteTime >= localTime ? data : currentLocalRecord,
    hasConflict: false
  };
}

export async function resolveConflictRecord(
  conflictId: string,
  resolution: 'KEEP_LOCAL' | 'KEEP_REMOTE' | 'FIELD_MERGE' | 'MANUAL',
  customMergedData?: any,
  resolvedBy: string = 'Admin'
): Promise<any> {
  const conflict = await db.sync_conflicts.get(conflictId);
  if (!conflict) throw new Error('Conflict record not found');

  let finalData: any;
  if (resolution === 'KEEP_LOCAL') {
    finalData = conflict.localData;
  } else if (resolution === 'KEEP_REMOTE') {
    finalData = conflict.remoteData;
  } else if (resolution === 'FIELD_MERGE') {
    finalData = { ...conflict.localData, ...conflict.remoteData };
  } else if (resolution === 'MANUAL') {
    finalData = customMergedData || { ...conflict.localData, ...conflict.remoteData };
  }

  // Apply to DB table
  const table = (db as any)[conflict.tableName];
  if (table && finalData) {
    await table.put(finalData);
  }

  conflict.status = 'RESOLVED';
  conflict.resolvedAt = new Date().toISOString();
  conflict.resolutionStrategy = resolution;
  conflict.resolvedData = finalData;
  conflict.resolvedBy = resolvedBy;

  await db.sync_conflicts.put(conflict);
  return finalData;
}
