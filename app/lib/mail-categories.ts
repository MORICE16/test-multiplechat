export const MAIL_CATEGORIES = ["Juridique / Notaire", "Juridique / Huissier", "Comptabilité / Comptable", "Comptabilité / Factures", "Immobilier / Location", "Énergie / Travaux", "Informations / Newsletters", "Personnel", "À examiner"] as const;
export type CategoryEntry = { id: string; subject: string; category: string };
export type CategoryPlan = { account: string; createdAt: string; entries: CategoryEntry[] };
export type CategoryGraph = (path: string, init?: RequestInit) => Promise<unknown>;
export class CategoryExecutionError extends Error {}

export function categoryPermissions(scopes: string) {
  const granted = new Set(scopes.toLowerCase().split(/\s+/).map(scope => scope.replace(/^https:\/\/graph.microsoft.com\//, "")));
  return { writeMail: granted.has("mail.readwrite"), manageCategories: granted.has("mailboxsettings.readwrite") };
}

export function validateCategoryPlan(plan: CategoryPlan, account: string, timestamp = Date.now()) {
  if (!plan || !account || plan.account.toLowerCase() !== account.toLowerCase()) throw new Error("La boîte connectée a changé. Préparez un nouveau classement.");
  const age = timestamp - Date.parse(plan.createdAt);
  if (!Number.isFinite(age) || age < 0 || age > 30 * 60_000) throw new Error("Cette proposition a expiré. Préparez un nouveau classement.");
  if (!Array.isArray(plan.entries) || !plan.entries.length || plan.entries.length > 10 || new Set(plan.entries.map(entry => entry.id)).size !== plan.entries.length) throw new Error("Sélectionnez de 1 à 10 messages distincts.");
  for (const entry of plan.entries) if (!entry.id || entry.id.length > 2048 || !MAIL_CATEGORIES.includes(entry.category as typeof MAIL_CATEGORIES[number])) throw new Error("Catégorie ou message non valide.");
}

// Each message is read just before writing, with its current version. No move,
// delete, read-state change or replacement of existing categories is performed.
export async function applyCategoryPlan(plan: CategoryPlan, graph: CategoryGraph, progress: (text: string) => Promise<void>) {
  let verified = 0;
  try {
    const catalog = await graph("/me/outlook/masterCategories?$top=100") as { value?: { displayName: string }[]; "@odata.nextLink"?: string };
    if (!Array.isArray(catalog?.value) || catalog["@odata.nextLink"]) throw new Error("Catalogue de catégories incomplet.");
    const known = new Set(catalog.value.map(category => category.displayName));
    for (const name of new Set(plan.entries.map(entry => entry.category))) {
      if (!known.has(name)) {
        await progress(`Création de la catégorie « ${name} » en cours. ${verified} message(s) vérifié(s).`);
        await graph("/me/outlook/masterCategories", { method: "POST", body: JSON.stringify({ displayName: name, color: "preset7" }) });
        known.add(name);
      }
    }
    for (const entry of plan.entries) {
      const path = `/me/messages/${encodeURIComponent(entry.id)}`;
      const current = await graph(`${path}?$select=id,categories`) as { categories?: string[]; "@odata.etag"?: string };
      if (!Array.isArray(current?.categories)) throw new Error("Catégories du message indisponibles.");
      if (!current.categories.includes(entry.category)) {
        if (!current["@odata.etag"]) throw new Error("Version du message indisponible : modification suspendue.");
        await progress(`${verified}/${plan.entries.length} message(s) vérifié(s). Modification en cours : ${entry.subject}. En cas d’interruption, vérifier ce message dans Outlook.`);
        await graph(path, { method: "PATCH", headers: { "If-Match": current["@odata.etag"] }, body: JSON.stringify({ categories: [...current.categories, entry.category] }) });
      }
      const confirmed = await graph(`${path}?$select=categories`) as { categories?: string[] };
      if (!confirmed?.categories?.includes(entry.category) || !current.categories.every(name => confirmed.categories?.includes(name))) throw new Error("Vérification de la modification incomplète.");
      verified++;
      await progress(`${verified}/${plan.entries.length} message(s) classé(s) et relu(s) dans Outlook. Dernier : ${entry.subject} → ${entry.category}.`);
    }
    return `${verified} message(s) classé(s) et vérifié(s) dans ${plan.account}. Catégories précédentes conservées. Aucun envoi, déplacement ou suppression.`;
  } catch {
    throw new CategoryExecutionError(`${verified}/${plan.entries.length} message(s) confirmé(s). Classement interrompu : le dernier changement peut avoir abouti. Consultez Outlook et actualisez les propositions avant de préparer une nouvelle action. Aucune relance automatique.`);
  }
}
