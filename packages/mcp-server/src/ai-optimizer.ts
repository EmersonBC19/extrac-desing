export interface AiOptimizationResult {
  payload: any;
  optimized: boolean;
  modelUsed?: string;
  reason?: string;
  durationMs?: number;
}

/**
 * Optimiza semánticamente un árbol UINode usando Google Gemini Flash (API gratuita).
 * 1. Poda wrappers redundantes de frameworks (divs utilitarios sin estilos que solo anidan un hijo).
 * 2. Estructura layouts 2D / CSS Grid en jerarquías Auto Layout canónicas (filas y columnas limpias).
 * 3. Asigna nombres semánticos de Design System (ej. 'Card / Container', 'Button / Primary').
 *
 * Si no hay API Key o la llamada falla/agota el tiempo, devuelve el payload original intacto.
 */
export async function optimizePayloadWithGemini(
  payload: any,
  apiKey?: string,
  options: { model?: string; timeoutMs?: number } = {},
): Promise<AiOptimizationResult> {
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key || typeof key !== 'string' || !key.trim()) {
    return { payload, optimized: false, reason: 'GEMINI_API_KEY no configurada' };
  }

  const rootNode = payload?.rootNode || (Array.isArray(payload?.nodes) ? payload.nodes[0] : null);
  if (!rootNode) {
    return { payload, optimized: false, reason: 'Payload sin rootNode' };
  }

  const t0 = Date.now();
  const timeoutMs = options.timeoutMs || 8000;

  // Lista de modelos ordenados por preferencia. Si el modelo elegido devuelve 404,
  // se prueba automáticamente el siguiente candidato vigente de la familia Flash/Flash-Lite.
  const requestedModel = options.model || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const candidateModels = Array.from(
    new Set([requestedModel, 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest']),
  ).filter(Boolean);

  // 1. Extraer imágenes base64 y SVGs inline a mapas temporales para reducir tokens y evitar mutaciones
  const imageMap = new Map<string, string>();
  const svgMap = new Map<string, string>();
  const originalTexts: string[] = [];
  let tokenIdx = 0;
  function stripAssetsAndCollect(n: any) {
    if (!n) return;
    if (n.type === 'TEXT' && n.textData?.characters) {
      const txt = String(n.textData.characters).replace(/\s+/g, ' ').trim();
      if (txt) originalTexts.push(txt);
    }
    if (n.imageData && typeof n.imageData === 'string') {
      const placeholder = `__IMG_TOKEN_${n.id || ++tokenIdx}__`;
      imageMap.set(placeholder, n.imageData);
      n.imageData = placeholder;
    }
    if (n.svgContent && typeof n.svgContent === 'string') {
      const placeholder = `__SVG_TOKEN_${n.id || ++tokenIdx}__`;
      svgMap.set(placeholder, n.svgContent);
      n.svgContent = placeholder;
    }
    if (Array.isArray(n.children)) {
      n.children.forEach(stripAssetsAndCollect);
    }
  }

  // Clonar árbol para no mutar el original en caso de fallo
  let treeClone: any;
  try {
    treeClone = JSON.parse(JSON.stringify(rootNode));
  } catch (_e) {
    return { payload, optimized: false, reason: 'No se pudo serializar el árbol' };
  }
  stripAssetsAndCollect(treeClone);

  const systemInstruction = `You are a Principal UI Engineer and Figma Design System Architect.
You receive a web UI tree JSON in UINode format extracted from HTML/CSS.
Your goal is to optimize the tree structure for clean, professional Figma Auto Layout:
1. PRUNE REDUNDANT WRAPPERS: Eliminate meaningless wrapper frames (e.g. wrapper <div> elements from React/Tailwind that have no background fill, no border stroke, no shadow, no padding, and only contain a single child frame). Move the child frame directly to the parent.
2. ORGANIZE CSS GRIDS: If you see multi-row/multi-column cards or grids, ensure they are grouped into clean HORIZONTAL Auto Layout rows with width 'FILL' or uniform itemSpacing so that Figma resizes them naturally.
3. SEMANTIC NAMING: Rename frames into clean Design System component names (e.g. 'Card / Container', 'Button / Action', 'Badge / Status', 'Nav / Bar', 'Item / GridCell', 'Header / Hero').
4. STRICT FIDELITY: Preserve all essential style properties (fills, strokes, cornerRadius, opacity, boxShadow), textData (characters, fontSize, fontWeight, color), svgContent tokens, imageData tokens, and original 'id' attributes.
Output ONLY a valid JSON object representing the optimized root UINode. No markdown backticks, no explanations.`;

  function restoreAssetsAndCheck(n: any, stats: { images: number; svgs: number; texts: Set<string> }) {
    if (!n) return;
    if (n.type === 'TEXT' && n.textData?.characters) {
      const txt = String(n.textData.characters).replace(/\s+/g, ' ').trim();
      if (txt) stats.texts.add(txt);
    }
    if (typeof n.imageData === 'string' && imageMap.has(n.imageData)) {
      n.imageData = imageMap.get(n.imageData);
      stats.images++;
    }
    if (typeof n.svgContent === 'string' && svgMap.has(n.svgContent)) {
      n.svgContent = svgMap.get(n.svgContent);
      stats.svgs++;
    }
    if (Array.isArray(n.children)) {
      n.children.forEach((c: any) => restoreAssetsAndCheck(c, stats));
    }
  }

  let lastFailureReason = '';

  for (const modelToTry of candidateModels) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      // La clave va en cabecera, no en la URL (las URLs acaban en logs y mensajes de error)
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelToTry)}:generateContent`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key.trim() },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `${systemInstruction}\n\nUI TREE JSON TO OPTIMIZE:\n${JSON.stringify(treeClone)}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        }),
      });
      clearTimeout(timer);

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        // Si el modelo no existe (404) o está descontinuado en la versión de API, probamos el siguiente candidato
        const isNotFound =
          res.status === 404 ||
          errBody.toLowerCase().includes('not found') ||
          errBody.toLowerCase().includes('is not supported');
        if (isNotFound) {
          lastFailureReason = `Modelo ${modelToTry} no disponible (${res.status}): ${errBody.slice(0, 150)}`;
          continue;
        }
        // Para errores de clave (400 / 403 Forbidden / API Key invalid), no tiene sentido reintentar con otro modelo
        return {
          payload,
          optimized: false,
          reason: `Gemini API error ${res.status} [${modelToTry}]: ${errBody.slice(0, 300)}`,
          durationMs: Date.now() - t0,
        };
      }

      const data: any = await res.json();
      const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!candidateText || typeof candidateText !== 'string') {
        lastFailureReason = `Respuesta vacía del modelo ${modelToTry}`;
        continue;
      }

      // Limpiar posibles bloques ```json ``` que a veces añade la API
      const cleanJson = candidateText
        .replace(/^```json\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();
      const optimizedRoot = JSON.parse(cleanJson);

      if (!optimizedRoot || typeof optimizedRoot !== 'object' || !optimizedRoot.type) {
        lastFailureReason = `El JSON devuelto por ${modelToTry} no tiene estructura UINode válida`;
        continue;
      }

      // 2. Restaurar imágenes/SVGs originales y verificar invariantes de contenido
      const restoreStats = { images: 0, svgs: 0, texts: new Set<string>() };
      restoreAssetsAndCheck(optimizedRoot, restoreStats);
      const missingText = originalTexts.some(t => !restoreStats.texts.has(t));
      if (restoreStats.images < imageMap.size || restoreStats.svgs < svgMap.size || missingText) {
        lastFailureReason = `Invariante rota por ${modelToTry}: textos o recursos omitidos; se conserva el original`;
        continue;
      }

      const optimizedPayload = {
        ...payload,
        rootNode: optimizedRoot,
        aiOptimized: true,
        aiModel: modelToTry,
      };

      return {
        payload: optimizedPayload,
        optimized: true,
        modelUsed: modelToTry,
        durationMs: Date.now() - t0,
      };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return {
          payload,
          optimized: false,
          reason: `Timeout tras ${timeoutMs}ms con Gemini`,
          durationMs: Date.now() - t0,
        };
      }
      lastFailureReason = `Fallo de red con ${modelToTry}: ${err?.message || err}`;
    }
  }

  return {
    payload,
    optimized: false,
    reason: lastFailureReason || 'No se pudo conectar con ningún modelo de Gemini Flash disponible',
    durationMs: Date.now() - t0,
  };
}
