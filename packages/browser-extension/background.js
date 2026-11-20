/**
 * Code to Figma AI — Background Service Worker
 * - Injects inspector & extractor on toolbar click or Alt+Shift+F
 * - Relays WebSocket messages to ws://localhost:8080 (immune to website CSP)
 * - Fetches images as base64 with extension privileges (immune to website CSP & CORS)
 */

chrome.action.onClicked.addListener(async tab => {
  if (!tab.id || !tab.url) return;

  // Do not inject on restricted Chrome internal URLs
  if (
    tab.url.startsWith('chrome://') ||
    tab.url.startsWith('chrome-extension://') ||
    tab.url.startsWith('https://chromewebstore.google.com')
  ) {
    console.warn('[CodeToFigma] No se puede ejecutar en paginas internas de Chrome.');
    return;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['extractor.js', 'content.js'],
    });
  } catch (err) {
    console.error('[CodeToFigma] Error al inyectar script:', err);
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

async function fetchImageBase64(url, tabUrl) {
  if (!url) throw new Error('URL no proporcionada');
  if (url.startsWith('data:')) return url;

  const policy = imageFetchPolicy(url, tabUrl);
  if (!policy.allowed) throw new Error(`Descarga bloqueada: ${policy.reason}`);

  // Cookies solo para imágenes del mismo sitio (plataformas con login, intranets)
  const res = await fetch(url, { credentials: policy.credentials ? 'include' : 'omit' });
  if (!res.ok) {
    throw new Error(`HTTP error ${res.status}`);
  }
  const blob = await res.blob();
  let mime = (blob.type || '').toLowerCase();
  if (mime && !mime.startsWith('image/')) {
    throw new Error(`Respuesta no es imagen (${mime})`);
  }
  if (!mime) mime = guessMimeFromUrl(url);
  const buffer = await blob.arrayBuffer();
  const base64 = uint8ArrayToBase64(new Uint8Array(buffer));
  return `data:${mime};base64,${base64}`;
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
function sendToWebSocketHub(data, hubUrl = HUB_URL) {
  return new Promise((resolve, reject) => {
    let ws;
    try {
      ws = new WebSocket(hubUrl);
    } catch (err) {
      return reject(new Error('No se pudo instanciar WebSocket: ' + err.message));
    }

    let settled = false;
    const finish = (err, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(connectTimeout);
      if (err) {
        try {
          ws.close();
        } catch (_) {}
        reject(err);
      } else {
        resolve(value);
      }
    };
    const connectTimeout = setTimeout(
      () => finish(new Error('Tiempo de espera agotado al conectar a ' + hubUrl)),
      6000,
    );

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
        const text = JSON.stringify(buildRenderMessage(data));
        let parts = 1;
        if (text.length > CHUNK_THRESHOLD_BYTES) {
          const chunks = splitIntoChunks(text, CHUNK_SIZE_CHARS);
          const transferId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
          parts = chunks.length;
          for (let index = 0; index < chunks.length; index++) {
            if (ws.readyState !== WebSocket.OPEN) throw new Error('El hub cerró la conexión durante el envío');
            ws.send(
              JSON.stringify({ type: 'RENDER_CHUNK', transferId, index, total: chunks.length, data: chunks[index] }),
            );
            await drained(2 * CHUNK_SIZE_CHARS);
          }
        } else {
          ws.send(text);
        }
        await drained(0);
        setTimeout(() => {
          try {
            ws.close();
          } catch (_) {}
          finish(null, { bytes: text.length, parts });
        }, 150);
      } catch (err) {
        finish(err);
      }
    };

    ws.onerror = () => finish(new Error('Hub no detectado en ' + hubUrl));
  });
}
// ── Envío al hub (fin) ────────────────────────────────────────────────────────────────────

// Check if WebSocket Hub and Figma plugin are live
function checkHubStatus() {
  return new Promise(resolve => {
    let ws;
    let settled = false;
    try {
      ws = new WebSocket('ws://localhost:8080');
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
      // If no reply after 500ms but onopen succeeded, hub is at least running
      setTimeout(() => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          try {
            ws.close();
          } catch (_) {}
          resolve({ hubRunning: true, figmaConnected: true, figmaCount: 1 });
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
          });
        }
      } catch (_) {}
      try {
        ws.close();
      } catch (_) {}
      resolve({ hubRunning: true, figmaConnected: true, figmaCount: 1 });
    };

    ws.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ hubRunning: false, figmaConnected: false, figmaCount: 0 });
    };
  });
}

// Mensajes del content script (catálogo: packages/contracts/src/messages.ts, canal "extension").
// Cada manejador devuelve una promesa; su resultado se fusiona en { success: true, ... }.
const MESSAGE_HANDLERS = {
  TRANSMIT_TO_FIGMA: message => sendToWebSocketHub(message.payload).then(sent => ({ sent })),

  CHECK_FIGMA_STATUS: () => checkHubStatus().then(status => ({ status })),

  CAPTURE_REGIONS: (message, sender) => {
    const windowId = sender && sender.tab ? sender.tab.windowId : undefined;
    return captureRegions(windowId, message.rects, message.viewportWidth).then(crops => ({ crops }));
  },

  // La pestaña que pide la imagen la da Chrome (no el mensaje): la página no puede falsearla
  FETCH_IMAGE_AS_BASE64: (message, sender) => {
    const tabUrl = sender && sender.tab ? sender.tab.url : undefined;
    return fetchImageBase64(message.url, tabUrl).then(base64 => ({ base64 }));
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
    .catch(err => sendResponse({ success: false, error: (err && err.message) || String(err) }));
  return true; // respuesta asíncrona: mantener abierto el canal
});
