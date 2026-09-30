'use client';
import {useState} from 'react';

export function CopyMessage({text}:{text:string}) {
  const [status,setStatus]=useState('');
  const [manual,setManual]=useState(false);
  const plain=text.replace(/[^]*/g,'');
  async function copy(){try{await navigator.clipboard.writeText(plain);setStatus('Copié');setManual(false);}catch{setStatus('Copie automatique indisponible. Sélectionnez le texte ci-dessous.');setManual(true);}}
  return <div className="copy-message"><button type="button" onClick={()=>void copy()}>Copier le message</button>{status&&<span role="status">{status}</span>}{manual&&<textarea aria-label="Message à copier" readOnly value={plain} onFocus={e=>e.target.select()} rows={4}/>}</div>;
}
