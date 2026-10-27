import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { runSystemIntegrityCheck } from '../integrityChecker';
import { db } from '../db';
import { derivePasswordHash } from '../authCrypto';

describe('Data Integrity Diagnostics Engine (Section 43 & Section 70)', () => {
  beforeEach(async () => {
    await db.loan_records.clear();
    await db.users.clear();
    await db.audit_log.clear();
    await db.customer_feedbacks.clear();
    await db.attendance_logs.clear();
    await db.sync_journal.clear();
    await db.sync_conflicts.clear();
  });

  it('reports HEALTHY score for pristine database', async () => {
    const report = await runSystemIntegrityCheck();
    expect(report.overallStatus).toBe('HEALTHY');
    expect(report.overallScore).toBe(100);
    expect(report.checks.length).toBeGreaterThan(0);
  });

  it('detects missing or duplicate agreement IDs and reports failure', async () => {
    await db.loan_records.bulkPut([
      { agreementid: 'AGR-001', customer_name: 'Customer 1', principal_outstanding: 50000, emi_amt: 2500 },
      { agreementid: '', customer_name: 'Invalid Empty ID', principal_outstanding: 30000, emi_amt: 1500 } as any,
    ]);

    const report = await runSystemIntegrityCheck();
    expect(report.overallStatus).toBe('CRITICAL');
    const agreementCheck = report.checks.find(c => c.id === 'AGREEMENT_ID_VALIDITY');
    expect(agreementCheck?.status).toBe('FAILED');
  });

  it('detects invalid NaN financial figures', async () => {
    await db.loan_records.bulkPut([
      { agreementid: 'AGR-002', customer_name: 'Valid Customer', principal_outstanding: NaN, emi_amt: 2500 } as any,
    ]);

    const report = await runSystemIntegrityCheck();
    const financialCheck = report.checks.find(c => c.id === 'FINANCIAL_VALUES_NUMERIC');
    expect(financialCheck?.status).toBe('WARNING');
  });

  it('detects legacy plaintext credentials on users', async () => {
    await db.users.put({
      id: 'usr-1',
      name: 'Legacy User',
      email: 'legacy@example.com',
      role: 'ADMIN',
      plainPassword: 'password123',
      passwordHash: '',
      permissions: { views: [] }
    });

    const report = await runSystemIntegrityCheck();
    const userSecCheck = report.checks.find(c => c.id === 'USER_SECURITY_CREDENTIALS');
    expect(userSecCheck?.status).toBe('FAILED');
  });

  it('passes security audit when user password uses PBKDF2 hash', async () => {
    const derived = await derivePasswordHash('secure_pass_123');
    await db.users.put({
      id: 'usr-2',
      name: 'Modern User',
      email: 'modern@example.com',
      role: 'ADMIN',
      passwordHash: derived.hash,
      salt: derived.salt,
      iterations: derived.iterations,
      permissions: { views: [] }
    } as any);

    const report = await runSystemIntegrityCheck();
    const userSecCheck = report.checks.find(c => c.id === 'USER_SECURITY_CREDENTIALS');
    expect(userSecCheck?.status).toBe('PASSED');
  });
});
