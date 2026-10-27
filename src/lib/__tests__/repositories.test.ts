import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db';
import { createOrUpdateUser, getAllUsers, deleteUser } from '../repositories/userRepository';
import { submitCustomerFeedback, getFeedbackByAgreementId } from '../repositories/feedbackRepository';
import { punchIn, punchOut, startBreak, endBreak, getTodayAttendance } from '../repositories/attendanceRepository';
import { setTargetRecord, deleteTargetRecord, getAllTargets } from '../repositories/targetRepository';

describe('Domain Repositories (Section 15 & 16)', () => {
  const adminCtx = {
    actorUserId: 'admin-1',
    actorName: 'Admin Tester',
    actorRole: 'ADMIN' as const
  };

  beforeEach(async () => {
    await db.users.clear();
    await db.customer_feedbacks.clear();
    await db.attendance_logs.clear();
    await db.state_targets.clear();
    await db.audit_log.clear();
    await db.sync_journal.clear();
  });

  describe('UserRepository', () => {
    it('creates a user with salted PBKDF2 hash and writes audit log and sync journal', async () => {
      const user = await createOrUpdateUser(
        {
          name: 'Jane Doe',
          email: 'jane@example.com',
          role: 'MANAGER',
          password: 'Password@123',
          permissions: { views: ['dashboard'] }
        },
        adminCtx
      );

      expect(user.id).toBeDefined();
      expect(user.passwordHash).toBeDefined();
      expect(user.passwordHash).not.toBe('Password@123');
      expect((user as any).plainPassword).toBeUndefined();

      const stored = await db.users.get(user.id);
      expect(stored?.name).toBe('Jane Doe');

      // Verify audit log
      const audits = await db.audit_log.toArray();
      expect(audits.length).toBe(1);
      expect(audits[0].changedBy).toBe('Admin Tester');

      // Verify sync journal
      const journals = await db.sync_journal.toArray();
      expect(journals.length).toBe(1);
      expect(journals[0].tableName).toBe('users');
      expect(journals[0].action).toBe('INSERT');
    });

    it('deletes user safely and writes tombstone journal', async () => {
      const user = await createOrUpdateUser(
        { name: 'To Delete', email: 'del@example.com', role: 'EXECUTIVE' },
        adminCtx
      );

      await deleteUser(user.id, adminCtx);
      const after = await db.users.get(user.id);
      expect(after).toBeUndefined();

      const journals = await db.sync_journal.where('action').equals('DELETE').toArray();
      expect(journals.length).toBe(1);
      expect(journals[0].recordId).toBe(user.id);
    });
  });

  describe('FeedbackRepository', () => {
    it('submits feedback with audit and sync journal entries', async () => {
      const fb = await submitCustomerFeedback(
        {
          agreementid: 'AGR-999',
          contactNumber: '9876543210',
          availability: 'AVAILABLE',
          status: 'PAID',
          amountPaid: 5000,
          agentId: 'ag-1',
          agentName: 'Agent Smith'
        },
        { actorName: 'Agent Smith', actorRole: 'EXECUTIVE' }
      );

      expect(fb.id).toBeDefined();
      expect(fb.createdAt).toBeDefined();

      const records = await getFeedbackByAgreementId('AGR-999');
      expect(records.length).toBe(1);
      expect(records[0].amountPaid).toBe(5000);
    });
  });

  describe('AttendanceRepository', () => {
    it('handles punch in and punch out cleanly', async () => {
      const today = '2026-08-27';
      const punched = await punchIn('usr-10', 'Alex Ray', today);
      expect(punched.loginTime).toBeDefined();
      expect(punched.logoutTime).toBeUndefined();

      const fetched = await getTodayAttendance('usr-10', today);
      expect(fetched?.id).toBe(punched.id);

      // Start break
      const onBreak = await startBreak(punched.id);
      expect(onBreak?.currentBreakStart).toBeDefined();

      // End break
      const breakEnded = await endBreak(punched.id);
      expect(breakEnded?.currentBreakStart).toBeUndefined();

      const out = await punchOut(punched.id);
      expect(out?.logoutTime).toBeDefined();
    });
  });

  describe('TargetRepository', () => {
    it('sets recovery target percentage atomically with audit and sync', async () => {
      await setTargetRecord('MAHARASHTRA', 85.5, 'Admin Tester');
      const targets = await getAllTargets();
      expect(targets['MAHARASHTRA']).toBe(85.5);

      const audits = await db.audit_log.where('agreementid').equals('TARGET-MAHARASHTRA').toArray();
      expect(audits.length).toBe(1);
      expect(audits[0].newValue).toBe('85.5');

      await deleteTargetRecord('MAHARASHTRA', 'Admin Tester');
      const afterDel = await getAllTargets();
      expect(afterDel['MAHARASHTRA']).toBeUndefined();
    });
  });
});
