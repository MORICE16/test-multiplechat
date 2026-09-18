export type MailSummary = { id?: string; subject?: string; receivedDateTime?: string; importance?: string; isRead?: boolean; categories?: string[]; from?: { emailAddress?: { name?: string; address?: string } } };
export type MailSuggestion = { subject: string; sender: string; receivedAt: string; categories: string[]; suggestions: string[]; reasons: string[]; priority: string; unread: boolean };
export type MailReview = { account: string; checkedAt: string; hasMore: boolean; messages: MailSuggestion[] };

const rules: [string, RegExp][] = [
  ["Juridique / Notaire", /\b(notaire|notaires|notarial|notariale|notariaux)\b/],
  ["Juridique / Huissier", /\b(huissier|huissiers|commissaire de justice|commissaires de justice)\b/],
  ["Comptabilité / Comptable", /\b(comptable|comptables|expertise comptable|bilan comptable)\b/],
  ["Comptabilité / Factures", /\b(facture|factures|invoice|invoices|avoir comptable)\b/],
  ["Immobilier / Location", /\b(loyer|loyers|quittance|bail|locataire|locataires|syndic|copropriete)\b/],
  ["Énergie / Travaux", /\b(carrefour energie|renovation energetique|pompe a chaleur|isolation|photovoltaique)\b/],
];

export function suggestMail(message: MailSummary): MailSuggestion {
  const subject = (message.subject || "Sans objet").slice(0, 500);
  const sender = (message.from?.emailAddress?.name || message.from?.emailAddress?.address || "Expéditeur inconnu").slice(0, 320);
  // Mail text is data only. Rules run locally; no message body or attachment is requested.
  const text = `${subject} ${sender}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const matches = rules.flatMap(([category, pattern]) => {
    const match = text.match(pattern);
    return match ? [{ category, reason: `Mot repéré dans l’objet ou l’expéditeur : « ${match[0]} ».` }] : [];
  });
  return { subject, sender, receivedAt: message.receivedDateTime || "", categories: message.categories || [],
    suggestions: matches.map(m => m.category), reasons: matches.map(m => m.reason),
    priority: message.importance === "high" ? "Importance haute signalée par Outlook — à vérifier" : "Priorité à examiner",
    unread: message.isRead === false };
}

export async function inspectMailbox(account: string, read: (path: string) => Promise<unknown>): Promise<MailReview> {
  const query = new URLSearchParams({ "$top": "100", "$orderby": "receivedDateTime desc", "$filter": "receivedDateTime ge 2025-01-01T00:00:00Z", "$select": "subject,from,receivedDateTime,importance,isRead,categories" });
  const data = await read(`/me/mailFolders/inbox/messages?${query}`) as { value?: MailSummary[]; "@odata.nextLink"?: string };
  if (!data || !Array.isArray(data.value)) throw new Error("La lecture de la boîte est incomplète.");
  return { account, checkedAt: new Date().toISOString(), hasMore: Boolean(data["@odata.nextLink"]), messages: data.value.slice(0, 100).map(suggestMail) };
}

export function mailReviewText(review: MailReview) {
  const counts = new Map<string, number>();
  for (const message of review.messages) for (const category of message.suggestions.length ? message.suggestions : ["À examiner"]) counts.set(category, (counts.get(category) || 0) + 1);
  return `Préparation du classement — ${review.account || "boîte Microsoft connectée"}\n${review.messages.length} messages récents examinés dans la boîte de réception depuis le 1er janvier 2025.${review.hasMore ? " Il reste d’autres messages : cet aperçu n’est pas exhaustif." : " Les autres dossiers ne sont pas inclus."}\n${Array.from(counts, ([name, count]) => `${name} : ${count}`).join("\n")}\nPropositions par mots-clés dans les objets et expéditeurs, à vérifier dans Emails. Aucun message déplacé, modifié ni envoyé. Une seule boîte connectée est couverte; les autres comptes et le classement Outlook restent à raccorder.`;
}
