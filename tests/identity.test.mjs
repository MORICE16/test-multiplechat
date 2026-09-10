import assert from 'node:assert/strict';
import { test } from 'node:test';
import { requestUserId } from '../app/lib/identity.ts';
test('anonymous production requests never use the local fallback',()=>{
  for(const url of ['https://example.com/api/state','http://localhost:3431/api/state','http://127.0.0.1/api/state']) assert.equal(requestUserId(new Request(url),false),null);
});
test('local identity requires loopback development without forwarding',()=>{
  assert.equal(requestUserId(new Request('http://127.0.0.1:3431/api/state',{headers:{host:'127.0.0.1:3431','x-forwarded-host':'127.0.0.1:3431'}}),true),'alan');
  for(const host of ['localhost:3431','127.0.0.1:3431','[::1]:3431'])assert.equal(requestUserId(new Request('http://'+host+'/api/state'),true),'alan');
  for(const headers of [{'x-forwarded-for':'203.0.113.5'},{'forwarded':'host=example.com'},{'x-forwarded-host':'example.com'},{host:'example.com'}])assert.equal(requestUserId(new Request('http://localhost:3431/api/state',{headers}),true),null);
  assert.equal(requestUserId(new Request('http://192.168.1.1/api/state'),true),null);
  assert.equal(requestUserId(new Request('https://localhost.example.com/api/state'),true),null);
});
test('authenticated gateway identities remain isolated',()=>{
  for(const id of ['owner-one','owner-two'])assert.equal(requestUserId(new Request('https://example.com/api/state',{headers:{'oai-authenticated-user-id':id}})),id);
  assert.equal(requestUserId(new Request('https://example.com/api/state',{headers:{'oai-authenticated-user-id':'  '}})),null);
});
