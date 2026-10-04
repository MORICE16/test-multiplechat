'use client';
import { useEffect,useState } from 'react';
type Task={id:string;title:string;status:string;isReminderOn?:boolean;dueDateTime?:{dateTime:string};reminderDateTime?:{dateTime:string}};
export function TodoPanel() {
  const [lists,setLists]=useState<{id:string;displayName:string}[]>([]),[list,setList]=useState(''),[tasks,setTasks]=useState<Task[]>([]);
  const [account,setAccount]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[refresh,setRefresh]=useState(0),[hasMore,setHasMore]=useState(false),[search,setSearch]=useState('');
  const [title,setTitle]=useState(''),[prepared,setPrepared]=useState(''),[writing,setWriting]=useState(false),[result,setResult]=useState('');
  async function prepare() {
    setWriting(true);setError('');setResult('');
    try {
      const response=await fetch('/api/microsoft/todo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,list})});
      const data=await response.json() as {id:string;error?:string};if(!response.ok)throw new Error(data.error||'Préparation impossible.');
      setPrepared(data.id);
    }catch(e){setError(e instanceof Error?e.message:'Préparation non confirmée. Vérifiez Validations avant de recommencer.');}finally{setWriting(false);}
  }
  async function confirm() {
    setWriting(true);setError('');const id=prepared;setPrepared('');
    try {
      const response=await fetch('/api/actions/execute',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});
      const data=await response.json() as {result:string;error?:string};if(!response.ok)throw new Error(data.error||'Exécution non confirmée.');
      setResult(data.result);setTitle('');setRefresh(v=>v+1);
    }catch(e){setError(e instanceof Error?e.message:'Résultat inconnu. Vérifiez Validations et To Do avant de recommencer.');}finally{setWriting(false);}
  }
  useEffect(()=>{ const controller=new AbortController();
    void (async()=>{await Promise.resolve();if(controller.signal.aborted)return;setBusy(true);setError('');setTasks([]);try{
      const response=await fetch('/api/microsoft/todo'+(list?'?list='+encodeURIComponent(list):''),{signal:controller.signal,cache:'no-store'});
      const data=await response.json() as {lists?:typeof lists;tasks?:Task[];account:string;error?:string;hasMore:boolean};
      if(!response.ok)throw new Error(data.error||'Lecture impossible.');
      setAccount(data.account);setHasMore(data.hasMore);
      if(data.lists){setLists(data.lists);if(data.lists.length)setList(data.lists[0].id);} else setTasks(data.tasks||[]);
    }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Lecture impossible.');}finally{if(!controller.signal.aborted)setBusy(false);}})();
    return()=>controller.abort();
  },[list,refresh]);
  const shown=tasks.filter(t=>!search || t.title.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr')));
  const repeats=new Map<string,number>();for(const task of tasks){const key=task.title.trim().toLocaleLowerCase('fr');repeats.set(key,(repeats.get(key)||0)+1);}
  return <section className="panel"><h2>Microsoft To Do</h2><p>{account || 'Votre compte Microsoft connecté'} · Listes et tâches réelles</p>
    <label>Liste <select value={list} onChange={e=>setList(e.target.value)}>{lists.map(l=><option key={l.id} value={l.id}>{l.displayName}</option>)}</select></label>
    <button disabled={busy} onClick={()=>setRefresh(v=>v+1)}>Actualiser</button>
    <div><h3>Ajouter une tâche sans Make ni IA</h3><label>Titre de la tâche <input maxLength={300} value={title} disabled={writing||Boolean(prepared)} onChange={e=>setTitle(e.target.value)}/></label>
      {!prepared?<button disabled={writing||busy||!list||!title.trim()} onClick={prepare}>{writing?'Préparation…':'Préparer la tâche'}</button>:<p>La demande est enregistrée dans Validations. <button disabled={writing} onClick={confirm}>Valider et créer dans Microsoft To Do</button></p>}
      {result&&<p role="status">{result}</p>}
    </div>
    <label>Rechercher dans les tâches chargées <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Ex. relance client" /></label>
    {busy&&<p role="status">Lecture de Microsoft To Do…</p>}{error&&<p role="alert">{error}</p>}
    {hasMore&&<p>Les 100 premiers éléments sont chargés. D’autres éléments existent dans Microsoft To Do.</p>}
    {shown.slice(0,20).map(t=><article className="row" key={t.id}><div><b>{t.title}</b><p>{t.status==='completed'?'Terminée':'À faire'}{t.dueDateTime?' · Échéance : '+t.dueDateTime.dateTime.slice(0,10):''}{t.isReminderOn?' · Rappel activé':''}</p>{(repeats.get(t.title.trim().toLocaleLowerCase('fr'))||0)>1&&<small>Plusieurs tâches portent ce titre : à vérifier avant de supprimer un doublon.</small>}</div></article>)}
    {!busy&&!error&&!shown.length&&<p>Aucune tâche dans cette sélection.</p>}
    {shown.length>20&&<p>{shown.length} résultats : affinez la recherche pour voir les autres tâches.</p>}
    <a href="https://to-do.live.com/tasks/" target="_blank" rel="noopener noreferrer">Ouvrir Microsoft To Do pour modifier les rappels ↗</a>
    <p>La lecture de cette page ne crée aucune tâche et ne déclenche aucune relance.</p>
  </section>;
}
