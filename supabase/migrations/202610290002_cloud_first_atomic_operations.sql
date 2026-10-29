-- Atomic cloud-first loan mutations: loan rows and their audit entries commit or roll back together.
-- Callable only by authenticated ADMIN/MANAGER users; RLS remains enabled and applies to underlying tables.
create or replace function public.cloud_apply_loan_changes(p_records jsonb, p_audit_rows jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_role text := auth.jwt() -> 'app_metadata' ->> 'role';
  v_record jsonb;
  v_columns text;
begin
  if auth.uid() is null or v_role not in ('ADMIN', 'MANAGER') then
    raise exception 'Only authenticated administrators and managers may update loan records';
  end if;

  if jsonb_typeof(p_records) <> 'array' or jsonb_typeof(p_audit_rows) <> 'array' then
    raise exception 'Records and audit rows must be JSON arrays';
  end if;

  if jsonb_array_length(p_records) > 5000 or jsonb_array_length(p_audit_rows) > 50000 then
    raise exception 'Atomic loan mutation exceeds the supported batch size';
  end if;

  for v_record in select value from jsonb_array_elements(p_records)
  loop
    if nullif(v_record ->> 'agreementid', '') is null then
      raise exception 'Each loan record must contain agreementid';
    end if;

    select string_agg(format('%I = EXCLUDED.%I', key, key), ', ')
      into v_columns
      from jsonb_object_keys(v_record) as keys(key)
      where key <> 'agreementid'
        and exists (
          select 1 from pg_attribute a
          where a.attrelid = 'public.loan_records'::regclass
            and a.attname = key
            and a.attnum > 0
            and not a.attisdropped
        );

    if v_columns is null then
      raise exception 'Loan record has no updatable columns';
    end if;

    execute format(
      'insert into public.loan_records select (jsonb_populate_record(null::public.loan_records, $1)).* on conflict (agreementid) do update set %s',
      v_columns
    ) using v_record;
  end loop;

  if jsonb_array_length(p_audit_rows) > 0 then
    insert into public.audit_log
    select (jsonb_populate_record(null::public.audit_log, value)).*
    from jsonb_array_elements(p_audit_rows);
  end if;
end;
$$;

revoke all on function public.cloud_apply_loan_changes(jsonb, jsonb) from public, anon;
grant execute on function public.cloud_apply_loan_changes(jsonb, jsonb) to authenticated;

-- A deterministic attendance ID is already used by the client. This RPC makes the
-- check-and-create one database transaction and returns the existing row on a race.
create or replace function public.cloud_punch_in(p_user_id text, p_user_name text, p_date text, p_login_time text)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_role text := auth.jwt() -> 'app_metadata' ->> 'role';
  v_id text := 'ATT-' || p_user_id || '-' || p_date;
  v_row public.attendance_logs%rowtype;
begin
  if auth.uid() is null or v_role not in ('ADMIN', 'MANAGER', 'EXECUTIVE') then
    raise exception 'Your account cannot record attendance';
  end if;

  if p_user_id <> auth.uid()::text and v_role not in ('ADMIN', 'MANAGER') then
    raise exception 'You may only punch in for your own account';
  end if;

  insert into public.attendance_logs (id, "userId", "userName", date, "loginTime", "breakDuration")
  values (v_id, p_user_id, p_user_name, p_date, p_login_time, 0)
  on conflict (id) do nothing;

  select * into v_row from public.attendance_logs where id = v_id;
  if not found then
    raise exception 'Unable to retrieve attendance record after punch in';
  end if;

  return to_jsonb(v_row);
end;
$$;

revoke all on function public.cloud_punch_in(text, text, text, text) from public, anon;
grant execute on function public.cloud_punch_in(text, text, text, text) to authenticated;
