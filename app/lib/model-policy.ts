export type ModelTask = 'conversation' | 'research' | 'analysis';
// Documented Responses families only. Catalog membership is not a successful execution.
const economy = ['gpt-6-luna', 'gpt-5.4-mini', 'gpt-5-mini', 'gpt-4.1-mini'];
const capable = ['gpt-6.1-sol', 'gpt-6-sol', 'gpt-5.4', 'gpt-5.2', 'gpt-5.1', 'gpt-5', 'gpt-4.1'];
export function selectModel(ids: string[], task: ModelTask, text: string) {
  const complexity = task !== 'conversation' || text.length > 600 || /analyse|compar|architecture|raisonn|strat[eé]gie|complex|diagnostic|plusieurs|[ée]tapes/i.test(text) ? 'complex' : 'simple';
  const available = new Set(ids);
  // Astra/pro are excluded from automatic routing to bound spending.
  const preferred = complexity === 'complex' ? [...capable, ...economy] : [...economy, ...capable];
  const model = preferred.find(id => available.has(id));
  if (!model) throw new Error('Le modèle compatible est indisponible dans le catalogue du compte.');
  return { model, complexity, reason: complexity === 'complex' ? 'Analyse ou demande complexe' : 'Demande simple, coût réduit' };
}
