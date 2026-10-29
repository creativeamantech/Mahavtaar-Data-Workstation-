# Supabase Cloud-First Migration Plan

## Goal

Make Supabase PostgreSQL the authoritative store for the Mahavtaar Data Workstation. The browser must not silently treat IndexedDB as the source of truth. If the network is unavailable, cloud-first mode must show an actionable offline state rather than accepting writes that are not persisted to the cloud.

## Audit findings (2026-10-29)

- The main login now has an **opt-in** Supabase Auth path in `src/contexts/AuthContext.tsx`; local authentication remains the default when `VITE_CLOUD_FIRST_AUTH` is not `true`.
- In cloud-first mode, the main loan/target/import/edit paths and the attendance/customer-feedback repositories route through Supabase. This is a partial migration, not proof that every screen has stopped using IndexedDB.
- `src/contexts/SyncContext.tsx` disables the local peer mesh in cloud-first mode. The legacy peer/local data flow remains for the default local mode.
- The `admin-users` Edge Function source exists in the branch but is **not deployed**. Cloud user provisioning through the app is therefore unavailable; do not enable cloud-first mode until a trusted provisioning path is ready.
- Live schema inspection confirmed RLS is enabled on the application tables and the expected role-based policies are present. The policies still need authenticated ADMIN, MANAGER, EXECUTIVE, and VIEWER end-to-end tests.
- Live table inspection reported zero rows in the inspected application tables at the time of the check. No local IndexedDB migration was performed, and no application data was deleted or migrated.

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
- Attendance and customer-feedback repository functions now use Supabase in cloud-first mode; attendance history, the executive dashboard, All Feedback, and Customer Detail feedback history now route through cloud repositories. These two feedback history screens no longer query IndexedDB while cloud-first mode is enabled. Remaining screens and direct IndexedDB call sites still require a full audit. Cloud-first remains opt-in and must not be enabled for production yet.
- Settings now disables local-only backup/restore, factory reset, and local user management when cloud-first mode is enabled, to avoid misleading or destructive local-only operations. A proposed trusted `admin-users` Edge Function source file exists in the branch but is **not deployed**; cloud user provisioning remains unavailable until it is reviewed, safely deployed, and connected to the UI.

### Phase 1 — Authentication and authorization
- Use Supabase Auth for the main login/logout/session restoration (initial opt-in implementation added; still requires provisioned users and end-to-end validation).
- Read role and trusted authorization claims only from server-managed `app_metadata`, not editable `user_metadata`.
- Provision the first administrator through a trusted Supabase Dashboard/admin workflow; do not create privileged users from browser code. The proposed `admin-users` function is not live yet.
- Define explicit roles and least-privilege RLS for ADMIN, EXECUTIVE, and any read-only roles before enabling non-admin access.
- Replace the local default administrator seed with a migration notice; never silently grant a new device administrator access.

### Phase 2 — Cloud repositories
- Typed Supabase repositories exist for loans, feedback, attendance, targets, upload sessions, and audit events; direct IndexedDB call sites still need a complete audit.
- Executive attendance history now uses the attendance repository instead of reading IndexedDB directly.
- The audit log's local cryptographic-chain verifier is disabled in cloud-first mode until cloud audit-chain metadata and verification are implemented; this avoids reporting a misleading local-only result.
- System Health Diagnostics now explicitly shows a local-device-only notice in cloud-first mode and does not run the IndexedDB integrity checker against local data while presenting a cloud-first experience.
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

- [ ] Main login uses Supabase Auth and restores/clears sessions correctly; code path is opt-in and still needs end-to-end validation.
- [ ] No default browser-side administrator is seeded.
- [ ] Every protected read/write is denied by RLS to an unauthorized user.
- [ ] All primary features read and write through cloud repositories.
- [ ] Failed cloud writes are visible and do not appear as saved.
- [ ] Migration dry-run reports duplicate IDs and count mismatches.
- [ ] Backup/restore and rollback are documented and tested.
- [ ] Tests, lint, and production build pass.
- [ ] An authenticated admin and representative executive account complete end-to-end smoke tests.

## Live verification (2026-10-29)

- GitHub Actions CI run `40813648520` completed successfully for commit `e99bc4ac266648a1ffd7927a0c1c4205fb20c8b8`, including dependency lockfile sync, install, production build, unit tests, and lint. The subsequent audit-verification guard commit must pass CI before it is treated as verified.
- GitHub Actions CI run `40814609388` (run #75) completed successfully for the subsequent cloud audit-verification guard commit. The latest diagnostics guard and its documentation commits were also reviewed; the most recent CI success available here is run #75. This does not constitute role-based end-to-end or production cutover validation.
- The Supabase security advisor currently reports `auth_leaked_password_protection` as a warning. Enable leaked-password protection in the Supabase Auth security settings before production use: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- The live `pg_policies` inspection showed the expected role-specific policies on loan records, feedback, attendance, targets, upload history, audit log, and user profiles. This verifies policy presence only; it does **not** replace real-user authorization tests.

## Current release decision

Do not switch the live app to cloud-first until Phase 1 and Phase 2 are complete. The `admin-users` function is not deployed, a complete direct-IndexedDB call-site audit remains outstanding, no local-to-cloud migration workflow exists, and role-based end-to-end tests have not been completed. The successful CI run validates build/tests/lint, not production readiness.
