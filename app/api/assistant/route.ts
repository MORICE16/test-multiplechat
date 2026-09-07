import { env } from "cloudflare:workers";
import { runMicrosoftAction, type ActionPayload } from "@/app/lib/microsoft";
import { now, runtimeValue, userId } from "@/app/lib/runtime";

type Intent = "task" | "memory" | "mail_read" | "mail_draft" | "mail_send" | "calendar_read" | "calendar_create" | "todo_create" | "onedrive_search" | "make_trigger" | "answer";
type Plan = {
  intent: Intent;
  title: string;
  reply: string;
  requiresApproval: boolean;
  provider: "local" | "microsoft" | "make";
  operation: string;
  payload: Required<{ [Key in keyof ActionPayload]: string | null }>;
};

const writeIntents = new Set<Intent>(["mail_draft", "mail_send", "calendar_create", "todo_create", "make_trigger"]);

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function conciseTitle(message: string) {
  const cleaned = message.replace(/^(morice[,\s:]*)/i, "").replace(/^(rappelle[- ]moi|ajoute(?: une)? tâche|mémorise|retiens|souviens[- ]toi|note que|prépare|crée)\s*/i, "").trim();
  const title = cleaned || message.trim();
  return title.length > 88 ? `${title.slice(0, 85).trim()}…` : title;
}

function emptyPayload(): Plan["payload"] {
  return { to: null, subject: null, body: null, start: null, end: null, timezone: null, list: null, query: null, notes: null, webhookEvent: null };
}

function localPlan(message: string, mode: string): Plan {
  const text = normalized(message);
  const payload = emptyPayload();
  if (mode === "memory" || /\b(memorise|retiens|souviens-toi|souviens toi|note que|garde en memoire)\b/.test(text)) {
    return { intent: "memory", title: conciseTitle(message), reply: "C’est mémorisé dans la mémoire longue durée de Morice.", requiresApproval: false, provider: "local", operation: "memory", payload };
  }
  if (mode === "approval" || /\b(envoie|envoies|publie|declenche|automatise)\b/.test(text)) {
    payload.body = message;
    payload.webhookEvent = "morice.action";
    return { intent: "make_trigger", title: conciseTitle(message), reply: "Cette action est prête dans Validations. Rien ne partira sans ton accord.", requiresApproval: true, provider: "make", operation: "make_trigger", payload };
  }
  return { intent: "task", title: conciseTitle(message), reply: "C’est fait : la tâche est ajoutée au suivi de Morice.", requiresApproval: false, provider: "local", operation: "task", payload };
}

async function intelligentPlan(message: string, mode: string): Promise<Plan> {
  if (mode === "task" || mode === "memory") return localPlan(message, mode);
  const key = runtimeValue("OPENAI_API_KEY");
  if (!key) {
    if (mode === "approval") return localPlan(message, mode);
    throw new Error("OPENAI_NOT_CONFIGURED");
  }
  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      intent: { type: "string", enum: ["task", "memory", "mail_read", "mail_draft", "mail_send", "calendar_read", "calendar_create", "todo_create", "onedrive_search", "make_trigger", "answer"] },
      title: { type: "string" },
      reply: { type: "string" },
      requiresApproval: { type: "boolean" },
      provider: { type: "string", enum: ["local", "microsoft", "make"] },
      operation: { type: "string" },
      payload: {
        type: "object",
        additionalProperties: false,
        properties: Object.fromEntries(["to", "subject", "body", "start", "end", "timezone", "list", "query", "notes", "webhookEvent"].map(keyName => [keyName, { type: ["string", "null"] }])),
        required: ["to", "subject", "body", "start", "end", "timezone", "list", "query", "notes", "webhookEvent"],
      },
    },
    required: ["intent", "title", "reply", "requiresApproval", "provider", "operation", "payload"],
  };
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: runtimeValue("OPENAI_MODEL") || "gpt-5-mini",
      input: [
        { role: "system", content: `Tu es le moteur d’actions privé de Morice pour Alan. Date actuelle: ${now()}. Analyse la demande en français. Les intentions autorisées sont: task et memory (stockage local immédiat); mail_read, calendar_read, onedrive_search (lecture Microsoft immédiate); mail_draft, mail_send, calendar_create, todo_create (toujours validation humaine avant écriture Microsoft); make_trigger (toujours validation humaine); answer (réponse utile sans prétendre avoir agi). HubSpot est indisponible: ne prétends jamais y accéder. N’invente jamais une adresse, une date ou un contenu absent. Pour les dates, produis ISO 8601 et Europe/Paris par défaut. Le mode demandé est ${mode}. Si le mode vaut task, memory ou approval, respecte-le; approval doit produire une action Make à valider si aucune intégration plus précise n’est demandée. Réponds brièvement.` },
        { role: "user", content: message },
      ],
      text: { format: { type: "json_schema", name: "morice_action", strict: true, schema } },
      max_output_tokens: 700,
    }),
  });
  const result = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }>; error?: { message?: string } };
  if (!response.ok) throw new Error(result.error?.message || "OpenAI n’a pas pu analyser la demande.");
  const outputText = result.output_text || result.output?.flatMap(item => item.content || []).map(item => item.text || "").join("") || "";
  const plan = JSON.parse(outputText) as Plan;
  if (!plan.title?.trim()) plan.title = conciseTitle(message);
  if (mode === "approval" && !writeIntents.has(plan.intent)) return localPlan(message, "approval");
  if (writeIntents.has(plan.intent)) plan.requiresApproval = true;
  return plan;
}

async function insertItem(uid: string, kind: "task" | "memory" | "approval", title: string, content: string, status: string) {
  const id = crypto.randomUUID();
  const position = Number((await env.DB.prepare("SELECT COALESCE(MAX(position), -1) + 1 AS value FROM morice_items WHERE user_id = ? AND kind = ?").bind(uid, kind).first<{ value: number }>())?.value || 0);
  await env.DB.prepare("INSERT INTO morice_items (id,user_id,kind,title,content,status,priority,position,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .bind(id, uid, kind, title, content, status, "normal", position, now(), now()).run();
  return id;
}

export async function POST(request: Request) {
  const uid = userId(request);
  const body = await request.json() as { message?: unknown; mode?: unknown };
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const mode = typeof body.mode === "string" ? body.mode : "auto";
  if (!message) return Response.json({ error: "Écris d’abord ce que Morice doit faire." }, { status: 400 });
  if (message.length > 1200) return Response.json({ error: "Cette demande est trop longue. Garde-la sous 1 200 caractères." }, { status: 400 });

  let plan: Plan;
  try {
    plan = await intelligentPlan(message, mode);
  } catch {
    return Response.json({ error: "L’analyse OpenAI est momentanément indisponible. Aucune tâche ni action n’a été créée." }, { status: 502 });
  }

  if (plan.intent === "task" || plan.intent === "memory") {
    const id = await insertItem(uid, plan.intent, plan.title, message, "open");
    return Response.json({ ok: true, reply: plan.reply, action: { id, kind: plan.intent, title: plan.title, content: message, status: "open", label: plan.intent === "task" ? "Tâche créée" : "Information mémorisée", view: plan.intent === "task" ? "tasks" : "memory" } });
  }

  if (["mail_read", "calendar_read", "onedrive_search"].includes(plan.intent)) {
    try {
      const result = await runMicrosoftAction(uid, plan.intent, plan.payload);
      return Response.json({ ok: true, reply: result, action: { id: "", kind: "result", title: plan.title, content: result, status: "done", label: "Résultat Microsoft 365", view: plan.intent === "mail_read" ? "mail" : plan.intent === "calendar_read" ? "calendar" : "documents" } });
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : "Lecture Microsoft impossible." }, { status: 409 });
    }
  }

  if (writeIntents.has(plan.intent)) {
    const makeHandlesTodo = plan.intent === "todo_create" && Boolean(runtimeValue("MAKE_WEBHOOK_URL")) && !runtimeValue("MICROSOFT_CLIENT_ID");
    const provider = plan.intent === "make_trigger" || makeHandlesTodo ? "make" : "microsoft";
    if (makeHandlesTodo) {
      plan.payload.webhookEvent = "todo_create";
      plan.payload.body ||= plan.payload.subject || message;
    }
    const id = await insertItem(uid, "approval", plan.title, message, "pending");
    await env.DB.prepare("INSERT INTO morice_action_payloads(item_id,user_id,provider,operation,payload,result,created_at) VALUES(?,?,?,?,?,'',?)")
      .bind(id, uid, provider, plan.intent, JSON.stringify(plan.payload), now()).run();
    return Response.json({ ok: true, reply: "L’action est préparée. Alan doit la valider avant toute modification externe.", action: { id, kind: "approval", title: plan.title, content: message, status: "pending", label: "Validation demandée", view: "approvals" } });
  }

  return Response.json({ ok: true, reply: plan.reply || "Je peux transformer cette demande en tâche, mémoire ou action connectée.", action: { id: "", kind: "result", title: plan.title, content: plan.reply, status: "done", label: "Réponse de Morice", view: "chat" } });
}
