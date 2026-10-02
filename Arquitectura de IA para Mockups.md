# **Arquitectura de IA para Mockups**

[https\://gemini.google.com/app/b72efef693cd9d31](https://gemini.google.com/app/b72efef693cd9d31)

*User prompt: Oye necesito que analicemos algo por favor. Resulta que quiero hacer un sistema, ya sea MCP, librería o cualquier cosa que funcione. Quiero hacer algo que analice la UI del código, y gracias a ese analisis, no importa si es tailwind, si es CSS o si es SCSS, analizar cada parte del código, posición de los inputs, toast, alerts, modales, menus, sub-menus, selects, cada componente de UI con su color y posición y crear su mockup en figma para poder presentarlo y así. Quiero que se cree con componentes en figma que funcione 100% se puede crear algo así? usando la IA claramente, pero usando skills, mcp, y hasa graphos para poder hacer que la info sea más precisa, no?*

Response: Sí, es totalmente viable, pero hay una trampa técnica en la que cae la mayoría: **intentar que un LLM lea código estático (JSX/HTML \+ CSS/Tailwind) y trate de "adivinar" las coordenadas y dimensiones en píxeles.**

El código puro no contiene geometría: no sabe si una fuente mide 14px o 16px por cascada, cómo colapsa un flex-wrap, ni cuánto mide un contenedor en una pantalla de 1440px.

Para que funcione al 100% con componentes nativos de Figma (Auto Layout, variantes, tipografías reales y jerarquía limpia), la arquitectura correcta combina **AST (análisis estático) \+ Render Computado (Playwright/DOM) \+ Grafo de Escena \+ MCP / Figma Plugin API**.

### **La trampa del código estático vs. La solución real**

| Enfoque | Entrada | Problema / Limitación | Precisión |
| :---- | :---- | :---- | :---- |
| **LLM directo sobre código** | Archivos .tsx, .vue, .css | Inventa coordenadas, no resuelve herencia de CSS ni cascading tokens. | 30% \- 40% (Alucinación) |
| **AST Parser puro** | AST de Babel / PostCSS | No calcula anchos reales, paddings dinámicos ni colapsos de layout. | 50% \- 60% (Roto) |
| **Pipeline Híbrido (AST \+ DOM Computado \+ Grafo)** | Preview montado en Headless Browser \+ AST | Extrae getComputedStyle() y getBoundingClientRect() exactos fusionados con la semántica del código. | **95% \- 99% (Pixel-perfect)** |

### **Arquitectura recomendada del sistema**

`[ Código UI (.tsx / .vue / css / tailwind) ]`  
          `│`  
          `├───► 1. Static AST Parser (Babel / TypeScript)`  
          `│        └─ Identifica props, variantes, nombres de componentes`  
          `│`  
          `└───► 2. Runtime Mount (Playwright / Headless Browser)`  
                   `└─ Extrae computedStyles, rects exactos, estados activos`  
                             `│`  
                             `▼`  
               `[ 3. Grafo Unificado de UI (Scene Graph) ]`  
               `- Nodos: Componentes, Contenedores, Textos, Form inputs`  
               `- Relaciones: PARENT_OF, CONSTRAINS, SIBLING_TO, TOKEN_OF`  
               `- Metadata: Display (Flex/Grid -> AutoLayout), Colores, Spacing`  
                             `│`  
                             `▼`  
               `[ 4. Capa MCP & AI Agent (Orquestador) ]`  
               ``- Tool: `graph_optimizer` (unifica nodos duplicados)``  
               ``- Tool: `figma_component_builder` (asigna AutoLayout y variants)``  
                             `│`  
                             `▼`  
               `[ 5. Figma Bridge (Local Plugin WebSocket / API) ]`  
               `- figma.createComponent() / createFrame()`  
               `- Configura AutoLayout (H/V, gap, padding, constraints)`

### **¿Cómo encajan los Grafos, MCP y los Componentes Complejos?**

#### **1\. El Grafo de Escena (Scene Graph)**

Tu intuición de usar **grafos** es la clave técnica para resolver la jerarquía:

> * **Nodos:** Cada elemento detectado tiene atributos canónicos:  
  * Geometría: width, height, x, y, padding, margin, gap.  
  * Visual: fills (colores calculados en Hex/RGBA), strokes, borderRadius, boxShadow.  
  * Semántica: Tipo de componente (Modal, Button, Input, Toast, Dropdown).  
> * **Aristas (Relaciones):**  
  * PARENT\_OF: Define el anidamiento dentro de Frames de Figma.  
  * ALIGNED\_BY: Mapea si los hijos usan flex-direction: row (HORIZONTAL) o column (VERTICAL).  
  * TRIGGERED\_BY: Para componentes flotantes (un Modal o un Submenú depende de un botón disparador).

#### **2\. El problema de Modales, Toasts y Menús (Estados Ocultos)**

En código, un Modal suele ser isOpen && \<Modal/\>. Si solo renderizas la página cargada, el modal **no existe en el DOM**:

> * **Solución del Agente:** El agente analiza el AST para detectar variables booleanas de visibilidad (isOpen, showToast, activeMenu).  
> * **Inyección de Estado:** A través del MCP / script de Playwright, el agente fuerza esas condiciones a true o dispara los clicks sintéticos en los botones correspondientes para forzar el montaje de cada estado antes de extraer el grafo.

#### **3\. El rol del servidor MCP (Model Context Protocol)**

El MCP actúa como el bus de comunicación entre tu IDE/Agente y Figma:

> * **Tool extract\_ui\_graph(entryFile, options):** Levanta el componente en un entorno Vite/Storybook aislado, corre Playwright y devuelve el JSON del grafo de escena procesado.  
> * **Tool map\_to\_figma\_schema(sceneGraph):** Transforma las propiedades CSS computadas en tipos primitivos de Figma:  
  * display: flex \+ flex-direction: column → layoutMode \= "VERTICAL".  
  * gap: 16px → itemSpacing \= 16\.  
  * justify-content: space-between → primaryAxisAlignItems \= "SPACE\_BETWEEN".  
> * **Tool send\_to\_figma(figmaPayload):** Envía la carga útil a un plugin local de Figma abierto vía WebSocket (la API REST de Figma es limitada para crear geometrías complejas desde cero directamente sin pasar por su motor de plugin interno).

### **Mapeo técnico: Del código a Figma**

Para que un componente quede "100% usable" en Figma, no puedes tirar divs absolutos; necesitas **Auto Layout nativo**:

| Propiedad en CSS / Tailwind | Propiedad Figma Plugin API | Notas de conversión |
| :---- | :---- | :---- |
| display: flex | frame.layoutMode | "HORIZONTAL" o "VERTICAL" |
| gap: 1rem / gap-4 | frame.itemSpacing | 16 (número en px) |
| padding: 12px 24px | frame.paddingTop, frame.paddingLeft | Mapeo 1:1 a los 4 lados |
| border-radius: 0.5rem | frame.cornerRadius | 8 |
| color: \#1e293b | textNode.fills | Convertir a espacio { r, g, b } (0 a 1\) |
| Tipografía (Inter, 14px) | figma.loadFontAsync() | Obligatorio cargar la fuente antes de pintar texto |

### **Hoja de ruta para construirlo sin reinventar la rueda**

> 1. **Fase 1 (El Extractor \- Runtime DOM a Figma JSON):** Usa librerías base probadas como motor de extracción (por ejemplo, el núcleo de código abierto de @builder.io/html-to-figma o Puppeteer scripts). Esto te da el 80% de la conversión geométrica sin tener que escribir un parser de CSS desde cero.  
> 2. **Fase 2 (La Semántica con AST y Grafos):** Crea un script que lea tus componentes de React/Vue/HTML y correlacione las etiquetas DOM con los nombres de componentes (\<Button\>, \<Select\>) para que en Figma no se llamen Frame 142, sino Button / Primary.  
> 3. **Fase 3 (El Servidor MCP):** Envuelve el extractor en un servidor MCP local con Node.js / TypeScript.  
> 4. **Fase 4 (El Figma Plugin Receptor):** Un plugin simple de Figma que corre un WebSocket server local (ws://localhost:8080). Cuando el MCP termina de analizar el código, le envía el payload JSON y el plugin ejecuta las llamadas nativas figma.createComponent(), figma.createAutoLayout() y lo plasma directamente en tu canvas activo.

---

*User prompt: listo y por donde arrancamos, que tecnología usamos y por donde iniciamos y como lo haremos?*

### **Response: Stack tecnológico recomendado**

Para evitar incompatibilidades entre capas, todo el pipeline se construye en **TypeScript de extremo a extremo**:

| Capa | Herramienta | Rol técnico |
| :---- | :---- | :---- |
| **AST & Semántica** | ts-morph o @babel/parser \+ @babel/traverse | Analiza el archivo fuente, extrae nombres reales de componentes (Button, ModalHeader) y detecta estados condicionales (isOpen). |
| **Runtime & Geometría** | Playwright \+ Chromium headless | Monta el componente en un entorno real, resuelve Tailwind/CSS compilado y extrae getComputedStyle() y getBoundingClientRect(). |
| **Modelado de Grafo** | graphology (in-memory graph lib) | Estructura el árbol de dependencias, jerarquía padre-hijo, constraints y tokens de diseño compartidos. |
| **Orquestación & IA** | @modelcontextprotocol/sdk | Expone las herramientas al agente (CLI/IDE) para procesar archivos y ejecutar transformaciones. |
| **Receptor Figma** | **Figma Plugin API** \+ ws (WebSocket) | Plugin local en Figma que escucha eventos en localhost:8080 e invoca figma.createFrame(), figma.createComponent(), etc. |

### **Arquitectura de datos: El Grafo Canónico (JSON)**

Antes de escribir código, definimos el contrato que une el navegador con Figma. Cada nodo del DOM analizado se convierte en este esquema intermedio:

`interface UINode {`  
  `id: string;`  
  `name: string;             // Nombre semántico: "PrimaryButton", "SidebarItem"`  
  `type: 'FRAME' | 'TEXT' | 'COMPONENT' | 'INSTANCE';`  
  `layout: {`  
    `mode: 'NONE' | 'HORIZONTAL' | 'VERTICAL';`  
    `padding: { top: number; right: number; bottom: number; left: number };`  
    `gap: number;`  
    `width: number | 'FILL' | 'HUG';`  
    `height: number | 'FILL' | 'HUG';`  
    `alignment: { primary: string; counter: string };`  
  `};`  
  `styles: {`  
    `fills: Array<{ r: number; g: number; b: number; a: number }>;`  
    `strokes: Array<{ r: number; g: number; b: number; a: number; width: number }>;`  
    `borderRadius: number | [number, number, number, number];`  
    `opacity: number;`  
  `};`  
  `textData?: {`  
    `characters: string;`  
    `fontSize: number;`  
    `fontWeight: number;`  
    `fontFamily: string;`  
    `lineHeight: number;`  
  `};`  
  `children: UINode[];`  
`}`

### **Plan de implementación por fases**

#### **Fase 1: El receptor en Figma (Sink First)**

*Regla de oro: No extraigas datos hasta que no puedas pintarlos en Figma.*

> 1. **Crear el Figma Plugin:** Configurar un plugin de Figma en modo desarrollo con TypeScript (manifest.json y code.ts).  
> 2. **WebSocket Client en Figma UI:** El iframe/UI del plugin abre una conexión con ws://localhost:8080.  
> 3. **Pintor nativo:** Escribir la función recursiva buildFigmaNode(node: UINode, parent: BaseNode):  
   * Traduce HORIZONTAL / VERTICAL a frame.layoutMode.  
   * Asigna paddings con frame.paddingLeft, frame.paddingRight, etc.  
   * Carga fuentes tipográficas con figma.loadFontAsync({ family, style }) antes de asignar texto.

#### **Fase 2: El extractor de geometría computada**

> 1. **Harness de render:** Un template mínimo en Vite que levanta los componentes aislados (o aprovecha Storybook si ya existe).  
> 2. **Script de Playwright:**  
   * Abre la URL del componente montado.  
   * Recorre el DOM recursivamente y ejecuta en el contexto del navegador:  
     `const rect = el.getBoundingClientRect();`  
     `const style = window.getComputedStyle(el);`

   * Normaliza valores de CSS a Figma (ej. rgb(59, 130, 246\) → { r: 0.231, g: 0.51, b: 0.965 }).  
   * Detecta si un contenedor flexbox actúa como AutoLayout horizontal o vertical.

#### **Fase 3: Enriquecimiento semántico con AST y Grafos**

> 1. **Cruce AST ↔ DOM:** Playwright inyecta atributos temporales (data-ast-id="Modal\_3") durante el montaje para que cada nodo del DOM sepa qué componente del código fuente lo generó.  
> 2. **Manejo de estados ocultos:** El parser AST detecta props como open={false}, visible, active. El script de Playwright fuerza estas props en true para renderizar y capturar modales, toasts y menús desplegables en su estado activo.  
> 3. **Grafo de componentes:** Agrupar elementos repetidos o variantes (ej. botones primary, secondary, disabled) para emitir figma.combineAsVariants() en lugar de frames sueltos.

#### **Fase 4: Servidor MCP**

> 1. Empaquetar todo el pipeline dentro de @modelcontextprotocol/sdk.  
> 2. Crear dos herramientas principales:  
   * analyze\_component\_ui: Recibe la ruta de un archivo .tsx/.vue, lo compila, corre el extractor y devuelve el Grafo de Escena.  
   * sync\_to\_figma: Envía el JSON serializado por el WebSocket hacia el plugin abierto en Figma para pintar los frames y componentes en tiempo real.

### **Paso 1: Configurar el Plugin Local de Figma**

Crea la estructura del receptor para probar la conexión inmediata:

**manifest.json**

`{`  
  `"name": "UI Code to Figma Bridge",`  
  `"id": "ui-code-to-figma-bridge",`  
  `"api": "1.0.0",`  
  `"main": "code.js",`  
  `"ui": "ui.html",`  
  `"editorType": ["figma"]`  
`}`

**ui.html** (puente WebSocket local)

`<script>`  
  `const ws = new WebSocket("ws://localhost:8080");`  
  `ws.onmessage = (event) => {`  
    `const data = JSON.parse(event.data);`  
    `parent.postMessage({ pluginMessage: { type: "RENDER_NODES", payload: data } }, "*");`  
  `};`  
`</script>`

**code.ts** (lógica de dibujo nativa)

`figma.showUI(__html__, { visible: false });`

`figma.ui.onmessage = async (msg) => {`  
  `if (msg.type === "RENDER_NODES") {`  
    `const root = msg.payload;`  
    `const frame = figma.createFrame();`  
    `frame.name = root.name;`  
    `frame.layoutMode = root.layout.mode;`  
    `frame.itemSpacing = root.layout.gap;`  
    `frame.paddingTop = root.layout.padding.top;`  
    `frame.paddingBottom = root.layout.padding.bottom;`  
    `frame.paddingLeft = root.layout.padding.left;`  
    `frame.paddingRight = root.layout.padding.right;`  
      
    `figma.currentPage.appendChild(frame);`  
    `figma.viewport.scrollAndZoomIntoView([frame]);`  
  `}`  
`};`

¿Prefieres que arranquemos implementando el servidor WebSocket \+ Plugin de Figma para validar el render, o prefieres configurar primero el extractor con Playwright para ver qué JSON extrae de un componente real?

---

*User prompt: pero el plugin api de figma es paga no? y el wevSocket como es?*

Response: **No, la API de plugins de Figma es 100% gratuita.**

Puedes crear, programar y ejecutar tus propios plugins en tu computadora sin pagar un solo centavo y sin importar si estás en el plan gratuito (Starter) de Figma.

La confusión suele venir de dos cosas:

> 1. **Plugins de terceros en la comunidad:** Herramientas comerciales que cobran suscripciones por exportar/importar código.  
> 2. **La REST API corporativa:** Ciertas funciones avanzadas de la API REST en la nube (como escribir variables de diseño vía servidor remoto sin abrir Figma) exigen planes Enterprise.

El entorno de desarrollo local de plugins (Plugins \> Development \> Import plugin from manifest...) corre directo en tu aplicación de escritorio o web sin restricciones de pago.

### **¿Por qué necesitamos un WebSocket y cómo funciona?**

Figma está blindado por seguridad. Un script externo (tu servidor MCP en Node.js o tu terminal) **no puede meterse directamente en la memoria de Figma a dibujar**.

Además, los plugins de Figma funcionan con **dos hilos aislados**:

`[ Tu PC: Node.js / Servidor MCP ] (ws://localhost:8080)`  
                `│`  
                `│  1. Envía el JSON con la UI calculada`  
                `▼`  
  `┌── FIGMA DESKTOP APP ────────────────────────────────────────┐`  
  `│                                                             │`  
  `│  [ Hilo 1: ui.html (Iframe oculto) ]                        │`  
  `│  - Es un navegador web normal.                              │`  
  `│  - Tiene acceso a la red (puede conectarse al WebSocket).   │`  
  `│  - NO puede tocar el lienzo de diseño.                      │`  
  `│                 │                                           │`  
  `│                 │  2. parent.postMessage(datos)             │`  
  `│                 ▼                                           │`  
  `│  [ Hilo 2: code.ts (Motor de Figma) ]                       │`  
  `│  - Corre en el sandbox nativo de Figma.                     │`  
  ``│  - Tiene acceso a `figma.createFrame()`, estilos, capas.    │``  
  `│  - NO tiene acceso a internet directo.                      │`  
  `│                 │                                           │`  
  `│                 │  3. Dibuja los frames y AutoLayouts       │`  
  `│                 ▼                                           │`  
  `│         [ TU LIENZO DE FIGMA ]                              │`  
  `└─────────────────────────────────────────────────────────────┘`

El WebSocket actúa como el **cable de red local**: permite que cada vez que tu IA o tu MCP analice un componente en tu editor de código, este se dibuje instantáneamente en Figma sin que tengas que guardar archivos JSON a mano ni subirlos a ningún servidor en la nube.

### **El flujo en código real (mínimo y directo)**

#### **1\. En tu máquina (El Servidor WebSocket en Node.js)**

Instalas la librería nativa ws (npm i ws):

`// server.ts`  
`import { WebSocketServer } from 'ws';`

`const wss = new WebSocketServer({ port: 8080 });`

`wss.on('connection', (ws) => {`  
  `console.log('Figma Plugin conectado con éxito.');`

  `// Cuando el MCP/Playwright termine de analizar el componente:`  
  `const mockUINode = {`  
    `name: "PrimaryButton",`  
    `layout: { mode: "HORIZONTAL", gap: 8, padding: { top: 12, right: 24, bottom: 12, left: 24 } },`  
    `text: "Iniciar Sesión",`  
    `color: { r: 0.1, g: 0.5, b: 0.9 }`  
  `};`

  `// Se lo enviamos al plugin`  
  `ws.send(JSON.stringify(mockUINode));`  
`});`

#### **2\. En el plugin de Figma: ui.html (El receptor de red)**

No necesita interfaz gráfica visible; solo escucha el socket y le pasa el mensaje al motor de Figma:

`<!-- ui.html -->`  
`<script>`  
  `// Se conecta al servidor local en tu misma PC`  
  `const socket = new WebSocket('ws://localhost:8080');`

  `socket.onopen = () => console.log('Conectado al servidor MCP');`

  `socket.onmessage = (event) => {`  
    `const data = JSON.parse(event.data);`  
    `// Pasa los datos al sandbox de diseño de Figma`  
    `parent.postMessage({ pluginMessage: { type: 'DRAW_UI', data } }, '*');`  
  `};`  
`</script>`

#### **3\. En el plugin de Figma: code.ts (El pintor nativo)**

Recibe el mensaje desde ui.html y crea los objetos reales:

`// code.ts`  
`figma.showUI(__html__, { visible: false }); // Corre en segundo plano`

`figma.ui.onmessage = async (msg) => {`  
  `if (msg.type === 'DRAW_UI') {`  
    `const { name, layout, text, color } = msg.data;`

    `// 1. Crear el Frame con Auto Layout`  
    `const buttonFrame = figma.createFrame();`  
    `buttonFrame.name = name;`  
    `buttonFrame.layoutMode = layout.mode; // 'HORIZONTAL'`  
    `buttonFrame.itemSpacing = layout.gap; // 8px`  
    `buttonFrame.paddingTop = layout.padding.top;`  
    `buttonFrame.paddingBottom = layout.padding.bottom;`  
    `buttonFrame.paddingLeft = layout.padding.left;`  
    `buttonFrame.paddingRight = layout.padding.right;`  
    `buttonFrame.cornerRadius = 6;`  
    `buttonFrame.fills = [{ type: 'SOLID', color: { r: color.r, g: color.g, b: color.b } }];`

    `// 2. Crear el texto hijo`  
    `await figma.loadFontAsync({ family: "Inter", style: "Regular" });`  
    `const textNode = figma.createText();`  
    `textNode.characters = text;`  
    `textNode.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }]; // Blanco`

    `// 3. Empaquetar y centrar`  
    `buttonFrame.appendChild(textNode);`  
    `figma.currentPage.appendChild(buttonFrame);`  
    `figma.viewport.scrollAndZoomIntoView([buttonFrame]);`  
  `}`  
`};`

### **Cómo se opera en el día a día**

> 1. Abres Figma y ejecutas tu plugin local una sola vez (se queda escuchando en segundo plano en localhost:8080).  
> 2. En tu terminal o en tu agente de IA pides: *"Analiza src/components/Modal.tsx y mándalo a Figma"*.  
> 3. El script compila el componente, calcula los tamaños reales con Playwright, genera el JSON y lo dispara por el WebSocket.  
> 4. En cuestión de milisegundos, el componente aparece dibujado y estructurado en tu pantalla de Figma.

**Sources**

> 1. [I Tested Every Figma Pricing Plan: Here's What Designers Need to](https://ecomm.design/figma-pricing/)  
> 2. [Best Figma Plugins for Developers (Free \+ AI-Powered) \- Builder.io](https://www.builder.io/blog/best-figma-plugins)  
> 3. [Best (free) Figma Plugins 2021 \- Moonlearning.io](https://www.moonlearning.io/blog/figma-plugins)

---

*User prompt: listo me parece bien, lo voy a llevar a antigravity esta conversación para empezar.*

Response: Para que arranques en Antigravity con el contexto ordenado y el agente no se disperse, conviene plantear la arquitectura como un monorepo ligero con dos paquetes bien desacoplados:

`code-to-figma/`  
`├── packages/`  
`│   ├── figma-plugin/       # Sandbox de Figma (code.ts, ui.html, manifest.json)`  
`│   └── mcp-server/         # Node.js + Playwright + AST parser + Servidor WebSocket (8080)`  
`├── package.json            # Workspaces de npm / pnpm`  
`└── tsconfig.base.json`

### **Prompt de arranque para tu sesión en Antigravity**

Puedes usar esta directiva inicial para que el agente te monte el esqueleto y las dependencias de inmediato:

**Objetivo:** Inicializar un monorepo TypeScript para un sistema que extrae geometría y semántica de componentes UI (React/Tailwind) y los dibuja en Figma con Auto Layout.

**Estructura requerida:**

> 1. packages/figma-plugin:  
   * Configurar TypeScript con @figma/plugin-typings.  
   * manifest.json apuntando a code.js y ui.html.  
   * ui.html con un cliente WebSocket conectado a ws://localhost:8080.  
   * code.ts con listener para crear frames con Auto Layout básico (layoutMode, padding, itemSpacing).  
> 2. packages/mcp-server:  
   * Configurar @modelcontextprotocol/sdk y ws (WebSocket server en puerto 8080).  
   * Configurar playwright (Chromium headless) para renderizar componentes y extraer getComputedStyle() y getBoundingClientRect().  
   * Definir el contrato de datos UINode (esquema canónico intermedio).

**Primer hito:** Levantar el servidor WebSocket en mcp-server, abrir el plugin en Figma y enviar un nodo dummy desde Node.js para confirmar que se dibuja un botón con Auto Layout en el canvas activo.

¿Quieres que te deje listos los archivos base (package.json, manifest.json y los scripts mínimos de conexión) para pegarlos directo en el workspace?

---

