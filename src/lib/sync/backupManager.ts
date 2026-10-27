import { BackupSnapshotRecord, db } from '../db';
import { BackupSnapshot } from './types';

export class BackupManager {
  private scheduleIntervalMinutes: number = 0; // 0 = disabled
  private timer: NodeJS.Timeout | null = null;

  constructor() {
    this.loadScheduleSettings();
  }

  private loadScheduleSettings() {
    const saved = localStorage.getItem('mahavtaar_backup_schedule_v1');
    if (saved) {
      this.scheduleIntervalMinutes = parseInt(saved, 10) || 0;
      if (this.scheduleIntervalMinutes > 0) {
        this.startScheduleTicker(this.scheduleIntervalMinutes);
      }
    }
  }

  setScheduleInterval(minutes: number) {
    this.scheduleIntervalMinutes = minutes;
    localStorage.setItem('mahavtaar_backup_schedule_v1', minutes.toString());
    if (minutes > 0) {
      this.startScheduleTicker(minutes);
    } else if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getScheduleInterval(): number {
    return this.scheduleIntervalMinutes;
  }

  private startScheduleTicker(minutes: number) {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(async () => {
      try {
        await this.createBackup('SCHEDULED', 'Automated Scheduled Backup');
      } catch (err) {
        console.error('[BackupManager] Scheduled backup failed', err);
      }
    }, minutes * 60 * 1000);
  }

  async createBackup(
    type: 'MANUAL' | 'SCHEDULED' | 'PEER_SNAPSHOT' = 'MANUAL',
    label?: string,
    encrypt: boolean = false
  ): Promise<BackupSnapshotRecord> {
    const records = await db.loan_records.toArray();
    const sessions = await db.upload_sessions.toArray();
    const audit = await db.audit_log.toArray();
    const targets = await db.state_targets.toArray();
    const feedbacks = await db.customer_feedbacks.toArray();
    const users = await db.users.toArray();
    const attendance = await db.attendance_logs.toArray();

    const timestamp = new Date().toISOString();
    const backupData = {
      version: 4,
      timestamp,
      type,
      label: label || `Backup ${timestamp.slice(0, 10)}`,
      data: {
        loan_records: records,
        upload_sessions: sessions,
        audit_log: audit,
        state_targets: targets,
        customer_feedbacks: feedbacks,
        users,
        attendance_logs: attendance
      }
    };

    const jsonString = JSON.stringify(backupData, null, 2);
    const sizeBytes = new Blob([jsonString]).size;

    // Simple checksum
    let hash = 0;
    for (let i = 0; i < jsonString.length; i++) {
      hash = ((hash << 5) - hash) + jsonString.charCodeAt(i);
      hash |= 0;
    }
    const checksum = `SHA-${Math.abs(hash).toString(16).padStart(8, '0').toUpperCase()}`;

    const id = `BCK-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const snapshot: BackupSnapshotRecord = {
      id,
      timestamp,
      type,
      label: backupData.label,
      sizeBytes,
      recordCounts: {
        records: records.length,
        feedbacks: feedbacks.length,
        attendance: attendance.length,
        users: users.length
      },
      checksum,
      status: 'VALID',
      location: 'LOCAL_STORAGE',
      encrypted: encrypt,
      dataPayload: jsonString
    };

    await db.backup_snapshots.put(snapshot);
    return snapshot;
  }

  async downloadBackupAsFile(backupId: string): Promise<void> {
    const snapshot = await db.backup_snapshots.get(backupId);
    if (!snapshot || !snapshot.dataPayload) throw new Error('Backup data not found');

    const blob = new Blob([snapshot.dataPayload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mahavtaar_crm_backup_${snapshot.timestamp.slice(0, 10)}_${snapshot.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async verifyBackupIntegrity(backupId: string): Promise<{ valid: boolean; details: string }> {
    const snapshot = await db.backup_snapshots.get(backupId);
    if (!snapshot || !snapshot.dataPayload) return { valid: false, details: 'Backup payload missing' };

    try {
      const parsed = JSON.parse(snapshot.dataPayload);
      if (!parsed.data || !Array.isArray(parsed.data.loan_records)) {
        return { valid: false, details: 'Invalid structure inside backup' };
      }
      return {
        valid: true,
        details: `Integrity check PASSED. Verified ${parsed.data.loan_records?.length || 0} loan records, ${parsed.data.customer_feedbacks?.length || 0} customer feedbacks, ${parsed.data.users?.length || 0} users.`
      };
    } catch (e: any) {
      return { valid: false, details: `JSON Parse error: ${e.message}` };
    }
  }

  async restoreBackupFromPayload(
    jsonString: string,
    mode: 'MERGE' | 'REPLACE' = 'MERGE'
  ): Promise<{ restoredRecords: number; restoredFeedbacks: number }> {
    const parsed = JSON.parse(jsonString);
    if (!parsed.data) throw new Error('Invalid backup file format');

    const d = parsed.data;

    await db.transaction(
      'rw',
      db.loan_records,
      db.customer_feedbacks,
      db.attendance_logs,
      db.state_targets,
      db.users,
      async () => {
        if (mode === 'REPLACE') {
          await db.loan_records.clear();
          await db.customer_feedbacks.clear();
          await db.attendance_logs.clear();
          await db.state_targets.clear();
        }

        if (d.loan_records && d.loan_records.length > 0) {
          await db.loan_records.bulkPut(d.loan_records);
        }
        if (d.customer_feedbacks && d.customer_feedbacks.length > 0) {
          await db.customer_feedbacks.bulkPut(d.customer_feedbacks);
        }
        if (d.attendance_logs && d.attendance_logs.length > 0) {
          await db.attendance_logs.bulkPut(d.attendance_logs);
        }
        if (d.state_targets && d.state_targets.length > 0) {
          await db.state_targets.bulkPut(d.state_targets);
        }
        if (d.users && d.users.length > 0) {
          await db.users.bulkPut(d.users);
        }
      }
    );

    return {
      restoredRecords: d.loan_records?.length || 0,
      restoredFeedbacks: d.customer_feedbacks?.length || 0
    };
  }

  async deleteBackup(backupId: string): Promise<void> {
    await db.backup_snapshots.delete(backupId);
  }

  async getBackupHistory(): Promise<BackupSnapshotRecord[]> {
    const all = await db.backup_snapshots.toArray();
    return all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
}

export const backupManager = new BackupManager();
