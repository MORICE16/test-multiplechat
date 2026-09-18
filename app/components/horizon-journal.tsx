"use client";
import { useState } from 'react';
import { ResponsePlayer } from './response-player';
import { safeWebUrl, type Citation } from '../lib/web-result';

type Entry = { id: string; title: string; content: string };
type Message = { id: string; role: string; text: string };
type JournalJob = { id: string; title: string; request: string; result: string; status: string; updated_at: string; evidence: { citations?: Citation[] } };
type Props = { messages: Message[]; memories: Entry[]; jobs: JournalJob[]; onExplore: (text: string) => void; onAdd: (text: string) => Promise<void>; compact?: boolean; onOpen?: () => void; voiceActive?: boolean; error?: string };

export function HorizonJournal({ messages, memories, jobs, onExplore, onAdd, compact = false, onOpen, voiceActive = false, error }: Props) {
  const [tab, setTab] = useState('questions');
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState('');
  const questions = messages.filter(m => m.role === 'user').slice().reverse();
  const articles = jobs.filter(j => j.status === 'done' && j.evidence.citations?.some(c => safeWebUrl(c.url)));
  const limit = compact ? 2 : 40;
  const audio = tab === 'questions' ? questions.slice(0, 10).map(m => m.text).join('\n\n') : tab === 'ideas' ? memories.slice(0, 10).map(m => m.title + '. ' + m.content).join('\n\n') : articles.slice(0, 3).map(j => j.title + '. ' + j.result.replace(/[^]*/g, '')).join('\n\n');
  async function save() {
    if (!draft.trim() || saving) return;
    setSaving(true); setFailure('');
    try { await onAdd(draft.trim()); setDraft(''); }
    catch { setFailure('L’idée n’a pas été enregistrée. Votre texte est conservé.'); }
    finally { setSaving(false); }
  }
  return <section className={compact ? 'horizon-journal-preview' : 'horizon-journal'}>
    <div className="panel-heading"><div><p className="eyebrow">VOS QUESTIONS ONT UNE SUITE</p><h2>Journal d’idées</h2></div>{compact && <button onClick={onOpen}>Tout voir →</button>}</div>
    <div className="horizon-tabs" role="group" aria-label="Contenu du journal">{[['questions', 'Mes questions'], ['ideas', 'Mes idées'], ['articles', 'À lire']].map(([id, label]) => <button key={id} aria-pressed={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}</div>
    {error && <p role="status">{error}</p>}
    {tab === 'questions' && <><p className="horizon-caption">Demandes issues de vos 40 derniers messages sauvegardés.</p>{questions.slice(0, limit).map(q => <article className="horizon-journal-entry" key={q.id}><p>{q.text}</p><button onClick={() => onExplore(q.text)}>Chercher des articles associés ↗</button></article>)}{!questions.length && <p className="horizon-empty">Vos prochaines questions à Morice apparaîtront ici.</p>}</>}
    {tab === 'ideas' && <>{!compact && <form className="inline" onSubmit={e => { e.preventDefault(); void save(); }}><label className="sr-only" htmlFor="horizon-idea">Nouvelle idée</label><input id="horizon-idea" value={draft} maxLength={1200} onChange={e => setDraft(e.target.value)} placeholder="Une nouvelle idée à conserver…" /><button disabled={saving || !draft.trim()}>{saving ? 'Enregistrement…' : 'Garder cette idée'}</button></form>}{failure && <p role="alert">{failure}</p>}{memories.slice(0, limit).map(m => <article className="horizon-journal-entry" key={m.id}><h3>{m.title}</h3>{m.content !== m.title && <p>{m.content}</p>}<button onClick={() => onExplore(m.content || m.title)}>Approfondir avec des sources ↗</button></article>)}{!memories.length && <p className="horizon-empty">Retrouvez ici vos idées et notes conservées dans la mémoire de Morice.</p>}</>}
    {tab === 'articles' && <>{articles.slice(0, limit).map(j => <article className="horizon-journal-entry" key={j.id}><h3>{j.title}</h3><p>{j.request}</p><small>Recherche enregistrée le {new Date(j.updated_at).toLocaleString('fr-FR')}</small><ul>{[...new Map(j.evidence.citations!.filter(c => safeWebUrl(c.url)).map(c => [c.url, c])).values()].map(c => <li key={c.url}><a href={c.url} target="_blank" rel="noopener noreferrer">{c.title || new URL(c.url).hostname} ↗</a><small> · {new URL(c.url).hostname}</small></li>)}</ul><ResponsePlayer text={j.result.replace(/[^]*/g, '')} disabled={voiceActive} /></article>)}{!articles.length && <p className="horizon-empty">Aucun article sourcé pour le moment. Partez d’une question ou d’une idée pour préparer une recherche.</p>}</>}
    {!compact && audio && <div className="horizon-journal-audio"><p>Écouter mon journal · {tab === 'questions' ? '10 dernières demandes au maximum' : tab === 'ideas' ? '10 dernières idées au maximum' : '3 dernières recherches au maximum'}</p><ResponsePlayer text={audio} disabled={voiceActive} /></div>}
  </section>;
}
