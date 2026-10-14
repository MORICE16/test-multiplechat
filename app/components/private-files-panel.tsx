'use client';
import {useEffect,useState} from 'react';
type StoredFile={id:string;name:string;mime:string;size:number;created_at:string};
export function PrivateFilesPanel(){
 const [query,setQuery]=useState('');const [search,setSearch]=useState('');const [revision,setRevision]=useState(0);
 const [files,setFiles]=useState<StoredFile[]>([]);const [hasMore,setHasMore]=useState(false);const [expanded,setExpanded]=useState(false);
 const [busy,setBusy]=useState(true);const [error,setError]=useState('');
 useEffect(()=>{
  const controller=new AbortController();
  void(async()=>{try{
   const response=await fetch(`/api/files?query=${encodeURIComponent(search)}`,{signal:controller.signal});
   const result=await response.json() as {files?:StoredFile[];hasMore?:boolean;error?:string};
   if(!response.ok || !Array.isArray(result.files))throw Error(result.error||'Liste des fichiers non confirmée.');
   if(!controller.signal.aborted){setFiles(result.files);setHasMore(result.hasMore===true);}
  }catch(e){if(!controller.signal.aborted){setFiles([]);setError(e instanceof Error?e.message:'Liste indisponible.');}}
  finally{if(!controller.signal.aborted)setBusy(false);}})();
  return()=>controller.abort();
 },[search,revision]);
 return <section className="panel"><p className="eyebrow">VOTRE ESPACE PRIVÉ</p><h2>Mes fichiers Morice</h2><p>Photos et PDF joints à vos idées, conservés dans Morice. Leur présence confirme l’enregistrement, sans garantir une analyse IA.</p>
  <form className="inline" onSubmit={e=>{e.preventDefault();setBusy(true);setError('');setExpanded(false);setSearch(query.trim());setRevision(n=>n+1);}}><label className="sr-only" htmlFor="private-file-query">Rechercher mes fichiers Morice</label><input id="private-file-query" maxLength={120} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nom du fichier…"/><button disabled={busy}>{busy?'Chargement…':'Rechercher mes fichiers'}</button></form>
  {busy?<p role="status">Chargement des fichiers conservés…</p>:error?<p role="status">{error}</p>:<>{!files.length&&<p>Aucun fichier conservé pour cette recherche.</p>}{files.slice(0,expanded?50:5).map(file=><article className="row" key={file.id}><div style={{minWidth:0,overflowWrap:'anywhere'}}><a href={`/api/files/${file.id}`} target="_blank" rel="noopener noreferrer">{file.name} ↗</a><p>{file.mime==='application/pdf'?'PDF':'Image'} · {Math.ceil(file.size/1024)} Ko · {new Date(file.created_at).toLocaleDateString('fr-FR')}</p></div></article>)}{files.length>5&&<button onClick={()=>setExpanded(value=>!value)}>{expanded?'Réduire la liste':`Voir les ${files.length} fichiers`}</button>}{hasMore&&<p>Les 50 fichiers les plus récents sont affichés. Précisez le nom pour retrouver les autres.</p>}</>}
 </section>;
}
