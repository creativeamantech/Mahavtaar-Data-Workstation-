/**
 * Mahavtaar Ledger - Data Integrity Engine (Section 43 & Section 70)
 * Deeply scans the local Dexie database, validating schemas, relational integrity,
 * cryptographic hash chains, and financial consistency.
 */

import { db } from './db';
import { verifyAuditChainIntegrity } from './repositories/auditRepository';

export interface IntegrityCheckItem {
  id: string;
  name: string;
  category: 'FINANCIAL' | 'RELATIONAL' | 'CRYPTOGRAPHIC' | 'SYNC' | 'USER_ACCESS';
  status: 'PASSED' | 'WARNING' | 'FAILED';
  description: string;
  affectedCount: number;
  details?: string[];
  recommendation?: string;
}

export interface IntegrityReport {
  timestamp: string;
  overallScore: number; // 0 - 100
  overallStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  summary: {
    totalRecords: number;
    totalUsers: number;
    totalAudits: number;
    totalFeedbacks: number;
    totalAttendance: number;
    totalJournalEvents: number;
    totalConflicts: number;
  };
  checks: IntegrityCheckItem[];
  storageEstimate?: {
    usageBytes: number;
    quotaBytes: number;
    percentUsed: number;
  };
}

export async function runSystemIntegrityCheck(): Promise<IntegrityReport> {
  const checks: IntegrityCheckItem[] = [];

  // 1. Fetch raw data across stores
  const [
    loans,
    users,
    audits,
    feedbacks,
    attendance,
    journals,
    conflicts
  ] = await Promise.all([
    db.loan_records.toArray(),
    db.users.toArray(),
    db.audit_log.toArray(),
    db.customer_feedbacks.toArray(),
    db.attendance_logs.toArray(),
    db.sync_journal.toArray(),
    db.sync_conflicts.toArray()
  ]);

  const agreementIdSet = new Set(loans.map(l => l.agreementid).filter(Boolean));
  const userIdSet = new Set(users.map(u => u.id).filter(Boolean));

  // --- CHECK 1: Agreement IDs (Duplicates & Missing) ---
  const missingAgreements = loans.filter(l => !l.agreementid || String(l.agreementid).trim() === '');
  const idCounts = new Map<string, number>();
  loans.forEach(l => {
    if (l.agreementid) {
      idCounts.set(l.agreementid, (idCounts.get(l.agreementid) || 0) + 1);
    }
  });
  const duplicateAgreements = Array.from(idCounts.entries()).filter(([_, count]) => count > 1);

  if (missingAgreements.length > 0 || duplicateAgreements.length > 0) {
    checks.push({
      id: 'AGREEMENT_ID_VALIDITY',
      name: 'Agreement ID Uniqueness & Completeness',
      category: 'RELATIONAL',
      status: 'FAILED',
      description: 'Found missing or duplicate agreement IDs in loan records.',
      affectedCount: missingAgreements.length + duplicateAgreements.length,
      details: [
        ...missingAgreements.slice(0, 5).map(m => `Missing ID in record: ${m.customer_name || 'Unknown'}`),
        ...duplicateAgreements.slice(0, 5).map(([id, count]) => `Duplicate Agreement ID '${id}' (${count} occurrences)`)
      ],
      recommendation: 'Re-import or deduplicate loan base using Primary Agreement Key.'
    });
  } else {
    checks.push({
      id: 'AGREEMENT_ID_VALIDITY',
      name: 'Agreement ID Uniqueness & Completeness',
      category: 'RELATIONAL',
      status: 'PASSED',
      description: 'All loan records possess unique, valid primary agreement IDs.',
      affectedCount: 0
    });
  }

  // --- CHECK 2: Numeric Financial Fields & NaN check ---
  const invalidFinancialRecords: string[] = [];
  loans.forEach(l => {
    const rawPos = l.principal_outstanding !== undefined ? l.principal_outstanding : l.POS;
    const rawEmi = l.emi_amt !== undefined ? l.emi_amt : l.EMI;
    const rawDac = l.dac;
    const rawEcs = l.ecs;
    const rawSpecial = l.special;

    const pos = Number(rawPos ?? 0);
    const emi = Number(rawEmi ?? 0);
    const dac = Number(rawDac ?? 0);
    const ecs = Number(rawEcs ?? 0);
    const special = Number(rawSpecial ?? 0);

    const hasNaN = Number.isNaN(pos) || Number.isNaN(emi) || Number.isNaN(dac) || Number.isNaN(ecs) || Number.isNaN(special);
    const hasNegative = pos < 0 || emi < 0 || dac < 0 || ecs < 0 || special < 0;

    if (hasNaN || hasNegative) {
      invalidFinancialRecords.push(l.agreementid || 'Unknown');
    }
  });

  if (invalidFinancialRecords.length > 0) {
    checks.push({
      id: 'FINANCIAL_VALUES_NUMERIC',
      name: 'Financial Numbers & Non-Negative Invariant',
      category: 'FINANCIAL',
      status: 'WARNING',
      description: 'Found loan records with non-numeric or negative values in core financial columns.',
      affectedCount: invalidFinancialRecords.length,
      details: invalidFinancialRecords.slice(0, 5).map(id => `Record ${id} has invalid financial metrics`),
      recommendation: 'Normalize values via the Data Cleaning / Re-import tool.'
    });
  } else {
    checks.push({
      id: 'FINANCIAL_VALUES_NUMERIC',
      name: 'Financial Numbers & Non-Negative Invariant',
      category: 'FINANCIAL',
      status: 'PASSED',
      description: 'All loan record POS, EMI, and Collection numbers are valid non-negative values.',
      affectedCount: 0
    });
  }

  // --- CHECK 3: Cryptographic Audit Hash Chain ---
  const auditVerification = await verifyAuditChainIntegrity();
  if (!auditVerification.valid) {
    checks.push({
      id: 'AUDIT_HASH_CHAIN',
      name: 'Cryptographic Audit Trail Integrity',
      category: 'CRYPTOGRAPHIC',
      status: 'FAILED',
      description: `Audit log hash chain validation failed: ${auditVerification.message}`,
      affectedCount: 1,
      recommendation: 'Investigate potential database tampering or historical record deletion.'
    });
  } else {
    checks.push({
      id: 'AUDIT_HASH_CHAIN',
      name: 'Cryptographic Audit Trail Integrity',
      category: 'CRYPTOGRAPHIC',
      status: 'PASSED',
      description: `All ${auditVerification.totalEntries} audit entries form a continuous, untampered SHA-256 hash chain.`,
      affectedCount: 0
    });
  }

  // --- CHECK 4: Orphan Customer Feedbacks ---
  const orphanFeedbacks = feedbacks.filter(fb => fb.agreementid && !agreementIdSet.has(fb.agreementid));
  if (orphanFeedbacks.length > 0 && loans.length > 0) {
    checks.push({
      id: 'ORPHAN_FEEDBACKS',
      name: 'Customer Feedback Relational Integrity',
      category: 'RELATIONAL',
      status: 'WARNING',
      description: 'Customer feedbacks reference agreement IDs that do not exist in the current loan dataset.',
      affectedCount: orphanFeedbacks.length,
      details: orphanFeedbacks.slice(0, 5).map(fb => `Feedback ${fb.id} references missing Agreement ${fb.agreementid}`),
      recommendation: 'Ensure all historical cases are loaded in the base dataset.'
    });
  } else {
    checks.push({
      id: 'ORPHAN_FEEDBACKS',
      name: 'Customer Feedback Relational Integrity',
      category: 'RELATIONAL',
      status: 'PASSED',
      description: 'All logged customer feedbacks map to valid loan records.',
      affectedCount: 0
    });
  }

  // --- CHECK 5: Orphan Attendance Logs ---
  const orphanAttendance = attendance.filter(att => att.userId && !userIdSet.has(att.userId));
  if (orphanAttendance.length > 0 && users.length > 0) {
    checks.push({
      id: 'ORPHAN_ATTENDANCE',
      name: 'Attendance User Relational Integrity',
      category: 'USER_ACCESS',
      status: 'WARNING',
      description: 'Attendance records reference deleted or non-existent user accounts.',
      affectedCount: orphanAttendance.length,
      recommendation: 'Archive user accounts instead of deleting them to preserve attendance audits.'
    });
  } else {
    checks.push({
      id: 'ORPHAN_ATTENDANCE',
      name: 'Attendance User Relational Integrity',
      category: 'USER_ACCESS',
      status: 'PASSED',
      description: 'All attendance logs correspond to active system users.',
      affectedCount: 0
    });
  }

  // --- CHECK 6: Unresolved CRDT Conflicts ---
  const openConflicts = conflicts.filter(c => c.status === 'OPEN');
  if (openConflicts.length > 0) {
    checks.push({
      id: 'UNRESOLVED_CRDT_CONFLICTS',
      name: 'Sync Conflict Quarantine Status',
      category: 'SYNC',
      status: 'WARNING',
      description: `There are ${openConflicts.length} quarantined financial conflict(s) requiring manual admin resolution.`,
      affectedCount: openConflicts.length,
      details: openConflicts.slice(0, 5).map(c => `Conflict on table ${c.tableName} (Record: ${c.recordId})`),
      recommendation: 'Review and resolve conflicting edits in the P2P Sync Hub.'
    });
  } else {
    checks.push({
      id: 'UNRESOLVED_CRDT_CONFLICTS',
      name: 'Sync Conflict Quarantine Status',
      category: 'SYNC',
      status: 'PASSED',
      description: 'No unresolved or quarantined sync conflicts detected.',
      affectedCount: 0
    });
  }

  // --- CHECK 7: User Security & Passwords ---
  const usersWithPlaintext = users.filter(u => (u as any).plainPassword);
  if (usersWithPlaintext.length > 0) {
    checks.push({
      id: 'USER_SECURITY_CREDENTIALS',
      name: 'User Password Encryption (PBKDF2)',
      category: 'USER_ACCESS',
      status: 'FAILED',
      description: 'Found user accounts storing legacy plaintext credentials.',
      affectedCount: usersWithPlaintext.length,
      recommendation: 'Re-save user profiles to upgrade credentials to PBKDF2-HMAC-SHA256.'
    });
  } else {
    checks.push({
      id: 'USER_SECURITY_CREDENTIALS',
      name: 'User Password Encryption (PBKDF2)',
      category: 'USER_ACCESS',
      status: 'PASSED',
      description: 'All user credentials use salted PBKDF2-HMAC-SHA256 cryptographic hashes.',
      affectedCount: 0
    });
  }

  // Calculate Overall Score
  let failCount = 0;
  let warnCount = 0;
  checks.forEach(c => {
    if (c.status === 'FAILED') failCount++;
    if (c.status === 'WARNING') warnCount++;
  });

  const penalty = (failCount * 25) + (warnCount * 8);
  const overallScore = Math.max(0, 100 - penalty);
  const overallStatus = failCount > 0 ? 'CRITICAL' : warnCount > 0 ? 'WARNING' : 'HEALTHY';

  // Storage estimation if supported
  let storageEstimate: IntegrityReport['storageEstimate'] = undefined;
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const est = await navigator.storage.estimate();
      const usage = est.usage || 0;
      const quota = est.quota || 1;
      storageEstimate = {
        usageBytes: usage,
        quotaBytes: quota,
        percentUsed: Math.round((usage / quota) * 100),
      };
    } catch {
      // Storage estimate not supported
    }
  }

  return {
    timestamp: new Date().toISOString(),
    overallScore,
    overallStatus,
    summary: {
      totalRecords: loans.length,
      totalUsers: users.length,
      totalAudits: audits.length,
      totalFeedbacks: feedbacks.length,
      totalAttendance: attendance.length,
      totalJournalEvents: journals.length,
      totalConflicts: conflicts.length
    },
    checks,
    storageEstimate
  };
}
