import { createClient } from 'npm:@supabase/supabase-js@2';

const URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const allowedOrigins = new Set(
  (Deno.env.get('STAFF_DIRECTORY_ALLOWED_ORIGINS') ?? Deno.env.get('ADMIN_USERS_ALLOWED_ORIGINS') ?? 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);

function headersFor(req: Request): Headers {
  const headers = new Headers({
    'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
    'access-control-allow-methods': 'POST, OPTIONS',
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'vary': 'Origin',
  });
  const origin = req.headers.get('origin');
  if (origin && allowedOrigins.has(origin)) headers.set('access-control-allow-origin', origin);
  return headers;
}

function respond(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: headersFor(req) });
}

function cleanText(value: unknown, max = 120): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: headersFor(req) });
  if (req.method !== 'POST') return respond(req, { error: 'POST required' }, 405);
  if (!URL || !ANON || !SERVICE) return respond(req, { error: 'Server is not configured' }, 503);

  const bearer = req.headers.get('authorization') ?? '';
  const match = bearer.match(/^Bearer\\s+(.+)$/i);
  if (!match) return respond(req, { error: 'Authentication required' }, 401);

  const authClient = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth, error: authError } = await authClient.auth.getUser(match[1]);
  if (authError || !auth.user) return respond(req, { error: 'Invalid or expired session' }, 401);

  const role = cleanText(auth.user.app_metadata?.role, 20);
  if (!['ADMIN', 'MANAGER'].includes(role)) return respond(req, { error: 'Staff directory access denied' }, 403);

  try {
    const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
    const users = [];
    for (let page = 1; page <= 20; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 500 });
      if (error) throw error;
      const pageUsers = data.users ?? [];
      users.push(...pageUsers);
      if (pageUsers.length < 500) break;
    }

    const staff = users
      .filter((u) => ['MANAGER', 'EXECUTIVE'].includes(cleanText(u.app_metadata?.role, 20)) && !u.banned_until)
      .map((u) => ({
        id: u.id,
        name: cleanText(u.app_metadata?.name || u.user_metadata?.name || u.email, 120),
        role: cleanText(u.app_metadata?.role, 20),
        assignedExecutiveName: cleanText(u.app_metadata?.assignedExecutiveName, 120) || undefined,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return respond(req, { staff });
  } catch (error) {
    console.error('[staff-directory] request failed', error);
    return respond(req, { error: 'Unable to load staff directory' }, 500);
  }
});
