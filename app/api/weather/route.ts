import { userId } from '@/app/lib/runtime';
import { cityId, cityQuery, weatherReading } from '@/app/lib/weather';

const headers = { 'Cache-Control': 'no-store' };
async function getJson(url: URL) {
  const response = await fetch(url, { signal: AbortSignal.timeout(10000), redirect: 'error' });
  if (!response.ok) throw new Error('Météo indisponible');
  const data = await response.json();
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Réponse invalide');
  return data as Record<string, unknown>;
}
function city(data: Record<string, unknown>) {
  if (!Number.isSafeInteger(data.id) || typeof data.name !== 'string') throw new Error('Ville non confirmée');
  return { id: data.id as number, name: data.name.slice(0,100), region: typeof data.admin1 === 'string' ? data.admin1.slice(0,100) : '', country: typeof data.country === 'string' ? data.country.slice(0,100) : '' };
}
export async function GET(request: Request) {
  try { userId(request); } catch { return Response.json({error: 'Authentification requise.'}, {status:401, headers}); }
  const params = new URL(request.url).searchParams;
  let query: string | undefined;
  let id: number | undefined;
  try {
    if (params.has('id')) id = cityId(params.get('id') || '');
    else query = cityQuery(params.get('city') || '');
  } catch {return Response.json({error: 'Indiquez une ville de 2 à 80 caractères.'}, {status:400, headers});}
  try {
    if (query !== undefined) {
      const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
      url.search = new URLSearchParams({name:query, count:'5', language:'fr', format:'json'}).toString();
      const data = await getJson(url);
      return Response.json({cities: Array.isArray(data.results) ? data.results.slice(0,5).map(city) : []}, {headers});
    }
    const locationUrl = new URL('https://geocoding-api.open-meteo.com/v1/get');
    locationUrl.search = new URLSearchParams({id:String(id),language:'fr'}).toString();
    const location = await getJson(locationUrl);
    const selected = city(location);
    if (selected.id !== id || typeof location.latitude !== 'number' || !Number.isFinite(location.latitude) || Math.abs(location.latitude) > 90 || typeof location.longitude !== 'number' || !Number.isFinite(location.longitude) || Math.abs(location.longitude) > 180) throw new Error('Coordonnées invalides');
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.search = new URLSearchParams({latitude:String(location.latitude), longitude:String(location.longitude), current:'temperature_2m,weather_code,is_day', timeformat:'unixtime', forecast_days:'1'}).toString();
    const data = await getJson(url);
    return Response.json({city:selected, ...weatherReading(data.current && typeof data.current === 'object' ? data.current : {}), fetchedAt:new Date().toISOString()}, {headers});
  } catch {return Response.json({error:'Météo indisponible pour le moment. Réessayez plus tard.'}, {status:502, headers});}
}
