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
