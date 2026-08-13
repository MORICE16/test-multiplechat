import { env } from "cloudflare:workers";

type ActionKind = "task" | "memory" | "approval";

const now = () => new Date().toISOString();

function userId(request: Request) {
  return request.headers.get("oai-authenticated-user-id") || "alan";
}

function normalized(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function conciseTitle(message: string) {
  const cleaned = message
    .replace(/^(morice[,\s:]*)/i, "")
    .replace(/^(rappelle[- ]moi|ajoute(?: une)? t[aâ]che|m[eé]morise|retiens|souviens[- ]toi|note que|pr[eé]pare|cr[eé]e)\s*/i, "")
    .trim();
  const title = cleaned || message.trim();
  return title.length > 88 ? `${title.slice(0, 85).trim()}…` : title;
}

function detectKind(message: string, requestedMode: string): ActionKind {
  if (["task", "memory", "approval"].includes(requestedMode)) return requestedMode as ActionKind;

  const text = normalized(message);
  if (/\b(memorise|retiens|souviens-toi|souviens toi|note que|garde en memoire)\b/.test(text)) return "memory";
  if (/\b(envoie|envoies|reponds|publie|supprime|achete|paie|confirme|brouillon|mail|courriel|message a)\b/.test(text)) return "approval";
  return "task";
}

export async function POST(request: Request) {
  const uid = userId(request);
  const body = await request.json() as { message?: unknown; mode?: unknown };
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const requestedMode = typeof body.mode === "string" ? body.mode : "auto";

  if (!message) return Response.json({ error: "Écris d’abord ce que Morice doit faire." }, { status: 400 });
  if (message.length > 1200) return Response.json({ error: "Cette demande est trop longue. Garde-la sous 1 200 caractères." }, { status: 400 });

  const kind = detectKind(message, requestedMode);
  const id = crypto.randomUUID();
  const position = Number((await env.DB
    .prepare("SELECT COALESCE(MAX(position), -1) + 1 AS value FROM morice_items WHERE user_id = ? AND kind = ?")
    .bind(uid, kind)
    .first<{ value: number }>())?.value || 0);
  const title = conciseTitle(message);
  const status = kind === "approval" ? "pending" : "open";

  await env.DB
    .prepare("INSERT INTO morice_items (id,user_id,kind,title,content,status,priority,position,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .bind(id, uid, kind, title, message, status, "normal", position, now(), now())
    .run();

  const result = kind === "task"
    ? {
        reply: "C’est fait : j’ai créé une tâche et je vais la garder dans ton suivi jusqu’à ce qu’elle soit terminée.",
        label: "Tâche créée",
        view: "tasks",
      }
    : kind === "memory"
      ? {
          reply: "C’est mémorisé. Cette information est maintenant conservée dans la mémoire de Morice.",
          label: "Information mémorisée",
          view: "memory",
        }
      : {
          reply: "J’ai préparé cette action dans Validations. Rien d’externe ne sera exécuté sans ton accord.",
          label: "Validation demandée",
          view: "approvals",
        };

  return Response.json({
    ok: true,
    reply: result.reply,
    action: { id, kind, title, content: message, status, label: result.label, view: result.view },
  });
}
