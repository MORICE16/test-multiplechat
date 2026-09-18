export type WeatherCity = { id: number; name: string; region: string; country: string };
export type WeatherResult = { city: WeatherCity; temperature: number; label: string; theme: 'clear'|'cloud'|'rain'|'snow'|'night'; measuredAt: string; fetchedAt: string };
export function weatherCoordinates(latitude: unknown, longitude: unknown) {
  if (typeof latitude !== 'number' || typeof longitude !== 'number' || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude)>90 || Math.abs(longitude)>180) throw new Error('Position invalide');
  return { latitude: Math.round(latitude*100)/100, longitude: Math.round(longitude*100)/100 };
}
export function cityQuery(value: string) {
  const city = value.trim();
  if (city.length < 2 || city.length > 80 || /[\x00-\x1f<>]/.test(city)) throw new Error('Ville invalide');
  return city;
}
export function cityId(value: string) {
  if (!/^[1-9]\d{0,9}$/.test(value)) throw new Error('Ville invalide');
  return Number(value);
}
export function weatherReading(current: {temperature_2m?: unknown; weather_code?: unknown; is_day?: unknown; time?: unknown}, timestamp = Date.now()) {
  const {temperature_2m: temperature, weather_code: code, is_day: day, time} = current;
  if (typeof temperature !== 'number' || !Number.isFinite(temperature) || temperature < -100 || temperature > 70 || typeof code !== 'number' || ![0,1,2,3,45,48,51,53,55,56,57,61,63,65,66,67,71,73,75,77,80,81,82,85,86,95,96,99].includes(code) || (day !== 0 && day !== 1) || typeof time !== 'number' || !Number.isFinite(time) || Math.abs(timestamp - time * 1000) > 90 * 60 * 1000) throw new Error('Météo non confirmée');
  let theme: WeatherResult['theme'] = 'cloud';
  let label = 'Nuageux';
  if (code <= 1) { theme = 'clear'; label = 'Ciel dégagé'; }
  else if ([45,48].includes(code)) label = 'Brouillard';
  else if ([71,73,75,77,85,86].includes(code)) {theme = 'snow'; label = 'Neige';}
  else if (code >= 51) {theme = 'rain'; label = code >= 95 ? 'Orages' : 'Pluie';}
  return {temperature, label, theme: day === 0 ? 'night' as const : theme, measuredAt: new Date(time * 1000).toISOString()};
}
