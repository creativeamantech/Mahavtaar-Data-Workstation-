# Cloud-First Release Validation Runbook

This runbook is a release gate for PR #7. It does not enable cloud-first mode, deploy the `admin-users` Edge Function, or migrate local data.

## Hard release gates

Do not merge or enable `VITE_CLOUD_FIRST_AUTH=true` in production until every gate below has evidence recorded.

- [ ] CI passes on the exact latest PR head: dependency install/lockfile check, production build, unit tests, lint.
- [ ] Supabase Auth leaked-password protection is enabled.
- [ ] A trusted first ADMIN account is provisioned outside browser code; no local password hash or plaintext password is copied to Supabase.
- [ ] `ADMIN_USERS_ALLOWED_ORIGINS` contains only the exact HTTPS production origin(s) before deploying `admin-users`.
- [ ] Edge Function tests prove ADMIN can manage users; MANAGER/EXECUTIVE/VIEWER, missing JWT, expired JWT, invalid role, and disallowed Origin cannot perform privileged actions.
- [ ] RLS tests run as real authenticated accounts for ADMIN, MANAGER, EXECUTIVE, and VIEWER. Policy existence alone is not a pass.
- [ ] Every user-facing IndexedDB access is classified as cloud-routed, local-only by design, or a release blocker.
- [ ] Local export, cloud migration dry-run, reconciliation, backup verification, and rollback have been exercised against a non-production dataset.
- [ ] A representative executive and administrator complete end-to-end smoke tests.

## Role authorization matrix to verify

Use separate real test accounts with roles assigned in server-managed `app_metadata`. Do not simulate authorization by changing client state or `user_metadata`.

| Resource / action | ADMIN | MANAGER | EXECUTIVE | VIEWER |
|---|---|---|---|---|
| Read loan records | All | All | Assigned loans only | All |
| Insert/update loans | Allow | Allow | Deny | Deny |
| Delete loans | Allow | Deny | Deny | Deny |
| Read feedback | All | All | Own/assigned feedback only | All |
| Insert/update feedback | Allow | Allow | Own feedback only | Deny |
| Delete feedback | Allow | Allow | Deny | Deny |
| Read attendance | All | All | Own records | Own records only |
| Insert/update attendance | Allow | Allow | Own records only | Deny |
| Manage users / roles | Allow through trusted server function only | Deny | Deny | Deny |

This is the expected policy contract, not a claim that end-to-end tests have passed. If current product requirements need different permissions, change and review the SQL policy and this matrix together before release.

## IndexedDB call-site audit procedure

Search the entire repository (not only the migration diff) for:
- `from '../lib/db'`, `from '@/lib/db'`, and other imports of the Dexie `db` instance
- `db.`, `indexedDB`, `useLiveQuery`, `useObservable`, `localStorage` data persistence
- local repository functions used by pages, hooks, background tasks, exports, dashboards, reports, and sync/peer-mesh handlers

For each call site, record: file/function, data table, read/write/delete, whether cloud-first can reach it, intended local-only purpose (if any), and a test proving the chosen behavior. A grep result alone is not an audit: follow helper/repository calls and dynamic imports. Cloud-first must never silently fall back to local data after a cloud error.

## Migration dry-run and reconciliation contract

Before any production write, produce a downloadable report with:
- source and destination row counts by table;
- stable-key counts and duplicate `agreementid` values;
- source-only, destination-only, matching, and conflicting keys;
- field-level differences for conflicts, preserving bank-specific columns;
- backup filename, timestamp, byte size, and checksum;
- explicit dry-run status and the exact planned insert/update counts.

A dry-run must be read-only. The commit step must require an explicit administrator confirmation, use bounded/transactional writes, preserve the source export, and emit a reconciliation result. Never auto-delete either dataset or use silent last-write-wins conflict resolution. If atomic multi-batch writes are unavailable, report partial completion and provide a deterministic resume/rollback procedure.

## Admin Edge Function pre-deployment checks

1. Review `supabase/functions/admin-users/index.ts` and ensure service-role credentials are read only from server environment secrets.
2. Set `ADMIN_USERS_ALLOWED_ORIGINS` to the exact deployed application origin(s); do not include wildcard origins.
3. Test preflight and actual requests from an allowed origin and a disallowed origin.
4. Test ADMIN, non-admin, missing/expired JWT, malformed input, duplicate email, pagination boundaries, and attempted privilege escalation.
5. Deploy only after review; record the deployment version and test evidence. The source file existing in Git does not mean the function is deployed.

## Cutover and rollback

1. Freeze writes for the test window and download a verified source backup.
2. Run the migration dry-run; resolve every duplicate and conflict.
3. Import to a non-production Supabase project and compare counts, stable keys, and checksums.
4. Exercise login/session restoration, loan search/detail/update, imports, feedback, attendance, targets, upload history, audit history, reports, and concurrent edits with each applicable role.
5. For production cutover, require an approved maintenance window and verified backup. Enable cloud-first only after every gate above passes.
6. If validation fails, disable the cloud-first feature flag and keep the original local data intact. Do not blindly copy potentially stale local data over cloud data; reconcile any writes made during the test window first.

## Current status at creation

- PR #7 remains draft and unmerged.
- Cloud-first production flag remains off.
- The `admin-users` function source is not deployed.
- A complete IndexedDB audit, migration dry-run/reconciliation implementation, and authenticated role-based end-to-end test evidence are still outstanding.
- CI must be checked against the exact current PR head; an older successful run does not validate later commits.


## Follow-up verification (2026-10-29, latest reviewed head)

- CI run #99 passed on latest PR head commit `d45d47069bec2ac49f5ab2b21de61b36950cf114`: dependency lockfile synchronization, install, production build, unit tests, and lint.
- Cloud user administration now includes `maintenanceMode` in the trusted `app_metadata` payload and returns it from the admin listing endpoint; the client maps this field in both initial admin user loading and refresh. This is covered by the general CI run, but does not yet have dedicated Edge Function integration tests.
- The live Supabase project currently lists only the `mcp` Edge Function. `admin-users` and `staff-directory` are not deployed, so cloud user management and manager staff-directory loading are not available in the live project.
- The Supabase security advisor still reports `auth_leaked_password_protection` as a warning. Enable leaked-password protection before production use.
- The production app's exact HTTPS origin is not decided yet. Do not deploy the two functions until the production URL is chosen and the exact allowed origin(s) are configured as `ADMIN_USERS_ALLOWED_ORIGINS` and `STAFF_DIRECTORY_ALLOWED_ORIGINS` (or the documented fallback).
- PR #7 remains draft and unmerged; `VITE_CLOUD_FIRST_AUTH` remains opt-in. No production function deployment or cloud-first cutover was performed during this verification.


## Follow-up verification (2026-10-29, pagination hardening)

- Commit `869e59834c0ee1660c07aa3aa127bf798a918234` adds explicit 1,000-row pagination and stable secondary ordering to cloud attendance and customer-feedback reads.
- The change prevents these repository methods from silently stopping at the Supabase per-response row limit. It does not make attendance punch-in atomic; concurrent punch-ins still require a server-side uniqueness/transaction strategy.
- A CI run for this exact commit was not returned by the available PR-run lookup at the time of this update. Do not treat the earlier successful CI run as validation of this commit.
- Existing hard release gates remain unchanged: authenticated role-based RLS tests, migration dry-run/reconciliation, IndexedDB audit, atomic loan-plus-audit writes, Edge Function deployment/origin configuration, and leaked-password protection remain outstanding.


## Follow-up verification (2026-10-29, atomic mutations)

- Added migration `202610290002_cloud_first_atomic_operations.sql` (source commit `45b5c8e0df3f2db3611dbb212ee128dbb7ca94f1`) and applied it to Supabase project `ycyxlldgserhtaepzhll`. The migration ledger confirms it as `cloud_first_atomic_operations`.
- Verified the database exposes `cloud_apply_loan_changes(jsonb, jsonb)` and `cloud_punch_in(text, text, text, text)`; both are SECURITY INVOKER (not SECURITY DEFINER). Loan rows and audit entries are written in one transaction; if any write fails, the RPC call rolls back. Batch size is capped at 5,000 loan rows / 50,000 audit rows.
- Client loan update and bulk-update paths now use the atomic RPC instead of separately writing loan rows and audit entries. Cloud attendance punch-in now uses a database RPC with deterministic ID and `ON CONFLICT DO NOTHING`, returning the existing row if concurrent requests race.
- CI run #107 passed for the initial client integration commit `8df87fc1d74a31ec752bd16ccced4ac7c5338c28`. CI run #109 is running for migration commit `45b5c8e0df3f2db3611dbb212ee128dbb7ca94f1`; wait for the final result before calling the exact head validated.
- The security advisor still reports leaked-password protection disabled. Enable it in Supabase Dashboard before production use.
- This does not complete release readiness: no authenticated role-based E2E evidence, no full repository-wide IndexedDB call-site audit, no migration dry-run/reconciliation exercise, and no final production origin for `admin-users` / `staff-directory` have been recorded. Cloud-first remains opt-in and must stay disabled until those gates pass.
