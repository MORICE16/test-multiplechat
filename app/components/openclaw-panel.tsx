"use client";
import { useState } from 'react';
import type { OpenClawDiagnostic } from '../lib/openclaw-diagnostic';

export function OpenClawPanel() {
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<OpenClawDiagnostic | null>(null);
  const [error, setError] = useState('');
  async function check() {
    setBusy(true); setError(''); setData(null);
    try {
      const response = await fetch('/api/openclaw/diagnostic', { method: 'POST' });
      const body = await response.json() as OpenClawDiagnostic & { error?: string };
      if (!response.ok) throw new Error(body.error || 'Diagnostic indisponible.');
      setData(body);
    } catch (e) { setError(e instanceof Error ? e.message : 'Diagnostic indisponible.'); }
    finally { setBusy(false); }
  }
  return <article><div><b>OpenClaw · diagnostic privé</b><p>Vérifier la passerelle et les appareils. Le PC doit être allumé et le client du tunnel actif. Aucun contrôle du téléphone.</p></div>
    <button disabled={busy} onClick={check}>{busy ? 'Diagnostic en cours…' : 'Vérifier OpenClaw'}</button>
    {error && <p role="alert">{error}</p>}
    {data && <div role="status"><p>{data.result}</p><p>Vérifié le {new Date(data.checkedAt).toLocaleString('fr-FR')}. Résultat enregistré dans Travaux.</p></div>}
  </article>;
}
