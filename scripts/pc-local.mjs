import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {pathToFileURL} from 'node:url';

export const PC_ORIGIN='https://morice-alan-assistant.alan-nhl-99.chatgpt.site';
export const PC_PORT=17616;
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const run=promisify(execFile);
const powershell='C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
async function ps(script,timeout=5000){return run(powershell,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{timeout,windowsHide:true,maxBuffer:4096,shell:false});}
export async function windowsCalculator({platform=process.platform,call=run,psCall=ps}={}){
 if(platform!=='win32')return{status:'declined',verification:'not_executed'};
 // All executable paths, script text and arguments are fixed, never remote input.
 let accepted=false;
 try { const answer=await psCall("$w=New-Object -ComObject WScript.Shell; $r=$w.Popup('Morice demande uniquement l ouverture de la calculatrice. Autoriser cette fois ?',40,'Morice - action PC locale',4+32+256); Write-Output $r",45000);accepted=answer.stdout.trim()==='6'; }catch{/* Expiration and failures deny the action. */}
 if(!accepted)return{status:'declined',verification:'not_executed'};
 try {
  const before=await psCall("$p=Get-Process -Name CalculatorApp,Calculator -ErrorAction SilentlyContinue; if($p){Write-Output 'observed'}else{Write-Output 'missing'}");
  if(before.stdout.trim()==='observed')return{status:'uncertain',verification:'not_confirmed'};
  await call('C:\\Windows\\System32\\calc.exe',[],{timeout:5000,windowsHide:false,shell:false});
  const check=await psCall("$p=Get-Process -Name CalculatorApp,Calculator -ErrorAction SilentlyContinue; if($p){Write-Output 'observed'}else{Write-Output 'missing'}");
  if(check.stdout.trim()==='observed')return{status:'done',verification:'process_observed'};
 }catch{/* The launch may have happened; never retry it here. */}
 return{status:'uncertain',verification:'not_confirmed'};
}

export function createPcServer({port=PC_PORT,execute=windowsCalculator}={}){
 const session=randomUUID(),receipts=new Map();let busy=false,lastPrompt=0,windowStart=Date.now(),requests=0;
 const server=createServer({maxHeaderSize:4096,requestTimeout:6000,headersTimeout:5000},async(req,res)=>{
  const reply=(code,value)=>{if(!res.destroyed){res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));}};
  // CORS alone is not authorization. Reject hostile/missing Origin and DNS rebinding Hosts before any work.
  if(req.headers.host!==`127.0.0.1:${port||server.address()?.port}`||req.headers.origin!==PC_ORIGIN||req.headers.forwarded||req.headers['x-forwarded-host']||req.headers['x-forwarded-for'])return reply(403,{error:'origin_denied'});
  res.setHeader('Access-Control-Allow-Origin',PC_ORIGIN);res.setHeader('Vary','Origin');
  if(req.url!=='/action')return reply(404,{error:'not_found'});
  if(req.method==='OPTIONS'){
   if(req.headers['access-control-request-method']!=='POST'||(req.headers['access-control-request-headers']||'').toLowerCase().split(',').some(h=>h.trim()&&h.trim()!=='content-type'))return reply(403,{error:'preflight_denied'});
   res.setHeader('Access-Control-Allow-Methods','POST');res.setHeader('Access-Control-Allow-Headers','Content-Type');res.setHeader('Access-Control-Max-Age','60');
   if(req.headers['access-control-request-private-network']==='true')res.setHeader('Access-Control-Allow-Private-Network','true');
   res.writeHead(204);return res.end();
  }
  if(req.method!=='POST')return reply(405,{error:'post_required'});
  if(Date.now()-windowStart>60000){windowStart=Date.now();requests=0;}if(++requests>30)return reply(429,{error:'rate_limited'});
  if(req.headers['content-type']!=='application/json')return reply(415,{error:'json_required'});
  let bytes=0;const parts=[];
  try{for await(const part of req){bytes+=part.length;if(bytes>512){reply(413,{error:'too_large'});req.resume();return;}parts.push(part);}}catch{return reply(400,{error:'interrupted'});}
  let body;try{body=JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{return reply(400,{error:'invalid_json'});}
  if(!body||typeof body!=='object'||Array.isArray(body)||!uuid(body.requestId)||!['health','calculator'].includes(body.action)||Object.keys(body).sort().join(',')!==(body.action==='health'?'action,requestId':'action,requestId,session'))return reply(400,{error:'invalid_action'});
  if(body.action==='calculator'&&body.session!==session)return reply(409,{error:'session_changed'});
  const previous=receipts.get(body.requestId);
  if(previous){if(previous.action!==body.action)return reply(409,{error:'request_conflict'});return reply(200,await previous.result);}
  if(receipts.size>=256)return reply(429,{error:'session_full'});
  if(busy)return reply(409,{error:'action_in_progress'});
  if(body.action==='calculator'&&Date.now()-lastPrompt<20000)return reply(429,{error:'confirmation_cooldown'});
  const result=(async()=>{
   if(body.action==='health')return{version:1,requestId:body.requestId,session,action:'health',status:'done',checkedAt:new Date().toISOString(),verification:'loopback_response'};
   busy=true;lastPrompt=Date.now();let outcome;try{outcome=await execute();}catch{outcome={status:'uncertain',verification:'not_confirmed'};}finally{busy=false;}
   return{version:1,requestId:body.requestId,session,action:'calculator',status:outcome.status,checkedAt:new Date().toISOString(),verification:outcome.verification};
  })();
  receipts.set(body.requestId,{action:body.action,result});
  reply(200,await result);
 });
 server.maxConnections=8;server.keepAliveTimeout=1000;
 return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const server=createPcServer();
 server.on('error',()=>{console.error('Morice PC : port indisponible. Aucun service existant arrêté.');process.exitCode=1;});
 server.listen(PC_PORT,'127.0.0.1',()=>console.log('Morice PC local actif sur 127.0.0.1:17616. Santé et calculatrice uniquement. Ctrl+C pour arrêter. Aucun tunnel ni démarrage automatique.'));
 for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>server.close(()=>process.exit(0)));
}
