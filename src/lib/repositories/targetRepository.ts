/**
 * Mahavtaar Ledger - State Target Repository
 * Atomic management of performance recovery targets with audit logging and sync journal.
 */

import { db, StateTarget } from '../db';
import { incrementLamportClock } from '../sync/journal';
import { getLocalDeviceIdentity } from '../sync/deviceIdentity';
import { ValidationError } from '../errors';

export async function getAllTargets(): Promise<Record<string, number>> {
  const targetsList = await db.state_targets.toArray();
  return targetsList.reduce((acc, curr) => {
    acc[curr.key] = curr.pct;
    return acc;
  }, {} as Record<string, number>);
}

export async function setTargetRecord(
  key: string,
  pct: number,
  userName: string
): Promise<StateTarget> {
  if (pct < 0 || pct > 100) {
    throw new ValidationError('Target percentage must be between 0 and 100.');
  }

  const existing = await db.state_targets.get(key);
  const timestamp = new Date().toISOString();

  const record: StateTarget = {
    key,
    pct,
    updatedBy: userName,
    updatedAt: timestamp,
  };

  await db.transaction('rw', [db.state_targets, db.audit_log, db.sync_journal], async () => {
    await db.state_targets.put(record);

    await db.audit_log.add({
      id: crypto.randomUUID(),
      agreementid: `TARGET-${key}`,
      field: 'TARGET_UPDATED',
      oldValue: existing ? String(existing.pct) : '',
      newValue: String(pct),
      changedBy: userName,
      createdAt: timestamp,
      source: 'TARGET_SETTINGS',
    });

    const lamport = incrementLamportClock();
    const device = getLocalDeviceIdentity();

    await db.sync_journal.add({
      id: crypto.randomUUID(),
      timestamp,
      lamport,
      tableName: 'state_targets',
      recordId: key,
      action: existing ? 'UPDATE' : 'INSERT',
      data: record,
      peerId: device.peerId,
      deviceId: device.deviceId,
      status: 'QUEUED',
      hash: crypto.randomUUID(),
    });
  });

  return record;
}

export async function deleteTargetRecord(
  key: string,
  userName: string
): Promise<void> {
  const existing = await db.state_targets.get(key);
  if (!existing) return;

  const timestamp = new Date().toISOString();

  await db.transaction('rw', [db.state_targets, db.audit_log, db.sync_journal], async () => {
    await db.state_targets.delete(key);

    await db.audit_log.add({
      id: crypto.randomUUID(),
      agreementid: `TARGET-${key}`,
      field: 'TARGET_DELETED',
      oldValue: String(existing.pct),
      newValue: '0',
      changedBy: userName,
      createdAt: timestamp,
      source: 'TARGET_SETTINGS',
    });

    const lamport = incrementLamportClock();
    const device = getLocalDeviceIdentity();

    await db.sync_journal.add({
      id: crypto.randomUUID(),
      timestamp,
      lamport,
      tableName: 'state_targets',
      recordId: key,
      action: 'DELETE',
      data: { key, deleted: true },
      peerId: device.peerId,
      deviceId: device.deviceId,
      status: 'QUEUED',
      hash: crypto.randomUUID(),
    });
  });
}
