import { runtimeValue, userId } from "../../lib/runtime";
import { synthesizeSpeech } from "../../lib/speech";

export async function POST(request: Request) {
  try { userId(request); } catch { return Response.json({ error: "Authentification requise." }, { status: 401 }); }
  return synthesizeSpeech(request, runtimeValue("OPENAI_API_KEY"));
}
