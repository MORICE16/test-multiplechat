import { execFile } from 'node:child_process';
import { isAbsolute } from 'node:path';

export const HEALTH_URL = 'http://127.0.0.1:18789/healthz';
export const STATUS_ARGS = Object.freeze(['nodes', 'status', '--json']);
export const tools = Object.freeze([
  { name: 'morice_openclaw_health', description: 'Read the health of the local OpenClaw Gateway. Does not invoke an agent or a device.' },
  { name: 'morice_openclaw_nodes', description: 'Read recorded pairing and connection status of OpenClaw nodes. Does not wake or command a device.' },
].map(tool => ({ ...tool, inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } })));

export function summarizeNodes(value) {
  if (!value || !Array.isArray(value.nodes) || value.nodes.length > 100) throw Error('Invalid node status');
  const clean = value => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 100) : '';
  return { nodes: value.nodes.map(node => {
    if (!node || typeof node !== 'object') throw Error('Invalid node');
    return {
      nodeId: typeof node.nodeId === 'string' && /^[a-f0-9]{64}$/i.test(node.nodeId) ? node.nodeId : '',
      displayName: clean(node.displayName), platform: clean(node.platform), version: clean(node.version),
      paired: typeof node.paired === 'boolean' ? node.paired : null,
      connected: typeof node.connected === 'boolean' ? node.connected : null,
    };
  }) };
}

export async function readHealth(call = fetch) {
  const response = await call(HEALTH_URL, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(5000) });
  if (!response.ok || !response.body) throw Error('Gateway unavailable');
  const reader = response.body.getReader();
  const chunks = []; let bytes = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > 16384) { await reader.cancel(); throw Error('Health payload too large'); }
      chunks.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (typeof value?.ok !== 'boolean') throw Error('Invalid health status');
  return { healthy: value.ok };
}

export function readNodes(cli, execute = execFile, signal) {
  if (typeof cli !== 'string' || !isAbsolute(cli) || !cli.endsWith('.mjs')) return Promise.reject(Error('CLI not configured'));
  return new Promise((resolve, reject) => {
    execute(process.execPath, [cli, ...STATUS_ARGS], { shell: false, windowsHide: true, timeout: 45000, maxBuffer: 262144, encoding: 'utf8', signal }, (error, stdout) => {
      if (error) { reject(Error('Node status unavailable')); return; }
      try { resolve(summarizeNodes(JSON.parse(stdout))); } catch { reject(Error('Invalid node status')); }
    });
  });
}

export function createBridge({ health = readHealth, nodes, audit = () => {}, now = () => new Date().toISOString() }) {
  let busy = false;
  return async function callTool(name, args = {}, signal) {
    const fail = message => ({ isError: true, content: [{ type: 'text', text: message }] });
    if (!tools.some(tool => tool.name === name)) return fail('Outil non autorisé.');
    if (!args || typeof args !== 'object' || Array.isArray(args) || Object.keys(args).length) return fail('Cet outil n’accepte aucun argument.');
    if (busy) return fail('Une lecture est déjà en cours.');
    if (signal?.aborted) return fail('Lecture annulée.');
    busy = true;
    try {
      const result = name === 'morice_openclaw_health' ? await health() : await nodes(signal);
      const data = { ...result, checkedAt: now(), source: 'local-openclaw-readonly' };
      try { audit({ event: 'morice_bridge_call', tool: name, success: true, at: data.checkedAt }); } catch { /* No raw diagnostic data in logs. */ }
      return { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data };
    } catch {
      try { audit({ event: 'morice_bridge_call', tool: name, success: false, at: now() }); } catch { /* No secrets in error output. */ }
      return fail('Lecture OpenClaw indisponible. Aucun résultat confirmé; aucune commande envoyée au téléphone.');
    } finally { busy = false; }
  };
}
