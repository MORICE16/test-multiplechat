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

// Graph is explicitly requested in UTC. Label the display zone rather than
// interpreting its timezone-less dateTime in the server's local timezone.
export function calendarReadText(data: Record<string, unknown> | null) {
  if(!Array.isArray(data?.value))throw new Error("Microsoft n’a pas confirmé la lecture du calendrier.");
  const format=new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',dateStyle:'medium',timeStyle:'short'});
  const dateOnly=new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',dateStyle:'medium'});
  const rows:string[]=[];
  for(const item of data.value.slice(0,10)){
    if(!item||typeof item!=='object'||Array.isArray(item))throw new Error('Réponse calendrier incomplète.');
    const event=item as {isCancelled?:unknown;isAllDay?:unknown;subject?:unknown;start?:{dateTime?:unknown;timeZone?:unknown};location?:{displayName?:unknown}};
    if(event.isCancelled===true)continue;
    const start=utcDate(event.start?.dateTime);
    if(!start||(event.start?.timeZone!=null&&event.start.timeZone!=='UTC'&&event.start.timeZone!=='Etc/UTC'))throw new Error('Heure du calendrier non confirmée.');
    const title=typeof event.subject==='string'?event.subject:'Sans titre';
    const place=typeof event.location?.displayName==='string'&&event.location.displayName?` (${event.location.displayName})`:'';
    rows.push(`${event.isAllDay===true?dateOnly.format(new Date(start))+' · Toute la journée':format.format(new Date(start))} — ${title}${place}`);
  }
  const more=Boolean(data['@odata.nextLink'])||data.value.length>10;
  const empty=more?'Aucun rendez-vous actif dans cette page.':'Aucun rendez-vous actif dans les sept prochains jours.';
  return 'Calendrier principal · sept prochains jours · heures de Paris (Europe/Paris)\n'+(rows.length?rows.join('\n'):empty)+(more?'\nLecture partielle : d’autres rendez-vous restent à lire dans Outlook.':'');
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
