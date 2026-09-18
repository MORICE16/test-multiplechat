import { now, runtimeValue, userId } from '@/app/lib/runtime';
import { fetchOpenClawDiagnostic } from '@/app/lib/openclaw-diagnostic';
import { createJob, transitionJob } from '@/app/lib/jobs';

export async function POST(request: Request) {
  const uid = userId(request);
  const id = await createJob(uid, 'Diagnostic privé OpenClaw', 'Lire la santé de la passerelle et l’état des appareils, sans commande téléphone.', 'openclaw_diagnostic');
  await transitionJob(uid, id, 'running', 'Diagnostic privé demandé');
  try {
    const data = await fetchOpenClawDiagnostic(runtimeValue('OPENAI_API_KEY'), runtimeValue('MORICE_OPENCLAW_TUNNEL_ID'));
    await transitionJob(uid, id, 'done', 'Deux résultats de diagnostic reçus', data.result, { tool: 'OpenClaw via tunnel MCP privé', operation: 'openclaw_diagnostic', checkedAt: data.checkedAt, responseId: data.responseId, verification: 'Réponses des deux outils reçues; lecture seule' });
    return Response.json({ ...data, jobId: id }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    const error = 'Diagnostic non confirmé. Vérifiez que le PC et le client du tunnel sont actifs, puis réessayez. Aucun ordre envoyé au téléphone.';
    await transitionJob(uid, id, 'blocked', error);
    return Response.json({ error, jobId: id, checkedAt: now() }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
