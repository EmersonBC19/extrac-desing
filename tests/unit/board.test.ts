import { describe, expect, it } from 'vitest';
import * as B from '../../packages/figma-plugin/src/board/pure';

const text = (characters: string, fontSize = 16) => ({
  type: 'TEXT',
  name: 'Label',
  layout: {},
  styles: { fills: [{ r: 0, g: 0, b: 0, a: 1 }] },
  textData: { characters, fontSize, fontFamily: 'Inter', fontWeight: 400 },
});
const button = (label: string, color = { r: 0, g: 0.44, b: 0.89, a: 1 }, width = 171) => ({
  type: 'FRAME',
  name: `Link / ${label}`,
  layout: {
    mode: 'HORIZONTAL',
    measuredWidth: width,
    measuredHeight: 44,
    padding: { top: 11, right: 21, bottom: 11, left: 21 },
  },
  styles: { fills: [color], cornerRadius: 22 },
  children: [text(label)],
});
const card = (title: string, cta: string) => ({
  type: 'FRAME',
  name: 'Card / Container',
  layout: { mode: 'VERTICAL', measuredWidth: 300, measuredHeight: 200 },
  styles: { fills: [{ r: 1, g: 1, b: 1, a: 1 }] },
  children: [text(title, 24), button(cta)],
});
const page = (children: any[]) => ({
  type: 'FRAME',
  name: 'Página',
  layout: { mode: 'VERTICAL', measuredWidth: 1440, measuredHeight: 3000 },
  children,
});

describe('boardDetectComponents', () => {
  it('bloques repetidos con distinto texto → un componente con todas sus apariciones', () => {
    const groups = B.boardDetectComponents(page([button('Más información'), button('Comprar'), button('Ver ahora')]));
    expect(groups).toHaveLength(1);
    expect(groups[0].occurrences).toHaveLength(3);
  });

  it('el ancho no separa grupos (el texto cambia el ancho)', () => {
    const groups = B.boardDetectComponents(page([button('A', undefined, 100), button('Más largo', undefined, 220)]));
    expect(groups).toHaveLength(1);
  });

  it('distinto estilo (color) → componentes distintos', () => {
    const groups = B.boardDetectComponents(
      page([
        button('A'),
        button('B'),
        button('C', { r: 1, g: 1, b: 1, a: 1 }),
        button('D', { r: 1, g: 1, b: 1, a: 1 }),
      ]),
    );
    expect(groups).toHaveLength(2);
  });

  it('una sola aparición no es componente', () => {
    expect(B.boardDetectComponents(page([button('Solo')]))).toHaveLength(0);
  });

  it('gana el bloque más externo: la tarjeta, no el botón que lleva dentro', () => {
    const groups = B.boardDetectComponents(page([card('Uno', 'Ver'), card('Dos', 'Ver'), card('Tres', 'Ver')]));
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe('Card / Container');
    expect(groups[0].occurrences).toHaveLength(3);
  });

  it('marca cada aparición con el id de su grupo (__cg)', () => {
    const p = page([button('A'), button('B')]);
    const [g] = B.boardDetectComponents(p);
    expect(p.children.every((c: any) => c.__cg === g.id)).toBe(true);
  });

  it('las secciones enteras (>35 % del área) no se convierten en componentes; sus botones sí', () => {
    const big = () => ({ ...card('X', 'Y'), layout: { mode: 'VERTICAL', measuredWidth: 1440, measuredHeight: 1200 } });
    const p = page([big(), big()]);
    const groups = B.boardDetectComponents(p);
    expect(groups.some((g: any) => g.occurrences.includes(p.children[0]))).toBe(false);
    expect(groups).toHaveLength(1);
    expect(groups[0].occurrences.every((o: any) => o.name.startsWith('Link /'))).toBe(true);
  });
});

describe('boardCleanName', () => {
  it.each([
    ['Primer_Brand__Grid-module__Grid__column___bCyRk', 'Grid Column'],
    ['DataMarquee__block__3A2TYk', 'DataMarquee Block'],
    ['FeatureGrid__ctas__z74o0X', 'FeatureGrid Ctas'],
    ['Media-gallery-item theme-dark current', 'Media Gallery Item'],
    ['Button / Primary (Más información)', 'Button / Primary'],
    ['Input Group (Email)', 'Input Group'],
    ['Tile-ctas', 'Tile Ctas'],
  ])('%s → %s', (raw, expected) => {
    expect(B.boardCleanName(raw)).toBe(expected);
  });
});

describe('boardColorKey', () => {
  it('normaliza colores y transparencia', () => {
    expect(B.boardColorKey({ r: 1, g: 0, b: 0, a: 1 })).toBe('#ff0000');
    expect(B.boardColorKey({ r: 0, g: 0, b: 0, a: 0.5 })).toBe('#000000/50');
  });
});

describe('variantes (fase 6.1)', () => {
  it('mismo componente en distintos tamaños → familia Size=L/M/S ordenada por área', () => {
    const groups = [
      { id: 'a', name: 'Tile Ctas', occurrences: [button('x', undefined, 171)] },
      { id: 'b', name: 'Tile Ctas 2', occurrences: [button('y', undefined, 300)] },
      { id: 'c', name: 'Tile Ctas 3', occurrences: [button('z', undefined, 120)] },
    ];
    const [fam] = B.boardVariantFamilies(groups);
    expect(fam).toMatchObject({ name: 'Tile Ctas', property: 'Size' });
    expect(Object.fromEntries(fam.members.map(m => [m.groupId, m.value]))).toEqual({ a: 'M', b: 'L', c: 'S' });
  });

  it('mismo tamaño y distinto color → Style con el color', () => {
    const groups = [
      { id: 'a', name: 'Link', occurrences: [button('x', { r: 0, g: 0.44, b: 0.89, a: 1 })] },
      { id: 'b', name: 'Link 2', occurrences: [button('y', { r: 0, g: 0, b: 0, a: 1 })] },
    ];
    const [fam] = B.boardVariantFamilies(groups);
    expect(fam.property).toBe('Style');
    expect(fam.members.map(m => m.value)).toEqual(['#0070e3', '#000000']);
  });

  it('nombres distintos o estructura distinta → no son variantes', () => {
    expect(
      B.boardVariantFamilies([
        { id: 'a', name: 'Link', occurrences: [button('x')] },
        { id: 'b', name: 'Card', occurrences: [button('y', undefined, 300)] },
      ]),
    ).toEqual([]);
    expect(
      B.boardVariantFamilies([
        { id: 'a', name: 'Card', occurrences: [card('t', 'c')] },
        { id: 'b', name: 'Card 2', occurrences: [button('y')] },
      ]),
    ).toEqual([]);
  });
});

describe('paleta: colores casi iguales (fase 6.3)', () => {
  const hex = (h: string) => ({
    r: parseInt(h.slice(1, 3), 16) / 255,
    g: parseInt(h.slice(3, 5), 16) / 255,
    b: parseInt(h.slice(5, 7), 16) / 255,
  });
  it('ΔE: blanco/negro ≈ 100, casi iguales < 2,3', () => {
    expect(B.deltaE(hex('#ffffff'), hex('#000000'))).toBeCloseTo(100, 0);
    expect(B.deltaE(hex('#1a1a1f'), hex('#1b1a1f'))).toBeLessThan(2.3);
    expect(B.deltaE(hex('#0071e3'), hex('#0066cc'))).toBeGreaterThan(2.3);
  });

  it('une los que el ojo no distingue; el más usado representa al grupo', () => {
    const e = (h: string, n: number, alpha = 1) => ({
      color: hex(h),
      alpha,
      items: Array.from({ length: n }, (_, i) => h + i),
    });
    const out = B.boardMergeSimilarColors([e('#1b1a1f', 2), e('#1a1a1f', 10), e('#0071e3', 5), e('#1a1a1f', 3, 0.5)]);
    expect(out).toHaveLength(3);
    expect(out[0].items).toHaveLength(12);
    expect(out[0].color).toEqual(hex('#1a1a1f'));
    expect(out.find(g => g.alpha === 0.5)!.items).toHaveLength(3); // otra opacidad: aparte
  });
});
