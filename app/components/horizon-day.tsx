"use client";
import { useEffect, useState } from "react";
import { localDayRange, type MicrosoftDay, type DayEvent } from "../lib/calendar-day";

function eventTime(event: DayEvent, day: MicrosoftDay) {
  if (event.isAllDay) return "Toute la journée";
  const time = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${event.start < day.start ? "Depuis la veille" : time(event.start)} – ${event.end > day.end ? "au-delà de minuit" : event.end === day.end ? "minuit" : time(event.end)}`;
}

export function HorizonDay({ connected, onCalendar }: { connected: boolean; onCalendar: () => void }) {
  const [day, setDay] = useState<MicrosoftDay | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [dateLabel, setDateLabel] = useState("");
  useEffect(() => {
    const date = new Date();
    const range = localDayRange(date);
    setDateLabel(date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }));
    setDay(null); setError("");
    if (!connected) { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true);
    void (async () => {
      try {
        const response = await fetch(`/api/microsoft/day?${new URLSearchParams(range)}`, { signal: controller.signal, cache: "no-store" });
        const data = await response.json() as Partial<MicrosoftDay> & { error?: string };
        if (!data || typeof data !== "object") throw new Error("Réponse du calendrier incomplète.");
        if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Le calendrier est indisponible.");
        if (!Array.isArray(data.events) || data.start !== range.start || data.end !== range.end) throw new Error("Réponse du calendrier incomplète.");
        if (!controller.signal.aborted) setDay(data as MicrosoftDay);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Le calendrier est indisponible.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    const rollover = () => { if (localDayRange().start !== range.start) setRefresh(value => value + 1); };
    const interval = window.setInterval(rollover, 60_000);
    document.addEventListener("visibilitychange", rollover);
    return () => { controller.abort(); window.clearInterval(interval); document.removeEventListener("visibilitychange", rollover); };
  }, [connected, refresh]);

  return <section className="horizon-day" aria-label="Votre journée">
    <div className="horizon-section-heading"><div><p className="eyebrow">{dateLabel || "AUJOURD’HUI"}</p><h2>Votre journée</h2></div>
      {connected && <button className="button secondary" disabled={loading} onClick={() => setRefresh(value => value + 1)}>Actualiser</button>}
    </div>
    {!connected ? <><p>Reliez Microsoft pour retrouver vos rendez-vous ici.</p><button className="button secondary" onClick={onCalendar}>Ouvrir les connexions</button></> : <>
      <p className="horizon-day-source">Calendrier principal Microsoft · heures locales</p>
      {loading && <p role="status">Lecture de votre journée…</p>}
      {error && <p role="alert">{error}</p>}
      {day && <>
        {!day.events.length && <p>Aucun rendez-vous dans votre calendrier principal aujourd’hui.</p>}
        <div className="horizon-timeline">{day.events.map(event => <article key={event.id}>
          <time dateTime={event.start}>{eventTime(event, day)}</time><div><h3>{event.subject || "Sans titre"}</h3>{event.location && <p>{event.location}</p>}</div>
        </article>)}</div>
        {day.hasMore && <p>Premiers rendez-vous affichés : la journée comporte d’autres événements.</p>}
        <p className="horizon-day-updated">Actualisé à {new Date(day.checkedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</p>
      </>}
    </>}
  </section>;
}
