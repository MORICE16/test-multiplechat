import { runMicrosoftAction } from "@/app/lib/microsoft";
import { now, userId } from "@/app/lib/runtime";

export async function GET(request: Request) {
  const uid = userId(request);
  const operation = new URL(request.url).searchParams.get("operation") || "calendar_read";
  if (!["calendar_read", "mail_read", "onedrive_search"].includes(operation)) return Response.json({ error: "Cette route autorise uniquement les lectures Microsoft prévues." }, { status: 400 });
  const query = new URL(request.url).searchParams.get('query')?.trim() || '';
  if (operation === 'onedrive_search' && (!query || query.length>200)) return Response.json({error:'Indiquez un mot-clé de 200 caractères maximum.'},{status:400});
  try {
    const result = await runMicrosoftAction(uid, operation, operation === 'onedrive_search' ? {query} : {});
    return Response.json({ ok: true, result, checkedAt: now() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Microsoft 365 n’a pas confirmé la lecture. Vérifie la connexion et ses autorisations dans Connexions." }, { status: 502 });
  }
}
