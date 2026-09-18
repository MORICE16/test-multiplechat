import { reviewMicrosoftMailbox } from "@/app/lib/microsoft";
import { userId } from "@/app/lib/runtime";

export async function GET(request: Request) {
  const uid = userId(request);
  try {
    return Response.json(await reviewMicrosoftMailbox(uid), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "La lecture des mails n’a pas abouti. Vérifiez Microsoft dans Connexions puis réessayez." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
