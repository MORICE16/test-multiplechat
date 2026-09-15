import { runMicrosoftAction } from "@/app/lib/microsoft";
import { now, userId } from "@/app/lib/runtime";

export async function GET(request: Request) {
  const uid = userId(request);
  const operation = new URL(request.url).searchParams.get("operation") || "calendar_read";
  if (!["calendar_read", "mail_read"].includes(operation)) return Response.json({ error: "Cette route autorise uniquement la lecture de l’agenda ou des mails." }, { status: 400 });
  try {
    const result = await runMicrosoftAction(uid, operation, {});
    return Response.json({ ok: true, result, checkedAt: now() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Microsoft 365 n’a pas confirmé la lecture. Vérifie la connexion et ses autorisations dans Connexions." }, { status: 502 });
  }
}
