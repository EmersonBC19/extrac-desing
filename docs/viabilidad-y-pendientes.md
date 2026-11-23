# Viabilidad de mejoras futuras y pendientes del sistema

Análisis del 23 de noviembre de 2026. Reúne:

1. La viabilidad de dos funciones nuevas que se están evaluando:
   - editar los diseños con un chat de IA, usando la suscripción del usuario;
   - pasar diseños de Figma a código.
2. Lo que falta en el sistema hoy: archivos demasiado grandes, distribución y producto.

Nada de esto está en ejecución. Sirve para decidir qué hacer y en qué orden.

---

## 1. Chat con IA para modificar los diseños extraídos

**Idea:** conectar la cuenta del usuario a su suscripción de Claude (Anthropic) o de Gemini (Google). Así el plugin tendría un chat para pedir cambios: "cambia el texto de este botón", "pon este color", "ajusta esta sección".

### Lo que no se puede: usar la suscripción directamente

- **Claude.** Anthropic prohíbe que aplicaciones de terceros ofrezcan el inicio de sesión de Claude o usen las credenciales de los planes Free, Pro o Max. Esas credenciales son solo para Claude.ai y Claude Code. Para integrarse, un tercero debe usar una clave de API.
  - [The Register](https://www.theregister.com/software/2026/02/20/anthropic-clarifies-ban-on-third-party-tool-access-to-claude/5014546)
  - [WinBuzzer](https://winbuzzer.com/2026/02/19/anthropic-bans-claude-subscription-oauth-in-third-party-apps-xcxwbn/)
- **Gemini.** Google no ofrece ninguna vía oficial para que otra aplicación use la suscripción Google AI Pro o Ultra. "Iniciar sesión con Google" solo identifica al usuario; no da acceso a su suscripción. Hubo suspensiones de cuentas que usaban el acceso de Gemini CLI desde herramientas de terceros. La vía soportada es una clave de API (Google AI Studio o Vertex AI), y el uso se cobra aparte.
  - [Foro de desarrolladores de Google](https://discuss.ai.google.dev/t/question-official-way-for-a-third-party-desktop-app-to-use-a-users-google-ai-pro-ultra-subscription-with-gemini/199349)
  - [Discusión en el repositorio de Gemini CLI](https://github.com/google-gemini/gemini-cli/discussions/20632)

> Casi todas estas fuentes son prensa, blogs y foros, no las páginas oficiales de términos. Antes de decidir hay que revisar los términos vigentes de Anthropic y de Google: estas reglas cambiaron varias veces durante 2026.

### Lo que sí se puede: dos caminos legítimos

**A. El chat vive en la app de Claude, con nuestro servidor MCP (recomendado)**

El usuario escribe en Claude Desktop o Claude Code, que ya funcionan con su suscripción. Claude llama a herramientas de nuestro servidor MCP. El hub las reenvía al plugin, y el plugin aplica los cambios en Figma.

- **Base existente:** el servidor MCP de [packages/mcp-server/src/index.ts](../packages/mcp-server/src/index.ts) ya expone `render_html_to_figma`, `render_url_to_figma`, `inspect_ui_node` y `crawl_site_to_figma`, y el hub ya conecta con el plugin.
- **Trabajo por hacer:**
  - herramientas nuevas para leer la selección y el árbol de capas de Figma;
  - herramientas para modificarlas: textos, colores, tamaños, espaciados, reemplazar una sección, aplicar un estilo o una variable;
  - mensajes nuevos en el catálogo ([packages/contracts/src/messages.ts](../packages/contracts/src/messages.ts));
  - sus manejadores en el plugin;
  - pruebas en el simulador de Figma.
- **Ventajas:** no hay costo extra para el usuario y no hay credenciales de IA dentro del plugin. También funciona con otros clientes MCP, como Gemini CLI con su propia autenticación permitida.
- **Contexto:** el servidor MCP oficial de Figma ya permite que Claude edite el lienzo ([documentación de Figma](https://developers.figma.com/docs/figma-mcp-server/)). Nuestro valor diferencial es que conocemos el origen web de cada diseño. El chat puede decir "esta sección viene de tal URL" y volver a extraerla.
- **Estimación:** una a dos semanas.

**B. Chat dentro del plugin con la clave de API del usuario**

El plugin ya pide una clave de Gemini para el optimizador opcional. Se puede ampliar a un chat con Claude o Gemini usando la clave de API del usuario.

- **Ventaja:** todo pasa dentro de Figma.
- **Desventajas:**
  - cada uso se cobra por API, aparte de la suscripción;
  - hay que guardar la clave con cuidado (`figma.clientStorage`, nunca en el repositorio);
  - el plugin necesita permiso de red hacia los dominios de la API (`networkAccess`).

**Recomendación:** empezar por **A** y dejar **B** como opción para quien prefiera no salir de Figma.

---

## 2. De Figma a código: React, Angular, Astro y otras tecnologías

**Idea:** seleccionar un frame, un componente o un prototipo en Figma y obtener su código en la tecnología elegida.

**Es viable.** Ya tenemos las piezas principales:

- El plugin ya lee el árbol completo de Figma: lo hace para el QA de diseño en [packages/figma-plugin/src/qa-run.ts](../packages/figma-plugin/src/qa-run.ts).
- Ya existe un exportador a HTML + CSS + JS que funciona bien ([export-html.ts](../packages/core-extractor/src/browser/export-html.ts)). Copia las reglas reales de la página y verifica que cada elemento quede en su sitio.
- Las Variables de Figma que crea el tablero ya están organizadas como tokens: colores, tipografías y espaciados.

### Plan propuesto

1. **Representación neutra.** Convertir el diseño de Figma a una estructura intermedia:
   - el auto layout pasa a flex o grid;
   - las restricciones de posición pasan a `position`;
   - las variables pasan a tokens;
   - las instancias pasan a componentes reutilizables.
2. **Generadores por plantilla**, uno por tecnología:
   - React (`.tsx`, con CSS Modules o Tailwind);
   - Angular (componente con su `.html` y `.scss`);
   - Astro (`.astro`);
   - Vue (`.vue`);
   - HTML + CSS puro.
3. **IA opcional,** para afinar lo que una plantilla no decide bien: nombres de componentes, separación en partes reutilizables, propiedades (`props`) y textos traducibles.
4. **Prototipos.** Las interacciones de Figma (al hacer clic, al pasar el ratón, navegar a otra pantalla) pasan a eventos y rutas. Los "Smart Animate" con duración y curva pasan a transiciones CSS. El camino inverso, de CSS a Smart Animate, ya existe para el hover.

### Riesgos

- **Código mantenible.** Lo difícil no es generar código que se vea igual, sino que un desarrollador no tenga que reescribirlo. Un convertidor puramente automático produce markup correcto pero poco reutilizable.
- **Diseños hechos a mano en Figma.** Sin auto layout, con capas sueltas y posiciones absolutas, el resultado es más pobre. Los diseños extraídos de una web con esta herramienta sí traen su HTML original: el camino de regreso es mucho más fiel.

**Recomendación:**

1. Empezar con **React + Tailwind** desde un frame seleccionado, con una prueba de "ida y vuelta": extraer una página, generar el código, renderizarlo y comparar con el QA existente.
2. Después, sumar Angular, Astro y Vue reusando la misma representación intermedia.

---

## 3. Pendientes del sistema

### 3.1 Archivos demasiado grandes (mantenimiento)

Conteo de líneas del 23 de noviembre de 2026:

| Archivo | Líneas | Problema |
|---|---:|---|
| [packages/figma-plugin/src/ui.html](../packages/figma-plugin/src/ui.html) | ~2980 | Interfaz y lógica del plugin en un solo HTML con JavaScript en línea: sin tipos ni módulos. |
| [packages/browser-extension/content.js](../packages/browser-extension/content.js) | ~2970 | Todo el inspector en una clase de JavaScript plano. No pasa por TypeScript ni por el empaquetado. Es la parte más frágil. |
| [packages/core-extractor/src/browser/extract-node.ts](../packages/core-extractor/src/browser/extract-node.ts) | ~2890 | Casi todo es una sola función (`extractNodeTree`) con decenas de funciones internas. Difícil de probar por partes. |
| [packages/core-extractor/src/browser/export-html.ts](../packages/core-extractor/src/browser/export-html.ts) | ~1560 | Grande pero cohesionado. Puede esperar. |
| [packages/browser-extension/background.js](../packages/browser-extension/background.js) | ~940 | Service worker en JavaScript plano. Las pruebas recortan bloques por marcadores de comentario para cargarlo, lo que es frágil. |

**Propuesta, en este orden:**

1. **content.js → TypeScript con esbuild**, como ya se hizo con el extractor (fase 3). Separarlo en módulos:
   - HUD y barra;
   - selección y elevación;
   - envío a Figma;
   - exportar HTML;
   - escaneo del sitio;
   - diálogos;
   - reveals y preparación de la extracción.

   El `content.js` final sería un archivo generado, verificado por `check:generated`.
2. **background.js → TypeScript.** Los bloques que hoy se recortan por marcadores (envío al hub, escáner del sitio) pasan a módulos que se importan en las pruebas.
3. **ui.html.** Sacar el script a módulos TypeScript empaquetados, como ya se hace con `code.ts` → `dist/code.js`, y dejar el HTML solo con la estructura.
4. **extract-node.ts.** Separar por responsabilidad: textos, fondos y degradados, bordes, pseudo-elementos, imágenes, layout y efectos. Primero hay que convertir las funciones internas en funciones de módulo que reciban el contexto. No cambia el comportamiento, y las 400 pruebas actuales sirven de red de seguridad.

Cada paso se hace sin cambiar el comportamiento y con la suite completa en verde antes de seguir.

### 3.2 Distribución (fase 7: lo que quedó pendiente)

Las partes 7.1 a 7.5 de [fase-7-distribucion.md](fase-7-distribucion.md) están hechas: el hub como `.exe`, los permisos mínimos de la extensión, el plugin en modo `dynamic-page` y la guía de instalación. Falta:

- **Publicación automática (7.6):** no existe `release.yml` ni un `CHANGELOG`.
- **Versiones desalineadas:** la extensión dice `1.1.0` en su `manifest.json` y todos los paquetes dicen `1.0.0`. Hace falta una sola versión para todo.
- **Política de privacidad:** no existe, y Chrome Web Store la exige a una extensión que lee el contenido de las páginas.
- **Arranque automático del hub:** hoy la guía pide crear a mano un acceso directo en `shell:startup`. Falta un instalador que lo registre.
- **Firma de código:** el `.exe` no está firmado, así que Windows SmartScreen y los antivirus lo van a marcar. Requiere decidir si se compra un certificado.
- **macOS:** solo existe la versión para Windows.
- **Figma Community:** hay que confirmar si acepta un plugin que se conecta a `localhost` (verificación V1 del documento de la fase 7). Si no lo acepta, se publica solo dentro de la organización.

### 3.3 Producto

- **Actualizar en vez de duplicar:** hoy, al reenviar un bloque, se crea un frame nuevo. Debería actualizar el que ya existe en Figma. Es la mejora de mayor valor en el uso diario.
- **Más estados:** solo se captura el hover. Faltan focus, active, disabled y elementos abiertos (menús, acordeones, modales).
- **Exportar tokens:** los colores, tipografías y espaciados se detectan, pero no se pueden sacar como variables CSS, JSON o configuración de Tailwind.
- **Reportar un problema:** un botón que arme un diagnóstico local, sin datos privados. El primer paso ya está: desde el 23 de noviembre de 2026, el hub guarda en `~/.code-to-figma/hub.log` los avisos y errores del plugin y de la extensión.
- **Idiomas:** toda la interfaz está solo en español y no hay soporte de idiomas (`_locales`). Hace falta si se publica para otros países.
- **Prueba manual por versión:** una lista corta de lo que el CI no puede probar: Figma real, el permiso de red local de Chrome y el `.exe` instalado.

### 3.4 Ajustes hechos el 23 de noviembre de 2026 (para referencia)

- **Textos con degradado, neón o colores vivos** (`background-clip: text`): el degradado ahora va en las letras. Antes quedaba como una caja de color detrás del texto. También se copian `-webkit-text-fill-color` y el contorno `-webkit-text-stroke`.
- **Títulos que se montaban sobre el párrafo:** con `line-height: normal`, ahora se envía el interlineado que midió el navegador. Falta confirmarlo en un sitio real.
- **Escaneo del sitio sin el límite de 15 rutas:** se listan todas y el usuario elige, con un filtro, botones "Todas" y "Ninguna" y una estimación del tiempo.
- **Log local del hub:** el plugin y la extensión envían ahí sus avisos y errores.

---

## Orden sugerido

1. Corregir lo que salga de las pruebas en Figma real, revisando `hub.log`.
2. Publicación automática, versión única y política de privacidad (3.2).
3. `content.js` y `background.js` a TypeScript (3.1, pasos 1 y 2).
4. Chat con IA por MCP (sección 1, camino A).
5. Actualizar en vez de duplicar (3.3).
6. De Figma a código, empezando por React + Tailwind (sección 2).
