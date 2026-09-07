"use client";

import { useEffect, useRef, useState } from "react";

type Item = {
  id: string;
  kind: "module" | "task" | "memory" | "approval";
  title: string;
  content: string;
  status: string;
  priority: string;
  position: number;
};

type State = { items: Item[]; settings: Record<string, unknown> };

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type InstallState = "checking" | "available" | "manual" | "installed";
type DictationState = "idle" | "listening" | "transcribing" | "ready";

type AssistantAction = {
  id: string;
  kind: "task" | "memory" | "approval" | "result";
  title: string;
  content: string;
  status: string;
  label: string;
  view: string;
};

type AssistantResult = { reply: string; action: AssistantAction };

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
  ["chat", "Nouvelle idée", "✦"],
  ["tasks", "Tâches", "✓"],
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
  ["hubspot", "Devis clients", "HubSpot · non connecté", "hubspot"],
  ["mail", "Ma boîte mail", "Outlook", "outlook"],
  ["tasks", "Mes tâches", "Microsoft To Do", "todo"],
  ["memory", "Notes rapides", "Samsung Notes · raccourci", "notes"],
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

function mergeSpeechSegments(segments: string[]) {
  return segments.reduce((merged, segment) => {
    const next = segment.trim().replace(/\s+/g, " ");
    if (!next) return merged;
    if (!merged) return next;

    const mergedLower = merged.toLocaleLowerCase("fr-FR");
    const nextLower = next.toLocaleLowerCase("fr-FR");
    if (nextLower === mergedLower || mergedLower.endsWith(` ${nextLower}`)) return merged;
    if (nextLower.startsWith(mergedLower)) return next;

    const previousWords = merged.split(" ");
    const nextWords = next.split(" ");
    const maxOverlap = Math.min(previousWords.length, nextWords.length);
    for (let overlap = maxOverlap; overlap > 0; overlap -= 1) {
      const previousEnd = previousWords.slice(-overlap).join(" ").toLocaleLowerCase("fr-FR");
      const nextStart = nextWords.slice(0, overlap).join(" ").toLocaleLowerCase("fr-FR");
      if (previousEnd === nextStart) return [...previousWords, ...nextWords.slice(overlap)].join(" ");
    }
    return `${merged} ${next}`;
  }, "");
}

async function api(path: string, init?: RequestInit) {
  const response = await fetch(path, { headers: { "Content-Type": "application/json", ...(init?.headers || {}) }, ...init });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Morice n'a pas pu terminer cette action.");
  return payload;
}

export default function MoriceApp() {
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
  const [assistantResult, setAssistantResult] = useState<AssistantResult | null>(null);
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [connections, setConnections] = useState<ConnectionState | null>(null);
  const [executingId, setExecutingId] = useState("");
  const [dictationState, setDictationState] = useState<DictationState>("idle");
  const [clock, setClock] = useState<Date | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const keepDictatingRef = useRef(false);
  const dictationTextRef = useRef("");
  const restartTimerRef = useRef<number | null>(null);
  const transcriptionTimerRef = useRef<number | null>(null);

  const tasks = state.items.filter((item) => item.kind === "task");
  const memories = state.items.filter((item) => item.kind === "memory");
  const approvals = state.items.filter((item) => item.kind === "approval" && item.status === "pending");
  const recentItems = state.items.filter((item) => item.kind !== "module").slice(0, 5);
  const currentView = navigation.find(([id]) => id === view);
  const voicePhase = assistantBusy ? "thinking" : assistantResult ? "response" : dictationState;

  async function refresh() {
    try {
      const data = await api("/api/state");
      setState(data);
      setStorageStatus("online");
    } catch {
      setStorageStatus("error");
      setNotice("Connexion temporaire au stockage. Réessaie dans quelques secondes.");
    }
  }

  async function refreshConnections() {
    try { setConnections(await api("/api/connections") as ConnectionState); } catch { /* Le stockage principal reste utilisable. */ }
  }

  useEffect(() => {
    const initialLoadTimer = window.setTimeout(() => {
      void refresh();
      void refreshConnections();
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

  useEffect(() => () => {
    keepDictatingRef.current = false;
    if (restartTimerRef.current !== null) window.clearTimeout(restartTimerRef.current);
    if (transcriptionTimerRef.current !== null) window.clearTimeout(transcriptionTimerRef.current);
    recognitionRef.current?.abort();
  }, []);

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

  async function askMorice() {
    const textToSend = message.trim();
    if (!textToSend || assistantBusy) return;
    stopDictation();
    setAssistantBusy(true);
    setAssistantResult(null);
    try {
      const result = await api("/api/assistant", { method: "POST", body: JSON.stringify({ message: textToSend, mode: assistantMode }) }) as AssistantResult;
      setAssistantResult(result);
      setMessage("");
      dictationTextRef.current = "";
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Morice n’a pas pu exécuter cette action.");
    } finally {
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
      const { publicKey } = await api("/api/push/key");
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
      await api("/api/push/subscribe", { method: "POST", body: JSON.stringify(subscription.toJSON()) });
      const result = await api("/api/push/test", { method: "POST" }) as { sent: number };
      setNotice(`${result.sent} notification Morice envoyée. Elle peut prendre quelques secondes.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Notification impossible.");
    }
  }

  function speak(text: string) {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }

  function beginDictation(resetText = true) {
    const SpeechRecognition = (window as unknown as { SpeechRecognition?: new () => SpeechRecognition; webkitSpeechRecognition?: new () => SpeechRecognition }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognition }).webkitSpeechRecognition;
    if (!SpeechRecognition) return setNotice("La dictée n'est pas disponible dans ce navigateur.");
    if (recognitionRef.current) return;
    if (transcriptionTimerRef.current !== null) window.clearTimeout(transcriptionTimerRef.current);
    transcriptionTimerRef.current = null;
    setAssistantResult(null);
    if (resetText) dictationTextRef.current = message.trim();
    keepDictatingRef.current = true;
    setDictationState("listening");

    const recognition = new SpeechRecognition();
    const recognitionBase = dictationTextRef.current.trim();
    recognitionRef.current = recognition;
    recognition.lang = "fr-FR";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const finalSegments: string[] = [];
      const interimSegments: string[] = [];
      for (let index = 0; index < event.results.length; index += 1) {
        const transcript = event.results[index][0]?.transcript?.trim() || "";
        if (event.results[index].isFinal) finalSegments.push(transcript);
        else interimSegments.push(transcript);
      }
      const finalText = mergeSpeechSegments(finalSegments);
      const interimText = mergeSpeechSegments(interimSegments);
      const committedText = mergeSpeechSegments([recognitionBase, finalText]);
      dictationTextRef.current = committedText;
      setMessage(mergeSpeechSegments([committedText, interimText]));
    };
    recognition.onerror = event => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        keepDictatingRef.current = false;
        setDictationState("idle");
        setNotice("Autorise le micro pour parler à Morice.");
      } else if (event.error !== "no-speech" && event.error !== "aborted") {
        setNotice("Le micro a rencontré un problème. Tu peux reprendre la dictée.");
      }
    };
    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      if (!keepDictatingRef.current) return;
      keepDictatingRef.current = false;
      setDictationState("ready");
    };
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      keepDictatingRef.current = false;
      setDictationState("idle");
      setNotice("Le micro n’a pas pu démarrer. Réessaie dans quelques secondes.");
    }
  }

  function stopDictation() {
    const wasListening = dictationState === "listening";
    keepDictatingRef.current = false;
    if (restartTimerRef.current !== null) window.clearTimeout(restartTimerRef.current);
    restartTimerRef.current = null;
    dictationTextRef.current = message.trim();
    recognitionRef.current?.abort();
    if (wasListening) {
      setDictationState("transcribing");
      if (transcriptionTimerRef.current !== null) window.clearTimeout(transcriptionTimerRef.current);
      transcriptionTimerRef.current = window.setTimeout(() => {
        transcriptionTimerRef.current = null;
        setDictationState("ready");
      }, 550);
    } else if (dictationState !== "ready") {
      setDictationState("idle");
    }
  }

  function toggleDictation() {
    if (dictationState === "listening") stopDictation();
    else beginDictation();
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
          {navigation.map(([id, label, icon]) => <button key={id} className={`${view === id ? "active " : ""}nav-${id}`} onClick={() => setView(id)}><i><NavigationIcon id={id} fallback={icon} /></i><span>{label}</span>{id === "tasks" && tasks.filter(item => item.status !== "done").length > 0 && <em>{tasks.filter(item => item.status !== "done").length}</em>}</button>)}
        </nav>
        <div className="sidebar-footer">
          {installState !== "installed" && <button className="outline-action" onClick={installMorice}>Installer l’application</button>}
          <button className="outline-action" onClick={enableNotifications}>Activer les notifications</button>
          <p className={`online ${storageStatus}`}><span /> {storageStatus === "online" ? "Données Morice en ligne" : storageStatus === "error" ? "Stockage indisponible" : "Connexion aux données…"}</p>
        </div>
      </aside>

      <section className="morice-content">
        <header className={`topbar ${view === "home" ? "dashboard-topbar" : ""}`}><div><p className="eyebrow">MORICE — ESPACE PRIVÉ D’ALAN</p><h1>{view === "home" ? "Tableau de bord" : currentView?.[1] || "Morice"}</h1></div><div className="topbar-actions"><button onClick={() => setView("approvals")} aria-label="Ouvrir les validations"><span>◆</span>{approvals.length > 0 && <b>{approvals.length}</b>}</button><img src={MORICE_LOGO_SRC} alt="Logo officiel de Morice" /></div></header>
        {notice && <button className="notice" onClick={() => setNotice("")}>{notice}<span>×</span></button>}

        {view === "home" && <>
          <div className="dashboard-grid">
            <div className="dashboard-main">
              <section className="welcome-card">
                <div className="welcome-identity"><div className="portrait-wrap"><img src={MORICE_LOGO_SRC} alt="Logo officiel de Morice" /></div><div><p className="eyebrow">BONJOUR ALAN</p><h2>Bienvenue Alan <span aria-hidden="true">👋</span></h2><p>On gère ça ensemble. Une seule interface pour comprendre, préparer, exécuter et vérifier.</p></div></div>
                <div className="welcome-meta"><article><small>{dateText}</small><strong>{timeText}</strong><span>Heure locale</span></article><article><small>Météo</small><strong>À connecter</strong><span>Aucune donnée inventée</span></article></div>
              </section>

              <CommandPanel message={message} setMessage={(value) => { setMessage(value); dictationTextRef.current = value.trim(); setAssistantResult(null); }} assistantMode={assistantMode} setAssistantMode={setAssistantMode} assistantResult={assistantResult} assistantBusy={assistantBusy} voicePhase={voicePhase} onMic={toggleDictation} onSend={askMorice} onOpenAction={(nextView) => setView(nextView)} onSpeak={speak} />

              <section className="quick-panel"><div className="panel-heading"><div><p className="eyebrow">RACCOURCIS</p><h2>Accès rapide</h2></div></div><div className="quick-grid">{quickActions.map(([id, label, source, brand]) => <button key={id} className={`quick-${brand}`} onClick={() => setView(id)}><i><BrandIcon name={brand} /></i><span><b>{label}</b><small>{source}</small></span><em>→</em></button>)}</div></section>

              <section className="activity-panel"><div className="panel-heading"><div><p className="eyebrow">JOURNAL RÉEL</p><h2>Activité récente</h2></div><span>{recentItems.length} élément{recentItems.length > 1 ? "s" : ""}</span></div>{recentItems.length ? <div className="activity-list">{recentItems.map(item => <article className={`activity-${item.kind}`} key={item.id}><i>{item.kind === "task" ? "✓" : item.kind === "memory" ? "◉" : "◆"}</i><div><b>{item.title}</b><p>{item.content || (item.kind === "task" ? "Tâche enregistrée dans Morice" : "Élément enregistré dans Morice")}</p></div><span>{item.kind === "approval" ? "À valider" : item.status === "done" ? "Terminé" : "En cours"}</span></article>)}</div> : <div className="empty">Aucune activité enregistrée pour le moment.</div>}</section>
            </div>

            <aside className="context-rail">
              <section className="agenda-card"><div className="panel-heading"><div><p className="eyebrow">AUJOURD’HUI</p><h2>Mon agenda</h2></div><button onClick={() => setView("calendar")}>Voir tout</button></div><div className="empty compact">{connections?.microsoft.connected ? "Microsoft 365 est connecté. Demandez à Morice d’afficher les vrais rendez-vous." : "Connectez Microsoft 365 pour afficher les vrais rendez-vous."}</div></section>
              <section className="device-card"><div className="panel-heading"><div><p className="eyebrow">ÉTAT RÉEL</p><h2>Mes appareils</h2></div><button onClick={() => setView("settings")}>Voir</button></div><div className="device-list"><article><span>▣</span><div><b>Cet appareil</b><small>{installState === "installed" ? "Application Morice installée" : "Installation disponible"}</small></div><em className={installState === "installed" ? "ok" : ""}>{installState === "installed" ? "Installé" : "À installer"}</em></article><article><span>▯</span><div><b>Z Fold 7</b><small>OpenClaw à finaliser</small></div><em>En attente</em></article></div>{installState !== "installed" && <button onClick={installMorice}>Installer Morice</button>}</section>
              <section className="shortcut-card"><div className="panel-heading"><div><p className="eyebrow">NAVIGATION</p><h2>Raccourcis</h2></div></div><div className="shortcut-list"><button className="shortcut-bmac" onClick={() => setView("bmac")}><span>◆</span><b>B-MAC Conseil</b><em>›</em></button><button className="shortcut-crypto" onClick={() => setView("crypto")}><span><BrandIcon name="bitcoin" /></span><b>Suivi crypto</b><em>›</em></button><button className="shortcut-house" onClick={() => setView("house")}><span>●</span><b>Maison & Maurice</b><em>›</em></button><button className="shortcut-approval" onClick={() => setView("approvals")}><span>✓</span><b>Validations</b><em>{approvals.length || "›"}</em></button></div></section>
              <section className="connection-card"><div className="panel-heading"><div><p className="eyebrow">SERVICES</p><h2>Connexions</h2></div><button onClick={() => setView("connections")}>Détails</button></div><div className="service-list"><ServiceStatus name="OpenAI" ok={Boolean(connections?.openai.configured)} detail={connections?.openai.configured ? connections.openai.model : "À configurer"} /><ServiceStatus name="Microsoft 365" ok={Boolean(connections?.microsoft.connected)} detail={connections?.microsoft.connected ? connections.microsoft.account : "Non connecté"} /><ServiceStatus name="Make" ok={Boolean(connections?.make.configured)} detail={connections?.make.configured ? "Webhook configuré" : "À configurer"} /><ServiceStatus name="OpenClaw" ok={false} detail="Passerelle à relier au site" /></div></section>
            </aside>
          </div>
        </>}

        {view === "chat" && <div className="single-column"><CommandPanel message={message} setMessage={(value) => { setMessage(value); dictationTextRef.current = value.trim(); setAssistantResult(null); }} assistantMode={assistantMode} setAssistantMode={setAssistantMode} assistantResult={assistantResult} assistantBusy={assistantBusy} voicePhase={voicePhase} onMic={toggleDictation} onSend={askMorice} onOpenAction={(nextView) => setView(nextView)} onSpeak={speak} /></div>}

        {view === "tasks" && <ListPanel title="Tâches Morice" items={tasks} value={newValue} setValue={setNewValue} add={() => addItem("task", newValue)} update={updateItem} />}
        {view === "memory" && <ListPanel title="Mémoire longue durée" items={memories} value={newValue} setValue={setNewValue} add={() => addItem("memory", "Souvenir", newValue)} update={updateItem} />}
        {view === "approvals" && <section className="panel"><p className="eyebrow">CONTRÔLE HUMAIN</p><h2>Validations</h2><p>Morice n’envoie, ne crée et ne modifie rien à l’extérieur sans ton accord ici.</p>{approvals.length ? approvals.map(item => <article className="row" key={item.id}><div><b>{item.title}</b><p>{item.content}</p></div><button disabled={Boolean(executingId)} onClick={() => executeApproval(item.id)}>{executingId === item.id ? "Exécution…" : "Valider et exécuter"}</button><button className="secondary" disabled={Boolean(executingId)} onClick={() => updateItem(item.id, "rejected")}>Refuser</button></article>) : <div className="empty">Aucune validation en attente.</div>}</section>}
        {view === "settings" && <section className="panel"><p className="eyebrow">APPLICATION</p><h2>Installer Morice</h2><p>Installe Morice avec son icône Rottweiler et une fenêtre indépendante du navigateur.</p><div className={`install-status ${installState}`}><span />{installState === "installed" ? "Morice est installé sur cet appareil" : installState === "available" ? "Morice est prêt à être installé" : installState === "checking" ? "Vérification de l’installation…" : "Installation disponible depuis le menu du navigateur"}</div><button onClick={installMorice}>{installState === "installed" ? "Vérifier l’installation" : installState === "available" ? "Installer Morice maintenant" : "Afficher comment l’installer"}</button>{showInstallHelp && <div className="install-help"><b>Installation en deux gestes</b>{isIos ? <p>Dans Safari, touche <strong>Partager</strong>, puis <strong>Sur l’écran d’accueil</strong>.</p> : <p>Ouvre le menu <strong>⋮</strong> en haut à droite, puis choisis <strong>Installer Morice</strong> ou <strong>Ajouter à l’écran d’accueil</strong>.</p>}<p>Aucun rechargement de la page n’est nécessaire.</p></div>}<hr /><p className="eyebrow">RÉGLAGES</p><h2>Notifications Morice</h2><p>Autorise les notifications une fois sur chaque appareil. Le bouton ci-dessous envoie un vrai test en arrière-plan.</p><button onClick={enableNotifications}>Activer et tester maintenant</button><hr /><h3>Trois synthèses quotidiennes</h3><div className="times">{((state.settings.digest_times as string[]) || ["08:00", "13:00", "18:30"]).map(time => <input key={time} type="time" defaultValue={time} />)}</div></section>}
        {view === "mail" && <InfoPanel title="Mail & Brouillons" text="Morice peut lire les mails récents et préparer des brouillons Outlook. Tout brouillon créé ou message envoyé passe d’abord par Validations." />}
        {view === "hubspot" && <InfoPanel title="HubSpot indisponible" text="Aucun accès HubSpot supplémentaire n’est disponible. Morice ne simulera jamais une connexion et utilisera Microsoft 365 ou Make pour les actions autorisées." />}
        {view === "calendar" && <InfoPanel title="Agenda" text="Morice peut consulter les rendez-vous Outlook. Toute création ou modification d’événement passe d’abord par Validations." />}
        {view === "documents" && <InfoPanel title="Documents & OneDrive" text="Morice peut rechercher des documents OneDrive après la connexion Microsoft 365, sans exposer les jetons d’accès." />}
        {view === "connections" && <ConnectionsPanel state={connections} refresh={refreshConnections} disconnectMicrosoft={disconnectMicrosoft} />}
        {view === "projects" && <InfoPanel title="Projets" text="L’espace projets est prêt. Il n’affichera que des projets réellement enregistrés ou connectés." />}
        {view === "search" && <InfoPanel title="Recherche" text="La recherche unifiée sera branchée sur les sources autorisées. Aucune source n’est simulée." />}
        {view === "clients" && <InfoPanel title="Clients" text="Aucun accès HubSpot direct n’est disponible. Ce module attendra une passerelle professionnelle autorisée." />}
        {view === "crypto" && <InfoPanel title="Crypto" text="Le module reste en lecture et surveillance uniquement tant qu’aucune source de marché n’est connectée. Aucune action sur Ledger n’est autorisée." />}
        {view === "estate" && <InfoPanel title="Immobilier" text="Espace prévu pour les dossiers, échéances, documents et suivis immobiliers réellement enregistrés." />}
        {view === "bmac" && <InfoPanel title="B-MAC Conseil" text="Espace professionnel prêt à recevoir les données et outils explicitement autorisés." />}
        {view === "house" && <InfoPanel title="Maison & Maurice" text="La domotique et le suivi de Maurice seront affichés ici après connexion vérifiée des appareils." />}
        {view === "tools" && <InfoPanel title="Outils" text="Les outils apparaîtront ici seulement après installation et test réel de leur connexion." />}
      </section>

      <nav className="mobile-navigation" aria-label="Navigation mobile"><button className={view === "home" ? "active" : ""} onClick={() => setView("home")}><i>⌂</i><span>Accueil</span></button><button className={view === "tasks" ? "active" : ""} onClick={() => setView("tasks")}><i>✓</i><span>Tâches</span></button><button className={`mobile-mic ${dictationState === "listening" ? "listening" : ""}`} onClick={() => { setView("home"); toggleDictation(); }} aria-label={dictationState === "listening" ? "Arrêter l’écoute" : "Parler à Morice"}><i>{dictationState === "listening" ? "■" : "●"}</i><span>{dictationState === "listening" ? "Arrêter" : "Parler"}</span></button><button className={view === "approvals" ? "active" : ""} onClick={() => setView("approvals")}><i>◆</i><span>Valider</span>{approvals.length > 0 && <b>{approvals.length}</b>}</button><button className={view === "settings" ? "active" : ""} onClick={() => setView("settings")}><i>⚙</i><span>Réglages</span></button></nav>
    </main>
  );
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

function CommandPanel({ message, setMessage, assistantMode, setAssistantMode, assistantResult, assistantBusy, voicePhase, onMic, onSend, onOpenAction, onSpeak }: {
  message: string;
  setMessage: (value: string) => void;
  assistantMode: string;
  setAssistantMode: (value: string) => void;
  assistantResult: AssistantResult | null;
  assistantBusy: boolean;
  voicePhase: DictationState | "thinking" | "response";
  onMic: () => void;
  onSend: () => void;
  onOpenAction: (view: string) => void;
  onSpeak: (text: string) => void;
}) {
  const listening = voicePhase === "listening";
  const phaseLabel = voicePhase === "listening" ? "Écoute…" : voicePhase === "transcribing" ? "Transcription…" : voicePhase === "thinking" ? "Morice réfléchit…" : voicePhase === "response" ? "Réponse" : voicePhase === "ready" ? "Transcription prête" : "Prêt à vous écouter";
  const phaseDetail = voicePhase === "listening" ? "Cliquez une seconde fois sur le micro pour arrêter." : voicePhase === "transcribing" ? "Votre voix est transformée en texte." : voicePhase === "thinking" ? "Analyse de la demande et choix de l’action utile." : voicePhase === "response" ? "Le résultat est affiché et enregistré quand nécessaire." : voicePhase === "ready" ? "Relisez le texte puis envoyez-le à Morice." : "Un clic démarre l’écoute. Aucun maintien appuyé.";

  return <section className="command-panel">
    <div className="command-heading"><div><span className="command-mark">✦</span><div><p className="eyebrow">CENTRE DE COMMANDE</p><h2>Nouvelle idée</h2><p>Dites-moi ce que vous voulez faire, je m’occupe du reste.</p></div></div><span className="auto-route">Routage automatique</span></div>
    <div className={`voice-progress ${voicePhase}`}><div className="voice-indicator"><span /><span /><span /><span /></div><div><b>{phaseLabel}</b><small>{phaseDetail}</small></div></div>
    <textarea value={message} onChange={event => setMessage(event.target.value)} onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") onSend(); }} placeholder={'Ex. « Prépare un brouillon pour mon client », « Ajoute une tâche », « Cherche mon document »…'} />
    <div className="command-actions">
      <div className="mode-row" role="group" aria-label="Type d’action"><button className={assistantMode === "auto" ? "selected" : ""} onClick={() => setAssistantMode("auto")}>Automatique</button><button className={assistantMode === "task" ? "selected" : ""} onClick={() => setAssistantMode("task")}>Tâche</button><button className={assistantMode === "memory" ? "selected" : ""} onClick={() => setAssistantMode("memory")}>Mémoire</button><button className={assistantMode === "approval" ? "selected" : ""} onClick={() => setAssistantMode("approval")}>À valider</button></div>
      <div className="primary-controls"><button className={`main-mic ${listening ? "listening" : ""}`} onClick={onMic} aria-label={listening ? "Arrêter l’écoute" : "Démarrer l’écoute"}><span>{listening ? "■" : "●"}</span></button><button className="send-command" onClick={onSend} disabled={!message.trim() || assistantBusy}>{assistantBusy ? "Morice agit…" : "Envoyer"}</button></div>
    </div>
    <div className="examples"><button onClick={() => setMessage("Rappelle-moi d’appeler Martin demain matin")}>Créer un rappel</button><button onClick={() => setMessage("Mémorise que le dossier Morice est prioritaire")}>Mémoriser une information</button><button onClick={() => setMessage("Prépare un mail de suivi à Martin")}>Préparer un email</button></div>
    {assistantResult && <article className="action-result"><p className="eyebrow">RÉSULTAT DE MORICE</p><strong>{assistantResult.action.label}</strong><h3>{assistantResult.action.title}</h3><p>{assistantResult.reply}</p><div className="actions"><button onClick={() => onOpenAction(assistantResult.action.view)}>Voir le résultat</button><button className="secondary" onClick={() => onSpeak(assistantResult.reply)}>Écouter la réponse</button></div></article>}
  </section>;
}

function ServiceStatus({ name, ok, detail }: { name: string; ok: boolean; detail: string }) {
  return <article><span className={ok ? "status-dot ok" : "status-dot"} /><div><b>{name}</b><small>{detail}</small></div><em>{ok ? "Actif" : "Attente"}</em></article>;
}

function InfoPanel({ title, text }: { title: string; text: string }) {
  return <section className="panel"><p className="eyebrow">MODULE MORICE</p><h2>{title}</h2><p>{text}</p></section>;
}

function ConnectionsPanel({ state, refresh, disconnectMicrosoft }: { state: ConnectionState | null; refresh: () => Promise<void>; disconnectMicrosoft: () => Promise<void> }) {
  return <section className="panel"><p className="eyebrow">SERVICES AUTORISÉS</p><h2>Connexions</h2><p>Les secrets restent côté serveur. Les actions externes sensibles attendent toujours ta validation.</p><div className="connection-grid">
    <article><div><b>Intelligence OpenAI</b><span className={state?.openai.configured ? "connected" : "waiting"}>{state?.openai.configured ? `Configurée · ${state.openai.model}` : "À configurer sur le site"}</span></div></article>
    <article><div><b>Microsoft 365</b><span className={state?.microsoft.connected ? "connected" : "waiting"}>{state?.microsoft.connected ? `Connecté · ${state.microsoft.account}` : state?.microsoft.configured ? "Prêt à être autorisé" : "Configuration de l’application requise"}</span></div>{state?.microsoft.connected ? <button className="secondary" onClick={disconnectMicrosoft}>Déconnecter</button> : <button disabled={!state?.microsoft.configured} onClick={() => { window.location.href = "/api/microsoft/start"; }}>Connecter Microsoft</button>}</article>
    <article><div><b>Make + Microsoft To Do</b><span className={state?.make.configured ? "connected" : "waiting"}>{state?.make.configured ? "Webhook configuré · vérifié lors de l’exécution" : "Webhook à ajouter"}</span></div></article>
    <article className="disabled-connection"><div><b>HubSpot</b><span>Indisponible · aucun accès supplémentaire</span></div></article>
  </div><button className="secondary refresh-connection" onClick={refresh}>Actualiser les états</button></section>;
}

function ListPanel({ title, items, value, setValue, add, update }: { title: string; items: Item[]; value: string; setValue: (value: string) => void; add: () => void; update: (id: string, status: string) => void }) {
  return <section className="panel"><p className="eyebrow">SUIVI</p><h2>{title}</h2><div className="inline"><input value={value} onChange={event => setValue(event.target.value)} placeholder="Ajouter…" /><button onClick={add}>Ajouter</button></div>{items.length ? items.map(item => <article className="row" key={item.id}><div><b>{item.title}</b><p>{item.content}</p></div><button className="secondary" onClick={() => update(item.id, item.status === "done" ? "open" : "done")}>{item.status === "done" ? "Rouvrir" : "Terminer"}</button></article>) : <div className="empty">Aucun élément pour le moment.</div>}</section>;
}
