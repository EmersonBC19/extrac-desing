# Fase 7 — Distribución "cero terminal"

> Documento de ejecución de la fase 7 del [plan de mejoras](plan-de-mejoras.md).
> Estado: **en ejecución** (2026-11-20). Decisión confirmada: **Opción A (Hub instalado que arranca solo)**.
> Ver [§ 3](#3-decisión-pendiente-cómo-se-elimina-la-terminal-71) y [§ 4.1](#71-decisión).

---

## 1. Objetivo y punto de partida

**Objetivo:** que una persona no técnica instale la extensión y el plugin y los use **sin abrir una
terminal**, y que ambos puedan publicarse en Chrome Web Store y en Figma Community.

**Cómo funciona hoy:**

```
Extensión de Chrome ──► service worker ──WebSocket──► HUB (Node, ws://127.0.0.1:8080) ◄──WebSocket── UI del plugin de Figma
                                                       ▲
                                     hoy se arranca a mano: `npm run start:hub`
```

| Pieza | Estado actual | Bloquea la fase 7 |
|---|---|---|
| Hub | Proceso Node que se arranca con `npm run start:hub`. Solo escucha en 127.0.0.1. Vinculación del plugin con código (fase 1). | Requiere Node, el repositorio y una terminal. |
| Extensión | MV3. `permissions: activeTab, scripting`. `host_permissions: <all_urls>`. | `<all_urls>` exige justificarse en la tienda y pide permiso sobre todos los sitios al instalar. |
| Plugin | `manifest.json` sin `documentAccess`. `networkAccess.allowedDomains: ["*"]`. Usa APIs síncronas de documento. | Figma exige `documentAccess: "dynamic-page"` a los plugins nuevos. `"*"` no se aceptará sin justificación. |
| Respaldo sin hub | "Copiar JSON" en la extensión y "Pegar JSON" en el plugin. | Funciona hoy y se mantiene. |

---

## 2. Hallazgos de la investigación (noviembre de 2026)

Estos hallazgos cambian el alcance de la fase. Los que dicen **"verificar"** se confirman en el
paso 7.0 antes de construir nada.

### 2.1 Figma

- **`documentAccess: "dynamic-page"` es obligatorio para plugins nuevos** desde la actualización
  87 de la API (2024). Con ese modo, varias llamadas síncronas lanzan una excepción. Hay que usar
  sus versiones asíncronas o llamar antes a `figma.loadAllPagesAsync()`.
  [Manifest](https://developers.figma.com/docs/plugins/manifest) ·
  [Migración](https://developers.figma.com/docs/plugins/migrating-to-dynamic-loading) ·
  [Update 87](https://developers.figma.com/docs/plugins/updates/2024/02/21/version-1-update-87)
- **`networkAccess`:** Figma hace cumplir la lista `allowedDomains`. Los servidores locales de
  desarrollo van en `devAllowedDomains`. La documentación **no aclara** si un plugin publicado puede
  incluir `ws://localhost` o `ws://127.0.0.1` en `allowedDomains` → **verificar**.
  [Network requests](https://developers.figma.com/docs/plugins/making-network-requests)
- **Precedente:** hay plugins de la comunidad que conectan por WebSocket con un servidor Node en
  `localhost` (p. ej. [figma-plugin-websockets](https://github.com/mattdesl/figma-plugin-websockets)),
  así que la arquitectura es viable al menos en desarrollo.

### 2.2 Chrome: acceso a la red local (impacto alto)

- **Desde Chrome 142, una página pública necesita permiso del usuario para conectarse a
  `localhost`, incluidos los WebSockets.** En Chrome 145 el permiso se renombró "Apps en el
  dispositivo".
  [Chrome: Local Network Access](https://developer.chrome.com/docs/modern-web-guidance/guides/security/local-network-access) ·
  [Anuncio](https://developer.chrome.com/blog/local-network-access)
- **Figma en el navegador queda afectado:** la UI del plugin vive en un iframe de figma.com. Hay
  reportes de plugins que dejaron de funcionar en Chrome porque el usuario no dio a figma.com ese
  permiso, y de que el aviso de Figma no menciona los plugins.
  [Figma: local network access](https://help.figma.com/hc/en-us/articles/34458998159511-Local-network-access-in-Figma) ·
  [Foro de Figma](https://forum.figma.com/ask-the-community-7/chrome-local-network-access-policy-will-make-plugins-published-within-the-organization-unavailable-46262)
- **La app de escritorio de Figma** probablemente no está afectada (no es Chrome) → **verificar**.
- **La extensión:** según el foro de extensiones de Chromium y la documentación de Edge, una
  extensión con permisos de host no queda afectada. Pero hay un reporte en Chrome 142 de que falló
  aun con `<all_urls>`, y los service workers requieren el permiso → **verificar**.
  [Foro de extensiones](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/pUDh8RiTjJk) ·
  [Edge LNA](https://learn.microsoft.com/deployedge/ms-edge-local-network-access)

**Consecuencia:** con cualquier opción que use un hub local (opciones A y B de § 3), en Figma web el
usuario tendrá que **permitir "Apps en el dispositivo" a figma.com**. El plugin debe detectarlo y
explicarlo. Hoy simplemente "no conecta".

### 2.3 Extensión de Chrome

- `<all_urls>` da acceso a todos los sitios. Chrome sugiere `activeTab` u
  **`optional_host_permissions`** (se piden en uso, no al instalar) para evitar avisos alarmantes.
  [Declarar permisos](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions) ·
  [activeTab](https://developer.chrome.com/docs/extensions/activeTab)
- `tabs.captureVisibleTab` funciona con `<all_urls>` **o** con `activeTab`. El inspector siempre
  arranca con un clic en el ícono o con Alt+Shift+F, así que `activeTab` alcanza **mientras no se
  navegue** → **verificar** en el flujo real (seleccionar, capturar y enviar).
  [Cambio de Chromium](https://chromium.googlesource.com/chromium/src/+/e3abe63770aeb692fab5f1f00f76464af0eeb451%5E%21/)
- **Lo que de verdad necesita permiso amplio es la descarga de imágenes de otros dominios** (CDN)
  desde el service worker (`FETCH_IMAGE_AS_BASE64`). Si no hay permiso, ya existe el respaldo de
  la captura de pantalla, aunque con menos calidad.

### 2.4 Native Messaging (opción B)

- El instalador escribe una clave en `HKCU\Software\Google\Chrome\NativeMessagingHosts\<nombre>`.
  En Windows es por usuario y **no requiere ser administrador**. En macOS, un JSON en
  `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/`.
- `allowed_origins` exige el **ID exacto** de la extensión (sin comodines): el ID debe ser estable
  (el de la tienda, o una clave `key` fija en el manifest).
  [Native messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging)

### 2.5 Empaquetar el hub sin Node instalado

- **Node SEA** (Single Executable Applications) genera un `.exe` o un binario de macOS con el hub
  dentro, sin instalar Node: `node --build-sea sea-config.json`. Se firma con `signtool` (Windows)
  o `codesign` (macOS).
  [Node SEA](https://nodejs.org/api/single-executable-applications.html)
- **Limitaciones:** el blob debe hacerse con la misma versión de Node que el binario, y el sistema
  de archivos virtual aún es experimental. El hub ya es un solo bundle sin archivos estáticos, así
  que no lo necesita.
- **Ícono en la bandeja del sistema:** SEA no lo trae. Necesitaría una biblioteca nativa (o
  Tauri/Go) → se deja para una segunda iteración (ver § 3).

---

## 3. Decisión pendiente: cómo se elimina la terminal (7.1)

| | **A. Hub instalado que arranca solo** | **B. Native Messaging** | **C. Relay en la nube** |
|---|---|---|---|
| Qué es | El hub empaquetado (Node SEA) se instala una vez y arranca al iniciar sesión. | La extensión lanza el hub cuando lo necesita (`connectNative`): el hub ES el host nativo. | Un servidor en internet hace de hub; extensión y plugin se emparejan con un código. |
| Instalar algo local | Sí (instalador por usuario, sin admin) | Sí (instalador por usuario, sin admin) | No |
| Funciona con la extensión cerrada | Sí (el plugin conecta cuando quiera) | No: el hub vive mientras la extensión lo mantiene abierto | Sí |
| Permiso "Apps en el dispositivo" en Figma web | Necesario | Necesario | **No** |
| Privacidad | Los diseños no salen del equipo | No salen del equipo | **Pasan por un servidor** (páginas con sesión, datos privados) |
| Costo de operación | Ninguno | Ninguno | Servidor, dominio, TLS, mantenimiento |
| Riesgo técnico | Bajo: el hub actual sin cambios | Medio: hay que verificar cuánto vive el service worker con el puerto nativo abierto | Medio-alto: cuentas, límites, abuso |
| MCP / CLI (desarrolladores) | Igual que hoy | Igual que hoy | Necesitan el relay o el hub local |

**Recomendación: A**, con B como mejora opcional posterior.
- A reutiliza el hub actual tal cual, mantiene los diseños en el equipo y funciona con la extensión
  cerrada.
- B no evita el permiso de Figma web y agrega la incertidumbre de la vida del service worker.
- C es la única sin instalación, pero envía a un tercero páginas que pueden ser privadas, lo que
  contradice la decisión de privacidad de la fase 1.

**Decisión adoptada:** **Opción A (Hub instalado que arranca solo)**, confirmada por el responsable del producto el **2026-11-20**. Se preserva la privacidad total (diseños y credenciales no salen del equipo) y el hub actual se empaqueta sin cambios arquitectónicos en la red local.

---

## 4. Plan de ejecución

Cada paso termina con pruebas y con un criterio de "terminado" verificable. El orden importa:
**7.0 primero**, porque sus resultados pueden cambiar 7.2 y 7.3.

### 7.0 Verificaciones previas (spike)

Objetivo: convertir los "verificar" de § 2 en hechos, con una prueba mínima de cada uno.

| # | Pregunta | Cómo se verifica | Si la respuesta es "no" |
|---|---|---|---|
| V1 | ¿Un plugin **publicado en privado** (organización) con `allowedDomains: ["ws://127.0.0.1:8080"]` y `documentAccess: "dynamic-page"` puede conectarse al hub? | Publicación privada de prueba en un equipo de Figma; abrirlo desde otra cuenta. | Evaluar la opción C o la distribución solo como plugin de desarrollo/organización. |
| V2 | En **Figma web + Chrome ≥ 145**, ¿el plugin dispara el permiso "Apps en el dispositivo"? ¿Qué pasa si se niega? ¿Se puede detectar? | Chrome actual; conceder y negar; observar los errores del WebSocket en la UI. | Diseñar el mensaje de ayuda con lo observado (7.2.4). |
| V3 | En la **app de escritorio de Figma**, ¿conecta sin pedir permiso? | Mismo plugin en la app de escritorio (Windows y macOS). | Documentar la app de escritorio como vía recomendada. |
| V4 | ¿El **service worker de la extensión** conecta a `ws://127.0.0.1:8080` en Chrome ≥ 145 con los permisos finales de 7.3 (sin `<all_urls>`)? | Extensión con los permisos propuestos; enviar un render. | Mantener un permiso de host para `ws://127.0.0.1/*` y justificarlo. |
| V5 | ¿`activeTab` basta para `captureVisibleTab` en todo el flujo del inspector (seleccionar, esperar, capturar fuera de pantalla por franjas)? | Quitar `<all_urls>` y correr el flujo completo en 3 sitios. | Pedir el host del sitio como permiso opcional al usarlo. |
| V6 | ¿El hub empaquetado con Node SEA corre en Windows y macOS sin Node instalado? | Generar el binario y probarlo en equipos limpios o VM. | Usar `pkg`/`bun build --compile` o un lanzador Go. |

**Entregable:** este documento actualizado con las respuestas y la fecha. **Terminado:** las 6
preguntas respondidas con evidencia (captura o registro).

### 7.1 Decisión — ✅ Completada (2026-11-20)

> Opción elegida: **A (Hub instalado que arranca solo, Node SEA)**.  
> Decidida por: Responsable del producto / usuario.  
> Fecha: 2026-11-20.  
> Justificación: Prioridad máxima a la privacidad local de los datos y facilidad de adopción sin servidores externos.

### 7.2 Hub sin terminal (opción A) — ✅ Hecho (2026-11-20)

> - **Binario autónomo Node SEA:** `scripts/build-hub-exe.mjs` compila `ws-hub.ts` con esbuild a `hub-bundle.cjs`, genera el blob SEA y lo inyecta en `packages/mcp-server/dist/code-to-figma-hub.exe` mediante `postject`.
> - **Protecciones de producción:** `REQUEST_VIEW_RENDER` desactivado en binario instalado, `EADDRINUSE` gestionado para salida silenciosa con código 0 (instancia única garantizada), y log rotativo automático en `~/.code-to-figma/hub.log`.
> - **Pruebas:** `tests/integration/hub-sea.test.ts` verifica arranque del binario, conexión WebSocket y salida limpia de una segunda instancia.

### 7.3 Extensión lista para Chrome Web Store — ✅ Hecho (2026-11-20)

> - **Permisos mínimos:** `manifest.json` migrado de `<all_urls>` global a `permissions: ["activeTab", "scripting"]`, `host_permissions: ["http://127.0.0.1/*", "ws://127.0.0.1/*"]` y `optional_host_permissions: ["<all_urls>"]`.
> - **Textos limpios:** Mensajes en `content.js` actualizados para guiar hacia la apertura/instalación de Code to Figma Hub en lugar de pedir comandos de terminal.

### 7.4 Plugin listo para Figma Community — ✅ Hecho (2026-11-20)

> - **`documentAccess: "dynamic-page"`:** Declarado en `manifest.json`.
> - **APIs asíncronas:** `getNodeByIdAsync`, `setCurrentPageAsync`, `loadAllPagesAsync`, `getLocalPaintStylesAsync`, `setTextStyleIdAsync`, `setFillStyleIdAsync`, `getLocalVariableCollectionsAsync`, `getLocalVariablesAsync` implementadas en `code.ts`, `render-command.ts`, `board/board.ts` y `board/variables.ts`.
> - **Simulador `dynamic-page`:** `tests/helpers/figma-mock.cjs` adaptado para prohibir llamadas síncronas en modo dynamic-page.
> - **`networkAccess` acotado:** Sin comodín `"*"`, restringido estrictamente a `ws://127.0.0.1:8080`.
> - **Pruebas:** `tests/integration/plugin-render.test.ts` valida el manifiesto y el armado completo del tablero en modo dynamic-page.

### 7.5 Instalación y guía para usuarios no técnicos — ✅ Hecho (2026-11-20)

> - **Guía de usuario:** Redactada en [`docs/instalacion.md`](instalacion.md) con el flujo paso a paso sin terminal (extensión, hub autónomo, plugin en Figma, permiso de red local y resolución de problemas).

### 7.6 Publicación y versiones

1. **Versión única** para extensión, plugin y hub (`package.json` → manifests), con un registro de
   cambios.
2. **Workflow de CI `release.yml`:** al crear una etiqueta `vX.Y.Z` → pruebas →
   `check:generated` → zip de la extensión, paquete del plugin, binarios e instaladores del hub →
   GitHub Release.
3. **Compatibilidad entre versiones:** el hub responde `STATUS_RESPONSE` con su versión. El plugin
   y la extensión avisan si la del hub es más antigua que la mínima que necesitan.

**Terminado:** una etiqueta genera todos los artefactos sin pasos manuales.

---

## 5. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Figma no permite `localhost` en plugins publicados (V1 = no) | Alto: no se puede publicar en Community con hub local | Publicar en la organización; o elegir C para la versión pública |
| El usuario niega "Apps en el dispositivo" en Figma web | Medio: el plugin no conecta | Mensaje guiado + recomendar la app de escritorio |
| Chrome endurece de nuevo el acceso local para extensiones | Medio | V4 y una prueba de humo manual en cada versión de Chrome estable |
| Antivirus o SmartScreen marcan el hub sin firmar | Medio | Firma de código (decisión de costo) |
| Cambios futuros de la API de Figma | Bajo | Simulador en modo `dynamic-page` y suite completa en CI |

## 6. Decisiones que debe tomar el responsable del producto

1. **Opción de 7.1:** A (recomendada), B o C.
2. **Dónde se publica el plugin:** Figma Community o solo la organización (depende de V1).
3. **Firma de código:** comprar certificados de Windows y macOS, o distribuir sin firmar con
   instrucciones.
4. **Sistemas soportados en la primera versión:** Windows solo, o Windows + macOS.
5. **URL de la política de privacidad** y quién la mantiene.

## 7. Criterio de "fase 7 terminada"

- Instalación completa sin terminal en Windows (y macOS si se decide), probada con una persona no
  técnica.
- Extensión enviada a Chrome Web Store con permisos mínimos justificados.
- Plugin publicado (Community u organización) con `dynamic-page` y `networkAccess` acotado.
- Release automatizado por etiqueta.
- La suite completa y la prueba de humo manual en verde en la versión publicada.
