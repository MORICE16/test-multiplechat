import { createRequire } from 'node:module';
import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { access } from 'node:fs/promises';
import { createBridge, readNodes, tools } from './bridge.mjs';

// Operator-only startup configuration, never arguments supplied by a model.
const cli = process.env.MORICE_OPENCLAW_CLI;
try {
  if (!cli || !isAbsolute(cli) || !cli.endsWith('.mjs')) throw Error('CLI missing');
  if (!process.env.OPENCLAW_CONFIG_PATH || !process.env.OPENCLAW_STATE_DIR) throw Error('Runtime missing');
  await access(cli);
  const require = createRequire(cli);
  const load = path => import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/' + path)).href);
  const [{ Server }, { StdioServerTransport }, { ListToolsRequestSchema, CallToolRequestSchema }] = await Promise.all([
    load('server/index.js'), load('server/stdio.js'), load('types.js'),
  ]);
  const server = new Server({ name: 'morice-openclaw-readonly', version: '0.1.0' }, { capabilities: { tools: {} } });
  const call = createBridge({ nodes: signal => readNodes(cli, undefined, signal), audit: event => process.stderr.write(JSON.stringify(event) + '\n') });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
  server.setRequestHandler(CallToolRequestSchema, (request, extra) => call(request.params.name, request.params.arguments, extra.signal));
  const transport = new StdioServerTransport(process.stdin, process.stdout, { maxBufferSize: 65536 });
  server.onerror = () => process.stderr.write('Morice bridge: protocol error.\n');
  await server.connect(transport);
} catch {
  process.stderr.write('Morice bridge unavailable: verify the local OpenClaw paths and its installed MCP SDK.\n');
  process.exitCode = 1;
}
