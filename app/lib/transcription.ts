const LIMIT = 20 * 1024 * 1024;
const formats: Record<string, string> = { "audio/webm": "webm", "video/webm": "webm", "audio/mp4": "mp4", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/x-wav": "wav", "audio/ogg": "ogg" };
const json = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function transcribeAudio(request: Request, key: string, call: typeof fetch = fetch) {
  if (!key) return json({ error: "La transcription n’est pas configurée." }, 503);
  const type = request.headers.get("content-type")?.split(";")[0].trim() || "";
  if (!formats[type]) return json({ error: "Format audio non pris en charge." }, 415);
  if (Number(request.headers.get("content-length")) > LIMIT) return json({ error: "Audio trop volumineux (20 Mo maximum). Téléchargez-le pour le conserver." }, 413);
  const reader = request.body?.getReader();
  if (!reader) return json({ error: "Enregistrement vide." }, 400);
  const chunks: Uint8Array<ArrayBuffer>[] = []; let size = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength;
      if (size > LIMIT) { await reader.cancel(); return json({ error: "Audio trop volumineux (20 Mo maximum). Téléchargez-le pour le conserver." }, 413); }
      chunks.push(new Uint8Array(part.value));
    }
    if (!size) return json({ error: "Enregistrement vide." }, 400);
    const form = new FormData();
    form.set("file", new Blob(chunks, { type }), `morice.${formats[type]}`);
    form.set("model", "gpt-4o-mini-transcribe"); form.set("language", "fr");
    const response = await call("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form,
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(90_000)]),
    });
    if (!response.ok) return json({ error: "Transcription indisponible. Votre audio reste dans cette page : réessayez ou téléchargez-le." }, 502);
    const result = await response.json() as { text?: unknown };
    if (typeof result.text !== "string") return json({ error: "Réponse vocale invalide. Réessayez la transcription." }, 502);
    return json({ text: result.text });
  } catch { return json({ error: "Connexion interrompue. Votre audio reste dans cette page : réessayez ou téléchargez-le." }, 502); }
  finally { reader.releaseLock(); }
}
