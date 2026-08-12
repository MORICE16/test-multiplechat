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

const starterModules = [
  ["chat", "Parler à Morice", "✦"],
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

  useEffect(() => { refresh(); }, []);

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

        {view === "chat" && <section className="panel chat"><p className="eyebrow">CONVERSATION</p><h2>Parler à Morice</h2><div className="assistant-message">Bonjour Alan. La nouvelle base en ligne est prête. Le moteur conversationnel OpenAI sera activé sur cette adresse dès que sa connexion sécurisée sera ajoutée.</div><textarea value={message} onChange={event => setMessage(event.target.value)} placeholder="Écris ou dicte ce que tu veux organiser…" /><div className="actions"><button onClick={() => { if (message.trim()) { addItem("memory", "Message d'Alan", message); setNotice("Message mémorisé dans Morice."); setMessage(""); } }}>Mémoriser</button><button className="round" onClick={dictate}>⌁</button><button className="secondary" onClick={() => speak("Morice est prêt. Dis-moi ce que tu veux organiser.")}>Réponse vocale</button></div></section>}

        {view === "tasks" && <ListPanel title="Tâches Morice" items={tasks} value={newValue} setValue={setNewValue} add={() => addItem("task", newValue)} update={updateItem} />}
        {view === "memory" && <ListPanel title="Mémoire longue durée" items={memories} value={newValue} setValue={setNewValue} add={() => addItem("memory", "Souvenir", newValue)} update={updateItem} />}
        {view === "approvals" && <section className="panel"><p className="eyebrow">CONTRÔLE HUMAIN</p><h2>Validations</h2>{approvals.length ? approvals.map(item => <article className="row" key={item.id}><div><b>{item.title}</b><p>{item.content}</p></div><button onClick={() => updateItem(item.id, "approved")}>Valider</button><button className="secondary" onClick={() => updateItem(item.id, "rejected")}>Refuser</button></article>) : <div className="empty">Aucune validation en attente.</div>}</section>}
        {view === "settings" && <section className="panel"><p className="eyebrow">RÉGLAGES</p><h2>Notifications Morice</h2><p>Autorise les notifications une fois sur chaque appareil. Le bouton ci-dessous envoie un vrai test en arrière-plan.</p><button onClick={enableNotifications}>Activer et tester maintenant</button><hr /><h3>Trois synthèses quotidiennes</h3><div className="times">{((state.settings.digest_times as string[]) || ["08:00", "13:00", "18:30"]).map(time => <input key={time} type="time" defaultValue={time} />)}</div></section>}
        {view === "mail" && <InfoPanel title="Mail & Brouillons" text="Outlook sera relié à cette version par une autorisation Microsoft 365 unique. Aucun message ne sera envoyé sans validation." />}
        {view === "hubspot" && <InfoPanel title="HubSpot" text="Le pont Android → Tasker → Make → Microsoft To Do reste actif. La prochaine notification réelle servira de validation finale." />}
        {view === "calendar" && <InfoPanel title="Agenda" text="Les calendriers Outlook ont été vérifiés. La connexion directe à cette application sera ajoutée avec Microsoft 365." />}
        {view === "documents" && <InfoPanel title="Documents & OneDrive" text="Ici seront regroupés les mails, pièces, résumés, brouillons et preuves par dossier ou histoire." />}
        {view === "connections" && <InfoPanel title="Connexions" text="Actif : stockage Morice en ligne, Make et Microsoft To Do. À autoriser : Microsoft 365, OneDrive et HubSpot API si l'entreprise le permet." />}
      </section>

      <nav className="bottom">{nav.map(([id, label, icon]) => <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}><i>{icon}</i>{label}</button>)}</nav>
    </main>
  );
}

function InfoPanel({ title, text }: { title: string; text: string }) {
  return <section className="panel"><p className="eyebrow">MODULE MORICE</p><h2>{title}</h2><p>{text}</p></section>;
}

function ListPanel({ title, items, value, setValue, add, update }: { title: string; items: Item[]; value: string; setValue: (value: string) => void; add: () => void; update: (id: string, status: string) => void }) {
  return <section className="panel"><p className="eyebrow">SUIVI</p><h2>{title}</h2><div className="inline"><input value={value} onChange={event => setValue(event.target.value)} placeholder="Ajouter…" /><button onClick={add}>Ajouter</button></div>{items.length ? items.map(item => <article className="row" key={item.id}><div><b>{item.title}</b><p>{item.content}</p></div><button className="secondary" onClick={() => update(item.id, item.status === "done" ? "open" : "done")}>{item.status === "done" ? "Rouvrir" : "Terminer"}</button></article>) : <div className="empty">Aucun élément pour le moment.</div>}</section>;
}
