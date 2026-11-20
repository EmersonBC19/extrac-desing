import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import { useBrowser } from '../helpers/browser';

const require = createRequire(import.meta.url);
const { extract, flatten, imageDimensions } = require('../helpers/extension-sim.cjs');

const B = useBrowser({ width: 1440, height: 900 });
const ROOT = "document.getElementById('root')";

describe('imágenes (synthetic/index.html)', () => {
  it('extrae todas las imágenes y todas cumplen los límites de Figma', async () => {
    const page = await B.page('synthetic/index.html');
    const { rootNode, stats } = await extract(page, ROOT);
    const dims = await imageDimensions(page, rootNode);
    expect(dims).toHaveLength(15);
    expect(stats.failed).toBe(0);
    for (const d of dims) {
      expect(d.ok).toBe(true);
      expect(['image/png', 'image/jpeg', 'image/gif']).toContain(d.mime); // WebP/SVG convertidos
      expect(Math.max(d.w, d.h)).toBeLessThanOrEqual(4096); // 5000 px reducido
    }
    // El hero de 5000 px se reduce, no se descarta
    expect(dims.some((d: any) => d.w === 4096)).toBe(true);
  });

  it('carrusel tipo Swiper: las 5 slides, la pista desplazada y el visor recortando', async () => {
    const page = await B.page('synthetic/index.html');
    const { rootNode } = await extract(page, "document.getElementById('swiper')");
    expect(rootNode.clipsContent).toBe(true);
    const track = rootNode.children[0];
    expect(track.layout.mode).toBe('NONE');
    expect(track.layout.x).toBe(-800);
    expect(track.children).toHaveLength(5);
    expect(track.children.every((s: any) => s.imageData)).toBe(true);
  });

  it('carrusel con scroll-snap: las 4 tarjetas, incluida la que queda fuera de la vista', async () => {
    const page = await B.page('synthetic/index.html');
    const { rootNode } = await extract(page, "document.getElementById('snap')");
    expect(rootNode.children).toHaveLength(4);
    expect(rootNode.children.every((c: any) => c.imageData)).toBe(true);
  });

  it('carrusel fade: solo la slide visible', async () => {
    const page = await B.page('synthetic/index.html');
    const { rootNode } = await extract(page, "document.getElementById('fade')");
    const imgs = flatten(rootNode).filter((x: any) => x.node.imageData);
    expect(imgs).toHaveLength(1);
  });

  it('imagen lazy (data-src con placeholder GIF) se resuelve a la imagen real', async () => {
    const page = await B.page('synthetic/index.html');
    const { rootNode } = await extract(page, "document.querySelectorAll('#swiper .slide')[4]");
    const img = flatten(rootNode).find((x: any) => x.node.imageData)!.node;
    expect(img.imageData).not.toMatch(/^data:image\/gif/);
  });

  it('degradado sobre imagen: conserva color base, imagen y degradado', async () => {
    const page = await B.page('synthetic/index.html');
    const { rootNode } = await extract(page, "document.querySelector('.hero')");
    expect(rootNode.imageData).toBeTruthy();
    const types = rootNode.styles.fills.map((f: any) => f.type || 'SOLID');
    expect(types).toContain('SOLID');
    expect(types).toContain('GRADIENT_LINEAR');
  });

  it('icono en ::before y video con póster', async () => {
    const page = await B.page('synthetic/index.html');
    const ico = await extract(page, "document.querySelector('.ico')");
    expect(flatten(ico.rootNode).some((x: any) => x.node.name === 'Image / Before' && x.node.imageData)).toBe(true);
    const video = await extract(page, "document.querySelector('video')");
    expect(video.rootNode.imageData).toBeTruthy();
  });
});

describe('captura de pantalla para lo que el DOM no entrega (synthetic/shot.html)', () => {
  it('iframe y canvas WebGL salen como imagen', async () => {
    const page = await B.page('synthetic/shot.html');
    const { rootNode } = await extract(page, ROOT);
    const media = flatten(rootNode)
      .map((x: any) => x.node)
      .filter((n: any) => /^(Embed|Chart)/.test(n.name));
    expect(media).toHaveLength(2);
    expect(media.every((n: any) => n.imageData)).toBe(true);
  });
});

describe('páginas largas (synthetic/long.html)', () => {
  /** Color del centro de una imagen dataURL, decodificada en el navegador */
  const centerColor = (page: any, uri: string) =>
    page.evaluate(async (src: string) => {
      const im = new Image();
      im.src = src;
      await im.decode();
      const c = document.createElement('canvas');
      c.width = im.naturalWidth;
      c.height = im.naturalHeight;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(im, 0, 0);
      const d = ctx.getImageData(c.width >> 1, c.height >> 1, 1, 1).data;
      return [d[0], d[1], d[2]];
    }, uri);
  const near = (rgb: number[], hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    const ref = [n >> 16, (n >> 8) & 255, n & 255];
    return rgb.every((v, i) => Math.abs(v - ref[i]) < 24);
  };

  it('captura los iframes fuera de la pantalla, sin el header fijo encima, y deja la página como estaba', async () => {
    const page = await B.page('synthetic/long.html');
    const { rootNode } = await extract(page, ROOT);
    const embeds = flatten(rootNode)
      .map((x: any) => x.node)
      .filter((n: any) => /^Embed/.test(n.name));
    expect(embeds).toHaveLength(3);
    expect(embeds.every((n: any) => n.imageData)).toBe(true);
    // Cada captura es la de su iframe (no la de otra franja ni la del header rojo)
    expect(near(await centerColor(page, embeds[0].imageData), '#2563eb')).toBe(true);
    expect(near(await centerColor(page, embeds[1].imageData), '#16a34a')).toBe(true);
    expect(near(await centerColor(page, embeds[2].imageData), '#f59e0b')).toBe(true);
    // El header fijo vuelve a verse y el scroll vuelve a donde estaba
    const after = await page.evaluate(() => ({
      header: getComputedStyle(document.getElementById('bar')!).visibility,
      inline: document.getElementById('bar')!.style.visibility,
      top: Math.round(document.getElementById('root')!.getBoundingClientRect().top),
    }));
    expect(after).toEqual({ header: 'visible', inline: '', top: 0 });
  }, 30_000);

  it('una hoja a más de 12 000 px de su contenedor ya no se descarta', async () => {
    const page = await B.page('synthetic/long.html');
    const { rootNode } = await extract(page, "document.getElementById('tall')");
    const leaves = flatten(rootNode).filter((x: any) => x.node !== rootNode);
    expect(leaves).toHaveLength(1);
    expect(leaves[0].node.layout.y).toBe(13000);
  });
});
