/**
 * Mahavtaar Ledger - Strongly Typed Domain Definitions
 * Enterprise-Grade Financial Operations Domain Model
 */

export type UserRole = 'ADMIN' | 'MANAGER' | 'EXECUTIVE' | 'VIEWER';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  passwordHash?: string;
  salt?: string;
  iterations?: number;
  phone?: string;
  city?: string;
  state?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  lastLogin?: string;
  failedLoginAttempts?: number;
  lockoutUntil?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type Permission =
  | 'VIEW_DASHBOARD'
  | 'VIEW_EXPLORER'
  | 'VIEW_PIVOTS'
  | 'EDIT_RECORD'
  | 'IMPORT_DATA'
  | 'EXPORT_DATA'
  | 'MANAGE_USERS'
  | 'MANAGE_TARGETS'
  | 'VIEW_AUDIT_LOG'
  | 'P2P_SYNC_MANAGE'
  | 'MANAGE_ASSIGNMENTS'
  | 'SUBMIT_FEEDBACK'
  | 'SUBMIT_ATTENDANCE';

export interface LoanRecord {
  id: string; // Typically agreementid / agreement_no
  agreementid: string;
  agreement_no?: string;
  customer_name: string;
  state: string;
  city: string;
  executive_name?: string;
  bom_bkt: string | number;
  principal_outstanding: number;
  emi_amt: number;
  approx_forclosure?: number;
  dac?: number;
  provisional_dac?: number;
  ecs?: number;
  special?: number;
  new_total?: number;
  settlement_approved_amt?: number | null;
  last_month_paid_flag?: boolean;
  phone?: string;
  mobile?: string;
  address?: string;
  vehicle_no?: string;
  loan_amount?: number;
  disbursal_date?: string;
  tenure?: number;
  is_conflict?: boolean;
  dac_source?: 'BASE' | 'CONFIRMED' | 'PROVISIONAL' | 'CORRECTED';
  updated_at?: string;
  updated_by?: string;
  [key: string]: unknown;
}

export interface LoanRecordComputed {
  emi1: number;
  emi2: number;
  emi3: number;
  emi4: number;
  total: number;
  remaining: number;
  totalPerEmi: number;
  shortIn1: number | null;
  shortIn2: number | null;
  ecsCount: number | null;
  ecsPOS: number | null;
  rbCondition: number;
  posCleared: number;
  fcCleared: number;
  emiCount: number;
  teamPaid: number | null;
  teamUnpaid: number | null;
  teamPaidPOS: number | null;
  teamRBPOS: number | null;
  mainPaid: number | null;
  unpaid: number;
  mainUnpaidPOS: number | null;
  mainPaidPOS: number | null;
  rollbackPOS: number | null;
}

export interface CustomerFeedback {
  id?: number | string;
  agreementid: string;
  customer_name?: string;
  contact_number?: string;
  contactNumber?: string;
  availability: string;
  standardFeedback: string;
  detailedFeedback?: string;
  ref1Availability?: string;
  ref1Feedback?: string;
  ref2Availability?: string;
  ref2Feedback?: string;
  ref1?: {
    availability: string;
    feedback: string;
  };
  ref2?: {
    availability: string;
    feedback: string;
  };
  disposition?: string;
  sub_disposition?: string;
  status?: string;
  ptp_date?: string;
  ptp_amount?: number;
  notes?: string;
  executive_name?: string;
  agentId?: string;
  agentName?: string;
  timestamp?: string;
  createdAt?: string;
  latitude?: number;
  longitude?: number;
  sync_status?: 'PENDING' | 'SYNCED' | 'FAILED';
}

export interface AttendanceLog {
  id?: number | string;
  user_id?: string;
  executive_name: string;
  date: string;
  punch_in_time?: string;
  punch_out_time?: string;
  breaks?: Array<{ start: string; end?: string; reason?: string }>;
  total_working_minutes?: number;
  status: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'ON_LEAVE';
  notes?: string;
}

export interface AuditEntry {
  id?: number | string;
  eventId: string;
  timestamp: string;
  actorUserId?: string;
  actorName: string;
  actorRole: UserRole;
  deviceId?: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE' | 'BULK_UPDATE' | 'IMPORT' | 'RESTORE' | 'ASSIGN';
  entityType: 'LOAN_RECORD' | 'USER' | 'TARGET' | 'ATTENDANCE' | 'FEEDBACK' | 'SETTINGS';
  entityId: string;
  field?: string;
  oldValue?: unknown;
  newValue?: unknown;
  source: 'MANUAL' | 'EXCEL_IMPORT' | 'P2P_SYNC' | 'SYSTEM' | 'BULK_OPERATION';
  transactionId: string;
  previousHash?: string;
  hash: string;
}

export interface StateTarget {
  id?: number | string;
  state: string;
  month: string; // YYYY-MM
  target_pct: number;
  target_amount?: number;
  updated_at?: string;
  updated_by?: string;
}
