import { runtimeValue } from './runtime';
let catalog: {ids:string[]; expires:number} | undefined;
export async function analysisModel() {
  const key = runtimeValue('OPENAI_API_KEY');
  if (!key) throw new Error('OpenAI n’est pas configuré.');
  if (!catalog || catalog.expires < Date.now()) {
    const response = await fetch('https://api.openai.com/v1/models',{headers:{Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(15000)});
    if (!response.ok) throw new Error('Catalogue des modèles inaccessible. Aucun modèle supposé connecté.');
    const data = await response.json() as {data?:{id:string}[]};
    catalog = {ids:(data.data || []).map(m=>m.id),expires:Date.now()+300000};
  }
  // Restrict to documented Responses/vision GPT families; a catalog entry alone
  // does not prove an arbitrary audio, embedding or third-party model supports files.
  const candidates = catalog.ids.filter(id=>/^gpt-(?:4\.1|4o|5(?:\.\d+)?)(?:-mini)?$/.test(id));
  const configured = runtimeValue('OPENAI_MODEL');
  if (candidates.includes(configured)) return configured;
  const mini = candidates.filter(id=>id.endsWith('-mini')).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}));
  const selected = mini[0] || candidates.sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}))[0];
  if (!selected) throw new Error('Aucun modèle de vision compatible vérifié dans le catalogue de ce compte.');
  return selected;
}
