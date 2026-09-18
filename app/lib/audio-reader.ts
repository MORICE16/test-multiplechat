export function speechParts(text: string, limit = 3500): string[] {
  if (!Number.isInteger(limit) || limit < 2 || limit > 4000) throw new Error("Invalid speech segment size");
  const parts: string[] = [];
  while (text.length > limit) {
    let cut = Math.max(text.lastIndexOf("\n", limit), text.lastIndexOf(". ", limit - 1) + 1, text.lastIndexOf(" ", limit));
    if (cut < limit / 2) cut = limit;
    const code = text.charCodeAt(cut - 1);
    if (code >= 0xd800 && code <= 0xdbff) cut--;
    parts.push(text.slice(0, cut)); text = text.slice(cut);
  }
  if (text) parts.push(text);
  return parts;
}
export type ReadingPosition = { part: number; position: number; rate: number };
export type ReaderState = ReadingPosition & { count: number; duration: number; busy: boolean; ready: boolean; playing: boolean; error: string };
export const emptyReader: ReaderState = { part: 0, position: 0, rate: 1, count: 1, duration: 0, busy: false, ready: false, playing: false, error: "" };
type Audio = Pick<HTMLAudioElement, "src" | "currentTime" | "duration" | "playbackRate" | "paused" | "play" | "pause" | "load" | "removeAttribute" | "addEventListener" | "removeEventListener">;
type Dependencies = { generate: (text: string, signal: AbortSignal) => Promise<string>; release: (url: string) => void; changed: (state: ReaderState) => void; save: (position: ReadingPosition) => void; activate: () => void };

export class AudioReader {
  parts: string[]; state: ReaderState; audio: Audio; deps: Dependencies;
  private cache = new Map<number, string>();
  private abort: AbortController | null = null;
  private sequence = 0;
  private wanted = false;
  private disabled = false;
  private disposed = false;
  private loaded = false;
  private listeners: [string, EventListener][] = [];
  constructor(text: string, audio: Audio, deps: Dependencies, saved?: Partial<ReadingPosition> | null) {
    this.parts = speechParts(text.trim()); this.audio = audio; this.deps = deps;
    const part = Number.isInteger(saved?.part) && saved!.part! >= 0 && saved!.part! < this.parts.length ? saved!.part! : 0;
    const position = typeof saved?.position === "number" && Number.isFinite(saved.position) && saved.position >= 0 ? Math.min(saved.position, 86400) : 0;
    this.state = { ...emptyReader, count: this.parts.length, part, position, rate: [1, 1.5, 2].includes(saved?.rate || 0) ? saved!.rate! : 1 };
    this.listen("loadedmetadata", () => {
      if (!this.state.ready || !audio.src) return;
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      audio.currentTime = Math.min(this.state.position, duration); audio.playbackRate = this.state.rate;
      this.loaded = true;
      this.update({ duration, position: audio.currentTime });
      if (this.wanted) void this.play();
    });
    this.listen("timeupdate", () => { if (this.loaded) this.update({ position: audio.currentTime }); });
    this.listen("play", () => { if (!this.wanted || this.disabled) audio.pause(); else this.update({ playing: true, error: "" }); });
    this.listen("pause", () => { this.update({ playing: false }); });
    this.listen("ended", () => {
      if (this.disabled || !this.wanted) return;
      if (this.state.part + 1 < this.parts.length) void this.select(this.state.part + 1, true);
      else { this.wanted = false; this.update({ playing: false, position: 0 }); }
    });
    this.listen("error", () => {
      if (!this.state.ready) return;
      this.pause(); this.loaded = false;
      const url = this.cache.get(this.state.part);
      if (url) { this.deps.release(url); this.cache.delete(this.state.part); }
      audio.removeAttribute("src");
      this.update({ ready: false, error: "Cet audio ne peut pas être lu. Réessayez la préparation." });
    });
    this.update({});
  }
  private listen(name: string, listener: EventListener) { this.audio.addEventListener(name, listener); this.listeners.push([name, listener]); }
  private update(change: Partial<ReaderState>) {
    if (this.disposed) return;
    this.state = { ...this.state, ...change };
    const { part, position, rate } = this.state;
    try { this.deps.save({ part, position, rate }); } catch { /* Storage restrictions must not stop playback. */ }
    this.deps.changed({ ...this.state });
  }
  private async play() {
    if (this.disabled || this.disposed || !this.wanted) return;
    const sequence = this.sequence;
    try { await this.audio.play(); }
    catch { if (!this.disposed && sequence === this.sequence && this.wanted) { this.wanted = false; this.update({ playing: false, error: "Audio prêt. Appuyez sur Lecture pour autoriser le son." }); } }
  }
  pause() {
    this.wanted = false; this.sequence++; this.abort?.abort(); this.abort = null;
    this.audio.pause(); this.update({ busy: false, playing: false });
  }
  setDisabled(value: boolean) { this.disabled = value; if (value) this.pause(); }
  async toggle() {
    if (this.disposed || this.disabled || !this.parts.length) return;
    if (this.state.busy || this.state.playing) { this.pause(); return; }
    this.deps.activate();
    if (!this.state.ready) { await this.prepare(true); return; }
    this.wanted = true;
    if (this.audio.currentTime >= this.audio.duration) this.seek(0);
    await this.play();
  }
  async select(part: number, autoplay = false) {
    if (this.disabled || this.disposed || !Number.isInteger(part) || part < 0 || part >= this.parts.length) return;
    this.pause(); this.loaded = false; this.audio.removeAttribute("src"); this.audio.load();
    this.update({ part, position: 0, duration: 0, ready: false, error: "" });
    if (autoplay) { this.deps.activate(); await this.prepare(true); }
  }
  private async prepare(autoplay: boolean) {
    const sequence = ++this.sequence, part = this.state.part;
    this.wanted = autoplay;
    const controller = new AbortController(); this.abort = controller;
    this.update({ busy: true, error: "" });
    try {
      let url = this.cache.get(part);
      if (!url) {
        url = await this.deps.generate(this.parts[part], controller.signal);
        if (this.disposed || sequence !== this.sequence || controller.signal.aborted) { this.deps.release(url); return; }
        this.cache.set(part, url);
        if (this.cache.size > 3) { const oldest = this.cache.keys().next().value!; this.deps.release(this.cache.get(oldest)!); this.cache.delete(oldest); }
      }
      if (this.disposed || sequence !== this.sequence) return;
      this.loaded = false;
      this.update({ busy: false, ready: true });
      this.audio.src = url; this.audio.load();
    } catch (error) {
      if (!this.disposed && sequence === this.sequence && !controller.signal.aborted) {
        this.wanted = false; this.update({ busy: false, error: error instanceof Error ? error.message : "Audio indisponible. Réessayez." });
      }
    }
  }
  seek(position: number) {
    if (!this.loaded || !Number.isFinite(position) || !this.state.duration) return;
    this.audio.currentTime = Math.max(0, Math.min(this.state.duration, position));
    this.update({ position: this.audio.currentTime });
  }
  speed(rate: number) { if ([1, 1.5, 2].includes(rate)) { this.audio.playbackRate = rate; this.update({ rate }); } }
  dispose() {
    this.pause(); this.disposed = true;
    for (const [name, fn] of this.listeners) this.audio.removeEventListener(name, fn);
    this.audio.removeAttribute("src"); this.audio.load();
    for (const url of this.cache.values()) this.deps.release(url);
    this.cache.clear();
  }
}
