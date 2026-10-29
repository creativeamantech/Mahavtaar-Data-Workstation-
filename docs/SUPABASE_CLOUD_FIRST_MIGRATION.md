# Supabase Cloud-First Migration Plan

## Goal

Make Supabase PostgreSQL the authoritative store for the Mahavtaar Data Workstation. The browser must not silently treat IndexedDB as the source of truth. If the network is unavailable, cloud-first mode must show an actionable offline state rather than accepting writes that are not persisted to the cloud.

## Audit findings (2026-10-29)

- The current application authentication in `src/contexts/AuthContext.tsx` is local-only: it reads users and verifies password hashes from Dexie/IndexedDB. It seeds a default local administrator account when the local users table is empty.
- The main data flow in `src/contexts/DataContext.tsx` loads loan records, targets, upload history, and audit entries from IndexedDB. Loan imports and edits call local repositories.
- `src/contexts/SyncContext.tsx` and the peer sync engine implement local/peer synchronization. This is separate from Supabase and must not be mistaken for cloud persistence.
- `src/lib/supabase.ts` currently provides a manual push/pull bridge, not a cloud-first repository layer. The sync operation requires a Supabase Auth session and a server-managed `app_metadata.role = ADMIN`.
- The Supabase admin diagnostics page at `/mcp-admin` uses Supabase Auth, but the main login page does not. These are currently separate authentication systems.
- Supabase tables exist, but the last database inspection found zero rows in the seven application tables. No migration of local IndexedDB data has been confirmed.
- RLS is administrator-only. It is not yet a complete policy model for executives, staff attendance, row-level portfolio assignments, or user profile reads.

## Non-negotiable safety constraints

1. Never copy local password hashes, salts, iterations, or plaintext passwords into Supabase tables.
2. Never put a Supabase service-role key in browser code or Vite environment variables exposed to the client.
3. Never loosen customer/loan RLS to anonymous access.
4. Do not automatically overwrite cloud data with local data or delete either side during cutover.
5. Keep a verified export/backup and compare record counts plus key identifiers before any one-way migration.
6. Treat the UI's local role/permission checks as presentation only; enforce authorization in Supabase RLS or trusted server-side functions.

## Implementation sequence

### Current code increment (draft PR)

- Added an opt-in Supabase Auth path for the main login/session lifecycle, using the Supabase Auth session and server-managed `app_metadata` role/permissions.
- The local demo administrator seed is skipped when cloud auth mode is enabled.
- Cloud auth mode disables local demo credentials in the login UI and refuses browser-side user creation, role changes, password changes, and account deletion.
- The opt-in flag is `VITE_CLOUD_FIRST_AUTH=true`. It is deliberately not enabled by default; do not enable it for production until the first administrator and staff accounts are provisioned and the remaining cloud-data migration is complete.
- Added `src/lib/cloudRepository.ts` for paginated cloud loan reads, bounded upserts, loan edits, audit writes, targets, upload history, and audit reads. These methods deliberately throw on cloud errors rather than falling back to local data.
- `DataContext` now routes the primary loan load, main/paid/additional/corrected imports, manual/bulk updates, targets, upload history, and audit reads through Supabase when cloud-first mode is enabled; local peer-journal transport in that context is disabled.
- This is still a partial migration: attendance, customer-feedback entry, user provisioning/management, backup/restore, some peer-sync UI/actions, and other direct IndexedDB access paths still need migration. Cloud-first remains opt-in and must not be enabled for production yet.
- Current live RLS policies remain ADMIN-only on all seven tables. Non-admin users cannot use these data paths until role-specific RLS policies are reviewed and applied. Do not loosen the policies to anonymous access.

### Phase 1 — Authentication and authorization
- Use Supabase Auth for the main login/logout/session restoration (initial opt-in implementation added; still requires provisioned users and end-to-end validation).
- Read role and trusted authorization claims only from server-managed `app_metadata`, not editable `user_metadata`.
- Provision the first administrator through a trusted Supabase Dashboard/admin workflow; do not create privileged users from browser code.
- Define explicit roles and least-privilege RLS for ADMIN, EXECUTIVE, and any read-only roles before enabling non-admin access.
- Replace the local default administrator seed with a migration notice; never silently grant a new device administrator access.

### Phase 2 — Cloud repositories
- Introduce typed Supabase repositories for loans, feedback, attendance, targets, upload sessions, and audit events.
- Move list, detail, search/filter, create/update, import, and report flows to those repositories.
- Keep IndexedDB only for explicitly local preferences, temporary import staging, and a future opt-in offline cache.
- Ensure imports are validated and committed in bounded transactions/batches with progress and actionable error reporting.

### Phase 3 — Data migration
- Add a deliberate admin-only export/import workflow with dry-run, duplicate detection, backup download, and before/after counts.
- Preserve bank-specific columns in JSONB without losing original values.
- Reconcile by stable IDs (especially `agreementid`) and report conflicts; do not silently use last-write-wins.
- Require explicit confirmation before writing migrated rows to production.

### Phase 4 — Live updates and cutover
- Add Supabase Realtime subscriptions only after cloud repositories are the primary data source.
- Show a clear disconnected/read-only state on network failures; do not report success for unsaved local changes.
- Disable the old peer-mesh write path in cloud-first mode only after every user-facing workflow has been migrated and tested.
- Verify all routes, roles, imports, reports, audit history, and concurrent edits before production cutover.

## Acceptance checklist

- [ ] Main login uses Supabase Auth and restores/clears sessions correctly.
- [ ] No default browser-side administrator is seeded.
- [ ] Every protected read/write is denied by RLS to an unauthorized user.
- [ ] All primary features read and write through cloud repositories.
- [ ] Failed cloud writes are visible and do not appear as saved.
- [ ] Migration dry-run reports duplicate IDs and count mismatches.
- [ ] Backup/restore and rollback are documented and tested.
- [ ] Tests, lint, and production build pass.
- [ ] An authenticated admin and representative executive account complete end-to-end smoke tests.

## Current release decision

Do not switch the live app to cloud-first until Phase 1 and Phase 2 are complete. At present, doing so would lock users out or leave some screens reading stale IndexedDB data. The existing manual sync bridge is not sufficient evidence that the full application has been migrated.
