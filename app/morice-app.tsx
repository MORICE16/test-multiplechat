"use client";

import { useEffect, useRef, useState } from "react";
import { readWidgetDraft } from "./lib/widget-draft";
import { createRecording, type RecordingState as DictationState } from "./lib/recording";
import { ResponsePlayer } from "./components/response-player";
import { ResultText } from "./components/result-text";
import { JobsPanel, useJobs } from "./components/jobs-panel";
import { ImprovementsPanel } from "./components/improvements-panel";
import { MailReviewPanel } from "./components/mail-review";
import { type Citation } from "./lib/web-result";

type Item = {
  id: string;
  kind: "module" | "task" | "memory" | "approval";
  title: string;
  content: string;
  status: string;
  priority: string;
  position: number;
  execution?: { provider: string; operation: string; payload: string; result: string };
};

type State = { items: Item[]; settings: Record<string, unknown> };

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type InstallState = "checking" | "available" | "manual" | "installed";
type ChatMessage = { id: string; role: "user" | "assistant" | "error"; text: string; action?: AssistantAction };

type AssistantAction = {
  jobId?: string;
  citations?: Citation[];
  checkedAt?: string;
  tool?: string;
  id: string;
  kind: "task" | "memory" | "approval" | "result";
  title: string;
  content: string;
  status: string;
  label: string;
  view: string;
};

type AssistantResult = { reply: string; action: AssistantAction; warning?: string };

type BrandIconName = "hubspot" | "outlook" | "todo" | "notes" | "onedrive" | "bitcoin";

type ConnectionState = {
  openai: { configured: boolean; model: string };
  microsoft: { configured: boolean; connected: boolean; account: string };
  make: { configured: boolean };
  hubspot: { configured: false; disabled: true; reason: string };
};

const MORICE_LOGO_SRC = "/morice-3d.png?v=morice-logo-44fce869-20260823";

const navigation = [
  ["home", "Accueil", "⌂"],
  ["chat", "Conversation", "✦"],
  ["tasks", "Tâches", "✓"],
  ["jobs", "Travaux", "↻"],
  ["improvements", "Améliorations", "✧"],
  ["calendar", "Agenda", "□"],
  ["approvals", "Validations", "◆"],
  ["connections", "Connexions", "⌁"],
  ["projects", "Projets", "▰"],
  ["memory", "Notes & mémoire", "◉"],
  ["search", "Recherche", "⌕"],
  ["mail", "Emails", "✉"],
  ["clients", "Clients", "♙"],
  ["crypto", "Crypto", "₿"],
  ["estate", "Immobilier", "⌂"],
  ["bmac", "B-MAC Conseil", "◆"],
  ["house", "Maison & Maurice", "●"],
  ["tools", "Outils", "⌁"],
  ["settings", "Paramètres", "⚙"],
] as const;

const brandIcons: Record<BrandIconName, string> = {
  hubspot: "/brand-icons/hubspot.svg",
  outlook: "/brand-icons/outlook.svg",
  todo: "/brand-icons/todo.svg",
  notes: "/brand-icons/samsung-notes.png",
  onedrive: "/brand-icons/onedrive.svg",
  bitcoin: "/brand-icons/bitcoin.svg",
};

const quickActions = [
  ["calendar", "Mon agenda", "Les rendez-vous à venir", "outlook"],
  ["mail", "Ma boîte mail", "Outlook", "outlook"],
  ["tasks", "Mes tâches", "Mon suivi dans Morice", "todo"],
  ["memory", "Mes idées", "Notes et mémoire Morice", "notes"],
] as const;

const starterModules = [
  ["chat", "Agir avec Morice", "✦"],
  ["mail", "Mail & Brouillons", "✉"],
  ["hubspot", "HubSpot", "◎"],
  ["tasks", "Tâches", "✓"],
  ["calendar", "Agenda", "□"],
  ["approvals", "Validations", "◆"],
  ["documents", "Documents", "▤"],
  ["memory", "Mémoire", "◉"],
  ["connections", "Connexions", "⌁"],
];

const defaultState: State = {
  items: starterModules.map(([id, title, content], position) => ({ id, kind: "module", title, content, status: "active", priority: "normal", position })),
  settings: { digest_times: ["08:00", "13:00", "18:30"], voice_enabled: false, urgent_notifications: true },
};

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

async function api<T = Record<string, unknown>>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { headers: { "Content-Type": "application/json", ...(init?.headers || {}) }, ...init });
  const payload = await response.json().catch(() => { throw new Error("Le service Morice est indisponible. Votre message est conservé."); });
  if (!response.ok) {
    const error = payload && typeof payload === "object" && "error" in payload ? payload.error : null;
    throw new Error(typeof error === "string" ? error : "Morice ne peut pas terminer cette action.");
  }
  return payload as T;
}

export default function MoriceApp() {
  const queue = useJobs(() => { void loadConversation(); });
  const [state, setState] = useState<State>(defaultState);
  const [view, setView] = useState("home");
  const [storageStatus, setStorageStatus] = useState<"checking" | "online" | "error">("checking");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [newValue, setNewValue] = useState("");
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installState, setInstallState] = useState<InstallState>("checking");
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [assistantMode, setAssistantMode] = useState("auto");
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [connections, setConnections] = useState<ConnectionState | null>(null);
  const [executingId, setExecutingId] = useState("");
  const [dictationState, setDictationState] = useState<DictationState>("idle");
  const [dictationError, setDictationError] = useState("");
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const audioUrlRef = useRef("");
  const [clock, setClock] = useState<Date | null>(null);
  const dictationRef = useRef<ReturnType<typeof createRecording> | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const sendingRef = useRef(false);

  const tasks = state.items.filter((item) => item.kind === "task");
  const memories = state.items.filter((item) => item.kind === "memory");
  const approvals = state.items.filter((item) => item.kind === "approval" && item.status === "pending");
  const actionHistory = state.items.filter((item) => item.kind === "approval" && item.status !== "pending");
  const recentItems = state.items.filter((item) => item.kind !== "module").slice(0, 5);
  const currentView = navigation.find(([id]) => id === view);
  const voiceActive = ["starting", "listening", "reconnecting", "paused"].includes(dictationState);
  const voicePhase = assistantBusy ? "thinking" : dictationState;

  async function refresh() {
    try {
      const data = await api<State>("/api/state");
      setState(data);
      setStorageStatus("online");
    } catch (error) {
      setStorageStatus("error");
      setNotice(error instanceof Error ? error.message : "Les données Morice ne peuvent pas être chargées.");
    }
  }

  async function refreshConnections() {
    try { setConnections(await api("/api/connections") as ConnectionState); } catch { /* Le stockage principal reste utilisable. */ }
  }

  async function loadConversation() {
    try {
      const data = await api<{ messages: ChatMessage[] }>("/api/assistant");
      if (!sendingRef.current) setMessages(data.messages);
    } catch { setNotice("L’historique n’a pas pu être chargé. Les messages déjà affichés sont conservés."); }
  }

  useEffect(() => {
    const initialLoadTimer = window.setTimeout(() => {
      void refresh();
      void refreshConnections();
      void loadConversation();
      const params = new URLSearchParams(window.location.search);
      if (params.get("microsoft") === "connected") {
        setView("connections");
        setNotice("Microsoft 365 est connecté à Morice.");
        history.replaceState({}, "", window.location.pathname);
      } else if (params.get("microsoft") === "error") {
        setView("connections");
        setNotice(params.get("reason") || "La connexion Microsoft n’a pas abouti.");
        history.replaceState({}, "", window.location.pathname);
      }
      const widgetDraft = readWidgetDraft(window.location.hash);
      if (widgetDraft !== null) {
        setView("chat");
        setMessage(widgetDraft);
        setDictationState(widgetDraft ? "ready" : "idle");
        history.replaceState({}, "", window.location.pathname + window.location.search);
        if (widgetDraft) setNotice("Votre dictée est prête. Relisez-la, puis touchez Envoyer.");
      } else if (["chat", "jobs", "improvements"].includes(params.get("view") || "")) {
        setView(params.get("view")!);
      }
      setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
      const standalone = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
      if (standalone) setInstallState("installed");
      else if (!("serviceWorker" in navigator)) setInstallState("manual");
    }, 0);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" })
        .then(async registration => {
          await registration.update();
          await navigator.serviceWorker.ready;
          setInstallState(current => current === "checking" ? "manual" : current);
        })
        .catch(() => setInstallState(current => current === "installed" ? current : "manual"));
    }

    const rememberInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
      setInstallState("available");
      setShowInstallHelp(false);
    };
    const installationFinished = () => {
      setInstallPrompt(null);
      setInstallState("installed");
      setShowInstallHelp(false);
      setNotice("Morice est maintenant installé comme application.");
    };
    window.addEventListener("beforeinstallprompt", rememberInstallPrompt);
    window.addEventListener("appinstalled", installationFinished);
    return () => {
      window.clearTimeout(initialLoadTimer);
      window.removeEventListener("beforeinstallprompt", rememberInstallPrompt);
      window.removeEventListener("appinstalled", installationFinished);
    };
  }, []);

  useEffect(() => () => { dictationRef.current?.dispose(); dictationRef.current = null; }, []);

  useEffect(() => {
    const receiveWidgetDraft = () => {
      const draft = readWidgetDraft(window.location.hash);
      if (draft === null) return;
      if (voiceActive || recordedAudio || dictationState === "stopping") {
        setNotice("Terminez votre enregistrement avant d’ouvrir une autre dictée."); return;
      }
      dictationRef.current?.dispose();
      dictationRef.current = null;
      setMessage(draft);
      setView("chat");
      setDictationState(draft ? "ready" : "idle");
      history.replaceState({}, "", window.location.pathname + window.location.search);
      setNotice("Votre dictée est prête. Relisez-la, puis touchez Envoyer.");
    };
    window.addEventListener("hashchange", receiveWidgetDraft);
    return () => window.removeEventListener("hashchange", receiveWidgetDraft);
  }, [voiceActive, recordedAudio, dictationState]);

  function keepRecordedAudio(audio: Blob | null) {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = audio ? URL.createObjectURL(audio) : "";
    setRecordedAudio(audio); setAudioUrl(audioUrlRef.current);
  }
  useEffect(() => () => { if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current); }, []);

  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    if (!voiceActive && !recordedAudio && dictationState !== "stopping") return;
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [voiceActive, recordedAudio, dictationState]);

  useEffect(() => {
    const updateClock = () => setClock(new Date());
    updateClock();
    const timer = window.setInterval(updateClock, 1_000);
    return () => window.clearInterval(timer);
  }, []);

  async function installMorice() {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    if (standalone || installState === "installed") {
      setInstallState("installed");
      setNotice("Morice est déjà installé sur cet appareil.");
      return;
    }
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setInstallPrompt(null);
        setInstallState("installed");
      } else {
        setNotice("Installation annulée. Tu peux la relancer quand tu veux.");
      }
      return;
    }
    setShowInstallHelp(true);
    setNotice("");
  }

  async function askMorice(confirmedText?: string) {
    const textToSend = (confirmedText ?? message).trim();
    if (!textToSend || sendingRef.current || (!confirmedText && (voiceActive || recordedAudio || dictationState === "stopping"))) return;
    if (textToSend.length > 1200) { setNotice("Votre demande dépasse 1 200 caractères. Raccourcissez-la avant de l’envoyer."); return; }
    sendingRef.current = true;
    setMessages(previous => [...previous, { id: crypto.randomUUID(), role: "user", text: textToSend }]);
    setAssistantBusy(true);
    try {
      const result = await api("/api/assistant", { method: "POST", body: JSON.stringify({ message: textToSend, mode: assistantMode }) }) as AssistantResult;
      setMessages(previous => [...previous, { id: crypto.randomUUID(), role: "assistant", text: result.reply, action: result.action }]);
      if (result.warning) setNotice(result.warning);
      setMessage("");
      setDictationState("idle");
      await refresh();
    } catch (error) {
      const errorText = error instanceof Error ? error.message : "Morice n’a pas pu exécuter cette action.";
      setMessages(previous => [...previous, { id: crypto.randomUUID(), role: "error", text: errorText }]);
      setNotice(errorText);
    } finally {
      sendingRef.current = false;
      setAssistantBusy(false);
    }
  }

  async function addItem(kind: Item["kind"], title: string, content = "") {
    if (!title.trim()) return;
    await api("/api/state", { method: "POST", body: JSON.stringify({ action: "add", kind, title, content }) });
    setNewValue("");
    await refresh();
  }

  async function updateItem(id: string, status: string) {
    await api("/api/state", { method: "POST", body: JSON.stringify({ action: "status", id, status }) });
    await refresh();
  }

  async function executeApproval(id: string) {
    if (executingId) return;
    setExecutingId(id);
    try {
      const result = await api("/api/actions/execute", { method: "POST", body: JSON.stringify({ id }) }) as { result: string };
      setNotice(result.result);
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "L’action n’a pas pu être exécutée.");
    } finally {
      await refresh();
      setExecutingId("");
    }
  }

  async function disconnectMicrosoft() {
    await api("/api/connections", { method: "DELETE" });
    await refreshConnections();
    setNotice("Microsoft 365 est déconnecté de Morice.");
  }

  async function enableNotifications() {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) throw new Error("Ce navigateur ne permet pas les notifications Morice.");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Les notifications n'ont pas été autorisées.");
      const registration = await navigator.serviceWorker.register("/sw.js");
      const { publicKey } = await api<{ publicKey: string }>("/api/push/key");
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
      await api("/api/push/subscribe", { method: "POST", body: JSON.stringify(subscription.toJSON()) });
      const result = await api("/api/push/test", { method: "POST" }) as { sent: number };
      setNotice(`${result.sent} notification Morice envoyée. Elle peut prendre quelques secondes.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Notification impossible.");
    }
  }

  function toggleDictation() {
    if (voiceActive) { dictationRef.current?.stop(); return; }
    if (assistantBusy || dictationState === "stopping" || recordedAudio) return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setNotice("Le microphone nécessite un navigateur compatible en HTTPS. Essayez Chrome ou Edge."); return;
    }
    window.speechSynthesis?.cancel(); setNotice(""); setDictationError("");
    window.dispatchEvent(new CustomEvent("morice-audio-play", { detail: null }));
    dictationRef.current?.dispose();
    dictationRef.current = createRecording({
      acquire: () => navigator.mediaDevices.getUserMedia({ audio: true }),
      create: stream => {
        const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find(type => MediaRecorder.isTypeSupported(type));
        return new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 32000 });
      },
      transcribe: async (audio, signal) => {
        const response = await fetch("/api/transcription", { method: "POST", body: audio, signal: AbortSignal.any([signal, AbortSignal.timeout(100_000)]) });
        if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("Connexion au site expirée. Téléchargez votre audio avant de vous reconnecter.");
        const result = await response.json() as { text?: string; error?: string };
        if (!response.ok || typeof result.text !== "string") throw new Error(result.error || "Transcription impossible. Réessayez ; votre audio reste dans cette page.");
        return result.text;
      },
      onState: setDictationState, onText: setMessage, onAudio: keepRecordedAudio,
      onError: error => { setDictationError(error); setNotice(error); },
      onSend: text => { void askMorice(text); },
    });
    void dictationRef.current.start(message);
  }

  function sendMessage() {
    if (voiceActive) dictationRef.current?.stop(true);
    else void askMorice();
  }

  function discardAudio() {
    dictationRef.current?.dispose(); dictationRef.current = null;
    keepRecordedAudio(null); setDictationState(message ? "ready" : "idle"); setDictationError(""); setNotice("");
  }

  const dateText = clock ? new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(clock) : "Aujourd’hui";
  const timeText = clock ? new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(clock) : "--:--";

  return (
    <main className="morice-shell">
      <aside className="morice-sidebar">
        <button className="brand" onClick={() => setView("home")}>
          <img src={MORICE_LOGO_SRC} alt="Logo officiel de Morice" />
          <span><b>MORICE</b><small>Assistant personnel</small></span>
        </button>
        <nav className="side-navigation" aria-label="Navigation principale">
          {navigation.filter(([id]) => ["home", "chat", "tasks", "memory", "mail", "calendar", "approvals", "connections", "settings"].includes(id)).map(([id, label, icon]) => <button key={id} className={`${view === id ? "active " : ""}nav-${id}`} onClick={() => setView(id)}><i><NavigationIcon id={id} fallback={icon} /></i><span>{label}</span>{id === "tasks" && tasks.filter(item => item.status !== "done").length > 0 && <em>{tasks.filter(item => item.status !== "done").length}</em>}</button>)}
        </nav>
        <details className="other-spaces"><summary>Mes autres espaces</summary><nav className="side-navigation" aria-label="Autres espaces">{navigation.filter(([id]) => !["home", "chat", "tasks", "memory", "mail", "calendar", "approvals", "connections", "settings"].includes(id)).map(([id, label, icon]) => <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}><i><NavigationIcon id={id} fallback={icon} /></i><span>{label}</span></button>)}</nav></details>
        <div className="sidebar-footer">
          {installState !== "installed" && <button className="outline-action" onClick={installMorice}>Installer l’application</button>}
          <button className="outline-action" onClick={enableNotifications}>Activer les notifications</button>
          <p className={`online ${storageStatus}`}><span /> {storageStatus === "online" ? "Données Morice en ligne" : storageStatus === "error" ? "Stockage indisponible" : "Connexion aux données…"}</p>
        </div>
      </aside>

      <section className="morice-content">
        <header className={`topbar ${view === "home" ? "dashboard-topbar" : ""}`}><div><p className="eyebrow">MON ESPACE PERSONNEL</p><h1>{view === "home" ? "Ma journée" : currentView?.[1] || "Morice"}</h1></div><div className="topbar-actions"><button onClick={() => setView("approvals")} aria-label="Ouvrir les validations"><span>◆</span>{approvals.length > 0 && <b>{approvals.length}</b>}</button><img src={MORICE_LOGO_SRC} alt="Logo officiel de Morice" /></div></header>
        <label className="mobile-sections">Ouvrir un espace<select aria-label="Choisir un espace" value={view} onChange={event => setView(event.target.value)}>{navigation.map(([id, title]) => <option key={id} value={id}>{title}</option>)}<option value="documents">Documents</option><option value="hubspot">HubSpot</option></select></label>
        {notice && <button className="notice" onClick={() => setNotice("")}>{notice}<span>×</span></button>}

        {view === "home" && <>
          <div className="dashboard-grid">
            <div className="dashboard-main">
              <section className="welcome-card">
                <div className="welcome-identity"><div><p className="eyebrow">{dateText}</p><h2>{clock && clock.getHours() >= 18 ? "Bonsoir" : "Bonjour"}, Alan.</h2><p>Une idée, une question, quelque chose à faire ?</p><button className={"welcome-talk " + (voiceActive ? "listening" : "")} disabled={assistantBusy || dictationState === "stopping"} onClick={() => { setView("chat"); toggleDictation(); }}><MicIcon />{voiceActive ? "Arrêter l’écoute" : "Parler à Morice"}</button></div><div className="portrait-wrap"><img src={MORICE_LOGO_SRC} alt="Logo officiel de Morice" /></div></div>
                <div className="welcome-meta"><button onClick={() => setView("tasks")}><strong>{storageStatus === "online" ? tasks.filter(item => item.status !== "done").length : "—"}</strong><span>Tâches à suivre</span></button><button onClick={() => setView("approvals")}><strong>{storageStatus === "online" ? approvals.length : "—"}</strong><span>À valider</span></button><div><strong>{timeText}</strong><span>Heure locale</span></div></div>
              </section>

              <CommandPanel message={message} setMessage={setMessage} messages={messages} assistantMode={assistantMode} setAssistantMode={setAssistantMode} assistantBusy={assistantBusy} voicePhase={voicePhase} dictationError={dictationError} onMic={toggleDictation} onSend={sendMessage} onPause={() => dictationRef.current?.pause()} audioUrl={audioUrl} audioExtension={recordedAudio?.type.includes("mp4") ? "mp4" : "webm"} onRetry={() => dictationRef.current?.retry()} onDiscard={discardAudio} onOpenAction={(nextView) => setView(nextView)} />

              <section className="quick-panel"><div className="panel-heading"><div><p className="eyebrow">RACCOURCIS</p><h2>Accès rapide</h2></div></div><div className="quick-grid">{quickActions.map(([id, label, source, brand]) => <button key={id} className={`quick-${brand}`} onClick={() => setView(id)}><i><BrandIcon name={brand} /></i><span><b>{label}</b><small>{source}</small></span><em>→</em></button>)}</div></section>

              <section className="activity-panel"><div className="panel-heading"><div><p className="eyebrow">VOTRE SUIVI</p><h2>Activité récente</h2></div><span>{recentItems.length} élément{recentItems.length > 1 ? "s" : ""}</span></div>{recentItems.length ? <div className="activity-list">{recentItems.map(item => <article className={`activity-${item.kind}`} key={item.id}><i>{item.kind === "task" ? "✓" : item.kind === "memory" ? "◉" : "◆"}</i><div><b>{item.title}</b><p>{item.content || (item.kind === "task" ? "Tâche enregistrée dans Morice" : "Élément enregistré dans Morice")}</p></div><span>{item.kind === "approval" ? actionStatus(item.status) : item.status === "done" ? "Terminé" : "En cours"}</span></article>)}</div> : <div className="empty">Aucune activité enregistrée pour le moment.</div>}</section>
            </div>

            <aside className="context-rail">
              <section className="agenda-card"><div className="panel-heading"><div><p className="eyebrow">AUJOURD’HUI</p><h2>Mon agenda</h2></div><button onClick={() => setView("calendar")}>Voir tout</button></div><div className="empty compact">{connections?.microsoft.connected ? "Consultez vos prochains rendez-vous dans l’agenda." : "Connectez Microsoft 365 pour retrouver vos rendez-vous."}</div></section>
              <section className="device-card"><div className="panel-heading"><div><p className="eyebrow">APPLICATION</p><h2>Mes appareils</h2></div><button onClick={() => setView("settings")}>Voir</button></div><div className="device-list"><article><span>▣</span><div><b>Cet appareil</b><small>{installState === "installed" ? "Application Morice installée" : "Installation disponible"}</small></div><em className={installState === "installed" ? "ok" : ""}>{installState === "installed" ? "Installé" : "À installer"}</em></article><article><span>▯</span><div><b>Z Fold 7</b><small>Liaison au site à finaliser</small></div><em>En attente</em></article></div>{installState !== "installed" && <button onClick={installMorice}>Installer Morice</button>}</section>
              <section className="shortcut-card"><div className="panel-heading"><div><p className="eyebrow">NAVIGATION</p><h2>Raccourcis</h2></div></div><div className="shortcut-list"><button className="shortcut-bmac" onClick={() => setView("bmac")}><span>◆</span><b>B-MAC Conseil</b><em>›</em></button><button className="shortcut-crypto" onClick={() => setView("crypto")}><span><BrandIcon name="bitcoin" /></span><b>Suivi crypto</b><em>›</em></button><button className="shortcut-house" onClick={() => setView("house")}><span>●</span><b>Maison & Maurice</b><em>›</em></button><button className="shortcut-approval" onClick={() => setView("approvals")}><span>✓</span><b>Validations</b><em>{approvals.length || "›"}</em></button></div></section>
              <section className="connection-card"><div className="panel-heading"><div><p className="eyebrow">SERVICES</p><h2>Connexions</h2></div><button onClick={() => setView("connections")}>Détails</button></div><div className="service-list"><ServiceStatus name="OpenAI" ok={Boolean(connections?.openai.configured)} detail={connections?.openai.configured ? connections.openai.model : "À configurer"} /><ServiceStatus name="Microsoft 365" ok={Boolean(connections?.microsoft.connected)} detail={connections?.microsoft.connected ? connections.microsoft.account : "Non connecté"} /><ServiceStatus name="Make" ok={Boolean(connections?.make.configured)} detail={connections?.make.configured ? "Webhook configuré" : "À configurer"} /><ServiceStatus name="OpenClaw" ok={false} detail="Passerelle à relier au site" /></div></section>
            </aside>
          </div>
        </>}

        {view === "chat" && <div className="single-column"><CommandPanel message={message} setMessage={setMessage} messages={messages} assistantMode={assistantMode} setAssistantMode={setAssistantMode} assistantBusy={assistantBusy} voicePhase={voicePhase} dictationError={dictationError} onMic={toggleDictation} onSend={sendMessage} onPause={() => dictationRef.current?.pause()} audioUrl={audioUrl} audioExtension={recordedAudio?.type.includes("mp4") ? "mp4" : "webm"} onRetry={() => dictationRef.current?.retry()} onDiscard={discardAudio} onOpenAction={(nextView) => setView(nextView)} /></div>}

        {view === "tasks" && <ListPanel title="Tâches Morice" items={tasks} value={newValue} setValue={setNewValue} add={() => addItem("task", newValue)} update={updateItem} />}
        {view === "jobs" && <JobsPanel queue={queue} waiting={approvals.length} tasks={tasks} onTasks={() => setView("tasks")} onApprovals={() => setView("approvals")} />}
        {view === "improvements" && <ImprovementsPanel />}
        {view === "memory" && <ListPanel title="Mémoire longue durée" items={memories} value={newValue} setValue={setNewValue} add={() => addItem("memory", "Souvenir", newValue)} update={updateItem} />}
        {view === "approvals" && <section className="panel"><p className="eyebrow">CONTRÔLE HUMAIN</p><h2>Validations</h2><p>Morice n’envoie, ne crée et ne modifie rien à l’extérieur sans ton accord ici.</p>
          {approvals.length ? approvals.map(item => <article className="row" key={item.id}><div><b>{item.title}</b><p>{item.content}</p><ActionDetails item={item} /></div><button disabled={Boolean(executingId) || !item.execution} onClick={() => executeApproval(item.id)}>{executingId === item.id ? "Exécution…" : "Valider et exécuter"}</button><button className="secondary" disabled={Boolean(executingId)} onClick={() => updateItem(item.id, "rejected")}>Refuser</button></article>) : <div className="empty">Aucune validation en attente.</div>}
          {actionHistory.length > 0 && <><h3>Résultats et actions à vérifier</h3>{actionHistory.map(item => <article className="row" key={item.id}><div><b>{item.title} — {actionStatus(item.status)}</b><ActionDetails item={item} />{["needs_review", "executing"].includes(item.status) && <p>Vérifie le service concerné avant de préparer une nouvelle action. La relance automatique est bloquée.</p>}</div></article>)}</>}
        </section>}
        {view === "settings" && <section className="panel"><div className="widget-install"><img src={MORICE_LOGO_SRC} alt="Logo officiel de Morice" /><div><p className="eyebrow">SUR TON Z FOLD</p><h2>Morice, à portée de main.</h2><p>La tête de Morice sur ton écran d’accueil. Un appui pour dicter, puis relire et envoyer ta demande.</p><a className="download-app" href="/downloads/morice-1.1.0.apk" download>Installer le widget Android</a><p className="widget-help">Après la mise à jour, ouvre Morice et choisis « Ajouter le widget à l’accueil ».</p></div></div><hr /><p className="eyebrow">APPLICATION</p><h2>Installer Morice</h2><p>Installe Morice avec son icône Rottweiler et une fenêtre indépendante du navigateur.</p><div className={`install-status ${installState}`}><span />{installState === "installed" ? "Morice est installé sur cet appareil" : installState === "available" ? "Morice est prêt à être installé" : installState === "checking" ? "Vérification de l’installation…" : "Installation disponible depuis le menu du navigateur"}</div><button onClick={installMorice}>{installState === "installed" ? "Vérifier l’installation" : installState === "available" ? "Installer Morice maintenant" : "Afficher comment l’installer"}</button>{showInstallHelp && <div className="install-help"><b>Installation en deux gestes</b>{isIos ? <p>Dans Safari, touche <strong>Partager</strong>, puis <strong>Sur l’écran d’accueil</strong>.</p> : <p>Ouvre le menu <strong>⋮</strong> en haut à droite, puis choisis <strong>Installer Morice</strong> ou <strong>Ajouter à l’écran d’accueil</strong>.</p>}<p>Aucun rechargement de la page n’est nécessaire.</p></div>}<hr /><p className="eyebrow">RÉGLAGES</p><h2>Notifications Morice</h2><p>Autorise les notifications une fois sur chaque appareil. Le bouton ci-dessous envoie un vrai test en arrière-plan.</p><button onClick={enableNotifications}>Activer et tester maintenant</button><hr /><h3>Synthèses quotidiennes</h3><p>Horaires envisagés. L’envoi automatique reste à configurer.</p><div className="times">{((state.settings.digest_times as string[]) || ["08:00", "13:00", "18:30"]).map(time => <input key={time} type="time" aria-label="Horaire envisagé" disabled defaultValue={time} />)}</div></section>}
        {view === "mail" && <><MailReviewPanel /><MicrosoftReadPanel title="Emails récents" operation="mail_read" /></>}
        {view === "hubspot" && <InfoPanel title="HubSpot indisponible" text="Aucun accès HubSpot supplémentaire n’est disponible. Morice ne simulera jamais une connexion et utilisera Microsoft 365 ou Make pour les actions autorisées." />}
        {view === "calendar" && <MicrosoftReadPanel title="Agenda" operation="calendar_read" />}
        {view === "documents" && <InfoPanel title="Documents & OneDrive" text="Morice peut rechercher des documents OneDrive après la connexion Microsoft 365, sans exposer les jetons d’accès." />}
        {view === "connections" && <ConnectionsPanel state={connections} refresh={refreshConnections} disconnectMicrosoft={disconnectMicrosoft} />}
        {view === "projects" && <InfoPanel title="Projets" text="L’espace projets est prêt. Il n’affichera que des projets réellement enregistrés ou connectés." />}
        {view === "search" && <section className="panel"><h2>Recherche Web</h2><p>Demandez une recherche à Morice. Son résultat, ses sources et son suivi apparaîtront dans Travaux.</p><button onClick={() => { setView("chat"); setMessage("Recherche sur le Web : "); }}>Nouvelle recherche</button><button className="secondary" onClick={() => setView("jobs")}>Voir mes travaux</button></section>}
        {view === "clients" && <InfoPanel title="Clients" text="Aucun accès HubSpot direct n’est disponible. Ce module attendra une passerelle professionnelle autorisée." />}
        {view === "crypto" && <InfoPanel title="Crypto" text="Le module reste en lecture et surveillance uniquement tant qu’aucune source de marché n’est connectée. Aucune action sur Ledger n’est autorisée." />}
        {view === "estate" && <InfoPanel title="Immobilier" text="Espace prévu pour les dossiers, échéances, documents et suivis immobiliers réellement enregistrés." />}
        {view === "bmac" && <InfoPanel title="B-MAC Conseil" text="Espace professionnel prêt à recevoir les données et outils explicitement autorisés." />}
        {view === "house" && <InfoPanel title="Maison & Maurice" text="La domotique et le suivi de Maurice seront affichés ici après connexion vérifiée des appareils." />}
        {view === "tools" && <InfoPanel title="Outils" text="Les outils apparaîtront ici seulement après installation et test réel de leur connexion." />}
      </section>

      <nav className="mobile-navigation" aria-label="Navigation mobile"><button className={view === "home" ? "active" : ""} onClick={() => setView("home")}><i>⌂</i><span>Accueil</span></button><button className={view === "tasks" ? "active" : ""} onClick={() => setView("tasks")}><i>✓</i><span>Tâches</span></button><button disabled={assistantBusy || dictationState === "stopping"} aria-pressed={voiceActive} className={`mobile-mic ${voiceActive ? "listening" : ""}`} onClick={() => { setView("chat"); toggleDictation(); }} aria-label={voiceActive ? "Arrêter l’écoute" : "Parler à Morice"}><i>{voiceActive ? "■" : <MicIcon />}</i><span>{voiceActive ? "Arrêter" : "Parler"}</span></button><button className={view === "approvals" ? "active" : ""} onClick={() => setView("approvals")}><i>◆</i><span>Valider</span>{approvals.length > 0 && <b>{approvals.length}</b>}</button><button className={view === "settings" ? "active" : ""} onClick={() => setView("settings")}><i>⚙</i><span>Réglages</span></button></nav>
    </main>
  );
}

function MicIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/></svg>;
}

function BrandIcon({ name }: { name: BrandIconName }) {
  return <img className={`brand-icon brand-${name}`} src={brandIcons[name]} alt="" aria-hidden="true" />;
}

function NavigationIcon({ id, fallback }: { id: string; fallback: string }) {
  const branded: Partial<Record<string, BrandIconName>> = {
    mail: "outlook",
    tasks: "todo",
    memory: "notes",
    clients: "hubspot",
    crypto: "bitcoin",
  };
  const brand = branded[id];
  return brand ? <BrandIcon name={brand} /> : <>{fallback}</>;
}

function CommandPanel({ onPause, audioUrl, audioExtension, onRetry, onDiscard, dictationError, messages, message, setMessage, assistantMode, setAssistantMode, assistantBusy, voicePhase, onMic, onSend, onOpenAction }: {
  onPause: () => void;
  audioUrl: string;
  audioExtension: string;
  onRetry: () => void;
  onDiscard: () => void;
  dictationError: string;
  messages: ChatMessage[];
  message: string;
  setMessage: (value: string) => void;
  assistantMode: string;
  setAssistantMode: (value: string) => void;
  assistantBusy: boolean;
  voicePhase: DictationState | "thinking";
  onMic: () => void;
  onSend: () => void;
  onOpenAction: (view: string) => void;
}) {
  const listening = ["starting", "listening", "reconnecting", "paused"].includes(voicePhase);
  const locked = listening || Boolean(audioUrl) || voicePhase === "stopping" || assistantBusy;
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const log = logRef.current; if (log) log.scrollTop = log.scrollHeight; }, [messages, assistantBusy]);
  const labels: Record<string, [string, string]> = {
    idle: ["Microphone éteint", "Un clic démarre l’écoute. Aucun maintien appuyé."],
    starting: ["Ouverture du microphone…", "Autorisez le microphone si le navigateur vous le demande."],
    listening: ["Enregistrement en cours", "Les silences ne coupent pas le micro. Pause, Arrêter ou Envoyer : vous décidez. Le texte apparaîtra après l’arrêt."],
    reconnecting: ["Reprise de l’écoute…", "La session du navigateur a été interrompue. Morice relance le micro."],
    paused: ["Enregistrement en pause", "Touchez Reprendre pour continuer. Votre audio est conservé."],
    stopping: ["Transcription…", "Votre audio est converti en texte. Gardez cette page ouverte."],
    ready: ["Votre texte est prêt", "Relisez, corrigez si nécessaire, puis envoyez."],
    error: ["Microphone interrompu", "Votre texte est conservé. Consultez le message affiché, puis réessayez."],
    thinking: ["Morice réfléchit…", "Votre demande est en cours de traitement."],
  };
  const [phaseLabel, phaseDetail] = labels[voicePhase];
  return <section className="command-panel" aria-label="Conversation avec Morice">
    <div className="command-heading"><div><span className="command-mark">✦</span><div><p className="eyebrow">VOTRE ASSISTANT</p><h2>À vous la parole.</h2></div></div><span className="session-label">Historique sauvegardé · 40 derniers messages</span></div>
    <div className="composer">
      <div className={"voice-progress " + voicePhase} role="status"><div className="voice-indicator" aria-hidden="true"><span /><span /><span /><span /></div><div><b>{phaseLabel}</b><small>{voicePhase === "error" && dictationError ? dictationError : phaseDetail}</small></div></div>
      <label className="sr-only" htmlFor="morice-message">Votre message à Morice</label>
      <textarea id="morice-message" aria-describedby="composer-help" readOnly={locked} value={message} onChange={event => setMessage(event.target.value)} onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); onSend(); } }} placeholder="Écrivez ici, ou démarrez le microphone…" rows={3} />
      <div className="composer-help" id="composer-help"><span>{listening ? "Gardez cette page ouverte pendant la dictée." : "Ctrl / ⌘ + Entrée pour envoyer"}</span><span className={message.length > 1200 ? "over-limit" : ""}>{message.length} / 1 200</span></div>
      <div className="command-actions"><div className="mode-row" role="group" aria-label="Type d’action">{[["auto", "Auto"], ["task", "Tâche"], ["memory", "Mémoire"], ["approval", "À valider"]].map(([mode, title]) => <button key={mode} disabled={assistantBusy} aria-pressed={assistantMode === mode} className={assistantMode === mode ? "selected" : ""} onClick={() => setAssistantMode(mode)}>{title}</button>)}</div><div className="primary-controls">{(voicePhase === "listening" || voicePhase === "paused") && <button className="secondary" onClick={onPause}>{voicePhase === "paused" ? "Reprendre" : "Pause"}</button>}<button disabled={assistantBusy || voicePhase === "stopping" || Boolean(audioUrl)} className={"main-mic " + (listening ? "listening" : "")} aria-pressed={listening} onClick={onMic} aria-label={listening ? "Arrêter l’écoute" : "Démarrer l’écoute"}><span aria-hidden="true">{listening ? "■" : <MicIcon />}</span>{listening ? "Arrêter" : "Dicter"}</button><button className="send-command" onClick={onSend} disabled={assistantBusy || voicePhase === "stopping" || voicePhase === "starting" || Boolean(audioUrl) || (!listening && (!message.trim() || message.length > 1200))}>{assistantBusy ? "En cours…" : "Envoyer"}<span aria-hidden="true"> ↗</span></button></div></div>
    </div>
    {audioUrl && voicePhase !== "stopping" && <div className="audio-recovery" role="group" aria-label="Audio conservé"><p>Votre audio reste disponible dans cette page jusqu’à sa fermeture.</p><button onClick={onRetry}>Réessayer la transcription</button><a href={audioUrl} download={`morice-dictee.${audioExtension}`}>Télécharger l’audio</a><button className="secondary" onClick={onDiscard}>Effacer l’audio</button></div>}
    <div className="conversation-log" role="log" aria-label="Messages" aria-live="polite" aria-relevant="additions text" ref={logRef}>
      {messages.length === 0 && <div className="conversation-empty"><img src={MORICE_LOGO_SRC} alt="Logo officiel de Morice" /><h3>Qu’avez-vous en tête ?</h3><p>Écrivez votre demande ou dictez-la. Vous gardez la main sur chaque action.</p></div>}
      {messages.map(entry => <article key={entry.id} className={"chat-message " + entry.role}><span className="message-author">{entry.role === "user" ? "Vous" : entry.role === "error" ? "Demande non aboutie" : "Morice"}</span><ResultText text={entry.text} citations={entry.action?.citations} />{entry.action && <div className="message-actions"><span>{entry.action.label}</span>{entry.action.view !== "chat" && <button onClick={() => onOpenAction(entry.action!.view)}>Voir le résultat →</button>}<ResponsePlayer disabled={listening || voicePhase === "stopping"} text={entry.text.replace(/[^]*/g, "")} /></div>}</article>)}
      {assistantBusy && <article className="chat-message assistant pending"><span className="message-author">Morice</span><p>Je m’occupe de votre demande<span className="thinking-dots" aria-hidden="true">…</span></p></article>}
    </div>
    {messages.length === 0 && <div className="examples"><button disabled={locked} onClick={() => setMessage("Quelles sont mes tâches prioritaires ?")}>Organiser ma journée</button><button disabled={locked} onClick={() => setMessage("Prépare un mail de suivi à mon client")}>Préparer un email</button><button disabled={locked} onClick={() => setMessage("Mémorise une information importante : ")}>Garder une idée</button></div>}
  </section>;
}

function ServiceStatus({ name, ok, detail }: { name: string; ok: boolean; detail: string }) {
  return <article><span className={ok ? "status-dot ok" : "status-dot"} /><div><b>{name}</b><small>{detail}</small></div><em>{ok ? "Actif" : "Attente"}</em></article>;
}

function InfoPanel({ title, text }: { title: string; text: string }) {
  return <section className="panel"><p className="eyebrow">MODULE MORICE</p><h2>{title}</h2><p>{text}</p></section>;
}

function MicrosoftReadPanel({ operation, title }: { operation: "mail_read" | "calendar_read"; title: string }) {
  const [data, setData] = useState<{ result: string; checkedAt: string } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      void api<{ result: string; checkedAt: string }>(`/api/microsoft/read?operation=${operation}`, { signal: controller.signal })
        .then(result => { if (!controller.signal.aborted) setData(result); })
        .catch(failure => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Lecture impossible."); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [operation, revision]);
  return <section className="panel"><p className="eyebrow">MICROSOFT 365</p><h2>{title}</h2><p>{operation === "mail_read" ? "Les cinq messages les plus récents, sans modifier leur état lu ou non lu." : "Les dix prochains rendez-vous sur les sept jours à venir."}</p><button disabled={loading} onClick={() => setRevision(value => value + 1)}>{loading ? "Chargement…" : "Actualiser"}</button>{error && <p role="alert">{error}</p>}{data && <><p>Lecture confirmée le {new Date(data.checkedAt).toLocaleString("fr-FR")}{error ? " · Dernier résultat disponible" : ""}</p><div style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{data.result}</div></>}</section>;
}

function ConnectionsPanel({ state, refresh, disconnectMicrosoft }: { state: ConnectionState | null; refresh: () => Promise<void>; disconnectMicrosoft: () => Promise<void> }) {
  const [verification, setVerification] = useState("");
  const [checking, setChecking] = useState(false);
  async function checkMicrosoft() {
    setChecking(true);
    try {
      const data = await api<{ result: string; checkedAt: string }>("/api/microsoft/read");
      setVerification(`Lecture Microsoft confirmée à ${new Date(data.checkedAt).toLocaleTimeString("fr-FR")} : ${data.result}`);
    } catch (error) { setVerification(error instanceof Error ? error.message : "Vérification impossible."); }
    finally { setChecking(false); }
  }
  return <section className="panel"><p className="eyebrow">SERVICES AUTORISÉS</p><h2>Connexions</h2><p>Les secrets restent côté serveur. Les actions externes sensibles attendent toujours ta validation.</p><div className="connection-grid">
    <article><div><b>Intelligence OpenAI</b><span className={state?.openai.configured ? "connected" : "waiting"}>{state?.openai.configured ? `Configurée · ${state.openai.model}` : "À configurer sur le site"}</span></div></article>
    <article><div><b>Microsoft 365</b><span className={state?.microsoft.connected ? "connected" : "waiting"}>{state?.microsoft.connected ? `Connecté · ${state.microsoft.account}` : state?.microsoft.configured ? "Prêt à être autorisé" : "Configuration de l’application requise"}</span></div>{state?.microsoft.connected ? <button className="secondary" onClick={disconnectMicrosoft}>Déconnecter</button> : <button disabled={!state?.microsoft.configured} onClick={() => { window.location.href = "/api/microsoft/start"; }}>Connecter Microsoft</button>}</article>
    <article><div><b>Make + Microsoft To Do</b><span className={state?.make.configured ? "connected" : "waiting"}>{state?.make.configured ? "Webhook configuré · vérifié lors de l’exécution" : "Webhook à ajouter"}</span></div></article>
    <article className="disabled-connection"><div><b>HubSpot</b><span>Indisponible · aucun accès supplémentaire</span></div></article>
  </div><button className="secondary refresh-connection" onClick={refresh}>Actualiser les états</button><button disabled={checking || !state?.microsoft.connected} onClick={checkMicrosoft}>{checking ? "Vérification…" : "Vérifier la lecture Microsoft"}</button>{verification && <p role="status">{verification}</p>}</section>;
}

function ListPanel({ title, items, value, setValue, add, update }: { title: string; items: Item[]; value: string; setValue: (value: string) => void; add: () => void; update: (id: string, status: string) => void }) {
  return <section className="panel"><p className="eyebrow">SUIVI</p><h2>{title}</h2><div className="inline"><input value={value} onChange={event => setValue(event.target.value)} placeholder="Ajouter…" /><button onClick={add}>Ajouter</button></div>{items.length ? items.map(item => <article className="row" key={item.id}><div><b>{item.title}</b><p>{item.content}</p></div><button className="secondary" onClick={() => update(item.id, item.status === "done" ? "open" : "done")}>{item.status === "done" ? "Rouvrir" : "Terminer"}</button></article>) : <div className="empty">Aucun élément pour le moment.</div>}</section>;
}

function actionStatus(status: string) {
  const labels: Record<string, string> = { pending: "À valider", executing: "En cours ou à vérifier", needs_review: "Résultat à vérifier", executed: "Exécution confirmée", rejected: "Refusée" };
  return labels[status] || status;
}

function ActionDetails({ item }: { item: Item }) {
  const action = item.execution;
  if (!action) return <p>Les détails exécutables de cette action ne sont pas disponibles.</p>;
  let details: Record<string, unknown> = {};
  try { details = JSON.parse(action.payload); } catch { /* Older payloads remain visible as unavailable. */ }
  const labels: Record<string, string> = { to: "Destinataire", subject: "Objet", body: "Contenu", start: "Début", end: "Fin", timezone: "Fuseau", list: "Liste", notes: "Notes", webhookEvent: "Événement", query: "Recherche" };
  return <div className="action-details"><p>{action.provider === "microsoft" ? "Microsoft 365" : "Make"} · {action.operation}</p>{Object.entries(details).filter(([, value]) => typeof value === "string" && value).map(([key, value]) => <p key={key}><strong>{labels[key] || key} : </strong>{String(value)}</p>)}{action.result && <p role="status">{action.result}</p>}</div>;
}
