"use client";
import { useState } from "react";
import type { MailReview } from "../lib/mail-triage";
import { MAIL_CATEGORIES } from "../lib/mail-categories";

export function MailReviewPanel() {
  const [review, setReview] = useState<MailReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("Tous");
  const [page, setPage] = useState(0);
  const [permissions, setPermissions] = useState({ writeMail: false, manageCategories: false });
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [approval, setApproval] = useState<{ id: string; summary: string } | null>(null);
  const [result, setResult] = useState("");
  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/microsoft/triage", { cache: "no-store" });
      const data = await response.json() as MailReview & { error?: string; permissions: typeof permissions };
      if (!response.ok) throw new Error(data.error || "Lecture indisponible.");
      setReview(data); setPermissions(data.permissions); setFilter("Tous"); setPage(0); setSelection({}); setApproval(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Lecture indisponible."); }
    finally { setLoading(false); }
  }
  async function prepare() {
    if (!review) return;
    setLoading(true); setError(""); setResult("");
    try {
      const response = await fetch("/api/microsoft/triage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ account: review.account, entries: Object.entries(selection).map(([id, category]) => ({ id, category })) }) });
      const data = await response.json() as { id: string; summary: string; error?: string };
      if (!response.ok) throw new Error(data.error || "Préparation impossible.");
      setApproval(data);
    } catch (e) { setError(e instanceof Error ? e.message : "Préparation impossible."); }
    finally { setLoading(false); }
  }
  async function apply() {
    if (!approval) return;
    const id = approval.id;
    setLoading(true); setError(""); setApproval(null);
    try {
      const response = await fetch("/api/actions/execute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const data = await response.json() as { result: string; error?: string };
      if (!response.ok) throw new Error(data.error || "Résultat à vérifier dans Outlook avant toute nouvelle tentative.");
      setResult(data.result); setSelection({});
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Réponse perdue : vérifiez Outlook et la rubrique À valider avant toute nouvelle tentative."); }
    finally { setLoading(false); }
  }
  const groups = review ? [...new Set(review.messages.flatMap(message => message.suggestions.length ? message.suggestions : ["À examiner"]))].sort() : [];
  const shown = review?.messages.filter(message => filter === "Tous" || (message.suggestions.length ? message.suggestions : ["À examiner"]).includes(filter)) || [];
  return <section className="panel" aria-label="Préparer le classement des mails">
    <p className="eyebrow">CLASSEMENT À PRÉPARER</p><h2>Organiser ma boîte mail</h2>
    <p>Examiner jusqu’à 100 messages récents de la boîte de réception, depuis janvier 2025. Les autres comptes et dossiers ne sont pas inclus.</p>
    <p>Propositions par mots-clés dans l’objet et l’expéditeur. Choisissez les catégories, puis validez leur ajout dans Outlook. Aucun déplacement, envoi ou suppression.</p>
    <button disabled={loading} onClick={load}>{loading ? "Lecture Microsoft en cours…" : review ? "Actualiser les propositions" : "Préparer le classement"}</button>
    {error && <p role="alert">{error}{review ? " Le résultat ci-dessous provient de la lecture précédente." : ""}</p>}
    {result && <p role="status">{result}</p>}
    {review && <>
      <p role="status"><strong>{review.account || "Compte Microsoft connecté"}</strong> · {review.messages.length} messages examinés · {new Date(review.checkedAt).toLocaleString("fr-FR")}</p>
      {review.hasMore && <p>Il reste des messages plus anciens. Cet aperçu ne couvre pas toute la boîte.</p>}
      {(!permissions.writeMail || !permissions.manageCategories) && <p>Microsoft doit autoriser la création des catégories et le classement. <a href="/api/microsoft/start?categories=1">Autoriser le classement Outlook</a> — choisissez le même compte : {review.account}.</p>}
      <p>Lot de 10 messages maximum. Les catégories existantes sont conservées. Les noms avec « / » organisent les étiquettes ; Outlook ne crée pas de sous-dossiers.</p>
      <button disabled={loading || !Object.keys(selection).length || !permissions.writeMail || !permissions.manageCategories} onClick={prepare}>Vérifier mon classement ({Object.keys(selection).length}/10)</button>
      {approval && <div role="region" aria-label="Classement à confirmer"><p style={{ whiteSpace: "pre-wrap" }}>{approval.summary}</p><button disabled={loading} onClick={apply}>Confirmer et appliquer dans Outlook</button><button disabled={loading} onClick={() => setApproval(null)}>Revenir à la sélection</button></div>}
      <label>Catégorie proposée <select value={filter} onChange={event => { setFilter(event.target.value); setPage(0); }}><option>Tous</option>{groups.map(group => <option key={group}>{group}</option>)}</select></label>
      <p>{shown.length} message(s) · Page {page + 1} sur {Math.max(1, Math.ceil(shown.length / 10))}. Votre sélection est conservée entre les pages.</p>
      <nav aria-label="Pages des mails"><button disabled={loading || page === 0} onClick={() => setPage(value => value - 1)}>Précédente</button><button disabled={loading || (page + 1) * 10 >= shown.length} onClick={() => setPage(value => value + 1)}>Suivante</button></nav>
      {shown.slice(page * 10, page * 10 + 10).map((message, index) => <article key={message.id || index} style={{ padding: "1rem 0", borderTop: "1px solid var(--border, #d6e0ed)", overflowWrap: "anywhere" }}>
        <h3>{message.subject}</h3><p>{message.sender} · {message.receivedAt ? new Date(message.receivedAt).toLocaleDateString("fr-FR") : "Date inconnue"} · {message.unread ? "Non lu" : "Lu"}</p>
        <p><strong>{message.suggestions.join(" · ") || "À examiner manuellement"}</strong></p>
        {message.id && <label>Catégorie à ajouter <select aria-label={`Catégorie pour ${message.subject}`} disabled={loading || Boolean(approval)} value={selection[message.id] || ""} onChange={event => {
          const value = event.target.value;
          if (value && !selection[message.id] && Object.keys(selection).length >= 10) { setError("Le lot est limité à 10 messages."); return; }
          setSelection(previous => { const next = { ...previous }; if (value) next[message.id] = value; else delete next[message.id]; return next; });
        }}><option value="">Ne pas modifier</option>{MAIL_CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}</select></label>}
        {message.reasons.map(reason => <p key={reason}>{reason}</p>)}
        <p>{message.priority}</p>
        {message.categories.length > 0 && <p>Catégories Outlook existantes : {message.categories.join(", ")}</p>}
      </article>)}
      {!review.messages.length && <p>Aucun message dans ce périmètre.</p>}
    </>}
  </section>;
}
