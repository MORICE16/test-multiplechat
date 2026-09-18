"use client";
import { useEffect, useRef, useState } from "react";

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function ResponsePlayer({ text, disabled = false }: { text: string; disabled?: boolean }) {
  const audio = useRef<HTMLAudioElement>(null);
  const abort = useRef<AbortController | null>(null);
  const objectUrl = useRef("");
  const [src, setSrc] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  useEffect(() => () => { abort.current?.abort(); if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); }, []);
  useEffect(() => {
    const pauseOthers = (event: Event) => { if ((event as CustomEvent).detail !== audio.current) audio.current?.pause(); };
    window.addEventListener("morice-audio-play", pauseOthers);
    return () => window.removeEventListener("morice-audio-play", pauseOthers);
  }, []);
  useEffect(() => { if (disabled) audio.current?.pause(); }, [disabled]);

  async function toggle() {
    if (disabled || busy) return;
    if (src && audio.current) {
      if (!audio.current.paused) audio.current.pause();
      else try { await audio.current.play(); } catch { setError("Touchez à nouveau Lecture pour autoriser le son."); }
      return;
    }
    setBusy(true); setError("");
    const controller = new AbortController(); abort.current = controller;
    try {
      const response = await fetch("/api/speech", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }), signal: controller.signal });
      if (!response.ok) { const data = await response.json() as { error?: string }; throw new Error(data.error || "Audio indisponible."); }
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      objectUrl.current = URL.createObjectURL(blob); setSrc(objectUrl.current);
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Audio indisponible."); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  function seek(value: number) { if (audio.current) { audio.current.currentTime = Math.max(0, Math.min(duration, value)); setPosition(audio.current.currentTime); } }
  return <div className="response-player" role="group" aria-label="Lecteur de réponse Morice">
    {/* The full spoken transcript is the adjacent message, available before audio generation. */}
    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
    <audio ref={audio} src={src || undefined} preload="metadata" onPlay={() => { setPlaying(true); window.dispatchEvent(new CustomEvent("morice-audio-play", { detail: audio.current })); }} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onTimeUpdate={() => setPosition(audio.current?.currentTime || 0)} onLoadedMetadata={() => { const value = audio.current?.duration || 0; setDuration(Number.isFinite(value) ? value : 0); }} onError={() => setError("Cet audio ne peut pas être lu par ce navigateur.")} />
    <button disabled={disabled || busy} onClick={toggle}>{busy ? "Préparation de la voix…" : playing ? "Pause" : src ? "Lecture" : "Écouter la réponse"}</button>
    {src && <><button disabled={disabled || !duration} onClick={() => seek(position - 10)} aria-label="Reculer de 10 secondes">−10 s</button><input aria-label="Position de lecture" type="range" min="0" max={duration || 1} step="0.1" value={position} disabled={disabled || !duration} onChange={e => seek(Number(e.target.value))} /><span>{clock(position)} / {clock(duration)}</span><button disabled={disabled || !duration} onClick={() => seek(position + 10)} aria-label="Avancer de 10 secondes">+10 s</button><select aria-label="Vitesse de lecture" value={rate} onChange={e => { const value = Number(e.target.value); setRate(value); if (audio.current) audio.current.playbackRate = value; }}><option value="1">×1</option><option value="1.5">×1,5</option><option value="2">×2</option></select></>}
    <small>Voix générée par IA{src ? " · Audio prêt : appuyez sur Lecture." : ""}</small>
    {error && <p role="alert">{error}</p>}
  </div>;
}
