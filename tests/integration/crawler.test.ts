// El crawler (core-extractor) usa EXACTAMENTE el mismo extractor que la extensión.
// Antes tenía su propia copia (dom-to-node.ts) sin ninguna de las mejoras.
import { afterAll, describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import { BrowserExtractor, getBrowserExtractorScript } from '../../packages/core-extractor/dist/index.js';
import { fixture } from '../helpers/browser';

const require = createRequire(import.meta.url);
const { read } = require('../helpers/extension-sim.cjs');
const { auditLayout } = require('../helpers/layout-audit.cjs');

const extractor = new BrowserExtractor();
afterAll(async () => {
  await extractor.close();
});

describe('crawler (BrowserExtractor) con el extractor unificado', () => {
  it('inyecta el mismo archivo que carga la extensión', () => {
    expect(getBrowserExtractorScript().replace(/\r\n/g, '\n')).toBe(read('packages/browser-extension/extractor.js'));
  });

  it('produce el layout corregido (geometría medida), no el del extractor viejo', async () => {
    const root: any = await extractor.extractFromUrl({
      url: fixture('synthetic/layout.html'),
      selector: '#root',
      viewport: { width: 1440, height: 900 },
    });
    const audit = auditLayout(root);
    expect(audit.children).toBeGreaterThan(0);
    expect(audit.misplaced).toBe(0);
    const icon = root.children.find((c: any) => c.layout?.measuredWidth === 50 && c.layout?.measuredHeight === 50);
    expect(icon.layout.counterAxisAlignItems).toBe('CENTER');
  });

  it('texto enriquecido y superíndices también en el crawler', async () => {
    const root: any = await extractor.extractFromUrl({
      url: fixture('synthetic/text.html'),
      selector: '#inline',
      viewport: { width: 1440, height: 900 },
    });
    expect(root.type).toBe('TEXT');
    expect(root.textData.characters.endsWith('wearable.¹')).toBe(true);
  });

  it('extrae desde HTML en memoria', async () => {
    const root: any = await extractor.extractFromUrl({
      htmlContent:
        '<div id="x" style="display:flex;gap:8px"><b style="width:40px;height:20px;background:red"></b><b style="width:40px;height:20px;background:blue"></b></div>',
      selector: '#x',
    });
    expect(root.layout).toMatchObject({ mode: 'HORIZONTAL', itemSpacing: 8 });
  });
});
