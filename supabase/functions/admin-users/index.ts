import { createClient } from 'npm:@supabase/supabase-js@2';

const URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const allowedOrigins = new Set(
  (Deno.env.get('ADMIN_USERS_ALLOWED_ORIGINS') ?? 'http://localhost:5173,http://127.0.0.1:5173')
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
const validRoles = new Set(['ADMIN', 'MANAGER', 'EXECUTIVE', 'VIEWER']);
function cleanText(value: unknown, max = 120): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: headersFor(req) });
  if (req.method !== 'POST') return respond(req, { error: 'POST required' }, 405);
  if (!URL || !ANON || !SERVICE) return respond(req, { error: 'Server is not configured' }, 503);
  const bearer = req.headers.get('authorization') ?? '';
  const match = bearer.match(/^Bearer\s+(.+)$/i);
  if (!match) return respond(req, { error: 'Authentication required' }, 401);

  const authClient = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth, error: authError } = await authClient.auth.getUser(match[1]);
  if (authError || !auth.user) return respond(req, { error: 'Invalid or expired session' }, 401);
  if (auth.user.app_metadata?.role !== 'ADMIN') return respond(req, { error: 'Administrator role required' }, 403);

  const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const body = await req.json();
    const action = cleanText(body?.action, 20);
    if (action === 'list') {
      const allUsers = [];
      for (let page = 1; page <= 20; page += 1) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 500 });
        if (error) throw error;
        const pageUsers = data.users ?? [];
        allUsers.push(...pageUsers);
        if (pageUsers.length < 500) break;
      }
      const users = allUsers.map((u) => ({
        id: u.id,
        email: u.email ?? '',
        name: cleanText(u.app_metadata?.name || u.user_metadata?.name || u.email, 120),
        role: cleanText(u.app_metadata?.role, 20),
        assignedExecutiveName: cleanText(u.app_metadata?.assignedExecutiveName, 120),
        permissions: u.app_metadata?.permissions ?? undefined,
        emailConfirmed: Boolean(u.email_confirmed_at),
      }));
      return respond(req, { users });
    }
    const id = cleanText(body?.id, 80);
    if (action === 'delete') {
      if (!id) return respond(req, { error: 'User id required' }, 400);
      if (id === auth.user.id) return respond(req, { error: 'You cannot delete your own account' }, 400);
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) throw error;
      return respond(req, { success: true });
    }
    if (action !== 'create' && action !== 'update') return respond(req, { error: 'Unknown action' }, 400);

    const email = cleanText(body?.email, 254).toLowerCase();
    const name = cleanText(body?.name, 120);
    const role = cleanText(body?.role, 20);
    const assignedExecutiveName = cleanText(body?.assignedExecutiveName, 120);
    const views = Array.isArray(body?.permissions?.views)
      ? body.permissions.views.filter((v: unknown) => typeof v === 'string').slice(0, 100)
      : [];
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return respond(req, { error: 'A valid email is required' }, 400);
    if (!name) return respond(req, { error: 'Name is required' }, 400);
    if (!validRoles.has(role)) return respond(req, { error: 'Invalid role' }, 400);
    if (role === 'EXECUTIVE' && !assignedExecutiveName) return respond(req, { error: 'Executive data mapping is required for EXECUTIVE accounts' }, 400);

    const app_metadata = { role, name, assignedExecutiveName, permissions: { views } };
    if (action === 'create') {
      const password = typeof body?.password === 'string' ? body.password : '';
      if (password.length < 12) return respond(req, { error: 'Set a temporary password with at least 12 characters' }, 400);
      const { data, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, app_metadata, user_metadata: { name },
      });
      if (error) throw error;
      return respond(req, { success: true, user: { id: data.user.id, email: data.user.email, name, role, assignedExecutiveName, permissions: { views } } }, 201);
    }

    if (!id) return respond(req, { error: 'User id required' }, 400);
    if (id === auth.user.id && role !== 'ADMIN') return respond(req, { error: 'You cannot remove your own administrator role' }, 400);
    const { data, error } = await admin.auth.admin.updateUserById(id, {
      email, app_metadata, user_metadata: { name },
      ...(typeof body?.password === 'string' && body.password.length >= 12 ? { password: body.password } : {}),
    });
    if (error) throw error;
    return respond(req, { success: true, user: { id: data.user.id, email: data.user.email, name, role, assignedExecutiveName, permissions: { views } } });
  } catch (error) {
    console.error('[admin-users] request failed', error);
    const message = error instanceof Error ? error.message : 'Request failed';
    return respond(req, { error: message.slice(0, 300) }, 400);
  }
});
