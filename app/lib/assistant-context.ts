export type HistoryMessage = { role: "user" | "assistant"; text: string };

export function boundedHistory(value: unknown): HistoryMessage[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-16).filter((item): item is HistoryMessage =>
    item && (item.role === "user" || item.role === "assistant") && typeof item.text === "string"
  ).map(item => ({ role: item.role, text: item.text.slice(0, 4000) }));
}

export function planningError(status: number, code = "") {
  if (status === 401 || status === 403) return "La clé OpenAI est refusée ou n’a pas accès au modèle configuré.";
  if (code === "insufficient_quota") return "Le crédit API OpenAI est épuisé. L’abonnement ChatGPT ne remplace pas ce crédit.";
  if (status === 429) return "OpenAI limite temporairement les demandes. Réessaie dans un instant.";
  if (status === 404) return "Le modèle OpenAI configuré est introuvable ou inaccessible.";
  return "L’analyse OpenAI est momentanément indisponible.";
}
