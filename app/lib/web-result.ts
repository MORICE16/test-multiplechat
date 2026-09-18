export type Citation = { start: number; end: number; url: string; title: string };
export type WebResult = { text: string; citations: Citation[]; sources: { url: string; title: string }[]; responseId: string; checkedAt: string; tool: string };
export type ModelResponse = {
  id?: string; status?: string; error?: { code?: string };
  output?: Array<{ type?: string; status?: string; content?: Array<{ type?: string; text?: string; annotations?: Array<{ type?: string; start_index?: number; end_index?: number; url?: string; title?: string }> }> }>;
};
export function safeWebUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
}
export function webResult(response: ModelResponse): WebResult {
  if (response.status !== "completed") throw new Error("La recherche n’est pas terminée.");
  if (!response.output?.some(item => item.type === "web_search_call" && item.status === "completed")) throw new Error("Le moteur n’a pas effectué de recherche Web vérifiable.");
  let text = ""; const citations: Citation[] = [];
  for (const output of response.output) for (const content of output.content || []) {
    if (typeof content.text !== "string") continue;
    const offset = text.length;
    text += content.text + "\n";
    for (const a of content.annotations || []) {
      if (a.type !== "url_citation" || !safeWebUrl(a.url) || !Number.isInteger(a.start_index) || !Number.isInteger(a.end_index)) continue;
      const start = a.start_index!, end = a.end_index!;
      if (start < 0 || end <= start || end > content.text.length) continue;
      citations.push({ start: offset + start, end: offset + end, url: a.url, title: a.title || new URL(a.url).hostname });
    }
  }
  if (!text.trim() || !citations.length) throw new Error("La recherche n’a pas fourni de résultat sourcé. Aucun résultat vérifié n’est annoncé.");
  return { text: text.trimEnd(), citations, sources: [...new Map(citations.map(c => [c.url, { url: c.url, title: c.title }])).values()], responseId: response.id || "", checkedAt: new Date().toISOString(), tool: "OpenAI · recherche Web" };
}
