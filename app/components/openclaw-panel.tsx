"use client";
import { useState } from 'react';
import type { OpenClawDiagnostic } from '../lib/openclaw-diagnostic';

export function OpenClawPanel({apiAllowed=false}:{apiAllowed?:boolean}) {
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<OpenClawDiagnostic | null>(null);
  const [error, setError] = useState('');
  async function check() {
    if(!apiAllowed)return;
    setBusy(true); setError(''); setData(null);
    try {
      const response = await fetch('/api/openclaw/diagnostic', { method: 'POST' });
      const body = await response.json() as OpenClawDiagnostic & { error?: string };
      if (!response.ok) throw new Error(body.error || 'Diagnostic indisponible.');
      setData(body);
    } catch (e) { setError(e instanceof Error ? e.message : 'Diagnostic indisponible.'); }
    finally { setBusy(false); }
  }
  return <article><div><b>OpenClaw · diagnostic privé</b><p>{apiAllowed?'Vérifier la passerelle et les appareils via le tunnel privé existant. Aucun contrôle du téléphone.':'Le diagnostic distant existant utilise une API payante, désactivée selon votre choix. La liaison privée sans API payante reste à raccorder. Allumer le PC seul ne la rétablit pas.'}</p></div>
    <button disabled={busy||!apiAllowed} onClick={check}>{!apiAllowed?'Diagnostic distant désactivé':busy ? 'Diagnostic en cours…' : 'Vérifier OpenClaw'}</button>
    {error && <p role="alert">{error}</p>}
    {data && <div role="status"><p>{data.result}</p><p>Vérifié le {new Date(data.checkedAt).toLocaleString('fr-FR')}. Résultat enregistré dans Travaux.</p></div>}
  </article>;
}
