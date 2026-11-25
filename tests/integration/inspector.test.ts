// Inspector de la extensión (content.js + extractor.js) en una página real, con un stub de
// chrome.runtime que captura lo que se enviaría al hub.
import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import type { Page } from 'playwright';
import { useBrowser } from '../helpers/browser';

const require = createRequire(import.meta.url);
const { read } = require('../helpers/extension-sim.cjs');

const B = useBrowser({ width: 1440, height: 900 });

const PAGE = `<!doctype html><html><body style="margin:0;padding:24px;background:#f8fafc;font-family:Arial">
  <section id="cards" style="display:flex;gap:24px">
    <article class="card" id="c1" style="width:300px;height:200px;background:#000;color:#fff;padding:24px;border-radius:12px">
      <h2>Tarjeta uno</h2><p>Texto de ejemplo para seleccionar.</p></article>
    <article class="card" id="c2" style="width:300px;height:200px;background:#123;color:#fff;padding:24px;border-radius:12px">
      <h2>Tarjeta dos</h2><p>Otro texto de ejemplo.</p></article>
  </section>
</body></html>`;

async function openInspector(): Promise<Page> {
  const page = await B.page();
  await page.setContent(PAGE);
  await page.evaluate(() => {
    (window as any).__sent = [];
    (window as any).chrome = {
      runtime: {
        id: 'extension-de-prueba',
        lastError: null,
        sendMessage(m: any, cb: any) {
          if (m.type === 'TRANSMIT_TO_FIGMA') (window as any).__sent.push(m.payload);
          if (cb) cb({ success: true, status: { hubRunning: true, figmaConnected: true, figmaCount: 1 } });
        },
      },
    };
  });
  await page.evaluate(c => (0, eval)(c), read('packages/browser-extension/extractor.js'));
  await page.evaluate(c => (0, eval)(c), read('packages/browser-extension/content.js'));
  return page;
}

const center = (page: Page, sel: string) =>
  page.evaluate(s => {
    const r = document.querySelector(s)!.querySelector('p')!.getBoundingClientRect();
    return [r.left + 10, r.top + r.height / 2] as [number, number];
  }, sel);
const selectedIds = (page: Page) =>
  page.evaluate(() => (window as any).__codeToFigmaInstance.selectedElements.map((e: Element) => e.id));
const ctrl = process.platform === 'darwin' ? 'Meta' : 'Control';

describe('inspector de la extensión', () => {
  it('Ctrl/⌘ + clic suma y quita componentes; clic simple cierra', async () => {
    const page = await openInspector();
    const [p1, p2] = [await center(page, '#c1'), await center(page, '#c2')];
    const ctrlClick = async ([x, y]: [number, number]) => {
      await page.keyboard.down(ctrl);
      await page.mouse.click(x, y);
      await page.keyboard.up(ctrl);
      await page.waitForTimeout(200);
    };
    await ctrlClick(p1);
    expect(await selectedIds(page)).toEqual(['c1']);
    await ctrlClick(p2); // el segundo clic cae sobre el fondo de selección: antes cerraba todo
    expect(await selectedIds(page)).toEqual(['c1', 'c2']);
    await ctrlClick(p1);
    expect(await selectedIds(page)).toEqual(['c2']);
    await page.mouse.click(...p1);
    await page.waitForTimeout(200);
    expect(await selectedIds(page)).toEqual([]);
  });

  it('Shift + arrastre no produce selección de texto azul', async () => {
    const page = await openInspector();
    const [p1, p2] = [await center(page, '#c1'), await center(page, '#c2')];
    await page.mouse.move(...p1);
    await page.keyboard.down('Shift');
    await page.mouse.down();
    await page.mouse.move(p2[0], p2[1], { steps: 5 });
    await page.mouse.up();
    await page.keyboard.up('Shift');
    expect(await page.evaluate(() => window.getSelection()!.toString().length)).toBe(0);
  });

  it('la elevación visual no altera las medidas exportadas', async () => {
    const page = await openInspector();
    await page.evaluate(() => {
      const i = (window as any).__codeToFigmaInstance;
      const el = document.getElementById('c1');
      i.selectedElements = [el];
      i.elevateElements([el]);
    });
    await page.waitForTimeout(500);
    const lifted = await page.evaluate(() => document.getElementById('c1')!.getBoundingClientRect().width);
    expect(lifted).toBeGreaterThan(348); // escalado mientras está elevado
    await page.evaluate(() => (window as any).__codeToFigmaInstance.sendToFigma());
    const payload = await page.evaluate(() => (window as any).__sent[0]);
    expect(payload.rootNode.layout.measuredWidth).toBe(348); // 300 + 2·24 de padding, sin escala
    expect(payload.board).toBe(false);
    expect(payload.source.url).toBe('about:blank');
  });

  it('multi-selección y body se envían como tablero', async () => {
    const page = await openInspector();
    const boardFor = (ids: string[]) =>
      page.evaluate(
        ids =>
          (window as any).__codeToFigmaInstance.shouldBuildBoard(
            ids.map(id => (id === 'body' ? document.body : document.getElementById(id))),
          ),
        ids,
      );
    expect(await boardFor(['c1'])).toBe(false);
    expect(await boardFor(['c1', 'c2'])).toBe(true);
    expect(await boardFor(['body'])).toBe(true);
  });

  it('la barra se puede arrastrar y conserva su posición al cambiar de selección', async () => {
    const page = await openInspector();
    const p1 = await center(page, '#c1');
    await page.mouse.click(...p1);
    await page.waitForTimeout(300);
    const hudBox = () =>
      page.evaluate(() => {
        const r = (window as any).__codeToFigmaInstance.hud.getBoundingClientRect();
        return { top: Math.round(r.top), left: Math.round(r.left) };
      });
    const start = await hudBox();
    await page.mouse.move(start.left + 100, start.top + 15);
    await page.mouse.down();
    await page.mouse.move(250, 180, { steps: 5 });
    await page.mouse.up();
    const dragged = await hudBox();
    expect(Math.abs(dragged.top - start.top) + Math.abs(dragged.left - start.left)).toBeGreaterThan(100);
    await page.evaluate(() => (window as any).__codeToFigmaInstance.elevateParent());
    const after = await hudBox();
    expect(Math.abs(after.left - dragged.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.top - dragged.top)).toBeLessThanOrEqual(1);
  });

  it('selección pesada: avisa antes de enviar y respeta la opción elegida', async () => {
    const page = await openInspector();
    // Imagen real en la tarjeta y umbral forzado: así cualquier selección cuenta como pesada
    await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = c.height = 8;
      c.getContext('2d')!.fillRect(0, 0, 8, 8);
      const img = document.createElement('img');
      img.src = c.toDataURL('image/png');
      img.style.cssText = 'width:40px;height:40px;display:block';
      document.getElementById('c1')!.appendChild(img);
      (window as any).__codeToFigmaPayload.heavyPayloadReasons = () => ['prueba: demasiado grande'];
    });
    const choose = async (choice: string) => {
      const sending = page.evaluate(() => {
        const i = (window as any).__codeToFigmaInstance;
        const el = document.getElementById('c1');
        i.selectedElements = [el];
        i.isElevated = true;
        return i.sendToFigma();
      });
      await page.waitForFunction(() => (window as any).__codeToFigmaInstance.shadow.querySelector('.heavy-dialog'));
      const text = await page.evaluate(
        () => (window as any).__codeToFigmaInstance.shadow.querySelector('.heavy-dialog').textContent,
      );
      expect(text).toMatch(/prueba: demasiado grande/);
      if (choice === 'escape') await page.keyboard.press('Escape');
      else
        await page.evaluate(
          c => (window as any).__codeToFigmaInstance.shadow.querySelector(`[data-choice="${c}"]`).click(),
          choice,
        );
      await sending;
      return page.evaluate(() => (window as any).__sent.length);
    };
    const images = (n: any): number =>
      (n.imageData ? 1 : 0) + (n.children || []).reduce((a: number, c: any) => a + images(c), 0);

    expect(await choose('cancel')).toBe(0);
    expect(await choose('escape')).toBe(0);
    expect(
      await page.evaluate(() => (window as any).__codeToFigmaInstance.shadow.querySelector('.heavy-dialog')),
    ).toBeNull();

    expect(await choose('noimages')).toBe(1);
    const light = await page.evaluate(() => (window as any).__sent[0]);
    expect(images(light.rootNode)).toBe(0);

    expect(await choose('full')).toBe(2);
    const full = await page.evaluate(() => (window as any).__sent[1]);
    expect(images(full.rootNode)).toBe(1);
  });

  it('la elevación devuelve los estilos en línea que el elemento ya tenía, con su !important', async () => {
    const page = await openInspector();
    const before = await page.evaluate(() => {
      const el = document.getElementById('c1')!;
      el.style.setProperty('translate', '7px 3px', 'important');
      el.style.setProperty('scale', '0.9');
      el.style.setProperty('transition', 'opacity 1s');
      return el.style.cssText;
    });
    await page.evaluate(() => {
      const i = (window as any).__codeToFigmaInstance;
      const el = document.getElementById('c1');
      i.selectedElements = [el];
      i.elevateElements([el]);
    });
    await page.waitForTimeout(100);
    const lifted = await page.evaluate(() => document.getElementById('c1')!.style.translate);
    expect(lifted).not.toBe('7px 3px'); // elevado: la mutación existe mientras dura la selección
    await page.evaluate(() => (window as any).__codeToFigmaInstance.cancelElevation());
    const after = await page.evaluate(() => document.getElementById('c1')!.style.cssText);
    expect(after).toBe(before);
  });

  it('un componente con :hover en la hoja de estilos se envía con su estado Hover', async () => {
    const page = await openInspector();
    await page.addStyleTag({ content: '#c1:hover { background: rgb(200, 0, 0) !important; }' });
    const send = (ids: string[]) =>
      page.evaluate(async ids => {
        const i = (window as any).__codeToFigmaInstance;
        i.selectedElements = ids.map(id => document.getElementById(id));
        i.isElevated = true;
        await i.sendToFigma();
        return (window as any).__sent.at(-1);
      }, ids);
    const single = await send(['c1']);
    expect(single.states.map((st: any) => st.name)).toEqual(['Hover']);
    expect(single.states[0].rootNode.styles.fills[0]).toMatchObject({ r: 200 / 255, g: 0, b: 0 });
    // Sin reglas hover propias → sin estados; y nunca en tableros (varios componentes)
    expect((await send(['c2'])).states).toBeUndefined();
    expect((await send(['c1', 'c2'])).states).toBeUndefined();
  });

  it('QA-6: si la extensión se recarga, el inspector viejo avisa una vez y se retira (sin enviar nada)', async () => {
    const page = await openInspector();
    const logs: string[] = [];
    page.on('console', m => logs.push(m.text()));
    // otra inyección del extractor (nuevo clic en el ícono): el aviso de "ready" no se repite
    await page.evaluate(c => (0, eval)(c), read('packages/browser-extension/extractor.js'));
    expect(logs.filter(l => /Extractor Engine/.test(l))).toHaveLength(0);
    // la extensión se recarga: chrome.runtime.id desaparece en la copia vieja
    await page.evaluate(() => delete (window as any).chrome.runtime.id);
    await page.evaluate(async () => {
      const i = (window as any).__codeToFigmaInstance;
      i.selectedElements = [document.getElementById('c1')];
      i.isElevated = true;
      await i.sendToFigma();
    });
    expect(await page.evaluate(() => (window as any).__sent.length)).toBe(0);
    const toast = await page.evaluate(() => (window as any).__codeToFigmaInstance.shadow.textContent);
    expect(toast).toMatch(/La extensión se actualizó/);
  });

  it('barra del extractor: colapsa/expande y usa toggles propios sin checkbox nativo visible', async () => {
    const page = await openInspector();
    const p1 = await center(page, '#c1');
    await page.mouse.click(...p1);
    await page.waitForTimeout(250);

    const checkHidden = await page.evaluate(() => {
      const sh = (window as any).__codeToFigmaInstance.shadow;
      const inp = sh.querySelector('#__chk_component') as HTMLInputElement;
      const cs = getComputedStyle(inp);
      return { opacity: cs.opacity, hasCustomPill: !!sh.querySelector('.hud-toggle-pill') };
    });
    expect(checkHidden).toEqual({ opacity: '0', hasCustomPill: true });

    await page.evaluate(() =>
      (window as any).__codeToFigmaInstance.shadow.querySelector('#__btn_hud_collapse').click(),
    );
    expect(
      await page.evaluate(() =>
        (window as any).__codeToFigmaInstance.shadow.querySelector('.action-hud').classList.contains('collapsed'),
      ),
    ).toBe(true);

    // Envío directo desde la barra colapsada
    await page.evaluate(() =>
      (window as any).__codeToFigmaInstance.shadow.querySelector('#__btn_send_figma_mini').click(),
    );
    await page.waitForFunction(() => (window as any).__sent.length === 1);
  });
});
