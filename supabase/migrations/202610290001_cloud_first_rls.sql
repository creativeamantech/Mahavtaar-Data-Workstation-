-- Cloud-first role-based RLS for the existing application tables.
-- This migration intentionally keeps loan writes, targets, upload history, audit, and user administration privileged.
-- Authenticated users must have a trusted role in app_metadata; user_metadata is not trusted for authorization.

drop policy if exists "Authenticated admins only" on public.loan_records;
drop policy if exists "Authenticated admins only" on public.customer_feedbacks;
drop policy if exists "Authenticated admins only" on public.attendance_logs;
drop policy if exists "Authenticated admins only" on public.state_targets;
drop policy if exists "Authenticated admins only" on public.upload_sessions;
drop policy if exists "Authenticated admins only" on public.audit_log;
drop policy if exists "Authenticated admins only" on public.users;

create policy "Cloud roles can read assigned loans"
on public.loan_records for select to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('ADMIN', 'MANAGER', 'VIEWER')
  or (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'EXECUTIVE'
    and nullif(lower(coalesce(
      nullif(executive_name, ''),
      data ->> 'executive_name',
      data ->> 'Executive Name',
      data ->> 'FOS Name',
      data ->> 'FOS_Name',
      ''
    )), '') in (
      nullif(lower(auth.jwt() -> 'app_metadata' ->> 'assignedExecutiveName'), ''),
      nullif(lower(auth.jwt() -> 'app_metadata' ->> 'name'), '')
    )
  )
);

create policy "Managers can insert loans"
on public.loan_records for insert to authenticated
with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('ADMIN', 'MANAGER'));

create policy "Managers can update loans"
on public.loan_records for update to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('ADMIN', 'MANAGER'))
with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('ADMIN', 'MANAGER'));

create policy "Admins can delete loans"
on public.loan_records for delete to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'ADMIN');

create policy "Cloud roles can read permitted feedback"
on public.customer_feedbacks for select to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('ADMIN', 'MANAGER', 'VIEWER')
  or (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'EXECUTIVE'
    and (
      "agentId" = auth.uid()::text
      or lower(coalesce("agentName", '')) in (
        nullif(lower(auth.jwt() -> 'app_metadata' ->> 'assignedExecutiveName'), ''),
        nullif(lower(auth.jwt() -> 'app_metadata' ->> 'name'), '')
      )
    )
  )
);

create policy "Users can submit permitted feedback"
on public.customer_feedbacks for insert to authenticated
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('ADMIN', 'MANAGER')
  or (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'EXECUTIVE'
    and "agentId" = auth.uid()::text
  )
);

create policy "Users can update permitted feedback"
on public.customer_feedbacks for update to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('ADMIN', 'MANAGER')
  or ((auth.jwt() -> 'app_metadata' ->> 'role') = 'EXECUTIVE' and "agentId" = auth.uid()::text)
)
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('ADMIN', 'MANAGER')
  or ((auth.jwt() -> 'app_metadata' ->> 'role') = 'EXECUTIVE' and "agentId" = auth.uid()::text)
);

create policy "Managers can delete feedback"
on public.customer_feedbacks for delete to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('ADMIN', 'MANAGER'));

create policy "Users can read permitted attendance"
on public.attendance_logs for select to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('ADMIN', 'MANAGER')
  or "userId" = auth.uid()::text
);

create policy "Users can insert permitted attendance"
on public.attendance_logs for insert to authenticated
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('ADMIN', 'MANAGER')
  or ((auth.jwt() -> 'app_metadata' ->> 'role') = 'EXECUTIVE' and "userId" = auth.uid()::text)
);

create policy "Users can update permitted attendance"
on public.attendance_logs for update to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('ADMIN', 'MANAGER')
  or ((auth.jwt() -> 'app_metadata' ->> 'role') = 'EXECUTIVE' and "userId" = auth.uid()::text)
)
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') in ('ADMIN', 'MANAGER')
  or ((auth.jwt() -> 'app_metadata' ->> 'role') = 'EXECUTIVE' and "userId" = auth.uid()::text)
);

create policy "Managers can delete attendance"
on public.attendance_logs for delete to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('ADMIN', 'MANAGER'));

create policy "Cloud roles can read targets"
on public.state_targets for select to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('ADMIN', 'MANAGER', 'EXECUTIVE', 'VIEWER'));

create policy "Managers can insert targets"
on public.state_targets for insert to authenticated
with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('ADMIN', 'MANAGER'));

create policy "Managers can update targets"
on public.state_targets for update to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('ADMIN', 'MANAGER'))
with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('ADMIN', 'MANAGER'));

create policy "Managers can delete targets"
on public.state_targets for delete to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('ADMIN', 'MANAGER'));

create policy "Managers can read upload history"
on public.upload_sessions for select to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('ADMIN', 'MANAGER'));

create policy "Managers can write upload history"
on public.upload_sessions for insert to authenticated
with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('ADMIN', 'MANAGER'));

create policy "Managers can update upload history"
on public.upload_sessions for update to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('ADMIN', 'MANAGER'))
with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('ADMIN', 'MANAGER'));

create policy "Admins can delete upload history"
on public.upload_sessions for delete to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'ADMIN');

create policy "Managers can read audit log"
on public.audit_log for select to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('ADMIN', 'MANAGER'));

create policy "Managers can append audit log"
on public.audit_log for insert to authenticated
with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('ADMIN', 'MANAGER'));

create policy "Admins can update audit log"
on public.audit_log for update to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'ADMIN')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'ADMIN');

create policy "Admins can delete audit log"
on public.audit_log for delete to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'ADMIN');

create policy "Admins can manage user profiles"
on public.users for all to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'ADMIN')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'ADMIN');
