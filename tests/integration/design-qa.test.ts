// QA de diseño contra producción (Función B): el "diseño" es una tarjeta dibujada en el Figma simulado y
// "producción" otra extracción con otra estructura, otras clases y desviaciones conocidas. El informe
// tiene que encontrar exactamente esas desviaciones (y nada cuando no las hay).
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { beforeAll, describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import { useBrowser } from '../helpers/browser';
import { HUB_PROTOCOL } from '../../packages/contracts/src/index';

const require = createRequire(import.meta.url);
const { extract } = require('../helpers/extension-sim.cjs');
const { loadPlugin } = require('../helpers/figma-mock.cjs');
const { startHub, connectClient } = require('../helpers/hub.cjs');

const B = useBrowser({ width: 1440, height: 900 });
const quiet = { ...console, log() {}, warn() {}, info() {} };
let design: any;
let prod: any;

beforeAll(async () => {
  const page = await B.page('synthetic/qa.html');
  design = (await extract(page, "document.getElementById('design')")).rootNode;
  prod = (await extract(page, "document.getElementById('prod')")).rootNode;
  await page.context().close();
});

/** Dibuja el diseño en un Figma simulado y compara `production` contra él */
async function runQa(production: any, opts: { tokens?: boolean } = {}) {
  const figma = loadPlugin({}, quiet);
  await figma.ui.onmessage({ type: 'RENDER_NODES', payload: { rootNode: JSON.parse(JSON.stringify(design)) } });
  const target = figma.currentPage.children[figma.currentPage.children.length - 1];
  target.name = 'Tarjeta de precio'; // el nombre de la diseñadora, no la clase CSS
  if (opts.tokens) {
    const col = figma.variables.createVariableCollection('Colores');
    const v = figma.variables.createVariable('gris/500', col, 'COLOR');
    v.setValueForMode('m1', { r: 100 / 255, g: 116 / 255, b: 139 / 255, a: 1 }); // #64748B
  }
  const before = figma.logs.length;
  await figma.ui.onmessage({
    type: 'RENDER_NODES',
    payload: { rootNode: JSON.parse(JSON.stringify(production)), compare: { targetNodeId: target.id, width: 320 } },
  });
  const logs = figma.logs.slice(before);
  const success = logs.find((m: any) => m.type === 'RENDER_SUCCESS');
  const report = figma.currentPage.children.find((n: any) => /^QA · /.test(n.name));
  const rows = (report?.children || []).filter((n: any) => n.type === 'TEXT').map((t: any) => t.characters);
  return { figma, logs, success, report, rows, target };
}

describe('QA de diseño contra producción', () => {
  let r: any;
  beforeAll(async () => {
    r = await runQa(prod, { tokens: true });
  });

  it('sin errores y con resumen en RENDER_SUCCESS', () => {
    expect(r.logs.filter((m: any) => m.type === 'RENDER_ERROR')).toEqual([]);
    expect(r.success.qa).toMatchObject({ designTexts: 5, matchedTexts: 5 });
  });

  it('encuentra cada desviación conocida', () => {
    const all = r.rows.join('\n');
    // El diseño de la prueba lo dibuja el propio plugin (padding visual 25 = 24 + 1 de borde)
    expect(all).toMatch(/Padding: 20 px \(\+1 px de borde\) en producción, 25 px en el diseño/);
    expect(all).toMatch(/Tamaño: ancho 362 px en producción, 370 px en el diseño/);
    expect(all).toMatch(/Tipografía: Inter 15\/22 \(600\) en producción, Inter 16\/24 \(700\) en el diseño/);
    expect(all).toMatch(/Relleno: #6B7280 en producción \(no es ninguna Variable del archivo\), #64748B en el diseño/);
    expect(all).toMatch(/Radio de esquina: 6 px en producción, 8 px en el diseño/);
    expect(all).toMatch(/Está en producción pero no en el diseño: «Nuevo»/);
    expect(all).toMatch(/Contenido distinto: «\$29» en producción/);
  });

  it('sin falsos positivos: textos iguales, el envoltorio extra del diseño y los nombres no cuentan', () => {
    const all = r.rows.join('\n');
    expect(all).not.toMatch(/Falta en producción/);
    expect(all).not.toMatch(/Para equipos que crecen».*\n.*(Tipografía|Color)/);
    expect(all).not.toMatch(/Facturación mensual».*\n.*(Tipografía|Color)/);
    // Solo lo esperado: padding, alto de la tarjeta (el badge la alarga), título, gris, radio, badge, precio
    const severities = r.report.children.filter(
      (n: any) => n.type === 'TEXT' && /^(alta|media|baja|info)$/.test(n.name),
    );
    expect(severities.length).toBeLessThanOrEqual(8);
  });

  it('anota las capas del diseño (Dev Mode) y dibuja producción al lado', () => {
    const annotated: any[] = [];
    (function walk(n: any) {
      if (Array.isArray(n.annotations) && n.annotations.some((a: any) => /^QA · /.test(a.label))) annotated.push(n);
      for (const c of n.children || []) walk(c);
    })(r.target);
    expect(annotated.length).toBeGreaterThanOrEqual(3);
    expect(r.target.annotations?.[0]?.label).toMatch(/Padding/);
    expect(r.figma.currentPage.children.some((n: any) => n.name === 'Producción · Tarjeta de precio')).toBe(true);
  });

  it('comparar otra vez reemplaza las anotaciones anteriores (no se acumulan)', async () => {
    const figma = r.figma;
    await figma.ui.onmessage({
      type: 'RENDER_NODES',
      payload: { rootNode: JSON.parse(JSON.stringify(prod)), compare: { targetNodeId: r.target.id, width: 320 } },
    });
    expect(r.target.annotations.filter((a: any) => /^QA · /.test(a.label))).toHaveLength(1);
  });

  it('el diseño contra sí mismo: cero diferencias', async () => {
    const same = await runQa(design);
    expect(same.success.qa.total).toBe(0);
    expect(same.rows.join('\n')).toMatch(/Sin diferencias medibles/);
  });

  it('frame de diseño que ya no existe → error claro', async () => {
    const figma = loadPlugin({}, quiet);
    await figma.ui.onmessage({
      type: 'RENDER_NODES',
      payload: { rootNode: JSON.parse(JSON.stringify(prod)), compare: { targetNodeId: 'no-existe' } },
    });
    const err = figma.logs.find((m: any) => m.type === 'RENDER_ERROR');
    expect(err.error).toMatch(/ya no existe/);
  });
});

describe('QA de diseño: imágenes', () => {
  const trees: Record<string, any> = {};
  beforeAll(async () => {
    const page = await B.page('synthetic/qa-images.html');
    for (const id of ['design', 'prod-other', 'prod-none', 'prod-same'])
      trees[id] = (await extract(page, `document.getElementById('${id}')`)).rootNode;
    await page.context().close();
  });

  async function compare(prodId: string) {
    const figma = loadPlugin({}, quiet);
    await figma.ui.onmessage({ type: 'RENDER_NODES', payload: { rootNode: JSON.parse(JSON.stringify(trees.design)) } });
    const target = figma.currentPage.children[figma.currentPage.children.length - 1];
    target.name = 'Tarjeta';
    const before = figma.logs.length;
    await figma.ui.onmessage({
      type: 'RENDER_NODES',
      payload: { rootNode: JSON.parse(JSON.stringify(trees[prodId])), compare: { targetNodeId: target.id, width: 312 } },
    });
    const logs = figma.logs.slice(before);
    const report = figma.currentPage.children.find((n: any) => /^QA · /.test(n.name));
    const rows = (report?.children || []).filter((n: any) => n.type === 'TEXT').map((t: any) => t.characters);
    const prod = figma.currentPage.children.find((n: any) => n.name === 'Producción · Tarjeta');
    return { logs, all: rows.join('\n'), prod, success: logs.find((m: any) => m.type === 'RENDER_SUCCESS') };
  }
  const hasImageFill = (n: any): boolean =>
    (Array.isArray(n.fills) && n.fills.some((f: any) => f.type === 'IMAGE')) || (n.children || []).some(hasImageFill);

  it('la extracción trae las imágenes (no se quitan para comparar)', () => {
    expect(JSON.stringify(trees['prod-other'])).toMatch(/"imageData":"data:image\/png;base64,/);
  });

  it('otra imagen: proporción y ajuste distintos, y producción se dibuja con su imagen', async () => {
    const r = await compare('prod-other');
    expect(r.logs.filter((m: any) => m.type === 'RENDER_ERROR')).toEqual([]);
    expect(r.all).toMatch(/Imagen distinta: proporción 16:9 en producción, 4:3 en el diseño/);
    expect(r.all).toMatch(/Ajuste de la imagen: contener \(contain\) en producción, cubrir \(cover\) en el diseño/);
    // El envoltorio de producción no la convierte en "imagen de más"
    expect(r.all).not.toMatch(/Imagen en producción que no está en el diseño|Falta en producción/);
    expect(hasImageFill(r.prod)).toBe(true);
  });

  it('sin imagen en producción → se marca', async () => {
    const r = await compare('prod-none');
    expect(r.all).toMatch(/Imagen: el diseño tiene una imagen aquí y producción no|Falta en producción: una imagen/);
  });

  it('la misma imagen → sin diferencias', async () => {
    const r = await compare('prod-same');
    expect(r.all).not.toMatch(/[Ii]magen/);
    expect(r.success.qa.total).toBe(0);
  });
});

describe('selección de Figma: extensión → hub → plugin → extensión', () => {
  it('la extensión pregunta qué frame está seleccionado y recibe la respuesta del plugin', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ctf-qa-'));
    const hub = await startHub({ home });
    try {
      const code = fs.readFileSync(path.join(home, '.code-to-figma', 'pairing-code'), 'utf8').trim();
      const ext = await connectClient(hub.url);
      ext.send({ type: 'REGISTER_CLIENT', clientType: 'BROWSER_EXTENSION' });
      // Sin plugin: respuesta inmediata con error
      ext.send({ type: 'GET_FIGMA_SELECTION', requestId: 'r0' });
      expect((await ext.waitFor((m: any) => m.type === 'FIGMA_SELECTION' && m.requestId === 'r0')).error).toMatch(
        /no está abierto/,
      );

      const plugin = await connectClient(hub.url, 'null');
      plugin.send({ type: 'REGISTER_CLIENT', clientType: 'FIGMA_PLUGIN', pairingCode: code, protocol: HUB_PROTOCOL });
      await plugin.waitFor((m: any) => m.type === 'AUTH_OK');
      ext.send({ type: 'GET_FIGMA_SELECTION', requestId: 'r1' });
      const ask = await plugin.waitFor((m: any) => m.type === 'GET_FIGMA_SELECTION');
      expect(ask.requestId).toBe('r1');
      // Un cliente que no es el plugin no puede responder por él
      ext.send({
        type: 'FIGMA_SELECTION',
        requestId: 'r1',
        selection: { id: 'x', name: 'falso', type: 'FRAME', width: 1, height: 1 },
      });
      plugin.send({
        type: 'FIGMA_SELECTION',
        requestId: 'r1',
        selection: { id: '1:2', name: 'Tarjeta', type: 'FRAME', width: 320, height: 400 },
      });
      const got = await ext.waitFor((m: any) => m.type === 'FIGMA_SELECTION' && m.requestId === 'r1');
      expect(got.selection).toMatchObject({ id: '1:2', name: 'Tarjeta', width: 320 });
      plugin.close();
      ext.close();
    } finally {
      await hub.stop();
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  it('hub o plugin de una versión anterior: se dice qué reiniciar, sin esperar en vano', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ctf-qa-'));
    const hub = await startHub({ home });
    try {
      const code = fs.readFileSync(path.join(home, '.code-to-figma', 'pairing-code'), 'utf8').trim();
      const ext = await connectClient(hub.url);
      ext.send({ type: 'REGISTER_CLIENT', clientType: 'BROWSER_EXTENSION' });
      ext.send({ type: 'GET_STATUS' });
      const st0 = await ext.waitFor((m: any) => m.type === 'STATUS_RESPONSE');
      expect(st0.payload).toMatchObject({ protocol: HUB_PROTOCOL, pluginProtocol: 0 });

      // El plugin abierto desde antes de actualizar no anuncia versión
      const old = await connectClient(hub.url, 'null');
      old.send({ type: 'REGISTER_CLIENT', clientType: 'FIGMA_PLUGIN', pairingCode: code });
      await old.waitFor((m: any) => m.type === 'AUTH_OK');
      const t0 = Date.now();
      ext.send({ type: 'GET_FIGMA_SELECTION', requestId: 'v1' });
      const reply = await ext.waitFor((m: any) => m.type === 'FIGMA_SELECTION' && m.requestId === 'v1');
      expect(reply.error).toMatch(/plugin de Figma es de una versión anterior/);
      expect(Date.now() - t0).toBeLessThan(1500);
      old.close();
      ext.close();

      const ext2 = await connectClient(hub.url);
      ext2.send({ type: 'REGISTER_CLIENT', clientType: 'BROWSER_EXTENSION' });
      const fresh = await connectClient(hub.url, 'null');
      fresh.send({ type: 'REGISTER_CLIENT', clientType: 'FIGMA_PLUGIN', pairingCode: code, protocol: HUB_PROTOCOL });
      await fresh.waitFor((m: any) => m.type === 'AUTH_OK');
      ext2.send({ type: 'GET_STATUS' });
      const st1 = await ext2.waitFor((m: any) => m.type === 'STATUS_RESPONSE' && m.payload.figmaConnected);
      expect(st1.payload.pluginProtocol).toBe(HUB_PROTOCOL);
      fresh.close();
      ext2.close();
    } finally {
      await hub.stop();
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  it('el sandbox del plugin responde con el frame seleccionado', async () => {
    const figma = loadPlugin({}, quiet);
    await figma.ui.onmessage({ type: 'RENDER_NODES', payload: { rootNode: JSON.parse(JSON.stringify(design)) } });
    const node = figma.currentPage.children[figma.currentPage.children.length - 1];
    figma.currentPage.selection = [node];
    await figma.ui.onmessage({ type: 'GET_SELECTION', requestId: 'q1' });
    const info = figma.logs.find((m: any) => m.type === 'SELECTION_INFO');
    expect(info).toMatchObject({ requestId: 'q1', selection: { id: node.id, width: Math.round(node.width) } });
  });
});
