import { createClient } from 'npm:@supabase/supabase-js@2';

const URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
  'access-control-allow-methods': 'POST, OPTIONS',
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};
function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}
const validRoles = new Set(['ADMIN', 'MANAGER', 'EXECUTIVE', 'VIEWER']);
function cleanText(value: unknown, max = 120): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return respond({ error: 'POST required' }, 405);
  if (!URL || !ANON || !SERVICE) return respond({ error: 'Server is not configured' }, 503);
  const bearer = req.headers.get('authorization') ?? '';
  const match = bearer.match(/^Bearer\s+(.+)$/i);
  if (!match) return respond({ error: 'Authentication required' }, 401);

  const authClient = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth, error: authError } = await authClient.auth.getUser(match[1]);
  if (authError || !auth.user) return respond({ error: 'Invalid or expired session' }, 401);
  if (auth.user.app_metadata?.role !== 'ADMIN') return respond({ error: 'Administrator role required' }, 403);

  const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const body = await req.json();
    const action = cleanText(body?.action, 20);
    if (action === 'list') {
      const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 500 });
      if (error) throw error;
      const users = (data.users ?? []).map((u) => ({
        id: u.id,
        email: u.email ?? '',
        name: cleanText(u.app_metadata?.name || u.user_metadata?.name || u.email, 120),
        role: cleanText(u.app_metadata?.role, 20),
        assignedExecutiveName: cleanText(u.app_metadata?.assignedExecutiveName, 120),
        permissions: u.app_metadata?.permissions ?? undefined,
        emailConfirmed: Boolean(u.email_confirmed_at),
      }));
      return respond({ users });
    }
    const id = cleanText(body?.id, 80);
    if (action === 'delete') {
      if (!id) return respond({ error: 'User id required' }, 400);
      if (id === auth.user.id) return respond({ error: 'You cannot delete your own account' }, 400);
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) throw error;
      return respond({ success: true });
    }
    if (action !== 'create' && action !== 'update') return respond({ error: 'Unknown action' }, 400);

    const email = cleanText(body?.email, 254).toLowerCase();
    const name = cleanText(body?.name, 120);
    const role = cleanText(body?.role, 20);
    const assignedExecutiveName = cleanText(body?.assignedExecutiveName, 120);
    const views = Array.isArray(body?.permissions?.views)
      ? body.permissions.views.filter((v: unknown) => typeof v === 'string').slice(0, 100)
      : [];
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return respond({ error: 'A valid email is required' }, 400);
    if (!name) return respond({ error: 'Name is required' }, 400);
    if (!validRoles.has(role)) return respond({ error: 'Invalid role' }, 400);
    if (role === 'EXECUTIVE' && !assignedExecutiveName) return respond({ error: 'Executive data mapping is required for EXECUTIVE accounts' }, 400);

    const app_metadata = { role, name, assignedExecutiveName, permissions: { views } };
    if (action === 'create') {
      const password = typeof body?.password === 'string' ? body.password : '';
      if (password.length < 12) return respond({ error: 'Set a temporary password with at least 12 characters' }, 400);
      const { data, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, app_metadata, user_metadata: { name },
      });
      if (error) throw error;
      return respond({ success: true, user: { id: data.user.id, email: data.user.email, name, role, assignedExecutiveName, permissions: { views } } }, 201);
    }

    if (!id) return respond({ error: 'User id required' }, 400);
    if (id === auth.user.id && role !== 'ADMIN') return respond({ error: 'You cannot remove your own administrator role' }, 400);
    const { data, error } = await admin.auth.admin.updateUserById(id, {
      email, app_metadata, user_metadata: { name },
      ...(typeof body?.password === 'string' && body.password.length >= 12 ? { password: body.password } : {}),
    });
    if (error) throw error;
    return respond({ success: true, user: { id: data.user.id, email: data.user.email, name, role, assignedExecutiveName, permissions: { views } } });
  } catch (error) {
    console.error('[admin-users] request failed', error);
    const message = error instanceof Error ? error.message : 'Request failed';
    return respond({ error: message.slice(0, 300) }, 400);
  }
});
