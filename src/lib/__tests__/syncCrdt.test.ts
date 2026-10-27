import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { detectFieldDifferences, processCRDTIncomingEntry } from '../sync/crdtEngine';
import { incrementLamportClock, getLamportClock, calculateJournalHash } from '../sync/journal';
import { getLocalDeviceIdentity } from '../sync/deviceIdentity';
import { JournalEntry } from '../sync/types';

describe('P2P Mesh Sync & CRDT Engine', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Lamport Logical Clock & Device Identity', () => {
    it('initializes and increments Lamport logical clock', () => {
      expect(getLamportClock()).toBe(0);
      const c1 = incrementLamportClock();
      expect(c1).toBe(1);
      expect(getLamportClock()).toBe(1);

      // Receiving a message with higher remote clock advances the clock
      const c2 = incrementLamportClock(10);
      expect(c2).toBe(11);
      expect(getLamportClock()).toBe(11);
    });

    it('generates consistent local device identity', () => {
      const identity1 = getLocalDeviceIdentity();
      expect(identity1.deviceId).toBeDefined();
      expect(identity1.peerId).toBeDefined();
      expect(identity1.deviceName).toBeDefined();

      const identity2 = getLocalDeviceIdentity();
      expect(identity2.deviceId).toBe(identity1.deviceId);
      expect(identity2.peerId).toBe(identity1.peerId);
    });

    it('calculates reproducible journal hashes', async () => {
      const payload = { test: 123, name: 'Mumbai Case' };
      const hash1 = await calculateJournalHash(payload);
      const hash2 = await calculateJournalHash(payload);
      expect(hash1).toBe(hash2);
      expect(typeof hash1).toBe('string');
      expect(hash1.length).toBeGreaterThan(10);
    });
  });

  describe('Field Difference Detection', () => {
    it('detects single and multiple field modifications', () => {
      const local = { customer_name: 'John Doe', emi_amt: 5000, city: 'Pune' };
      const remote = { customer_name: 'Johnathan Doe', emi_amt: 5000, city: 'Mumbai' };

      const diffs = detectFieldDifferences(local, remote);
      expect(diffs.length).toBe(2);

      const customerDiff = diffs.find(d => d.field === 'customer_name');
      expect(customerDiff).toBeDefined();
      expect(customerDiff?.localVal).toBe('John Doe');
      expect(customerDiff?.remoteVal).toBe('Johnathan Doe');

      const cityDiff = diffs.find(d => d.field === 'city');
      expect(cityDiff).toBeDefined();
      expect(cityDiff?.localVal).toBe('Pune');
      expect(cityDiff?.remoteVal).toBe('Mumbai');
    });

    it('ignores internal metadata keys like updatedAt and syncedAt', () => {
      const local = { id: '1', name: 'Test', updatedAt: '2026-08-01T00:00:00Z' };
      const remote = { id: '1', name: 'Test', updatedAt: '2026-08-02T00:00:00Z' };

      const diffs = detectFieldDifferences(local, remote);
      expect(diffs.length).toBe(0);
    });
  });

  describe('CRDT Merging Strategies', () => {
    const baseEntry: JournalEntry = {
      id: 'JRN-101',
      timestamp: new Date().toISOString(),
      lamport: 5,
      tableName: 'customer_feedbacks',
      recordId: 'AGR-999',
      action: 'INSERT',
      data: {
        agreementid: 'AGR-999',
        status: 'PTP',
        feedbackPtpDate: '2026-08-30',
        agentName: 'Remote Agent',
        ptpAmount: 12000,
        detailedFeedback: 'Promised full payment by end of month'
      },
      peerId: 'peer-remote-1',
      deviceId: 'dev-remote-1',
      status: 'QUEUED',
      syncedPeers: [],
      hash: 'hash-abc',
      retryCount: 0
    };

    it('applies new insert directly when local record does not exist', async () => {
      const result = await processCRDTIncomingEntry(baseEntry, null, 'FIELD_MERGE');
      expect(result.applied).toBe(true);
      expect(result.hasConflict).toBe(false);
      expect(result.mergedData.agreementid).toBe('AGR-999');
    });

    it('applies delete action cleanly', async () => {
      const deleteEntry: JournalEntry = {
        ...baseEntry,
        action: 'DELETE',
        data: null
      };

      const result = await processCRDTIncomingEntry(deleteEntry, { agreementid: 'AGR-999', status: 'PTP' });
      expect(result.applied).toBe(true);
      expect(result.mergedData).toBeNull();
      expect(result.hasConflict).toBe(false);
    });

    it('quarantines critical status and financial collisions safely', async () => {
      const localRecord = {
        agreementid: 'AGR-999',
        status: 'Follow Up',
        customField: 'Local Note',
        updatedAt: '2026-08-20T10:00:00Z'
      };

      const result = await processCRDTIncomingEntry(baseEntry, localRecord, 'FIELD_MERGE');
      expect(result.applied).toBe(false);
      expect(result.hasConflict).toBe(true);
      expect(result.conflictRecord).toBeDefined();
      expect(result.conflictRecord?.tableName).toBe('customer_feedbacks');
    });

    it('merges non-critical fields non-destructively when no critical collisions exist', async () => {
      const nonCriticalRemoteEntry: JournalEntry = {
        ...baseEntry,
        timestamp: '2026-08-25T12:00:00Z',
        data: {
          agreementid: 'AGR-999',
          customer_name: 'John Doe Updated',
          phone_alternate: '9876543210'
        }
      };

      const localRecord = {
        agreementid: 'AGR-999',
        customer_name: 'John Doe',
        customField: 'Local Note',
        updatedAt: '2026-08-20T10:00:00Z'
      };

      const result = await processCRDTIncomingEntry(nonCriticalRemoteEntry, localRecord, 'FIELD_MERGE');
      expect(result.applied).toBe(true);
      expect(result.hasConflict).toBe(false);
      expect(result.mergedData.customer_name).toBe('John Doe Updated');
      expect(result.mergedData.phone_alternate).toBe('9876543210');
      expect(result.mergedData.customField).toBe('Local Note');
    });

    it('supports LWW (Last-Write-Wins) timestamp strategy', async () => {
      const olderRemoteEntry: JournalEntry = {
        ...baseEntry,
        timestamp: '2026-08-01T10:00:00Z',
        data: { agreementid: 'AGR-999', status: 'Old Remote Status' }
      };

      const newerLocalRecord = {
        agreementid: 'AGR-999',
        status: 'New Local Status',
        updatedAt: '2026-08-15T12:00:00Z'
      };

      const result = await processCRDTIncomingEntry(olderRemoteEntry, newerLocalRecord, 'LWW_TIMESTAMP');
      expect(result.applied).toBe(false);
      expect(result.mergedData.status).toBe('New Local Status');
    });
  });
});
