'use client';

import { useEffect, useRef, useState } from 'react';
import type { WeatherCity, WeatherResult } from '@/app/lib/weather';
import { deviceWeather } from '@/app/lib/weather-browser';

const storageKey = 'morice-weather-city-v1';
export function HorizonWeather() {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const [choices, setChoices] = useState<WeatherCity[]>([]);
  const [weather, setWeather] = useState<WeatherResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [follow, setFollow] = useState(false);
  const [position, setPosition] = useState<{latitude:number;longitude:number}|null>(null);
  const searchGeneration = useRef(0);
  useEffect(() => {
    const restoration = window.setTimeout(() => {
      try {
        const id = localStorage.getItem(storageKey);
        if (id && /^[1-9]\d{0,9}$/.test(id)) setSelected(Number(id));
        setFollow(localStorage.getItem('morice-weather-follow') === 'yes');
      } catch { /* Browser storage may be unavailable. */ }
    }, 0);
    return () => { window.clearTimeout(restoration); searchGeneration.current++; };
  }, []);
  useEffect(() => {
    if (!follow) return;
    if (!navigator.geolocation) {
      const unavailable = window.setTimeout(() => setError('Localisation indisponible sur cet appareil. Choisissez une ville.'), 0);
      return () => window.clearTimeout(unavailable);
    }
    let active = true;
    let watch: number | undefined;
    function stop() { if (watch !== undefined) navigator.geolocation.clearWatch(watch); watch=undefined; }
    function start() {
      stop();
      if (document.visibilityState !== 'visible') return;
      watch=navigator.geolocation.watchPosition(value => {
        if (!active) return;
        const next={latitude:Math.round(value.coords.latitude*100)/100,longitude:Math.round(value.coords.longitude*100)/100};
        setPosition(previous => previous?.latitude===next.latitude && previous?.longitude===next.longitude ? previous : next);
        setError('');
      }, failure => { if (!active) return; setPosition(null); setWeather(null); setError(failure.code===1 ? 'Localisation refusée. Autorisez-la dans les réglages du navigateur ou choisissez une ville.' : 'Position indisponible. Réessayez ou choisissez une ville.'); }, {enableHighAccuracy:false,maximumAge:300000,timeout:15000});
    }
    start(); document.addEventListener('visibilitychange',start);
    return () => { active = false; stop(); document.removeEventListener('visibilitychange',start); };
  }, [follow,refresh]);
  useEffect(() => {
    if (follow ? !position : !selected) return;
    let active = true;
    let run = 0;
    let controller: AbortController | undefined;
    async function update() {
      if (document.visibilityState !== 'visible') return;
      const currentRun = ++run;
      controller?.abort(); controller = new AbortController();
      setBusy(true); setError('');
      try {
        const data = await deviceWeather(selected,follow ? position : null,AbortSignal.any([controller.signal,AbortSignal.timeout(15000)]));
        if (!active || currentRun !== run) return;
        setWeather(data);
      } catch (failure) {
        if (!active || currentRun !== run) return;
        setWeather(null);
        setError(failure instanceof Error && failure.name !== 'AbortError' ? failure.message : 'Météo non actualisée.');
      } finally { if (active && currentRun === run) setBusy(false); }
    }
    void update();
    const timer = window.setInterval(() => { void update(); }, 20 * 60 * 1000);
    const staleTimer = window.setInterval(() => {
      setWeather(previous => {
        if (previous && Date.now() - Date.parse(previous.measuredAt) > 90 * 60 * 1000) {
          return null;
        }
        return previous;
      });
    }, 60 * 1000);
    const resume = () => { if (document.visibilityState === 'visible') void update(); };
    document.addEventListener('visibilitychange', resume);
    return () => { active = false; controller?.abort(); clearInterval(timer); clearInterval(staleTimer); document.removeEventListener('visibilitychange',resume); };
  }, [selected, refresh, follow, position]);
  useEffect(() => {
    const dataset = document.documentElement.dataset;
    if (weather) {
      dataset.weather = weather.theme;
      dataset.temperature = weather.temperature >= 25 ? 'warm' : weather.temperature <= 8 ? 'cold' : 'mild';
    } else {
      delete dataset.weather; delete dataset.temperature;
    }
    return () => { delete dataset.weather; delete dataset.temperature; };
  }, [weather]);
  function locate() {
    setSelected(null); setFollow(true); setEditing(false); setWeather(null); setRefresh(value=>value+1);
    try { localStorage.setItem('morice-weather-follow','yes'); localStorage.removeItem(storageKey); } catch { /* Preference remains usable for this session. */ }
  }
  async function search(event: React.FormEvent) {
    event.preventDefault();
    const generation = ++searchGeneration.current;
    setBusy(true); setError(''); setChoices([]);
    try {
      const response = await fetch(`/api/weather?city=${encodeURIComponent(query.trim())}`, {signal:AbortSignal.timeout(15000)});
      const data = await response.json() as {cities: WeatherCity[]; error?: string};
      if (!response.ok) throw new Error(data.error || 'Recherche indisponible.');
      if (generation !== searchGeneration.current) return;
      setChoices(data.cities);
      if (!data.cities.length) setError('Aucune ville trouvée. Précisez son nom.');
    } catch (failure) { if (generation === searchGeneration.current) setError(failure instanceof Error ? failure.message : 'Recherche indisponible.'); }
    finally { if (generation === searchGeneration.current) setBusy(false); }
  }
  function choose(id: number) {
    setFollow(false); setPosition(null); try { localStorage.removeItem('morice-weather-follow'); } catch { /* Preference remains usable for this session. */ }
    searchGeneration.current++; setWeather(null);
    setSelected(id); setRefresh(value => value + 1); setChoices([]); setEditing(false);
    try { localStorage.setItem(storageKey, String(id)); } catch { /* Selection remains usable this session. */ }
  }
  function disable() {
    setFollow(false); setPosition(null);  try { localStorage.removeItem('morice-weather-follow'); } catch { /* Preference remains usable for this session. */ }
    searchGeneration.current++; setSelected(null); setWeather(null); setChoices([]); setError(''); setBusy(false); setEditing(false);

    try {localStorage.removeItem(storageKey);} catch { /* No stored preference. */ }
  }
  return <section className="horizon-weather" aria-label="Météo et ambiance">
    {weather && <div className="weather-summary" aria-live="polite"><strong>{Math.round(weather.temperature)}° · {weather.city.name}</strong><span>{weather.label}</span><small>Conditions estimées du {new Date(weather.measuredAt).toLocaleString('fr-FR', {day:'numeric', month:'short',hour:'2-digit',minute:'2-digit'})}</small></div>}
    {!selected && !follow && !editing && <button type="button" onClick={() => setEditing(true)}>☀ Météo</button>}
    {editing && <><button type="button" onClick={locate}>Utiliser ma position</button><small>Position approximative transmise à Open-Meteo pour la météo. Actualisation lorsque cet écran est ouvert ; aucune position conservée par Morice.</small></>}
    {editing && <form className="weather-form" onSubmit={search}>
      <label htmlFor="weather-city">Votre ville</label><input id="weather-city" value={query} onChange={event => setQuery(event.target.value)} minLength={2} maxLength={80} required placeholder="Choisir une ville" autoComplete="address-level2" />
      <button type="submit" disabled={busy}>Rechercher</button>
      <small>Ou choisissez une ville sans activer la localisation.</small>
    </form>}
    {choices.length > 0 && <div className="weather-choices"><p>Sélectionnez votre ville :</p>{choices.map(city => <button type="button" key={city.id} onClick={() => choose(city.id)}>{city.name} · {[city.region,city.country].filter(Boolean).join(', ')}</button>)}</div>}
    {busy && <p role="status">Actualisation météo…</p>}
    {error && <p className="weather-error" role="status">{error}</p>}
    {follow && !position && !error && <p role="status">En attente de l’autorisation de localisation…</p>}
    {(selected || follow) && <div className="weather-actions"><button type="button" onClick={() => setEditing(value => !value)}>Lieu</button><button type="button" onClick={()=>setRefresh(value=>value+1)}>Actualiser</button><button type="button" onClick={disable}>Désactiver</button></div>}
    {(selected || editing || follow) && <small className="weather-source">Données : <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> · <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a></small>}
  </section>;
}
