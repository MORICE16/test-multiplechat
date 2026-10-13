import { speechParts } from './audio-reader';

export type BrowserPosition = { part: number; offset: number; rate: number };
export type BrowserReading = BrowserPosition & { count: number; playing: boolean; busy: boolean; error: string };
type Dependencies = {
  synth: Pick<SpeechSynthesis, 'speak' | 'cancel' | 'resume' | 'getVoices'>;
  create: (text: string) => SpeechSynthesisUtterance;
  changed: (state: BrowserReading) => void;
  save: (position: BrowserPosition) => void;
  activate: () => void;
};

export class BrowserReader {
  readonly parts: string[];
  state: BrowserReading;
  private current: SpeechSynthesisUtterance | null = null;
  private sequence = 0;
  private disposed = false;
  private disabled = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(text: string, private deps: Dependencies, saved?: Partial<BrowserPosition> | null) {
    this.parts = speechParts(text.trim(), 300);
    const part = Number.isInteger(saved?.part) && saved!.part! >= 0 && saved!.part! < this.parts.length ? saved!.part! : 0;
    const offset = Number.isInteger(saved?.offset) && saved!.offset! >= 0 && saved!.offset! < (this.parts[part]?.length || 0) ? saved!.offset! : 0;
    this.state = { part, offset, rate: [1, 1.5, 2].includes(saved?.rate || 0) ? saved!.rate! : 1, count: this.parts.length, playing: false, busy: false, error: '' };
    this.update({});
  }
  private update(change: Partial<BrowserReading>) {
    this.state = { ...this.state, ...change };
    this.deps.changed({ ...this.state });
    try { this.deps.save({ part: this.state.part, offset: this.state.offset, rate: this.state.rate }); } catch { /* Reading works without browser storage. */ }
  }
  private clearTimer() { clearTimeout(this.timer); this.timer = undefined; }
  pause() {
    this.sequence++; this.clearTimer();
    if (this.current) { this.current = null; this.deps.synth.cancel(); }
    if (!this.disposed) this.update({ playing: false, busy: false });
  }
  play() {
    if (this.disposed || this.disabled || !this.parts.length || this.current) return;
    this.deps.activate();
    const sequence = ++this.sequence;
    const start = this.state.offset;
    const utterance = this.deps.create(this.parts[this.state.part].slice(start));
    this.current = utterance;
    utterance.lang = 'fr-FR'; utterance.rate = this.state.rate;
    const voices = this.deps.synth.getVoices().filter(voice => /^fr\b/i.test(voice.lang));
    utterance.voice = voices.find(voice => voice.localService) || voices[0] || null;
    const active = () => !this.disposed && this.current === utterance && sequence === this.sequence;
    utterance.onstart = () => { if (active()) { this.clearTimer(); this.update({ playing: true, busy: false }); } };
    utterance.onboundary = event => {
      if (!active() || !Number.isInteger(event.charIndex) || event.charIndex < 0) return;
      let offset = Math.min(start + event.charIndex, this.parts[this.state.part].length - 1);
      if (offset > 0 && /[\uDC00-\uDFFF]/.test(this.parts[this.state.part][offset])) offset--;
      this.update({ offset });
    };
    utterance.onend = () => {
      if (!active()) return;
      this.current = null; this.clearTimer();
      if (this.state.part + 1 < this.parts.length) { this.update({ part: this.state.part + 1, offset: 0 }); this.play(); }
      else this.update({ part: 0, offset: 0, playing: false, busy: false });
    };
    utterance.onerror = () => { if (active()) { this.pause(); this.update({ error: 'La voix de cet appareil est indisponible. Votre position est conservée ; réessayez la lecture.' }); } };
    this.update({ busy: true, error: '' });
    this.timer = setTimeout(() => { if (active()) { this.pause(); this.update({ error: 'La voix du navigateur ne démarre pas. Vérifiez les voix installées et réessayez.' }); } }, 15000);
    try { this.deps.synth.resume(); this.deps.synth.speak(utterance); }
    catch { if (active()) { this.pause(); this.update({ error: 'Lecture indisponible dans ce navigateur.' }); } }
  }
  select(part: number) {
    if (!Number.isInteger(part) || part < 0 || part >= this.parts.length) return;
    const playing = this.state.playing;
    this.pause(); this.update({ part, offset: 0, error: '' }); if (playing) this.play();
  }
  speed(rate: number) {
    if (![1, 1.5, 2].includes(rate)) return;
    const playing = this.state.playing;
    this.pause(); this.update({ rate }); if (playing) this.play();
  }
  setDisabled(disabled: boolean) { this.disabled = disabled; if (disabled) this.pause(); }
  dispose() { this.pause(); this.disposed = true; }
}
