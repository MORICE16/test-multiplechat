import { env } from "cloudflare:workers";

export type MicrosoftConnection = { access_token: string; refresh_token: string; expires_at: string; account_email: string; scopes: string };

export async function microsoftConnection(uid: string, accountId = "") {
  if (!accountId) return env.DB.prepare("SELECT access_token,refresh_token,expires_at,account_email,scopes FROM morice_connections WHERE user_id=? AND provider='microsoft' AND status='connected'").bind(uid).first<MicrosoftConnection>();
  return env.DB.prepare("SELECT access_token,refresh_token,expires_at,account_email,scopes FROM morice_microsoft_accounts WHERE user_id=? AND account_id=? AND status='connected'").bind(uid, accountId).first<MicrosoftConnection>();
}

export async function microsoftAccounts(uid: string) {
  const primary = await microsoftConnection(uid);
  const additional = await env.DB.prepare("SELECT account_id AS id,account_email AS email FROM morice_microsoft_accounts WHERE user_id=? AND status='connected' ORDER BY account_email").bind(uid).all<{ id: string; email: string }>();
  return [...(primary ? [{ id: "", email: primary.account_email }] : []), ...additional.results];
}
