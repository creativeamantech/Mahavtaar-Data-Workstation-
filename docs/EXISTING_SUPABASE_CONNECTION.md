# Existing Supabase project connection

The workstation should reuse the existing **Mahavtaar Ledger** project. Do not create a second Supabase project or run the older schema setup SQL over the live database.

## Browser application configuration

Configure these variables in the deployment environment (and locally in an ignored `.env.local` file):

- `VITE_SUPABASE_URL=https://ycyxlldgserhtaepzhll.supabase.co`
- `VITE_SUPABASE_ANON_KEY=<Supabase publishable/anon key>`

The anon/publishable key is intended for browser use; row-level security must remain enabled. Never put a service-role key in a `VITE_*` variable, source file, commit, or browser bundle.

For GitHub Actions, add the two values as repository Actions secrets/variables and reference them in the build workflow. For a hosting provider, set them in that provider's environment configuration. Do not commit populated environment files.

## MCP Edge Function secrets

The existing `mcp` Edge Function uses server-side environment values:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- optional `MCP_ALLOWED_TABLES`

Keep the service-role key only in Supabase Edge Function secrets. Do not expose it to the browser or GitHub build artifacts. Verify the secrets in the Supabase dashboard before treating MCP as operational.

## Access and data safety

- The database already has role-based RLS policies. Authorization uses server-controlled `app_metadata.role`; do not trust `user_metadata.role`.
- Local IndexedDB user/password records must not be uploaded to cloud tables.
- Test authentication and read access before enabling any push/bidirectional sync.
- Do not run schema-reset SQL, drop tables, disable RLS, or bulk-upload local data as part of connection setup.
- The current database's workstation tables were observed empty during the integration audit; confirm the intended source of truth before any first upload.
- The deployed MCP function is read-only and intended for authenticated ADMIN users. Verify server secrets and CORS/origin policy before connecting additional clients.
