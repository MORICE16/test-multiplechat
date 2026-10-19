import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDayRange, localDayRange, dayEvents, calendarReadText } from '../app/lib/calendar-day.ts';

test('day range accepts DST days and rejects timezone-less, stale or excessive ranges', () => {
  const clock = Date.parse('2026-10-25T12:00:00.000Z');
  assert.deepEqual(validateDayRange('2026-10-24T22:00:00.000Z','2026-10-25T23:00:00.000Z',clock), {start:'2026-10-24T22:00:00.000Z',end:'2026-10-25T23:00:00.000Z'});
  for (const [start,end] of [[null,null],['2026-10-25T00:00:00','2026-10-26T00:00:00'],['2026-10-24T00:00:00.000Z','2026-10-26T00:00:00.000Z'],['2026-10-24T00:00:00.000Z','2026-10-25T00:00:00.000Z'],['2026-10-26T00:00:00.000Z','2026-10-27T00:00:00.000Z']]) assert.throws(()=>validateDayRange(start,end,clock));
  const range = localDayRange(new Date('2026-09-18T12:00:00Z'));
  assert.equal(new Date(range.start).getHours(),0);
  assert.equal(new Date(range.end).getHours(),0);
});

test('weekly calendar uses the labelled Paris timezone including summer/winter and all-day events',()=>{
  const event=(subject,date,extra={})=>({subject,start:{dateTime:date,timeZone:'UTC'},...extra});
  const result=calendarReadText({value:[event('Été','2026-07-01T08:00:00.0000000'),event('Hiver','2026-12-01T08:00:00'),event('Journée','2026-07-01T22:00:00',{isAllDay:true}),event('Annulé','oops',{isCancelled:true})]});
  assert.match(result,/Europe\/Paris/);assert.match(result,/10:00 — Été/);assert.match(result,/09:00 — Hiver/);assert.match(result,/2 juil\. 2026 · Toute la journée — Journée/);assert.doesNotMatch(result,/Annulé|Date inconnue/);
  assert.match(calendarReadText({value:[]}),/Aucun rendez-vous actif dans les sept prochains jours/);
});

test('weekly calendar refuses uncertain dates and reports partial pages without exposing continuations',()=>{
  for(const data of [null,{}, {value:[null]}, {value:[{start:{dateTime:'oops'}}]}, {value:[{start:{dateTime:'2026-10-19T10:00:00',timeZone:'Pacific Standard Time'}}]}])assert.throws(()=>calendarReadText(data));
  const result=calendarReadText({value:Array.from({length:11},(_,i)=>({subject:`Test-${i}`,start:{dateTime:'2026-10-19T10:00:00',timeZone:'UTC'}})),'@odata.nextLink':'PRIVATE CONTINUATION'});
  assert.equal((result.match(/— Test-/g)||[]).length,10);assert.match(result,/Lecture partielle/);assert.doesNotMatch(result,/PRIVATE|Test-10/);
  assert.match(calendarReadText({value:[],'@odata.nextLink':'PRIVATE'}),/dans cette page/);
});

test('calendar UTC response preserves overnight/all-day events and excludes cancelled/outside events', () => {
  const start='2026-09-17T22:00:00.000Z',end='2026-09-18T22:00:00.000Z';
  const event=(id,a,b,extras={})=>({id,subject:id,start:{dateTime:a},end:{dateTime:b},...extras});
  const result=dayEvents({value:[
    event('night','2026-09-17T21:30:00.0000000','2026-09-17T23:00:00.0000000'),
    event('all','2026-09-17T22:00:00','2026-09-18T22:00:00',{isAllDay:true}),
    event('cancel','2026-09-18T12:00:00','2026-09-18T13:00:00',{isCancelled:true}),
    event('outside','2026-09-18T22:00:00','2026-09-18T23:00:00'),
    event('bad','oops','oops'),
  ],'@odata.nextLink':'https://example.invalid/ignored'},start,end);
  assert.deepEqual(result.events.map(e=>e.id),['all','night']);
  assert.equal(result.events[1].start,'2026-09-17T21:30:00.000Z');
  assert.equal(result.hasMore,true);
  assert.throws(()=>dayEvents(null,start,end));
});
