# Plan de mejoras — Code to Figma

Consolida **todo** lo identificado en:

- **[A1]** Análisis externo 1 — "Veredicto general" (fortalezas, grietas A–E, oportunidades de producto)
- **[A2]** Análisis externo 2 — "CQRS, Zod, Vitest, bundler, lint, logger"
- **[REV]** Revisión técnica de esos análisis contra el código real
- **[CONV]** Problemas y decisiones surgidos en las sesiones de trabajo (imágenes, carruseles, texto, layout, tablero)

Fecha de corte: 2026-11-20.

---

## 0. Estado real (verificado en el repo)

| Afirmación | Realidad |
|---|---|
| [A2] dice "Lo que completamos": CQRS, Zod, Vitest, bundler único, ESLint/Prettier, logger | **Nada de eso existe.** No hay `zod`, `vitest`, `eslint`, `prettier`, `tsup` ni `esbuild` en ningún `package.json`; no hay bus/commands/logger. Es una **propuesta**, no trabajo hecho. |
| [A2] TypeScript strict | **Ya existe** (`strict: true` en `tsconfig.base.json` y en el plugin). Falta en la extensión, que es JavaScript. |
| Despacho de mensajes | 21 cadenas `if (msg.type === …)` repartidas en `code.ts` (8), `ws-hub.ts` (7), `ui.html` (6) y `background.js` (1). |
| Logs | 83 `console.*` dispersos (31 en `crawl-cli.ts`, 19 en `ws-hub.ts`, 11 en `code.ts`…). |
| [A1-B] Duplicación de extractores | **Ya divergieron.** `core-extractor/src/dom-to-node.ts` (1365 líneas) no tiene ninguna mejora reciente (`fitAutoLayoutToGeometry`, `buildRichText`, `isCarouselSlide`: 0 coincidencias). El CLI/MCP produce resultados peores que la extensión. |
| Seguridad del hub | `new WebSocketServer({ port })` **sin validación de origen ni autenticación**. |
| Control de versiones | **3 commits.** Todo el trabajo reciente está sin commit y `packages/browser-extension/` está sin versionar (untracked). |
| Pruebas | **Ninguna en el repo.** Solo scripts sueltos en `scratch/` (ver §2.1). |

---

## 1. Orden de ejecución y por qué

| Fase | Qué | Por qué en este orden |
|---|---|---|
| **0** | Versionar el trabajo + validar el tablero en Figma real | Hoy un disco dañado o un `git checkout` borra semanas de trabajo. Y el tablero solo se probó en simulador. |
| **1** | Seguridad y privacidad | Riesgo activo hoy, arreglo barato. |
| **2** | Red de seguridad: pruebas de regresión | Antes de mover código, hay que poder detectar si algo se rompe (ya pasó: se perdió el normalizador de imágenes al reescribir `ui.html`). |
| **3** | Un solo extractor (TS + esbuild) | Elimina la divergencia; las pruebas de la fase 2 protegen la migración. |
| **4** | Contratos y mensajes tipados (Zod + bus) + logger + lint | Se apoya en el código ya unificado; sin la fase 3 habría que tipar dos extractores. |
| **5** | Robustez de extracción | Mejoras de fidelidad sobre una base estable y probada. |
| **6** | Funciones de producto en Figma | Variantes, Variables, mejoras del tablero. |
| **7** | Distribución "cero terminal" | Requiere todo lo anterior estable; es lo que convierte el proyecto en producto. |

---

## Fase 0 — Inmediato

### 0.1 Versionar el trabajo  `[REV]` — ✅ hecho (2026-11-20)
> Rama `feat/extractor-fidelity`, 7 commits: `.gitignore`, extensión, contratos, plugin, crawler/hub, docs, herramientas de prueba.
> Commits **por paquete**, no por tema: varios archivos mezclaban cambios previos del usuario con los de la sesión y no había staging interactivo para separarlos.
> Sin versionar a propósito: `swarm-cursors-main/` (ignorado), `scratch/captured-last-payload.json` (ignorado), `scratch/page_screenshot.png` (modificado) y 76 archivos sueltos de `scratch/` del usuario.
> ✅ Subida a `origin` (github.com/EmersonBC19/extrac-desing), rama `feat/extractor-fidelity`. `main` intacto; fusionar vía Pull Request.
> Revisión de `scratch/`: solo se versionan las herramientas `_*.cjs` y `test-drag-inspector.ts` (la única prueba previa que sigue pasando). El resto queda local e ignorado:
> - `test-auth-login.ts` (credenciales en texto plano) y `views/` (volcados de una app privada): **nunca subir**.
> - `build-extractor.js`, `build-new-plugin-ui.js`, `update-content-script.js`: **sobrescriben código fuente con versiones antiguas** (probable causa de la pérdida del normalizador de imágenes en `ui.html`). No ejecutarlos; con la fase 3 (bundler) dejan de tener sentido.
> - `verify-extractor.ts`, `test-different-viewports.js`, `test-responsive-inspector.ts`: rotos por el cambio de formato del extractor (`{ rootNode, tokens }`); reemplazados por `_harness.cjs`.

- Crear rama (`feat/extractor-fidelity`) y commits por tema: imágenes/carruseles, texto, layout por geometría, tablero, atajos/efecto lift.
- Añadir `packages/browser-extension/` al repo.
- Revisar `.gitignore`: excluir `scratch/captured-last-payload.json` (puede contener datos privados, ver 1.2), PNG/JSON de pruebas en `scratch/`.
- Decidir qué hacer con los `dist/` versionados (hoy se commitean; con el bundler de la fase 3 conviene generarlos en build).

### 0.2 Validar en Figma real lo construido  `[CONV]`
- Tablero (`board`) con `body` de indudesk.online y una multi-selección: secciones 01→04 en horizontal, componentes enlazados, estilos.
- Confirmar en el log del plugin las etapas "Tablero · …" y que no aparezcan frames sueltos.
- Si falla: capturar el mensaje del log + `scratch/captured-last-payload.json` y reproducir con `scratch/_board_sim.cjs`.

---

## Fase 1 — Seguridad y privacidad — ✅ hecha (2026-11-20)

> **Hallazgo crítico (no estaba en A1 ni A2):** `REQUEST_VIEW_RENDER` interpolaba `viewId`, `route`, `name` y `pageName` del mensaje en un comando de shell (`exec`) y en rutas de archivo. Cualquier página web abierta en el navegador podía conectarse al hub y **ejecutar comandos en el equipo** (inyección de comandos) o leer JSON fuera de `scratch/views` (path traversal). Confirmado con una prueba real contra la versión anterior: el comando inyectado se ejecutó. Corregido: solo ids del catálogo, rutas de URL simples y `execFile` sin shell.
>
> Pruebas: `scratch/_hub_security_test.cjs` (19/19; contra el hub anterior 5/17), `scratch/_plugin_pairing_test.cjs` (10/10), `scratch/_schema_test.cjs` (16/16).

### 1.1 Hub WebSocket autenticado  `[REV]` (omitido por A1 y A2) — ✅
> Implementado en `packages/mcp-server/src/hub-security.ts` + `ws-hub.ts`:
> - Origen validado en el handshake: páginas web → 403; `chrome-extension://` y procesos locales sin `Origin` → confiables; `https://*.figma.com` → confiable.
> - Origen `null` (UI del plugin de Figma; una página atacante también puede producirlo con un iframe sandbox) → **código de vinculación** `XXXX-XXXX`, persistente en `~/.code-to-figma/pairing-code`, guardado por el plugin en `figma.clientStorage`. Comparación en tiempo constante; bloqueo 1 min tras 5 fallos; cierre a los 10 s sin vincular.
> - Diferencia con lo planeado: la extensión no usa token (su origen no es falsificable por una web) → cero fricción para el usuario; solo el plugin se vincula una vez.
> - Escucha en `127.0.0.1`; `maxPayload` 64 MB; nada se atiende ni se reenvía a clientes sin autenticar.
> - `content.js` ya no abre WebSockets desde la página (el hub los rechaza y el CSP los bloqueaba): todo va por el service worker.
> - Pendiente opcional: fijar `CTF_EXTENSION_IDS` al publicar la extensión (ID estable de la Chrome Web Store).

**Riesgo:** cualquier página web puede abrir `ws://localhost:8080` (los navegadores lo permiten), dibujar en el Figma del usuario, pedir el catálogo de vistas del crawler y recibir lo que el hub reenvía.
**Riesgo:** cualquier página web puede abrir `ws://localhost:8080` (los navegadores lo permiten), dibujar en el Figma del usuario, pedir el catálogo de vistas del crawler y recibir lo que el hub reenvía.
- Validar el header `Origin` (aceptar solo `chrome-extension://<id>` y el origen del plugin de Figma, `null`).
- Token compartido: el hub genera un token al arrancar; extensión y plugin lo envían en el primer mensaje (`REGISTER`) y el hub cierra conexiones sin token.
- Escuchar solo en `127.0.0.1` (no en todas las interfaces).
- No reenviar mensajes de un cliente a otros clientes no autorizados.

### 1.2 Payload de diagnóstico  `[REV]` — ✅
> Solo con `CTF_DEBUG_CAPTURE=1`; desactivado por defecto (y el archivo sigue en `.gitignore`).

- `scratch/captured-last-payload.json` guarda la captura completa (incluye imágenes). En dashboards con sesión iniciada son datos privados en disco.
- Ponerlo detrás de un modo debug (`DEBUG_CAPTURE=1` o ajuste en el plugin) y desactivado por defecto.

### 1.3 Validación de entrada en tiempo de ejecución (Zod)  `[A2]` — ✅ hub · ⏳ plugin con Zod (fase 3)
> - `packages/contracts/src/schemas.ts`: `validateRenderPayload` / `validateUINodeTree` (Zod 3), recorrido iterativo (un árbol malicioso no desborda la pila), límites: 400 niveles, 150.000 nodos, imagen ≤ 40 M caracteres, SVG ≤ 2 MB sin `<script>`/`javascript:`, texto ≤ 200.000.
> - Hub: valida todo `RENDER_NODES` y responde `RENDER_ERROR` al emisor; nada inválido llega a Figma.
> - Plugin: `guardRenderPayload` en `code.ts` con las mismas reglas (cubre "Pegar JSON"). Duplicado temporal: se reemplaza por el esquema Zod compartido cuando el plugin tenga empaquetador (3.2).
> - Extensión: normaliza en origen los data URI de imagen codificados como URL (`data:image/svg+xml,%3Csvg…`) a base64 (falso rechazo detectado en Wikipedia).
> - Pendiente: validar las respuestas del service worker en la extensión (llega con la migración a TS de la fase 3).

- Esquemas en `@code-to-figma/contracts` para `UINode`, `RenderPayload` y cada mensaje del bus.
- Validar en **las tres fronteras**: hub (lo que entra por WebSocket), plugin (`RENDER_NODES` y "Pegar JSON") y extensión (respuestas del service worker).
- Límites defensivos dentro del esquema: profundidad máxima, nº de nodos, tamaño de `imageData`, `svgContent` sin `<script>`.
- Nota: Zod no puede ir dentro del plugin sin empaquetador (el plugin compila con `tsc` a CommonJS sin bundle). Depende de 3.2.

### 1.4 Fetch de imágenes con credenciales  `[REV]` — ✅
> `imageFetchPolicy` en `background.js`: solo http/https/data; recursos de red local (localhost, 10.x, 192.168.x, 172.16–31.x, ::1, *.local…) solo si la pestaña también es de red local; cookies solo para el mismo sitio que la pestaña (`credentials: "omit"` en el resto). La URL de la pestaña la da Chrome (`sender.tab.url`), no el mensaje. 14 casos verificados.
> Limitación conocida: un dominio público que resuelve a IP privada no se detecta (el service worker no resuelve DNS); Chrome añade su propia protección (Private Network Access).

- `background.js` descarga imágenes con `credentials: "include"` para plataformas con login. Limitar a URLs que aparecen en el DOM extraído (ya es así) y bloquear IPs privadas / `file:` salvo en la pestaña de origen, para evitar que una página induzca descargas internas.

---

## Fase 2 — Red de seguridad (pruebas) — ✅ hecha (2026-11-20)

> **Resultado:** `npm test` = 155 pruebas (102 unitarias + 53 de integración, ~70 s, sin red) + `npm run test:live` = 9 sobre sitios reales. CI en `.github/workflows/tests.yml`. Detalle en `tests/README.md`.
>
> **Bugs reales que encontraron las pruebas al escribirlas** (corregidos):
> - Los **botones nunca se convertían en componentes** del tablero: el detector exigía ≥ 3 nodos y un botón es caja + texto. Ahora cuenta toda caja con estilo propio + contenido.
> - La **decoración `::before`/`::after` de cajas vacías se perdía** (brillos, formas de fondo): solo se extraía en elementos con hijos.
> - Un **icono centrado** salía como "MIN + padding": igual a la vista, pero se descentraba al redimensionar en Figma. Ahora se prefiere CENTER.
> - `image-set("a.png" 1x)` con comillas devolvía null.
>
> **Dependencias:**
> - Zod 3.25.76 tenía un aviso de severidad alta (GHSA-mrhx-c7xc-m3w5: agotamiento de memoria con colecciones grandes). Actualizado a **Zod 4.6.7**; los esquemas funcionan sin cambios.
> - Playwright fijado en 1.63.0 (con `^` npm instalaba 1.65, que requiere otro Chromium).
> - ⏳ **Pendiente:** `@modelcontextprotocol/sdk` ≤ 1.31 tiene avisos altos (y arrastra `hono`, `body-parser`, `qs`, `fast-uri`, `ip-address`). `npm audit fix` lo corrige sin cambio de versión mayor, pero el servidor MCP no tiene pruebas: actualizar junto con pruebas del servidor MCP (ver 4.x).
>
> Pendiente menor: el nombre de capa de un título incluye texto sr-only (`Heading 2 / iPad texto s…`); el texto exportado ya lo excluye.

### 2.1 Convertir las herramientas existentes en suite  `[A2]` `[REV]`
Ya existen y funcionan; hay que formalizarlas en `tests/` con un runner (**Vitest** `[A2]` + Playwright):

| Herramienta actual (`scratch/`) | Prueba que pasa a ser |
|---|---|
| `_layout_audit.cjs` | **Fidelidad de Auto Layout**: 0 hijos mal ubicados (>2 px) en páginas fixture. Hoy: 0/86 Apple, 0/364 GitHub, 0/469 Stripe, 0/93 Vercel, 0/474 Tailwind, 0/135 Notion. |
| `_harness.cjs` | **Imágenes**: todas extraídas, ≤4096 px, formato PNG/JPEG/GIF, carruseles completos (9/9 galería Apple, 15/15 página sintética). |
| `_figma_mock.cjs` + `_board_sim.cjs` | **Plugin sin Figma**: render normal, tablero, multi-selección, límite de páginas, fallo forzado → fallback. |
| `_dump_text.cjs` | **Texto**: saltos de línea conservados, superíndices (`¹`), tramos de estilo. |
| `_hub_security_test.cjs` | **Seguridad del hub**: origen, vinculación, fuerza bruta, inyección de comandos, path traversal, red local, payload malicioso. |
| `_plugin_pairing_test.cjs` | **Vinculación del plugin**: primera vez, código incorrecto, reapertura, compatibilidad con hub antiguo. |
| `_schema_test.cjs` | **Esquemas**: extracciones reales aceptadas (Apple, GitHub, Wikipedia, sintética) y payloads maliciosos rechazados. |
| `test-drag-inspector.ts` | **Inspector**: arrastre de la barra y persistencia de su posición. |
| Página sintética (`scratchpad/site`) | Fixture local: carrusel con transform, scroll-snap, fade, WebP/SVG, `image-set`, `::before` con imagen, video con póster, iframe, WebGL. |

- **Fixtures congeladas**: guardar HTML+CSS estáticos de las páginas de referencia (no depender de que apple.com cambie).
- ✅ **Página sintética en el repo**: `tests/fixtures/synthetic/` (`index.html`, `hero.html`, `shot.html`, generador de imágenes y servidor), movida desde la carpeta temporal de la sesión.
- **Pruebas unitarias** puras: `boardDetectComponents`, `boardCleanName`, `fitAutoLayoutToGeometry`, `fitWrapToGeometry`, `buildRichText`, `extractBgUrl`, `parseColor`, `parseGradient`.
- **Snapshot del contrato**: forma del JSON exportado, para detectar cambios accidentales.
- ✅ CI (GitHub Actions) ejecutando la suite en cada push.
- ⏳ Pruebas del servidor MCP (`index.ts`, `crawl-cli.ts`): no cubiertas; necesarias antes de actualizar su SDK.

---

## Fase 3 — Un solo extractor  `[A1-B]` `[A2]` — ✅ hecha (2026-11-20)

> **Resultado:**
> - **Un solo extractor:** `packages/core-extractor/src/browser/` (TypeScript, 7 módulos: `dom-helpers`, `text`, `geometry`, `extract-node`, `images`, `tokens`, `entry`) → esbuild → `packages/browser-extension/extractor.js`. El crawler (`BrowserExtractor`, `SiteCrawler`) inyecta **ese mismo archivo**: ahora tiene todas las mejoras (layout por geometría, texto, imágenes, carruseles). `dom-to-node.ts` (copia vieja, 1365 líneas) eliminado.
> - **Plugin empaquetado:** `packages/figma-plugin/src/` en 10 módulos (`code`, `render`, `fonts`, `paint`, `text-sizing`, `types`, `validation`, `board/{board,pure,context}`) → esbuild → `dist/code.js` (257 KB, sin minificar para errores legibles).
> - **Zod dentro del plugin:** `validation.ts` usa `validateRenderPayload` de contracts (misma definición que el hub); la copia manual de reglas desapareció. contracts se empaqueta desde su fuente ESM con `import * as z`: el bundle pasó de 992 KB a 257 KB.
> - **Pendiente de 1.3 cerrado:** el extractor valida lo que devuelven el service worker, el fetch de la página y la captura (`isImageDataUri`).
> - Las pruebas unitarias importan los módulos fuente; se eliminaron `__codeToFigmaInternals` y los marcadores `@@BOARD_PURE`.
> - **Archivos generados:** se versionan (la extensión y el plugin se cargan sin compilar); `npm run check:generated` y el CI fallan si no están al día. Build determinista (`absWorkingDir`).
> - Pruebas: 166 (unit + integración, +4 del crawler) y 9/9 live.
>
> **Pendiente:** el extractor de navegador usa tipado flexible (`strict: false`, migrado de JavaScript) → se endurece en 4.3.
> ✅ Verificado en Figma real (2026-11-20): el plugin empaquetado con Zod corre en el sandbox y arma el tablero. Bugs visuales → backlog QA.

### 3.1 Fuente única en TypeScript
- Mover la lógica de `browser-extension/extractor.js` (la versión más avanzada) a `packages/core-extractor/src/` como módulos TS: `layout/`, `text/`, `images/`, `carousel/`, `pseudo/`, `tokens/`.
- `dom-to-node.ts` actual se **reemplaza** (está desactualizado), no se fusiona línea a línea.

### 3.2 Empaquetado (esbuild o tsup)
- `core-extractor` → bundle IIFE que genera `browser-extension/extractor.js` (cero edición manual).
- El crawler (`mcp-server`) inyecta el mismo bundle en Playwright → CLI y extensión idénticos.
- El plugin de Figma también pasa a empaquetarse (habilita Zod y módulos: hoy todo vive en un solo `code.ts` de ~1700 líneas).

### 3.3 Reparto del plugin en módulos
- `render/` (frames, texto, imágenes, SVG), `board/` (tablero), `styles/`, `fonts/`, `messaging/`.
- La lógica pura del tablero ya está delimitada (`@@BOARD_PURE_START/END`) para extraerla y probarla.

---

## Fase 4 — Calidad de código y mensajería — ✅ hecha (2026-11-20)

> **Resultado:**
> - **Catálogo de mensajes** (`packages/contracts/src/messages.ts`): cada mensaje de los 3 canales (hub WebSocket, UI↔sandbox del plugin, content script↔service worker) con su tipo CQRS (command/query/event), ruta y descripción. Los nombres de red no cambian. `HubInboundSchema` (Zod) valida todo lo que entra al hub.
> - **Tablas de manejadores** en lugar de cadenas `if`: hub (`ws-hub.ts`, tipada: el compilador exige un manejador por mensaje), sandbox del plugin (`code.ts`; el render pasó a `render-command.ts`), UI del plugin (`HUB_HANDLERS`, `SANDBOX_HANDLERS`) y service worker (`MESSAGE_HANDLERS`). Mensajes desconocidos → aviso en el log. Prueba `tests/integration/messages.test.ts` compara catálogo ↔ manejadores.
> - **Bug corregido:** la UI del plugin avisaba al hub con `RENDER_COMPLETED` (el hub espera `RENDER_SUCCESS`) y no reenviaba `RENDER_ERROR`: el CLI y el MCP nunca se enteraban de que Figma terminó o falló.
> - **Logger** (`packages/contracts/src/logger.ts`): niveles, ámbitos anidados (`hub:auth`), metadatos y sinks. Hub: consola + archivo rotativo opcional (`CTF_LOG_FILE`, 5 MB + 1 respaldo; `CTF_LOG_LEVEL`). Plugin: consola de Figma (`src/log.ts`). CLI y crawler: logger inyectable.
> - **Servidor MCP:** todo su log va a stderr. Antes `crawl_site_to_figma` escribía el progreso del crawler en stdout y corrompía el canal JSON-RPC. Si el puerto 8080 ya está ocupado (hub corriendo) ya no se cae: reenvía los renders a ese hub (`figma-relay.ts`). `@modelcontextprotocol/sdk` 1.31 → 1.32.2 (0 vulnerabilidades); `tests/integration/mcp-server.test.ts` lo cubre por stdio.
> - **CLI de crawling:** conecta a `127.0.0.1` (antes `localhost`, que en Windows puede resolver a `::1` y no llegar al hub), respeta `WS_PORT` y sale con código 1 si falla.
> - **ESLint 9 + typescript-eslint** (`eslint.config.mjs`, `npm run lint`, en CI) y **Prettier** (`.prettierrc.json`, `npm run format`). El formato del repo completo se aplica en un commit aparte, solo de formato.
> - **Extractor de navegador en `strict`** (antes `strict: false`): solo anotaciones de tipo; `extractor.js` generado idéntico byte a byte.
> - Código muerto eliminado: `if (false && payload.clearPage)` (plugin), parámetro `clearPage` sin uso (service worker). `directWebSocketFallback` ya no existía en `content.js`.
> - Pruebas: 181 (unit + integración; +4 MCP, +7 mensajes, +4 logger) y 9/9 live.
>
> **Nota:** el extractor usa `strict` con `alwaysStrict: false` a propósito: esbuild lee ese tsconfig y con `alwaysStrict` cambiaría la semántica de funciones declaradas dentro de bloques.

### 4.1 Mensajes tipados (CQRS "ligero")  `[A2]`
Recomendación: **adoptar los nombres y la separación de A2, sin montar un CQRS completo** (sería sobre-ingeniería para el tamaño actual).
- Unión discriminada tipada + esquema Zod por mensaje + **tabla de handlers** (`Record<MessageType, Handler>`) en lugar de cadenas `if`.
- **Commands** (mutan): `RenderComponentCommand`, `DeleteNodeCommand`, `ConvertToComponentCommand`, `ClearCanvasCommand`.
- **Queries** (consultan): `GetCanvasStatusQuery`, `GetPageInfoQuery`, `GetCatalogQuery`.
- **Events** (notifican): `ComponentRenderedEvent`, `NodeDeletedEvent`, `PluginConnectedEvent`, `ExtractionFailedEvent`.
- Compatibilidad: mantener los nombres actuales (`RENDER_NODES`, `RENDER_SUCCESS`, `RENDER_ERROR`, `LOG`, …) como alias durante la migración.

### 4.2 Logger centralizado  `[A2]`
- Niveles `debug/info/warn/error` + metadatos (componente, etapa, duración, id de render).
- Un único canal hacia la UI del plugin (hoy: `figma.ui.postMessage({type:'LOG'})` disperso).
- En el hub: logs a archivo rotativo (útil cuando el hub sea un ejecutable sin consola, fase 7).
- Reemplazar los 83 `console.*`.

### 4.3 ESLint + Prettier + strict  `[A2]`
- Config única en la raíz; `npm run lint` / `npm run format`.
- Prohibir `any` implícito de forma gradual (hoy el plugin usa `any` en muchos sitios del payload).
- Limpiar código muerto detectado: `if (false && payload.clearPage)` en `code.ts`; `directWebSocketFallback` en `content.js` (el CSP del sitio lo bloquea; evaluar si sigue teniendo sentido).

---

## Fase 5 — Robustez de extracción

### 5.1 Selecciones pesadas ("DOM monster")  `[A1-E]` `[REV]`
- Aviso antes de enviar, medido por **peso** y no solo por nodos (el umbral de 600 nodos de A1 es bajo: el `body` de indudesk lo supera y funciona bien).
  - Métricas: nº de nodos, nº de imágenes, MB estimados del payload, profundidad.
  - Referencias medidas: Apple home 3,8 MB; indudesk `body` 4,4 MB; Wikipedia 4262 textos / ~5 s de extracción.
- Opciones en el aviso: extraer completo / sin imágenes / elegir un bloque.
- Envío por partes (chunks) si supera N MB, y progreso visible en el plugin.
- Medir el tiempo de dibujo en Figma (hoy no medido; A1 afirma "<150 ms" sin medición).

### 5.2 Páginas largas  `[CONV]`
- Recorrido previo de scroll: hoy máx. **40 pasos** (`content.js`, `maxSteps`). Hacerlo proporcional al largo de la página.
- Quitar el corte de **12.000 px** para hojas lejos de su contenedor (`extractor.js`), que hoy no aporta.
- Capturas de pantalla (video, WebGL, iframes, imágenes bloqueadas) **durante** el recorrido previo, no solo de lo visible al final.

### 5.3 Fuentes  `[A1-D]` `[CONV]`
- Ya mitigado: saltos de línea del navegador conservados (`noWrap`) → los títulos no saltan antes aunque Figma use Inter.
- Pendiente: listar en el log las fuentes no disponibles y su sustituta; tabla de equivalencias configurable (ej. SF Pro → Inter, Circular → …); opción de usar la fuente si el usuario la instala.

### 5.4 Efectos CSS sin equivalente directo  `[CONV]`
Hoy se pierden o se aproximan:
- `transform` con rotación/inclinación, `filter` (blur, grayscale…), máscaras y `clip-path` con formas, `mix-blend-mode`, `text-shadow`, degradados cónicos y posiciones de degradados radiales.
- Opción general: rasterizar el elemento afectado mediante la captura de pantalla (como ya se hace con WebGL/iframes).

### 5.5 Técnicas pendientes de swarm-rebuild  `[CONV]`
- Floats que desvían el texto (swarm añade "shims").
- Desplazamiento vertical en celdas de tabla (`table-cell`).
- Elementos rotados/volteados.

### 5.6 Grids 2D  `[A1-C]`
- Hoy: grid 2D → posiciones exactas (fiel visualmente, no editable con Auto Layout).
- Mejora: si el grid tiene filas regulares, convertirlo en columna Auto Layout de filas Auto Layout (la detección de filas ya existe en `fitWrapToGeometry`).

### 5.7 Otros pendientes  `[CONV]`
- El inspector ya no es "cero mutación del DOM": el efecto de elevación modifica `translate`/`scale` del elemento (se restaura siempre). Documentarlo y vigilarlo en las pruebas.
- Elementos `position: fixed/sticky`: corregido para headers; revisar `sticky` dentro de contenedores (posición natural no siempre deducible).

---

## Fase 6 — Producto en Figma

### 6.1 Variantes automáticas (Component Sets)  `[A1]` `[CONV]`
- **De tamaño/estilo**: hoy el tablero crea `Tile Ctas`, `Tile Ctas 2`, `Tile Ctas 3` por separado (misma estructura, distinto tamaño). Agruparlos con `combineAsVariants` (`Size=L/M/S`).
- **De estado**: capturar estado normal y luego hover/abierto (modo congelar `F`) y unirlos como `State=Default/Hover`. A1 lo señala como diferenciador frente a la competencia.

### 6.2 Variables de Figma  `[A1]`
- Pasar de Paint Styles (`Token / …`) a **Variables** nativas (`figma.variables`): colores, espaciados (gaps/paddings detectados por geometría), radios.
- Vincular fills y paddings de las capas a esas variables.

### 6.3 Mejoras del tablero  `[CONV]`
- Las sub-vistas de "02 · Secciones" son copias: convertirlas en instancias de componentes de sección para que se sincronicen con la vista completa.
- Paleta limitada a 32 colores: agrupar colores casi iguales (ΔE pequeño) en vez de cortar.
- Opción en la UI: tablero automático / siempre / nunca.

---

## Fase 7 — Distribución "cero terminal"  `[A1-A]` `[A1]`

### 7.1 Eliminar la dependencia de la terminal
- Opciones a evaluar:
  1. **Hub empaquetado** como app de bandeja (Tauri/Go) que arranca con el sistema, con puerto configurable y detección de puerto ocupado.
  2. **Native Messaging** de Chrome: la extensión lanza el host local sin terminal (requiere instalador).
  3. **Relay en la nube** con emparejamiento extensión↔plugin por código (sin nada local, pero implica servidor y privacidad).
- Mientras tanto: el fallback "Copiar JSON / Pegar JSON" ya existe.

### 7.2 Publicación  `[A1]` `[REV]`
- **Chrome Web Store**: justificar `host_permissions: <all_urls>` (descarga de imágenes cross-origin) o reducirlo a permisos opcionales por sitio.
- **Figma Community**:
  - `networkAccess.allowedDomains: ["*"]` → acotar y justificar.
  - Verificar las reglas actuales sobre conexiones a `localhost` en plugins publicados.
  - Verificar si se exige `documentAccess: "dynamic-page"`; de ser así, migrar a APIs asíncronas: `figma.currentPage =` → `setCurrentPageAsync`, `getNodeById` → `getNodeByIdAsync`, `getLocalPaintStyles` → `getLocalPaintStylesAsync`, `textStyleId =` → `setTextStyleIdAsync`, `fillStyleId =` → `setFillStyleIdAsync`.
- Instalador único / guía de instalación para usuarios no técnicos.

---

## Backlog de bugs observados — se atacan DESPUÉS de terminar las fases  `[QA]`

Decisión del usuario (2026-11-20): primero terminar las fases 4–7; luego una ronda dedicada a estos bugs.
Origen: prueba en Figma real del tablero con el `body` de indudesk.online (fase 3) + consola del navegador.

**Lo que funciona en Figma real:** la extracción llega, el tablero se arma con sus 4 Sections en orden (01 → 04), la sección 02 separa las secciones de la landing, se crean estilos de color y texto, y el plugin empaquetado con Zod corre en el sandbox de Figma.

| ID | Síntoma observado | Hipótesis (a confirmar) | Prioridad |
|---|---|---|---|
| **QA-1** | "No se ven bien": el resultado general en Figma no se parece lo suficiente a la web. | Síntoma general: hay que desglosarlo comparando cada sección lado a lado (web vs Figma). Las auditorías automáticas miden posiciones, no apariencia. | Alta |
| **QA-2** | En **02 · Secciones** varias sub-vistas salen claras/grises y sin el fondo oscuro de la web (ej. "Preguntas frecuentes"). | La sección no tiene fondo propio: lo hereda del `body`/`main`. Al copiarla como sub-vista pierde ese fondo heredado. Arreglo probable: aplicar al clon el fondo efectivo del ancestro más cercano. | Alta |
| **QA-3** | Títulos de las sub-vistas y etiquetas de componentes casi ilegibles. | Texto oscuro (`#1A1A1F` / morado) sobre el fondo de Section de Figma, que es oscuro con la UI en modo oscuro. Arreglo: fondo explícito claro en las Sections o colores de texto con contraste suficiente en ambos modos. | Media |
| **QA-4** | En **04 · Estilos** las muestras tipográficas se cortan a la derecha ("74 · Outfit ExtraBold — Aa B…"). | El ancho de la Section se calcula antes de que el texto tome su ancho final, o las muestras grandes (hasta 72 px) desbordan. Arreglo: ajustar la Section después de crear las muestras o limitar su ancho con salto de línea. | Media |
| **QA-5** | **03 · Componentes** se ve pequeño y poco claro a la escala del tablero. | Pocos componentes detectados en esa landing y sin agrupación visual por tipo. Revisar al hacer QA-1 (posible mejora: variantes y grilla por categoría, fase 6.1). | Baja |
| **QA-6** | Consola de la página: decenas de `WebSocket connection to 'ws://localhost:8080/' failed` y varios `Extractor Engine … ready` repetidos. | Copias **viejas** de `content.js` siguen vivas en la pestaña tras recargar la extensión (líneas `extractor.js:2307/2352` = versiones anteriores; `:2056` = la nueva). Sin conexión con la extensión, recurren a su WebSocket directo, que el hub nuevo rechaza (correcto, fase 1). Arreglo: detectar "extension context invalidated" y desactivar el inspector viejo con aviso "recarga la página"; evitar reinyectar el extractor si ya está cargado. Mientras tanto: F5 en la pestaña. | Baja |

**Cómo reproducir:** `node scratch/_board_sim.cjs https://indudesk.online/ "document.body"` (simulador) o la extensión real sobre `https://indudesk.online/`. Para QA-1 conviene activar `CTF_DEBUG_CAPTURE=1` en el hub y guardar capturas de la web y de Figma por sección.

---

## Fortalezas a preservar (no romper)  `[A1]` `[CONV]`

Las pruebas de la fase 2 deben cubrirlas explícitamente:

- Auto Layout ajustado a la geometría real (no a palabras clave CSS) con caída a posiciones exactas cuando Auto Layout no puede reproducir la web.
- Relay por service worker: inmune a CSP/CORS del sitio.
- Carga segura de fuentes (precarga + sustituta) y saltos de línea conservados.
- Design tokens desde variables CSS de `:root`.
- Imágenes: normalización a ≤4096 px y PNG/JPEG/GIF; `srcset`/`picture`/`image-set`/lazy; captura de pantalla para video/WebGL/iframes.
- Carruseles completos y recortados como en la web.
- Texto enriquecido en un solo nodo, superíndices Unicode.
- Tablero tipo design system con componentes enlazados y estilos vinculados.
- Fallbacks que nunca bloquean la exportación.

---

## Trazabilidad: cada punto de los análisis → fase

| Origen | Punto | Fase |
|---|---|---|
| A1 | Fortaleza: inferencia de Auto Layout | Preservar (pruebas 2.1) |
| A1 | Fortaleza: bypass CSP/CORS vía service worker | Preservar (2.1) |
| A1 | Fortaleza: prewarm de fuentes | Preservar; matiz en 5.3 |
| A1 | Fortaleza: design tokens | Preservar; evolución 6.2 |
| A1-A | Dependencia del proceso Node / terminal | 7.1 |
| A1-B | Duplicación core-extractor / extractor.js | 3.1–3.2 |
| A1-C | Grids 2D | 5.6 |
| A1-D | Fuentes licenciadas | 5.3 |
| A1-E | DOM monster / payloads enormes | 5.1 |
| A1 | Variantes automáticas | 6.1 |
| A1 | Variables de Figma | 6.2 |
| A1 | Distribución cero terminal | 7.1–7.2 |
| A1 | "Superior al 90 %", "<150 ms" (no medido) | 5.1 (medir) |
| A2 | CQRS: Commands / Queries / Events | 4.1 |
| A2 | Zod en runtime | 1.3 |
| A2 | Vitest unit + integración + regresión | 2.1 |
| A2 | Bundler único (tsup/esbuild) | 3.2 |
| A2 | ESLint + Prettier + strict | 4.3 |
| A2 | Logger centralizado | 4.2 |
| REV | A2 presentado como "completado" pero no existe | §0 |
| REV | Hub sin auth/origen | 1.1 |
| REV | Payload de diagnóstico con datos privados | 1.2 |
| REV | Fetch con credenciales | 1.4 |
| REV | Sin pruebas en el repo | 2.1 |
| REV | Requisitos de publicación (permisos, dominios, dynamic-page) | 7.2 |
| REV | Umbral por nodos insuficiente → medir MB | 5.1 |
| REV | Trabajo sin commit / extensión sin versionar | 0.1 |
| CONV | Validar tablero en Figma real | 0.2 |
| CONV | Normalizador de imágenes perdido al reescribir ui.html | 2.1 (prueba que lo detecte) |
| CONV | Límite de 40 pasos de scroll / corte de 12.000 px | 5.2 |
| CONV | Capturas solo de lo visible | 5.2 |
| CONV | Efectos CSS sin equivalente | 5.4 |
| CONV | Floats, table-cell, rotaciones (swarm) | 5.5 |
| CONV | Variantes de tamaño (Tile Ctas 1/2/3) | 6.1 |
| CONV | Sub-vistas como copias | 6.3 |
| CONV | Paleta limitada a 32 | 6.3 |
| CONV | Inspector ya muta el DOM (lift) | 5.7 |
| CONV | Sticky dentro de contenedores | 5.7 |
| CONV | Código muerto (`clearPage`, fallback WS directo) | 4.3 |
