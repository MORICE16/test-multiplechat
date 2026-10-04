import { runtimeValue } from './runtime';
import { selectModel, type ModelTask } from './model-policy';
let catalog: { ids: string[]; expires: number } | undefined;
export async function routeModel(task: ModelTask, text = '') {
  const key = runtimeValue('OPENAI_API_KEY');
  if (!key) throw new Error('OpenAI n’est pas configuré.');
  if (!catalog || catalog.expires < Date.now()) {
    const response = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Le modèle ne peut pas être vérifié : catalogue inaccessible.');
    const data = await response.json() as { data?: { id: string }[] };
    catalog = { ids: (data.data || []).map(m => m.id), expires: Date.now() + 300000 };
  }
  // New families require a recorded runtime benchmark before automatic activation.
  const verified = runtimeValue('OPENAI_ROUTING_VERIFIED_MODELS').split(',').map(s => s.trim());
  const eligible = catalog.ids.filter(id => !id.startsWith('gpt-6') || verified.includes(id));
  return selectModel(eligible, task, text);
}
export async function analysisModel(text = '') { return (await routeModel('analysis', text)).model; }
