/**
 * Mahavtaar Ledger - Customer Feedback Repository
 * Data access and mutation layer for CustomerFeedback entities with audit and sync journaling.
 */

import { db, CustomerFeedback } from '../db';
import { incrementLamportClock } from '../sync/journal';
import { getLocalDeviceIdentity } from '../sync/deviceIdentity';
import { ValidationError } from '../errors';

export interface FeedbackMutationContext {
  actorUserId?: string;
  actorName: string;
  actorRole: string;
}

export async function getFeedbackByAgreementId(agreementid: string): Promise<CustomerFeedback[]> {
  return await db.customer_feedbacks.where('agreementid').equals(agreementid).reverse().sortBy('createdAt');
}

export async function getAllFeedbacks(): Promise<CustomerFeedback[]> {
  return await db.customer_feedbacks.reverse().sortBy('createdAt');
}

export async function submitCustomerFeedback(
  feedbackData: Omit<CustomerFeedback, 'id' | 'createdAt'> & { id?: string },
  ctx: FeedbackMutationContext
): Promise<CustomerFeedback> {
  if (!feedbackData.agreementid) {
    throw new ValidationError('Agreement ID is required for customer feedback.');
  }

  const feedbackId = feedbackData.id || `FB-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const timestamp = new Date().toISOString();

  const record: CustomerFeedback = {
    ...feedbackData,
    id: feedbackId,
    createdAt: timestamp,
  };

  await db.transaction('rw', [db.customer_feedbacks, db.audit_log, db.sync_journal], async () => {
    await db.customer_feedbacks.put(record);

    await db.audit_log.add({
      id: crypto.randomUUID(),
      agreementid: feedbackData.agreementid,
      field: 'FEEDBACK_SUBMITTED',
      oldValue: '',
      newValue: JSON.stringify({
        status: record.status,
        disposition: (record as any).disposition,
        ptpDate: record.ptpDate,
        amountPaid: record.amountPaid,
      }),
      changedBy: ctx.actorName,
      createdAt: timestamp,
      source: 'CUSTOMER_FEEDBACK',
    });

    const lamport = incrementLamportClock();
    const device = getLocalDeviceIdentity();

    await db.sync_journal.add({
      id: crypto.randomUUID(),
      timestamp,
      lamport,
      tableName: 'customer_feedbacks',
      recordId: feedbackId,
      action: 'INSERT',
      data: record,
      peerId: device.peerId,
      deviceId: device.deviceId,
      status: 'QUEUED',
      hash: crypto.randomUUID(),
    });
  });

  // Non-blocking background sync to Supabase if configured
  try {
    const { getSupabaseClient, isSupabaseConfigured } = await import('../supabase');
    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      client?.from('customer_feedbacks').upsert(record, { onConflict: 'id' }).then();
    }
  } catch (e) {
    // Fail silently in background to preserve offline-first capability
  }

  return record;
}
