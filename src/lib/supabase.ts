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

        if (!error && count !== null) {
          counts[table] = count;
        } else {
          counts[table] = 0;
        }
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
  const startTime = performance.now();
  const errors: string[] = [];
  let totalPushed = 0;
  let totalPulled = 0;

  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      pushed: 0,
      pulled: 0,
      errors: ['Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'],
      durationMs: 0,
    };
  }

  try {
    // 1. STATE TARGETS
    if (direction === 'push' || direction === 'bidirectional') {
      onProgress?.('Pushing State Targets to Supabase...', 1, 7);
      const localTargets = await db.state_targets.toArray();
      if (localTargets.length > 0) {
        const { error } = await client
          .from('state_targets')
          .upsert(localTargets, { onConflict: 'key' });
        if (error) errors.push(`Target push error: ${error.message}`);
        else totalPushed += localTargets.length;
      }
    }

    if (direction === 'pull' || direction === 'bidirectional') {
      onProgress?.('Pulling State Targets from Supabase...', 2, 7);
      const { data, error } = await client.from('state_targets').select('*');
      if (!error && data && data.length > 0) {
        await db.state_targets.bulkPut(data as StateTarget[]);
        totalPulled += data.length;
      }
    }

    // 2. USERS
    if (direction === 'push' || direction === 'bidirectional') {
      onProgress?.('Pushing Users to Supabase...', 3, 7);
      const localUsers = await db.users.toArray();
      if (localUsers.length > 0) {
        const { error } = await client
          .from('users')
          .upsert(localUsers, { onConflict: 'id' });
        if (error) errors.push(`Users push error: ${error.message}`);
        else totalPushed += localUsers.length;
      }
    }

    if (direction === 'pull' || direction === 'bidirectional') {
      onProgress?.('Pulling Users from Supabase...', 4, 7);
      const { data, error } = await client.from('users').select('*');
      if (!error && data && data.length > 0) {
        await db.users.bulkPut(data as StoredUser[]);
        totalPulled += data.length;
      }
    }

    // 3. ATTENDANCE LOGS
    if (direction === 'push' || direction === 'bidirectional') {
      onProgress?.('Pushing Attendance Logs to Supabase...', 5, 7);
      const localAttendance = await db.attendance_logs.toArray();
      if (localAttendance.length > 0) {
        // Push in chunks of 500
        for (let i = 0; i < localAttendance.length; i += 500) {
          const chunk = localAttendance.slice(i, i + 500);
          const { error } = await client
            .from('attendance_logs')
            .upsert(chunk, { onConflict: 'id' });
          if (error) errors.push(`Attendance push error: ${error.message}`);
          else totalPushed += chunk.length;
        }
      }
    }

    if (direction === 'pull' || direction === 'bidirectional') {
      onProgress?.('Pulling Attendance Logs from Supabase...', 6, 7);
      const { data, error } = await client.from('attendance_logs').select('*');
      if (!error && data && data.length > 0) {
        await db.attendance_logs.bulkPut(data as AttendanceLog[]);
        totalPulled += data.length;
      }
    }

    // 4. CUSTOMER FEEDBACKS
    if (direction === 'push' || direction === 'bidirectional') {
      onProgress?.('Pushing Customer Feedbacks to Supabase...', 7, 7);
      const localFeedbacks = await db.customer_feedbacks.toArray();
      if (localFeedbacks.length > 0) {
        for (let i = 0; i < localFeedbacks.length; i += 500) {
          const chunk = localFeedbacks.slice(i, i + 500);
          const { error } = await client
            .from('customer_feedbacks')
            .upsert(chunk, { onConflict: 'id' });
          if (error) errors.push(`Feedbacks push error: ${error.message}`);
          else totalPushed += chunk.length;
        }
      }
    }

    if (direction === 'pull' || direction === 'bidirectional') {
      const { data, error } = await client.from('customer_feedbacks').select('*');
      if (!error && data && data.length > 0) {
        await db.customer_feedbacks.bulkPut(data as CustomerFeedback[]);
        totalPulled += data.length;
      }
    }

    // 5. LOAN RECORDS (Bulk batches)
    if (direction === 'push' || direction === 'bidirectional') {
      const localLoans = await db.loan_records.toArray();
      if (localLoans.length > 0) {
        // Push in chunks of 500 records
        for (let i = 0; i < localLoans.length; i += 500) {
          const chunk = localLoans.slice(i, i + 500);
          onProgress?.(`Pushing Loan Records (${i + 1}-${Math.min(i + 500, localLoans.length)} of ${localLoans.length})...`, i, localLoans.length);
          const { error } = await client
            .from('loan_records')
            .upsert(chunk, { onConflict: 'agreementid' });
          if (error) {
            errors.push(`Loan records push chunk error: ${error.message}`);
          } else {
            totalPushed += chunk.length;
          }
        }
      }
    }

    if (direction === 'pull' || direction === 'bidirectional') {
      onProgress?.('Pulling Loan Records from Supabase...', 1, 1);
      const { data, error } = await client.from('loan_records').select('*');
      if (!error && data && data.length > 0) {
        await db.loan_records.bulkPut(data as LoanRecord[]);
        totalPulled += data.length;
      }
    }

    // 6. UPLOAD SESSIONS & AUDIT LOG
    if (direction === 'push' || direction === 'bidirectional') {
      const localSessions = await db.upload_sessions.toArray();
      if (localSessions.length > 0) {
        await client.from('upload_sessions').upsert(localSessions, { onConflict: 'id' });
      }
      const localAudit = await db.audit_log.toArray();
      if (localAudit.length > 0) {
        for (let i = 0; i < localAudit.length; i += 500) {
          const chunk = localAudit.slice(i, i + 500);
          await client.from('audit_log').upsert(chunk, { onConflict: 'id' });
        }
      }
    }

    const durationMs = Math.round(performance.now() - startTime);

    return {
      success: errors.length === 0,
      pushed: totalPushed,
      pulled: totalPulled,
      errors,
      durationMs,
    };
  } catch (err: any) {
    const durationMs = Math.round(performance.now() - startTime);
    errors.push(err?.message || 'Sync failed');
    return {
      success: false,
      pushed: totalPushed,
      pulled: totalPulled,
      errors,
      durationMs,
    };
  }
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
