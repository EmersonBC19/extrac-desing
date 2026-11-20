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

  /** Recorrido previo de páginas largas: pasos de ~0,8 pantallas, 220 ms cada uno (≈ 1 min como máximo) */
  const MAX_PRESCROLL_STEPS = 260;

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
  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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

        /* Action HUD toolbar — fully responsive & draggable */
        .action-hud {
          position: fixed !important;
          pointer-events: auto !important;
          display: none;
          background: ${DARK_BG};
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(162, 89, 255, 0.55);
          box-shadow: 0 20px 45px rgba(0, 0, 0, 0.7), 0 0 35px rgba(162, 89, 255, 0.3);
          border-radius: 12px;
          padding: 12px 16px;
          z-index: 2147483647 !important;
          animation: hudPop 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          color: #f8fafc;
          width: auto;
          max-width: min(580px, calc(100vw - 24px));
          box-sizing: border-box;
          user-select: none;
        }

        @keyframes hudPop {
          from { opacity: 0; transform: translateY(8px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .hud-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 8px;
          cursor: grab;
          user-select: none;
          padding-bottom: 6px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
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
          font-size: 13px;
          font-weight: 700;
          color: #fff;
          display: flex;
          align-items: center;
          gap: 6px;
          pointer-events: none;
        }

        .hud-drag-pill {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          background: rgba(168, 85, 247, 0.15);
          border: 1px solid rgba(168, 85, 247, 0.35);
          padding: 2px 7px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
          color: #c084fc;
          letter-spacing: 0.2px;
          cursor: grab;
        }

        /* Status Pills */
        .hud-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 10.5px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 12px;
          pointer-events: auto;
          cursor: help;
        }
        .status-dot {
          display: inline-block;
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }
        .hud-status-pill.connected {
          background: rgba(16, 185, 129, 0.15);
          color: #34d399;
          border: 1px solid rgba(16, 185, 129, 0.35);
        }
        .hud-status-pill.connected .status-dot {
          background: #10b981;
          box-shadow: 0 0 6px #10b981;
        }
        .hud-status-pill.waiting {
          background: rgba(245, 158, 11, 0.15);
          color: #fbbf24;
          border: 1px solid rgba(245, 158, 11, 0.35);
        }
        .hud-status-pill.waiting .status-dot {
          background: #f59e0b;
          box-shadow: 0 0 6px #f59e0b;
        }
        .hud-status-pill.disconnected {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
          border: 1px solid rgba(239, 68, 68, 0.35);
        }
        .hud-status-pill.disconnected .status-dot {
          background: #ef4444;
        }

        .hud-meta {
          font-size: 11px;
          color: #94a3b8;
          font-weight: 500;
          pointer-events: none;
        }

        .hud-nav-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 10px;
          font-size: 11px;
          color: #94a3b8;
        }

        .hud-nav-left {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }

        .btn-hierarchy {
          background: rgba(255, 255, 255, 0.08);
          color: #e2e8f0;
          border: 1px solid rgba(255, 255, 255, 0.16);
          font-size: 11px;
          padding: 4px 9px;
          border-radius: 5px;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
          display: inline-flex;
          align-items: center;
          user-select: none;
        }
        .btn-hierarchy:hover {
          background: rgba(255, 255, 255, 0.2);
          color: #fff;
        }
        .btn-hierarchy:active {
          transform: translateY(1px);
        }

        /* Toggle Component Pill */
        .hud-component-toggle {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          color: #cbd5e1;
          cursor: pointer;
          user-select: none;
          background: rgba(168, 85, 247, 0.12);
          padding: 3px 8px;
          border-radius: 5px;
          border: 1px solid rgba(168, 85, 247, 0.25);
          transition: all 0.15s;
        }
        .hud-component-toggle:hover {
          background: rgba(168, 85, 247, 0.25);
          color: #fff;
        }
        .hud-component-toggle input {
          cursor: pointer;
          margin: 0;
          accent-color: #a855f7;
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
          gap: 6px;
          background: linear-gradient(135deg, #a855f7, #3b82f6);
          color: #fff;
          font-size: 12px;
          font-weight: 600;
          border: none;
          padding: 8px 14px;
          border-radius: 6px;
          cursor: pointer;
          transition: transform 0.1s, box-shadow 0.15s, filter 0.15s;
          box-shadow: 0 2px 10px rgba(168, 85, 247, 0.45);
          user-select: none;
        }
        .btn-figma:hover {
          transform: translateY(-1px);
          filter: brightness(1.1);
          box-shadow: 0 4px 16px rgba(168, 85, 247, 0.65);
        }
        .btn-figma:active {
          transform: translateY(0);
        }

        .btn-secondary {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: rgba(255, 255, 255, 0.08);
          color: #cbd5e1;
          font-size: 12px;
          font-weight: 500;
          border: 1px solid rgba(255, 255, 255, 0.14);
          padding: 8px 12px;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
          user-select: none;
        }
        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.18);
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
        .heavy-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: flex-end;
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
        pill.title = "Ejecuta 'npm run start:hub' en la terminal";
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

      if (isMulti) {
        titleHtml = `${ICONS.multi} Multi-selección (${this.selectedElements.length} componentes)`;
        metaHtml = `${/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || '') ? '⌘' : 'Ctrl'}+Clic para sumar/quitar componentes`;
      } else {
        const el = this.selectedElements[0];
        const rect = el.getBoundingClientRect();
        const tag = el.tagName.toLowerCase();
        const dims = `${Math.round(rect.width)} × ${Math.round(rect.height)} px`;
        const childCount = el.querySelectorAll('*').length;
        titleHtml = `${ICONS.layers} Componente Seleccionado`;
        metaHtml = `&lt;${tag}&gt; · ${dims} · ${childCount} capas`;
      }

      this.hud.innerHTML = `
        <div class="hud-header" id="__hud_header" title="Haz clic y arrastra para mover esta barra libremente por la pantalla">
          <div class="hud-title-group">
            <span class="hud-drag-pill">${ICONS.drag} Mover</span>
            <div class="hud-title">${titleHtml}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span id="__hud_figma_status" class="hud-status-pill waiting" title="Verificando conexión con Figma...">
              <span class="status-dot"></span> Verificando...
            </span>
            <div class="hud-meta">${metaHtml}</div>
          </div>
        </div>

        <div class="hud-nav-row">
          <div class="hud-nav-left">
            ${
              !isMulti
                ? `
              <span>Ajustar contenedor:</span>
              <button class="btn-hierarchy" id="__btn_hud_parent">${ICONS.arrowUp} Subir a Padre <span style="opacity:0.6;font-size:10px">[↑]</span></button>
              <button class="btn-hierarchy" id="__btn_hud_child">${ICONS.arrowDown} Bajar a Hijo <span style="opacity:0.6;font-size:10px">[↓]</span></button>
            `
                : `
              <span style="color:#38bdf8;">${ICONS.multi} ${this.selectedElements.length} elementos agrupados listos para Figma</span>
            `
            }
          </div>

          <label class="hud-component-toggle" title="Crear en Figma como Componente reutilizable oficial (figma.createComponent)">
            <input type="checkbox" id="__chk_component" ${this.createAsComponent ? 'checked' : ''} />
            <span>${ICONS.component} Crear Componente</span>
          </label>
        </div>

        <div class="hud-buttons">
          <button class="btn-figma" id="__btn_send_figma">${ICONS.figma} Enviar a Figma <span style="opacity:0.75;font-size:10px">[Enter]</span></button>
          <button class="btn-secondary" id="__btn_freeze">${ICONS.snowflake} ${this.isFrozen ? 'Descongelar' : 'Congelar'} <span style="opacity:0.75;font-size:10px">[F]</span></button>
          <button class="btn-secondary" id="__btn_copy_json">${ICONS.copy} Copiar JSON</button>
          <button class="btn-secondary" id="__btn_cancel">${ICONS.close} Cancelar <span style="opacity:0.75;font-size:10px">[Esc]</span></button>
        </div>
      `;

      // Fluid Viewport Positioning: adapts flawlessly to 100%, 125%, 150% scales
      const vpW = window.innerWidth || document.documentElement.clientWidth || 1280;
      const vpH = window.innerHeight || document.documentElement.clientHeight || 800;
      const hudEstWidth = Math.min(560, vpW - 24);
      const hudEstHeight = 135;

      let hudTop;
      let hudLeft;

      if (this.userCustomPos) {
        hudLeft = Math.max(10, Math.min(vpW - hudEstWidth - 10, this.userCustomPos.left));
        hudTop = Math.max(10, Math.min(vpH - hudEstHeight - 10, this.userCustomPos.top));
      } else {
        hudTop = vpH - hudEstHeight - 24;
        hudLeft = (vpW - hudEstWidth) / 2;
      }

      hudTop = Math.max(10, Math.min(vpH - hudEstHeight - 10, hudTop));
      hudLeft = Math.max(10, Math.min(vpW - hudEstWidth - 10, hudLeft));

      this.hud.style.top = `${Math.round(hudTop)}px`;
      this.hud.style.left = `${Math.round(hudLeft)}px`;
      this.hud.style.display = 'block';

      // Attach Drag & Drop listener to header
      const header = this.hud.querySelector('#__hud_header');
      if (header) {
        header.addEventListener('mousedown', this.onHudMouseDown);
      }

      // Attach button & toggle events
      const btnSend = this.hud.querySelector('#__btn_send_figma');
      const btnFreeze = this.hud.querySelector('#__btn_freeze');
      const btnCopy = this.hud.querySelector('#__btn_copy_json');
      const btnCancel = this.hud.querySelector('#__btn_cancel');
      const chkComponent = this.hud.querySelector('#__chk_component');
      const btnParent = this.hud.querySelector('#__btn_hud_parent');
      const btnChild = this.hud.querySelector('#__btn_hud_child');

      if (btnSend) btnSend.addEventListener('click', () => this.sendToFigma());
      if (btnFreeze)
        btnFreeze.addEventListener('click', () => {
          this.toggleFreeze();
          this.renderHUD();
        });
      if (btnCopy) btnCopy.addEventListener('click', () => this.copyJson());
      if (btnCancel) btnCancel.addEventListener('click', () => this.cancelElevation());

      if (chkComponent) {
        chkComponent.addEventListener('change', e => {
          this.createAsComponent = e.target.checked;
        });
      }

      if (btnParent) btnParent.addEventListener('click', () => this.elevateParent());
      if (btnChild) btnChild.addEventListener('click', () => this.elevateChild());

      this.updateFigmaStatusUI();
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
            if (!wantsBoard && window.__codeToFigmaExtractState && er.width * er.height <= innerWidth * innerHeight) {
              try {
                const hover = await window.__codeToFigmaExtractState(el, 'hover');
                if (hover && hover.rootNode && JSON.stringify(hover.rootNode) !== JSON.stringify(rootNode)) {
                  states = [{ name: 'Hover', rootNode: hover.rootNode }];
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
          // Medición terminada: devolver la elevación (sin re-animar el reflejo)
          if (this.isElevated) relift();
        }

        // Peso de la extracción: avisar antes de enviar algo que Figma puede tardar en dibujar
        const payloadApi = window.__codeToFigmaPayload;
        let stats = null;
        if (payloadApi) {
          stats = payloadApi.measurePayload(rootNode);
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
              stats = payloadApi.measurePayload(rootNode);
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
          states,
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

        const stateNote = states ? ' con estado Hover' : '';
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
            "Asegúrate de ejecutar 'npm run start:hub'. Puedes usar 'Copiar JSON' para pegar en Figma.",
            5500,
          );
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
          if (this.isElevated) relift();
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
          }
        } finally {
          window.scrollTo({ left: startX, top: startY, behavior: 'instant' });
          await sleep(350);
          if (this.host) this.host.style.visibility = prevVisibility;
          if (this.selectedElements.length) this.renderSpotlights(this.selectedElements);
        }
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
