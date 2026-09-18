export type DayEvent = { id: string; subject: string; start: string; end: string; isAllDay: boolean; location: string };
export type MicrosoftDay = { events: DayEvent[]; hasMore: boolean; checkedAt: string; start: string; end: string };

export function validateDayRange(start: string | null, end: string | null, clock = Date.now()) {
  const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
  if (!start || !end || !iso.test(start) || !iso.test(end)) throw new Error("Bornes UTC requises.");
  const from = Date.parse(start), to = Date.parse(end);
  if (!Number.isFinite(from) || !Number.isFinite(to) || new Date(from).toISOString() !== start || new Date(to).toISOString() !== end || to <= from || to - from > 27 * 3_600_000 || from > clock || to <= clock) throw new Error("La période doit couvrir la journée actuelle.");
  return { start, end };
}

export function localDayRange(date = new Date()) {
  return { start: new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString(), end: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).toISOString() };
}

function utcDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?Z?$/.test(value)) return null;
  const stamp = Date.parse(value.endsWith("Z") ? value : `${value}Z`);
  return Number.isFinite(stamp) ? new Date(stamp).toISOString() : null;
}

export function dayEvents(data: Record<string, unknown> | null, start: string, end: string): MicrosoftDay {
  if (!Array.isArray(data?.value)) throw new Error("Réponse calendrier incomplète.");
  const events: DayEvent[] = [];
  for (const event of data.value) {
    if (!event || typeof event !== "object" || event.isCancelled) continue;
    const from = utcDate(event.start?.dateTime), to = utcDate(event.end?.dateTime);
    if (!from || !to || to <= from || to <= start || from >= end) continue;
    events.push({ id: typeof event.id === "string" ? event.id : `${from}-${events.length}`, subject: typeof event.subject === "string" ? event.subject : "Sans titre", start: from, end: to, isAllDay: event.isAllDay === true, location: typeof event.location?.displayName === "string" ? event.location.displayName : "" });
  }
  events.sort((a, b) => Number(b.isAllDay) - Number(a.isAllDay) || a.start.localeCompare(b.start));
  return { events, hasMore: typeof data?.["@odata.nextLink"] === "string", checkedAt: new Date().toISOString(), start, end };
}
