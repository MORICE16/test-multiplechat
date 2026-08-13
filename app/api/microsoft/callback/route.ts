import { env } from "cloudflare:workers";
import { encryptSecret } from "@/app/lib/secret-crypto";
import { now, runtimeValue, userId } from "@/app/lib/runtime";

function cookies(request: Request) {
  return Object.fromEntries((request.headers.get("cookie") || "").split(";").map(value => value.trim().split(/=(.*)/).slice(0, 2)).filter(([key]) => key));
}

function finish(request: Request, status: "connected" | "error", reason = "") {
  const url = new URL("/", request.url);
  url.searchParams.set("microsoft", status);
  if (reason) url.searchParams.set("reason", reason.slice(0, 160));
  const response = new Response(null, { status: 302, headers: { Location: url.toString() } });
  response.headers.append("Set-Cookie", "morice_ms_state=; Path=/api/microsoft; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
  response.headers.append("Set-Cookie", "morice_ms_verifier=; Path=/api/microsoft; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
  return response;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const saved = cookies(request);
    const state = url.searchParams.get("state") || "";
    const code = url.searchParams.get("code") || "";
    if (!state || state !== saved.morice_ms_state || !code || !saved.morice_ms_verifier) return finish(request, "error", "Autorisation Microsoft expirée. Recommence la connexion.");

    const clientId = runtimeValue("MICROSOFT_CLIENT_ID");
    const clientSecret = runtimeValue("MICROSOFT_CLIENT_SECRET");
    const tenant = runtimeValue("MICROSOFT_TENANT_ID") || "common";
    if (!clientId || !clientSecret) return finish(request, "error", "Configuration Microsoft incomplète.");

    const redirectUri = new URL("/api/microsoft/callback", request.url).toString();
    const tokenResponse = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        code_verifier: saved.morice_ms_verifier,
      }),
    });
    const token = await tokenResponse.json() as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error_description?: string };
    if (!tokenResponse.ok || !token.access_token || !token.refresh_token) return finish(request, "error", token.error_description || "Microsoft n’a pas fourni les autorisations nécessaires.");

    const profileResponse = await fetch("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName", { headers: { Authorization: `Bearer ${token.access_token}` } });
    const profile = await profileResponse.json().catch(() => ({})) as { mail?: string; userPrincipalName?: string };
    const expiresAt = new Date(Date.now() + Math.max(60, token.expires_in || 3600) * 1000).toISOString();
    await env.DB.prepare("INSERT INTO morice_connections(user_id,provider,access_token,refresh_token,expires_at,account_email,scopes,status,updated_at) VALUES(?,'microsoft',?,?,?,?,?,'connected',?) ON CONFLICT(user_id,provider) DO UPDATE SET access_token=excluded.access_token,refresh_token=excluded.refresh_token,expires_at=excluded.expires_at,account_email=excluded.account_email,scopes=excluded.scopes,status='connected',updated_at=excluded.updated_at")
      .bind(userId(request), await encryptSecret(token.access_token), await encryptSecret(token.refresh_token), expiresAt, profile.mail || profile.userPrincipalName || "", token.scope || "", now()).run();
    return finish(request, "connected");
  } catch (error) {
    return finish(request, "error", error instanceof Error ? error.message : "Connexion Microsoft impossible.");
  }
}
