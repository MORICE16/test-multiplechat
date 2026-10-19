'use client';
import {useEffect,useRef,useState} from 'react';
export function OneDrivePanel(){
 const [query,setQuery]=useState('');const [result,setResult]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const request=useRef<AbortController|null>(null);
 useEffect(()=>()=>{request.current?.abort();request.current=null;},[]);
 async function search(){
  if(!query.trim()||request.current)return;
  const controller=new AbortController();request.current=controller;const searched=query.trim();
  const timeout=setTimeout(()=>controller.abort(),35_000);
  setBusy(true);setError('');setResult('');
  try{
   const r=await fetch(`/api/microsoft/read?operation=onedrive_search&query=${encodeURIComponent(searched)}`,{signal:controller.signal,cache:'no-store'});
   const d=await r.json() as {result?:string;error?:string;checkedAt?:string};
   if(request.current!==controller||controller.signal.aborted)return;
   if(!r.ok)throw Error(d.error||'Recherche non confirmée.');
   if(typeof d.result!=='string'||!d.checkedAt||!Number.isFinite(Date.parse(d.checkedAt)))throw Error('Résultat OneDrive incomplet. Actualisez la recherche.');
   setResult(`Résultats pour « ${searched} »\n${d.result}\n\nLecture confirmée le ${new Date(d.checkedAt).toLocaleString('fr-FR')}`);
  }catch(e){if(request.current===controller)setError(controller.signal.aborted?'Recherche trop longue. Vous pouvez réessayer.':e instanceof Error?e.message:'Recherche indisponible.');}
  finally{clearTimeout(timeout);if(request.current===controller){request.current=null;setBusy(false);}}
 }
 return <section className="panel"><p className="eyebrow">DOCUMENTS PRIVÉS</p><h2>OneDrive</h2><p>Rechercher dans votre OneDrive principal, en lecture seule. Les fichiers conservés dans Morice sont listés plus haut.</p><form className="inline" onSubmit={e=>{e.preventDefault();void search();}}><label className="sr-only" htmlFor="drive-query">Rechercher dans OneDrive</label><input id="drive-query" value={query} maxLength={200} onChange={e=>setQuery(e.target.value)} placeholder="Nom ou mot-clé d’un document…"/><button disabled={busy||!query.trim()}>{busy?'Recherche…':'Chercher dans OneDrive'}</button></form>{error&&<p role="status">{error}</p>}{result&&<p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{result}</p>}</section>;
}
