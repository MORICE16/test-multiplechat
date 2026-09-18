const json = (error: string, status: number) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

export async function synthesizeSpeech(request: Request, key: string, call: typeof fetch = fetch) {
  const body = await request.json().catch(() => null) as { text?: unknown } | null;
  if (!body || typeof body.text !== "string" || !body.text.trim()) return json("Réponse à lire manquante.", 400);
  if (body.text.length > 4000) return json("Choisissez un passage de moins de 4 000 caractères.", 400);
  if (!key) return json("La voix de Morice n’est pas configurée.", 503);
  try {
    const response = await call("https://api.openai.com/v1/audio/speech", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(90_000)]),
      body: JSON.stringify({ model: "gpt-4o-mini-tts", voice: "cedar", input: body.text, response_format: "mp3", instructions: "Lis ce texte en français, clairement et naturellement. Ne rajoute aucun commentaire." }),
    });
    if (!response.ok) return json("La lecture vocale est indisponible. Le texte reste accessible.", 502);
    const audio = await response.arrayBuffer();
    if (!audio.byteLength) return json("Le service vocal a renvoyé un audio vide.", 502);
    return new Response(audio, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, no-store" } });
  } catch { return json("La connexion vocale a été interrompue. Réessayez la lecture.", 502); }
}
