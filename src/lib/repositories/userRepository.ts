/**
 * Mahavtaar Ledger - User Repository
 * Data access and mutation layer for StoredUser entities with PBKDF2 authentication and audit.
 */

import { db, StoredUser } from '../db';
import { derivePasswordHash } from '../authCrypto';
import { incrementLamportClock } from '../sync/journal';
import { getLocalDeviceIdentity } from '../sync/deviceIdentity';
import { ValidationError, AuthorizationError } from '../errors';

export interface UserMutationContext {
  actorUserId?: string;
  actorName: string;
  actorRole: 'ADMIN' | 'MANAGER' | 'EXECUTIVE' | 'VIEWER';
}

export async function getAllUsers(): Promise<StoredUser[]> {
  return await db.users.toArray();
}

export async function getUserById(id: string): Promise<StoredUser | undefined> {
  return await db.users.get(id);
}

export async function getUserByEmail(email: string): Promise<StoredUser | undefined> {
  const normalized = email.trim().toLowerCase();
  return await db.users.where('email').equalsIgnoreCase(normalized).first();
}

export async function createOrUpdateUser(
  userData: {
    id?: string;
    name: string;
    email: string;
    role: 'ADMIN' | 'MANAGER' | 'EXECUTIVE' | 'VIEWER';
    password?: string;
    permissions?: { views: string[] };
    assignedExecutiveName?: string;
    maintenanceMode?: boolean;
  },
  ctx: UserMutationContext
): Promise<StoredUser> {
  if (!userData.name || !userData.email) {
    throw new ValidationError('User name and email are required.');
  }

  const userId = userData.id || crypto.randomUUID();
  const existing = await db.users.get(userId);

  let passwordHash = existing?.passwordHash || '';
  let salt = (existing as any)?.salt || '';
  let iterations = (existing as any)?.iterations || 100000;

  if (userData.password) {
    const derived = await derivePasswordHash(userData.password);
    passwordHash = derived.hash;
    salt = derived.salt;
    iterations = derived.iterations;
  }

  const userToSave: StoredUser = {
    id: userId,
    name: userData.name.trim(),
    email: userData.email.trim().toLowerCase(),
    role: userData.role,
    passwordHash,
    permissions: userData.permissions || { views: [] },
    assignedExecutiveName: userData.assignedExecutiveName,
    maintenanceMode: userData.maintenanceMode,
    ...(salt ? { salt, iterations } : {}),
  } as any;

  // Never store plain password
  delete (userToSave as any).plainPassword;

  await db.transaction('rw', [db.users, db.audit_log, db.sync_journal], async () => {
    await db.users.put(userToSave);

    const timestamp = new Date().toISOString();
    const eventId = crypto.randomUUID();

    await db.audit_log.add({
      id: eventId,
      agreementid: `USER-${userId}`,
      field: existing ? 'USER_UPDATED' : 'USER_CREATED',
      oldValue: existing ? JSON.stringify({ role: existing.role, email: existing.email }) : '',
      newValue: JSON.stringify({ role: userToSave.role, email: userToSave.email }),
      changedBy: ctx.actorName,
      createdAt: timestamp,
      source: 'USER_MANAGEMENT',
    });

    const lamport = incrementLamportClock();
    const device = getLocalDeviceIdentity();

    await db.sync_journal.add({
      id: crypto.randomUUID(),
      timestamp,
      lamport,
      tableName: 'users',
      recordId: userId,
      action: existing ? 'UPDATE' : 'INSERT',
      data: userToSave,
      peerId: device.peerId,
      deviceId: device.deviceId,
      status: 'QUEUED',
      hash: crypto.randomUUID(),
    });
  });

  return userToSave;
}

export async function deleteUser(id: string, ctx: UserMutationContext): Promise<void> {
  if (ctx.actorRole !== 'ADMIN') {
    throw new AuthorizationError('Only Administrators can delete users.');
  }

  const existing = await db.users.get(id);
  if (!existing) return;

  await db.transaction('rw', [db.users, db.audit_log, db.sync_journal], async () => {
    await db.users.delete(id);

    const timestamp = new Date().toISOString();
    await db.audit_log.add({
      id: crypto.randomUUID(),
      agreementid: `USER-${id}`,
      field: 'USER_DELETED',
      oldValue: JSON.stringify(existing),
      newValue: 'DELETED',
      changedBy: ctx.actorName,
      createdAt: timestamp,
      source: 'USER_MANAGEMENT',
    });

    const lamport = incrementLamportClock();
    const device = getLocalDeviceIdentity();

    await db.sync_journal.add({
      id: crypto.randomUUID(),
      timestamp,
      lamport,
      tableName: 'users',
      recordId: id,
      action: 'DELETE',
      data: { id, isDeleted: true },
      peerId: device.peerId,
      deviceId: device.deviceId,
      status: 'QUEUED',
      hash: crypto.randomUUID(),
    });
  });
}
