"use client";
import { useState } from "react";
import type { MailReview } from "../lib/mail-triage";

export function MailReviewPanel() {
  const [review, setReview] = useState<MailReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("Tous");
  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/microsoft/triage", { cache: "no-store" });
      const data = await response.json() as MailReview & { error?: string };
      if (!response.ok) throw new Error(data.error || "Lecture indisponible.");
      setReview(data); setFilter("Tous");
    } catch (e) { setError(e instanceof Error ? e.message : "Lecture indisponible."); }
    finally { setLoading(false); }
  }
  const groups = review ? [...new Set(review.messages.flatMap(message => message.suggestions.length ? message.suggestions : ["À examiner"]))].sort() : [];
  const shown = review?.messages.filter(message => filter === "Tous" || (message.suggestions.length ? message.suggestions : ["À examiner"]).includes(filter)) || [];
  return <section className="panel" aria-label="Préparer le classement des mails">
    <p className="eyebrow">CLASSEMENT À PRÉPARER</p><h2>Organiser ma boîte mail</h2>
    <p>Examiner jusqu’à 100 messages récents de la boîte de réception, depuis janvier 2025. Les autres comptes et dossiers ne sont pas inclus.</p>
    <p>Propositions par mots-clés dans l’objet et l’expéditeur, à vérifier. Aucun mail ne sera déplacé ou modifié.</p>
    <button disabled={loading} onClick={load}>{loading ? "Lecture Microsoft en cours…" : review ? "Actualiser les propositions" : "Préparer le classement"}</button>
    {error && <p role="alert">{error}{review ? " Le résultat ci-dessous provient de la lecture précédente." : ""}</p>}
    {review && <>
      <p role="status"><strong>{review.account || "Compte Microsoft connecté"}</strong> · {review.messages.length} messages examinés · {new Date(review.checkedAt).toLocaleString("fr-FR")}</p>
      {review.hasMore && <p>Il reste des messages plus anciens. Cet aperçu ne couvre pas toute la boîte.</p>}
      <label>Catégorie proposée <select value={filter} onChange={event => setFilter(event.target.value)}><option>Tous</option>{groups.map(group => <option key={group}>{group}</option>)}</select></label>
      <p>{shown.length} message(s) affiché(s). Un message peut correspondre à plusieurs catégories.</p>
      {shown.map((message, index) => <article key={index} style={{ padding: "1rem 0", borderTop: "1px solid var(--border, #d6e0ed)", overflowWrap: "anywhere" }}>
        <h3>{message.subject}</h3><p>{message.sender} · {message.receivedAt ? new Date(message.receivedAt).toLocaleDateString("fr-FR") : "Date inconnue"} · {message.unread ? "Non lu" : "Lu"}</p>
        <p><strong>{message.suggestions.join(" · ") || "À examiner manuellement"}</strong></p>
        {message.reasons.map(reason => <p key={reason}>{reason}</p>)}
        <p>{message.priority}</p>
        {message.categories.length > 0 && <p>Catégories Outlook existantes : {message.categories.join(", ")}</p>}
      </article>)}
      {!review.messages.length && <p>Aucun message dans ce périmètre.</p>}
    </>}
  </section>;
}
