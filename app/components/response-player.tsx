"use client";
import { useEffect, useRef, useState } from "react";
import { AudioReader, emptyReader, type ReadingPosition } from "../lib/audio-reader";

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
export function ResponsePlayer(props: { text: string; disabled?: boolean }) { return <Player key={props.text} {...props} />; }

function Player({ text, disabled = false }: { text: string; disabled?: boolean }) {
  const audio = useRef<HTMLAudioElement>(null);
  const reader = useRef<AudioReader | null>(null);
  const disabledRef = useRef(disabled);
  const [state, setState] = useState(emptyReader);
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    let disposed = false;
    const element = audio.current!;
    async function initialize() {
      let storageKey = "";
      let saved: Partial<ReadingPosition> | null = null;
      try {
        const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
        storageKey = "morice-reading-v1:" + Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, "0")).join("");
        saved = JSON.parse(sessionStorage.getItem(storageKey) || "null");
      } catch { /* Playback remains available when session storage is blocked. */ }
      if (disposed) return;
      reader.current = new AudioReader(text, element, {
        async generate(part, signal) {
          const response = await fetch("/api/speech", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: part }), signal });
          if (!response.ok) { const data = await response.json() as { error?: string }; throw new Error(data.error || "Audio indisponible."); }
          return URL.createObjectURL(await response.blob());
        },
        release: url => URL.revokeObjectURL(url), changed: setState,
        save: position => { if (storageKey) sessionStorage.setItem(storageKey, JSON.stringify(position)); },
        activate: () => window.dispatchEvent(new CustomEvent("morice-audio-play", { detail: element })),
      }, saved);
      reader.current.setDisabled(disabledRef.current); setInitialized(true);
    }
    void initialize();
    const pauseOthers = (event: Event) => { if ((event as CustomEvent).detail !== element) reader.current?.pause(); };
    window.addEventListener("morice-audio-play", pauseOthers);
    return () => { disposed = true; reader.current?.dispose(); reader.current = null; window.removeEventListener("morice-audio-play", pauseOthers); };
  }, [text]);
  useEffect(() => { disabledRef.current = disabled; reader.current?.setDisabled(disabled); }, [disabled]);
  return <div className="response-player" role="group" aria-label="Lecteur de réponse Morice">
    {/* The adjacent message is the full transcript, available before generation. */}
    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
    <audio ref={audio} preload="metadata" />
    <button disabled={disabled || !initialized} onClick={() => void reader.current?.toggle()}>{state.busy ? "Annuler la préparation" : state.playing ? "Pause" : state.ready ? "Lecture" : state.position > 0 || state.part > 0 ? "Reprendre la réponse" : "Écouter la réponse"}</button>
    {state.count > 1 && <select aria-label="Passage de la réponse" disabled={disabled || state.busy} value={state.part} onChange={e => void reader.current?.select(Number(e.target.value))}>{Array.from({ length: state.count }, (_, n) => <option key={n} value={n}>Passage {n + 1} / {state.count}</option>)}</select>}
    {state.ready && <><button disabled={disabled || !state.duration} onClick={() => reader.current?.seek(state.position - 10)} aria-label="Reculer de 10 secondes">−10 s</button><input aria-label="Position de lecture dans le passage" type="range" min="0" max={state.duration || 1} step="0.1" value={Math.min(state.position, state.duration || 0)} disabled={disabled || !state.duration} onChange={e => reader.current?.seek(Number(e.target.value))} /><span>{clock(state.position)} / {clock(state.duration)}</span><button disabled={disabled || !state.duration} onClick={() => reader.current?.seek(state.position + 10)} aria-label="Avancer de 10 secondes">+10 s</button></>}
    <select aria-label="Vitesse de lecture" value={state.rate} disabled={disabled || !initialized} onChange={e => reader.current?.speed(Number(e.target.value))}><option value="1">×1</option><option value="1.5">×1,5</option><option value="2">×2</option></select>
    <small>Voix générée par IA · Position conservée dans cet onglet.{state.count > 1 ? " Les passages s’enchaînent pendant la lecture." : ""}{!state.ready && state.position > 0 ? ` Reprise vers ${clock(state.position)} après préparation.` : ""}</small>
    {state.error && <p role="alert">{state.error}</p>}
  </div>;
}
