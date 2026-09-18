"use client";
import { useState } from "react";
import { improvements } from "../lib/improvements";

export function ImprovementsPanel() {
  const [filter, setFilter] = useState("tous"); const [query, setQuery] = useState("");
  const shown = improvements.filter(item => (filter === "tous" || item.status === filter) && `${item.title} ${item.reason}`.toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr")));
  return <section className="panel"><p className="eyebrow">MÉMOIRE DU PROJET</p><h2>Veille et améliorations</h2><p>{improvements.length} pistes consolidées du fil « Three Morice upgrades worth testing now » et des demandes d’Alan. Reprise du 18 septembre 2026. Les annonces historiques sont des pistes à vérifier; elles ne prouvent ni disponibilité ni connexion.</p><p>Ce suivi est sauvegardé avec le projet. Il n’importe pas automatiquement les futures conversations ou vidéos.</p>
    <div className="backlog-controls"><input aria-label="Rechercher une amélioration" placeholder="Voix, Microsoft, téléphone…" value={query} onChange={e => setQuery(e.target.value)} /><select aria-label="Statut des améliorations" value={filter} onChange={e => setFilter(e.target.value)}>{["tous", "déjà intégré", "à tester", "à développer", "inutile"].map(value => <option key={value} value={value}>{value}</option>)}</select></div>
    <p>{shown.length} élément(s)</p>{shown.map(item => <article className="job-card" key={item.id}><small>{item.priority} · {item.status}</small><h3>{item.title}</h3><p>{item.reason}</p><small>Origine : {item.source}</small></article>)}
  </section>;
}
