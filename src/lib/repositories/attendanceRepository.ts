/**
 * Mahavtaar Ledger - Attendance Repository
 * Manages punch in/out, break records, and working session tracking with atomic sync journal.
 */

import { db, AttendanceLog } from '../db';
import { incrementLamportClock } from '../sync/journal';
import { getLocalDeviceIdentity } from '../sync/deviceIdentity';
import { ValidationError } from '../errors';

export async function getAttendanceByUserId(userId: string): Promise<AttendanceLog[]> {
  return await db.attendance_logs.where('userId').equals(userId).reverse().sortBy('date');
}

export async function getAllAttendance(): Promise<AttendanceLog[]> {
  return await db.attendance_logs.reverse().sortBy('date');
}

export async function getTodayAttendance(userId: string, todayDateStr: string): Promise<AttendanceLog | undefined> {
  const records = await db.attendance_logs.where('userId').equals(userId).toArray();
  return records.find(r => r.date === todayDateStr);
}

export async function punchIn(
  userId: string,
  userName: string,
  dateStr: string
): Promise<AttendanceLog> {
  if (!userId || !userName) {
    throw new ValidationError('User ID and User Name are required for attendance punch in.');
  }

  const existing = await getTodayAttendance(userId, dateStr);
  const nowIso = new Date().toISOString();

  if (existing) {
    return existing;
  }

  const newLog: AttendanceLog = {
    id: `ATT-${userId}-${dateStr}`,
    userId,
    userName,
    date: dateStr,
    loginTime: nowIso,
    breakDuration: 0,
  };

  await db.transaction('rw', [db.attendance_logs, db.sync_journal], async () => {
    await db.attendance_logs.put(newLog);

    const lamport = incrementLamportClock();
    const device = getLocalDeviceIdentity();

    await db.sync_journal.add({
      id: crypto.randomUUID(),
      timestamp: nowIso,
      lamport,
      tableName: 'attendance_logs',
      recordId: newLog.id,
      action: 'INSERT',
      data: newLog,
      peerId: device.peerId,
      deviceId: device.deviceId,
      status: 'QUEUED',
      hash: crypto.randomUUID(),
    });
  });

  return newLog;
}

export async function punchOut(
  attendanceId: string
): Promise<AttendanceLog | undefined> {
  const existing = await db.attendance_logs.get(attendanceId);
  if (!existing) return undefined;

  const nowIso = new Date().toISOString();
  const updatedLog: AttendanceLog = {
    ...existing,
    logoutTime: nowIso,
  };

  await db.transaction('rw', [db.attendance_logs, db.sync_journal], async () => {
    await db.attendance_logs.put(updatedLog);

    const lamport = incrementLamportClock();
    const device = getLocalDeviceIdentity();

    await db.sync_journal.add({
      id: crypto.randomUUID(),
      timestamp: nowIso,
      lamport,
      tableName: 'attendance_logs',
      recordId: updatedLog.id,
      action: 'UPDATE',
      data: updatedLog,
      peerId: device.peerId,
      deviceId: device.deviceId,
      status: 'QUEUED',
      hash: crypto.randomUUID(),
    });
  });

  return updatedLog;
}

export async function startBreak(
  attendanceId: string
): Promise<AttendanceLog | undefined> {
  const existing = await db.attendance_logs.get(attendanceId);
  if (!existing || existing.currentBreakStart) return existing;

  const nowIso = new Date().toISOString();
  const updatedLog: AttendanceLog = {
    ...existing,
    currentBreakStart: nowIso,
  };

  await db.transaction('rw', [db.attendance_logs, db.sync_journal], async () => {
    await db.attendance_logs.put(updatedLog);

    const lamport = incrementLamportClock();
    const device = getLocalDeviceIdentity();

    await db.sync_journal.add({
      id: crypto.randomUUID(),
      timestamp: nowIso,
      lamport,
      tableName: 'attendance_logs',
      recordId: updatedLog.id,
      action: 'UPDATE',
      data: updatedLog,
      peerId: device.peerId,
      deviceId: device.deviceId,
      status: 'QUEUED',
      hash: crypto.randomUUID(),
    });
  });

  return updatedLog;
}

export async function endBreak(
  attendanceId: string
): Promise<AttendanceLog | undefined> {
  const existing = await db.attendance_logs.get(attendanceId);
  if (!existing || !existing.currentBreakStart) return existing;

  const nowIso = new Date().toISOString();
  const breakStartMs = new Date(existing.currentBreakStart).getTime();
  const currentBreakMins = Math.max(0, Math.round((new Date().getTime() - breakStartMs) / 60000));
  const newTotalBreak = (existing.breakDuration || 0) + currentBreakMins;

  const updatedLog: AttendanceLog = {
    ...existing,
    currentBreakStart: undefined,
    breakDuration: newTotalBreak,
  };

  await db.transaction('rw', [db.attendance_logs, db.sync_journal], async () => {
    await db.attendance_logs.put(updatedLog);

    const lamport = incrementLamportClock();
    const device = getLocalDeviceIdentity();

    await db.sync_journal.add({
      id: crypto.randomUUID(),
      timestamp: nowIso,
      lamport,
      tableName: 'attendance_logs',
      recordId: updatedLog.id,
      action: 'UPDATE',
      data: updatedLog,
      peerId: device.peerId,
      deviceId: device.deviceId,
      status: 'QUEUED',
      hash: crypto.randomUUID(),
    });
  });

  return updatedLog;
}
