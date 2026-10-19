'use client';
import {useRef,useState} from 'react';
import {PC_ENDPOINT,validPcReceipt,pcResult,type PcAction,type PcReceipt} from '../lib/pc-contract';
export function PcLocalPanel(){
 const locked=useRef(false);
 const [busy,setBusy]=useState(false),[receipt,setReceipt]=useState<PcReceipt|null>(null),[pending,setPending]=useState<PcReceipt|null>(null),[error,setError]=useState(''),[saved,setSaved]=useState(false),[session,setSession]=useState('');
 async function journal(value:object){const r=await fetch('/api/pc/journal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value),signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Journal indisponible.');return r.json() as Promise<{status:string}>;}
 async function save(p:PcReceipt){const stored=await journal({phase:'finish',id:p.requestId,receipt:p});if(stored.status!==(p.status==='done'?'done':'blocked'))throw Error();setPending(null);setSaved(true);setError('');}
 async function act(action:PcAction){
  if(locked.current)return;locked.current=true;setBusy(true);setError('');setSaved(false);setReceipt(null);
  const id=crypto.randomUUID();let prepared=false,received=false;
  try{
   const start=await journal({phase:'begin',id,action});if(start.status!=='queued')throw Error();prepared=true;
   const r=await fetch(PC_ENDPOINT,{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,requestId:id,...(action==='calculator'?{session}:{})}),signal:AbortSignal.timeout(action==='calculator'?65000:7000)});
   if(!r.ok)throw Error();
   // Reject oversized or unknown data from any process occupying this fixed local port.
   const reader=r.body?.getReader();if(!reader)throw Error();let text='',bytes=0;const decoder=new TextDecoder();
   try{for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.length;if(bytes>1024){await reader.cancel();throw Error();}text+=decoder.decode(part.value,{stream:true});}text+=decoder.decode();}finally{reader.releaseLock();}const p:unknown=JSON.parse(text);
   if(!validPcReceipt(p)||p.requestId!==id||p.action!==action||(action==='calculator'&&p.session!==session))throw Error();
   received=true;setReceipt(p);setPending(p);if(action==='health')setSession(p.session);
   await save(p);
  }catch{
   if(!received){setSession('');setError(prepared?'Liaison locale inaccessible ou résultat non confirmé. Aucun renvoi automatique. Le service doit être actif sur ce PC ; le navigateur peut demander l’accès au réseau local. Vérifiez le journal avant un nouvel essai.':'Journal indisponible : aucune demande envoyée au PC.');}
   else setError('Résultat reçu sur le PC, mais journal non confirmé. Enregistrez ce résultat sans relancer l’action.');
  }finally{setBusy(false);locked.current=false;}
 }
 return <section className="pc-local-panel" aria-labelledby="pc-local-heading"><p className="control-kicker">ORDINATEUR / LIAISON LOCALE</p><h2 id="pc-local-heading">Agir sur ce PC</h2><p>Sans API IA payante. Deux opérations fixes : vérifier la liaison et demander la calculatrice. Le service écoute uniquement sur ce PC ; il ne relie pas le téléphone.</p><div className="pc-local-actions"><button disabled={busy||Boolean(pending)} onClick={()=>void act('health')}>{busy?'Vérification ou confirmation en cours…':'Vérifier la liaison du PC'}</button><button disabled={busy||!session||Boolean(pending)} onClick={()=>void act('calculator')}>Demander la calculatrice</button></div><p>La calculatrice exige un « Oui » dans une fenêtre Windows pour cette demande. Sans réponse, aucun lancement. Aucun fichier, compte, microphone ni commande libre accessibles.</p>{receipt&&<div role="status"><strong>{pcResult(receipt)}</strong><p>{new Date(receipt.checkedAt).toLocaleString('fr-FR')} · {saved?'Résultat conservé dans Travaux.':'Résultat reçu, enregistrement à confirmer.'}</p><small>Morice → navigateur PC → exécutant local → {receipt.action} → {receipt.status}. Rapport du navigateur ; le serveur ne peut pas attester le PC à distance.</small></div>}{error&&<p role="alert">{error}</p>}{pending&&!saved&&<button disabled={busy} onClick={()=>{setBusy(true);void save(pending).catch(()=>setError('Journal toujours indisponible. Aucune action PC relancée.')).finally(()=>setBusy(false));}}>Enregistrer le résultat reçu</button>}<details><summary>Si la liaison ne répond pas</summary><p>Le programme local Morice PC doit être lancé dans votre session Windows. L’accès depuis un autre ordinateur ou depuis le téléphone ne pilote pas ce PC. Le fermer coupe la liaison. Aucun démarrage automatique n’est installé.</p><p>Le statut devient vérifié seulement après votre test. L’accès au réseau local peut demander une autorisation du navigateur ; aucun réglage de sécurité n’est contourné.</p></details></section>;
}
