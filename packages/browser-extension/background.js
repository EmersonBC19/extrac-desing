/**
 * Code to Figma AI — Background Service Worker
 * - Injects inspector & extractor on toolbar click or Alt+Shift+F
 * - Relays WebSocket messages to ws://localhost:8080 (immune to website CSP)
 * - Fetches images as base64 with extension privileges (immune to website CSP & CORS)
 */

/**
 * Las imágenes de otros dominios (CDN) se descargan desde este service worker, y eso exige permiso de
 * host. El manifiesto solo trae localhost fijo y deja `<all_urls>` como opcional (fase 7.3, Chrome Web
 * Store), así que hay que pedirlo. Chrome solo deja pedirlo con un clic real en una página de la
 * extensión: desde el service worker falla ("must be called during a user gesture"), aunque sea al
 * pulsar el icono. Por eso permissions.html tiene el botón "Permitir", y se abre:
 *  - al instalar o recargar la extensión, si el permiso no está concedido;
 *  - en segundo plano (sin quitar el foco a la pestaña que se captura) la primera vez por sesión que
 *    una imagen no se puede descargar por falta de permiso.
 */
const ALL_SITES = { origins: ['<all_urls>'] };
const PERMISSIONS_PAGE = 'permissions.html';
let permissionPageShown = false;

async function hasAllSites() {
  try {
    return await chrome.permissions.contains(ALL_SITES);
  } catch (_e) {
    return false;
  }
}

async function openPermissionPage(active, force = false) {
  if (permissionPageShown && !force) return;
  permissionPageShown = true;
  try {
    await chrome.tabs.create({ url: chrome.runtime.getURL(PERMISSIONS_PAGE), active });
  } catch (err) {
    console.warn('[CodeToFigma] No se pudo abrir la página de permisos:', err?.message || err);
  }
}

chrome.runtime.onInstalled.addListener(async details => {
  if ((details.reason === 'install' || details.reason === 'update') && !(await hasAllSites())) {
    openPermissionPage(true);
  }
});

/** Páginas donde Chrome no deja inyectar scripts de extensiones (internas, tienda, visor de PDF…) */
function isRestrictedUrl(url) {
  return (
    /^(chrome|chrome-extension|chrome-search|chrome-untrusted|edge|brave|opera|about|view-source|devtools):/i.test(
      url,
    ) || /^https:\/\/(chromewebstore\.google\.com|chrome\.google\.com\/webstore)/i.test(url)
  );
}

chrome.action.onClicked.addListener(async tab => {
  if (!tab.id || !tab.url) return;

  // Pulsar el icono en una página interna de Chrome (p. ej. chrome://extensions) no es un error de la
  // extensión: con console.warn aparecía en la lista de "Errores" de chrome://extensions
  if (isRestrictedUrl(tab.url)) {
    console.info('[CodeToFigma] Chrome no permite usar extensiones en esta página:', tab.url);
    return;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['extractor.js', 'content.js'],
    });
  } catch (err) {
    const msg = String((err && err.message) || err);
    // Páginas de error (sin conexión), PDF o archivos locales sin permiso: Chrome no deja inyectar
    if (/cannot access|cannot be scripted|error page|file:\/\//i.test(msg)) {
      console.info('[CodeToFigma] Chrome no permite usar la extensión en esta página:', msg);
    } else {
      console.error('[CodeToFigma] Error al inyectar script:', err);
    }
  }
});

// Helper: Convert Uint8Array to base64 Data URL cleanly in chunks
function uint8ArrayToBase64(bytes) {
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

// Fetch cross-origin image using extension host privileges
// ── Política de descarga de imágenes (plan de mejoras, fase 1.4) ──
// La extensión descarga con sus propios permisos lo que la página referencia. Sin límites,
// una web pública podía hacer que accediera a la red local (router, intranet) o a otros sitios
// con las cookies del usuario.

/** ¿Host de red local / privada? (solo literales: el service worker no resuelve DNS) */
function isPrivateHost(hostname) {
  const h = (hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (
    h === 'localhost' ||
    h.endsWith('.localhost') ||
    h.endsWith('.local') ||
    h.endsWith('.internal') ||
    h.endsWith('.lan')
  )
    return true;
  if (h === '::1' || h === '0.0.0.0' || h.startsWith('fe80:') || /^f[cd][0-9a-f]{2}:/.test(h)) return true;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return (
    a === 127 ||
    a === 10 ||
    a === 0 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

/** Dominio "registrable" aproximado (últimas 2 etiquetas; 3 para dominios tipo .com.co / .co.uk) */
function siteOf(hostname) {
  const parts = (hostname || '').toLowerCase().split('.').filter(Boolean);
  if (parts.length <= 2) return parts.join('.');
  const sld = parts[parts.length - 2];
  const twoLevelTld =
    ['com', 'co', 'org', 'net', 'gov', 'edu', 'gob', 'ac'].includes(sld) && parts[parts.length - 1].length === 2;
  return parts.slice(twoLevelTld ? -3 : -2).join('.');
}

/**
 * Decide si se permite descargar `url` para la pestaña `tabUrl` y si se envían cookies.
 * - solo http/https/data
 * - red local solo si la pestaña también es de red local (dashboards en localhost sí; web pública no)
 * - cookies solo para el mismo sitio que la pestaña (imágenes de plataformas con login)
 */
function imageFetchPolicy(url, tabUrl) {
  let target;
  try {
    target = new URL(url);
  } catch (_e) {
    return { allowed: false, reason: 'URL inválida' };
  }
  if (target.protocol === 'data:') return { allowed: true, credentials: false };
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return { allowed: false, reason: `Protocolo no permitido (${target.protocol})` };
  }
  let tab = null;
  try {
    tab = tabUrl ? new URL(tabUrl) : null;
  } catch (_e) {}
  const tabIsPrivate = tab ? isPrivateHost(tab.hostname) : false;
  if (isPrivateHost(target.hostname) && !tabIsPrivate) {
    return { allowed: false, reason: 'Recurso de red local referenciado por un sitio público' };
  }
  const sameSite = !!tab && siteOf(tab.hostname) === siteOf(target.hostname);
  return { allowed: true, credentials: sameSite };
}

const FETCH_TIMEOUT_MS = 15000;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

async function fetchWithTimeout(url, init, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err && err.name === 'AbortError') {
      throw new Error(`Tiempo de espera agotado (${Math.round(timeoutMs / 1000)}s) descargando recurso`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchImageBase64(url, tabUrl) {
  if (!url) throw new Error('URL no proporcionada');
  if (url.startsWith('data:')) return url;

  const policy = imageFetchPolicy(url, tabUrl);
  if (!policy.allowed) throw new Error(`Descarga bloqueada: ${policy.reason}`);

  // Cookies solo para imágenes del mismo sitio (plataformas con login, intranets)
  let res;
  try {
    res = await fetchWithTimeout(url, { credentials: policy.credentials ? 'include' : 'omit' });
  } catch (netErr) {
    // Sin permiso de host, el CORS del otro dominio bloquea la descarga: decirlo claro y ofrecer el permiso
    if (!(await hasAllSites())) {
      openPermissionPage(false);
      throw new Error(
        'Sin permiso para descargar imágenes de otros sitios: en la pestaña "Code to Figma — Permisos" pulsa Permitir y vuelve a enviar',
      );
    }
    throw netErr;
  }
  if (!res.ok) {
    throw new Error(`HTTP error ${res.status}`);
  }
  const contentLen = Number(res.headers.get('content-length') || 0);
  if (contentLen > MAX_IMAGE_BYTES) {
    throw new Error(`Imagen demasiado grande (${Math.round(contentLen / (1024 * 1024))} MB)`);
  }
  const blob = await res.blob();
  if (blob.size > MAX_IMAGE_BYTES) {
    throw new Error(`Imagen demasiado grande (${Math.round(blob.size / (1024 * 1024))} MB)`);
  }
  let mime = (blob.type || '').toLowerCase();
  if (mime && !mime.startsWith('image/')) {
    throw new Error(`Respuesta no es imagen (${mime})`);
  }
  if (!mime) mime = guessMimeFromUrl(url);
  const buffer = await blob.arrayBuffer();
  const base64 = uint8ArrayToBase64(new Uint8Array(buffer));
  return `data:${mime};base64,${base64}`;
}

/** Tope de una hoja de estilo descargada para "Exportar HTML" */
const MAX_STYLESHEET_BYTES = 8 * 1024 * 1024;

/**
 * Texto de una hoja de estilo de otro dominio ("Exportar HTML"): desde la página el navegador no deja
 * leer sus reglas. Misma política que las imágenes (sin red local desde webs públicas, cookies solo
 * del mismo sitio).
 */
async function fetchStylesheetText(url, tabUrl) {
  if (!url) throw new Error('URL no proporcionada');
  const policy = imageFetchPolicy(url, tabUrl);
  if (!policy.allowed) throw new Error(`Descarga bloqueada: ${policy.reason}`);
  let res;
  try {
    res = await fetchWithTimeout(url, { credentials: policy.credentials ? 'include' : 'omit' });
  } catch (netErr) {
    if (!(await hasAllSites())) {
      openPermissionPage(false);
      throw new Error(
        'Sin permiso para descargar hojas de estilo de otros sitios: concédelo en "Code to Figma — Permisos"',
      );
    }
    throw netErr;
  }
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const type = (res.headers.get('content-type') || '').toLowerCase();
  // Una página de error o de login en lugar de la hoja: no es CSS
  if (/text\/html|application\/json|image\//.test(type)) throw new Error(`Respuesta no es CSS (${type})`);
  const text = await res.text();
  if (text.length > MAX_STYLESHEET_BYTES) throw new Error('Hoja de estilo demasiado grande');
  return text;
}

function guessMimeFromUrl(url) {
  const ext = (url.split('?')[0].split('#')[0].split('.').pop() || '').toLowerCase();
  return (
    {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      avif: 'image/avif',
      svg: 'image/svg+xml',
    }[ext] || 'image/png'
  );
}

async function blobToDataUrl(blob) {
  const buffer = await blob.arrayBuffer();
  return `data:${blob.type};base64,${uint8ArrayToBase64(new Uint8Array(buffer))}`;
}

/**
 * Captura la pestaña visible y recorta cada rect (coordenadas CSS del viewport).
 * Para medios que el DOM no entrega: video cross-origin, WebGL, iframes, imágenes bloqueadas.
 */
async function captureRegions(windowId, rects, viewportWidth) {
  const shot = await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
  const bitmap = await createImageBitmap(await (await fetch(shot)).blob());
  const k = bitmap.width / (viewportWidth || bitmap.width);
  const vw = bitmap.width / k;
  const vh = bitmap.height / k;

  const out = [];
  for (const r of rects || []) {
    try {
      const l = Math.max(0, r.left),
        t = Math.max(0, r.top);
      const rr = Math.min(vw, r.left + r.width),
        bb = Math.min(vh, r.top + r.height);
      if (rr - l < 1 || bb - t < 1) {
        out.push(null);
        continue;
      }
      const cw = Math.max(1, Math.round(r.width * k));
      const ch = Math.max(1, Math.round(r.height * k));
      const s = Math.min(1, 4096 / Math.max(cw, ch)); // límite de Figma: 4096px por lado
      const canvas = new OffscreenCanvas(Math.max(1, Math.round(cw * s)), Math.max(1, Math.round(ch * s)));
      const ctx = canvas.getContext('2d');
      ctx.drawImage(
        bitmap,
        l * k,
        t * k,
        (rr - l) * k,
        (bb - t) * k,
        (l - r.left) * k * s,
        (t - r.top) * k * s,
        (rr - l) * k * s,
        (bb - t) * k * s,
      );
      const full = l <= r.left + 1 && t <= r.top + 1 && rr >= r.left + r.width - 1 && bb >= r.top + r.height - 1;
      const blob = await canvas.convertToBlob(full ? { type: 'image/jpeg', quality: 0.9 } : { type: 'image/png' });
      out.push(await blobToDataUrl(blob));
    } catch (_e) {
      out.push(null);
    }
  }
  bitmap.close();
  return out;
}

// ── Envío al hub (inicio) ─────────────────────────────────────────────────────────────────
const HUB_URL = 'ws://localhost:8080';
// = HUB_PROTOCOL de packages/contracts (lo comprueba tests/integration/messages.test.ts)
const HUB_PROTOCOL = 3;
const OUTDATED_HUB =
  'El hub de Code to Figma es de una versión anterior: ciérralo y vuelve a abrirlo (npm run start:hub, o recompila el ejecutable con npm run build:hub-exe)';
const OUTDATED_PLUGIN = 'El plugin de Figma es de una versión anterior: ciérralo y vuelve a abrirlo en Figma';
// Mismos valores que packages/contracts/src/payload-stats.ts (este archivo no se empaqueta)
const CHUNK_THRESHOLD_BYTES = 1024 * 1024;
const CHUNK_SIZE_CHARS = 512 * 1024;

/** Parte el texto sin separar un par sustituto UTF-16 (emoji) entre dos partes */
function splitIntoChunks(text, size) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    let end = Math.min(text.length, i + size);
    const code = text.charCodeAt(end - 1);
    if (end < text.length && code >= 0xd800 && code <= 0xdbff) end--;
    chunks.push(text.slice(i, end));
    i = end;
  }
  return chunks;
}

function buildRenderMessage(data) {
  const payload =
    data && data.rootNode
      ? {
          rootNode: data.rootNode,
          tokens: data.tokens,
          createAsComponent: data.createAsComponent,
          board: data.board === true, // landing completa / multi-selección → tablero design system
          source: data.source, // { url, title } para nombrar la página del tablero
          states: Array.isArray(data.states) ? data.states : undefined, // variantes de estado (fase 6.1)
          // Breakpoints y tema: variantes Breakpoint=… con Variables Light/Dark (Función A)
          responsive: data.responsive && Array.isArray(data.responsive.variants) ? data.responsive : undefined,
          // QA de diseño: comparar con un frame de Figma en lugar de dibujar (Función B)
          compare: data.compare && typeof data.compare.targetNodeId === 'string' ? data.compare : undefined,
          // Página de un escaneo del sitio: va al mapa del sitio
          scan: data.scan && typeof data.scan.id === 'string' ? data.scan : undefined,
          clearPage: false,
        }
      : { rootNode: data, clearPage: false };
  return { type: 'RENDER_NODES', payload };
}

/**
 * Envía un render al hub. Si el JSON pasa de CHUNK_THRESHOLD_BYTES va por partes (RENDER_CHUNK):
 * el plugin muestra el progreso y el hub valida el conjunto al completarlo.
 * El tiempo límite cubre solo la conexión; un envío grande puede tardar lo que necesite.
 */
/** Un render grande como mensajes RENDER_CHUNK (el hub los junta y valida el conjunto) */
function chunkMessages(text) {
  const chunks = splitIntoChunks(text, CHUNK_SIZE_CHARS);
  const transferId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  return chunks.map((data, index) =>
    JSON.stringify({ type: 'RENDER_CHUNK', transferId, index, total: chunks.length, data }),
  );
}

function sendToWebSocketHub(data, hubUrl = HUB_URL, message = null) {
  return new Promise((resolve, reject) => {
    let ws;
    try {
      ws = new WebSocket(hubUrl);
    } catch (err) {
      return reject(new Error('No se pudo instanciar WebSocket: ' + err.message));
    }

    let settled = false;
    let closeTimer = null;
    const finish = (err, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(connectTimeout);
      if (closeTimer) clearTimeout(closeTimer);
      try {
        ws.close();
      } catch (_) {}
      if (err) reject(err);
      else resolve(value);
    };
    const connectTimeout = setTimeout(
      () => finish(new Error('Tiempo de espera agotado al conectar a ' + hubUrl)),
      6000,
    );

    ws.onmessage = event => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed && parsed.type === 'RENDER_ERROR') {
          finish(new Error(parsed.error || 'El hub rechazó el render'));
        }
      } catch (_) {}
    };

    // Esperar a que el socket vacíe su búfer (sin acumular cientos de MB en memoria)
    const drained = (limit = 0) =>
      new Promise(r => {
        const check = () =>
          ws.readyState !== WebSocket.OPEN || ws.bufferedAmount <= limit ? r() : setTimeout(check, 25);
        check();
      });

    ws.onopen = async () => {
      clearTimeout(connectTimeout);
      try {
        const text = JSON.stringify(message || buildRenderMessage(data));
        let parts = 1;
        if (text.length > CHUNK_THRESHOLD_BYTES) {
          const messages = chunkMessages(text);
          parts = messages.length;
          for (const m of messages) {
            if (settled || ws.readyState !== WebSocket.OPEN)
              throw new Error('El hub cerró la conexión durante el envío');
            ws.send(m);
            await drained(2 * CHUNK_SIZE_CHARS);
          }
        } else {
          ws.send(text);
        }
        await drained(0);
        if (settled) return;
        closeTimer = setTimeout(() => finish(null, { bytes: text.length, parts }), 150);
      } catch (err) {
        finish(err);
      }
    };

    ws.onerror = () => finish(new Error('Hub no detectado en ' + hubUrl));
  });
}
// ── Envío al hub (fin) ────────────────────────────────────────────────────────────────────

/**
 * Aviso o error de la extensión al log del hub (~/.code-to-figma/hub.log), para revisarlo después.
 * Sin hub abierto se pierde sin molestar: el usuario ya vio el aviso en la página.
 */
function reportToHub(level, message, context) {
  const msg = {
    type: 'CLIENT_LOG',
    source: 'extension',
    level: level === 'error' || level === 'warn' ? level : 'info',
    message: String(message || '').slice(0, 2000),
  };
  if (context) msg.context = String(context).slice(0, 4000);
  sendToWebSocketHub(null, HUB_URL, msg).catch(() => {});
}

/** Solo el sitio de la página (sin ruta ni parámetros): el log no guarda datos de la sesión */
function originOf(url) {
  try {
    return new URL(url).origin;
  } catch (_e) {
    return '';
  }
}

// ── Escaneo del sitio (inicio) ───────────────────────────────────────────────────────────────
// Recorre las rutas que el usuario confirmó en una VENTANA DE ESCANEO visible (las pestañas
// ocultas no permiten captura de pantalla y frenan las cargas diferidas), con su sesión. Cada página
// va al hub como un render con `scan` (el plugin la pone en el mapa del sitio) y al final SCAN_FINISH
// (el plugin arma el tablero con todas). Las rutas se vuelven a validar aquí: no se confía en la página.
// Sin tope de producto: el usuario elige cuántas rutas escanear. Solo un techo técnico, igual al
// máximo de URL que se leen del sitemap (y al de los esquemas del hub)
const SCAN_LIMIT = 2000;
const SCAN_PAUSE_MS = 800;
const SCAN_NAV_TIMEOUT_MS = 30000;
// Misma lista que packages/core-extractor/src/browser/site-routes.ts (una prueba verifica que coincidan)
const SCAN_DANGEROUS =
  /(^|[/_.\-=?&])(log-?out|sign-?out|salir|cerrar-?sesion|desconectar|delete|eliminar|borrar|remove|destroy|drop|unsubscribe|darse-de-baja|approve|aprobar|reject|rechazar|confirm|confirmar|cancel|cancelar|anular|pay|pagar|checkout|purchase|comprar|transfer|transferir|reset|revoke|revocar|deactivate|desactivar|disable|deshabilitar|archive|archivar|publish|publicar|send|enviar|invite|invitar|admin\/.*\/(edit|delete))([/_.\-=?&]|$)/i;

function createSiteScanner(deps) {
  const { chrome: api, sendRender, sendHubMessage, hasPermission, askPermission, sleep } = deps;
  const report = typeof deps.report === 'function' ? deps.report : () => {};
  let active = null;

  const safePath = url => {
    try {
      const u = new URL(url);
      return decodeURIComponent(u.pathname + u.search);
    } catch (_e) {
      return null;
    }
  };

  /** Rutas válidas: mismo origen que la pestaña, http(s), ninguna peligrosa, sin repetir (techo SCAN_LIMIT) */
  function validateRoutes(routes, originUrl) {
    const origin = new URL(originUrl).origin;
    const seen = new Set();
    const out = [];
    for (const r of Array.isArray(routes) ? routes : []) {
      let u;
      try {
        u = new URL(String(r && r.url));
      } catch (_e) {
        continue;
      }
      u.hash = '';
      const path = safePath(u.href);
      if (!/^https?:$/.test(u.protocol) || u.origin !== origin || !path || SCAN_DANGEROUS.test(path)) continue;
      if (seen.has(u.href)) continue;
      seen.add(u.href);
      out.push({
        url: u.href,
        path: String((r && r.path) || path).slice(0, 2000),
        label: String((r && r.label) || '').slice(0, 200),
      });
      if (out.length >= SCAN_LIMIT) break;
    }
    return out;
  }

  /** Navega la pestaña y espera a que termine de cargar (con tope de tiempo) */
  function navigate(tabId, url) {
    return new Promise(resolve => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        api.tabs.onUpdated.removeListener(onUpdated);
        clearTimeout(timer);
        resolve();
      };
      const onUpdated = (id, info, tab) => {
        if (id === tabId && info.status === 'complete' && tab && tab.url && tab.url !== 'about:blank') finish();
      };
      api.tabs.onUpdated.addListener(onUpdated);
      const timer = setTimeout(finish, SCAN_NAV_TIMEOUT_MS);
      Promise.resolve(api.tabs.update(tabId, { url })).catch(finish);
    });
  }

  async function run(scan, routes, originTab) {
    const origin = new URL(originTab.url).origin;
    const progress = data => {
      try {
        Promise.resolve(
          api.tabs.sendMessage(originTab.id, { type: 'SCAN_PROGRESS', scanId: scan.id, total: routes.length, ...data }),
        ).catch(() => {});
      } catch (_e) {}
    };
    const badge = text => {
      try {
        Promise.resolve(api.action.setBadgeText({ text })).catch(() => {});
      } catch (_e) {}
    };
    let sent = 0;
    try {
      let size = {};
      try {
        const w = await api.windows.get(originTab.windowId);
        size = { width: w.width, height: w.height };
      } catch (_e) {}
      const win = await api.windows.create({ url: 'about:blank', focused: true, type: 'normal', ...size });
      scan.windowId = win.id;
      const tabId = win.tabs[0].id;
      for (let i = 0; i < routes.length && !scan.cancelled; i++) {
        const route = routes[i];
        progress({ status: 'page', index: i, path: route.path });
        badge(`${i + 1}/${routes.length}`);
        try {
          await navigate(tabId, route.url);
          if (scan.cancelled) break;
          // Una redirección puede sacar del sitio (login externo) o llevar a una ruta peligrosa
          const tab = await api.tabs.get(tabId);
          const finalPath = safePath(tab.url);
          if (!tab.url || new URL(tab.url).origin !== origin || !finalPath || SCAN_DANGEROUS.test(finalPath)) {
            progress({
              status: 'skip',
              index: i,
              path: route.path,
              reason: 'la página redirigió fuera de las rutas permitidas',
            });
            continue;
          }
          await api.scripting.executeScript({ target: { tabId }, files: ['extractor.js'] });
          const [res] = await api.scripting.executeScript({
            target: { tabId },
            func: () => window.__codeToFigmaScan.scanPage(),
          });
          const page = res && res.result;
          if (!page || !page.rootNode) throw new Error('la página no devolvió contenido');
          if (scan.cancelled) break;
          await sendRender({
            rootNode: page.rootNode,
            tokens: page.tokens,
            source: { url: page.url, title: page.title },
            scan: {
              id: scan.id,
              // La URL pedida (no la final, que puede ser una redirección): con ella el plugin marca
              // la página y la próxima vez se sabe que esta ruta ya está en Figma
              url: route.url,
              index: i,
              total: routes.length,
              path: route.path,
              label: route.label || page.title || '',
            },
          });
          sent++;
        } catch (err) {
          const error = String((err && err.message) || err);
          progress({ status: 'error', index: i, path: route.path, error });
          report('error', `Escaneo: falló la página ${i + 1} de ${routes.length}: ${error}`);
        }
        if (i < routes.length - 1 && !scan.cancelled) await sleep(SCAN_PAUSE_MS);
      }
      // Con lo que llegó (también si se canceló a la mitad) el plugin arma el tablero
      if (sent > 0) {
        await sendHubMessage({
          type: 'SCAN_FINISH',
          scanId: scan.id,
          count: sent,
          source: { url: originTab.url, title: originTab.title || '' },
        });
      }
      progress({ status: scan.cancelled ? 'cancelled' : 'done', sent });
    } catch (err) {
      const error = String((err && err.message) || err);
      progress({ status: 'failed', sent, error });
      report('error', `Escaneo detenido por un error: ${error}`);
    } finally {
      if (scan.windowId !== null && scan.windowId !== undefined) {
        try {
          await api.windows.remove(scan.windowId);
        } catch (_e) {}
      }
      badge('');
      active = null;
    }
  }

  // Cerrar la ventana de escaneo a mano = cancelar
  if (api.windows && api.windows.onRemoved) {
    api.windows.onRemoved.addListener(windowId => {
      if (active && active.windowId === windowId) {
        active.cancelled = true;
        active.windowId = null;
      }
    });
  }

  return {
    async start(routes, originTab) {
      if (active) throw new Error('Ya hay un escaneo en curso');
      if (!originTab || !originTab.url) throw new Error('Pestaña de origen desconocida');
      const valid = validateRoutes(routes, originTab.url);
      if (!valid.length) throw new Error('No hay rutas válidas para escanear');
      if (typeof deps.checkReady === 'function') await deps.checkReady();
      if (!(await hasPermission())) {
        askPermission();
        throw new Error(
          'El escaneo necesita permiso para abrir las páginas del sitio. Concédelo en la pestaña que se abrió y vuelve a intentarlo.',
        );
      }
      const scan = { id: 'scan_' + Date.now().toString(36), cancelled: false, windowId: null };
      active = scan;
      run(scan, valid, originTab); // en segundo plano: el avance llega por SCAN_PROGRESS
      return { scanId: scan.id, total: valid.length };
    },
    cancel() {
      if (!active) return { cancelled: false };
      active.cancelled = true;
      return { cancelled: true };
    },
    isActive: () => !!active,
    validateRoutes,
  };
}
// ── Escaneo del sitio (fin) ──────────────────────────────────────────────────────────────────

const siteScanner = createSiteScanner({
  chrome,
  checkReady: () => assertUpToDate(),
  sendRender: data => sendToWebSocketHub(data),
  sendHubMessage: message => sendToWebSocketHub(null, HUB_URL, message),
  report: (level, message) => reportToHub(level, message),
  hasPermission: hasAllSites,
  askPermission: () => openPermissionPage(true, true),
  sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
});

/**
 * QA de diseño: abre una conexión con el hub como cliente (recibe las respuestas), envía `messages`
 * y resuelve con el primer mensaje que cumpla `isReply`. Para la selección de Figma y el resumen de
 * una comparación.
 */
function hubRequest(messages, isReply, timeoutMs, hubUrl = HUB_URL) {
  return new Promise((resolve, reject) => {
    let ws;
    try {
      ws = new WebSocket(hubUrl);
    } catch (err) {
      return reject(new Error('No se pudo conectar con el hub: ' + err.message));
    }
    let settled = false;
    const finish = (err, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch (_) {}
      if (err) reject(err);
      else resolve(value);
    };
    const timer = setTimeout(() => finish(new Error('Figma no respondió a tiempo')), timeoutMs);
    ws.onopen = () => {
      try {
        ws.send(JSON.stringify({ type: 'REGISTER_CLIENT', clientType: 'BROWSER_EXTENSION' }));
        for (const m of messages) ws.send(typeof m === 'string' ? m : JSON.stringify(m));
      } catch (err) {
        finish(err);
      }
    };
    ws.onmessage = event => {
      try {
        const msg = JSON.parse(event.data);
        if (isReply(msg)) finish(null, msg);
      } catch (_) {}
    };
    ws.onerror = () => finish(new Error('Hub no detectado en ' + hubUrl));
  });
}

async function queryFigmaSelection() {
  const requestId = Math.random().toString(36).slice(2, 12);
  const reply = await hubRequest(
    [{ type: 'GET_FIGMA_SELECTION', requestId }],
    m => m.type === 'FIGMA_SELECTION' && m.requestId === requestId,
    8000,
  );
  if (reply.error) throw new Error(reply.error);
  return reply.selection || null;
}

/**
 * Escaneo del sitio: las rutas de `origin` que ya están en el archivo de Figma abierto. Nunca falla:
 * sin hub, sin plugin o con versiones anteriores devuelve routes null y el motivo, y el escaneo sigue
 * como siempre (todas las rutas propuestas).
 */
async function queryFigmaRoutes(origin) {
  if (!origin) return { routes: null, reason: 'sitio desconocido' };
  const st = await checkHubStatus();
  if (!st.hubRunning) return { routes: null, reason: 'el hub no está en marcha' };
  if (!st.figmaConnected) return { routes: null, reason: 'el plugin de Figma no está abierto' };
  if ((st.protocol || 1) < HUB_PROTOCOL) return { routes: null, reason: OUTDATED_HUB };
  if (st.pluginProtocol && st.pluginProtocol < HUB_PROTOCOL) return { routes: null, reason: OUTDATED_PLUGIN };
  const requestId = Math.random().toString(36).slice(2, 12);
  try {
    const reply = await hubRequest(
      [{ type: 'GET_FIGMA_ROUTES', requestId, origin }],
      m => m.type === 'FIGMA_ROUTES' && m.requestId === requestId,
      10000,
    );
    if (reply.error) return { routes: null, reason: reply.error };
    return { routes: Array.isArray(reply.routes) ? reply.routes : [] };
  } catch (err) {
    return { routes: null, reason: String((err && err.message) || err) };
  }
}

async function compareInFigma(payload) {
  const text = JSON.stringify(buildRenderMessage(payload));
  const reply = await hubRequest(
    text.length > CHUNK_THRESHOLD_BYTES ? chunkMessages(text) : [text],
    m => m.type === 'RENDER_ERROR' || (m.type === 'RENDER_SUCCESS' && m.qa),
    120000,
  );
  if (reply.type === 'RENDER_ERROR') throw new Error(reply.error || 'Figma no pudo comparar');
  return { qa: reply.qa, name: reply.name };
}

/**
 * Breakpoints, tema y QA necesitan hub y plugin de esta versión. Uno anterior (el hub arrancado antes
 * de actualizar, el plugin abierto desde entonces) descarta esos mensajes sin avisar: se dice aquí,
 * con qué hay que reiniciar, en vez de esperar una respuesta que no llegará.
 */
async function assertUpToDate(hubUrl = HUB_URL) {
  const st = await checkHubStatus(hubUrl);
  if (!st.hubRunning) return; // el envío informará que no hay hub
  if ((st.protocol || 1) < HUB_PROTOCOL) throw new Error(OUTDATED_HUB);
  if (st.figmaConnected && st.pluginProtocol && st.pluginProtocol < HUB_PROTOCOL) throw new Error(OUTDATED_PLUGIN);
}

// Check if WebSocket Hub and Figma plugin are live
function checkHubStatus(hubUrl = HUB_URL) {
  return new Promise(resolve => {
    let ws;
    let settled = false;
    try {
      ws = new WebSocket(hubUrl);
    } catch (err) {
      return resolve({ hubRunning: false, figmaConnected: false, figmaCount: 0 });
    }

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        ws.close();
      } catch (_) {}
      resolve({ hubRunning: false, figmaConnected: false, figmaCount: 0 });
    }, 1500);

    ws.onopen = () => {
      try {
        ws.send(JSON.stringify({ type: 'GET_STATUS' }));
      } catch (_) {}
      // If no reply after 500ms but onopen succeeded, hub is running but Figma status is unknown
      setTimeout(() => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          try {
            ws.close();
          } catch (_) {}
          resolve({ hubRunning: true, figmaConnected: false, figmaCount: 0, statusUnknown: true });
        }
      }, 500);
    };

    ws.onmessage = event => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'STATUS_RESPONSE') {
          try {
            ws.close();
          } catch (_) {}
          return resolve({
            hubRunning: true,
            figmaConnected: !!msg.payload?.figmaConnected,
            figmaCount: msg.payload?.figmaCount || 0,
            protocol: msg.payload?.protocol || 1,
            pluginProtocol: msg.payload?.pluginProtocol ?? (msg.payload?.figmaConnected ? 1 : 0),
          });
        }
      } catch (_) {}
      try {
        ws.close();
      } catch (_) {}
      resolve({ hubRunning: true, figmaConnected: false, figmaCount: 0, statusUnknown: true });
    };

    ws.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ hubRunning: false, figmaConnected: false, figmaCount: 0 });
    };
  });
}

// ── Página de render (breakpoints y tema) ──
// render-frame.html es accesible desde la web: cualquier sitio podría incrustarla. Solo dibuja con un
// token de un solo uso que pide nuestro content script, y una página de render que no lo canjeó no
// puede descargar imágenes con los permisos de la extensión (sería un proxy para saltarse CORS).
const RENDER_TOKEN_TTL_MS = 60000;
const renderTokens = new Map(); // token → caducidad
const claimedRenderFrames = new Set();

function isRenderFrame(sender) {
  return !!(
    sender &&
    typeof sender.url === 'string' &&
    /^chrome-extension:\/\/[^/]+\/render-frame\.html(?:[?#]|$)/.test(sender.url)
  );
}

function renderFrameKey(sender) {
  return sender.documentId || `${sender.tab ? sender.tab.id : '-'}:${sender.frameId}:${sender.url}`;
}

function issueRenderToken() {
  const now = Date.now();
  for (const [t, exp] of renderTokens) if (exp < now) renderTokens.delete(t);
  const token = crypto.randomUUID();
  renderTokens.set(token, now + RENDER_TOKEN_TTL_MS);
  return token;
}

function claimRenderToken(token, sender) {
  const exp = renderTokens.get(token);
  renderTokens.delete(token);
  if (!isRenderFrame(sender) || !exp || exp < Date.now()) throw new Error('Petición de render no autorizada');
  if (claimedRenderFrames.size > 500) claimedRenderFrames.clear();
  claimedRenderFrames.add(renderFrameKey(sender));
}

// Mensajes del content script (catálogo: packages/contracts/src/messages.ts, canal "extension").
// Cada manejador devuelve una promesa; su resultado se fusiona en { success: true, ... }.
const MESSAGE_HANDLERS = {
  TRANSMIT_TO_FIGMA: async message => {
    if (message.payload && message.payload.responsive) await assertUpToDate();
    return { sent: await sendToWebSocketHub(message.payload) };
  },

  CHECK_FIGMA_STATUS: () => checkHubStatus().then(status => ({ status })),

  // Escaneo del sitio: la pestaña de origen la da Chrome (sender), no el mensaje
  SCAN_START: (message, sender) => siteScanner.start(message.routes, sender && sender.tab),

  SCAN_CANCEL: () => Promise.resolve(siteScanner.cancel()),

  // Qué rutas del sitio de la pestaña ya están en Figma (el sitio lo da Chrome, no el mensaje)
  QUERY_FIGMA_ROUTES: (_message, sender) => queryFigmaRoutes(sender && sender.tab ? originOf(sender.tab.url) : ''),

  // Avisos del inspector al log del hub, con el sitio de la pestaña (lo da Chrome, no el mensaje)
  REPORT_TO_HUB: (message, sender) => {
    const site = sender && sender.tab ? originOf(sender.tab.url) : '';
    reportToHub(message.level, message.message, site ? `sitio: ${site}` : undefined);
    return Promise.resolve({});
  },

  // QA de diseño: qué frame hay seleccionado en Figma, y la comparación con su resumen
  QUERY_FIGMA_SELECTION: async () => {
    await assertUpToDate();
    return { selection: await queryFigmaSelection() };
  },

  COMPARE_IN_FIGMA: message => compareInFigma(message.payload),

  CAPTURE_REGIONS: (message, sender) => {
    const windowId = sender && sender.tab ? sender.tab.windowId : undefined;
    return captureRegions(windowId, message.rects, message.viewportWidth).then(crops => ({ crops }));
  },

  // La pestaña que pide la imagen la da Chrome (no el mensaje): la página no puede falsearla
  FETCH_IMAGE_AS_BASE64: (message, sender) => {
    if (isRenderFrame(sender) && !claimedRenderFrames.has(renderFrameKey(sender))) {
      return Promise.reject(new Error('Página de render no autorizada'));
    }
    const tabUrl = sender && sender.tab ? sender.tab.url : undefined;
    return fetchImageBase64(message.url, tabUrl).then(base64 => ({ base64 }));
  },

  // Breakpoints y tema: el content script pide un token por captura; la página de render lo canjea
  RENDER_FRAME_TOKEN: (_message, sender) => {
    if (isRenderFrame(sender) || !sender || !sender.tab) return Promise.reject(new Error('Solo desde la pestaña'));
    return Promise.resolve({ token: issueRenderToken() });
  },

  CLAIM_RENDER_TOKEN: (message, sender) => {
    claimRenderToken(String(message.token || ''), sender);
    return Promise.resolve({});
  },

  FETCH_STYLESHEET: (message, sender) => {
    const tabUrl = sender && sender.tab ? sender.tab.url : undefined;
    return fetchStylesheetText(message.url, tabUrl).then(text => ({ text }));
  },
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const type = message && message.type;
  const handler =
    typeof type === 'string' && Object.prototype.hasOwnProperty.call(MESSAGE_HANDLERS, type)
      ? MESSAGE_HANDLERS[type]
      : null;
  if (!handler) return false; // no es para nosotros
  Promise.resolve()
    .then(() => handler(message, sender))
    .then(result => sendResponse({ success: true, ...result }))
    .catch(err => {
      const error = (err && err.message) || String(err);
      // Los fallos de cualquier acción también quedan en el log del hub
      if (type !== 'REPORT_TO_HUB' && type !== 'CHECK_FIGMA_STATUS') {
        reportToHub(
          'error',
          `${type}: ${error}`,
          sender && sender.tab ? `sitio: ${originOf(sender.tab.url)}` : undefined,
        );
      }
      sendResponse({ success: false, error });
    });
  return true; // respuesta asíncrona: mantener abierto el canal
});
