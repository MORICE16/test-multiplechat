import test from 'node:test';
import assert from 'node:assert/strict';
import {cityQuery,cityId,weatherReading} from '../app/lib/weather.ts';
test('weather input is bounded and city selection requires a numeric id',()=>{
  assert.equal(cityQuery(' Montréal '),'Montréal');
  for(const q of ['', 'x','x'.repeat(81),'Paris\nX','<Paris>']) assert.throws(()=>cityQuery(q));
  assert.equal(cityId('2988507'),2988507);
  for(const id of ['', '0','-1','1.2','https://example.com','12345678901']) assert.throws(()=>cityId(id));
});
test('weather never substitutes missing or stale data and distinguishes snow/rain/night',()=>{
  const timestamp=Date.now(); const current={temperature_2m:12,weather_code:0,is_day:1,time:Math.floor(timestamp/1000)};
  assert.equal(weatherReading(current,timestamp).theme,'clear');
  assert.equal(weatherReading({...current,weather_code:85},timestamp).theme,'snow');
  assert.equal(weatherReading({...current,weather_code:95},timestamp).label,'Orages');
  assert.equal(weatherReading({...current,is_day:0},timestamp).theme,'night');
  for(const patch of [{temperature_2m:null},{weather_code:100},{time:current.time-7200},{is_day:null}]) assert.throws(()=>weatherReading({...current,...patch},timestamp));
});
