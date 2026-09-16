export type RecordingState = "idle" | "starting" | "listening" | "paused" | "stopping" | "ready" | "error";
type Options = {
  acquire: () => Promise<MediaStream>;
  create: (stream: MediaStream) => MediaRecorder;
  transcribe: (audio: Blob, signal: AbortSignal) => Promise<string>;
  onState: (state: RecordingState) => void;
  onText: (text: string) => void;
  onError: (message: string) => void;
  onAudio: (audio: Blob | null) => void;
  onSend: (text: string) => void;
};

// Recording has no silence timer and no dependency on a speech-recognition network.
// Only an explicit stop/send submits audio. Interrupted capture is kept for recovery.
export function createRecording(options: Options) {
  let disposed = false, ended = false, busy = false, requested = false, send = false;
  let recorder: MediaRecorder | null = null, stream: MediaStream | null = null;
  let chunks: Blob[] = [], audio: Blob | null = null, base = "";
  const abort = new AbortController();
  const state = (value: RecordingState) => { if (!disposed) options.onState(value); };
  const release = () => { stream?.getTracks().forEach(track => { track.onended = null; track.stop(); }); stream = null; };
  const fail = (message: string) => { if (!disposed) { state("error"); options.onError(message); } };
  async function transcribe(shouldSend = false) {
    if (disposed || busy || !audio) return;
    busy = true; state("stopping"); options.onError("");
    try {
      const text = (await options.transcribe(audio, abort.signal)).trim();
      if (disposed) return;
      if (!text) throw new Error("Aucune parole reconnue. Vous pouvez réessayer ou récupérer l’audio.");
      const combined = [base.trim(), text].filter(Boolean).join(" ");
      options.onText(combined); state("ready");
      audio = null; chunks = []; options.onAudio(null);
      if (shouldSend) options.onSend(combined);
    } catch (error) {
      fail(error instanceof Error ? error.message : "Transcription impossible. Votre audio est conservé dans cette page.");
    } finally { busy = false; }
  }
  return {
    async start(initialText: string) {
      base = initialText; state("starting");
      try {
        stream = await options.acquire();
        if (disposed || requested) { release(); state("ready"); return; }
        recorder = options.create(stream);
        recorder.ondataavailable = event => { if (!disposed && event.data.size) chunks.push(event.data); };
        recorder.onerror = () => { send = false; requested = false; fail("Le téléphone a interrompu le microphone. Récupérez l’audio disponible avant de recommencer."); };
        recorder.onstop = () => {
          ended = true; release();
          if (disposed) return;
          audio = new Blob(chunks, { type: recorder?.mimeType || chunks[0]?.type || "audio/webm" });
          options.onAudio(audio.size ? audio : null);
          if (!audio.size) { audio = null; fail("Aucun son enregistré. Relancez le microphone."); return; }
          if (requested) void transcribe(send);
          else fail("Le téléphone a interrompu l’enregistrement. Votre audio est conservé : touchez Réessayer pour le transcrire.");
        };
        stream.getTracks().forEach(track => { track.onended = () => { if (recorder?.state !== "inactive") recorder?.stop(); }; });
        recorder.start(1000); state("listening");
      } catch { release(); fail("Microphone indisponible. Autorisez son accès dans le navigateur, puis réessayez."); }
    },
    pause() {
      if (!recorder || requested || disposed) return;
      if (recorder.state === "recording") { recorder.pause(); state("paused"); }
      else if (recorder.state === "paused") { recorder.resume(); state("listening"); }
    },
    stop(shouldSend = false) {
      if (disposed || requested || busy || ended) return;
      requested = true; send = shouldSend; state("stopping");
      if (recorder && recorder.state !== "inactive") recorder.stop();
      // A still-pending permission request is cancelled by intent, never sent later.
    },
    retry() { void transcribe(false); },
    dispose() {
      disposed = true; abort.abort();
      if (recorder && recorder.state !== "inactive") recorder.stop();
      release(); chunks = []; audio = null;
    },
  };
}
