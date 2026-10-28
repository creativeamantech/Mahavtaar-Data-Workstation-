import { FormEvent, useState } from "react";
import { getSupabaseClient, getSupabaseConfig } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type ProbeResult = { label: string; ok: boolean; detail: string };

export default function McpAdmin() {
  const client = getSupabaseClient();
  const config = getSupabaseConfig();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessionEmail, setSessionEmail] = useState("");
  const [results, setResults] = useState<ProbeResult[]>([]);
  const [error, setError] = useState("");

  async function signOut() {
    await client?.auth.signOut();
    setSessionEmail("");
    setResults([]);
    setPassword("");
  }

  async function runProbe(accessToken: string) {
    const response = await fetch(`${config.url}/functions/v1/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${accessToken}`,
        "mcp-protocol-version": "2025-03-26",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.error) {
      throw new Error(body.error?.message || body.error || `MCP returned HTTP ${response.status}`);
    }
    const tools = body.result?.tools;
    if (!Array.isArray(tools)) throw new Error("MCP response did not include a tools list.");
    return tools.map((tool: { name?: string }) => String(tool.name || "Unnamed tool")).join(", ");
  }

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setResults([]);
    try {
      if (!client || !config.isConfigured) {
        throw new Error("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
      }
      const { data, error: loginError } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (loginError || !data.session) throw new Error(loginError?.message || "Supabase sign-in failed.");
      setSessionEmail(data.user.email || email.trim());
      const token = data.session.access_token;
      try {
        const toolNames = await runProbe(token);
        setResults([{ label: "Supabase Auth", ok: true, detail: `Signed in as ${data.user.email || email.trim()}` }, { label: "MCP endpoint", ok: true, detail: `Authenticated. Tools: ${toolNames}` }]);
      } catch (probeError) {
        setResults([{ label: "Supabase Auth", ok: true, detail: `Signed in as ${data.user.email || email.trim()}` }, { label: "MCP endpoint", ok: false, detail: probeError instanceof Error ? probeError.message : "MCP check failed." }]);
      }
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto max-w-xl space-y-6">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Mahavtaar Data Workstation</p>
          <h1 className="mt-1 text-3xl font-semibold">MCP Admin Access</h1>
          <p className="mt-2 text-sm text-muted-foreground">Separate Supabase Auth access for checking the MCP endpoint. Your existing local app login is unchanged.</p>
        </div>
        {!config.isConfigured && <p role="alert" className="rounded-md border border-destructive p-3 text-sm">Supabase URL or anon key is missing from the app environment.</p>}
        <Card>
          <CardHeader>
            <CardTitle>Supabase administrator sign-in</CardTitle>
            <CardDescription>Use a Supabase Auth account whose server-managed app_metadata role is ADMIN. The local IndexedDB password will not work here.</CardDescription>
          </CardHeader>
          <CardContent>
            {sessionEmail ? (
              <div className="space-y-4">
                <p className="text-sm">Signed in as <strong>{sessionEmail}</strong></p>
                <Button type="button" variant="outline" onClick={signOut}>Sign out</Button>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleLogin}>
                <div className="space-y-2"><label htmlFor="mcp-email" className="text-sm font-medium">Email</label><Input id="mcp-email" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required /></div>
                <div className="space-y-2"><label htmlFor="mcp-password" className="text-sm font-medium">Supabase Auth password</label><Input id="mcp-password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></div>
                <Button type="submit" disabled={busy || !config.isConfigured} className="w-full">{busy ? "Checking access…" : "Sign in and test MCP"}</Button>
              </form>
            )}
            {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>
        {results.length > 0 && <Card>
          <CardHeader><CardTitle>Connection check</CardTitle><CardDescription>Live result from this attempt.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {results.map(result => <div key={result.label} className="rounded-md border p-3"><p className="font-medium">{result.ok ? "✓" : "✕"} {result.label}</p><p className="mt-1 break-words text-sm text-muted-foreground">{result.detail}</p></div>)}
          </CardContent>
        </Card>}
        <p className="text-xs text-muted-foreground">This page does not create Supabase users, change roles, deploy functions, or modify database tables. Do not enter your local app password here.</p>
      </div>
    </main>
  );
}
