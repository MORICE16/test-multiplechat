export type DictationState = "idle" | "starting" | "listening" | "reconnecting" | "paused" | "stopping" | "ready" | "error";
type Result = { isFinal: boolean; 0: { transcript: string } };
export type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: { results: ArrayLike<Result> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
};
type Options = {
  create: () => Recognition;
  onState: (state: DictationState) => void;
  onText: (text: string) => void;
  onError: (message: string) => void;
  schedule?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  cancel?: (timer: ReturnType<typeof setTimeout>) => void;
};

// User intent survives the browser's individual recognition sessions.
export function createDictation(options: Options) {
  const schedule = options.schedule ?? setTimeout;
  const cancel = options.cancel ?? clearTimeout;
  let wanted = false, disposed = false, stopping = false, available = true;
  let current: Recognition | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let text = "", failures = 0, quietEnds = 0;
  const join = (...parts: string[]) => parts.map(p => p.trim()).filter(Boolean).join(" ");
  function clearTimer() { if (timer !== null) cancel(timer); timer = null; }
  function detach(recognition: Recognition) {
    recognition.onstart = recognition.onresult = recognition.onerror = recognition.onend = null;
  }
  function fail(message: string) {
    wanted = false; stopping = false; clearTimer();
    if (current) { const old = current; current = null; detach(old); try { old.abort(); } catch { /* The browser may have already released its microphone. */ } }
    options.onState("error"); options.onError(message);
  }
  function session() {
    if (!wanted || disposed || current) return;
    if (!available) { options.onState("paused"); return; }
    let recognition: Recognition;
    try { recognition = options.create(); } catch { fail("La reconnaissance vocale est indisponible dans ce navigateur."); return; }
    current = recognition;
    const base = text;
    let finalText = "", interimText = "", networkError = false;
    recognition.lang = "fr-FR";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onstart = () => { if (current === recognition && wanted) { clearTimer(); options.onState("listening"); } };
    recognition.onresult = event => {
      if (current !== recognition || disposed) return;
      const finals: string[] = [], interim: string[] = [];
      for (let index = 0; index < event.results.length; index++) {
        const result = event.results[index];
        (result.isFinal ? finals : interim).push(result[0].transcript);
      }
      const nextFinal = join(...finals), nextInterim = join(...interim);
      // Empty results sometimes arrive just before onend; keep the useful text.
      if (!nextFinal && !nextInterim) return;
      finalText = nextFinal; interimText = nextInterim;
      text = join(base, finalText, interimText);
      failures = 0; quietEnds = 0;
      options.onText(text);
    };
    recognition.onerror = event => {
      if (current !== recognition || disposed || !wanted) return;
      const errors: Record<string, string> = {
        "not-allowed": "Microphone refusé. Autorisez le micro dans les réglages du site, puis relancez l’écoute.",
        "service-not-allowed": "La reconnaissance vocale est bloquée par le navigateur. Vérifiez les autorisations du site.",
        "audio-capture": "Microphone introuvable ou occupé. Vérifiez le périphérique sélectionné.",
        "language-not-supported": "Le service vocal ne prend pas en charge le français.",
      };
      if (errors[event.error]) { fail(errors[event.error]); return; }
      if (event.error === "network") networkError = true;
      else if (event.error !== "no-speech" && event.error !== "aborted") fail("La reconnaissance vocale a échoué. Votre texte est conservé ; relancez l’écoute.");
    };
    recognition.onend = () => {
      if (current !== recognition || disposed) return;
      detach(recognition); current = null; clearTimer();
      text = join(base, finalText, interimText);
      if (!wanted) { stopping = false; options.onState("ready"); return; }
      if (networkError && ++failures >= 3) { fail("Le service vocal est injoignable. Vérifiez votre connexion, puis relancez l’écoute. Votre texte est conservé."); return; }
      options.onState("reconnecting");
      const delay = networkError ? Math.min(4000, 1000 * failures)
        : finalText || interimText ? 300 : Math.min(8000, 500 * 2 ** Math.min(quietEnds++, 4));
      timer = schedule(() => { timer = null; session(); }, delay);
    };
    timer = schedule(() => {
      timer = null;
      if (current === recognition && wanted) fail("Le navigateur n’a pas démarré la reconnaissance vocale. Vérifiez l’autorisation du microphone ou ouvrez Morice dans Chrome ou Edge.");
    }, 15000);
    try { recognition.start(); } catch { fail("Le micro n’a pas pu démarrer. Vérifiez les autorisations, puis réessayez."); }
  }
  return {
    start(initialText = "") {
      if (disposed || wanted || stopping || current) return;
      text = initialText; failures = 0; quietEnds = 0; wanted = true;
      options.onState("starting"); session();
    },
    stop() {
      if (disposed || stopping || !wanted) return;
      wanted = false; clearTimer();
      if (!current) { options.onState("ready"); return; }
      stopping = true; options.onState("stopping");
      const old = current;
      // stop delivers final results; abort would discard the last phrase.
      timer = schedule(() => {
        timer = null;
        if (current !== old) return;
        detach(old); current = null; stopping = false;
        try { old.abort(); } catch { /* The browser may have already released its microphone. */ }
        options.onState("ready");
      }, 2500);
      try { old.stop(); } catch {
        clearTimer(); detach(old); current = null; stopping = false;
        try { old.abort(); } catch { /* The browser may have already released its microphone. */ }
        options.onState("ready");
      }
    },
    setAvailable(value: boolean) {
      if (disposed || value === available) return;
      available = value;
      if (!wanted || stopping) return;
      clearTimer();
      if (!available) {
        // Preserve the latest displayed transcript before releasing the browser.
        if (current) { const old = current; current = null; detach(old); try { old.abort(); } catch { /* Already ended. */ } }
        options.onState("paused");
      } else {
        failures = 0; quietEnds = 0;
        options.onState("reconnecting");
        timer = schedule(() => { timer = null; session(); }, 300);
      }
    },
    dispose() {
      disposed = true; wanted = false; clearTimer();
      if (current) { const old = current; current = null; detach(old); try { old.abort(); } catch { /* The browser may have already released its microphone. */ } }
    },
  };
}
