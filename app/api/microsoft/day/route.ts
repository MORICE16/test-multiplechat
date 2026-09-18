import { readMicrosoftDay } from "@/app/lib/microsoft";
import { validateDayRange } from "@/app/lib/calendar-day";
import { userId } from "@/app/lib/runtime";

const headers = { "Cache-Control": "no-store" };
export async function GET(request: Request) {
  let uid: string;
  try { uid = userId(request); }
  catch { return Response.json({ error: "Authentification requise." }, { status: 401, headers }); }
  const query = new URL(request.url).searchParams;
  let range: { start: string; end: string };
  try { range = validateDayRange(query.get("start"), query.get("end")); }
  catch { return Response.json({ error: "La période de votre journée est invalide. Actualisez la page." }, { status: 400, headers }); }
  try { return Response.json(await readMicrosoftDay(uid, range.start, range.end), { headers }); }
  catch { return Response.json({ error: "Le calendrier est indisponible. Vérifiez Microsoft dans Connexions puis réessayez." }, { status: 502, headers }); }
}
