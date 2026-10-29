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
