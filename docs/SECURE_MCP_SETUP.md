# Secure MCP endpoint

The Edge Function at `supabase/functions/mcp/index.ts` is an authenticated, read-only MCP-over-HTTP endpoint. It is deliberately separate from the browser's IndexedDB login.

## Required server-side configuration

Configure these Supabase Edge Function secrets; never add service-role credentials to `VITE_*` variables or commit them:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MCP_ALLOWED_ORIGINS` (comma-separated exact origins only if browser clients are required)

The endpoint verifies the bearer token with Supabase Auth and permits calls only when the authenticated user's server-controlled `app_metadata.role` is `ADMIN`. Do not use `user_metadata.role` for authorization.

## Current tools

- `get_status`: authenticated status and access mode.
- `list_tables`: checks the approved workstation tables and row counts.
- `search_loan_records`: read-only agreement-ID search, maximum 25 rows.

The endpoint does not create tables, mutate customer data, or modify the live database. The current live project was previously found to have no public tables, so `list_tables` will report missing tables until the reviewed schema/migrations are deliberately applied.

## Important limitations

The workstation's existing app login is local IndexedDB authentication and does not issue a Supabase Auth JWT. MCP clients must use a real Supabase Auth session with server-controlled ADMIN app metadata. Do not deploy this endpoint for operational use until the identity mapping and table schema are reviewed. Cross-device synchronization also requires a separate authenticated relay; the browser BroadcastChannel transport only works between tabs on the same origin and device.
