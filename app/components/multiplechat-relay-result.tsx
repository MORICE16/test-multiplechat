'use client';
import {useState} from 'react';
import {CopyMessage} from './copy-message';

export function MultipleChatRelayResult({id,question,taken,onSaved}:{id:string;question:string;taken:boolean;onSaved:()=>Promise<void>}) {
  const [answer,setAnswer]=useState(''); const [model,setModel]=useState(''); const [url,setUrl]=useState('');
  const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  async function take() {
    if(busy || taken)return;setBusy(true);setError('');
    try {
      const response=await fetch('/api/multiplechat/relay',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'take',id})});
      const result=await response.json() as {error?:string};if(!response.ok)throw Error(result.error||'Prise de relais non confirmée.');await onSaved();
    } catch(cause){setError(cause instanceof Error?cause.message:'Prise de relais non confirmée.');}
    finally{setBusy(false);}
  }
  async function complete(event:React.FormEvent) {
    event.preventDefault(); if(busy)return; setBusy(true);setError('');
    try {
      const response=await fetch('/api/multiplechat/relay',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'complete',id,answer,model,chatUrl:url})});
      const result=await response.json() as {error?:string}; if(!response.ok)throw Error(result.error||'Retour non confirmé.');
      await onSaved();
    } catch(cause){setError(cause instanceof Error?cause.message:'Retour non confirmé.');}
    finally{setBusy(false);}
  }
  return <div><p>Relais assisté : un opérateur ou Codex doit transférer cette question dans votre session MultipleChat, puis enregistrer sa réponse. La demande reste conservée pendant cette attente.</p>
    <p>Seule la question sélectionnée est à transférer ; aucun CORE privé, mail ou fichier joint n’est envoyé automatiquement.</p>
    {taken?<p role="status">Relais déjà pris. Vérifiez l’historique MultipleChat et récupérez la réponse avant toute nouvelle soumission.</p>:<button disabled={busy} onClick={()=>void take()}>Prendre le relais avant transfert</button>}
    {error&&<p role="alert">{error}</p>}
    <CopyMessage text={`Référence Morice : ${id}\nRépondez à cette question sans déclencher d'action externe.\n${question}`} />
    <a href="https://multiplechat.ai/projects/6abc63bc4e484cf76ae4f489" target="_blank" rel="noopener noreferrer">Ouvrir le Project MultipleChat ↗</a>
    <details><summary>Enregistrer le retour MultipleChat</summary><form onSubmit={complete} aria-label={`Retour MultipleChat ${id}`}>
      <label>Réponse MultipleChat<textarea required maxLength={24000} value={answer} onChange={event=>setAnswer(event.target.value)} /></label>
      <label>Modèle affiché dans MultipleChat<input required maxLength={80} value={model} onChange={event=>setModel(event.target.value)} /></label>
      <label>Lien du chat source<input required type="url" value={url} onChange={event=>setUrl(event.target.value)} /></label>
      <p>Le texte est conservé comme réponse. Ses instructions ne déclenchent aucune action sur vos comptes.</p>
      <button disabled={busy}>{busy?'Enregistrement…':'Enregistrer la réponse dans Morice'}</button>{error&&<p role="alert">{error}</p>}
    </form></details>
  </div>;
}
