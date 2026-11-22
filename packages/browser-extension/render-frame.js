// Página de render (render-frame.html): dibuja el bloque exportado a este ancho de ventana y lo extrae.
// Mensaje { type: 'CTF_RENDER', html, css } con un MessagePort; responde por el puerto
// { ok: true, rootNode } o { ok: false, error }.
(function () {
  'use strict';

  function withTimeout(promise, ms) {
    return Promise.race([promise, new Promise(resolve => setTimeout(resolve, ms))]);
  }

  async function render(html, css) {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const root = document.documentElement;
    for (const a of Array.from(root.attributes)) root.removeAttribute(a.name);
    for (const a of Array.from(parsed.documentElement.attributes)) root.setAttribute(a.name, a.value);
    // La hoja va ANTES que el contenido: los elementos nacen con su estilo final (sin transiciones
    // desde los valores iniciales)
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(`${css}\n*, *::before, *::after { transition: none !important; }`);
    document.adoptedStyleSheets = [sheet];
    document.head.replaceWith(document.importNode(parsed.head, true));
    const body = document.importNode(parsed.body, true);
    document.body.replaceWith(body);
    const images = Array.from(document.images).map(img =>
      img.complete ? Promise.resolve() : img.decode().catch(() => {}),
    );
    await withTimeout(Promise.all([document.fonts ? document.fonts.ready : null, ...images]), 5000);
    // Sin requestAnimationFrame: en un iframe de otro origen fuera de pantalla Chrome no lo ejecuta
    await new Promise(resolve => setTimeout(resolve, 30));
  }

  /**
   * Esta página es accesible desde la web (tiene que poder incrustarse en cualquier sitio), así que
   * cualquier página podría incrustarla y usarla para descargar imágenes de otros dominios con los
   * permisos de la extensión. Solo dibuja si trae un token de un solo uso que el service worker dio a
   * nuestro content script; las descargas de imágenes de una página de render sin token canjeado se
   * rechazan en el service worker.
   */
  function claim(token) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'CLAIM_RENDER_TOKEN', token }, res => {
        if (chrome.runtime.lastError || !res || !res.success) reject(new Error('Petición de render no autorizada'));
        else resolve();
      });
    });
  }
  const hasExtensionApi = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage;

  window.addEventListener('message', async event => {
    const data = event.data;
    const port = event.ports && event.ports[0];
    if (!data || data.type !== 'CTF_RENDER' || !port) return;
    try {
      // Sin API de extensión (pruebas con la página servida por http) no hay nada que proteger
      if (hasExtensionApi) await claim(String(data.token || ''));
      await render(String(data.html || ''), String(data.css || ''));
      const target = document.querySelector('[data-ctf-root]');
      if (!target) throw new Error('El bloque exportado no tiene raíz');
      if (typeof window.__codeToFigmaExtract !== 'function') throw new Error('Extractor no cargado');
      const res = await window.__codeToFigmaExtract(target);
      if (!res || !res.rootNode) throw new Error('No se pudo extraer el bloque');
      port.postMessage({ ok: true, rootNode: res.rootNode });
    } catch (err) {
      port.postMessage({ ok: false, error: String((err && err.message) || err) });
    }
  });
})();
