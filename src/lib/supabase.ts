/**
 * Supabase Database Integration for Mahavtaar Ledger
 * Provides PostgreSQL cloud persistence, real-time data sync, and offline-first hybrid bridge.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { db, LoanRecord, CustomerFeedback, AuditEntry, StateTarget, StoredUser, AttendanceLog, UploadSession } from './db';

// Environment variables (client-side public keys)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let supabaseClientInstance: SupabaseClient | null = null;

/**
 * Returns true if Supabase URL and Anon Key are present in the environment.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    SUPABASE_URL && 
    SUPABASE_ANON_KEY && 
    SUPABASE_URL.startsWith('http') && 
    SUPABASE_ANON_KEY.length > 10
  );
}

/**
 * Returns configuration details (safe to display in UI, masking sensitive tokens).
 */
export function getSupabaseConfig() {
  const isConfigured = isSupabaseConfigured();
  let maskedKey = '';
  if (SUPABASE_ANON_KEY && SUPABASE_ANON_KEY.length > 8) {
    maskedKey = `${SUPABASE_ANON_KEY.slice(0, 6)}...${SUPABASE_ANON_KEY.slice(-4)}`;
  }

  let projectRef = '';
  try {
    if (SUPABASE_URL) {
      const url = new URL(SUPABASE_URL);
      projectRef = url.hostname.split('.')[0] || '';
    }
  } catch {
    // Ignore URL parse error
  }

  return {
    isConfigured,
    url: SUPABASE_URL,
    projectRef,
    maskedKey,
  };
}

/**
 * Lazy initialization of Supabase client.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!supabaseClientInstance) {
    supabaseClientInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  }

  return supabaseClientInstance;
}

export interface ConnectionTestResult {
  success: boolean;
  latencyMs: number;
  message: string;
  tables?: Record<string, { exists: boolean; rowCount: number }>;
  error?: string;
}

/**
 * Tests connection to Supabase and queries table availability.
 */
export async function testSupabaseConnection(): Promise<ConnectionTestResult> {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      latencyMs: 0,
      message: 'Supabase credentials not configured in environment variables (VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY).',
      error: 'MISSING_ENV_VARS',
    };
  }

  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      latencyMs: 0,
      message: 'Failed to initialize Supabase client.',
      error: 'CLIENT_INIT_FAILED',
    };
  }

  const startTime = performance.now();
  const tableStatus: Record<string, { exists: boolean; rowCount: number }> = {};
  const tablesToCheck = [
    'loan_records',
    'customer_feedbacks',
    'users',
    'attendance_logs',
    'state_targets',
    'audit_log',
    'upload_sessions',
  ];

  try {
    let connected = false;

    // Check each table
    for (const table of tablesToCheck) {
      try {
        const { count, error } = await client
          .from(table)
          .select('*', { count: 'exact', head: true });

        if (error) {
          tableStatus[table] = { exists: false, rowCount: 0 };
        } else {
          tableStatus[table] = { exists: true, rowCount: count ?? 0 };
          connected = true;
        }
      } catch {
        tableStatus[table] = { exists: false, rowCount: 0 };
      }
    }

    const latencyMs = Math.round(performance.now() - startTime);

    if (!connected) {
      // If tables don't exist yet, it's still connected if the auth/rest responded
      return {
        success: true,
        latencyMs,
        message: 'Connected to Supabase project, but database tables need to be created. Please run the SQL Schema setup script.',
        tables: tableStatus,
      };
    }

    return {
      success: true,
      latencyMs,
      message: `Successfully connected to Supabase PostgreSQL (${latencyMs}ms response time).`,
      tables: tableStatus,
    };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return {
      success: false,
      latencyMs,
      message: err?.message || 'Connection failed.',
      error: err?.message,
    };
  }
}

/**
 * Fetches row counts from Supabase tables.
 */
export async function fetchSupabaseTableCounts(): Promise<Record<string, number>> {
  const client = getSupabaseClient();
  if (!client) return {};

  const tables = [
    'loan_records',
    'customer_feedbacks',
    'users',
    'attendance_logs',
    'state_targets',
    'audit_log',
    'upload_sessions',
  ];

  const counts: Record<string, number> = {};

  await Promise.all(
    tables.map(async (table) => {
      try {
        const { count, error } = await client
          .from(table)
          .select('*', { count: 'exact', head: true });

        // Omit inaccessible tables instead of reporting a false zero count.
        if (!error && count !== null) counts[table] = count;
      } catch {
        counts[table] = 0;
      }
    })
  );

  return counts;
}

export interface SyncProgressCallback {
  (step: string, current: number, total: number): void;
}

export interface SyncResult {
  success: boolean;
  pushed: number;
  pulled: number;
  errors: string[];
  durationMs: number;
}

/**
 * Executes bidirectional smart synchronization between local IndexedDB (Dexie) and Supabase PostgreSQL.
 */
export async function syncWithSupabase(
  direction: 'push' | 'pull' | 'bidirectional' = 'bidirectional',
  onProgress?: SyncProgressCallback
): Promise<SyncResult> {
  const started = performance.now();
  const errors: string[] = [];
  let pushed = 0;
  let pulled = 0;
  const client = getSupabaseClient();
  const result = (): SyncResult => ({
    success: errors.length === 0, pushed, pulled, errors,
    durationMs: Math.round(performance.now() - started),
  });
  if (!client) {
    errors.push('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
    return result();
  }

  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) {
    errors.push('Sign in through Supabase Auth before syncing. Local IndexedDB data has not been changed.');
    return result();
  }
  if (authData.user.app_metadata?.role !== 'ADMIN') {
    errors.push('Secure sync requires a Supabase Auth user with server-managed app_metadata.role = ADMIN.');
    return result();
  }

  const pushRows = async (table: string, rows: Record<string, unknown>[], conflict: string, label: string) => {
    for (let i = 0; i < rows.length; i += 250) {
      const batch = rows.slice(i, i + 250);
      const { error } = await client.from(table).upsert(batch, { onConflict: conflict });
      if (error) errors.push(label + ' push failed (rows ' + (i + 1) + '-' + (i + batch.length) + '): ' + error.message);
      else pushed += batch.length;
      onProgress?.(label + ': pushed ' + Math.min(i + batch.length, rows.length) + ' of ' + rows.length,
        Math.min(i + batch.length, rows.length), rows.length);
    }
  };

  const pullRows = async <T,>(table: string, label: string, apply: (rows: T[]) => Promise<unknown>) => {
    const all: T[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await client.from(table).select('*').range(offset, offset + 999);
      if (error) { errors.push(label + ' pull failed: ' + error.message); return; }
      const batch = (data ?? []) as T[];
      all.push(...batch);
      if (batch.length < 1000) break;
    }
    try {
      if (all.length) await apply(all);
      pulled += all.length;
      onProgress?.(label + ': pulled ' + all.length + ' records', all.length, all.length);
    } catch (error) {
      errors.push(label + ' local write failed: ' + (error instanceof Error ? error.message : 'Unknown IndexedDB error'));
    }
  };

  const wantsPush = direction === 'push' || direction === 'bidirectional';
  const wantsPull = direction === 'pull' || direction === 'bidirectional';

  try {
    // Preserve bank-specific CSV columns in JSONB data; never discard them on cloud round-trip.
    const loanColumns = new Set([
      'agreementid', 'customer_name', 'customer_no', 'mobile', 'city', 'state',
      'pos', 'bom_pos', 'tos', 'bom_bkt', 'cur_bkt', 'allocated_agency',
      'executive_name', 'last_action', 'last_disposition', 'ptp_date', 'status',
      'total_paid', 'waiver_amount', 'created_at', 'updated_at',
    ]);
    const toCloudLoan = (row: LoanRecord): Record<string, unknown> => {
      const extra: Record<string, unknown> = row.data && typeof row.data === 'object'
        ? { ...(row.data as Record<string, unknown>) } : {};
      const cloud: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row)) {
        if (key === 'data') continue;
        if (loanColumns.has(key)) cloud[key] = value;
        else extra[key] = value;
      }
      cloud.data = extra;
      return cloud;
    };
    const fromCloudLoan = (row: Record<string, unknown>): LoanRecord => {
      const extra = row.data && typeof row.data === 'object'
        ? row.data as Record<string, unknown> : {};
      return { ...extra, ...row, data: extra } as LoanRecord;
    };

    if (wantsPush) {
      onProgress?.('Preparing local data for secure cloud sync...', 0, 7);
      const [targets, attendance, feedbacks, loans, sessions, audits] = await Promise.all([
        db.state_targets.toArray(), db.attendance_logs.toArray(), db.customer_feedbacks.toArray(),
        db.loan_records.toArray(), db.upload_sessions.toArray(), db.audit_log.toArray(),
      ]);
      await pushRows('state_targets', targets as unknown as Record<string, unknown>[], 'key', 'State targets');
      await pushRows('attendance_logs', attendance as unknown as Record<string, unknown>[], 'id', 'Attendance');
      await pushRows('customer_feedbacks', feedbacks.map((row) => {
        const record = { ...row } as unknown as Record<string, unknown>;
        if (row.ref1 && !record.ref1Availability) record.ref1Availability = row.ref1.availability;
        if (row.ref1 && !record.ref1Feedback) record.ref1Feedback = row.ref1.feedback;
        if (row.ref2 && !record.ref2Availability) record.ref2Availability = row.ref2.availability;
        if (row.ref2 && !record.ref2Feedback) record.ref2Feedback = row.ref2.feedback;
        delete record.ref1; delete record.ref2;
        return record;
      }), 'id', 'Customer feedback');
      await pushRows('loan_records', loans.map(toCloudLoan), 'agreementid', 'Loan records');
      await pushRows('upload_sessions', sessions as unknown as Record<string, unknown>[], 'id', 'Upload sessions');
      await pushRows('audit_log', audits as unknown as Record<string, unknown>[], 'id', 'Audit log');
    }

    if (wantsPull) {
      await pullRows<Record<string, unknown>>('state_targets', 'State targets', rows => db.state_targets.bulkPut(rows as unknown as StateTarget[]));
      await pullRows<Record<string, unknown>>('attendance_logs', 'Attendance', rows => db.attendance_logs.bulkPut(rows as unknown as AttendanceLog[]));
      await pullRows<Record<string, unknown>>('customer_feedbacks', 'Customer feedback', rows => db.customer_feedbacks.bulkPut(rows as unknown as CustomerFeedback[]));
      await pullRows<Record<string, unknown>>('loan_records', 'Loan records', rows => db.loan_records.bulkPut(rows.map(fromCloudLoan)));
      await pullRows<Record<string, unknown>>('upload_sessions', 'Upload sessions', rows => db.upload_sessions.bulkPut(rows as unknown as UploadSession[]));
      await pullRows<Record<string, unknown>>('audit_log', 'Audit log', rows => db.audit_log.bulkPut(rows as unknown as AuditEntry[]));
    }

    // Local users/password hashes are intentionally never synced. Supabase Auth owns cloud identity.
    onProgress?.('Sync verification: refreshing cloud table counts...', 7, 7);
    const counts = await fetchSupabaseTableCounts();
    for (const table of ['loan_records', 'customer_feedbacks', 'attendance_logs', 'state_targets', 'upload_sessions', 'audit_log']) {
      if (counts[table] === undefined) errors.push('Post-sync verification failed: unable to read count for ' + table + '.');
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unexpected sync failure.');
  }
  return result();
}

/**
 * Subscribes to Supabase Realtime changes across critical tables.
 */
export function subscribeToSupabaseRealtime(
  onRecordChange: (table: string, eventType: 'INSERT' | 'UPDATE' | 'DELETE', newRecord: any, oldRecord: any) => void
): () => void {
  const client = getSupabaseClient();
  if (!client) {
    return () => {};
  }

  const channel = client
    .channel('mahavtaar_realtime_sync')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'customer_feedbacks' },
      (payload) => {
        onRecordChange('customer_feedbacks', payload.eventType as any, payload.new, payload.old);
        // Apply directly to local IndexedDB
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          db.customer_feedbacks.put(payload.new as CustomerFeedback);
        } else if (payload.eventType === 'DELETE' && payload.old?.id) {
          db.customer_feedbacks.delete(payload.old.id);
        }
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'state_targets' },
      (payload) => {
        onRecordChange('state_targets', payload.eventType as any, payload.new, payload.old);
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          db.state_targets.put(payload.new as StateTarget);
        }
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'attendance_logs' },
      (payload) => {
        onRecordChange('attendance_logs', payload.eventType as any, payload.new, payload.old);
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          db.attendance_logs.put(payload.new as AttendanceLog);
        }
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'loan_records' },
      (payload) => {
        onRecordChange('loan_records', payload.eventType as any, payload.new, payload.old);
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          db.loan_records.put(payload.new as LoanRecord);
        }
      }
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}
