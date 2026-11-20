# Pruebas

```bash
npm run build        # las pruebas usan el plugin compilado y los contratos
npm test             # unitarias + integración (lo mismo que corre el CI en cada push)
npm run test:unit    # solo lógica pura (~1 s)
npm run test:live    # contra sitios reales (Apple, GitHub, Stripe…): manual, requiere red
npm run test:watch   # unitarias en modo observador
```

La primera vez: `npx playwright install chromium`.

## Proyectos

| Proyecto | Qué prueba | Sin red | CI |
|---|---|---|---|
| `unit` | Lógica pura: esquemas Zod, seguridad del hub, política de descarga de imágenes, geometría del extractor (Auto Layout por posiciones medidas, wrap, imágenes de fondo), detección de componentes del tablero | ✓ | ✓ |
| `integration` | Navegador real (Playwright) contra `fixtures/synthetic`, hub real aislado, plugin en el simulador de Figma, inspector de la extensión | ✓ | ✓ |
| `live` | Los mismos chequeos sobre sitios reales | ✗ | ✗ |

## Qué cubre la integración

| Archivo | Cubre |
|---|---|
| `extractor-images.test.ts` | Todas las imágenes (WebP/SVG convertidas, ≤ 4096 px), carruseles Swiper / scroll-snap / fade, lazy `data-src`, degradado sobre imagen, `::before` con imagen, video, iframe y WebGL por captura |
| `extractor-text.test.ts` | Texto inline en un solo nodo, mismos saltos de línea que el navegador, superíndices (`<sup>` y OpenType `numr`), tramos de estilo, line-clamp, sr-only, text-transform, `<br>` |
| `extractor-layout.test.ts` | 0 hijos mal ubicados (auditoría Figma vs navegador) + casos: margen, icono centrado por grid, gap, espaciado irregular, `column-reverse`, wrap, space-between, max-width, `::before` con `inset` |
| `plugin-render.test.ts` | Render normal, guardián de payloads, tablero (4 Sections en orden, a la derecha de lo existente), multi-selección, componentes + instancias con su texto, caída a modo normal si el tablero falla |
| `hub-security.test.ts` | Origen, vinculación, render solo al plugin vinculado, payload malicioso, inyección de comandos, path traversal, fuerza bruta, red local |
| `plugin-pairing.test.ts` | Vinculación desde `ui.html` real: primera vez, código incorrecto, reapertura, hub antiguo |
| `inspector.test.ts` | Ctrl/⌘ + clic, sin selección de texto, elevación sin alterar medidas, tablero para multi-selección/body, arrastre de la barra |

## Estructura

```
tests/
  fixtures/synthetic/   páginas con los casos difíciles (index, text, layout, hero, shot)
  helpers/              compartidos con las herramientas de scratch/
    extension-sim.cjs   extracción con el código real de la extensión (+ service worker y normalizador simulados)
    layout-audit.cjs    simula el Auto Layout de Figma y compara con el navegador
    figma-mock.cjs      simulador de la API de Figma con sus restricciones reales
    hub.cjs             hub real aislado (puerto libre, HOME temporal)
    code-loaders.cjs    carga lógica pura del extractor, del tablero y del service worker
  unit/ integration/ live/
```

## Herramientas manuales (`scratch/`)

Usan los mismos helpers, para inspeccionar cualquier sitio:

```bash
node scratch/_layout_audit.cjs '[["https://sitio.com/","document.querySelector(\"main\")"]]'
node scratch/_harness.cjs https://sitio.com/ "document.querySelector('main')"
node scratch/_board_sim.cjs https://sitio.com/ "document.body"
```

## Notas

- Las pruebas unitarias importan los módulos fuente (extractor de navegador y tablero); las de integración prueban los archivos generados (`extractor.js`, `dist/code.js`).
- Las pruebas de integración corren en serie (`fileParallelism: false`): navegador + hubs a la vez saturan equipos modestos.
