import {env} from 'cloudflare:workers';
import {userId,now} from '../../lib/runtime';
export async function GET(request:Request) {
  const uid=userId(request);
  const counts=await env.DB.prepare('SELECT operation,status,COUNT(*) count FROM morice_jobs WHERE user_id=? GROUP BY operation,status').bind(uid).all();
  return Response.json({format:'MORICE-SYNC/1',generatedAt:now(),privacy:'Export technique : aucun texte de demande, nom de fichier, compte, secret ou résultat privé.',jobs:counts.results,continuity:'Les demandes et résultats privés restent dans le journal authentifié de Morice. CORE-SYNC.md dans GitHub porte les décisions de développement; cet export ne met pas automatiquement à jour le projet CORE ou MultipleChat.'},{headers:{'Cache-Control':'no-store','Content-Disposition':'attachment; filename="MORICE-RUNTIME-SYNC.json"'}});
}
