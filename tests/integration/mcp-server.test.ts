// Servidor MCP de punta a punta, como lo usa un IDE/agente: proceso por stdio, cliente MCP oficial.
// Requisito previo para actualizar @modelcontextprotocol/sdk (avisos de seguridad pendientes).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const require = createRequire(import.meta.url);
const { startHub, connectClient, freePort, sleep } = require('../helpers/hub.cjs');
const { ROOT } = require('../helpers/extension-sim.cjs');

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ctf-mcp-'));
let port: number;
let client: Client;
let stderr = '';

async function startMcp(env: Record<string, string>) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [require.resolve('tsx/cli'), path.join(ROOT, 'packages/mcp-server/src/index.ts')],
    env: { ...process.env as Record<string, string>, USERPROFILE: home, HOME: home, ...env },
    cwd: ROOT,
    stderr: 'pipe',
  });
  transport.stderr?.on('data', (d) => { stderr += d; });
  const c = new Client({ name: 'pruebas', version: '1.0.0' });
  await c.connect(transport); // falla si algo ensucia stdout (el canal JSON-RPC)
  return c;
}

/** Plugin de Figma simulado: se vincula al hub y acumula lo que recibe */
async function fakePlugin(url: string) {
  const code = fs.readFileSync(path.join(home, '.code-to-figma', 'pairing-code'), 'utf8').trim();
  const plugin = await connectClient(url, 'null');
  plugin.send({ type: 'REGISTER_CLIENT', clientType: 'FIGMA_PLUGIN', pairingCode: code });
  await plugin.waitFor((m: any) => m.type === 'AUTH_OK');
  return plugin;
}

const textOf = (res: any) => JSON.parse(res.content[0].text);

describe('servidor MCP (stdio)', () => {
  beforeAll(async () => {
    port = await freePort();
    client = await startMcp({ WS_PORT: String(port) });
  });
  afterAll(async () => {
    await client?.close();
    fs.rmSync(home, { recursive: true, force: true });
  });

  it('se conecta por stdio sin ensuciar stdout y expone sus 4 herramientas', async () => {
    const { tools } = await client.listTools();
    expect(tools.map(t => t.name).sort()).toEqual(['crawl_site_to_figma', 'inspect_ui_node', 'render_html_to_figma', 'render_url_to_figma']);
    // el banner del hub embebido sale por stderr, no por stdout
    await sleep(300);
    expect(stderr).toMatch(/Código de vinculación/);
  });

  it('render_html_to_figma: extrae con el extractor unificado y el plugin lo recibe', async () => {
    const plugin = await fakePlugin(`ws://127.0.0.1:${port}`);
    const res = await client.callTool({ name: 'render_html_to_figma', arguments: {
      html: '<div id="x" style="display:flex;gap:8px;padding:12px"><b style="width:40px;height:20px;background:red"></b><b style="width:40px;height:20px;background:blue"></b></div>',
      selector: '#x',
    } });
    const out = textOf(res);
    expect(out).toMatchObject({ success: true, sentToFigma: true, connectedPlugins: 1 });
    const render = await plugin.waitFor((m: any) => m.type === 'RENDER_NODES', 5000);
    expect(render.payload.rootNode.layout).toMatchObject({ mode: 'HORIZONTAL', itemSpacing: 8 });
    plugin.close();
  });

  it('sin plugin conectado lo informa en lugar de fallar', async () => {
    await sleep(300);
    const res = await client.callTool({ name: 'render_html_to_figma', arguments: { html: '<p id="p">Hola</p>', selector: '#p' } });
    expect(textOf(res)).toMatchObject({ success: true, sentToFigma: false });
  });
});

describe('servidor MCP con un hub ya corriendo en el mismo puerto', () => {
  it('no se cae y reenvía los renders al hub existente', async () => {
    const external = await startHub({ home });
    const mcp = await startMcp({ WS_PORT: String(external.port) });
    try {
      const plugin = await fakePlugin(external.url);
      const res = await mcp.callTool({ name: 'render_html_to_figma', arguments: { html: '<p id="p">Desde el MCP</p>', selector: '#p' } });
      expect(textOf(res)).toMatchObject({ success: true, sentToFigma: true });
      const render = await plugin.waitFor((m: any) => m.type === 'RENDER_NODES', 5000);
      expect(render.payload.rootNode.textData.characters).toBe('Desde el MCP');
      expect(stderr).toMatch(/ya está en uso/);
      plugin.close();
    } finally {
      await mcp.close();
      await external.stop();
    }
  });
});
