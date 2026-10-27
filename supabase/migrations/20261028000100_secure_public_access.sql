-- Security hardening migration for Mahavtaar Data Workstation.
-- Intentionally fails closed: browser anon/authenticated roles get no direct table access.
-- Do not apply client access policies until the server-side authentication and role mapping
-- are implemented and reviewed. This migration does not modify or delete application data.

DO $$
DECLARE
  tbl text;
  policy_name text;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'loan_records',
      'customer_feedbacks',
      'users',
      'attendance_logs',
      'state_targets',
      'upload_sessions',
      'audit_log'
    ])
  LOOP
    IF to_regclass(format('public.%I', tbl)) IS NOT NULL THEN
      policy_name := 'Allow public read-write for ' || tbl;
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, tbl);
    END IF;
  END LOOP;
END
$$;

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;
