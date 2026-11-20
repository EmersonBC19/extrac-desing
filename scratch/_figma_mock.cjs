// Simulador de la API de Figma: lo suficiente para ejecutar el plugin fuera de Figma y detectar
// errores de ejecución. Reproduce restricciones reales que suelen romper plugins:
//  - editar un texto exige su fuente cargada
//  - layoutSizing 'FILL' exige padre con Auto Layout
//  - createInstance solo en COMPONENT; appendChild mueve el nodo de su padre anterior
const vm = require('vm');
const fs = require('fs');

function createFigma(opts = {}) {
  const MIXED = Symbol('mixed');
  let idc = 0;
  const loaded = new Set();
  const fk = f => f.family + '|' + f.style;
  const logs = [];
  const styles = { text: [], paint: [] };
  const byId = new Map();
  let current;

  class Node {
    constructor(type) {
      this.type = type; this.id = 'n' + (++idc); this.name = type;
      this.x = 0; this.y = 0; this.width = 100; this.height = 100;
      this.parent = null; this.removed = false; this.visible = true;
      this.fills = (type === 'FRAME' || type === 'COMPONENT') ? [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }] : [];
      this.strokes = []; this.effects = []; this.layoutMode = 'NONE'; this.clipsContent = true;
      byId.set(this.id, this);
      if (['FRAME', 'COMPONENT', 'INSTANCE', 'PAGE', 'SECTION', 'GROUP'].includes(type)) this.children = [];
    }
    appendChild(c) {
      if (!this.children) throw new Error(this.type + ' no admite hijos');
      if (c.parent) { const i = c.parent.children.indexOf(c); if (i >= 0) c.parent.children.splice(i, 1); }
      this.children.push(c); c.parent = this;
    }
    insertChild(_i, c) { this.appendChild(c); }
    resize(w, h) {
      if (!(w >= 0.01 && h >= 0.01)) throw new Error('resize inválido ' + w + 'x' + h);
      this.width = w; this.height = h;
    }
    resizeWithoutConstraints(w, h) { this.resize(w, h); }
    remove() {
      if (this.parent) { const i = this.parent.children.indexOf(this); if (i >= 0) this.parent.children.splice(i, 1); }
      this.parent = null; this.removed = true;
    }
    findAll(pred) {
      const out = [];
      (function w(n) { for (const c of n.children || []) { if (!pred || pred(c)) out.push(c); w(c); } })(this);
      return out;
    }
    clone() {
      const c = Object.create(Object.getPrototypeOf(this));
      Node.call ? null : null;
      c.id = 'n' + (++idc); byId.set(c.id, c);
      for (const k of Object.keys(this)) {
        if (['id', 'parent', 'children'].includes(k)) continue;
        c[k] = (Array.isArray(this[k]) || (this[k] && typeof this[k] === 'object' && k !== '_master')) ? JSON.parse(JSON.stringify(this[k])) : this[k];
      }
      c.parent = null;
      if (this.children) { c.children = []; for (const ch of this.children) c.appendChild(ch.clone()); }
      current.appendChild(c);
      return c;
    }
    createInstance() {
      if (this.type !== 'COMPONENT') throw new Error('createInstance en ' + this.type);
      const c = this.clone(); c.type = 'INSTANCE'; c._master = this; return c;
    }
    set layoutSizingHorizontal(v) {
      if (v === 'FILL' && !(this.parent && this.parent.layoutMode && this.parent.layoutMode !== 'NONE')) throw new Error('FILL sin padre Auto Layout');
      this._lsh = v;
    }
    get layoutSizingHorizontal() { return this._lsh || 'FIXED'; }
    set layoutSizingVertical(v) {
      if (v === 'FILL' && !(this.parent && this.parent.layoutMode && this.parent.layoutMode !== 'NONE')) throw new Error('FILL sin padre Auto Layout');
      this._lsv = v;
    }
    get layoutSizingVertical() { return this._lsv || 'FIXED'; }
  }

  class TextNode extends Node {
    constructor() {
      super('TEXT');
      this._fontName = { family: 'Inter', style: 'Regular' }; this._chars = ''; this._fontSize = 12;
      this.lineHeight = { unit: 'AUTO' }; this.textAutoResize = 'NONE';
      this.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
    }
    _need() { if (!loaded.has(fk(this._fontName))) throw new Error('Fuente no cargada: ' + fk(this._fontName)); }
    get fontName() { return this._fontName; }
    set fontName(f) { if (!loaded.has(fk(f))) throw new Error('fontName sin cargar: ' + fk(f)); this._fontName = f; }
    get characters() { return this._chars; }
    set characters(v) {
      this._need(); this._chars = v;
      this.width = Math.max(1, Math.max(...v.split('\n').map(l => l.length)) * this._fontSize * 0.5);
      this.height = this._fontSize * 1.2 * v.split('\n').length;
    }
    get fontSize() { return this._fontSize; }
    set fontSize(v) { this._need(); this._fontSize = v; }
    getRangeAllFontNames() { return [this._fontName]; }
    setRangeFontName(_s, _e, f) { if (!loaded.has(fk(f))) throw new Error('setRangeFontName sin cargar'); }
    setRangeFontSize() { this._need(); }
    setRangeFills() {}
    setRangeTextDecoration() { this._need(); }
    set textStyleId(id) { if (!styles.text.find(s => s.id === id)) throw new Error('textStyleId inexistente'); this._ts = id; }
    get textStyleId() { return this._ts || ''; }
  }

  const page0 = new Node('PAGE'); page0.name = 'Page 1'; page0.selection = [];
  const root = { children: [page0] };
  for (let i = 1; i < (opts.initialPages || 1); i++) { const pg = new Node('PAGE'); pg.name = 'Page ' + (i + 1); pg.selection = []; root.children.push(pg); }
  current = page0;
  for (const pn of (opts.preNodes || [])) { const n = new Node('FRAME'); n.name = pn.name || 'Previo'; n.x = pn.x; n.y = pn.y; n.width = pn.w; n.height = pn.h; page0.appendChild(n); }

  const add = n => { current.appendChild(n); return n; };
  const figma = {
    mixed: MIXED, root, logs, styles, byId,
    get currentPage() { return current; },
    set currentPage(p) { current = p; },
    showUI() {}, on() {},
    ui: { postMessage: m => logs.push(m), onmessage: null },
    viewport: { center: { x: 0, y: 0 }, scrollAndZoomIntoView() {} },
    listAvailableFontsAsync: async () => ['Regular', 'Bold', 'Semi Bold', 'Medium', 'Light', 'Black', 'Extra Bold']
      .map(style => ({ fontName: { family: 'Inter', style } })),
    loadFontAsync: async f => { if (f.family !== 'Inter') throw new Error('no instalada ' + f.family); loaded.add(fk(f)); },
    createText: () => { if (!loaded.has('Inter|Regular')) throw new Error('Inter Regular no cargada'); return add(new TextNode()); },
    createFrame: () => add(new Node('FRAME')),
    createComponent: () => add(new Node('COMPONENT')),
    createRectangle: () => add(new Node('RECTANGLE')),
    createSection: () => { if (opts.failSection) throw new Error('fallo simulado en createSection'); const n = new Node('SECTION'); n.fills = []; return add(n); },
    createPage: () => { if (opts.maxPages && root.children.length >= opts.maxPages) throw new Error('Starter plan: max ' + opts.maxPages + ' pages'); const p = new Node('PAGE'); p.selection = []; p.remove = function () { const i = root.children.indexOf(this); if (i >= 0) root.children.splice(i, 1); this.removed = true; }; root.children.push(p); return p; },
    createNodeFromSvg: () => add(new Node('FRAME')),
    createImage: bytes => { if (!bytes || !bytes.length) throw new Error('imagen vacía'); return { hash: 'h' + bytes.length }; },
    createTextStyle: () => {
      const s = { id: 'ts' + styles.text.length, name: '',
        set fontName(f) { if (!loaded.has(fk(f))) throw new Error('estilo con fuente sin cargar'); this._f = f; },
        get fontName() { return this._f; } };
      styles.text.push(s); return s;
    },
    createPaintStyle: () => { const s = { id: 'ps' + styles.paint.length, name: '', paints: [] }; styles.paint.push(s); return s; },
    getLocalPaintStyles: () => styles.paint,
    getNodeById: id => byId.get(id) || null,
  };
  return figma;
}

async function runPlugin(payload, opts) {
  const figma = createFigma(opts);
  const ctx = { figma, __html__: '', console, setTimeout, clearTimeout, URL, Promise, Uint8Array, Date, Math, JSON, Map, Set, Symbol };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('packages/figma-plugin/dist/code.js', 'utf8'), ctx);
  await figma.ui.onmessage({ type: 'RENDER_NODES', payload });
  return figma;
}

module.exports = { runPlugin };
