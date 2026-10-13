'use client';
import { useEffect, useRef, useState } from 'react';
import { BrowserReader, type BrowserPosition, type BrowserReading } from '../lib/browser-reader';

export function BrowserResponsePlayer({ text, disabled = false }: { text: string; disabled?: boolean }) {
  const reader = useRef<BrowserReader | null>(null);
  const disabledRef = useRef(disabled);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<BrowserReading>({ part: 0, offset: 0, rate: 1, count: 1, playing: false, busy: false, error: '' });
  useEffect(() => {
    let disposed = false;
    const owner = {};
    const pauseOthers = (event: Event) => { if ((event as CustomEvent).detail !== owner) reader.current?.pause(); };
    async function initialize() {
      let key = ''; let saved: Partial<BrowserPosition> | null = null;
      try {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
        key = 'morice-browser-reading-v1:' + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
        saved = JSON.parse(sessionStorage.getItem(key) || 'null');
      } catch { /* Storage is optional. */ }
      if (disposed) return;
      if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) { setState(previous => ({ ...previous, error: 'Ce navigateur ne propose pas de voix. Le texte reste disponible.' })); return; }
      reader.current = new BrowserReader(text, {
        synth: window.speechSynthesis, create: part => new SpeechSynthesisUtterance(part), changed: setState,
        save: position => { if (key) sessionStorage.setItem(key, JSON.stringify(position)); },
        activate: () => window.dispatchEvent(new CustomEvent('morice-audio-play', { detail: owner })),
      }, saved);
      reader.current.setDisabled(disabledRef.current); setReady(true);
    }
    void initialize(); window.addEventListener('morice-audio-play', pauseOthers);
    return () => { disposed = true; reader.current?.dispose(); reader.current = null; window.removeEventListener('morice-audio-play', pauseOthers); };
  }, [text]);
  useEffect(() => { disabledRef.current = disabled; reader.current?.setDisabled(disabled); }, [disabled]);
  return <div className="response-player" role="group" aria-label="Lecteur de réponse Morice">
    <button disabled={disabled || !ready} onClick={() => state.playing || state.busy ? reader.current?.pause() : reader.current?.play()}>{state.busy ? 'Annuler' : state.playing ? 'Pause' : 'Écouter la réponse'}</button>
    {state.count > 1 && <><button disabled={disabled || state.part === 0} onClick={() => reader.current?.select(state.part - 1)}>Passage précédent</button><span>Passage {state.part + 1}/{state.count}</span><button disabled={disabled || state.part + 1 >= state.count} onClick={() => reader.current?.select(state.part + 1)}>Passage suivant</button></>}
    <select aria-label="Vitesse de lecture" disabled={disabled || !ready} value={state.rate} onChange={event => reader.current?.speed(Number(event.target.value))}><option value="1">×1</option><option value="1.5">×1,5</option><option value="2">×2</option></select>
    <small>Voix de votre appareil · Sans API OpenAI · Reprise au dernier mot signalé, ou au début du passage. La voix dépend du navigateur et peut nécessiter Internet.</small>
    {state.error && <p role="alert">{state.error}</p>}
  </div>;
}
