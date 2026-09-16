import { runtimeValue, userId } from "../../lib/runtime";
import { transcribeAudio } from "../../lib/transcription";

export async function POST(request: Request) {
  try { userId(request); }
  catch { return Response.json({ error: "Authentification requise." }, { status: 401 }); }
  return transcribeAudio(request, runtimeValue("OPENAI_API_KEY"));
}
