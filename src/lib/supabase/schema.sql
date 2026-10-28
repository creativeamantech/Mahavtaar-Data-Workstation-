-- ==============================================================================
-- Mahavtaar Ledger - Supabase PostgreSQL Database Schema
-- Run this script in your Supabase Project: SQL Editor -> New Query -> Run
-- ==============================================================================

-- Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. LOAN RECORDS TABLE
CREATE TABLE IF NOT EXISTS public.loan_records (
    agreementid TEXT PRIMARY KEY,
    customer_name TEXT,
    customer_no TEXT,
    mobile TEXT,
    city TEXT,
    state TEXT,
    pos NUMERIC DEFAULT 0,
    bom_pos NUMERIC DEFAULT 0,
    tos NUMERIC DEFAULT 0,
    bom_bkt TEXT,
    cur_bkt TEXT,
    allocated_agency TEXT,
    executive_name TEXT,
    last_action TEXT,
    last_disposition TEXT,
    ptp_date TIMESTAMPTZ,
    status TEXT DEFAULT 'ACTIVE',
    total_paid NUMERIC DEFAULT 0,
    waiver_amount NUMERIC DEFAULT 0,
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast querying by city, state, bucket, executive
CREATE INDEX IF NOT EXISTS idx_loan_records_city ON public.loan_records(city);
CREATE INDEX IF NOT EXISTS idx_loan_records_state ON public.loan_records(state);
CREATE INDEX IF NOT EXISTS idx_loan_records_bom_bkt ON public.loan_records(bom_bkt);
CREATE INDEX IF NOT EXISTS idx_loan_records_executive ON public.loan_records(executive_name);

-- 2. CUSTOMER FEEDBACKS TABLE
CREATE TABLE IF NOT EXISTS public.customer_feedbacks (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    agreementid TEXT NOT NULL,
    "contactNumber" TEXT,
    availability TEXT,
    status TEXT,
    "standardFeedback" TEXT,
    "detailedFeedback" TEXT,
    "ref1Availability" TEXT,
    "ref1Feedback" TEXT,
    "ref2Availability" TEXT,
    "ref2Feedback" TEXT,
    "paidSubStatus" TEXT,
    "amountPaid" NUMERIC,
    "paymentMode" TEXT,
    "approvedAmount" NUMERIC,
    "nonContactableSubStatus" TEXT,
    "ptpDate" TEXT,
    "cbDate" TEXT,
    "detailedFeedbackThirdParty" TEXT,
    "detailedFeedbackAgentDispute" TEXT,
    "overallDetailedFeedback" TEXT,
    "concernNumber" TEXT,
    "relationName" TEXT,
    "agentId" TEXT,
    "agentName" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedbacks_agreementid ON public.customer_feedbacks(agreementid);
CREATE INDEX IF NOT EXISTS idx_feedbacks_created_at ON public.customer_feedbacks("createdAt" DESC);

-- 3. USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'VIEWER',
    "passwordHash" TEXT,
    salt TEXT,
    iterations INT,
    permissions JSONB DEFAULT '{"views":[]}'::jsonb,
    "assignedExecutiveName" TEXT,
    "maintenanceMode" BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ATTENDANCE LOGS TABLE
CREATE TABLE IF NOT EXISTS public.attendance_logs (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    date TEXT NOT NULL,
    "loginTime" TIMESTAMPTZ NOT NULL,
    "logoutTime" TIMESTAMPTZ,
    "breakDuration" NUMERIC DEFAULT 0,
    "currentBreakStart" TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON public.attendance_logs("userId", date);

-- 5. STATE TARGETS TABLE
CREATE TABLE IF NOT EXISTS public.state_targets (
    key TEXT PRIMARY KEY,
    pct NUMERIC NOT NULL,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 6. UPLOAD SESSIONS TABLE
CREATE TABLE IF NOT EXISTS public.upload_sessions (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    type TEXT,
    "fileName" TEXT,
    "recordCount" INT DEFAULT 0,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 7. AUDIT LOG TABLE
CREATE TABLE IF NOT EXISTS public.audit_log (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    agreementid TEXT,
    field TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "changedBy" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    source TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_agreementid ON public.audit_log(agreementid);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON public.audit_log("createdAt" DESC);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.loan_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.state_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Fail closed: do not expose customer/loan data to browser anon/authenticated roles.
-- The app currently uses local application credentials rather than Supabase Auth,
-- so safe per-user RLS policies cannot be defined here yet. Add authenticated server-side
-- API/MCP access and explicit identity/role mapping before granting client access.
DROP POLICY IF EXISTS "Allow public read-write for loan_records" ON public.loan_records;
DROP POLICY IF EXISTS "Allow public read-write for customer_feedbacks" ON public.customer_feedbacks;
DROP POLICY IF EXISTS "Allow public read-write for users" ON public.users;
DROP POLICY IF EXISTS "Allow public read-write for attendance_logs" ON public.attendance_logs;
DROP POLICY IF EXISTS "Allow public read-write for state_targets" ON public.state_targets;
DROP POLICY IF EXISTS "Allow public read-write for upload_sessions" ON public.upload_sessions;
DROP POLICY IF EXISTS "Allow public read-write for audit_log" ON public.audit_log;

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;

-- Enable Realtime for live collaboration across nodes
ALTER PUBLICATION supabase_realtime ADD TABLE public.loan_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_feedbacks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.state_targets;
