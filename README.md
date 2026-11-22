# ⚡ Code to Figma: AI & UI Architecture

Sistema híbrido que analiza interfaces en código fuente (HTML, Tailwind, CSS, React, Vue), extrae su geometría computada en runtime y su semántica, y las reproduce fielmente en **Figma con Auto Layout nativo, textos reales, variantes y vectores SVG**.

---

## 📁 Estructura del Monorepo

* **[`packages/contracts`](./packages/contracts):** Definición del contrato canónico de datos (`UINode`), eventos y tipos de WebSocket.
* **[`packages/figma-plugin`](./packages/figma-plugin):** Plugin nativo de Figma (100% gratuito) con UI WebSocket y motor recursivo de Auto Layout.
* **[`packages/browser-extension`](./packages/browser-extension):** Extensión de navegador (Manifest V3) con selector estilizado, efecto 3D Pop-out y extracción directa a Figma.
* **[`packages/core-extractor`](./packages/core-extractor):** Fuente única del extractor de navegador (`src/browser`, TypeScript) y crawler en Playwright que lo usa para recorrer sitios completos.
* **[`packages/mcp-server`](./packages/mcp-server):** Servidor MCP estándar (@modelcontextprotocol/sdk) y Hub de WebSocket en puerto 8080.

### 🧑‍💻 Desarrollo: qué se edita y qué se genera

Hay **un solo extractor**, compartido por la extensión y el crawler, y el plugin se empaqueta con esbuild:

| Se edita (fuente) | Se genera | Comando |
|---|---|---|
| `packages/core-extractor/src/browser/*.ts` | `packages/browser-extension/extractor.js` (extensión y crawler) | `npm run build:extractor` |
| `packages/figma-plugin/src/**/*.ts` (+ esquemas de `contracts`) | `packages/figma-plugin/dist/code.js` | `npm run build:plugin` |

- **No edites los archivos generados**: llevan la cabecera "ARCHIVO GENERADO" y se sobrescriben.
- Se versionan para que la extensión y el plugin se carguen sin compilar. El CI falla si no están al día (`npm run check:generated`).
- `npm run build` compila todo en orden. `npm test` ejecuta la suite (ver [`tests/README.md`](./tests/README.md)).
- Para usuarios no técnicos o distribución sin terminal, consulta la [**Guía de Instalación ("Cero Terminal")**](./docs/instalacion.md).

---

## 🚀 Inicio Rápido (Paso a Paso)

### 1. Iniciar el Servidor WebSocket Hub
Abre una terminal en este directorio y ejecuta:
```bash
npm run start:hub
```
Verás el mensaje:
```
⚡ Figma WebSocket Hub en ws://127.0.0.1:8080
🔑 Código de vinculación para el plugin de Figma: ABCD-EFGH
```
Guarda ese **código de vinculación**: el plugin lo pide una sola vez (paso 2). Es siempre el mismo
(queda en `~/.code-to-figma/pairing-code`); para generar uno nuevo, borra ese archivo y reinicia el hub.

---

### 2. Cargar el Plugin en Figma (Solo se hace una vez)
1. Abre tu aplicación de **Figma Desktop** (o Figma en el navegador).
2. Abre cualquier archivo de diseño o crea un lienzo en blanco.
3. Haz clic derecho en el lienzo -> **Plugins** -> **Development** -> **Import plugin from manifest...**
4. Selecciona el archivo:
   `packages/figma-plugin/manifest.json`
5. Ejecuta el plugin recién importado (**Code to Figma AI Bridge**).
6. La primera vez aparece **"Vincular con el Hub"**: pega el código del paso 1 y pulsa *Vincular*.
   Figma lo guarda; las siguientes veces conecta solo.
7. Verás una ventana flotante con el estado `● En línea`.

#### 🔒 Seguridad del hub
Cualquier página web puede intentar conectarse a `ws://localhost:8080`, así que el hub:
- Escucha solo en `127.0.0.1` (no es accesible desde la red).
- Rechaza conexiones de páginas web; acepta la extensión, procesos locales (CLI/MCP) y el plugin de Figma **vinculado con el código**.
- Bloquea 1 minuto tras 5 códigos incorrectos.
- Valida cada render (estructura, tamaños, imágenes, SVG sin scripts) antes de enviarlo a Figma.

Variables opcionales:

| Variable | Efecto |
|---|---|
| `CTF_DEBUG_CAPTURE=1` | Guarda el último render en `scratch/captured-last-payload.json` (puede contener datos de la página; desactivado por defecto) |
| `CTF_EXTENSION_IDS=id1,id2` | Solo acepta esas extensiones (por defecto, cualquier extensión instalada) |
| `WS_PORT` / `WS_HOST` | Puerto (8080) e interfaz (`127.0.0.1`) |

---

### 3. Probar el Primer Render Nativo en Figma
Con el plugin abierto en Figma y el hub corriendo, abre otra terminal y ejecuta:
```bash
npm run test:send
```

**Resultado inmediato en Figma:**
Aparecerá en el centro de tu canvas un componente completo de Dashboard con Auto Layout, Badge, Grid de métricas y botones con SVG.

---

### 4. 🌐 Extraer Múltiples Pestañas / Rutas de Cualquier Proyecto

Puedes ejecutar el crawler sobre cualquier aplicación web o frontend local (React, Angular, Vue, etc.):

#### Opción A: Detección Automática de Pestañas y Enlaces (Zero Config)
El crawler navegará por la aplicación, descubrirá los enlaces y pestañas del menú principal y las colocará una al lado de la otra en Figma:
```bash
npm run crawl -- --url http://localhost:4200
```

#### Opción B: Especificar Rutas de Navegación Concretas
Si deseas extraer vistas específicas de tu app:
```bash
npm run crawl -- --url http://localhost:4200 --routes /dashboard,/clientes,/transferencias,/perfil
```

#### Opción C: Organizar en Páginas Separadas de Figma
Si prefieres que cada pestaña sea una página interna de tu archivo en lugar de un lienzo horizontal:
```bash
npm run crawl -- --url http://localhost:4200 --routes /dashboard,/clientes --pages
```

---

## 🛠️ Herramientas MCP Disponibles

El servidor MCP (`packages/mcp-server/src/index.ts`) expone las siguientes herramientas para el agente:

1. `render_html_to_figma`:
   - Toma código HTML o clases Tailwind (`<div class="p-6 bg-slate-900 rounded-xl ...">`), lo compila en Chromium y lo dibuja en Figma.
2. `render_url_to_figma`:
   - Inspecciona una URL local (ej. `http://localhost:3000` o la app de frontend que tengas corriendo) con un selector CSS y clona el componente exacto en Figma.
3. `inspect_ui_node`:
   - Inspecciona y devuelve el árbol JSON `UINode` para depurar o manipular con IA antes de pintar.

---

## 🤖 Integración del Servidor MCP en tu IDE / Agente

Para registrar el servidor MCP en tus clientes MCP (como Antigravity IDE, Claude Desktop o Cursor), agrega la siguiente configuración:

```json
{
  "mcpServers": {
    "code-to-figma": {
      "command": "node",
      "args": [
        "c:/Users/dakka/Documents/GitHub/extrac-desing/packages/mcp-server/dist/index.js"
      ]
    }
  }
}
```
