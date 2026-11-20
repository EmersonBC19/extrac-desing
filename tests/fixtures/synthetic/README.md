# Página sintética de pruebas

Reúne en una sola página los casos difíciles que rompían la extracción:

| Archivo | Casos |
|---|---|
| `index.html` | Hero con degradado sobre imagen de 5000 px · carrusel con `transform` (tipo Swiper) · carrusel con `scroll-snap` · carrusel *fade* · imágenes WebP · `loading="lazy"` y `data-src` · `image-set()` · icono en `::before` · `<img>` SVG · video con póster |
| `hero.html` | `margin-top` fuera del padding · icono centrado con `display:grid; place-items:center` · `::before` absoluto con `inset` |
| `shot.html` | iframe y canvas WebGL (requieren captura de pantalla) |

## Uso
```bash
node tests/fixtures/synthetic/serve.cjs tests/fixtures/synthetic   # sirve en http://localhost:8765
node scratch/_harness.cjs http://localhost:8765/ "document.getElementById('root')"
node scratch/_layout_audit.cjs '[["http://localhost:8765/hero.html","document.getElementById(\"root\")"]]'
```

`gen.cjs` regenera las imágenes de `img/` (necesita Playwright: `NODE_PATH=node_modules node tests/fixtures/synthetic/gen.cjs tests/fixtures/synthetic`).

Resultados esperados: 15/15 imágenes en `index.html`, 0 hijos mal ubicados en `hero.html`, iframe y canvas con imagen en `shot.html`.
