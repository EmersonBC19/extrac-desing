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

### 5. 📱 Breakpoints y claro/oscuro

En el HUD de la extensión, **Breakpoints** y **Claro/Oscuro** envían el bloque como un set de variantes
`Breakpoint=Mobile|Tablet|Desktop` (375, 768 y el ancho actual de escritorio) y con sus colores como **Variables
con modos `Light` y `Dark`** (colección "Tema · …"), más una vista en modo Dark al lado.

- Otros anchos sin redimensionar la ventana: el bloque exportado (sus reglas reales, con `@media`) se dibuja en
  `render-frame.html`, una página de la extensión incrustada con ese ancho, y se extrae ahí dentro.
- Tema oscuro: si el CSS usa `prefers-color-scheme` o `light-dark()`, se fuerza el otro tema; si no, se prueba el
  tema por clase del sitio (`html.dark`, `data-theme`, `data-bs-theme`…) y la página queda como estaba.
- Los dos temas salen del mismo DOM, así que los colores se emparejan nodo a nodo; solo los que cambian pasan a
  Variables. Con un plan de Figma de un solo modo por colección, el set llega igual y con aviso.
- Seguridad: `render-frame.html` solo dibuja con un token de un solo uso que el service worker da al content
  script; una web que la incruste no puede usarla para descargar imágenes de otros dominios.
- Límite: lo que cambia por JavaScript al redimensionar (no por CSS) no aparece en los otros anchos.

### 6. 🔍 QA de diseño contra producción

En Figma, selecciona el frame de diseño; en la web, selecciona el mismo componente y pulsa **Comparar con Figma**.
La extensión pregunta al plugin (vía hub) qué frame está seleccionado, captura la web (una pantalla completa, con una
ventana del ancho del frame; un componente, tal como se ve) y el plugin entrega:

- un informe en el lienzo ("QA · …") con cada diferencia medible, de la más grave a la menos: tamaño, padding, gap,
  radio, rellenos, bordes, sombras, opacidad y tipografía (familia, peso, tamaño, interlineado), más lo que está en un
  lado y no en el otro y los colores que no son ninguna Variable del archivo;
- imágenes: la web se envía con ellas (por partes si pesan; sin ellas solo si superan 30 MB o si se desmarcó
  "Imágenes"). Se marca la que falta o sobra, la que es otra imagen (proporción distinta del archivo; con la misma
  proporción y otro archivo, como aviso informativo) y el ajuste distinto (cover/contain);
- anotaciones de Dev Mode sobre las capas del diseño (al volver a comparar se reemplazan);
- el bloque de producción dibujado al lado, y un resumen en la extensión.

Emparejar diseño y web es el núcleo (`packages/figma-plugin/src/qa-compare.ts`): textos iguales como anclas,
contenedores por los textos que contienen y el resto por orden dentro de su padre; los nombres de capa y las clases
CSS no tienen que coincidir. Los textos distintos (contenido real en vez del de ejemplo) se marcan como "contenido
distinto", sin contar como error. Se compara con la fuente declarada en el CSS, no con la sustituta de Figma.

### 7. 🧩 Exportar un bloque como HTML + CSS + JS

En la extensión, con un bloque seleccionado, **Exportar HTML** genera una copia que funciona fuera de la página
(`packages/core-extractor/src/browser/export-html.ts`):

- **CSS real de la página**, no estilos calculados en línea: solo las reglas que tocan al bloque, con sus `@media`
  (sigue siendo responsive), `:hover`, `@keyframes` y `@font-face`. Las hojas de otros dominios se descargan con
  los permisos de la extensión; las variables CSS que el bloque no usa se quitan.
- **Contexto de la página**: los ancestros del bloque viajan como cajas vacías con `display: contents`, así que los
  selectores que dependen de ellos (`.tema-oscuro .card`), la herencia y las variables siguen funcionando.
- **Verificado**: el resultado se dibuja en un iframe oculto y se compara con el original elemento por elemento; lo
  que no coincide se corrige con un ajuste medido, y el diálogo muestra la fidelidad obtenida.
- **JS** para los widgets estándar: pestañas ARIA, botones `aria-expanded`/`aria-controls` y collapse, dropdown y
  tab de Bootstrap. El JavaScript propio del sitio no se copia.
- Formatos: **ZIP** (`index.html`, `styles.css`, `script.js`), **HTML único** o **copiar al portapapeles**.

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
