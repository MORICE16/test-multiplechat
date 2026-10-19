const sections = [
  { operation: "calendar_read", title: "Agenda — sept prochains jours" },
  { operation: "mail_read", title: "Mails — cinq plus récents" },
  { operation: "todo_lists", title: "To Do — listes du compte principal" },
] as const;

type BriefOperation = typeof sections[number]["operation"];

/** Only the existing owner-scoped read operations are used; no inference or writes. */
export async function buildDailyBrief(read: (operation: BriefOperation, signal: AbortSignal) => Promise<string>, signal = AbortSignal.timeout(25_000)) {
  const results: PromiseSettledResult<string>[] = [];
  // Avoid unnecessary refresh concurrency within this brief, not across requests.
  for (const section of sections) {
    try {
      signal.throwIfAborted();
      const text = await read(section.operation, signal);
      if (typeof text !== "string" || !text.trim()) throw new Error("Missing read result");
      results.push({ status: "fulfilled", value: text });
    } catch { results.push({ status: "rejected", reason: "Read unavailable" }); }
  }
  const sources = sections.map((section, index) => ({ operation: section.operation, available: results[index].status === "fulfilled" }));
  const available = sources.filter(source => source.available).length;
  const complete = available === sections.length;
  const heading = complete ? "Votre point quotidien" : `Point quotidien incomplet — ${available}/${sections.length} rubriques disponibles`;
  const text = [heading, "Compte Microsoft principal · lecture seule · sans appel IA", ...sections.map((section, index) => {
    const result = results[index];
    return `${section.title}\n${result.status === "fulfilled" ? result.value : "Rubrique indisponible pour ce contrôle. Réessayez ; si cela persiste, consultez Connexions. Aucun résultat vide n’est déduit de cet échec."}`;
  })].join("\n\n");
  return { text, complete, available, sources };
}
