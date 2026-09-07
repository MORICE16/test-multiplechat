import { env } from "cloudflare:workers";
import { decryptSecret, encryptSecret } from "./secret-crypto";
import { now, runtimeValue } from "./runtime";

export type ActionPayload = {
  to?: string | null;
  subject?: string | null;
  body?: string | null;
  start?: string | null;
  end?: string | null;
  timezone?: string | null;
  list?: string | null;
  query?: string | null;
  notes?: string | null;
  webhookEvent?: string | null;
};

type ConnectionRow = {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  account_email: string;
  scopes: string;
};

async function connection(uid: string) {
  return env.DB.prepare("SELECT access_token, refresh_token, expires_at, account_email, scopes FROM morice_connections WHERE user_id = ? AND provider = 'microsoft' AND status = 'connected'").bind(uid).first<ConnectionRow>();
}

async function accessToken(uid: string) {
  const stored = await connection(uid);
  if (!stored) throw new Error("Connecte d’abord Microsoft 365 dans Connexions.");

  if (new Date(stored.expires_at).getTime() > Date.now() + 60_000) {
    return decryptSecret(stored.access_token);
  }

  const clientId = runtimeValue("MICROSOFT_CLIENT_ID");
  const clientSecret = runtimeValue("MICROSOFT_CLIENT_SECRET");
  const tenant = runtimeValue("MICROSOFT_TENANT_ID") || "common";
  if (!clientId || !clientSecret) throw new Error("La connexion Microsoft 365 n’est pas configurée.");

  const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: await decryptSecret(stored.refresh_token),
      scope: stored.scopes,
    }),
  });
  const token = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number; error_description?: string };
  if (!response.ok || !token.access_token) throw new Error(token.error_description || "Microsoft 365 demande une nouvelle autorisation.");

  const refreshToken = token.refresh_token || await decryptSecret(stored.refresh_token);
  const expiresAt = new Date(Date.now() + Math.max(60, token.expires_in || 3600) * 1000).toISOString();
  await env.DB.prepare("UPDATE morice_connections SET access_token = ?, refresh_token = ?, expires_at = ?, updated_at = ? WHERE user_id = ? AND provider = 'microsoft'")
    .bind(await encryptSecret(token.access_token), await encryptSecret(refreshToken), expiresAt, now(), uid).run();
  return token.access_token;
}

async function graph(uid: string, path: string, init?: RequestInit) {
  const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${await accessToken(uid)}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const payload = response.status === 204 ? null : await response.json().catch(() => null) as { error?: { message?: string } } | null;
  if (!response.ok) throw new Error(payload?.error?.message || `Microsoft 365 a refusé l’action (${response.status}).`);
  return payload as Record<string, unknown> | null;
}

export async function runMicrosoftAction(uid: string, operation: string, payload: ActionPayload) {
  if (operation === "mail_read") {
    const data = await graph(uid, "/me/messages?$top=5&$orderby=receivedDateTime%20desc&$select=subject,from,receivedDateTime,isRead") as { value?: Array<{ subject?: string; from?: { emailAddress?: { name?: string } }; isRead?: boolean }> };
    const rows = data?.value || [];
    return rows.length ? rows.map(message => `${message.isRead ? "Lu" : "Non lu"} — ${message.from?.emailAddress?.name || "Expéditeur inconnu"} : ${message.subject || "Sans objet"}`).join("\n") : "Aucun mail récent.";
  }
  if (operation === "calendar_read") {
    const start = encodeURIComponent(new Date().toISOString());
    const end = encodeURIComponent(new Date(Date.now() + 7 * 86_400_000).toISOString());
    const data = await graph(uid, `/me/calendarView?startDateTime=${start}&endDateTime=${end}&$top=10&$orderby=start/dateTime&$select=subject,start,end,location`) as { value?: Array<{ subject?: string; start?: { dateTime?: string }; location?: { displayName?: string } }> };
    const rows = data?.value || [];
    return rows.length ? rows.map(event => `${event.start?.dateTime || "Date inconnue"} — ${event.subject || "Sans titre"}${event.location?.displayName ? ` (${event.location.displayName})` : ""}`).join("\n") : "Aucun rendez-vous dans les sept prochains jours.";
  }
  if (operation === "onedrive_search") {
    const safeQuery = (payload.query || payload.subject || "").replace(/'/g, "''");
    if (!safeQuery) throw new Error("Indique ce que Morice doit chercher dans OneDrive.");
    const data = await graph(uid, `/me/drive/root/search(q='${encodeURIComponent(safeQuery)}')?$top=10&$select=name,webUrl,lastModifiedDateTime`) as { value?: Array<{ name?: string; webUrl?: string }> };
    const rows = data?.value || [];
    return rows.length ? rows.map(file => `${file.name || "Document"}${file.webUrl ? ` — ${file.webUrl}` : ""}`).join("\n") : "Aucun document correspondant dans OneDrive.";
  }
  if (operation === "mail_draft") {
    await graph(uid, "/me/messages", { method: "POST", body: JSON.stringify({
      subject: payload.subject || "Brouillon préparé par Morice",
      body: { contentType: "Text", content: payload.body || payload.notes || "" },
      toRecipients: payload.to ? [{ emailAddress: { address: payload.to } }] : [],
    }) });
    return "Le brouillon Outlook a été créé.";
  }
  if (operation === "mail_send") {
    if (!payload.to) throw new Error("L’adresse du destinataire manque.");
    await graph(uid, "/me/sendMail", { method: "POST", body: JSON.stringify({ message: {
      subject: payload.subject || "Message de Morice",
      body: { contentType: "Text", content: payload.body || payload.notes || "" },
      toRecipients: [{ emailAddress: { address: payload.to } }],
    }, saveToSentItems: true }) });
    return "Le mail a été envoyé par Outlook.";
  }
  if (operation === "calendar_create") {
    if (!payload.start || !payload.end) throw new Error("La date de début et la date de fin manquent.");
    await graph(uid, "/me/events", { method: "POST", body: JSON.stringify({
      subject: payload.subject || "Rendez-vous Morice",
      body: { contentType: "Text", content: payload.body || payload.notes || "" },
      start: { dateTime: payload.start, timeZone: payload.timezone || "Europe/Paris" },
      end: { dateTime: payload.end, timeZone: payload.timezone || "Europe/Paris" },
      attendees: payload.to ? [{ emailAddress: { address: payload.to }, type: "required" }] : [],
    }) });
    return "Le rendez-vous a été créé dans Outlook.";
  }
  if (operation === "todo_create") {
    const lists = await graph(uid, "/me/todo/lists?$top=20&$select=id,displayName") as { value?: Array<{ id?: string; displayName?: string }> };
    const wanted = (payload.list || "Tasks").toLocaleLowerCase("fr");
    const list = (lists?.value || []).find(item => item.displayName?.toLocaleLowerCase("fr") === wanted) || lists?.value?.[0];
    if (!list?.id) throw new Error("Aucune liste Microsoft To Do n’est disponible.");
    await graph(uid, `/me/todo/lists/${encodeURIComponent(list.id)}/tasks`, { method: "POST", body: JSON.stringify({ title: payload.subject || payload.body || "Tâche Morice", body: { content: payload.notes || "", contentType: "text" } }) });
    return "La tâche a été créée dans Microsoft To Do.";
  }
  throw new Error("Cette action Microsoft n’est pas encore prise en charge.");
}

export async function runMakeAction(payload: ActionPayload, requestId = "") {
  const webhook = runtimeValue("MAKE_WEBHOOK_URL");
  if (!webhook) throw new Error("Le webhook Make n’est pas encore configuré.");
  const response = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source: "Morice Online",
      package: "morice-online",
      requestId,
      title: payload.subject || "Action demandée à Morice",
      text: payload.body || payload.notes || "Créer une tâche Microsoft To Do à partir de cette demande Morice.",
      timestamp: now(),
      event: payload.webhookEvent || "todo_create",
      payload,
    }),
  });
  if (!response.ok) throw new Error(`Make a refusé l’action (${response.status}).`);
  return "L’automatisation Make a été déclenchée.";
}
