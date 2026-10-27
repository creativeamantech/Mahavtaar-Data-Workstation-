import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const MCP_PROTOCOL_VERSION = '2025-03-26';

const allowedTables = [
  'loan_records',
  'customer_feedbacks',
  'attendance_logs',
  'state_targets',
  'upload_sessions',
  'audit_log',
] as const;

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

function jsonResponse(body: unknown, status = 200, origin = ''): Response {
  const configuredOrigins = (Deno.env.get('MCP_ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const originAllowed = Boolean(origin && configuredOrigins.includes(origin));
  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'vary': 'Origin',
  });
  if (originAllowed) {
    headers.set('access-control-allow-origin', origin);
    headers.set('access-control-allow-headers', 'authorization, content-type, mcp-protocol-version');
    headers.set('access-control-allow-methods', 'POST, OPTIONS');
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function rpcResult(id: JsonRpcRequest['id'], result: unknown) {
  return { jsonrpc: '2.0', id: id ?? null, result };
}

function rpcError(id: JsonRpcRequest['id'], code: number, message: string) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

function textContent(value: unknown) {
  return [{ type: 'text', text: JSON.stringify(value) }];
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get('origin') ?? '';
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'POST required' }, 405, origin);
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ error: 'MCP server is not configured' }, 503, origin);
  }

  const authorization = request.headers.get('authorization') ?? '';
  const tokenMatch = authorization.match(/^Bearer\s+(.+)$/i);
  if (!tokenMatch) return jsonResponse({ error: 'Bearer token required' }, 401, origin);

  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${tokenMatch[1]}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(tokenMatch[1]);
  if (authError || !authData.user) {
    return jsonResponse({ error: 'Invalid or expired Supabase Auth session' }, 401, origin);
  }

  // Authorization is based on server-controlled app_metadata, never user_metadata.
  if (authData.user.app_metadata?.role !== 'ADMIN') {
    return jsonResponse({ error: 'Admin role required' }, 403, origin);
  }

  let rpc: JsonRpcRequest;
  try {
    rpc = await request.json() as JsonRpcRequest;
  } catch {
    return jsonResponse(rpcError(null, -32700, 'Invalid JSON'), 400, origin);
  }
  if (rpc.jsonrpc !== '2.0' || !rpc.method) {
    return jsonResponse(rpcError(rpc.id, -32600, 'Invalid JSON-RPC request'), 400, origin);
  }

  if (rpc.method === 'initialize') {
    return jsonResponse(rpcResult(rpc.id, {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: 'mahavtaar-data-workstation', version: '0.1.0' },
    }), 200, origin);
  }
  if (rpc.method === 'notifications/initialized') {
    return new Response(null, { status: 202 });
  }
  if (rpc.method === 'ping') return jsonResponse(rpcResult(rpc.id, {}), 200, origin);

  const tools = [
    {
      name: 'get_status',
      description: 'Return authenticated MCP server status without exposing customer data.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
      name: 'list_tables',
      description: 'Check availability and row counts for approved workstation tables.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
      name: 'search_loan_records',
      description: 'Search loan records by agreement ID. Admin-only and read-only; returns at most 25 rows.',
      inputSchema: {
        type: 'object',
        properties: {
          agreement_id: { type: 'string', minLength: 1, maxLength: 100 },
          limit: { type: 'integer', minimum: 1, maximum: 25 },
        },
        required: ['agreement_id'],
        additionalProperties: false,
      },
    },
  ];

  if (rpc.method === 'tools/list') {
    return jsonResponse(rpcResult(rpc.id, { tools }), 200, origin);
  }

  if (rpc.method !== 'tools/call') {
    return jsonResponse(rpcError(rpc.id, -32601, 'Method not found'), 200, origin);
  }

  const params = (rpc.params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
  const args = params.arguments ?? {};
  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    if (params.name === 'get_status') {
      return jsonResponse(rpcResult(rpc.id, {
        content: textContent({
          status: 'authenticated',
          userId: authData.user.id,
          role: 'ADMIN',
          access: 'read-only',
          tier: 'Supabase Free Tier compatible',
        }),
      }), 200, origin);
    }

    if (params.name === 'list_tables') {
      const tables: Record<string, { exists: boolean; rowCount: number | null }> = {};
      for (const table of allowedTables) {
        const { count, error } = await serviceClient
          .from(table)
          .select('*', { count: 'exact', head: true });
        tables[table] = error
          ? { exists: false, rowCount: null }
          : { exists: true, rowCount: count ?? 0 };
      }
      return jsonResponse(rpcResult(rpc.id, { content: textContent({ tables }) }), 200, origin);
    }

    if (params.name === 'search_loan_records') {
      const agreementId = typeof args.agreement_id === 'string' ? args.agreement_id.trim() : '';
      const limit = typeof args.limit === 'number' ? Math.max(1, Math.min(25, Math.floor(args.limit))) : 10;
      if (!agreementId || agreementId.length > 100) {
        return jsonResponse(rpcError(rpc.id, -32602, 'Valid agreement_id is required'), 200, origin);
      }
      const { data, error } = await serviceClient
        .from('loan_records')
        .select('agreementid, customer_name, city, state, bom_bkt, executive_name')
        .ilike('agreementid', `%${agreementId.replace(/[%_\\\\]/g, '')}%`)
        .limit(limit);
      if (error) throw error;
      return jsonResponse(rpcResult(rpc.id, { content: textContent({ count: data?.length ?? 0, records: data ?? [] }) }), 200, origin);
    }

    return jsonResponse(rpcError(rpc.id, -32602, 'Unknown tool'), 200, origin);
  } catch (error) {
    console.error('[MCP] tool execution failed', error);
    return jsonResponse(rpcResult(rpc.id, {
      isError: true,
      content: textContent({ error: 'Tool execution failed; verify database schema and server logs.' }),
    }), 200, origin);
  }
});
