# Secure MCP endpoint

The repository contains an authenticated, read-only MCP-over-HTTP Edge Function at `supabase/functions/mcp/index.ts` and a separate browser admin page at `/mcp-admin` (`src/pages/McpAdmin.tsx`). The admin page uses Supabase Auth and does not change the existing local IndexedDB login.

## Verified project state (2026-10-28)

- Supabase project: `Mahavtaar Ledger` (`ycyxlldgserhtaepzhll`), status `ACTIVE_HEALTHY`.
- The live `public` schema currently has no tables.
- No Edge Functions are currently deployed to the project.
- Supabase Security Advisor reports that `public.rls_auto_enable()` is a SECURITY DEFINER event-trigger function executable by `anon` and `authenticated`. Read-only inspection confirms it enables RLS on newly created tables in `public`, uses `search_path = pg_catalog`, and catches/logs failures. Its execution grant to public client roles is still unnecessary risk; review/revoke those grants without changing the function's owner/event-trigger behavior, then re-run the advisor: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- GitHub Actions CI for the MCP admin page, route, and CORS changes passed: https://github.com/creativeamantech/Mahavtaar-Data-Workstation-/actions

These findings are observations only. This work has not deployed the Edge Function, changed database schema, or modified the live project.

## Required server-side configuration

Configure these Supabase Edge Function secrets; never add service-role credentials to `VITE_*` variables or commit them:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MCP_ALLOWED_ORIGINS` (comma-separated exact origins for browser clients; use the exact deployed app origin)

The endpoint verifies the bearer token with Supabase Auth and permits calls only when the authenticated user's server-controlled `app_metadata.role` is `ADMIN`. Do not use `user_metadata.role` for authorization. The admin page's login uses Supabase Auth email/password; it does not create accounts or assign roles.

## Current tools

- `get_status`: authenticated status and access mode.
- `list_tables`: checks the approved workstation tables and row counts.
- `search_loan_records`: read-only agreement-ID search, maximum 25 rows.

The endpoint does not create tables or mutate customer data. Since the live project has no public tables and no deployed Edge Function, MCP is not operational yet. The workstation's current app login is local IndexedDB authentication and does not issue a Supabase Auth JWT. A separate Supabase Auth admin account with server-managed `app_metadata.role = ADMIN` is required.

## Safe activation order

1. Review the intended database schema and row-level security policies. Do not create production tables blindly; the local-first application remains the primary store for now.
2. Review the existing `public.rls_auto_enable()` function and revoke public execution or change its security mode as appropriate. Do not assume this function is safe merely because it exists.
3. Create/provision a Supabase Auth admin identity through a trusted admin process and set `app_metadata.role = ADMIN` server-side. Never set this role from the browser or `user_metadata`.
4. Configure the Edge Function secrets and exact `MCP_ALLOWED_ORIGINS` value.
5. Deploy the MCP function, then test sign-in and `tools/list` from `/mcp-admin`. Only test data tools after the reviewed tables exist and contain approved test data.

## Local-first sync scope

The current sync transport is same-origin browser-tab notification only. It broadcasts a `LOCAL_DATA_CHANGED` signal, not loan/customer records, and it does not mark journal entries as synchronized. It is not cross-device synchronization.

The current local device identity's `publicKeyFingerprint` is a random label, not a fingerprint derived from a cryptographic public key. Peer IDs and this label must not be treated as proof of identity for remote authorization. Because the intended initial use is one Android device, cross-device peer enrollment, cryptographic device identity, and relay are deferred until multi-device sync is a real requirement.

Do not deploy a relay or apply database migrations as part of this task. Live database changes require a separate schema and access-policy review.
