"use client";

import { useEffect, useMemo, useState } from "react";

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

type ConnectionState = {
  openai: { configured: boolean; model: string };
  microsoft: { configured: boolean; connected: boolean; account: string };
  make: { configured: boolean };
  hubspot: { configured: false; disabled: true; reason: string };
};

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

async function api(path: string, init?: RequestInit) {
  const response = await fetch(path, { headers: { "Content-Type": "application/json", ...(init?.headers || {}) }, ...init });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Morice n'a pas pu terminer cette action.");
  return payload;
}

export default function MoriceApp() {
  const [state, setState] = useState<State>(defaultState);
  const [view, setView] = useState("home");
  const [ready, setReady] = useState(false);
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

  const modules = useMemo(() => state.items.filter((item) => item.kind === "module" && item.status === "active").sort((a, b) => a.position - b.position), [state]);
  const tasks = state.items.filter((item) => item.kind === "task");
  const memories = state.items.filter((item) => item.kind === "memory");
  const approvals = state.items.filter((item) => item.kind === "approval" && item.status === "pending");

  async function refresh() {
    try {
      const data = await api("/api/state");
      setState(data);
    } catch {
      setNotice("Connexion temporaire au stockage. Réessaie dans quelques secondes.");
    } finally {
      setReady(true);
    }
  }

  async function refreshConnections() {
    try { setConnections(await api("/api/connections") as ConnectionState); } catch { /* Le stockage principal reste utilisable. */ }
  }

  useEffect(() => {
    refresh();
    refreshConnections();
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

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" })
        .then(async registration => {
          await registration.update();
          await navigator.serviceWorker.ready;
          setInstallState(current => current === "checking" ? "manual" : current);
        })
        .catch(() => setInstallState(current => current === "installed" ? current : "manual"));
    } else {
      setInstallState(current => current === "installed" ? current : "manual");
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
      window.removeEventListener("beforeinstallprompt", rememberInstallPrompt);
      window.removeEventListener("appinstalled", installationFinished);
    };
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
    if (!message.trim() || assistantBusy) return;
    setAssistantBusy(true);
    setAssistantResult(null);
    try {
      const result = await api("/api/assistant", { method: "POST", body: JSON.stringify({ message, mode: assistantMode }) }) as AssistantResult;
      setAssistantResult(result);
      setMessage("");
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
      await api("/api/push/test", { method: "POST" });
      setNotice("Notification Morice envoyée. Elle peut prendre quelques secondes.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Notification impossible.");
    }
  }

  function speak(text: string) {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }

  function dictate() {
    const SpeechRecognition = (window as unknown as { SpeechRecognition?: new () => SpeechRecognition; webkitSpeechRecognition?: new () => SpeechRecognition }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognition }).webkitSpeechRecognition;
    if (!SpeechRecognition) return setNotice("La dictée n'est pas disponible dans ce navigateur.");
    const recognition = new SpeechRecognition();
    recognition.lang = "fr-FR";
    recognition.onresult = (event: SpeechRecognitionEvent) => setMessage(event.results[0][0].transcript);
    recognition.start();
  }

  const nav = [
    ["home", "Accueil", "⌂"], ["chat", "Morice", "✦"], ["mail", "Mail", "✉"], ["approvals", "Valider", "◆"], ["settings", "Réglages", "⚙"],
  ];

  return (
    <main className="shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => setView("home")}><img src="/morice-logo.png" alt="Logo Rottweiler Morice" /><span><b>Morice</b><small>Assistant personnel</small></span></button>
        <nav>{nav.map(([id, label, icon]) => <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}><i>{icon}</i>{label}</button>)}</nav>
        {installState !== "installed" && <button className="notify" onClick={installMorice}>Installer Morice</button>}
        <button className="notify" onClick={enableNotifications}>Activer les notifications</button>
        <p className="online"><span /> {ready ? "Morice en ligne" : "Connexion…"}</p>
      </aside>

      <section className="content">
        <header><div><p className="eyebrow">MORICE — ESPACE PRIVÉ</p><h1>{view === "home" ? "Bonjour Alan" : nav.find(([id]) => id === view)?.[1] || "Morice"}</h1></div><img src="/icon-192.png" alt="Morice" /></header>
        {notice && <button className="notice" onClick={() => setNotice("")}>{notice}<span>×</span></button>}

        {view === "home" && <>
          <section className="hero"><div><span className="live">● Morice est prêt</span><h2>Qu’est-ce qu’on règle maintenant&nbsp;?</h2><p>Tout est désormais enregistré en ligne et disponible sur le téléphone comme sur l’ordinateur.</p><div className="actions"><button onClick={() => setView("chat")}>Écrire à Morice</button><button className="round" onClick={dictate}>⌁</button></div></div><img src="/morice-logo.png" alt="Rottweiler Morice" /></section>
          <section className="stats"><button onClick={() => setView("approvals")}><small>À valider</small><b>{approvals.length}</b><span>Décisions sensibles</span></button><button onClick={() => setView("tasks")}><small>En cours</small><b>{tasks.filter(t => t.status !== "done").length}</b><span>Tâches ouvertes</span></button><button onClick={enableNotifications}><small>Notifications</small><b>✓</b><span>Test réel disponible</span></button></section>
          <div className="section-title"><div><p className="eyebrow">ESPACE DE TRAVAIL</p><h2>Mes modules</h2></div></div>
          <section className="module-grid">{modules.map(module => <button key={module.id} onClick={() => setView(module.id)}><i>{module.content}</i><b>{module.title}</b><span>Ouvrir ce module</span></button>)}</section>
        </>}

        {view === "chat" && <section className="panel chat"><p className="eyebrow">CENTRE D’ACTIONS</p><h2>Demander à Morice</h2><div className="assistant-message"><b>Donne-moi une consigne, je m’en occupe.</b><span>Je crée une tâche, mémorise une information ou place toute action sensible dans Validations avant qu’elle puisse partir.</span></div><div className="mode-row" role="group" aria-label="Type d’action"><button className={assistantMode === "auto" ? "selected" : ""} onClick={() => setAssistantMode("auto")}>Automatique</button><button className={assistantMode === "task" ? "selected" : ""} onClick={() => setAssistantMode("task")}>Tâche</button><button className={assistantMode === "memory" ? "selected" : ""} onClick={() => setAssistantMode("memory")}>Mémoire</button><button className={assistantMode === "approval" ? "selected" : ""} onClick={() => setAssistantMode("approval")}>À valider</button></div><textarea value={message} onChange={event => setMessage(event.target.value)} onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") askMorice(); }} placeholder="Ex. Rappelle-moi d’appeler Martin demain matin…" /><div className="examples"><button onClick={() => setMessage("Rappelle-moi d’appeler Martin demain matin")}>Créer un rappel</button><button onClick={() => setMessage("Mémorise que le dossier Morice est prioritaire")}>Mémoriser une info</button><button onClick={() => setMessage("Prépare un mail de suivi à Martin")}>Préparer une action</button></div><div className="actions"><button onClick={askMorice} disabled={!message.trim() || assistantBusy}>{assistantBusy ? "Morice agit…" : "Exécuter avec Morice"}</button><button className="round" onClick={dictate} aria-label="Dicter une demande">⌁</button></div>{assistantResult && <article className="action-result"><p className="eyebrow">ACTION TERMINÉE</p><strong>{assistantResult.action.label}</strong><h3>{assistantResult.action.title}</h3><p>{assistantResult.reply}</p><div className="actions"><button onClick={() => setView(assistantResult.action.view)}>Voir l’action</button><button className="secondary" onClick={() => speak(assistantResult.reply)}>Écouter la réponse</button></div></article>}</section>}

        {view === "tasks" && <ListPanel title="Tâches Morice" items={tasks} value={newValue} setValue={setNewValue} add={() => addItem("task", newValue)} update={updateItem} />}
        {view === "memory" && <ListPanel title="Mémoire longue durée" items={memories} value={newValue} setValue={setNewValue} add={() => addItem("memory", "Souvenir", newValue)} update={updateItem} />}
        {view === "approvals" && <section className="panel"><p className="eyebrow">CONTRÔLE HUMAIN</p><h2>Validations</h2><p>Morice n’envoie, ne crée et ne modifie rien à l’extérieur sans ton accord ici.</p>{approvals.length ? approvals.map(item => <article className="row" key={item.id}><div><b>{item.title}</b><p>{item.content}</p></div><button disabled={Boolean(executingId)} onClick={() => executeApproval(item.id)}>{executingId === item.id ? "Exécution…" : "Valider et exécuter"}</button><button className="secondary" disabled={Boolean(executingId)} onClick={() => updateItem(item.id, "rejected")}>Refuser</button></article>) : <div className="empty">Aucune validation en attente.</div>}</section>}
        {view === "settings" && <section className="panel"><p className="eyebrow">APPLICATION</p><h2>Installer Morice</h2><p>Installe Morice avec son icône Rottweiler et une fenêtre indépendante du navigateur.</p><div className={`install-status ${installState}`}><span />{installState === "installed" ? "Morice est installé sur cet appareil" : installState === "available" ? "Morice est prêt à être installé" : installState === "checking" ? "Vérification de l’installation…" : "Installation disponible depuis le menu du navigateur"}</div><button onClick={installMorice}>{installState === "installed" ? "Vérifier l’installation" : installState === "available" ? "Installer Morice maintenant" : "Afficher comment l’installer"}</button>{showInstallHelp && <div className="install-help"><b>Installation en deux gestes</b>{isIos ? <p>Dans Safari, touche <strong>Partager</strong>, puis <strong>Sur l’écran d’accueil</strong>.</p> : <p>Ouvre le menu <strong>⋮</strong> en haut à droite, puis choisis <strong>Installer Morice</strong> ou <strong>Ajouter à l’écran d’accueil</strong>.</p>}<p>Aucun rechargement de la page n’est nécessaire.</p></div>}<hr /><p className="eyebrow">RÉGLAGES</p><h2>Notifications Morice</h2><p>Autorise les notifications une fois sur chaque appareil. Le bouton ci-dessous envoie un vrai test en arrière-plan.</p><button onClick={enableNotifications}>Activer et tester maintenant</button><hr /><h3>Trois synthèses quotidiennes</h3><div className="times">{((state.settings.digest_times as string[]) || ["08:00", "13:00", "18:30"]).map(time => <input key={time} type="time" defaultValue={time} />)}</div></section>}
        {view === "mail" && <InfoPanel title="Mail & Brouillons" text="Morice peut lire les mails récents et préparer des brouillons Outlook. Tout brouillon créé ou message envoyé passe d’abord par Validations." />}
        {view === "hubspot" && <InfoPanel title="HubSpot indisponible" text="Aucun accès HubSpot supplémentaire n’est disponible. Morice ne simulera jamais une connexion et utilisera Microsoft 365 ou Make pour les actions autorisées." />}
        {view === "calendar" && <InfoPanel title="Agenda" text="Morice peut consulter les rendez-vous Outlook. Toute création ou modification d’événement passe d’abord par Validations." />}
        {view === "documents" && <InfoPanel title="Documents & OneDrive" text="Morice peut rechercher des documents OneDrive après la connexion Microsoft 365, sans exposer les jetons d’accès." />}
        {view === "connections" && <ConnectionsPanel state={connections} refresh={refreshConnections} disconnectMicrosoft={disconnectMicrosoft} />}
      </section>

      <nav className="bottom">{nav.map(([id, label, icon]) => <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}><i>{icon}</i>{label}</button>)}</nav>
    </main>
  );
}

function InfoPanel({ title, text }: { title: string; text: string }) {
  return <section className="panel"><p className="eyebrow">MODULE MORICE</p><h2>{title}</h2><p>{text}</p></section>;
}

function ConnectionsPanel({ state, refresh, disconnectMicrosoft }: { state: ConnectionState | null; refresh: () => Promise<void>; disconnectMicrosoft: () => Promise<void> }) {
  return <section className="panel"><p className="eyebrow">SERVICES AUTORISÉS</p><h2>Connexions</h2><p>Les secrets restent côté serveur. Les actions externes sensibles attendent toujours ta validation.</p><div className="connection-grid">
    <article><div><b>Intelligence OpenAI</b><span className={state?.openai.configured ? "connected" : "waiting"}>{state?.openai.configured ? `Active · ${state.openai.model}` : "À configurer sur le site"}</span></div></article>
    <article><div><b>Microsoft 365</b><span className={state?.microsoft.connected ? "connected" : "waiting"}>{state?.microsoft.connected ? `Connecté · ${state.microsoft.account}` : state?.microsoft.configured ? "Prêt à être autorisé" : "Configuration de l’application requise"}</span></div>{state?.microsoft.connected ? <button className="secondary" onClick={disconnectMicrosoft}>Déconnecter</button> : <button disabled={!state?.microsoft.configured} onClick={() => { window.location.href = "/api/microsoft/start"; }}>Connecter Microsoft</button>}</article>
    <article><div><b>Make</b><span className={state?.make.configured ? "connected" : "waiting"}>{state?.make.configured ? "Webhook actif" : "Webhook à ajouter"}</span></div></article>
    <article className="disabled-connection"><div><b>HubSpot</b><span>Indisponible · aucun accès supplémentaire</span></div></article>
  </div><button className="secondary refresh-connection" onClick={refresh}>Actualiser les états</button></section>;
}

function ListPanel({ title, items, value, setValue, add, update }: { title: string; items: Item[]; value: string; setValue: (value: string) => void; add: () => void; update: (id: string, status: string) => void }) {
  return <section className="panel"><p className="eyebrow">SUIVI</p><h2>{title}</h2><div className="inline"><input value={value} onChange={event => setValue(event.target.value)} placeholder="Ajouter…" /><button onClick={add}>Ajouter</button></div>{items.length ? items.map(item => <article className="row" key={item.id}><div><b>{item.title}</b><p>{item.content}</p></div><button className="secondary" onClick={() => update(item.id, item.status === "done" ? "open" : "done")}>{item.status === "done" ? "Rouvrir" : "Terminer"}</button></article>) : <div className="empty">Aucun élément pour le moment.</div>}</section>;
}
