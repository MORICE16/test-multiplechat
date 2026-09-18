import { env } from "cloudflare:workers";
import { runtimeValue, userId } from "@/app/lib/runtime";

import { microsoftAccounts } from "@/app/lib/microsoft-accounts";

export async function GET(request: Request) {
  const uid = userId(request);
  const microsoft = await env.DB.prepare("SELECT account_email, status FROM morice_connections WHERE user_id = ? AND provider = 'microsoft'").bind(uid).first<{ account_email: string; status: string }>();
  return Response.json({
    openai: { configured: Boolean(runtimeValue("OPENAI_API_KEY")), model: runtimeValue("OPENAI_MODEL") || "gpt-5-mini" },
    microsoft: { configured: Boolean(runtimeValue("MICROSOFT_CLIENT_ID") && runtimeValue("MICROSOFT_CLIENT_SECRET") && runtimeValue("MORICE_ENCRYPTION_KEY")), connected: microsoft?.status === "connected", account: microsoft?.account_email || "", accounts: await microsoftAccounts(uid) },
    make: { configured: Boolean(runtimeValue("MAKE_WEBHOOK_URL")) },
    hubspot: { configured: false, disabled: true, reason: "Aucun accès HubSpot supplémentaire n’est disponible." },
  });
}

export async function DELETE(request: Request) {
  if (request.headers.get("Origin") !== new URL(request.url).origin) return Response.json({ error: "Origine non autorisée." }, { status: 403 });
  await env.DB.prepare("DELETE FROM morice_connections WHERE user_id = ? AND provider = 'microsoft'").bind(userId(request)).run();
  return Response.json({ ok: true });
}
