"use client";
import { useEffect, useRef, useState } from "react";
import type { MailReview } from "../lib/mail-triage";
import {MAIL_REVIEW_SCOPES,remainingMailSuggestions,selectUniqueMailProposals} from '../lib/mail-triage';
import { MAIL_CATEGORIES } from "../lib/mail-categories";

export function MailReviewPanel() {
  const loadVersion=useRef(0),loadAbort=useRef<AbortController|null>(null);
  const [accounts, setAccounts] = useState<Array<{ id: string; email: string }>>([]);
  const [accountId, setAccountId] = useState("");
  const [review, setReview] = useState<MailReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("Tous");
  const [hideApplied,setHideApplied]=useState(true);
  const [scope,setScope]=useState('recent');
  const [page, setPage] = useState(0);
  const [permissions, setPermissions] = useState({ writeMail: false, manageCategories: false });
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [approval, setApproval] = useState<{ id: string; summary: string } | null>(null);
  const [result, setResult] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const requests=loadVersion,active=loadAbort;
    void fetch("/api/connections", { cache: "no-store", signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(); return r.json() as Promise<{ microsoft: { accounts?: Array<{ id: string; email: string }> } }>; })
      .then(d => { if (!controller.signal.aborted) setAccounts(d.microsoft.accounts || []); })
      .catch(() => { if (!controller.signal.aborted) setError("Liste des comptes indisponible."); });
    return () => { controller.abort();active.current?.abort();requests.current++; };
  }, []);
  async function load(cursor=review?.cursor||'') {
    const version=++loadVersion.current;loadAbort.current?.abort();const controller=new AbortController();loadAbort.current=controller;
    setLoading(true);setError('');setSelection({});if(cursor!==(review?.cursor||''))setResult('');
    try {
      const response = await fetch(`/api/microsoft/triage?accountId=${encodeURIComponent(accountId)}&scope=${encodeURIComponent(scope)}&cursor=${encodeURIComponent(cursor)}`, { cache: "no-store",signal:AbortSignal.any([controller.signal,AbortSignal.timeout(35000)]) });
      const data = await response.json() as MailReview & { error?: string; permissions: typeof permissions };
      if (!response.ok) throw new Error(data.error || "Lecture indisponible.");
      if(version!==loadVersion.current||controller.signal.aborted)return;
      setReview(data); setPermissions(data.permissions); setFilter("Tous"); setPage(0); setSelection({}); setApproval(null);
    } catch (e) { if(version===loadVersion.current&&!controller.signal.aborted)setError(e instanceof Error ? e.message : "Lecture indisponible."); }
    finally { if(version===loadVersion.current)setLoading(false); }
  }
  async function prepare() {
    if (!review) return;
    setLoading(true); setError(""); setResult("");
    try {
      const response = await fetch("/api/microsoft/triage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountId, account: review.account, scope:review.scope||'recent',cursor:review.cursor||'', entries: Object.entries(selection).map(([id, category]) => ({ id, category })) }) });
      const data = await response.json() as { id: string; summary: string; error?: string };
      if (!response.ok) throw new Error(data.error || "Préparation impossible.");
      setApproval(data);
    } catch (e) { setError(e instanceof Error ? e.message : "Préparation impossible."); }
    finally { setLoading(false); }
  }
  async function prepareCatalog() {
    if (loading || approval) return;
    setLoading(true);setError('');setResult('');
    try {
      const response=await fetch('/api/microsoft/category-catalog',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accountId})});
      const data=await response.json() as {id:string;summary:string;error?:string};
      if(!response.ok)throw Error(data.error||'Préparation des catégories impossible.');
      setApproval(data);
    }catch(e){setError(e instanceof Error?e.message:'Préparation non confirmée.');}finally{setLoading(false);}
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
  const alreadyApplied=review?.messages.filter(message=>message.suggestions.length>0&&!remainingMailSuggestions(message).length).length||0;
  const shown = review?.messages.filter(message => (!hideApplied||!message.suggestions.length||remainingMailSuggestions(message).length>0)&&(filter === "Tous" || (message.suggestions.length ? message.suggestions : ["À examiner"]).includes(filter))) || [];
  return <section className="panel" aria-label="Préparer le classement des mails">
    <p className="eyebrow">CLASSEMENT À PRÉPARER</p><h2>Organiser ma boîte mail</h2>
    <label>Boîte Microsoft <select value={accountId} disabled={loading} onChange={event => { setAccountId(event.target.value); setReview(null); setSelection({}); setApproval(null); setResult(""); setError(""); }}><option value="">Compte principal</option>{accounts.filter(a => a.id).map(a => <option value={a.id} key={a.id}>{a.email}</option>)}</select></label>
    <label>Périmètre de lecture<select value={scope} disabled={loading} onChange={e=>{setScope(e.target.value);setReview(null);setSelection({});setApproval(null);setResult('');setError('');}}>{Object.entries(MAIL_REVIEW_SCOPES).map(([id,item])=><option key={id} value={id}>{item.label}</option>)}</select></label>
    <p>{scope==='recent'?'Jusqu’à 100 messages récents de la réception, depuis janvier 2025.':scope==='all'?'Lecture de tous les dossiers par lots de 100, sans date de début : réception, envoyés, brouillons, indésirables et éléments supprimés inclus.':'Recherche Microsoft dans les objets et expéditeurs, sans date de début imposée : jusqu’à 100 résultats par lot.'} Ce lot ne représente pas le tri complet de la boîte.</p>
    <p>Propositions par mots-clés dans l’objet et l’expéditeur. Choisissez les catégories, puis validez leur ajout dans Outlook. Aucun déplacement, envoi ou suppression.</p>
    <button disabled={loading||Boolean(approval)} onClick={()=>void load()}>{loading ? "Lecture Microsoft en cours…" : review ? "Actualiser les propositions" : "Préparer le classement"}</button>
    {error && <p role="alert">{error}{review ? " Le résultat ci-dessous provient de la lecture précédente." : ""}</p>}
    {result && <p role="status">{result}</p>}
    {review && <>
      <p role="status"><strong>{review.account || "Compte Microsoft connecté"}</strong> · Lot Microsoft {review.batch||1} · {review.messages.length} messages lus dans ce lot · {new Date(review.checkedAt).toLocaleString("fr-FR")}</p>
      <p>Le contenu de la boîte peut changer entre deux lectures. Le numéro du lot ne constitue pas un total de messages uniques ou classés. Les corps et pièces jointes ne sont pas lus.</p>
      <nav aria-label="Lots Microsoft"><button disabled={loading||Boolean(approval)||typeof review.previousCursor!=='string'} onClick={()=>void load(review.previousCursor||'')}>Lot Microsoft précédent</button><button disabled={loading||Boolean(approval)||!review.nextCursor} onClick={()=>void load(review.nextCursor!)}>Lire le lot Microsoft suivant</button><button disabled={loading||Boolean(approval)} onClick={()=>void load('')}>Recommencer au premier lot</button></nav>
      {review.hasMore&&!review.nextCursor&&<p>Ce lot peut avoir une suite, mais aucune continuation exploitable n’est disponible. L’aperçu reste partiel ; recommencez au premier lot si la session a expiré.</p>}
      {(!permissions.writeMail || !permissions.manageCategories) && <p>Microsoft doit autoriser la création des catégories et le classement. <a href="/api/microsoft/start?categories=1">Autoriser le classement Outlook</a> — choisissez le même compte : {review.account}.</p>}
      <p>Lot de 10 messages maximum. Les catégories existantes sont conservées. Les noms avec « / » organisent les étiquettes ; Outlook ne crée pas de sous-dossiers.</p>
      <button disabled={loading||Boolean(approval)||!permissions.manageCategories} onClick={prepareCatalog}>Préparer mes catégories Outlook</button>
      <p>Notaire, avocat, immobilier, locataires, assurances… Crée les étiquettes manquantes après confirmation ; ne classe pas encore les messages.</p>
      <button disabled={loading||Boolean(approval)||!permissions.writeMail||!permissions.manageCategories} onClick={()=>{const next=selectUniqueMailProposals(shown);setSelection(next);setError(Object.keys(next).length?'':'Aucune proposition unique dans ce périmètre. Choisissez une catégorie manuellement ou examinez une autre boîte.');}}>Sélectionner jusqu’à 10 propositions uniques</button>
      <button disabled={loading || Boolean(approval) || !Object.keys(selection).length || !permissions.writeMail || !permissions.manageCategories} onClick={prepare}>Vérifier mon classement ({Object.keys(selection).length}/10)</button>
      {approval && <div role="region" aria-label="Classement à confirmer"><p style={{ whiteSpace: "pre-wrap" }}>{approval.summary}</p><button disabled={loading} onClick={apply}>Confirmer et appliquer dans Outlook</button><button disabled={loading} onClick={() => setApproval(null)}>Revenir à la sélection</button></div>}
      <label><input type="checkbox" checked={hideApplied} disabled={loading||Boolean(approval)} onChange={event=>{setHideApplied(event.target.checked);setPage(0);setSelection({});}}/> Masquer les propositions déjà appliquées</label>
      <p>{alreadyApplied} message(s) de ce lot ont déjà toutes les catégories proposées. Les autres propositions restent à vérifier ; ce compteur ne mesure pas le classement complet de la boîte.</p>
      <label>Catégorie proposée <select value={filter} disabled={loading||Boolean(approval)} onChange={event => { setFilter(event.target.value); setPage(0); setSelection({}); }}><option>Tous</option>{groups.map(group => <option key={group}>{group}</option>)}</select></label>
      <p>{shown.length} message(s) · Page {page + 1} sur {Math.max(1, Math.ceil(shown.length / 10))}. Votre sélection est conservée entre les pages et effacée lors d’un changement de filtre.</p>
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
      {review.messages.length>0&&!shown.length&&<p>Aucun message à afficher avec ces filtres. Décochez le masque pour retrouver les propositions déjà appliquées.</p>}
    </>}
  </section>;
}
