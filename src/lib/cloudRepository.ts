/**
 * Cloud-first repository. These functions never fall back to IndexedDB.
 * Supabase RLS remains the authorization boundary; UI role checks are not security controls.
 */
import { getSupabaseClient } from './supabase';
import type { LoanRecord, StateTarget, UploadSession, AuditEntry } from './db';

const CORE_LOAN_COLUMNS = new Set([
  'agreementid', 'customer_name', 'customer_no', 'mobile', 'city', 'state',
  'pos', 'bom_pos', 'tos', 'bom_bkt', 'cur_bkt', 'allocated_agency',
  'executive_name', 'last_action', 'last_disposition', 'ptp_date', 'status',
  'total_paid', 'waiver_amount', 'created_at', 'updated_at',
]);

function requireClient() {
  const client = getSupabaseClient();
  if (!client) throw new Error('Cloud mode requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  return client;
}

async function requireSignedInClient() {
  const client = requireClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error('Your cloud session has expired. Sign in again.');
  const role = data.user.app_metadata?.role;
  if (!['ADMIN', 'MANAGER', 'EXECUTIVE', 'VIEWER'].includes(role)) {
    throw new Error('Your Supabase account has no valid administrator-assigned role.');
  }
  return { client, user: data.user };
}

function toCloudLoan(row: LoanRecord): Record<string, unknown> {
  const extra: Record<string, unknown> = row.data && typeof row.data === 'object'
    ? { ...(row.data as Record<string, unknown>) } : {};
  const cloud: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (key === 'data') continue;
    if (CORE_LOAN_COLUMNS.has(key)) cloud[key] = value;
    else extra[key] = value;
  }
  cloud.agreementid = String(row.agreementid);
  cloud.data = extra;
  cloud.updated_at = new Date().toISOString();
  return cloud;
}

function fromCloudLoan(row: Record<string, any>): LoanRecord {
  const extra = row.data && typeof row.data === 'object' ? row.data : {};
  return { ...extra, ...row, data: extra } as LoanRecord;
}

export async function cloudFetchLoans(): Promise<LoanRecord[]> {
  const { client } = await requireSignedInClient();
  const result: Record<string, any>[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.from('loan_records').select('*').order('agreementid').range(offset, offset + 999);
    if (error) throw new Error('Unable to load cloud loan records: ' + error.message);
    const batch = data ?? [];
    result.push(...batch);
    if (batch.length < 1000) break;
  }
  return result.map(fromCloudLoan);
}

export async function cloudUpsertLoans(rows: LoanRecord[]): Promise<void> {
  if (!rows.length) return;
  const { client } = await requireSignedInClient();
  for (let i = 0; i < rows.length; i += 250) {
    const batch = rows.slice(i, i + 250).map(toCloudLoan);
    const { error } = await client.from('loan_records').upsert(batch, { onConflict: 'agreementid' });
    if (error) throw new Error('Cloud loan import failed (batch ' + (Math.floor(i / 250) + 1) + '): ' + error.message);
  }
}

export async function cloudUpdateLoan(agreementid: string, updates: Record<string, unknown>, actor: string): Promise<void> {
  const { client } = await requireSignedInClient();
  const { data: existing, error: readError } = await client.from('loan_records').select('*').eq('agreementid', agreementid).maybeSingle();
  if (readError) throw new Error('Unable to read loan before update: ' + readError.message);
  if (!existing) throw new Error('Loan record not found or you do not have permission to access it.');
  const oldRecord = fromCloudLoan(existing);
  const updated = { ...oldRecord, ...updates, agreementid, updated_by: actor, updated_at: new Date().toISOString() };
  const { error: writeError } = await client.from('loan_records').upsert(toCloudLoan(updated), { onConflict: 'agreementid' });
  if (writeError) throw new Error('Cloud loan update failed: ' + writeError.message);

  const timestamp = new Date().toISOString();
  const auditRows = Object.entries(updates)
    .filter(([field, value]) => !field.endsWith('_source') && oldRecord[field] !== value)
    .map(([field, value]) => ({
      id: crypto.randomUUID(), agreementid, field,
      oldValue: String(oldRecord[field] ?? ''), newValue: String(value ?? ''),
      changedBy: actor, createdAt: timestamp, source: 'MANUAL',
    }));
  if (auditRows.length) {
    const { error: auditError } = await client.from('audit_log').insert(auditRows);
    if (auditError) throw new Error('Loan saved, but audit write failed; contact an administrator. ' + auditError.message);
  }
}

export async function cloudBulkUpdateLoans(items: Array<{ agreementId: string; updates: Record<string, unknown> }>, actor: string): Promise<void> {
  if (!items.length) return;
  const all = await cloudFetchLoans();
  const byId = new Map(all.map(row => [String(row.agreementid), row]));
  const timestamp = new Date().toISOString();
  const audits: AuditEntry[] = [];
  const changed: LoanRecord[] = [];
  for (const item of items) {
    const existing = byId.get(item.agreementId);
    if (!existing) continue;
    for (const [field, value] of Object.entries(item.updates)) {
      if (!field.endsWith('_source') && existing[field] !== value) {
        audits.push({ id: crypto.randomUUID(), agreementid: item.agreementId, field, oldValue: String(existing[field] ?? ''), newValue: String(value ?? ''), changedBy: actor, createdAt: timestamp, source: 'BULK_OPERATION' });
      }
    }
    changed.push({ ...existing, ...item.updates, agreementid: item.agreementId, updated_by: actor, updated_at: timestamp });
  }
  const { client } = await requireSignedInClient();
  for (let i = 0; i < changed.length; i += 250) {
    const { error } = await client.from('loan_records').upsert(changed.slice(i, i + 250).map(toCloudLoan), { onConflict: 'agreementid' });
    if (error) throw new Error('Cloud bulk update failed: ' + error.message);
  }
  for (let i = 0; i < audits.length; i += 250) {
    const { error } = await client.from('audit_log').insert(audits.slice(i, i + 250));
    if (error) throw new Error('Cloud audit write failed: ' + error.message);
  }
}

export async function cloudFetchTargets(): Promise<StateTarget[]> {
  const { client } = await requireSignedInClient();
  const { data, error } = await client.from('state_targets').select('*').order('key');
  if (error) throw new Error('Unable to load cloud targets: ' + error.message);
  return (data ?? []) as StateTarget[];
}

export async function cloudSaveTarget(key: string, pct: number, userName: string): Promise<void> {
  const { client } = await requireSignedInClient();
  if (pct <= 0) {
    const { error } = await client.from('state_targets').delete().eq('key', key);
    if (error) throw new Error('Unable to delete cloud target: ' + error.message);
    return;
  }
  if (pct > 100) throw new Error('Target percentage must be between 0 and 100.');
  const row: StateTarget = { key, pct, updatedBy: userName, updatedAt: new Date().toISOString() };
  const { error } = await client.from('state_targets').upsert(row, { onConflict: 'key' });
  if (error) throw new Error('Unable to save cloud target: ' + error.message);
}

export async function cloudFetchUploads(): Promise<UploadSession[]> {
  const { client, user } = await requireSignedInClient();
  if (!['ADMIN', 'MANAGER'].includes(String(user.app_metadata?.role))) return [];
  const { data, error } = await client.from('upload_sessions').select('*').order('createdAt', { ascending: false });
  if (error) throw new Error('Unable to load cloud upload history: ' + error.message);
  return (data ?? []) as UploadSession[];
}

export async function cloudSaveUpload(row: UploadSession): Promise<void> {
  const { client } = await requireSignedInClient();
  const { error } = await client.from('upload_sessions').upsert(row, { onConflict: 'id' });
  if (error) throw new Error('Cloud upload history write failed: ' + error.message);
}

export async function cloudFetchAudit(): Promise<AuditEntry[]> {
  const { client, user } = await requireSignedInClient();
  if (!['ADMIN', 'MANAGER'].includes(String(user.app_metadata?.role))) return [];
  const { data, error } = await client.from('audit_log').select('*').order('createdAt', { ascending: false }).limit(5000);
  if (error) throw new Error('Unable to load cloud audit log: ' + error.message);
  return (data ?? []) as AuditEntry[];
}

export function isCloudFirstEnabled(): boolean {
  return import.meta.env.VITE_CLOUD_FIRST_AUTH === 'true';
}

export async function cloudFetchAttendance(): Promise<import('./db').AttendanceLog[]> {
  const { client } = await requireSignedInClient();
  const { data, error } = await client.from('attendance_logs').select('*').order('date', { ascending: false });
  if (error) throw new Error('Unable to load cloud attendance: ' + error.message);
  return (data ?? []) as import('./db').AttendanceLog[];
}

export async function cloudSaveAttendance(row: import('./db').AttendanceLog): Promise<import('./db').AttendanceLog> {
  const { client, user } = await requireSignedInClient();
  if (row.userId !== user.id && user.app_metadata?.role !== 'ADMIN' && user.app_metadata?.role !== 'MANAGER') {
    throw new Error('You may only update your own attendance record.');
  }
  const payload = { ...row, currentBreakStart: row.currentBreakStart ?? null };
  const { data, error } = await client.from('attendance_logs').upsert(payload, { onConflict: 'id' }).select('*').single();
  if (error) throw new Error('Cloud attendance save failed: ' + error.message);
  return data as import('./db').AttendanceLog;
}

export async function cloudFetchFeedbacks(): Promise<import('./db').CustomerFeedback[]> {
  const { client } = await requireSignedInClient();
  const { data, error } = await client.from('customer_feedbacks').select('*').order('createdAt', { ascending: false });
  if (error) throw new Error('Unable to load cloud feedback: ' + error.message);
  return (data ?? []).map((row: any) => ({
    ...row,
    ref1: row.ref1Availability || row.ref1Feedback ? { availability: row.ref1Availability || '', feedback: row.ref1Feedback || '' } : undefined,
    ref2: row.ref2Availability || row.ref2Feedback ? { availability: row.ref2Availability || '', feedback: row.ref2Feedback || '' } : undefined,
  })) as import('./db').CustomerFeedback[];
}

export async function cloudSaveFeedback(row: import('./db').CustomerFeedback): Promise<import('./db').CustomerFeedback> {
  const { client, user } = await requireSignedInClient();
  const role = user.app_metadata?.role;
  if (row.agentId !== user.id && role !== 'ADMIN' && role !== 'MANAGER') {
    throw new Error('You may only submit feedback under your own account.');
  }
  const record: Record<string, unknown> = { ...row };
  if (row.ref1) { record.ref1Availability = row.ref1.availability; record.ref1Feedback = row.ref1.feedback; }
  if (row.ref2) { record.ref2Availability = row.ref2.availability; record.ref2Feedback = row.ref2.feedback; }
  delete record.ref1; delete record.ref2;
  const { data, error } = await client.from('customer_feedbacks').upsert(record, { onConflict: 'id' }).select('*').single();
  if (error) throw new Error('Cloud feedback save failed: ' + error.message);
  return data as import('./db').CustomerFeedback;
}
