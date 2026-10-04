export type HistoryMessage = { role: "user" | "assistant"; text: string };

export function boundedHistory(value: unknown): HistoryMessage[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-16).filter((item): item is HistoryMessage =>
    item && (item.role === "user" || item.role === "assistant") && typeof item.text === "string"
  ).map(item => ({ role: item.role, text: item.text.slice(0, 4000) }));
}

export function planningError(status: number, code = "", type = "") {
  if (status === 401 || status === 403) return "La clé OpenAI est refusée ou n’a pas accès au modèle configuré.";
  if ([code, type].some(value => ["insufficient_quota", "billing_hard_limit_reached", "billing_not_active"].includes(value))) return "Le crédit ou le plafond API OpenAI bloque la demande. L’abonnement ChatGPT ne remplace pas ce crédit. Aucune recharge automatique effectuée.";
  if (status === 429 && code === "rate_limit_exceeded") return "OpenAI limite temporairement la fréquence ou le volume des demandes. Aucun renvoi automatique.";
  if (status === 429) return "La réponse OpenAI est refusée (HTTP 429). Le quota API ou la fréquence doit être vérifié. Ne relance pas en boucle.";
  if (status === 404) return "Le modèle OpenAI configuré est introuvable ou inaccessible.";
  return "L’analyse OpenAI est momentanément indisponible.";
}
