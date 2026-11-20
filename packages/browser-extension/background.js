/**
 * Code to Figma AI — Background Service Worker
 * - Injects inspector & extractor on toolbar click or Alt+Shift+F
 * - Relays WebSocket messages to ws://localhost:8080 (immune to website CSP)
 * - Fetches images as base64 with extension privileges (immune to website CSP & CORS)
 */

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url) return;

  // Do not inject on restricted Chrome internal URLs
  if (
    tab.url.startsWith("chrome://") ||
    tab.url.startsWith("chrome-extension://") ||
    tab.url.startsWith("https://chromewebstore.google.com")
  ) {
    console.warn("[CodeToFigma] No se puede ejecutar en paginas internas de Chrome.");
    return;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["extractor.js", "content.js"]
    });
  } catch (err) {
    console.error("[CodeToFigma] Error al inyectar script:", err);
  }
});

// Helper: Convert Uint8Array to base64 Data URL cleanly in chunks
function uint8ArrayToBase64(bytes) {
  let binary = "";
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

// Fetch cross-origin image using extension host privileges
async function fetchImageBase64(url) {
  if (!url) throw new Error("URL no proporcionada");
  if (url.startsWith("data:")) return url;

  // credentials: include → imágenes de plataformas con login (dashboards, intranets)
  let res;
  try {
    res = await fetch(url, { credentials: "include" });
  } catch (_e) {
    res = await fetch(url);
  }
  if (!res.ok) {
    throw new Error(`HTTP error ${res.status}`);
  }
  const blob = await res.blob();
  let mime = (blob.type || "").toLowerCase();
  if (mime && !mime.startsWith("image/")) {
    throw new Error(`Respuesta no es imagen (${mime})`);
  }
  if (!mime) mime = guessMimeFromUrl(url);
  const buffer = await blob.arrayBuffer();
  const base64 = uint8ArrayToBase64(new Uint8Array(buffer));
  return `data:${mime};base64,${base64}`;
}

function guessMimeFromUrl(url) {
  const ext = (url.split("?")[0].split("#")[0].split(".").pop() || "").toLowerCase();
  return {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
    webp: "image/webp", avif: "image/avif", svg: "image/svg+xml"
  }[ext] || "image/png";
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
  const shot = await chrome.tabs.captureVisibleTab(windowId, { format: "png" });
  const bitmap = await createImageBitmap(await (await fetch(shot)).blob());
  const k = bitmap.width / (viewportWidth || bitmap.width);
  const vw = bitmap.width / k;
  const vh = bitmap.height / k;

  const out = [];
  for (const r of rects || []) {
    try {
      const l = Math.max(0, r.left), t = Math.max(0, r.top);
      const rr = Math.min(vw, r.left + r.width), bb = Math.min(vh, r.top + r.height);
      if (rr - l < 1 || bb - t < 1) { out.push(null); continue; }
      const cw = Math.max(1, Math.round(r.width * k));
      const ch = Math.max(1, Math.round(r.height * k));
      const s = Math.min(1, 4096 / Math.max(cw, ch)); // límite de Figma: 4096px por lado
      const canvas = new OffscreenCanvas(Math.max(1, Math.round(cw * s)), Math.max(1, Math.round(ch * s)));
      const ctx = canvas.getContext("2d");
      ctx.drawImage(
        bitmap,
        l * k, t * k, (rr - l) * k, (bb - t) * k,
        (l - r.left) * k * s, (t - r.top) * k * s, (rr - l) * k * s, (bb - t) * k * s
      );
      const full = l <= r.left + 1 && t <= r.top + 1 && rr >= r.left + r.width - 1 && bb >= r.top + r.height - 1;
      const blob = await canvas.convertToBlob(full ? { type: "image/jpeg", quality: 0.9 } : { type: "image/png" });
      out.push(await blobToDataUrl(blob));
    } catch (_e) {
      out.push(null);
    }
  }
  bitmap.close();
  return out;
}

// Connect to WebSocket Hub (ws://localhost:8080) in background environment
function sendToWebSocketHub(data, clearPage = false) {
  return new Promise((resolve, reject) => {
    let ws;
    try {
      ws = new WebSocket("ws://localhost:8080");
    } catch (err) {
      return reject(new Error("No se pudo instanciar WebSocket: " + err.message));
    }

    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { ws.close(); } catch (_) {}
      reject(new Error("Tiempo de espera agotado al conectar a ws://localhost:8080"));
    }, 6000);

    ws.onopen = () => {
      const payload = (data && data.rootNode) ? {
        rootNode: data.rootNode,
        tokens: data.tokens,
        createAsComponent: data.createAsComponent,
        board: data.board === true,   // landing completa / multi-selección → tablero design system
        source: data.source,          // { url, title } para nombrar la página del tablero
        clearPage: false
      } : {
        rootNode: data,
        clearPage: false
      };

      const msg = {
        type: "RENDER_NODES",
        payload
      };
      ws.send(JSON.stringify(msg));

      // Wait until bufferedAmount is 0 to ensure full transmission
      const interval = setInterval(() => {
        if (!ws || ws.bufferedAmount === 0) {
          clearInterval(interval);
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          setTimeout(() => {
            try { ws.close(); } catch (_) {}
            resolve(true);
          }, 150);
        }
      }, 50);
    };

    ws.onerror = (_err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(new Error("Hub no detectado en ws://localhost:8080"));
    };
  });
}

// Check if WebSocket Hub and Figma plugin are live
function checkHubStatus() {
  return new Promise((resolve) => {
    let ws;
    let settled = false;
    try {
      ws = new WebSocket("ws://localhost:8080");
    } catch (err) {
      return resolve({ hubRunning: false, figmaConnected: false, figmaCount: 0 });
    }

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { ws.close(); } catch (_) {}
      resolve({ hubRunning: false, figmaConnected: false, figmaCount: 0 });
    }, 1500);

    ws.onopen = () => {
      try {
        ws.send(JSON.stringify({ type: "GET_STATUS" }));
      } catch (_) {}
      // If no reply after 500ms but onopen succeeded, hub is at least running
      setTimeout(() => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          try { ws.close(); } catch (_) {}
          resolve({ hubRunning: true, figmaConnected: true, figmaCount: 1 });
        }
      }, 500);
    };

    ws.onmessage = (event) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "STATUS_RESPONSE") {
          try { ws.close(); } catch (_) {}
          return resolve({
            hubRunning: true,
            figmaConnected: !!msg.payload?.figmaConnected,
            figmaCount: msg.payload?.figmaCount || 0
          });
        }
      } catch (_) {}
      try { ws.close(); } catch (_) {}
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

// Message listener for content script requests
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "TRANSMIT_TO_FIGMA") {
    sendToWebSocketHub(message.payload, message.clearPage === true)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message || String(err) }));
    return true; // Keep message channel open for async response
  }

  if (message.type === "CHECK_FIGMA_STATUS") {
    checkHubStatus()
      .then((status) => sendResponse({ success: true, status }))
      .catch((err) => sendResponse({ success: false, error: err.message || String(err) }));
    return true;
  }

  if (message.type === "CAPTURE_REGIONS") {
    const windowId = _sender && _sender.tab ? _sender.tab.windowId : undefined;
    captureRegions(windowId, message.rects, message.viewportWidth)
      .then((crops) => sendResponse({ success: true, crops }))
      .catch((err) => sendResponse({ success: false, error: err.message || String(err) }));
    return true;
  }

  if (message.type === "FETCH_IMAGE_AS_BASE64") {
    fetchImageBase64(message.url)
      .then((base64) => sendResponse({ success: true, base64 }))
      .catch((err) => sendResponse({ success: false, error: err.message || String(err) }));
    return true; // Keep message channel open for async response
  }
});
