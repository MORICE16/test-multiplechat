export const PC_ENDPOINT = 'http://127.0.0.1:17616/action';
export const pcActions = ['health', 'calculator'] as const;
export type PcAction = typeof pcActions[number];
export type PcReceipt = { version: 1; requestId: string; session: string; action: PcAction; status: 'done'|'declined'|'uncertain'; checkedAt: string; verification: 'loopback_response'|'process_observed'|'not_executed'|'not_confirmed' };
export const pcUuid = (v: unknown): v is string => typeof v==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export function validPcReceipt(v: unknown): v is PcReceipt {
 if(!v || typeof v!=='object' || Array.isArray(v))return false;
 const p=v as Record<string,unknown>;
 if(Object.keys(p).sort().join(',')!=='action,checkedAt,requestId,session,status,verification,version')return false;
 if(p.version!==1 || !pcUuid(p.requestId) || !pcUuid(p.session) || typeof p.checkedAt!=='string' || !Number.isFinite(Date.parse(p.checkedAt)) || Math.abs(Date.now()-Date.parse(p.checkedAt))>300_000)return false;
 return p.action==='health' ? p.status==='done' && p.verification==='loopback_response' : p.action==='calculator' && ((p.status==='done'&&p.verification==='process_observed')||(p.status==='declined'&&p.verification==='not_executed')||(p.status==='uncertain'&&p.verification==='not_confirmed'));
}
export function pcResult(p: PcReceipt) {
 return p.action==='health' ? 'La liaison locale du PC a répondu. Aucun fichier, mail ou microphone consulté.' : p.status==='done' ? 'Calculatrice Windows : processus observé après confirmation locale. La présence visuelle de la fenêtre reste à contrôler.' : p.status==='declined' ? 'Ouverture refusée ou confirmation locale expirée. Aucun lancement demandé.' : 'Lancement demandé mais résultat non confirmé. Vérifiez Windows ; aucun nouvel essai automatique.';
}
