/**
 * Code to Figma AI — Browser Inspector & 3D Pop-out Spotlight (v2.5)
 * Injected content script for Chrome Extension with:
 * - Inspector Superpowers: Freeze Mode (F), Live Figma Status, Multi-selection (Ctrl/⌘+Click)
 * - Native Figma Component conversion support (figma.createComponent)
 * - Automatic CSS variable Design Token extraction
 * - Free Drag & Drop repositioning of the HUD toolbar anywhere across the screen
 * - Persistent custom user position & fluid responsive scaling (100%, 125%, 150%)
 * - Guaranteed topmost z-index (2147483647) inside document.body
 * - Zero DOM Mutation to protect page hierarchy and exact dimensions
 * - Crystal clear visibility (Zero blur, zero screen darkening)
 * - Zero emojis (Clean vector SVG icons)
 */
(() => {
  'use strict';

  const KEY = '__codeToFigmaActive';
  if (window[KEY]) {
    const inst = window.__codeToFigmaInstance;
    if (inst) {
      // Si el usuario tiene un componente seleccionado y hace clic en el icono, enviarlo a Figma
      if (inst.isElevated && inst.selectedElements && inst.selectedElements.length > 0) {
        inst.sendToFigma();
        return;
      }
      // Sin selección, el icono vuelve a cerrar el inspector (antes se seleccionaba el body siempre y el
      // inspector ya no se podía cerrar desde el icono). La página completa sigue a un clic con el
      // botón "Toda la Página" del panel.
      if (inst.destroy) {
        inst.destroy();
      }
    }
    return;
  }
  window[KEY] = true;

  // ── Palette & Constants ──
  const PURPLE = '#A259FF';
  const BLUE = '#0D99FF';
  const DARK_BG = 'rgba(15, 23, 42, 0.96)';
  const BORDER_GLOW = '0 0 20px rgba(162, 89, 255, 0.45), inset 0 0 15px rgba(13, 153, 255, 0.12)';

  // ── Vector SVG Icons (Clean UI, Zero Emojis) ──
  const ICONS = {
    figma: `<svg width="13" height="13" viewBox="0 0 38 57" fill="none" style="vertical-align:-1px;margin-right:5px;"><path d="M19 28.5C19 23.2533 23.2533 19 28.5 19C33.7467 19 38 23.2533 38 28.5C38 33.7467 33.7467 38 28.5 38C23.2533 38 19 33.7467 19 28.5Z" fill="#1ABCFE"/><path d="M0 47.5C0 42.2533 4.25329 38 9.5 38H19V47.5C19 52.7467 14.7467 57 9.5 57C4.25329 57 0 52.7467 0 47.5Z" fill="#0ACF83"/><path d="M19 0V19H28.5C33.7467 19 38 14.7467 38 9.5C38 4.25329 33.7467 0 28.5 0H19Z" fill="#FF7262"/><path d="M0 9.5C0 14.7467 4.25329 19 9.5 19H19V0H9.5C4.25329 0 0 4.25329 0 9.5Z" fill="#F24E1E"/><path d="M0 28.5C0 33.7467 4.25329 38 9.5 38H19V19H9.5C4.25329 19 0 23.2533 0 28.5Z" fill="#A259FF"/></svg>`,
    zap: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    layers: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px;"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
    copy: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
    compare: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px;"><rect x="3" y="4" width="7" height="16" rx="1"/><rect x="14" y="4" width="7" height="16" rx="1"/><path d="M10 12h4"/></svg>`,
    devices: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:3px;"><rect x="2" y="4" width="14" height="11" rx="1.5"/><rect x="17" y="8" width="5" height="12" rx="1"/><line x1="6" y1="19" x2="12" y2="19"/></svg>`,
    moon: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:3px;"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
    code: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px;"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
    close: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    arrowUp: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:3px;"><polyline points="18 15 12 9 6 15"/></svg>`,
    arrowDown: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:3px;"><polyline points="6 9 12 15 18 9"/></svg>`,
    check: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px;"><polyline points="20 6 9 17 4 12"/></svg>`,
    warning: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px;"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    spinner: `<svg class="spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`,
    drag: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:4px;"><circle cx="9" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>`,
    snowflake: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px;"><line x1="12" y1="2" x2="12" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/><line x1="19.07" y1="4.93" x2="4.93" y2="19.07"/></svg>`,
    component: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#c084fc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px;"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>`,
    info: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
    multi: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px;"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>`,
    sun: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:3px;"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
    image: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:3px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
    sparkle: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ec4899" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:3px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  };

  /**
   * El inspector NO es "cero mutación": la elevación de la selección cambia translate/scale/
   * transition/will-change en línea del elemento (fase 5.7). Siempre se restaura lo que había,
   * con su prioridad; la extracción mide con la elevación suspendida (suspendLift).
   */
  function saveInlineStyles(el, props) {
    const out = {};
    for (const prop of props) {
      const key = prop.replace(/-([a-z])/g, (_m, c) => c.toUpperCase());
      out[key] = { prop, value: el.style.getPropertyValue(prop), priority: el.style.getPropertyPriority(prop) };
    }
    return out;
  }

  function restoreInlineStyles(el, saved) {
    for (const k of Object.keys(saved)) {
      const { prop, value, priority } = saved[k];
      if (value) el.style.setProperty(prop, value, priority);
      else el.style.removeProperty(prop);
    }
  }

  /**
   * Recorrido previo de páginas largas: pasos de ~0,8 pantallas, 220 ms cada uno (≈ 1 min como máximo).
   * El número de pasos sale de la altura de la selección medida ANTES de recorrer, así que el scroll
   * infinito no lo alarga; con un tope bajo (8) lo de más abajo quedaba sin cargar.
   */
  const MAX_PRESCROLL_STEPS = 260;

  /** QA de diseño: por encima de este peso la comparación se envía sin imágenes (Figma tardaría) */
  const COMPARE_MAX_BYTES = 30 * 1024 * 1024;

  /**
   * ¿Sigue viva la extensión que inyectó este script? (QA-6) Al recargar o actualizar la extensión,
   * la copia vieja de content.js queda en la pestaña sin contexto: chrome.runtime.id desaparece y
   * cualquier llamada falla con "Extension context invalidated".
   */
  function extensionAlive() {
    try {
      return typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;
    } catch (_e) {
      return false;
    }
  }

  /** Texto de la página o de la extracción → HTML seguro dentro del overlay */
  /** URL sin #fragmento (como la guarda el plugin al marcar una página escaneada) */
  function withoutHash(url) {
    try {
      const u = new URL(String(url || ''), location.href);
      u.hash = '';
      return u.href;
    } catch (_e) {
      return '';
    }
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Texto de un título con iconos SVG (para el log) */
  function stripTags(html) {
    return String(html || '')
      .replace(/<[^>]*>/g, '')
      .trim();
  }

  // Leaf and inline tags that usually don't represent a complete component on their own
  const LEAF_TAGS = new Set([
    'span',
    'p',
    'b',
    'strong',
    'i',
    'em',
    'svg',
    'path',
    'circle',
    'rect',
    'polygon',
    'line',
    'small',
    'label',
    'img',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'picture',
    'figure',
  ]);

  // Semantic container tags that represent cohesive UI blocks
  const CONTAINER_TAGS = new Set([
    'article',
    'section',
    'nav',
    'aside',
    'header',
    'footer',
    'form',
    'table',
    'ul',
    'ol',
    'dialog',
    'button',
    'details',
  ]);

  // Container class substrings
  const CONTAINER_CLASSES = [
    'card',
    'panel',
    'box',
    'wrapper',
    'container',
    'item',
    'row',
    'col',
    'widget',
    'modal',
    'dialog',
    'header',
    'footer',
    'sidebar',
    'banner',
    'unit',
  ];

  class CodeToFigmaInspector {
    constructor() {
      this.active = true;
      this.hoveredEl = null;
      this.selectedEl = null;
      this.selectedElements = [];
      this.isElevated = false;
      this.isFrozen = false;
      this.createAsComponent = false;
      this.extractHover = true;
      this.includeImages = true;
      // Breakpoints y claro/oscuro (Función A): apagados por defecto, multiplican el tiempo de envío
      this.extractBreakpoints = false;
      this.extractThemes = false;

      // Live Figma status tracking
      this.figmaStatus = { hubRunning: false, figmaConnected: false, figmaCount: 0 };

      // Drag state
      this.userCustomPos = null;
      this.isDragging = false;
      this.dragStartX = 0;
      this.dragStartY = 0;
      this.dragInitialLeft = 0;
      this.dragInitialTop = 0;

      // Event bindings
      this.onMouseMove = this.onMouseMove.bind(this);
      this.onClick = this.onClick.bind(this);
      this.onMouseDownBlock = this.onMouseDownBlock.bind(this);
      this.onKeyDown = this.onKeyDown.bind(this);
      this.onScrollOrResize = this.onScrollOrResize.bind(this);
      this.onHudMouseDown = this.onHudMouseDown.bind(this);
      this.onHudMouseMove = this.onHudMouseMove.bind(this);
      this.onHudMouseUp = this.onHudMouseUp.bind(this);
      this.onFreezeBlock = this.onFreezeBlock.bind(this);

      this.initOverlay();
      this.bindEvents();
      this.checkFigmaStatus();

      // Hook usado por extractor.js para recortar desde una captura de pantalla
      // los medios que el DOM no entrega (video cross-origin, WebGL, iframes, imágenes bloqueadas).
      window.__codeToFigmaCaptureRegions = this.captureRegions.bind(this);
      // "Exportar HTML": hojas de estilo de otro dominio (el navegador no deja leerlas desde la página)
      window.__codeToFigmaFetchCss = url => this.fetchStylesheet(url);
      this.showToast(
        `${ICONS.zap}Code to Figma activo`,
        `Clic: Seleccionar · ${/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || '') ? '⌘' : 'Ctrl'}+Clic: Multi-selección · F: Congelar pantalla`,
        4000,
      );
    }

    initOverlay() {
      this.host = document.createElement('div');
      this.host.id = '__code_to_figma_root';
      this.host.style.position = 'fixed';
      this.host.style.top = '0';
      this.host.style.left = '0';
      this.host.style.width = '100vw';
      this.host.style.height = '100vh';
      this.host.style.pointerEvents = 'none';
      this.host.style.zIndex = '2147483647';

      this.shadow = this.host.attachShadow({ mode: 'open' });

      const style = document.createElement('style');
      style.textContent = `
        * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        svg { display: inline-block; vertical-align: middle; flex-shrink: 0; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; }
        
        /* Top Freeze Banner */
        .freeze-banner {
          position: fixed;
          top: 14px;
          left: 50%;
          transform: translateX(-50%) translateY(-20px);
          opacity: 0;
          display: none;
          align-items: center;
          gap: 8px;
          background: rgba(14, 165, 233, 0.95);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(56, 189, 248, 0.6);
          box-shadow: 0 8px 24px rgba(14, 165, 233, 0.35);
          color: #fff;
          font-size: 12px;
          font-weight: 600;
          padding: 6px 16px;
          border-radius: 20px;
          pointer-events: auto;
          z-index: 2147483647;
          transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s;
        }
        .freeze-banner.visible {
          display: flex;
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }

        /* Highlight box for hovering */
        .highlight-box {
          position: fixed;
          pointer-events: none;
          display: none;
          border: 2px solid transparent;
          border-image: linear-gradient(135deg, ${PURPLE}, ${BLUE}) 1;
          box-shadow: ${BORDER_GLOW};
          border-radius: 8px;
          transition: all 0.08s cubic-bezier(0.16, 1, 0.3, 1);
          z-index: 2147483646;
        }

        /* Floating pill badge on hover */
        .pill-badge {
          position: absolute;
          top: -34px;
          left: 0;
          display: flex;
          align-items: center;
          gap: 8px;
          background: ${DARK_BG};
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 1px solid rgba(162, 89, 255, 0.4);
          color: #fff;
          font-size: 12px;
          font-weight: 500;
          padding: 4px 10px;
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          white-space: nowrap;
          pointer-events: none;
        }

        .pill-tag {
          color: #c084fc;
          font-weight: 700;
        }

        .pill-dims {
          color: #94a3b8;
          font-size: 11px;
        }

        .pill-hint {
          background: rgba(255, 255, 255, 0.12);
          padding: 2px 5px;
          border-radius: 4px;
          font-size: 10px;
          color: #cbd5e1;
        }

        /* Dedicated spotlight box for selected elements */
        .spotlight-box {
          position: fixed;
          pointer-events: none;
          display: none;
          border: 2.5px solid #a855f7;
          box-shadow: 0 0 0 1px rgba(168, 85, 247, 0.5), 0 0 35px rgba(168, 85, 247, 0.45);
          border-radius: 8px;
          overflow: hidden;
          transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1),
                      translate 0.38s cubic-bezier(0.16, 1, 0.3, 1),
                      scale 0.38s cubic-bezier(0.16, 1, 0.3, 1);
          z-index: 2147483646;
        }

        /* Componente elevado: sombra profunda bajo el componente "levantado" */
        .spotlight-box.lifted {
          box-shadow: 0 0 0 1px rgba(168, 85, 247, 0.5),
                      0 0 35px rgba(168, 85, 247, 0.4),
                      0 28px 55px -14px rgba(0, 0, 0, 0.6),
                      0 12px 22px -10px rgba(0, 0, 0, 0.45);
        }

        /* Reflejo de luz tipo espejo: barre en diagonal de la esquina superior izquierda a la inferior derecha */
        .spotlight-sheen {
          position: absolute;
          inset: 0;
          pointer-events: none;
          border-radius: inherit;
          /* Banda diagonal fina: núcleo blanco brillante con halo morado/azul (colores de la extensión) */
          background-image: linear-gradient(
            125deg,
            transparent 0%,
            transparent 42%,
            rgba(168, 85, 247, 0.12) 45.5%,
            rgba(255, 255, 255, 0.45) 48.8%,
            rgba(255, 255, 255, 0.85) 50%,
            rgba(255, 255, 255, 0.45) 51.2%,
            rgba(13, 153, 255, 0.12) 54.5%,
            transparent 58%,
            transparent 100%
          );
          /* 200%: el centro de la banda recorre el componente entero de una esquina a la otra
             (con 300% solo se veía la mitad del tiempo de la animación) */
          background-size: 200% 200%;
          background-repeat: no-repeat;
          background-position: 112% 112%;
          opacity: 0;
        }
        .spotlight-sheen.play {
          animation: sheenSweep 1.1s cubic-bezier(0.3, 0.05, 0.7, 0.95) 0.2s 1 both;
        }
        @keyframes sheenSweep {
          0%   { background-position: 112% 112%; opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { background-position: -12% -12%; opacity: 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          .spotlight-box { transition: none; }
          .spotlight-sheen.play { animation: none; }
        }

        /* Transparent click-catcher to dismiss selection when clicking outside */
        .spotlight-backdrop {
          position: fixed;
          inset: 0;
          background: transparent;
          pointer-events: auto;
          display: none;
          z-index: 2147483645;
        }
        .spotlight-backdrop.visible {
          display: block;
        }

        /* Action HUD toolbar — modern floating command island */
        .action-hud {
          position: fixed !important;
          pointer-events: auto !important;
          display: none;
          background: #0f121a !important;
          /* Sin backdrop-filter para evitar el desenfoque y subpixel rasterization de Chromium */
          border: 1.5px solid rgba(255, 255, 255, 0.22) !important;
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.1) !important;
          border-radius: 14px;
          padding: 13px 18px;
          z-index: 2147483647 !important;
          animation: hudPop 0.16s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          color: #f8fafc;
          width: auto;
          max-width: min(740px, calc(100vw - 24px));
          box-sizing: border-box;
          user-select: none;
          -webkit-font-smoothing: antialiased !important;
          -moz-osx-font-smoothing: grayscale !important;
          text-rendering: geometricPrecision !important;
          transform: translateZ(0);
        }

        @keyframes hudPop {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .hud-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 9px;
          cursor: grab;
          user-select: none;
          padding-bottom: 8px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .hud-header:active {
          cursor: grabbing;
        }

        .hud-title-group {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .hud-title {
          font-size: 13.5px;
          font-weight: 700;
          color: #fff;
          display: flex;
          align-items: center;
          gap: 6px;
          pointer-events: none;
          letter-spacing: -0.2px;
        }

        .hud-drag-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          color: #cbd5e1;
          letter-spacing: 0.2px;
          cursor: grab;
          transition: all 0.15s ease;
        }
        .hud-drag-pill:hover {
          background: rgba(255, 255, 255, 0.18);
          color: #fff;
        }

        /* Status Pills */
        .hud-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 600;
          padding: 3px 9px;
          border-radius: 12px;
          pointer-events: auto;
          cursor: help;
        }
        .status-dot {
          display: inline-block;
          width: 7px;
          height: 7px;
          border-radius: 50%;
        }
        .hud-status-pill.connected {
          background: rgba(16, 185, 129, 0.16);
          color: #34d399;
          border: 1px solid rgba(16, 185, 129, 0.35);
        }
        .hud-status-pill.connected .status-dot {
          background: #10b981;
          box-shadow: 0 0 8px #10b981;
        }
        .hud-status-pill.waiting {
          background: rgba(245, 158, 11, 0.16);
          color: #fbbf24;
          border: 1px solid rgba(245, 158, 11, 0.35);
        }
        .hud-status-pill.waiting .status-dot {
          background: #f59e0b;
          box-shadow: 0 0 8px #f59e0b;
        }
        .hud-status-pill.disconnected {
          background: rgba(239, 68, 68, 0.16);
          color: #f87171;
          border: 1px solid rgba(239, 68, 68, 0.35);
        }
        .hud-status-pill.disconnected .status-dot {
          background: #ef4444;
        }

        .hud-meta {
          font-size: 11.5px;
          color: #94a3b8;
          font-weight: 500;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          pointer-events: none;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .hud-radius-badge {
          background: rgba(168, 85, 247, 0.18) !important;
          color: #d8b4fe !important;
          border: 1px solid rgba(168, 85, 247, 0.35) !important;
          font-weight: 600 !important;
          display: inline-flex;
          align-items: center;
          padding: 1.5px 6px;
          border-radius: 4px;
        }

        .hud-breadcrumbs {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-bottom: 8px;
          padding: 4px 8px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 7px;
          overflow-x: auto;
          white-space: nowrap;
          scrollbar-width: none;
        }
        .hud-breadcrumbs::-webkit-scrollbar {
          display: none;
        }

        .hud-crumb-btn {
          background: transparent;
          border: none;
          color: #94a3b8;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 11px;
          padding: 2px 6px;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .hud-crumb-btn:hover {
          background: rgba(255, 255, 255, 0.12);
          color: #38bdf8;
        }

        .hud-crumb-sep {
          color: #64748b;
          font-size: 10px;
          user-select: none;
        }

        .hud-crumb-current {
          color: #38bdf8;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 11px;
          font-weight: 600;
          background: rgba(56, 189, 248, 0.14);
          padding: 2px 6px;
          border-radius: 4px;
          border: 1px solid rgba(56, 189, 248, 0.3);
        }

        .hud-nav-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 9px;
          font-size: 11.5px;
          color: #94a3b8;
        }

        .hud-nav-left {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }

        .hud-hierarchy-group {
          display: inline-flex;
          align-items: center;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 2.5px;
          gap: 3px;
        }

        .btn-hierarchy {
          background: transparent;
          color: #cbd5e1;
          border: 1px solid transparent;
          font-size: 11.5px;
          padding: 4.5px 9px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          user-select: none;
        }
        .btn-hierarchy:hover {
          background: rgba(255, 255, 255, 0.14);
          color: #fff;
        }
        .btn-hierarchy:active {
          transform: translateY(1px);
        }

        .hud-kbd {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          padding: 1.5px 5px;
          border-radius: 4px;
          font-family: ui-monospace, monospace;
          font-size: 9.5px;
          color: #cbd5e1;
        }

        /* Toggle Component Pill */
        .hud-component-toggle {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11.5px;
          color: #cbd5e1;
          cursor: pointer;
          user-select: none;
          background: rgba(255, 255, 255, 0.05);
          padding: 4.5px 10px;
          border-radius: 7px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          transition: all 0.15s;
        }
        .hud-component-toggle:hover {
          background: rgba(139, 92, 246, 0.18);
          border-color: rgba(139, 92, 246, 0.4);
          color: #ddd6fe;
        }
        .hud-component-toggle:has(input:checked) {
          background: rgba(139, 92, 246, 0.24);
          border-color: #8b5cf6;
          color: #fff;
        }
        .hud-component-toggle input {
          cursor: pointer;
          margin: 0;
          accent-color: #8b5cf6;
        }

        .hud-buttons {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
        }

        .btn-figma {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
          color: #fff;
          font-size: 12.5px;
          font-weight: 700;
          border: none;
          padding: 8px 18px;
          border-radius: 8px;
          cursor: pointer;
          transition: transform 0.12s, box-shadow 0.15s, filter 0.15s;
          box-shadow: 0 4px 16px rgba(139, 92, 246, 0.45);
          user-select: none;
        }
        .btn-figma:hover {
          transform: translateY(-1px);
          filter: brightness(1.08);
          box-shadow: 0 4px 20px rgba(139, 92, 246, 0.65);
        }
        .btn-figma:active {
          transform: translateY(0);
        }

        .btn-secondary {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(255, 255, 255, 0.08);
          color: #e2e8f0;
          font-size: 12px;
          font-weight: 600;
          border: 1px solid rgba(255, 255, 255, 0.15);
          padding: 8px 14px;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.15s, color 0.15s, border-color 0.15s;
          user-select: none;
        }
        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.16);
          border-color: rgba(255, 255, 255, 0.25);
          color: #fff;
        }
        .btn-secondary:active {
          transform: translateY(1px);
        }

        /* Toast notification */
        .toast-msg {
          position: fixed;
          bottom: 24px;
          right: 24px;
          background: ${DARK_BG};
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(162, 89, 255, 0.4);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
          color: #fff;
          border-radius: 10px;
          padding: 12px 18px;
          font-size: 13px;
          z-index: 2147483647;
          pointer-events: auto;
          animation: toastIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          max-width: min(420px, calc(100vw - 32px));
          box-sizing: border-box;
        }

        @keyframes toastIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .toast-title {
          font-weight: 700;
          margin-bottom: 2px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .toast-desc {
          color: #94a3b8;
          font-size: 12px;
        }

        /* Aviso de selección pesada (fase 5.1) */
        .heavy-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(2, 6, 23, 0.55);
          z-index: 2147483647;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          pointer-events: auto;
        }
        .heavy-dialog {
          background: ${DARK_BG};
          border: 1px solid rgba(251, 191, 36, 0.45);
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.55);
          color: #fff;
          border-radius: 12px;
          padding: 18px 20px;
          width: min(440px, 100%);
          box-sizing: border-box;
          font-size: 13px;
        }
        .heavy-dialog h3 {
          margin: 0 0 6px;
          font-size: 15px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .heavy-dialog p {
          margin: 0 0 10px;
          color: #cbd5e1;
          line-height: 1.45;
        }
        .heavy-dialog ul {
          margin: 0 0 12px;
          padding-left: 18px;
          color: #fbbf24;
        }
        .heavy-dialog .heavy-stats {
          color: #94a3b8;
          font-size: 11px;
          margin-bottom: 14px;
        }
        .scan-dialog { width: min(560px, 100%); }
        .scan-tools { display: flex; gap: 6px; margin: 0 0 8px; }
        .scan-tools input { flex: 1; min-width: 0; padding: 6px 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.06); color: #e2e8f0; font-size: 12px; }
        .scan-tools button { padding: 6px 10px; font-size: 12px; }
        .scan-list { max-height: 46vh; overflow: auto; margin: 0 0 10px; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 6px; }
        .scan-route { display: flex; align-items: baseline; gap: 8px; padding: 4px 6px; border-radius: 6px; cursor: pointer; }
        .scan-route:hover { background: rgba(255,255,255,0.06); }
        .scan-path { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 12px; color: #e2e8f0; word-break: break-all; }
        .scan-label { color: #94a3b8; font-size: 11px; }
        .scan-done { color: #4ade80; font-size: 11px; white-space: nowrap; }
        .scan-note { margin: 0 0 8px; color: #94a3b8; font-size: 12px; }
        .scan-excluded { margin: 0 0 10px; color: #fbbf24; font-size: 11px; }
        .scan-excluded div { color: #94a3b8; margin: 2px 0 0 12px; }
        .scan-panel {
          position: fixed; left: 24px; bottom: 24px; z-index: 2147483647; pointer-events: auto;
          display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 10px;
          background: ${DARK_BG}; color: #fff; font-size: 13px;
          border: 1px solid rgba(162, 89, 255, 0.4); box-shadow: 0 10px 30px rgba(0,0,0,0.45);
          max-width: min(520px, calc(100vw - 48px));
        }
        .heavy-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: flex-end;
        }
        .heavy-dialog.export-dialog {
          border-color: rgba(162, 89, 255, 0.5);
        }
        .heavy-dialog.export-dialog ul {
          color: #cbd5e1;
        }
      `;

      this.shadow.appendChild(style);

      // Elements inside Shadow DOM
      this.freezeBanner = document.createElement('div');
      this.freezeBanner.className = 'freeze-banner';
      this.freezeBanner.innerHTML = `${ICONS.snowflake} <span>Pantalla Congelada: Menús fijos. Pulsa <strong>[F]</strong> para descongelar.</span>`;

      this.highlightBox = document.createElement('div');
      this.highlightBox.className = 'highlight-box';
      this.pillBadge = document.createElement('div');
      this.pillBadge.className = 'pill-badge';
      this.highlightBox.appendChild(this.pillBadge);

      this.spotlightBox = document.createElement('div');
      this.spotlightBox.className = 'spotlight-box';

      this.multiBoxesHost = document.createElement('div');
      this.multiBoxesHost.className = 'multi-boxes-host';

      this.backdrop = document.createElement('div');
      this.backdrop.className = 'spotlight-backdrop';
      // Clic en el fondo: cierra la selección; con Ctrl/⌘ suma o quita el componente de debajo
      this.backdrop.addEventListener('click', e => {
        if (!this.isMultiSelectEvent(e)) {
          this.cancelElevation();
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        const under = document
          .elementsFromPoint(e.clientX, e.clientY)
          .find(n => n !== this.host && !this.host.contains(n));
        const container = under ? this.findSemanticContainer(under) : null;
        if (container) this.toggleInSelection(container);
      });

      this.hud = document.createElement('div');
      this.hud.className = 'action-hud';

      this.shadow.appendChild(this.freezeBanner);
      this.shadow.appendChild(this.highlightBox);
      this.shadow.appendChild(this.spotlightBox);
      this.shadow.appendChild(this.multiBoxesHost);
      this.shadow.appendChild(this.backdrop);
      this.shadow.appendChild(this.hud);

      // Mount directly inside body so it shares the body stacking context as the topmost layer
      const mountParent = document.body || document.documentElement;
      mountParent.appendChild(this.host);
    }

    bindEvents() {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        this._onRuntimeMessage = message => {
          if (message && message.type === 'SCAN_PROGRESS') this.onScanProgress(message);
        };
        try {
          chrome.runtime.onMessage.addListener(this._onRuntimeMessage);
        } catch (_e) {}
      }
      window.addEventListener('mousemove', this.onMouseMove, true);
      window.addEventListener('click', this.onClick, true);
      window.addEventListener('mousedown', this.onMouseDownBlock, true);
      window.addEventListener('keydown', this.onKeyDown, true);
      window.addEventListener('scroll', this.onScrollOrResize, { passive: true });
      window.addEventListener('resize', this.onScrollOrResize, { passive: true });

      // Free Drag & Drop listeners
      window.addEventListener('mousemove', this.onHudMouseMove, true);
      window.addEventListener('mouseup', this.onHudMouseUp, true);
    }

    unbindEvents() {
      if (this._onRuntimeMessage) {
        try {
          chrome.runtime.onMessage.removeListener(this._onRuntimeMessage);
        } catch (_e) {}
        this._onRuntimeMessage = null;
      }
      window.removeEventListener('mousemove', this.onMouseMove, true);
      window.removeEventListener('click', this.onClick, true);
      window.removeEventListener('mousedown', this.onMouseDownBlock, true);
      window.removeEventListener('keydown', this.onKeyDown, true);
      window.removeEventListener('scroll', this.onScrollOrResize);
      window.removeEventListener('resize', this.onScrollOrResize);

      window.removeEventListener('mousemove', this.onHudMouseMove, true);
      window.removeEventListener('mouseup', this.onHudMouseUp, true);

      // Unbind freeze listeners if active
      if (this.isFrozen) {
        this.toggleFreeze();
      }
    }

    // ── Freeze Screen Mode (Hotkey F / Space) ──
    toggleFreeze() {
      this.isFrozen = !this.isFrozen;
      const blockEvents = ['blur', 'focusout', 'mouseleave', 'mouseout', 'pointerleave'];

      if (this.isFrozen) {
        this.freezeBanner.classList.add('visible');
        for (const evt of blockEvents) {
          window.addEventListener(evt, this.onFreezeBlock, true);
        }
        this.showToast(
          `${ICONS.snowflake} Pantalla Congelada`,
          'Los menús desplegables y tooltips no se cerrarán al mover el ratón.',
          3000,
        );
      } else {
        this.freezeBanner.classList.remove('visible');
        for (const evt of blockEvents) {
          window.removeEventListener(evt, this.onFreezeBlock, true);
        }
        this.showToast(`${ICONS.zap} Pantalla Descongelada`, 'Interacción fluida normal restaurada.', 2500);
      }
    }

    onFreezeBlock(e) {
      if (this.isFrozen) {
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    }

    // ── Live Figma Status Check ──
    async checkFigmaStatus() {
      if (!extensionAlive()) return this.retire();
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ type: 'CHECK_FIGMA_STATUS' }, res => {
            if (chrome.runtime.lastError) return;
            if (res && res.success && res.status) {
              this.figmaStatus = res.status;
              this.updateFigmaStatusUI();
            }
          });
          return;
        }
      } catch (_) {}

      // Sin service worker no hay forma segura de consultar el hub desde la página
      this.figmaStatus = { hubRunning: false, figmaConnected: false, figmaCount: 0 };
      this.updateFigmaStatusUI();
    }

    updateFigmaStatusUI() {
      const pill = this.hud?.querySelector('#__hud_figma_status');
      if (!pill) return;
      if (this.figmaStatus.figmaConnected) {
        pill.className = 'hud-status-pill connected';
        pill.innerHTML = `<span class="status-dot"></span> Figma Conectado`;
        pill.title = 'WebSocket Hub y Plugin de Figma enlazados en tiempo real';
      } else if (this.figmaStatus.hubRunning) {
        pill.className = 'hud-status-pill waiting';
        pill.innerHTML = `<span class="status-dot"></span> Esperando Figma`;
        pill.title = 'Hub activo en puerto 8080. Abre el plugin en Figma para enlazar';
      } else {
        pill.className = 'hud-status-pill disconnected';
        pill.innerHTML = `<span class="status-dot"></span> Hub Desconectado`;
        pill.title = "Abre o instala Code to Figma Hub (o ejecuta 'npm run start:hub')";
      }
    }

    /**
     * Smart Container Finder:
     * Walks up the DOM tree from leaf elements to find the nearest meaningful UI container.
     */
    findSemanticContainer(el) {
      if (!el || el === document.body || el === document.documentElement) {
        return el;
      }

      let curr = el;
      while (curr && curr.parentElement && curr.parentElement !== document.body) {
        const tag = curr.tagName.toLowerCase();
        const parentClasses = (curr.parentElement.className || '').toString().toLowerCase();

        // 1. If leaf or media, hoist to parent
        if (LEAF_TAGS.has(tag)) {
          curr = curr.parentElement;
          continue;
        }

        // 2. If container only wraps media and parent has headings/copy, hoist to parent
        const isMediaWrapper =
          tag === 'figure' ||
          tag === 'picture' ||
          parentClasses.includes('unit-image') ||
          (curr.className || '').toString().includes('unit-image') ||
          (curr.querySelector('img, svg, video') && !curr.querySelector('h1, h2, h3, h4, h5, h6, p, button, a'));
        if (isMediaWrapper && curr.parentElement && curr.parentElement !== document.body) {
          const parentHasText = !!curr.parentElement.querySelector(
            'h1, h2, h3, h4, h5, h6, p, button, a, [class*="copy"], [class*="headline"], [class*="subhead"]',
          );
          if (parentHasText) {
            curr = curr.parentElement;
            continue;
          }
        }

        // 3. Is curr an obvious standalone container?
        if (CONTAINER_TAGS.has(tag)) return curr;

        // 4. Does parent represent a card/component wrapper?
        const isParentCard = CONTAINER_CLASSES.some(cls => parentClasses.includes(cls));
        if (isParentCard) {
          const grandParent = curr.parentElement.parentElement;
          if (grandParent && grandParent !== document.body) {
            const gpClasses = (grandParent.className || '').toString().toLowerCase();
            const isGpCard = CONTAINER_CLASSES.some(cls => gpClasses.includes(cls));
            if (isGpCard && !curr.parentElement.querySelector('h1, h2, h3, h4, h5, h6, p')) {
              return grandParent;
            }
          }
          return curr.parentElement;
        }

        // 5. Check display mode: Flex/Grid with multiple children
        try {
          const pStyle = window.getComputedStyle(curr);
          if (pStyle.display === 'flex' || pStyle.display === 'grid') {
            const r = curr.getBoundingClientRect();
            if (r.width > 90 && r.height > 60) return curr;
          }
        } catch (_e) {}

        break;
      }

      return curr || el;
    }

    onMouseMove(e) {
      if (this.isElevated || this.isDragging) return;

      const target = document.elementFromPoint(e.clientX, e.clientY);
      if (!target || target === this.host || this.host.contains(target)) return;

      const container = this.findSemanticContainer(target);
      if (container === this.hoveredEl) return;

      this.hoveredEl = container;
      this.updateHighlight(this.hoveredEl);
    }

    updateHighlight(el) {
      if (!el || el === document.documentElement) {
        this.highlightBox.style.display = 'none';
        return;
      }

      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        this.highlightBox.style.display = 'none';
        return;
      }

      const cs = window.getComputedStyle(el);
      const radius = cs.borderRadius || '8px';

      this.highlightBox.style.display = 'block';
      this.highlightBox.style.top = `${rect.top}px`;
      this.highlightBox.style.left = `${rect.left}px`;
      this.highlightBox.style.width = `${rect.width}px`;
      this.highlightBox.style.height = `${rect.height}px`;
      this.highlightBox.style.borderRadius = radius;

      // Tag & dimensions
      const tag = el.tagName.toLowerCase();
      const cls = el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : '';
      const label = `${tag}${cls}`;
      const dims = `${Math.round(rect.width)} × ${Math.round(rect.height)} px`;

      // Position badge: top if enough room, else inside top
      if (rect.top < 40) {
        this.pillBadge.style.top = '6px';
        this.pillBadge.style.left = '6px';
      } else {
        this.pillBadge.style.top = '-34px';
        this.pillBadge.style.left = '0';
      }

      this.pillBadge.innerHTML = `
        <span class="pill-tag">&lt;${label.slice(0, 24)}&gt;</span>
        <span class="pill-dims">${dims}</span>
        <span class="pill-hint">${ICONS.arrowUp}${ICONS.arrowDown} Jerarquía · ${/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || '') ? '⌘' : 'Ctrl'}+Clic Multi</span>
      `;
    }

    /** Ctrl + clic en Windows/Linux, ⌘ + clic en Mac (en Mac Ctrl + clic abre el menú contextual) */
    isMultiSelectEvent(e) {
      const isMac = /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || '');
      return isMac ? e.metaKey : e.ctrlKey;
    }

    /**
     * Mientras el inspector está activo, el mousedown de la página no debe iniciar selección de
     * texto (resaltado azul) ni arrastre de imágenes/enlaces: el clic es para elegir componentes.
     */
    onMouseDownBlock(e) {
      if (e.button !== 0) return;
      const path = e.composedPath ? e.composedPath() : [];
      if (path.includes(this.host)) return; // HUD, toasts y controles propios funcionan normal
      e.preventDefault();
    }

    /**
     * ¿Organizar el resultado como tablero (Página completa → Secciones → Componentes → Estilos)?
     * Sí para multi-selección, body/main/html, o elementos más altos que 1,5 pantallas.
     * Un componente suelto se dibuja como siempre.
     */
    shouldBuildBoard(elements) {
      if (!elements || elements.length === 0) return false;
      if (elements.length > 1) return true;
      const el = elements[0];
      const tag = (el.tagName || '').toLowerCase();
      if (tag === 'body' || tag === 'main' || tag === 'html' || el.getAttribute('role') === 'main') return true;
      return el.getBoundingClientRect().height > window.innerHeight * 1.5;
    }

    /** Suma o quita un componente de la selección múltiple */
    toggleInSelection(container) {
      try {
        window.getSelection()?.removeAllRanges();
      } catch (_e) {}
      const existingIdx = this.selectedElements.indexOf(container);
      if (existingIdx >= 0) {
        this.selectedElements.splice(existingIdx, 1);
      } else {
        // Evitar anidados: si el nuevo contiene o está dentro de uno ya elegido, reemplaza
        this.selectedElements = this.selectedElements.filter(el => !el.contains(container) && !container.contains(el));
        this.selectedElements.push(container);
      }
      if (this.selectedElements.length === 0) {
        this.cancelElevation();
      } else {
        this.elevateElements(this.selectedElements);
      }
    }

    onClick(e) {
      // Ignore click if targeting HUD or extension host
      const path = e.composedPath ? e.composedPath() : [];
      if (path.includes(this.host) || path.includes(this.hud)) return;

      const hitTarget = document.elementFromPoint(e.clientX, e.clientY);
      if (!hitTarget || hitTarget === this.host || this.host.contains(hitTarget)) return;

      const container = this.findSemanticContainer(hitTarget);
      if (!container) return;

      e.preventDefault();
      e.stopPropagation();

      if (this.isMultiSelectEvent(e)) {
        // Multi-selección: Ctrl + clic (⌘ + clic en Mac). Shift + clic se descartó porque el
        // navegador lo usa para extender la selección de texto (resaltado azul).
        this.toggleInSelection(container);
      } else {
        // Single component selection
        this.selectedElements = [container];
        this.elevateElements(this.selectedElements);
      }
    }

    /**
     * 3D Spotlight Selection (Single or Multi):
     * Highlights selected components and renders the floating HUD.
     * ZERO DOM MUTATION: The target element's DOM styles and bounding box are preserved at 100% native fidelity.
     */
    elevateElements(elements) {
      if (!elements || elements.length === 0) return;

      this.isElevated = true;
      this.selectedEl = elements[0];
      this.highlightBox.style.display = 'none';

      // Always re-ensure this.host is the absolute last child of body for highest stacking context
      const mountParent = document.body || document.documentElement;
      if (this.host.parentElement !== mountParent || this.host !== mountParent.lastElementChild) {
        mountParent.appendChild(this.host);
      }

      // Elevar el componente hacia adelante y pasar el reflejo de luz
      this.liftElements(elements);
      this.renderSpotlights(elements);
      this.playSheen();

      // Show spotlight backdrop
      this.backdrop.classList.add('visible');

      // Render HUD toolbar with fluid responsive positioning
      this.renderHUD();
      this.checkFigmaStatus();
    }

    renderSpotlights(elements) {
      this.multiBoxesHost.innerHTML = '';
      this.spotlightBox.style.display = 'none';

      const placeBox = (box, el) => {
        const rect = this.baseRectOf(el);
        const cs = window.getComputedStyle(el);
        const found = this.liftOf(el);
        const lift = found && !found.suspended ? found : null;
        box.style.display = 'block';
        box.style.top = `${rect.top}px`;
        box.style.left = `${rect.left}px`;
        box.style.width = `${rect.width}px`;
        box.style.height = `${rect.height}px`;
        box.style.borderRadius = cs.borderRadius || '8px';
        // Mismo "levantamiento" que el elemento real, para que recuadro y componente se muevan juntos
        box.style.translate = lift ? `0 ${lift.ty}px` : '';
        box.style.scale = lift ? String(lift.s) : '';
        box.classList.toggle('lifted', !!lift);
        if (!box.querySelector('.spotlight-sheen')) {
          const sheen = document.createElement('div');
          sheen.className = 'spotlight-sheen';
          box.appendChild(sheen);
        }
      };

      if (elements.length === 1) {
        placeBox(this.spotlightBox, elements[0]);
      } else {
        for (const el of elements) {
          const box = document.createElement('div');
          box.className = 'spotlight-box';
          placeBox(box, el);
          this.multiBoxesHost.appendChild(box);
        }
      }
    }

    // ── Efecto de elevación (lift) + reflejo de luz ──
    // Se usan las propiedades CSS independientes `translate` y `scale`: se componen con el
    // `transform` propio del sitio (carruseles, animaciones) sin sobrescribirlo. Los valores
    // inline previos se guardan y se restauran exactos.

    liftOf(el) {
      return (this._lifts || []).find(l => l.el === el) || null;
    }

    /** Rect del elemento sin la elevación aplicada (para no sumarla dos veces al hacer scroll) */
    baseRectOf(el) {
      const r = el.getBoundingClientRect();
      const lift = this.liftOf(el);
      if (!lift || lift.suspended) return r;
      // Durante la transición el rect está "a medio camino": invertir con los valores ANIMADOS
      // actuales (getComputedStyle los devuelve interpolados), no con los valores finales.
      const cs = window.getComputedStyle(el);
      const curS = parseFloat(cs.scale) || 1;
      const tParts = (cs.translate || '').split(/\s+/);
      const curTy = tParts.length > 1 ? parseFloat(tParts[1]) || 0 : 0;
      const w = r.width / curS;
      const h = r.height / curS;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2 - curTy;
      return { left: cx - w / 2, top: cy - h / 2, width: w, height: h, right: cx + w / 2, bottom: cy + h / 2 };
    }

    liftElements(elements) {
      this.unliftElements();
      const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this._lifts = [];
      for (const el of elements) {
        if (!el || !el.style) continue;
        const r = el.getBoundingClientRect();
        const cs = window.getComputedStyle(el);
        if (cs.display === 'inline' || r.width < 4 || r.height < 4) continue; // inline no admite scale/translate
        // Escala adaptativa: ~12px de crecimiento total, sin exagerar en secciones grandes
        const s = 1 + Math.min(0.03, 12 / Math.max(r.width, r.height));
        const ty = -Math.min(8, Math.max(3, r.height * 0.012));
        const lift = {
          el,
          s,
          ty,
          // Estilos en línea previos CON su prioridad (!important): se devuelven tal cual estaban
          prev: saveInlineStyles(el, ['translate', 'scale', 'transition', 'will-change']),
        };
        if (!reduce) {
          el.style.transition =
            (lift.prev.transition.value ? lift.prev.transition.value + ', ' : '') +
            'translate 0.38s cubic-bezier(0.16, 1, 0.3, 1), scale 0.38s cubic-bezier(0.16, 1, 0.3, 1)';
        }
        el.style.willChange = 'translate, scale';
        el.style.translate = `0 ${ty}px`;
        el.style.scale = String(s);
        this._lifts.push(lift);
      }
    }

    unliftElements() {
      for (const lift of this._lifts || []) {
        restoreInlineStyles(lift.el, lift.prev);
      }
      this._lifts = [];
    }

    /**
     * Quita la elevación AL INSTANTE (sin transición) para que el extractor mida las posiciones
     * reales. Devuelve una función que la vuelve a aplicar.
     */
    async suspendLift() {
      const lifts = this._lifts || [];
      if (!lifts.length) return () => {};
      for (const lift of lifts) {
        lift.el.style.transition = 'none';
        restoreInlineStyles(lift.el, { translate: lift.prev.translate, scale: lift.prev.scale });
        lift.suspended = true;
      }
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      return () => {
        for (const lift of lifts) {
          if (!lift.suspended) continue;
          lift.suspended = false;
          lift.el.style.translate = `0 ${lift.ty}px`;
          lift.el.style.scale = String(lift.s);
          // restaurar la transición después de aplicar, para que no re-anime
          requestAnimationFrame(() => {
            restoreInlineStyles(lift.el, { transition: lift.prev.transition });
          });
        }
      };
    }

    playSheen() {
      const boxes = [this.spotlightBox, ...this.multiBoxesHost.querySelectorAll('.spotlight-box')];
      for (const box of boxes) {
        const sheen = box.querySelector('.spotlight-sheen');
        if (!sheen) continue;
        sheen.classList.remove('play');
        void sheen.offsetWidth; // reiniciar la animación
        sheen.classList.add('play');
      }
    }

    elevateParent() {
      if (this.selectedElements.length !== 1) return;
      const parent = this.selectedElements[0].parentElement;
      if (!parent || parent === document.documentElement) return;
      this.selectedElements = [parent];
      this.elevateElements(this.selectedElements);
    }

    elevateChild() {
      if (this.selectedElements.length !== 1) return;
      const child = this.selectedElements[0].querySelector('article, section, div, button, nav, form, figure');
      if (!child || child === this.selectedElements[0]) return;
      this.selectedElements = [child];
      this.elevateElements(this.selectedElements);
    }

    // ── Drag & Drop HUD Implementation ──
    onHudMouseDown(e) {
      if (e.target.closest('button') || e.target.closest('a') || e.target.closest('input') || e.target.closest('label'))
        return;
      this.isDragging = true;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      const rect = this.hud.getBoundingClientRect();
      this.dragInitialLeft = rect.left;
      this.dragInitialTop = rect.top;
      this.hud.style.cursor = 'grabbing';
      e.preventDefault();
    }

    onHudMouseMove(e) {
      if (!this.isDragging) return;

      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;

      const vpW = window.innerWidth || document.documentElement.clientWidth || 1280;
      const vpH = window.innerHeight || document.documentElement.clientHeight || 800;
      const hudW = this.hud.offsetWidth || 480;
      const hudH = this.hud.offsetHeight || 135;

      let newLeft = this.dragInitialLeft + dx;
      let newTop = this.dragInitialTop + dy;

      newLeft = Math.max(10, Math.min(vpW - hudW - 10, newLeft));
      newTop = Math.max(10, Math.min(vpH - hudH - 10, newTop));

      this.hud.style.left = `${Math.round(newLeft)}px`;
      this.hud.style.top = `${Math.round(newTop)}px`;

      // Persist user's chosen custom position across hierarchy navigation
      this.userCustomPos = { left: newLeft, top: newTop };
    }

    onHudMouseUp() {
      if (!this.isDragging) return;
      this.isDragging = false;
      this.hud.style.cursor = 'default';
    }

    renderHUD() {
      const isMulti = this.selectedElements.length > 1;
      let titleHtml = '';
      let metaHtml = '';
      let crumbsHtml = '';
      const crumbs = [];

      if (isMulti) {
        titleHtml = `<span style="color:#38bdf8;">${ICONS.multi}</span> Multi-selección (${this.selectedElements.length})`;
        metaHtml = `<span class="hud-meta-badge">${/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || '') ? '⌘' : 'Ctrl'}+Clic añadir</span>`;
      } else {
        const el = this.selectedElements[0];
        const rect = el.getBoundingClientRect();
        const tag = el.tagName.toLowerCase();
        const dims = `${Math.round(rect.width)} × ${Math.round(rect.height)} px`;
        const childCount = el.querySelectorAll('*').length;
        const idStr = el.id ? `#${el.id}` : '';

        // Detectar border-radius del elemento
        const cs = window.getComputedStyle(el);
        const rtl = Math.round(parseFloat(cs.borderTopLeftRadius) || 0);
        const rtr = Math.round(parseFloat(cs.borderTopRightRadius) || 0);
        const rbr = Math.round(parseFloat(cs.borderBottomRightRadius) || 0);
        const rbl = Math.round(parseFloat(cs.borderBottomLeftRadius) || 0);
        let radiusBadge = '';
        if (rtl > 0 || rtr > 0 || rbr > 0 || rbl > 0) {
          let rText = '';
          if (rtl === rtr && rtr === rbr && rbr === rbl) {
            const minDim = Math.min(rect.width, rect.height);
            if (minDim > 0 && rtl >= Math.floor(minDim / 2) - 2) {
              rText = 'rounded-full (pill)';
            } else {
              rText = `rounded-${rtl}px`;
            }
          } else {
            rText = `rounded [${rtl}, ${rtr}, ${rbr}, ${rbl}]px`;
          }
          radiusBadge = `<span class="hud-radius-badge" title="Border Radius detectado: ${rText}"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:-1px;margin-right:3px;display:inline-block;"><path d="M4 20V10a6 6 0 0 1 6-6h10"/></svg>${rText}</span>`;
        }

        titleHtml = `<span class="hud-tag-pill">&lt;${tag}&gt;</span> ${idStr ? `<span style="color:#e2e8f0;font-size:11px;">${escapeHtml(idStr)}</span>` : '<span style="color:#cbd5e1;font-size:11px;">Elemento</span>'}`;
        metaHtml = `<span class="hud-meta-badge">${dims}</span>${radiusBadge}<span class="hud-meta-badge">${childCount} capas</span>`;

        // Generar miga de pan jerárquica (DOM Breadcrumbs)
        let p = el.parentElement;
        while (p && p !== document.documentElement && crumbs.length < 4) {
          crumbs.unshift(p);
          p = p.parentElement;
        }
        if (crumbs.length > 0) {
          crumbsHtml =
            `<div class="hud-breadcrumbs" title="Miga de pan del DOM: haz clic en cualquier contenedor para seleccionarlo directamente">` +
            crumbs
              .map((c, i) => {
                const cTag = c.tagName.toLowerCase();
                const cId = c.id ? `#${c.id}` : '';
                const cCls =
                  c.className && typeof c.className === 'string' ? `.${c.className.trim().split(/\s+/)[0]}` : '';
                const label = `${cTag}${cId || (cCls !== '.' ? cCls : '')}`;
                return `<button class="hud-crumb-btn" data-crumb-idx="${i}">&lt;${escapeHtml(label)}&gt;</button><span class="hud-crumb-sep">›</span>`;
              })
              .join('') +
            `<span class="hud-crumb-current">&lt;${tag}&gt;</span></div>`;
        }
      }

      this.hud.innerHTML = `
        <div class="hud-header" id="__hud_header" title="Haz clic y arrastra para mover esta barra libremente por la pantalla">
          <div class="hud-title-group">
            <span class="hud-drag-pill">${ICONS.drag} Mover</span>
            <div class="hud-title">${titleHtml}</div>
          </div>
          <div style="display:flex;align-items:center;gap:7px;">
            <span id="__hud_figma_status" class="hud-status-pill waiting" title="Verificando conexión con Figma...">
              <span class="status-dot"></span> Verificando...
            </span>
            <div class="hud-meta">${metaHtml}</div>
          </div>
        </div>

        ${crumbsHtml}

        <div class="hud-nav-row">
          <div class="hud-nav-left">
            ${
              !isMulti
                ? `
              <div class="hud-hierarchy-group">
                <button class="btn-hierarchy" id="__btn_hud_parent" title="Seleccionar contenedor padre (Flecha arriba)">${ICONS.arrowUp} Padre <span class="hud-kbd">↑</span></button>
                <button class="btn-hierarchy" id="__btn_hud_child" title="Seleccionar elemento hijo (Flecha abajo)">${ICONS.arrowDown} Hijo <span class="hud-kbd">↓</span></button>
                <button class="btn-hierarchy" id="__btn_hud_body" title="Seleccionar la página completa (${document.body ? 'body' : 'html'})">${ICONS.layers} Toda la Página</button>
                <button class="btn-hierarchy" id="__btn_hud_theme" title="Alternar Modo Claro / Oscuro en la página">${ICONS.sun} Tema</button>
                <button class="btn-hierarchy" id="__btn_hud_scan" title="Recorrer las páginas de este sitio y llevarlas todas a Figma (tecla S)">${ICONS.layers} Escanear sitio <span class="hud-kbd">S</span></button>
              </div>
            `
                : `
              <span style="color:#38bdf8;font-weight:600;">${ICONS.multi} ${this.selectedElements.length} elementos agrupados listos para Figma</span>
            `
            }
          </div>

          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            <label class="hud-component-toggle" title="Extraer también la variante interactiva :hover si está definida en el CSS">
              <input type="checkbox" id="__chk_hover" ${this.extractHover ? 'checked' : ''} />
              <span>${ICONS.sparkle} Hover</span>
            </label>

            <label class="hud-component-toggle" title="Incluir imágenes rasterizadas y avatares en la extracción">
              <input type="checkbox" id="__chk_images" ${this.includeImages ? 'checked' : ''} />
              <span>${ICONS.image} Imágenes</span>
            </label>

            <label class="hud-component-toggle" title="Enviar también a 375 y 768 px como variantes Breakpoint=… (con los @media de la página)">
              <input type="checkbox" id="__chk_breakpoints" ${this.extractBreakpoints ? 'checked' : ''} />
              <span>${ICONS.devices} Breakpoints</span>
            </label>

            <label class="hud-component-toggle" title="Capturar también el tema oscuro: los colores llegan como Variables con modos Light y Dark">
              <input type="checkbox" id="__chk_themes" ${this.extractThemes ? 'checked' : ''} />
              <span>${ICONS.moon} Claro/Oscuro</span>
            </label>

            <label class="hud-component-toggle" title="Crear en Figma como Componente reutilizable oficial (figma.createComponent)">
              <input type="checkbox" id="__chk_component" ${this.createAsComponent ? 'checked' : ''} />
              <span>${ICONS.component} Componente</span>
            </label>
          </div>
        </div>

        <div class="hud-buttons">
          <button class="btn-figma" id="__btn_send_figma" title="Extraer y enviar este diseño directamente a Figma">${ICONS.figma} Enviar a Figma <span class="hud-kbd" style="color:#fff;background:rgba(255,255,255,0.2);border-color:transparent;">↵</span></button>
          <button class="btn-secondary" id="__btn_freeze" title="Pausa animaciones y menús desplegables para inspeccionarlos">${ICONS.snowflake} ${this.isFrozen ? 'Descongelar' : 'Congelar'} <span class="hud-kbd">F</span></button>
          <button class="btn-secondary" id="__btn_copy_json" title="Copiar el JSON exportado al portapapeles">${ICONS.copy} Copiar JSON</button>
          <button class="btn-secondary" id="__btn_export_html" title="Exportar este bloque como HTML + CSS + JS que funciona fuera de la página">${ICONS.code} Exportar HTML</button>
          <button class="btn-secondary" id="__btn_compare" title="Comparar este bloque con el frame seleccionado en Figma y listar las diferencias">${ICONS.compare} Comparar con Figma</button>
          <button class="btn-secondary" id="__btn_cancel" title="Cancelar selección (Esc)">${ICONS.close} Cancelar <span class="hud-kbd">Esc</span></button>
        </div>
      `;

      // Fluid Viewport Positioning: centered and fully visible within viewport
      const vpW = window.innerWidth || document.documentElement.clientWidth || 1280;
      const vpH = window.innerHeight || document.documentElement.clientHeight || 800;
      const hudEstWidth = Math.min(620, vpW - 24);
      const hudEstHeight = 145;

      let hudTop;
      let hudLeft;

      if (this.userCustomPos) {
        hudLeft = Math.max(12, Math.min(vpW - hudEstWidth - 12, this.userCustomPos.left));
        hudTop = Math.max(12, Math.min(vpH - hudEstHeight - 12, this.userCustomPos.top));
      } else {
        hudTop = vpH - hudEstHeight - 24;
        hudLeft = (vpW - hudEstWidth) / 2;
      }

      hudTop = Math.max(12, Math.min(vpH - hudEstHeight - 12, hudTop));
      hudLeft = Math.max(12, Math.min(vpW - hudEstWidth - 12, hudLeft));

      this.hud.style.top = `${Math.round(hudTop)}px`;
      this.hud.style.left = `${Math.round(hudLeft)}px`;
      this.hud.style.display = 'block';

      // La altura estimada se queda corta en cuanto los botones pasan a otra línea (ventanas bajas o
      // estrechas): con la medida real el HUD entero queda dentro de la ventana
      const realH = this.hud.offsetHeight || hudEstHeight;
      const realW = this.hud.offsetWidth || hudEstWidth;
      if (realH !== hudEstHeight || realW !== hudEstWidth) {
        const maxTop = Math.max(12, vpH - realH - 12);
        const top = this.userCustomPos ? Math.min(hudTop, maxTop) : Math.max(12, vpH - realH - 24);
        const left = Math.max(12, Math.min(vpW - realW - 12, this.userCustomPos ? hudLeft : (vpW - realW) / 2));
        this.hud.style.top = `${Math.round(Math.min(top, maxTop))}px`;
        this.hud.style.left = `${Math.round(left)}px`;
      }

      // Attach Drag & Drop listener to header
      const header = this.hud.querySelector('#__hud_header');
      if (header) {
        header.addEventListener('mousedown', this.onHudMouseDown);
      }

      // Attach button & toggle events
      const btnSend = this.hud.querySelector('#__btn_send_figma');
      const btnFreeze = this.hud.querySelector('#__btn_freeze');
      const btnCopy = this.hud.querySelector('#__btn_copy_json');
      const btnExportHtml = this.hud.querySelector('#__btn_export_html');
      const btnCompare = this.hud.querySelector('#__btn_compare');
      if (btnCompare) btnCompare.addEventListener('click', () => this.compareWithFigma());
      const btnCancel = this.hud.querySelector('#__btn_cancel');
      const chkComponent = this.hud.querySelector('#__chk_component');
      const chkHover = this.hud.querySelector('#__chk_hover');
      const chkImages = this.hud.querySelector('#__chk_images');
      const chkBreakpoints = this.hud.querySelector('#__chk_breakpoints');
      const chkThemes = this.hud.querySelector('#__chk_themes');
      if (chkBreakpoints) chkBreakpoints.addEventListener('change', e => (this.extractBreakpoints = e.target.checked));
      if (chkThemes) chkThemes.addEventListener('change', e => (this.extractThemes = e.target.checked));
      const btnTheme = this.hud.querySelector('#__btn_hud_theme');
      const btnParent = this.hud.querySelector('#__btn_hud_parent');
      const btnChild = this.hud.querySelector('#__btn_hud_child');
      const btnBody = this.hud.querySelector('#__btn_hud_body');

      if (btnSend) btnSend.addEventListener('click', () => this.sendToFigma());
      if (btnFreeze)
        btnFreeze.addEventListener('click', () => {
          this.toggleFreeze();
          this.renderHUD();
        });
      if (btnCopy) btnCopy.addEventListener('click', () => this.copyJson());
      if (btnExportHtml) btnExportHtml.addEventListener('click', () => this.exportHtml());
      if (btnCancel) btnCancel.addEventListener('click', () => this.cancelElevation());

      if (chkComponent) {
        chkComponent.addEventListener('change', e => {
          this.createAsComponent = e.target.checked;
        });
      }

      if (chkHover) {
        chkHover.addEventListener('change', e => {
          this.extractHover = e.target.checked;
        });
      }

      if (chkImages) {
        chkImages.addEventListener('change', e => {
          this.includeImages = e.target.checked;
        });
      }

      if (btnTheme) {
        btnTheme.addEventListener('click', () => this.toggleTheme());
      }

      const btnScan = this.hud.querySelector('#__btn_hud_scan');
      if (btnScan) btnScan.addEventListener('click', () => this.startSiteScan());

      if (btnParent) btnParent.addEventListener('click', () => this.elevateParent());
      if (btnChild) btnChild.addEventListener('click', () => this.elevateChild());
      if (btnBody) {
        btnBody.addEventListener('click', () => {
          const body = document.body || document.documentElement;
          if (body) {
            this.selectedElements = [body];
            this.elevateElements(this.selectedElements);
          }
        });
      }

      const crumbBtns = this.hud.querySelectorAll('.hud-crumb-btn');
      crumbBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-crumb-idx'), 10);
          if (!isNaN(idx) && crumbs[idx]) {
            this.selectedElements = [crumbs[idx]];
            this.elevateElements(this.selectedElements);
          }
        });
      });

      this.updateFigmaStatusUI();
    }

    toggleTheme() {
      const root = document.documentElement;
      const body = document.body;
      const isDark =
        root.classList.contains('dark') ||
        root.classList.contains('dark-theme') ||
        root.classList.contains('dark-mode') ||
        root.getAttribute('data-theme') === 'dark' ||
        root.getAttribute('data-bs-theme') === 'dark' ||
        root.getAttribute('data-color-mode') === 'dark' ||
        (body && (body.classList.contains('dark') || body.classList.contains('dark-theme')));

      if (isDark) {
        root.classList.remove('dark', 'dark-theme', 'dark-mode');
        if (body) body.classList.remove('dark', 'dark-theme', 'dark-mode');
        root.setAttribute('data-theme', 'light');
        root.setAttribute('data-bs-theme', 'light');
        root.setAttribute('data-color-mode', 'light');
        this.showToast('☀️ Modo Claro activado', 'Se cambió la página a tema claro.', 2500);
      } else {
        root.classList.add('dark');
        if (body) body.classList.add('dark');
        root.setAttribute('data-theme', 'dark');
        root.setAttribute('data-bs-theme', 'dark');
        root.setAttribute('data-color-mode', 'dark');
        this.showToast('🌙 Modo Oscuro activado', 'Se cambió la página a tema oscuro.', 2500);
      }

      if (this.isElevated && this.selectedElements.length > 0) {
        setTimeout(() => {
          this.renderSpotlights(this.selectedElements);
          this.renderHUD();
        }, 50);
      }
    }

    cancelElevation() {
      if (!this.isElevated) return;

      this.unliftElements();
      this.spotlightBox.style.display = 'none';
      this.multiBoxesHost.innerHTML = '';
      this.backdrop.classList.remove('visible');
      this.hud.style.display = 'none';
      this.isElevated = false;
      this.selectedEl = null;
      this.selectedElements = [];

      if (this.hoveredEl) {
        this.updateHighlight(this.hoveredEl);
      }
    }

    async sendToFigma() {
      if (this.selectedElements.length === 0) return;
      if (!extensionAlive()) return this.retire();

      const btn = this.hud.querySelector('#__btn_send_figma');
      if (btn) {
        btn.innerHTML = `${ICONS.spinner} Extrayendo componentes e imágenes...`;
        btn.disabled = true;
      }

      try {
        if (!window.__codeToFigmaExtract) {
          throw new Error('Motor de extracción no cargado en la página');
        }

        let rootNode;
        let tokens;
        let states;
        let responsive;
        let captureNotes = [];
        const wantsBoard = this.shouldBuildBoard(this.selectedElements);

        // La elevación altera posiciones y tamaños: quitarla mientras se mide
        const relift = await this.suspendLift();
        try {
          await this.prepareForExtraction(this.selectedElements, pct => {
            if (btn) btn.innerHTML = `${ICONS.spinner} Recorriendo la página… ${pct}%`;
          });
          if (btn) btn.innerHTML = `${ICONS.spinner} Extrayendo componentes e imágenes...`;

          if (this.selectedElements.length === 1) {
            const res = await window.__codeToFigmaExtract(this.selectedElements[0]);
            if (!res) throw new Error('No se pudo estructurar el componente');
            rootNode = res.rootNode || res;
            tokens = res.tokens;

            // Estado hover del componente (fase 6.1): si las hojas de estilo de la página lo
            // definen, se envía como variante State=Hover. Solo componentes (no tableros) y de
            // tamaño razonable; si el hover no cambia nada visible, se descarta.
            const el = this.selectedElements[0];
            const er = el.getBoundingClientRect();

            // Breakpoints y claro/oscuro (Función A): el bloque a otros anchos y en el otro tema
            if (!wantsBoard && (this.extractBreakpoints || this.extractThemes) && window.__codeToFigmaCaptureVariants) {
              if (btn) btn.innerHTML = `${ICONS.spinner} Capturando breakpoints y tema…`;
              try {
                const cap = await window.__codeToFigmaCaptureVariants(el, {
                  breakpoints: this.extractBreakpoints,
                  themes: this.extractThemes,
                  frameUrl: chrome.runtime.getURL('render-frame.html'),
                  getToken: () => this.renderFrameToken(),
                  liveRootNode: rootNode,
                });
                if (cap && cap.variants && cap.variants.length) {
                  responsive = { variants: cap.variants, themeSource: cap.themeSource || null };
                  // El bloque principal: la variante más ancha en tema claro
                  rootNode = cap.variants[cap.variants.length - 1].rootNode;
                  captureNotes = cap.warnings || [];
                }
              } catch (capErr) {
                console.warn('[CodeToFigma] Breakpoints/tema no capturados:', capErr);
                captureNotes = [
                  `Breakpoints y tema no capturados (${capErr?.message || capErr}); se envía el bloque normal.`,
                ];
              }
            }
            if (
              !responsive &&
              !wantsBoard &&
              this.extractHover &&
              window.__codeToFigmaExtractState &&
              er.width * er.height <= innerWidth * innerHeight
            ) {
              try {
                const hover = await window.__codeToFigmaExtractState(el, 'hover');
                if (hover && hover.rootNode && JSON.stringify(hover.rootNode) !== JSON.stringify(rootNode)) {
                  // transition: duración y curva CSS del cambio → Smart Animate en Figma
                  states = [{ name: 'Hover', rootNode: hover.rootNode, transition: hover.transition || null }];
                }
              } catch (_e) {}
            }
          } else {
            // Multi-selection: Extract all selected elements and bundle in a parent frame
            const results = await Promise.all(this.selectedElements.map(el => window.__codeToFigmaExtract(el)));
            const validNodes = [];
            for (const r of results) {
              if (r) {
                const node = r.rootNode || r;
                validNodes.push(node);
                if (!tokens && r.tokens) tokens = r.tokens;
              }
            }
            if (validNodes.length === 0) {
              throw new Error('No se pudo extraer ningún componente de la selección');
            }

            let minLeft = Infinity;
            let minTop = Infinity;
            let maxRight = -Infinity;
            let maxBottom = -Infinity;

            for (const el of this.selectedElements) {
              const r = el.getBoundingClientRect();
              minLeft = Math.min(minLeft, r.left);
              minTop = Math.min(minTop, r.top);
              maxRight = Math.max(maxRight, r.right);
              maxBottom = Math.max(maxBottom, r.bottom);
            }

            const children = validNodes.map((childNode, idx) => {
              const el = this.selectedElements[idx];
              const r = el.getBoundingClientRect();
              if (!childNode.layout) childNode.layout = {};
              childNode.layout.x = Math.round(r.left - minLeft);
              childNode.layout.y = Math.round(r.top - minTop);
              childNode.layout.positioning = 'ABSOLUTE';
              return childNode;
            });

            const totalW = Math.max(100, Math.round(maxRight - minLeft));
            const totalH = Math.max(50, Math.round(maxBottom - minTop));

            rootNode = {
              id: 'multi_selection_bundle_' + Date.now(),
              name: `Multi-selection (${children.length} componentes)`,
              type: this.createAsComponent ? 'COMPONENT' : 'FRAME',
              layout: {
                mode: 'NONE',
                width: totalW,
                height: totalH,
                measuredWidth: totalW,
                measuredHeight: totalH,
                padding: { top: 0, right: 0, bottom: 0, left: 0 },
                itemSpacing: 0,
              },
              styles: {
                fills: [],
              },
              children,
            };
          }
        } finally {
          // Medición terminada: quitar los estados "reveal" forzados y devolver la elevación
          this.restoreReveals();
          if (this.isElevated) relift();
        }

        // Peso de la extracción: avisar antes de enviar algo que Figma puede tardar en dibujar
        const payloadApi = window.__codeToFigmaPayload;
        let stats = null;

        // Breakpoints y tema: el resto de árboles viaja con el principal (mismas reglas de imágenes y peso)
        const stripResponsive = () => {
          if (!responsive || !payloadApi?.withoutImages) return;
          responsive.variants = responsive.variants.map(v => ({
            ...v,
            rootNode: payloadApi.withoutImages(v.rootNode),
            dark: v.dark ? payloadApi.withoutImages(v.dark) : undefined,
          }));
          rootNode = responsive.variants[responsive.variants.length - 1].rootNode;
        };
        const measureAll = () =>
          responsive
            ? payloadApi.measurePayload({
                children: responsive.variants.flatMap(v => (v.dark ? [v.rootNode, v.dark] : [v.rootNode])),
              })
            : payloadApi.measurePayload(rootNode);

        // Si el usuario desmarcó "Imágenes" en el HUD, eliminarlas del payload para extracción ultraligera
        if (!this.includeImages && payloadApi?.withoutImages && rootNode) {
          rootNode = payloadApi.withoutImages(rootNode);
          stripResponsive();
        }
        if (payloadApi) {
          stats = measureAll();
          const reasons = payloadApi.heavyPayloadReasons(stats);
          if (reasons.length) {
            const choice = await this.askHeavyPayload(stats, reasons);
            if (choice === 'cancel' || choice === 'pick') {
              this.resetSendButton(btn);
              if (choice === 'pick') {
                this.showToast(
                  `${ICONS.info} Elige un bloque más pequeño`,
                  'Con ↑ y ↓ subes o bajas de nivel en la selección; luego Enter para enviar.',
                  5000,
                );
              }
              return;
            }
            if (choice === 'noimages') {
              rootNode = payloadApi.withoutImages(rootNode);
              stripResponsive();
              stats = measureAll();
            }
          }
        }

        if (btn) btn.innerHTML = `${ICONS.spinner} Transmitiendo a Figma...`;

        await this.transmitToWebSocket({
          rootNode,
          tokens,
          createAsComponent: this.createAsComponent,
          // Landing completa o varios componentes → Figma lo organiza como design system
          board: wantsBoard,
          states: responsive ? undefined : states,
          responsive,
          source: { url: location.href, title: document.title },
        });

        // Visual success pulse
        this.spotlightBox.style.borderColor = '#10b981';
        this.spotlightBox.style.boxShadow = '0 0 45px rgba(16, 185, 129, 0.65)';

        if (btn) {
          btn.innerHTML = `${ICONS.check} ¡Enviado a Figma con éxito!`;
          btn.style.background = '#10b981';
          btn.style.borderColor = '#059669';
        }

        const stateNote = responsive
          ? ` (${responsive.variants.map(v => v.name).join(', ')}${responsive.variants.some(v => v.dark) ? ' · claro y oscuro' : ''})`
          : states
            ? ' con estado Hover'
            : '';
        for (const note of captureNotes) this.showToast(`${ICONS.info} Breakpoints y tema`, note, 6000);
        const sizeNote =
          stats && payloadApi
            ? ` (${payloadApi.formatBytes(stats.bytes)}, ${stats.nodes.toLocaleString('es')} capas)`
            : '';
        this.showToast(
          `${ICONS.check} Enviado a Figma con éxito`,
          `"${rootNode.name}"${stateNote} transmitido correctamente${sizeNote}.`,
          4000,
        );

        setTimeout(() => {
          if (btn) {
            btn.innerHTML = `${ICONS.figma} Enviar a Figma <span style="opacity:0.75;font-size:10px">[Enter]</span>`;
            btn.style.background = '';
            btn.style.borderColor = '';
            btn.disabled = false;
          }
          // Regresar al modo inspector para poder seguir seleccionando componentes sin desactivar
          this.cancelElevation();
        }, 1200);
      } catch (err) {
        console.error('[CodeToFigma] Error enviando a Figma:', err);
        this.resetSendButton(btn);
        const msg = String(err?.message || err);
        if (msg.includes('Hub') || msg.includes('WebSocket') || msg.includes('8080') || msg.includes('conect')) {
          this.showToast(
            `${ICONS.warning} Hub no detectado en puerto 8080`,
            "Asegúrate de que Code to Figma Hub esté abierto (o ejecuta 'npm run start:hub'). También puedes usar 'Copiar JSON' para pegar en Figma.",
            5500,
          );
        } else if (msg.includes('versión anterior')) {
          this.showToast(`${ICONS.warning} Actualiza Code to Figma`, msg, 9000);
        } else {
          this.showToast(`${ICONS.warning} Error de extracción`, msg, 5500);
        }
      }
    }

    resetSendButton(btn) {
      if (!btn) return;
      btn.innerHTML = `${ICONS.figma} Enviar a Figma <span style="opacity:0.75;font-size:10px">[Enter]</span>`;
      btn.disabled = false;
    }

    /**
     * Aviso de selección pesada (fase 5.1). Resuelve 'full' | 'noimages' | 'pick' | 'cancel'.
     * Esc = cancelar (lo atiende onKeyDown mientras el aviso está abierto).
     */
    askHeavyPayload(stats, reasons) {
      const fmt = window.__codeToFigmaPayload.formatBytes;
      return new Promise(resolve => {
        const backdrop = document.createElement('div');
        backdrop.className = 'heavy-backdrop';
        const items = reasons.map(r => `<li>${escapeHtml(r)}</li>`).join('');
        const canStrip = stats.images > 0;
        backdrop.innerHTML = `
          <div class="heavy-dialog" role="dialog" aria-modal="true" aria-labelledby="__heavy_title">
            <h3 id="__heavy_title">${ICONS.warning} Selección muy pesada</h3>
            <p>Figma puede tardar bastante en dibujarla o quedarse sin memoria:</p>
            <ul>${items}</ul>
            <div class="heavy-stats">${stats.nodes.toLocaleString('es')} capas · ${stats.images} imágenes (${fmt(stats.imageBytes)}) · ${stats.depth} niveles · ${fmt(stats.bytes)} en total</div>
            <div class="heavy-actions">
              <button class="btn-secondary" data-choice="cancel">Cancelar</button>
              <button class="btn-secondary" data-choice="pick">Elegir un bloque</button>
              ${canStrip ? '<button class="btn-secondary" data-choice="noimages">Enviar sin imágenes</button>' : ''}
              <button class="btn-figma" data-choice="full">Enviar completo</button>
            </div>
          </div>`;
        const close = choice => {
          this.activeDialog = null;
          backdrop.remove();
          resolve(choice);
        };
        backdrop.addEventListener('click', e => {
          const target = e.target.closest ? e.target.closest('[data-choice]') : null;
          if (target) close(target.getAttribute('data-choice'));
          else if (e.target === backdrop) close('cancel');
        });
        this.activeDialog = { cancel: () => close('cancel') };
        this.shadow.appendChild(backdrop);
        const primary = backdrop.querySelector('[data-choice="full"]');
        if (primary) primary.focus();
      });
    }

    /**
     * Envía al hub SIEMPRE a través del service worker de la extensión. Un WebSocket abierto
     * desde la página llevaría el origen del sitio: el hub lo rechaza por seguridad y el CSP
     * de muchos sitios también lo bloquea.
     */
    transmitToWebSocket(payloadData) {
      return new Promise((resolve, reject) => {
        if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
          return reject(new Error('La extensión no está disponible en esta pestaña. Recarga la página.'));
        }
        chrome.runtime.sendMessage({ type: 'TRANSMIT_TO_FIGMA', payload: payloadData, clearPage: false }, response => {
          if (chrome.runtime.lastError) {
            return reject(new Error('La extensión se recargó o no responde. Recarga la página e inténtalo de nuevo.'));
          }
          if (response && response.success) resolve(true);
          else reject(new Error(response?.error || 'Error al transmitir a través del service worker'));
        });
      });
    }

    async copyJson() {
      if (this.selectedElements.length === 0) return;
      try {
        let dataToCopy;
        const relift = await this.suspendLift();
        try {
          await this.prepareForExtraction(this.selectedElements);
          if (this.selectedElements.length === 1) {
            dataToCopy = await window.__codeToFigmaExtract(this.selectedElements[0]);
          } else {
            dataToCopy = await Promise.all(this.selectedElements.map(el => window.__codeToFigmaExtract(el)));
          }
        } finally {
          this.restoreReveals();
          if (this.isElevated) relift();
        }
        if (!this.includeImages && window.__codeToFigmaPayload?.withoutImages && dataToCopy) {
          if (dataToCopy.rootNode) {
            dataToCopy.rootNode = window.__codeToFigmaPayload.withoutImages(dataToCopy.rootNode);
          } else if (Array.isArray(dataToCopy)) {
            dataToCopy = dataToCopy.map(d =>
              d && d.rootNode ? { ...d, rootNode: window.__codeToFigmaPayload.withoutImages(d.rootNode) } : d,
            );
          }
        }
        const json = JSON.stringify(dataToCopy, null, 2);
        navigator.clipboard.writeText(json).then(() => {
          this.showToast(
            `${ICONS.copy} JSON copiado al portapapeles`,
            'Pégalo en el plugin de Figma directamente.',
            3000,
          );
        });
      } catch (err) {
        console.error(err);
      }
    }

    /**
     * Exportar el bloque como HTML + CSS + JS (extractor: export-html.ts). Se mide como al enviar a
     * Figma (sin la elevación, con lo perezoso cargado y las animaciones de aparición congeladas).
     */
    async exportHtml() {
      if (this.selectedElements.length === 0) return;
      if (!extensionAlive()) return this.retire();
      if (!window.__codeToFigmaExportHtml) {
        this.showToast(
          `${ICONS.warning} Exportar HTML`,
          'Motor de extracción no cargado en la página. Recárgala.',
          4500,
        );
        return;
      }
      if (this.selectedElements.length > 1) {
        this.showToast(
          `${ICONS.info} Exportar HTML`,
          'Exporta un solo bloque cada vez: elige su contenedor común con ↑.',
          4500,
        );
        return;
      }
      const btn = this.hud.querySelector('#__btn_export_html');
      const label = `${ICONS.code} Exportar HTML`;
      const setBtn = html => {
        if (btn) btn.innerHTML = html;
      };
      if (btn) btn.disabled = true;
      setBtn(`${ICONS.spinner} Exportando…`);
      try {
        let res;
        const relift = await this.suspendLift();
        try {
          await this.prepareForExtraction(this.selectedElements, pct =>
            setBtn(`${ICONS.spinner} Recorriendo… ${pct}%`),
          );
          setBtn(`${ICONS.spinner} Copiando reglas y verificando…`);
          // Los reveals forzados para medir vuelven a su estado oculto y se animan en la exportación
          const reveals = (this.revealOverrides || []).map(({ el, hidden, visible, transition }) => ({
            el,
            hidden,
            visible,
            transition,
          }));
          res = await window.__codeToFigmaExportHtml(this.selectedElements[0], { reveals });
        } finally {
          this.restoreReveals();
          if (this.isElevated) relift();
        }
        if (!res) throw new Error('No se pudo exportar el bloque');
        setBtn(label);
        const choice = await this.askExportFormat(res);
        if (choice === 'zip') {
          const zip = window.__codeToFigmaZip(res.files);
          this.downloadFile(zip, `${res.baseName}.zip`, 'application/zip');
          const extra = res.js ? ' y script.js' : '';
          this.showToast(`${ICONS.check} ZIP descargado`, `${res.baseName}.zip: index.html, styles.css${extra}.`, 4000);
        } else if (choice === 'html') {
          this.downloadFile(res.singleFile, `${res.baseName}.html`, 'text/html');
          this.showToast(`${ICONS.check} HTML descargado`, `${res.baseName}.html (CSS y JS dentro del archivo).`, 4000);
        } else if (choice === 'copy') {
          await navigator.clipboard.writeText(res.singleFile);
          this.showToast(
            `${ICONS.copy} HTML copiado`,
            'Un solo archivo con el CSS y el JS dentro, listo para pegar.',
            3500,
          );
        }
      } catch (err) {
        console.error('[CodeToFigma] Error exportando HTML:', err);
        this.showToast(`${ICONS.warning} Error al exportar HTML`, String((err && err.message) || err), 5500);
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = label;
        }
      }
    }

    /**
     * QA de diseño (Función B): compara el bloque con el frame seleccionado en Figma. Una pantalla
     * completa se captura con una ventana del ancho del frame; un componente, tal como se ve ahora.
     */
    async compareWithFigma() {
      if (this.selectedElements.length !== 1) {
        this.showToast(`${ICONS.info} Comparar con Figma`, 'Selecciona un solo bloque para comparar.', 4000);
        return;
      }
      if (!extensionAlive()) return this.retire();
      const btn = this.hud.querySelector('#__btn_compare');
      const label = `${ICONS.compare} Comparar con Figma`;
      const setBtn = html => {
        if (btn) btn.innerHTML = html;
      };
      const ask = (type, extra = {}) =>
        new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({ type, ...extra }, res => {
            if (chrome.runtime.lastError) return reject(new Error('La extensión no responde. Recarga la página.'));
            if (!res || !res.success) return reject(new Error((res && res.error) || 'Sin respuesta'));
            resolve(res);
          });
        });
      if (btn) btn.disabled = true;
      setBtn(`${ICONS.spinner} Preguntando a Figma…`);
      try {
        const { selection } = await ask('QUERY_FIGMA_SELECTION');
        if (!selection)
          throw new Error('En Figma, selecciona el frame de diseño con el que comparar y vuelve a pulsar.');
        const el = this.selectedElements[0];
        const fullWidth = el.getBoundingClientRect().width >= innerWidth - 24;
        let rootNode;
        const relift = await this.suspendLift();
        try {
          await this.prepareForExtraction([el], pct => setBtn(`${ICONS.spinner} Recorriendo… ${pct}%`));
          setBtn(`${ICONS.spinner} Capturando a ${fullWidth ? selection.width : Math.round(innerWidth)} px…`);
          if (fullWidth && Math.abs(selection.width - innerWidth) > 2 && window.__codeToFigmaExtractAtWidth) {
            rootNode = await window.__codeToFigmaExtractAtWidth(el, selection.width, {
              frameUrl: chrome.runtime.getURL('render-frame.html'),
              getToken: () => this.renderFrameToken(),
            });
          } else {
            const res = await window.__codeToFigmaExtract(el);
            rootNode = res && res.rootNode;
          }
        } finally {
          this.restoreReveals();
          if (this.isElevated) relift();
        }
        if (!rootNode) throw new Error('No se pudo extraer el bloque');
        // Con imágenes, para verlas en "Producción" y comparar cuáles son. Sin ellas si el usuario
        // desmarcó "Imágenes" o si pesan tanto que Figma tardaría en dibujarlas.
        const api = window.__codeToFigmaPayload;
        let imageNote = '';
        if (api?.withoutImages && !this.includeImages) {
          rootNode = api.withoutImages(rootNode);
        } else if (api?.withoutImages && api.measurePayload && api.measurePayload(rootNode).bytes > COMPARE_MAX_BYTES) {
          rootNode = api.withoutImages(rootNode);
          imageNote = ' Se comparó sin imágenes: pesaban demasiado.';
        }
        setBtn(`${ICONS.spinner} Comparando en Figma…`);
        const { qa } = await ask('COMPARE_IN_FIGMA', {
          payload: {
            rootNode,
            compare: {
              targetNodeId: selection.id,
              width: selection.width,
              viewportWidth: Math.round(innerWidth),
              fullWidth,
            },
            source: { url: location.href, title: document.title },
          },
        });
        const total = qa.total || 0;
        const head = total
          ? `${total} diferencia${total === 1 ? '' : 's'}${qa.groups && qa.groups < total ? ` de ${qa.groups} tipo${qa.groups === 1 ? '' : 's'}` : ''} con "${selection.name}" (${qa.alta || 0} altas, ${qa.media || 0} medias, ${qa.baja || 0} bajas)`
          : `Sin diferencias medibles con "${selection.name}"`;
        const top = (qa.top || []).slice(0, 3).join(' · ');
        this.showToast(
          `${ICONS.compare} QA de diseño`,
          `${head}. ${top ? top + ' · ' : ''}Informe completo en Figma.${imageNote}`,
          9000,
        );
      } catch (err) {
        this.showToast(`${ICONS.warning} Comparar con Figma`, String((err && err.message) || err), 6000);
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = label;
        }
      }
    }

    /** Resumen de la exportación y formato. Resuelve 'zip' | 'html' | 'copy' | 'cancel' */
    askExportFormat(res) {
      const s = res.stats;
      const kb = n => `${Math.max(1, Math.round(n / 1024)).toLocaleString('es')} KB`;
      const widgetNames = { tabs: 'pestañas', disclosure: 'desplegables' };
      const widgets = Array.from(
        new Set(s.widgets.map(w => widgetNames[w] || (w.startsWith('bootstrap') ? 'componentes de Bootstrap' : w))),
      );
      const fidelity = s.verified
        ? `Verificado en esta página: ${String(s.fidelity).replace('.', ',')} % de los elementos en su sitio` +
          (s.patchedElements ? ` · ${s.patchedElements} con ajustes medidos` : '')
        : 'Sin verificar';
      const notes = [
        widgets.length ? `JS incluido para: ${widgets.join(', ')}.` : 'Sin interacciones estándar que activar con JS.',
        ...s.warnings,
      ];
      return new Promise(resolve => {
        const backdrop = document.createElement('div');
        backdrop.className = 'heavy-backdrop';
        backdrop.innerHTML = `
          <div class="heavy-dialog export-dialog" role="dialog" aria-modal="true" aria-labelledby="__export_title">
            <h3 id="__export_title">${ICONS.code} Exportar HTML</h3>
            <p>"${escapeHtml(res.baseName)}": ${s.elements.toLocaleString('es')} elementos y ${s.rules.toLocaleString('es')} reglas CSS de la página (de ${s.totalRules.toLocaleString('es')}), con sus @media, :hover y animaciones.</p>
            <ul>${notes.map(n => `<li>${escapeHtml(n)}</li>`).join('')}</ul>
            <div class="heavy-stats">${escapeHtml(fidelity)} · ${kb(res.singleFile.length)}</div>
            <div class="heavy-actions">
              <button class="btn-secondary" data-choice="cancel">Cancelar</button>
              <button class="btn-secondary" data-choice="copy">${ICONS.copy} Copiar HTML</button>
              <button class="btn-secondary" data-choice="html">HTML único</button>
              <button class="btn-figma" data-choice="zip">ZIP (HTML + CSS + JS)</button>
            </div>
          </div>`;
        const close = choice => {
          this.activeDialog = null;
          backdrop.remove();
          resolve(choice);
        };
        backdrop.addEventListener('click', e => {
          const target = e.target.closest ? e.target.closest('[data-choice]') : null;
          if (target) close(target.getAttribute('data-choice'));
          else if (e.target === backdrop) close('cancel');
        });
        this.activeDialog = { cancel: () => close('cancel') };
        this.shadow.appendChild(backdrop);
        const primary = backdrop.querySelector('[data-choice="zip"]');
        if (primary) primary.focus();
      });
    }

    /** Descarga un archivo generado (texto o bytes) sin pasar por ningún servidor */
    downloadFile(data, filename, mime) {
      const url = URL.createObjectURL(new Blob([data], { type: mime }));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      (document.body || document.documentElement).appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }

    /** Token de un solo uso para la página de render (breakpoints y tema) */
    renderFrameToken() {
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'RENDER_FRAME_TOKEN' }, res => {
          if (chrome.runtime.lastError || !res || !res.success)
            reject(new Error('El service worker no dio token de render'));
          else resolve(res.token);
        });
      });
    }

    /** Texto de una hoja de estilo de otro dominio, descargada por el service worker (o null) */
    fetchStylesheet(url) {
      return new Promise(resolve => {
        if (!extensionAlive()) return resolve(null);
        try {
          chrome.runtime.sendMessage({ type: 'FETCH_STYLESHEET', url }, res =>
            resolve(chrome.runtime.lastError || !res || !res.success ? null : res.text),
          );
        } catch (_e) {
          resolve(null);
        }
      });
    }

    onKeyDown(e) {
      // Con el aviso de selección pesada abierto, el teclado solo sirve para cerrarlo
      if (this.activeDialog) {
        if (e.key === 'Escape') {
          e.preventDefault();
          this.activeDialog.cancel();
        }
        return;
      }
      // Don't intercept if user is typing in an input or textarea
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      const isInput = activeTag === 'input' || activeTag === 'textarea' || document.activeElement?.isContentEditable;

      if (e.key === 'Escape') {
        if (this.isElevated) {
          this.cancelElevation();
        } else {
          this.destroy();
        }
        return;
      }

      // Escanear el sitio: S
      if ((e.key === 's' || e.key === 'S') && !isInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        this.startSiteScan();
        return;
      }

      // Freeze Mode Hotkeys: 'f', 'F', or Space (when not typing in an input)
      if (
        (e.key === 'f' || e.key === 'F' || e.code === 'KeyF' || (e.code === 'Space' && !this.isElevated)) &&
        !isInput
      ) {
        e.preventDefault();
        e.stopPropagation();
        this.toggleFreeze();
        if (this.isElevated) this.renderHUD();
        return;
      }

      if (e.key === 'Enter' && this.isElevated && !isInput) {
        e.preventDefault();
        this.sendToFigma();
        return;
      }

      if (this.isElevated && this.selectedElements.length === 1 && !isInput) {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.elevateParent();
          return;
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.elevateChild();
          return;
        }
      }

      if (!this.isElevated && this.hoveredEl && !isInput) {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (this.hoveredEl.parentElement && this.hoveredEl.parentElement !== document.documentElement) {
            this.hoveredEl = this.hoveredEl.parentElement;
            this.updateHighlight(this.hoveredEl);
          }
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          const firstChild = this.hoveredEl.querySelector('article, section, div, button, nav, form, figure');
          if (firstChild) {
            this.hoveredEl = firstChild;
            this.updateHighlight(this.hoveredEl);
          }
        }
      }
    }

    onScrollOrResize() {
      if (this.isElevated && this.selectedElements.length > 0) {
        this.renderSpotlights(this.selectedElements);
        this.renderHUD();
      } else if (this.hoveredEl) {
        this.updateHighlight(this.hoveredEl);
      }
    }

    showToast(title, desc, duration = 3000) {
      // Los avisos de problema (icono de advertencia) quedan también en el log del hub
      if (title.includes(ICONS.warning)) this.reportToHub('warn', `${stripTags(title)}: ${desc}`);
      const toast = document.createElement('div');
      toast.className = 'toast-msg';
      toast.innerHTML = `
        <div class="toast-title">${title}</div>
        <div class="toast-desc">${escapeHtml(desc)}</div>
      `;
      this.shadow.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
      }, duration);
    }

    /** Copia vieja tras recargar la extensión: avisar una vez y apagarse (QA-6) */
    retire() {
      if (this._retired) return;
      this._retired = true;
      this.showToast(
        `${ICONS.warning} La extensión se actualizó`,
        'Recarga la página (F5) para usar la versión nueva del inspector.',
        6000,
      );
      setTimeout(() => this.destroy(), 6200);
    }

    // ── Escaneo del sitio ──────────────────────────────────────────────────────────────────
    // Detecta las rutas, el usuario confirma cuáles (máx. SCAN_MAX) y el service worker las recorre
    // en una ventana de escaneo visible. Aquí se muestra el avance y se puede cancelar.

    async startSiteScan() {
      if (this.scanState)
        return this.showToast(`${ICONS.info} Escaneo en curso`, 'Espera a que termine o cancélalo.', 3000);
      if (!extensionAlive()) return this.retire();
      if (!window.__codeToFigmaScan) {
        return this.showToast(
          `${ICONS.warning} Escanear sitio`,
          'Motor de extracción no cargado en la página. Recárgala.',
          4500,
        );
      }
      this.showToast(
        `${ICONS.spinner} Buscando las páginas del sitio…`,
        'Enlaces de esta página y su sitemap.xml.',
        2000,
      );
      let found;
      try {
        found = await window.__codeToFigmaScan.collectRoutes();
      } catch (err) {
        return this.showToast(`${ICONS.warning} Escanear sitio`, String((err && err.message) || err), 4500);
      }
      // Las que ya están en el archivo de Figma salen desmarcadas: se escanea solo lo que falta
      const inFigma = await this.queryRoutesInFigma();
      const routes = await this.askScanRoutes(found.routes, found.excluded, inFigma);
      if (!routes || !routes.length) return;
      const res = await new Promise(resolve => {
        try {
          chrome.runtime.sendMessage({ type: 'SCAN_START', routes }, r => resolve(chrome.runtime.lastError ? null : r));
        } catch (_e) {
          resolve(null);
        }
      });
      if (!res || !res.success) {
        return this.showToast(
          `${ICONS.warning} No se pudo empezar el escaneo`,
          (res && res.error) || 'La extensión no responde. Recarga la página.',
          7000,
        );
      }
      this.scanState = { scanId: res.scanId, total: res.total, errors: 0, skipped: 0 };
      this.showScanPanel(`Abriendo la ventana de escaneo… (${res.total} páginas)`);
    }

    /**
     * Rutas de este sitio que ya están dibujadas en el archivo de Figma abierto (el plugin las marca
     * al dibujarlas). Nunca falla: sin respuesta, byUrl vacío y el motivo en `reason`.
     */
    queryRoutesInFigma() {
      const empty = reason => ({ byUrl: new Map(), reason });
      return new Promise(resolve => {
        try {
          if (!extensionAlive()) return resolve(empty(''));
          chrome.runtime.sendMessage({ type: 'QUERY_FIGMA_ROUTES' }, r => {
            if (chrome.runtime.lastError || !r || !r.success) {
              return resolve(empty((r && r.error) || 'la extensión no respondió'));
            }
            const byUrl = new Map();
            for (const x of Array.isArray(r.routes) ? r.routes : []) {
              const key = x && typeof x.url === 'string' ? withoutHash(x.url) : '';
              if (key) byUrl.set(key, x);
            }
            resolve({ byUrl, reason: Array.isArray(r.routes) ? '' : String(r.reason || '') });
          });
        } catch (_e) {
          resolve(empty('la extensión no respondió'));
        }
      });
    }

    /**
     * Lista de TODAS las rutas encontradas, con casillas: el usuario decide cuáles escanear (marcadas
     * al abrir, salvo las que ya están en Figma; "Todas", "Ninguna", "Las que faltan" y un filtro para
     * listas largas). Resuelve las elegidas o null.
     */
    askScanRoutes(routes, excluded, inFigma = { byUrl: new Map(), reason: '' }) {
      const done = routes.map(r => inFigma.byUrl.has(withoutHash(r.url)));
      const doneCount = done.filter(Boolean).length;
      // Segundos aproximados por página (carga, espera de estabilidad, recorrido y envío)
      const SECONDS_PER_PAGE = 12;
      return new Promise(resolve => {
        const backdrop = document.createElement('div');
        backdrop.className = 'heavy-backdrop';
        const rows = routes
          .map(
            (r, i) => `
              <label class="scan-route">
                <input type="checkbox" data-idx="${i}" ${done[i] ? 'data-done="1"' : 'checked'} />
                <span class="scan-path">${escapeHtml(r.path)}</span>${done[i] ? '<span class="scan-done">ya en Figma</span>' : ''}
                <span class="scan-label">${escapeHtml(r.label || '')}${r.grouped > 1 ? ` · ${r.grouped} similares, se escanea 1` : ''}</span>
              </label>`,
          )
          .join('');
        const ex = excluded.length
          ? `<details class="scan-excluded"><summary>${excluded.length} enlaces excluidos por seguridad</summary>${excluded
              .slice(0, 50)
              .map(e => `<div><span class="scan-path">${escapeHtml(e.path)}</span> — ${escapeHtml(e.reason)}</div>`)
              .join('')}</details>`
          : '';
        const note =
          doneCount > 0
            ? `<p class="scan-note" id="__scan_note">${doneCount === routes.length ? 'Todas' : doneCount} ya ${doneCount === 1 ? 'está' : 'están'} en este archivo de Figma y ${doneCount === 1 ? 'sale desmarcada' : 'salen desmarcadas'}. El tablero nuevo incluye solo las que escanees ahora.</p>`
            : inFigma.reason
              ? `<p class="scan-note" id="__scan_note">No se pudo saber qué páginas ya están en Figma (${escapeHtml(inFigma.reason)}): se proponen todas.</p>`
              : '';
        backdrop.innerHTML = `
          <div class="heavy-dialog scan-dialog" role="dialog" aria-modal="true" aria-labelledby="__scan_title">
            <h3 id="__scan_title">${ICONS.layers} Escanear el sitio</h3>
            <p>Se abrirá una ventana que recorre las páginas elegidas con tu sesión, una por una, y las lleva a Figma como un mapa del sitio con su tablero de componentes.</p>
            ${
              routes.length > 1
                ? `<div class="scan-tools">
                <input type="search" id="__scan_filter" placeholder="Filtrar rutas (ej. /blog)" aria-label="Filtrar rutas" />
                <button class="btn-secondary" data-pick="all">Todas</button>
                <button class="btn-secondary" data-pick="none">Ninguna</button>
                ${doneCount > 0 && doneCount < routes.length ? '<button class="btn-secondary" data-pick="missing">Las que faltan</button>' : ''}
              </div>`
                : ''
            }
            ${note}
            <div class="scan-list">${rows || '<p>No se encontraron otras páginas en este sitio.</p>'}</div>
            ${ex}
            <div class="heavy-stats"><span id="__scan_count"></span></div>
            <div class="heavy-actions">
              <button class="btn-secondary" data-choice="cancel">Cancelar</button>
              <button class="btn-figma" data-choice="scan" id="__scan_go">Escanear</button>
            </div>
          </div>`;
        const boxes = () => [...backdrop.querySelectorAll('input[type="checkbox"]')];
        const refresh = () => {
          const checked = boxes().filter(b => b.checked).length;
          const mins = Math.max(1, Math.round((checked * SECONDS_PER_PAGE) / 60));
          backdrop.querySelector('#__scan_count').textContent =
            `${checked} de ${routes.length} páginas · unos ${mins} min` +
            (checked > 40 ? ' · con muchas páginas el tablero de Figma tarda más en armarse' : '');
          const go = backdrop.querySelector('#__scan_go');
          go.disabled = checked === 0;
          go.textContent = `Escanear ${checked} página${checked === 1 ? '' : 's'}`;
        };
        const close = value => {
          this.activeDialog = null;
          backdrop.remove();
          resolve(value);
        };
        backdrop.addEventListener('change', refresh);
        // Filtro: oculta las filas que no coinciden; "Todas/Ninguna" actúa solo sobre las visibles
        const filter = backdrop.querySelector('#__scan_filter');
        const visibleBoxes = () => boxes().filter(b => b.closest('.scan-route').style.display !== 'none');
        if (filter) {
          filter.addEventListener('input', () => {
            const q = filter.value.trim().toLowerCase();
            backdrop.querySelectorAll('.scan-route').forEach(row => {
              row.style.display = !q || row.textContent.toLowerCase().includes(q) ? '' : 'none';
            });
          });
        }
        backdrop.addEventListener('click', e => {
          const pick = e.target.closest ? e.target.closest('[data-pick]') : null;
          if (pick) {
            const kind = pick.getAttribute('data-pick');
            visibleBoxes().forEach(
              b => (b.checked = kind === 'all' || (kind === 'missing' && !b.hasAttribute('data-done'))),
            );
            refresh();
            return;
          }
          const t = e.target.closest ? e.target.closest('[data-choice]') : null;
          if (t && t.getAttribute('data-choice') === 'scan') {
            close(
              boxes()
                .filter(b => b.checked)
                .map(b => routes[Number(b.getAttribute('data-idx'))]),
            );
          } else if (t || e.target === backdrop) close(null);
        });
        this.activeDialog = { cancel: () => close(null) };
        this.shadow.appendChild(backdrop);
        refresh();
      });
    }

    showScanPanel(text) {
      if (!this.scanPanel) {
        this.scanPanel = document.createElement('div');
        this.scanPanel.className = 'scan-panel';
        this.scanPanel.innerHTML = `<span class="scan-panel-text"></span><button class="btn-secondary" id="__scan_cancel">Cancelar</button>`;
        this.scanPanel.querySelector('#__scan_cancel').addEventListener('click', () => {
          try {
            chrome.runtime.sendMessage({ type: 'SCAN_CANCEL' }, () => void chrome.runtime.lastError);
          } catch (_e) {}
          this.scanPanel.querySelector('.scan-panel-text').textContent = 'Cancelando…';
        });
        this.shadow.appendChild(this.scanPanel);
      }
      this.scanPanel.querySelector('.scan-panel-text').textContent = text;
    }

    /** Aviso al log del hub (~/.code-to-figma/hub.log) a través del service worker */
    reportToHub(level, message) {
      try {
        if (!extensionAlive()) return;
        chrome.runtime.sendMessage(
          { type: 'REPORT_TO_HUB', level, message: String(message || '').slice(0, 2000) },
          () => void chrome.runtime.lastError,
        );
      } catch (_e) {}
    }

    hideScanPanel() {
      if (this.scanPanel) this.scanPanel.remove();
      this.scanPanel = null;
    }

    onScanProgress(m) {
      if (!this.scanState || m.scanId !== this.scanState.scanId) return;
      const st = this.scanState;
      if (m.status === 'page') this.showScanPanel(`Escaneando ${m.index + 1} de ${m.total} · ${m.path}`);
      else if (m.status === 'skip') st.skipped++;
      else if (m.status === 'error') st.errors++;
      else if (m.status === 'done' || m.status === 'cancelled' || m.status === 'failed') {
        this.hideScanPanel();
        this.scanState = null;
        const notes = [st.skipped ? `${st.skipped} saltadas` : '', st.errors ? `${st.errors} con error` : '']
          .filter(Boolean)
          .join(', ');
        if (m.status === 'failed') {
          this.showToast(`${ICONS.warning} El escaneo falló`, m.error || 'Error desconocido', 7000);
        } else {
          this.showToast(
            `${ICONS.check} ${m.status === 'cancelled' ? 'Escaneo cancelado' : 'Escaneo terminado'}`,
            `${m.sent} de ${m.total} páginas enviadas a Figma${notes ? ` (${notes})` : ''}.` +
              (m.sent ? ' Figma está armando el mapa del sitio y su tablero.' : ''),
            7000,
          );
        }
      }
    }

    destroy() {
      this.cancelElevation();
      this.unbindEvents();
      if (this.host && this.host.parentNode) {
        this.host.parentNode.removeChild(this.host);
      }
      delete window[KEY];
      delete window.__codeToFigmaInstance;
      delete window.__codeToFigmaCaptureRegions;
      console.log('[CodeToFigma] Inspector cerrado por el usuario.');
    }

    /**
     * Prepara la selección antes de extraer:
     *  - fuerza la carga de imágenes lazy (loading="lazy", data-src sin cargar);
     *  - si la selección es más alta que la pantalla, la recorre con scroll para disparar
     *    lazy-loaders por IntersectionObserver y animaciones "reveal on scroll" (opacity 0 → 1);
     *  - espera (máx. 3 s) a que las imágenes terminen de cargar.
     */
    async prepareForExtraction(elements, onProgress) {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const seenVisible = new Map();
      this.restoreReveals();
      const imgs = [];
      let top = Infinity;
      let bottom = -Infinity;
      for (const el of elements) {
        if (!el || !el.getBoundingClientRect) continue;
        const r = el.getBoundingClientRect();
        top = Math.min(top, r.top + window.scrollY);
        bottom = Math.max(bottom, r.bottom + window.scrollY);
        el.querySelectorAll('img').forEach(img => {
          if (img.loading === 'lazy') img.loading = 'eager';
          imgs.push(img);
        });
      }

      if (!this.isFrozen && isFinite(top) && bottom - top > window.innerHeight * 0.9) {
        const startX = window.scrollX;
        const startY = window.scrollY;
        const prevVisibility = this.host ? this.host.style.visibility : '';
        if (this.host) this.host.style.visibility = 'hidden';
        try {
          // Pasos proporcionales al largo de la selección (antes: máx. 40, el resto de una página
          // larga quedaba sin cargar). Tope de seguridad: ~1 min en páginas desmesuradas.
          const step = Math.max(200, window.innerHeight * 0.8);
          const steps = Math.min(MAX_PRESCROLL_STEPS, Math.ceil((bottom - top) / step));
          for (let i = 0; i < steps; i++) {
            window.scrollTo({ left: startX, top: top + i * step, behavior: 'instant' });
            if (onProgress) onProgress(Math.round(((i + 1) / steps) * 100));
            await sleep(220);
            this.sampleReveals(elements, seenVisible);
          }
        } finally {
          window.scrollTo({ left: startX, top: startY, behavior: 'instant' });
          await sleep(350);
          if (this.host) this.host.style.visibility = prevVisibility;
          if (this.selectedElements.length) this.renderSpotlights(this.selectedElements);
        }
        const restored = this.applyReveals(seenVisible);
        if (restored) console.info(`[CodeToFigma] ${restored} elemento(s) "reveal on scroll" restaurados para extraer`);
      }

      const pending = imgs.filter(img => !img.complete);
      if (pending.length) {
        await Promise.race([
          Promise.all(
            pending.map(
              img =>
                new Promise(r => {
                  img.addEventListener('load', r, { once: true });
                  img.addEventListener('error', r, { once: true });
                }),
            ),
          ),
          sleep(3000),
        ]);
      }
    }

    /**
     * Contenido "reveal on scroll" que se vuelve a ocultar al salir de la vista (IntersectionObserver
     * que alterna una clase, whileInView…). Al volver arriba para extraer, lo de más abajo estaba otra
     * vez transparente y se perdía: p. ej. las tarjetas y los marcadores alrededor de un visor 3D.
     * Durante el recorrido se anota cómo se ve cada elemento EN PANTALLA (si hay una transición en
     * curso, su estado final); applyReveals se lo devuelve al extraer y restoreReveals lo quita.
     */
    sampleReveals(elements, seen) {
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      for (const root of elements) {
        if (!root || !root.querySelectorAll) continue;
        const all = root.querySelectorAll('*');
        const n = Math.min(all.length, 8000);
        for (let i = 0; i < n; i++) {
          const el = all[i];
          if (this.host && (el === this.host || this.host.contains(el))) continue;
          // Sin filtro de tamaño: las anclas de 0×0 de los marcadores también llevan el reveal
          const r = el.getBoundingClientRect();
          if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
          const cs = window.getComputedStyle(el);
          if (cs.display === 'none') continue;
          // Fijos (volver arriba, cabeceras "al hacer scroll") y lo que está bajo el ratón (hover) no
          // son reveals: su estado visible depende del scroll o del puntero, no de estar a la vista
          if (cs.position === 'fixed' || cs.position === 'sticky' || el.matches(':hover')) continue;
          let opacity = parseFloat(cs.opacity);
          let transform = cs.transform;
          if (typeof el.getAnimations === 'function') {
            for (const a of el.getAnimations()) {
              const kf = a.effect && typeof a.effect.getKeyframes === 'function' ? a.effect.getKeyframes() : [];
              const last = kf[kf.length - 1];
              if (!last) continue;
              if (last.opacity !== undefined && parseFloat(last.opacity) > opacity) opacity = parseFloat(last.opacity);
              if (last.transform !== undefined) transform = last.transform;
            }
          }
          if (!(opacity > 0.05) || cs.visibility === 'hidden') continue;
          const prev = seen.get(el);
          if (!prev || opacity > prev.opacity) {
            seen.set(el, { opacity, transform, visibility: cs.visibility, filter: cs.filter });
          }
        }
      }
    }

    applyReveals(seen) {
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      const overrides = [];
      for (const [el, rec] of seen) {
        if (!el.isConnected) continue;
        const cs = window.getComputedStyle(el);
        const hiddenNow =
          parseFloat(cs.opacity) + 0.05 < rec.opacity || (cs.visibility === 'hidden' && rec.visibility !== 'hidden');
        if (!hiddenNow) continue;
        const r = el.getBoundingClientRect();
        // A la vista y oculto: ese es su estado real (slide inactiva, menú cerrado). No se toca.
        if (r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw) continue;
        // Fundido entre hermanos superpuestos (carrusel): si otro visible ocupa su caja, no se toca
        if (this.hasVisibleTwin(el, r)) continue;
        const props = ['opacity', 'visibility', 'transform', 'filter', 'transition', 'animation'];
        const saved = props.map(p => [p, el.style.getPropertyValue(p), el.style.getPropertyPriority(p)]);
        // Estado oculto y transición para la exportación HTML (vuelve a animar la entrada). La
        // transición se lee antes de congelarla; el estado oculto, después: puede estar a mitad de
        // la salida y, sin transición, getComputedStyle (vivo) da ya el valor final
        const transition = cs.transition;
        el.style.setProperty('transition', 'none', 'important');
        el.style.setProperty('animation', 'none', 'important');
        const hidden = { opacity: cs.opacity, transform: cs.transform, visibility: cs.visibility, filter: cs.filter };
        el.style.setProperty('opacity', String(rec.opacity), 'important');
        if (rec.visibility !== cs.visibility) el.style.setProperty('visibility', rec.visibility, 'important');
        if (rec.transform && rec.transform !== cs.transform)
          el.style.setProperty('transform', rec.transform, 'important');
        if (rec.filter && rec.filter !== cs.filter) el.style.setProperty('filter', rec.filter, 'important');
        overrides.push({
          el,
          saved,
          hidden,
          transition,
          visible: {
            opacity: String(rec.opacity),
            transform: rec.transform,
            visibility: rec.visibility,
            filter: rec.filter,
          },
        });
      }
      this.revealOverrides = overrides;
      return overrides.length;
    }

    restoreReveals() {
      for (const { el, saved } of this.revealOverrides || []) {
        for (const [p, v, prio] of saved) {
          if (v) el.style.setProperty(p, v, prio);
          else el.style.removeProperty(p);
        }
      }
      this.revealOverrides = [];
    }

    hasVisibleTwin(el, r) {
      const parent = el.parentElement;
      if (!parent) return false;
      const area = Math.max(1, r.width * r.height);
      for (const sib of Array.from(parent.children).slice(0, 24)) {
        if (sib === el) continue;
        const s = sib.getBoundingClientRect();
        const ox = Math.max(0, Math.min(r.right, s.right) - Math.max(r.left, s.left));
        const oy = Math.max(0, Math.min(r.bottom, s.bottom) - Math.max(r.top, s.top));
        if ((ox * oy) / area < 0.8) continue;
        const scs = window.getComputedStyle(sib);
        if (parseFloat(scs.opacity) > 0.05 && scs.visibility !== 'hidden' && scs.display !== 'none') return true;
      }
      return false;
    }

    /**
     * Oculta el overlay del inspector, captura la pestaña y devuelve un dataURL por rect.
     * @param {{left:number,top:number,width:number,height:number}[]} rects coordenadas de viewport
     */
    async captureRegions(rects) {
      const prevVisibility = this.host ? this.host.style.visibility : '';
      try {
        if (this.host) this.host.style.visibility = 'hidden';
        // Esperar a que el navegador repinte sin el overlay
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 60))));
        const resp = await new Promise(resolve => {
          chrome.runtime.sendMessage({ type: 'CAPTURE_REGIONS', rects, viewportWidth: window.innerWidth }, res =>
            resolve(chrome.runtime.lastError ? null : res),
          );
        });
        return resp && resp.success ? resp.crops : [];
      } finally {
        if (this.host) this.host.style.visibility = prevVisibility;
      }
    }
  }

  // Initialize
  window.__codeToFigmaInstance = new CodeToFigmaInspector();
})();
