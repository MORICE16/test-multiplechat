import type { ModelResponse } from './web-result';
export function ideaResult(response: ModelResponse) {
  if (response.status !== 'completed' || !response.id) throw new Error('Analyse non terminée.');
  const text = (response.output || []).flatMap(o=>o.content || []).filter(c=>c.type === 'output_text').map(c=>c.text || '').join('\n').trim();
  if (!text) throw new Error('Aucun résultat d’analyse reçu.');
  return {text,responseId:response.id,checkedAt:new Date().toISOString(),tool:'OpenAI · analyse de pièces jointes',...(response.model?{model:response.model}:{}),...(response.usage?{usage:response.usage}:{})};
}
