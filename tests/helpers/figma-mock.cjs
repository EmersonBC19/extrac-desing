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
      this.type = type;
      this.id = 'n' + ++idc;
      this.name = type;
      this.x = 0;
      this.y = 0;
      this.width = 100;
      this.height = 100;
      this.parent = null;
      this.removed = false;
      this.visible = true;
      this.fills = type === 'FRAME' || type === 'COMPONENT' ? [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }] : [];
      this.strokes = [];
      this.effects = [];
      this.layoutMode = 'NONE';
      this.layoutPositioning = 'AUTO';
      this.clipsContent = true;
      byId.set(this.id, this);
      if (['FRAME', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE', 'PAGE', 'SECTION', 'GROUP'].includes(type))
        this.children = [];
    }
    async setFillStyleIdAsync(id) {
      if (!styles.paint.find(s => s.id === id)) throw new Error('fillStyleId inexistente');
      this._fs = id;
    }
    set fillStyleId(id) {
      if (opts.dynamicPage) throw new Error('dynamic-page: fillStyleId síncrono no permitido, usa setFillStyleIdAsync');
      if (!styles.paint.find(s => s.id === id)) throw new Error('fillStyleId inexistente');
      this._fs = id;
    }
    get fillStyleId() {
      return this._fs || '';
    }
    appendChild(c) {
      if (!this.children) throw new Error(this.type + ' no admite hijos');
      if (c.parent) {
        const i = c.parent.children.indexOf(c);
        if (i >= 0) c.parent.children.splice(i, 1);
      }
      this.children.push(c);
      c.parent = this;
    }
    insertChild(i, c) {
      // opts.failInsertInstance: simula un fallo de Figma al colocar una instancia (QA-7)
      if (opts.failInsertInstance && c.type === 'INSTANCE') throw new Error('fallo simulado en insertChild');
      this.appendChild(c);
      // Como Figma: queda en la posición pedida dentro de children
      this.children.splice(this.children.indexOf(c), 1);
      this.children.splice(Math.max(0, Math.min(i, this.children.length)), 0, c);
    }
    resize(w, h) {
      if (this.type === 'LINE') {
        this.width = Math.max(0.01, w);
        this.height = Math.max(0, h);
        return;
      }
      if (!(w >= 0.01 && h >= 0.01)) throw new Error('resize inválido ' + w + 'x' + h);
      this.width = w;
      this.height = h;
    }
    resizeWithoutConstraints(w, h) {
      this.resize(w, h);
    }
    remove() {
      if (this.parent) {
        const i = this.parent.children.indexOf(this);
        if (i >= 0) this.parent.children.splice(i, 1);
      }
      this.parent = null;
      this.removed = true;
    }
    findAll(pred) {
      const out = [];
      (function w(n) {
        for (const c of n.children || []) {
          if (!pred || pred(c)) out.push(c);
          w(c);
        }
      })(this);
      return out;
    }
    clone() {
      const c = Object.create(Object.getPrototypeOf(this));
      c.id = 'n' + ++idc;
      byId.set(c.id, c);
      for (const k of Object.keys(this)) {
        if (['id', 'parent', 'children'].includes(k)) continue;
        c[k] =
          Array.isArray(this[k]) || (this[k] && typeof this[k] === 'object' && k !== '_master')
            ? JSON.parse(JSON.stringify(this[k]))
            : this[k];
      }
      c.parent = null;
      if (this.children) {
        c.children = [];
        for (const ch of this.children) c.appendChild(ch.clone());
      }
      current.appendChild(c);
      return c;
    }
    set cornerRadius(v) {
      this._cr = v;
      if (typeof v === 'number')
        this.topLeftRadius = this.topRightRadius = this.bottomLeftRadius = this.bottomRightRadius = v;
    }
    get cornerRadius() {
      return this._cr ?? 0;
    }
    setBoundVariable(field, variable) {
      const NUM = [
        'itemSpacing',
        'paddingTop',
        'paddingRight',
        'paddingBottom',
        'paddingLeft',
        'topLeftRadius',
        'topRightRadius',
        'bottomLeftRadius',
        'bottomRightRadius',
        'width',
        'height',
        'counterAxisSpacing',
      ];
      if (!NUM.includes(field)) throw new Error('setBoundVariable: campo no vinculable ' + field);
      if (variable.resolvedType !== 'FLOAT') throw new Error('setBoundVariable: ' + field + ' necesita FLOAT');
      this.boundVariables = { ...(this.boundVariables || {}), [field]: { type: 'VARIABLE_ALIAS', id: variable.id } };
      this[field] = variable._values[Object.keys(variable._values)[0]];
    }
    // Modo de una colección de Variables fijado en este nodo (vista Dark de los breakpoints)
    setExplicitVariableModeForCollection(collection, modeId) {
      const id = typeof collection === 'string' ? collection : collection && collection.id;
      if (!id) throw new Error('setExplicitVariableModeForCollection: colección inválida');
      const col = collection && collection.modes ? collection : null;
      if (col && !col.modes.some(m => m.modeId === modeId)) throw new Error('modo inexistente ' + modeId);
      this.explicitVariableModes = { ...(this.explicitVariableModes || {}), [id]: modeId };
    }
    createInstance() {
      if (this.type !== 'COMPONENT') throw new Error('createInstance en ' + this.type);
      const c = this.clone();
      c.type = 'INSTANCE';
      c._master = this;
      return c;
    }
    set layoutSizingHorizontal(v) {
      if (v === 'FILL' && !(this.parent && this.parent.layoutMode && this.parent.layoutMode !== 'NONE'))
        throw new Error('FILL sin padre Auto Layout');
      this._lsh = v;
    }
    get layoutSizingHorizontal() {
      return this._lsh || 'FIXED';
    }
    set layoutSizingVertical(v) {
      if (v === 'FILL' && !(this.parent && this.parent.layoutMode && this.parent.layoutMode !== 'NONE'))
        throw new Error('FILL sin padre Auto Layout');
      this._lsv = v;
    }
    get layoutSizingVertical() {
      return this._lsv || 'FIXED';
    }
  }

  class TextNode extends Node {
    constructor() {
      super('TEXT');
      // Como en Figma: un texto recién creado (vacío, Inter 12) mide 0 × ~15
      this.width = 0;
      this.height = 15;
      this._fontName = { family: 'Inter', style: 'Regular' };
      this._chars = '';
      this._fontSize = 12;
      this.lineHeight = { unit: 'AUTO' };
      this.textAutoResize = 'NONE';
      this.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
    }
    _need() {
      if (!loaded.has(fk(this._fontName))) throw new Error('Fuente no cargada: ' + fk(this._fontName));
    }
    get fontName() {
      return this._fontName;
    }
    set fontName(f) {
      if (!loaded.has(fk(f))) throw new Error('fontName sin cargar: ' + fk(f));
      this._fontName = f;
    }
    get characters() {
      return this._chars;
    }
    set characters(v) {
      this._need();
      this._chars = v;
      // opts.brokenFamilies: fuentes que se listan y "cargan" pero Figma no maqueta (visto con SF Pro
      // en Windows): el texto conserva el tamaño de vacío y no se pinta
      if ((opts.brokenFamilies || []).includes(this._fontName.family)) return;
      this.width = Math.max(1, Math.max(...v.split('\n').map(l => l.length)) * this._fontSize * 0.5);
      this.height = this._fontSize * 1.2 * v.split('\n').length;
    }
    get fontSize() {
      return this._fontSize;
    }
    set fontSize(v) {
      this._need();
      this._fontSize = v;
      // el ancho aproximado depende del tamaño (como en Figma con textAutoResize)
      if (this._chars) this.characters = this._chars;
    }
    getRangeAllFontNames() {
      return [this._fontName];
    }
    setRangeFontName(_s, _e, f) {
      if (!loaded.has(fk(f))) throw new Error('setRangeFontName sin cargar');
    }
    setRangeFontSize() {
      this._need();
    }
    setRangeFills() {}
    setRangeTextDecoration() {
      this._need();
    }
    async setTextStyleIdAsync(id) {
      if (!styles.text.find(s => s.id === id)) throw new Error('textStyleId inexistente');
      this._ts = id;
    }
    set textStyleId(id) {
      if (opts.dynamicPage) throw new Error('dynamic-page: textStyleId síncrono no permitido, usa setTextStyleIdAsync');
      if (!styles.text.find(s => s.id === id)) throw new Error('textStyleId inexistente');
      this._ts = id;
    }
    get textStyleId() {
      return this._ts || '';
    }
  }

  const page0 = new Node('PAGE');
  page0.name = 'Page 1';
  page0.selection = [];
  const root = { children: [page0] };
  for (let i = 1; i < (opts.initialPages || 1); i++) {
    const pg = new Node('PAGE');
    pg.name = 'Page ' + (i + 1);
    pg.selection = [];
    root.children.push(pg);
  }
  current = page0;
  for (const pn of opts.preNodes || []) {
    const n = new Node('FRAME');
    n.name = pn.name || 'Previo';
    n.x = pn.x;
    n.y = pn.y;
    n.width = pn.w;
    n.height = pn.h;
    page0.appendChild(n);
  }

  const add = n => {
    current.appendChild(n);
    return n;
  };
  const figma = {
    mixed: MIXED,
    root,
    logs,
    styles,
    byId,
    get currentPage() {
      return current;
    },
    set currentPage(p) {
      if (opts.dynamicPage) throw new Error('dynamic-page: figma.currentPage = ... síncrono no permitido, usa setCurrentPageAsync');
      current = p;
    },
    setCurrentPageAsync: async p => {
      current = p;
    },
    loadAllPagesAsync: async () => {},
    showUI() {},
    on() {},
    ui: { postMessage: m => logs.push(m), onmessage: null },
    viewport: { center: { x: 0, y: 0 }, scrollAndZoomIntoView() {} },
    // opts.families: familias "instaladas" (por defecto solo Inter)
    listAvailableFontsAsync: async () =>
      (opts.families || ['Inter']).flatMap(family =>
        ['Regular', 'Bold', 'Semi Bold', 'Medium', 'Light', 'Black', 'Extra Bold'].map(style => ({
          fontName: { family, style },
        })),
      ),
    loadFontAsync: async f => {
      if (!(opts.families || ['Inter']).includes(f.family)) throw new Error('no instalada ' + f.family);
      loaded.add(fk(f));
    },
    createText: () => {
      if (!loaded.has('Inter|Regular')) throw new Error('Inter Regular no cargada');
      return add(new TextNode());
    },
    createFrame: () => add(new Node('FRAME')),
    createComponent: () => add(new Node('COMPONENT')),
    createRectangle: () => add(new Node('RECTANGLE')),
    createLine: () => add(new Node('LINE')),
    createSection: () => {
      if (opts.failSection) throw new Error('fallo simulado en createSection');
      const n = new Node('SECTION');
      n.fills = [];
      return add(n);
    },
    createPage: () => {
      if (opts.maxPages && root.children.length >= opts.maxPages)
        throw new Error('Starter plan: max ' + opts.maxPages + ' pages');
      const p = new Node('PAGE');
      p.selection = [];
      p.remove = function () {
        const i = root.children.indexOf(this);
        if (i >= 0) root.children.splice(i, 1);
        this.removed = true;
      };
      root.children.push(p);
      return p;
    },
    createNodeFromSvg: () => add(new Node('FRAME')),
    createImage: bytes => {
      if (!bytes || !bytes.length) throw new Error('imagen vacía');
      return { hash: 'h' + bytes.length };
    },
    createTextStyle: () => {
      const s = {
        id: 'ts' + styles.text.length,
        name: '',
        set fontName(f) {
          if (!loaded.has(fk(f))) throw new Error('estilo con fuente sin cargar');
          this._f = f;
        },
        get fontName() {
          return this._f;
        },
      };
      styles.text.push(s);
      return s;
    },
    createPaintStyle: () => {
      const s = { id: 'ps' + styles.paint.length, name: '', paints: [] };
      styles.paint.push(s);
      return s;
    },
    getLocalPaintStyles: () => {
      if (opts.dynamicPage) throw new Error('dynamic-page: getLocalPaintStyles síncrono no permitido, usa getLocalPaintStylesAsync');
      return styles.paint;
    },
    getLocalPaintStylesAsync: async () => styles.paint,
    getNodeById: id => {
      if (opts.dynamicPage) throw new Error('dynamic-page: getNodeById síncrono no permitido, usa getNodeByIdAsync');
      return byId.get(id) || null;
    },
    getNodeByIdAsync: async id => byId.get(id) || null,
    // Como en Figma: solo componentes, nombres "Propiedad=Valor" y sin repetir combinación
    // Variables (fase 6.2). opts.noVariables: archivo/plan sin Variables
    variables: opts.noVariables
      ? undefined
      : (() => {
          const collections = [];
          const all = [];
          return {
            collections,
            all,
            getLocalVariableCollections: () => {
              if (opts.dynamicPage) throw new Error('dynamic-page: getLocalVariableCollections síncrono no permitido, usa getLocalVariableCollectionsAsync');
              return collections;
            },
            getLocalVariableCollectionsAsync: async () => collections,
            getLocalVariables: type => {
              if (opts.dynamicPage) throw new Error('dynamic-page: getLocalVariables síncrono no permitido, usa getLocalVariablesAsync');
              return all.filter(v => !type || v.resolvedType === type);
            },
            getLocalVariablesAsync: async type => all.filter(v => !type || v.resolvedType === type),
            createVariableCollection: name => {
              if (!name) throw new Error('colección sin nombre');
              const c = {
                id: 'vc' + collections.length,
                name,
                modes: [{ modeId: 'm1', name: 'Mode 1' }],
                defaultModeId: 'm1',
                variableIds: [],
                renameMode(modeId, newName) {
                  const m = this.modes.find(x => x.modeId === modeId);
                  if (!m) throw new Error('renameMode: modo inexistente');
                  m.name = newName;
                },
                // opts.maxModes: límite del plan (Starter: 1 modo por colección)
                addMode(modeName) {
                  if (this.modes.length >= (opts.maxModes || 4)) throw new Error('Limited to ' + this.modes.length + ' modes');
                  const id = 'm' + (this.modes.length + 1);
                  this.modes.push({ modeId: id, name: modeName });
                  return id;
                },
              };
              collections.push(c);
              return c;
            },
            createVariable: (name, collection, type) => {
              if (!collection || typeof collection !== 'object')
                throw new Error('createVariable: la colección debe ser un objeto');
              if (!['COLOR', 'FLOAT', 'STRING', 'BOOLEAN'].includes(type))
                throw new Error('tipo de variable inválido ' + type);
              if (!name || /[.{}$]/.test(name)) throw new Error('nombre de variable inválido: ' + name);
              if (all.some(v => v.collection === collection && v.name === name))
                throw new Error('variable repetida: ' + name);
              const v = {
                id: 'var' + all.length,
                name,
                collection,
                variableCollectionId: collection.id,
                resolvedType: type,
                scopes: ['ALL_SCOPES'],
                _values: {},
                setValueForMode(modeId, value) {
                  if (type === 'COLOR' && !(value && [value.r, value.g, value.b].every(x => x >= 0 && x <= 1)))
                    throw new Error('color inválido');
                  if (type === 'FLOAT' && typeof value !== 'number') throw new Error('número inválido');
                  this._values[modeId] = value;
                },
              };
              all.push(v);
              collection.variableIds.push(v.id);
              return v;
            },
            setBoundVariableForPaint: (paint, field, variable) => {
              if (paint.type !== 'SOLID' || field !== 'color')
                throw new Error('setBoundVariableForPaint: solo SOLID/color');
              if (variable.resolvedType !== 'COLOR') throw new Error('variable no es COLOR');
              const c = variable._values.m1;
              return {
                ...paint,
                color: { r: c.r, g: c.g, b: c.b },
                boundVariables: { color: { type: 'VARIABLE_ALIAS', id: variable.id } },
              };
            },
          };
        })(),
    // Convierte el nodo en componente y lo pone en su mismo lugar (el nodo original desaparece)
    createComponentFromNode: node => {
      if (!node.parent) throw new Error('createComponentFromNode: nodo sin padre');
      for (let p = node.parent; p; p = p.parent)
        if (p.type === 'INSTANCE') throw new Error('nodo dentro de una instancia');
      const comp = new Node('COMPONENT');
      for (const k of Object.keys(node)) if (!['id', 'parent', 'children', 'type'].includes(k)) comp[k] = node[k];
      const parent = node.parent;
      const idx = parent.children.indexOf(node);
      for (const ch of [...(node.children || [])]) comp.appendChild(ch);
      node.remove();
      parent.insertChild(idx, comp);
      return comp;
    },
    combineAsVariants: (nodes, parent) => {
      if (!nodes.length) throw new Error('combineAsVariants sin nodos');
      if (nodes.some(n => n.type !== 'COMPONENT')) throw new Error('combineAsVariants: solo componentes');
      if (nodes.some(n => !/^[^=,]+=[^=,]+(, *[^=,]+=[^=,]+)*$/.test(n.name)))
        throw new Error('combineAsVariants: nombre de variante inválido');
      if (new Set(nodes.map(n => n.name)).size !== nodes.length) throw new Error('variantes repetidas');
      const set = new Node('COMPONENT_SET');
      set.fills = [];
      for (const n of nodes) set.appendChild(n);
      parent.appendChild(set);
      return set;
    },
    clientStorage: (() => {
      const m = new Map();
      return {
        getAsync: async k => m.get(k),
        setAsync: async (k, v) => {
          m.set(k, v);
        },
      };
    })(),
  };
  return figma;
}

/** Carga el plugin empaquetado (dist/code.js) en un sandbox con el Figma simulado */
function loadPlugin(opts, consoleImpl = console) {
  const figma = createFigma(opts);
  const ctx = {
    figma,
    __html__: '',
    console: consoleImpl,
    setTimeout,
    clearTimeout,
    URL,
    Promise,
    Uint8Array,
    Date,
    Math,
    JSON,
    Map,
    Set,
    Symbol,
  };
  vm.createContext(ctx);
  vm.runInContext(
    fs.readFileSync(require('path').resolve(__dirname, '../../packages/figma-plugin/dist/code.js'), 'utf8'),
    ctx,
  );
  return figma;
}

async function runPlugin(payload, opts) {
  const figma = loadPlugin(opts);
  await figma.ui.onmessage({ type: 'RENDER_NODES', payload });
  return figma;
}

module.exports = { runPlugin, loadPlugin };
