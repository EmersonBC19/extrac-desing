/**
 * Resolución de imágenes pendientes: descarga vía service worker, data URI y recorte por captura.
 * Fuente única del extractor: se empaqueta en packages/browser-extension/extractor.js (scripts/build-extractor.mjs).
 */
import type { RawNode } from './types';
import { captureRegionsAcrossPage } from './capture';

/**
 * Recorre el árbol UINode y resuelve imágenes CORS / background-image de forma asíncrona
 * Utiliza el background service worker de la extensión para esquivar bloqueos de CSP y CORS
 */
/**
 * Toda imagen que entra al árbol debe ser data:image/...;base64 (mismo criterio que el esquema de
 * @code-to-figma/contracts). Valida lo que devuelven el service worker, el fetch de la página y la
 * captura de pantalla: una respuesta inesperada se descarta en lugar de llegar a Figma.
 */
export function isImageDataUri(value: unknown): value is string {
  return typeof value === 'string' && /^data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=\s]*$/i.test(value);
}

/**
 * Normaliza un data URI de imagen a base64. Los iconos en CSS suelen venir codificados como
 * URL (data:image/svg+xml,%3Csvg…); el contrato exige data:image/...;base64 en imageData.
 * Devuelve null si no es una imagen.
 */
export function dataUriToBase64(uri: string) {
  const m = /^data:([^,]*),([\s\S]*)$/.exec(uri);
  if (!m) return null;
  const meta = m[1];
  const mime = (meta.split(';')[0] || '').toLowerCase();
  if (!mime.startsWith('image/')) return null;
  if (/;base64$/i.test(meta)) return uri;
  let raw;
  try {
    raw = decodeURIComponent(m[2]);
  } catch (_e) {
    raw = m[2];
  }
  const bytes = new TextEncoder().encode(raw);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 8192)
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192) as unknown as number[]);
  return `data:${mime};base64,${btoa(bin)}`;
}

export async function resolvePendingImages(rootNode: RawNode) {
  const pendingNodes: RawNode[] = [];
  function collect(n: RawNode) {
    if (n._pendingImageSrc || n._pendingBgImageSrc) {
      n._hadPendingImage = true;
      pendingNodes.push(n);
    }
    if (n.children && n.children.length > 0) {
      for (const ch of n.children) collect(ch);
    }
  }
  collect(rootNode);

  await Promise.all(
    pendingNodes.map(async n => {
      try {
        let url = n._pendingImageSrc || n._pendingBgImageSrc;
        if (!url) return;
        if (!url.startsWith('data:')) {
          try {
            url = new URL(url, document.baseURI).href;
          } catch (_u) {}
        }

        let base64: string | null = null;
        if (url.startsWith('data:')) base64 = dataUriToBase64(url); // data URI embebido (SVG inline, etc.)

        // 1. Intento vía background service worker (inmune a CSP y CORS de la página)
        if (!base64 && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          try {
            const resp: any = await new Promise(resolve => {
              chrome.runtime.sendMessage({ type: 'FETCH_IMAGE_AS_BASE64', url }, (res: any) => {
                if (chrome.runtime.lastError) {
                  resolve(null);
                } else {
                  resolve(res);
                }
              });
            });
            if (resp && resp.success && isImageDataUri(resp.base64)) {
              base64 = resp.base64;
            }
          } catch (_bgErr) {
            base64 = null;
          }
        }

        // 2. Fallback directo en el contexto de la página
        if (!base64) {
          try {
            const res = await fetch(url);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const blob = await res.blob();
            if (blob.type && !blob.type.startsWith('image/')) throw new Error('No es imagen: ' + blob.type);
            base64 = await new Promise(resolve => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string | null); // readAsDataURL → string
              reader.onerror = () => resolve(null);
              reader.readAsDataURL(blob);
            });
          } catch (_fetchErr) {
            console.warn('[CodeToFigma] No se pudo obtener imagen directa:', url);
          }
        }

        if (base64) {
          if (isImageDataUri(base64)) n.imageData = base64;
        }
      } catch (_err) {
        console.warn('[CodeToFigma] Error resolviendo imagen:', n._pendingImageSrc || n._pendingBgImageSrc);
      } finally {
        delete n._pendingImageSrc;
        delete n._pendingBgImageSrc;
      }
    }),
  );

  // 3. Fallback estilo swarm-rebuild: lo que el DOM no puede devolver (video cross-origin,
  //    WebGL, iframes, imágenes con hotlink-protection) se recorta de una captura de pantalla.
  //    Solo nodos hoja: si tuvieran hijos, la captura duplicaría el texto encima.
  //    Los que quedan arriba o abajo de la vista se capturan recorriendo la página (capture.ts);
  //    los que quedan a los lados (slides de carrusel ocultos) no se pueden ver: se omiten.
  const vw = window.innerWidth;
  const shotNodes: RawNode[] = [];
  (function collectShot(n: RawNode) {
    const r = n._vpRect;
    // Efecto CSS sin equivalente en Figma (rotación, filtro de color, clip-path, máscara…): se
    // captura el elemento entero con su contenido. Sus hijos no necesitan captura propia.
    if (n._rasterize && r && r.width > 2 && r.height > 2 && r.left < vw && r.left + r.width > 0) {
      shotNodes.push(n);
      return;
    }
    if (
      !n.imageData &&
      r &&
      (n._needsShot || n._hadPendingImage) &&
      (!n.children || n.children.length === 0) &&
      r.width > 2 &&
      r.height > 2 &&
      r.left < vw &&
      r.left + r.width > 0
    ) {
      shotNodes.push(n);
    }
    (n.children || []).forEach(collectShot);
  })(rootNode);

  if (shotNodes.length > 0 && typeof window.__codeToFigmaCaptureRegions === 'function') {
    try {
      const crops = await captureRegionsAcrossPage(
        shotNodes.map(n => n._vpRect),
        window.__codeToFigmaCaptureRegions,
      );
      (crops || []).forEach((c, i) => {
        if (!isImageDataUri(c)) return; // sin captura: queda la versión aproximada (editable)
        const n = shotNodes[i];
        n.imageData = c;
        if (n._rasterize) {
          // La captura ya muestra fondo, bordes, hijos y el efecto: la imagen los reemplaza
          n.children = [];
          n.styles = { ...n.styles, fills: [], strokes: [], boxShadow: [], borderSides: undefined };
          n.layout = { ...n.layout, mode: 'NONE' };
          n.metadata = { ...(n.metadata || {}), rasterized: n._rasterize };
        }
      });
    } catch (_shotErr) {
      console.warn('[CodeToFigma] Captura de pantalla no disponible:', _shotErr);
    }
  }

  (function cleanup(n: RawNode) {
    delete n._vpRect;
    delete n._needsShot;
    delete n._hadPendingImage;
    delete n._rasterize;
    delete n._gridWrap;
    delete n._gridWrapOk;
    (n.children || []).forEach(cleanup);
  })(rootNode);

  return rootNode;
}
