# Secure MCP endpoint

The repository contains an authenticated, read-only MCP-over-HTTP Edge Function at `supabase/functions/mcp/index.ts` and a separate browser admin page at `/mcp-admin` (`src/pages/McpAdmin.tsx`). The admin page uses Supabase Auth and does not change the existing local IndexedDB login.

## Verified live project state (2026-10-28)

- Supabase project: `Mahavtaar Ledger` (`ycyxlldgserhtaepzhll`), status previously verified `ACTIVE_HEALTHY`.
- The live `public` schema currently has no tables.
- MCP Edge Function `mcp` is deployed and `ACTIVE` (version 1); gateway JWT verification is enabled.
- The migration `revoke_public_rls_trigger_execute` is recorded in the live migration history.
- Security Advisor currently reports no findings.
- GitHub Actions CI for the MCP admin page, route, and CORS changes passed: https://github.com/creativeamantech/Mahavtaar-Data-Workstation-/actions/runs/40566295963

## Remaining activation blockers

The MCP endpoint is deployed, but end-to-end operation is not yet verified. Required Edge Function secrets and a separate Supabase Auth admin account have not been verified as configured. The available integration tools do not expose an Edge Function secrets-management or Auth user provisioning action, so those steps must be completed through a trusted Supabase admin process.

## Required server-side configuration

Configure these Supabase Edge Function secrets; never add service-role credentials to `VITE_*` variables or commit them:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MCP_ALLOWED_ORIGINS` (comma-separated exact origins for browser clients; use the exact deployed workstation app origin)

The endpoint verifies the bearer token with Supabase Auth and permits calls only when the authenticated user's server-controlled `app_metadata.role` is `ADMIN`. Do not use `user_metadata.role` for authorization. The admin page's login uses Supabase Auth email/password; it does not create accounts or assign roles.

## Current tools

- `get_status`: authenticated status and access mode.
- `list_tables`: checks the approved workstation tables and row counts.
- `search_loan_records`: read-only agreement-ID search, maximum 25 rows.

The endpoint does not create tables or mutate customer data. Since the live project has no public tables, data tools will not be usable until the intended schema and access policies are reviewed and created.

## Safe activation order

1. Review the intended database schema and row-level security policies. Do not create production tables blindly; the local-first application remains the primary store for now.
2. Create/provision a Supabase Auth admin identity through a trusted admin process and set `app_metadata.role = ADMIN` server-side. Never set this role from the browser or `user_metadata`.
3. Configure the Edge Function secrets listed above.
4. Confirm the workstation app's exact deployed origin and include it in `MCP_ALLOWED_ORIGINS`.
5. Open `/mcp-admin`, sign in with the separate Supabase Auth admin account, and verify that the endpoint returns `get_status`, `list_tables`, and `search_loan_records` in `tools/list`.
6. Only test data tools after the reviewed tables exist and contain approved test data.

## Local-first sync scope

The current sync transport is same-origin browser-tab notification only. It broadcasts a `LOCAL_DATA_CHANGED` signal, not loan/customer records, and it does not mark journal entries as synchronized. It is not cross-device synchronization.

The current local device identity's `publicKeyFingerprint` is a random label, not a fingerprint derived from a cryptographic public key. Peer IDs and this label must not be treated as proof of identity for remote authorization. Because the intended initial use is one Android device, cross-device peer enrollment, cryptographic device identity, and relay are deferred until multi-device sync is a real requirement.

Do not create production tables or enable data tools without a final schema and access-policy review.
