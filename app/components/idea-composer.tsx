'use client';
import { useEffect, useRef, useState } from 'react';
import { MAX_ATTACHMENTS, MAX_FILE_BYTES } from '../lib/attachment-validation';
type Attachment={file:File;url:string;id?:string};
export function IdeaComposer({onSaved,initialText=''}:{onSaved:()=>void;initialText?:string}) {
  const [text,setText]=useState(initialText); const [files,setFiles]=useState<Attachment[]>([]);
  const [busy,setBusy]=useState(false); const [notice,setNotice]=useState('');
  const requestId=useRef(crypto.randomUUID()); const fileState=useRef(files);
  useEffect(()=>{fileState.current=files;},[files]);
  useEffect(()=>()=>{fileState.current.forEach(f=>URL.revokeObjectURL(f.url));},[]);
  function add(incoming:FileList | File[]) {
    if(busy) return;
    const list=Array.from(incoming);
    if(files.length+list.length>MAX_ATTACHMENTS || list.some(f=>f.size>MAX_FILE_BYTES || !['image/jpeg','image/png','image/webp','application/pdf'].includes(f.type))) {setNotice('3 fichiers maximum, 4 Mo chacun : JPEG, PNG, WebP ou PDF.');return;}
    setFiles(prev=>[...prev,...list.map(file=>({file,url:URL.createObjectURL(file)}))]);setNotice('');
  }
  async function remove(index:number) {
    const item=files[index];
    if(item.id) {const r=await fetch(`/api/files/${item.id}`,{method:'DELETE'});if(!r.ok){setNotice('Suppression non confirmée. Le fichier est conservé.');return;}}
    URL.revokeObjectURL(item.url);setFiles(prev=>prev.filter((_,i)=>i!==index));
  }
  async function send() {
    if(busy || !text.trim()) return;
    setBusy(true);setNotice('');
    try {
      const uploaded=[...files];
      for(const item of uploaded) if(!item.id) {
        const body=new FormData();body.append('file',item.file);
        const r=await fetch('/api/files',{method:'POST',body});const data=await r.json() as {id?:string;error?:string};
        if(!r.ok) throw new Error(data.error || 'Fichier non enregistré.');
        item.id=data.id;setFiles([...uploaded]);
      }
      const r=await fetch('/api/ideas',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:requestId.current,text,files:uploaded.map(f=>f.id)})});
      const data=await r.json() as {error?:string};if(!r.ok) throw new Error(data.error || 'Enregistrement non confirmé.');
      uploaded.forEach(f=>URL.revokeObjectURL(f.url));setFiles([]);setText('');requestId.current=crypto.randomUUID();
      setNotice('Idée enregistrée. Consultez Travaux pour le résultat et la trace.');onSaved();
    }catch(e){setNotice(e instanceof Error?e.message:'Connexion interrompue. Texte et fichiers conservés. Vérifiez Travaux avant de renvoyer.');}
    finally{setBusy(false);}
  }
  return <section className="idea-composer" onPaste={e=>{if(e.clipboardData.files.length){e.preventDefault();add(e.clipboardData.files);}}} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();add(e.dataTransfer.files);}}>
    <label htmlFor="idea-text">Nouvelle idée · analyser une photo ou un document</label>
    <textarea id="idea-text" rows={3} maxLength={4000} value={text} disabled={busy} onChange={e=>setText(e.target.value)} placeholder="Que voulez-vous comprendre ou préparer ?" />
    <div className="idea-files">{files.map((item,index)=><figure key={item.url}>{item.file.type.startsWith('image/') ? <img src={item.url} alt={`Aperçu ${item.file.name}`} /> : <span aria-label="Document PDF">PDF</span>}<figcaption>{item.file.name}</figcaption><button type="button" disabled={busy} onClick={()=>void remove(index)}>Retirer</button></figure>)}</div>
    <div className="inline"><label className="idea-file-button">Ajouter un fichier<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple disabled={busy} onChange={e=>{if(e.target.files)add(e.target.files);e.target.value='';}} /></label><label className="idea-file-button">Prendre une photo<input type="file" accept="image/*" capture="environment" disabled={busy} onChange={e=>{if(e.target.files)add(e.target.files);e.target.value='';}} /></label><button disabled={busy || !text.trim()} onClick={()=>void send()}>{busy?'Enregistrement et lancement…':'Enregistrer et analyser'}</button></div>
    <small>Déposez aussi vos fichiers ici. Stockage privé. L’analyse transmet les pièces jointes à OpenAI; résultat récupérable après reconnexion. Aucune commande de téléphone ni envoi de mail.</small>
    {notice && <p role="status">{notice}</p>}
  </section>;
}
