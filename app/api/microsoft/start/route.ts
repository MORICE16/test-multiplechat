import { runtimeValue } from "@/app/lib/runtime";

const scopes = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "User.Read",
  "Mail.ReadWrite",
  "Mail.Send",
  "Calendars.ReadWrite",
  "Tasks.ReadWrite",
  "Files.Read",
].join(" ");

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function GET(request: Request) {
  const clientId = runtimeValue("MICROSOFT_CLIENT_ID");
  const tenant = runtimeValue("MICROSOFT_TENANT_ID") || "common";
  if (!clientId) return Response.json({ error: "L’identifiant Microsoft de Morice n’est pas encore configuré." }, { status: 503 });

  const state = base64Url(crypto.getRandomValues(new Uint8Array(24)));
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  const redirectUri = new URL("/api/microsoft/callback", request.url).toString();
  const authorize = new URL(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize`);
  authorize.search = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: scopes,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();

  const response = new Response(null, { status: 302, headers: { Location: authorize.toString() } });
  const cookieOptions = "Path=/api/microsoft; HttpOnly; Secure; SameSite=Lax; Max-Age=600";
  response.headers.append("Set-Cookie", `morice_ms_state=${state}; ${cookieOptions}`);
  response.headers.append("Set-Cookie", `morice_ms_verifier=${verifier}; ${cookieOptions}`);
  return response;
}
