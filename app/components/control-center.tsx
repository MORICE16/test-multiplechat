'use client';
import {useEffect,useId,useState} from 'react';
import {MoriceCompanion} from './morice-companion';

export function NeuralCore({active=false}:{active?:boolean}) {
 const uid=useId().replaceAll(':','');
 const [hidden,setHidden]=useState(false);
 useEffect(()=>{const changed=()=>setHidden(document.hidden);document.addEventListener('visibilitychange',changed);return()=>document.removeEventListener('visibilitychange',changed);},[]);
 return <div className={`neural-core ${active?'neural-active':''} ${hidden?'neural-hidden':''}`} aria-hidden="true">
  <div className="neural-orbit orbit-one"/><div className="neural-orbit orbit-two"/><div className="neural-orbit orbit-three"/>
  <svg viewBox="0 0 300 300" focusable="false">
   <defs><linearGradient id={`${uid}-ink`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#bcffff"/><stop offset=".5" stopColor="#57d8e9"/><stop offset="1" stopColor="#8d8cfa"/></linearGradient><radialGradient id={`${uid}-glow`}><stop stopColor="#78e9ff" stopOpacity=".25"/><stop offset="1" stopColor="#78e9ff" stopOpacity="0"/></radialGradient></defs>
   <circle cx="150" cy="150" r="132" fill={`url(#${uid}-glow)`}/>
   <g className="brain-lines" fill="none" stroke={`url(#${uid}-ink)`} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M146 72C131 57 106 62 99 80C81 77 67 91 70 110C53 119 50 140 61 154C45 174 56 194 74 201C71 221 89 237 107 232C120 248 144 239 146 220Z"/>
    <path d="M154 72C169 57 194 62 201 80C219 77 233 91 230 110C247 119 250 140 239 154C255 174 244 194 226 201C229 221 211 237 193 232C180 248 156 239 154 220Z"/>
    <path d="M101 81L110 101L133 108L146 95M70 110L95 123L91 147L65 155M94 125L116 137L145 127M58 177L84 181L103 161L129 165L145 151M75 201L101 205L112 187L146 190M109 230L119 212L145 219M110 100L111 114M103 161L111 145M129 165L132 185M101 205L94 191"/>
    <path d="M199 81L190 101L167 108L154 95M230 110L205 123L209 147L235 155M206 125L184 137L155 127M242 177L216 181L197 161L171 165L155 151M225 201L199 205L188 187L154 190M191 230L181 212L155 219M190 100L189 114M197 161L189 145M171 165L168 185M199 205L206 191"/>
    <path className="brain-signal" d="M40 150H82L94 137L110 150H133L150 133L166 150H191L205 139L218 150H260"/>
   </g>
   <g fill="#a9f8ff">{[[110,101],[95,123],[103,161],[112,187],[119,212],[133,108],[190,101],[205,123],[197,161],[188,187],[181,212],[167,108]].map(([x,y],i)=><circle className="brain-node" key={i} cx={x} cy={y} r="3" style={{animationDelay:`${i*.23}s`}}/>)}</g>
  </svg>
  <div className="neural-plinth"/>
 </div>;
}

const spaces=[
 {id:'mail',label:'Communications',detail:'Outlook & Gmail',icon:'/brand-icons/outlook.svg'},
 {id:'todo',label:'Organisation',detail:'To Do & agenda',icon:'/brand-icons/todo.svg'},
 {id:'documents',label:'Documents',detail:'Photos, PDF & OneDrive',icon:'/brand-icons/onedrive.svg'},
 {id:'integrations',label:'Maison connectée',detail:'Appareils & passerelles',glyph:'⌂'},
 {id:'core',label:'Mémoire',detail:'CORE & idées',glyph:'◉'},
 {id:'pc',label:'Mon ordinateur',detail:'Liaison locale & actions vérifiables',glyph:'⌘'},
];
type Props={onOpen:(view:string)=>void;onPrepare:(text:string,mode?:string)=>void;storage:'checking'|'online'|'error';microsoftAuthorized:boolean;taskCount:number;waiting:number;active:boolean;date:string;jobs:{id:string;title:string;status:string;updated_at:string}[]};
export function ControlCenter({onOpen,onPrepare,storage,microsoftAuthorized,taskCount,waiting,active,date,jobs}:Props){
 const [avatar,setAvatar]=useState<'brain'|'companion'>('brain');
 return <div className="control-center">
  <div className="control-heading"><div><span className="control-kicker">MORICE / ESPACE PRIVÉ</span><h2>Tout commence ici.</h2><p>Votre quotidien. Vos appareils. Un seul point d’entrée.</p></div><span className="control-date">{date}</span></div>
  <div className="control-stage">
   <aside className="control-status"><p className="control-kicker">VOTRE ESPACE</p><h3>À votre écoute.</h3><p>Choisissez un espace ou préparez une demande à Morice.</p><div className="control-indicator"><i className={storage==='online'?'state-ok':''}/><div><b>{storage==='online'?'Données accessibles':storage==='error'?'Stockage à vérifier':'Chargement des données'}</b><small>Journal et contexte privés</small></div></div><div className="control-indicator"><i className="state-wait"/><div><b>{microsoftAuthorized?'Microsoft autorisé':'Microsoft à connecter'}</b><small>Vérifiez chaque service dans Connexions</small></div></div><div className="control-indicator"><i className="state-wait"/><div><b>MultipleChat assisté</b><small>La liaison automatique reste à raccorder</small></div></div><button onClick={()=>onOpen('connections')}>Vérifier mes accès <span>↗</span></button></aside>
   <section className="control-presence" aria-label="Présence de Morice"><div className="presence-caption"><span className="presence-light"/>{active?'UN TRAVAIL EST EN COURS':'PRÊT POUR VOTRE DEMANDE'}</div><button className="presence-button" onClick={()=>onOpen('chat')} aria-label="Ouvrir la conversation avec Morice">{avatar==='brain'?<NeuralCore active={active}/>:<MoriceCompanion state={active?'working':'idle'} label="Morice, compagnon animé"/>}</button><div className="presence-switch" role="group" aria-label="Apparence du compagnon"><button aria-pressed={avatar==='brain'} onClick={()=>setAvatar('brain')}>Cœur neural</button><button aria-pressed={avatar==='companion'} onClick={()=>setAvatar('companion')}>Mon Morice</button></div><h3>Une idée ? Une action ?</h3><p>Ouvrez la conversation pour écrire, dicter ou joindre un fichier.</p><button className="control-primary" onClick={()=>onOpen('chat')}>Parler ou écrire à Morice <span>↗</span></button><small>Le microphone reste éteint jusqu’à votre clic sur Dicter.</small></section>
   <aside className="control-quick"><p className="control-kicker">VOTRE JOURNÉE</p><button onClick={()=>onPrepare('Prépare mon point quotidien')}><span className="quick-symbol">☷</span><span><b>Mon point quotidien</b><small>Agenda · mails · listes To Do</small></span><span>↗</span></button><button onClick={()=>onOpen('tasks')}><span className="quick-value">{storage==='online'?taskCount:'—'}</span><span><b>Tâches à suivre</b><small>Votre organisation</small></span><span>↗</span></button><button onClick={()=>onOpen('approvals')}><span className="quick-value">{storage==='online'?waiting:'—'}</span><span><b>À valider</b><small>Vous gardez la main</small></span><span>↗</span></button><div className="control-connect-prompt"><span>＋</span><h3>Votre maison, avec Morice.</h3><p>Aspirateur, éclairage, musique… retrouvez les parcours de connexion.</p><button onClick={()=>onOpen('integrations')}>Explorer les connexions →</button></div></aside>
  </div>
  <section className="control-spaces" aria-label="Espaces de Morice"><div className="control-section-heading"><h3>Votre univers connecté</h3><button onClick={()=>onOpen('integrations')}>Toutes les applications ↗</button></div><div className="control-space-grid">{spaces.map(space=><button key={space.label} onClick={()=>onOpen(space.id)}>{space.icon?<img src={space.icon} alt=""/>:<span className="space-glyph">{space.glyph}</span>}<b>{space.label}</b><small>{space.detail}</small><span className="space-arrow">↗</span></button>)}</div></section>
  <section className="control-recent"><div className="control-section-heading"><h3>Derniers travaux</h3><button onClick={()=>onOpen('jobs')}>Ouvrir le journal ↗</button></div>{jobs.length?<div className="control-recent-grid">{[...jobs].sort((a,b)=>b.updated_at.localeCompare(a.updated_at)).slice(0,3).map(job=><button key={job.id} onClick={()=>onOpen('jobs')}><i className={job.status==='done'?'state-ok':'state-wait'}/><span>{job.title}</span><small>{job.status==='done'?'Terminé':job.status==='blocked'?'Bloqué':job.status==='awaiting_relay'?'Relais attendu':job.status==='running'?'En cours':'À consulter'}</small></button>)}</div>:<p>Vos résultats apparaîtront ici après le chargement du journal.</p>}</section>
 </div>;
}
