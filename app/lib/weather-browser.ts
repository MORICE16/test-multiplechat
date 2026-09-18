import { weatherCoordinates, weatherReading, type WeatherResult } from './weather';
// Public, key-free weather requests originate from the device, avoiding a
// shared server quota. Precise GPS values are rounded before any transmission.
export async function deviceWeather(id:number|null, position:{latitude:number;longitude:number}|null, signal:AbortSignal):Promise<WeatherResult> {
  let city={id:0,name:'À proximité',region:'',country:''};
  let coordinates=position;
  if (!coordinates) {
    if (!id || !Number.isSafeInteger(id)) throw new Error('Choisissez une ville.');
    const response=await fetch(`https://geocoding-api.open-meteo.com/v1/get?id=${id}&language=fr`,{signal});
    if(!response.ok)throw new Error('Ville indisponible. Réessayez.');
    const location=await response.json() as {id:number;name:string;admin1?:string;country?:string;latitude:number;longitude:number};
    if(location.id!==id || typeof location.name!=='string')throw new Error('Ville non confirmée.');
    city={id,name:location.name,region:location.admin1||'',country:location.country||''};
    coordinates=weatherCoordinates(location.latitude,location.longitude);
  }
  const rounded=weatherCoordinates(coordinates.latitude,coordinates.longitude);
  const params=new URLSearchParams({latitude:String(rounded.latitude),longitude:String(rounded.longitude),current:'temperature_2m,weather_code,is_day',timeformat:'unixtime',forecast_days:'1'});
  const response=await fetch(`https://api.open-meteo.com/v1/forecast?${params}`,{signal});
  if(!response.ok)throw new Error(response.status===429?'Service météo momentanément saturé. Réessayez dans quelques minutes.':'Météo indisponible. Vérifiez la connexion.');
  const data=await response.json() as {current?:Parameters<typeof weatherReading>[0]};
  return {city,...weatherReading(data.current||{}),fetchedAt:new Date().toISOString()};
}
