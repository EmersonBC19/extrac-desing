import { WebSocket } from 'ws';
import type { UINode, WSMessage, WSRenderPayload } from '@code-to-figma/contracts';

// Componente dummy moderno de prueba (Dashboard Metric Card con Auto Layout)
const dummyComponent: UINode = {
  id: 'card-root',
  name: 'Component / MetricCard',
  type: 'FRAME',
  layout: {
    mode: 'VERTICAL',
    padding: { top: 24, right: 24, bottom: 24, left: 24 },
    itemSpacing: 16,
    width: 380,
    height: 'HUG',
    primaryAxisAlignItems: 'MIN',
    counterAxisAlignItems: 'MIN'
  },
  styles: {
    fills: [{ r: 0.09, g: 0.11, b: 0.16, a: 1 }], // #171c28 dark card
    strokes: [{ r: 0.2, g: 0.25, b: 0.35, a: 1, width: 1, align: 'INSIDE' }],
    cornerRadius: 16,
    boxShadow: [
      {
        color: { r: 0, g: 0, b: 0, a: 0.25 },
        offset: { x: 0, y: 10 },
        radius: 20,
        spread: 0
      }
    ]
  },
  children: [
    // Header Row (Título + Badge)
    {
      id: 'header-row',
      name: 'Header Row',
      type: 'FRAME',
      layout: {
        mode: 'HORIZONTAL',
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        itemSpacing: 12,
        width: 'FILL',
        height: 'HUG',
        primaryAxisAlignItems: 'SPACE_BETWEEN',
        counterAxisAlignItems: 'CENTER'
      },
      styles: { fills: [] },
      children: [
        {
          id: 'card-title',
          name: 'Title Text',
          type: 'TEXT',
          layout: {
            mode: 'NONE',
            padding: { top: 0, right: 0, bottom: 0, left: 0 },
            itemSpacing: 0,
            width: 'HUG',
            height: 'HUG'
          },
          styles: {
            fills: [{ r: 0.97, g: 0.98, b: 0.99, a: 1 }] // blanco
          },
          textData: {
            characters: 'Analytics Cloud Monitor',
            fontSize: 16,
            fontWeight: 700,
            fontFamily: 'Inter'
          }
        },
        // Badge "En línea"
        {
          id: 'status-badge',
          name: 'Badge / Status',
          type: 'FRAME',
          layout: {
            mode: 'HORIZONTAL',
            padding: { top: 4, right: 10, bottom: 4, left: 10 },
            itemSpacing: 6,
            width: 'HUG',
            height: 'HUG',
            counterAxisAlignItems: 'CENTER'
          },
          styles: {
            fills: [{ r: 0.13, g: 0.77, b: 0.36, a: 0.15 }],
            strokes: [{ r: 0.13, g: 0.77, b: 0.36, a: 0.35, width: 1 }],
            cornerRadius: 9999
          },
          children: [
            {
              id: 'badge-text',
              name: 'Badge Label',
              type: 'TEXT',
              layout: {
                mode: 'NONE',
                padding: { top: 0, right: 0, bottom: 0, left: 0 },
                itemSpacing: 0,
                width: 'HUG',
                height: 'HUG'
              },
              styles: {
                fills: [{ r: 0.29, g: 0.87, b: 0.5, a: 1 }]
              },
              textData: {
                characters: '● Activo',
                fontSize: 11,
                fontWeight: 600,
                fontFamily: 'Inter'
              }
            }
          ]
        }
      ]
    },

    // Descripción
    {
      id: 'desc-text',
      name: 'Description Text',
      type: 'TEXT',
      layout: {
        mode: 'NONE',
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        itemSpacing: 0,
        width: 'FILL',
        height: 'HUG'
      },
      styles: {
        fills: [{ r: 0.58, g: 0.64, b: 0.72, a: 1 }]
      },
      textData: {
        characters: 'Métricas de infraestructura procesadas en tiempo real con Auto Layout nativo importado desde código.',
        fontSize: 12,
        fontWeight: 400,
        fontFamily: 'Inter',
        lineHeight: 18
      }
    },

    // Métricas en fila horizontal (Grid 2 columnas)
    {
      id: 'metrics-row',
      name: 'Metrics Grid',
      type: 'FRAME',
      layout: {
        mode: 'HORIZONTAL',
        padding: { top: 12, right: 12, bottom: 12, left: 12 },
        itemSpacing: 16,
        width: 'FILL',
        height: 'HUG'
      },
      styles: {
        fills: [{ r: 0.05, g: 0.07, b: 0.1, a: 0.6 }],
        strokes: [{ r: 0.15, g: 0.2, b: 0.28, a: 1, width: 1 }],
        cornerRadius: 10
      },
      children: [
        // Columna 1
        {
          id: 'stat-1',
          name: 'Stat / Uptime',
          type: 'FRAME',
          layout: {
            mode: 'VERTICAL',
            padding: { top: 0, right: 0, bottom: 0, left: 0 },
            itemSpacing: 4,
            width: 'FILL',
            height: 'HUG'
          },
          styles: { fills: [] },
          children: [
            {
              id: 'stat-1-val',
              name: 'Value',
              type: 'TEXT',
              layout: { mode: 'NONE', padding: { top:0,right:0,bottom:0,left:0 }, itemSpacing: 0, width: 'HUG', height: 'HUG' },
              styles: { fills: [{ r: 0.97, g: 0.98, b: 0.99, a: 1 }] },
              textData: { characters: '99.98%', fontSize: 18, fontWeight: 700, fontFamily: 'Inter' }
            },
            {
              id: 'stat-1-lbl',
              name: 'Label',
              type: 'TEXT',
              layout: { mode: 'NONE', padding: { top:0,right:0,bottom:0,left:0 }, itemSpacing: 0, width: 'HUG', height: 'HUG' },
              styles: { fills: [{ r: 0.45, g: 0.52, b: 0.62, a: 1 }] },
              textData: { characters: 'Uptime Global', fontSize: 11, fontWeight: 400, fontFamily: 'Inter' }
            }
          ]
        },
        // Columna 2
        {
          id: 'stat-2',
          name: 'Stat / Latency',
          type: 'FRAME',
          layout: {
            mode: 'VERTICAL',
            padding: { top: 0, right: 0, bottom: 0, left: 0 },
            itemSpacing: 4,
            width: 'FILL',
            height: 'HUG'
          },
          styles: { fills: [] },
          children: [
            {
              id: 'stat-2-val',
              name: 'Value',
              type: 'TEXT',
              layout: { mode: 'NONE', padding: { top:0,right:0,bottom:0,left:0 }, itemSpacing: 0, width: 'HUG', height: 'HUG' },
              styles: { fills: [{ r: 0.23, g: 0.51, b: 0.96, a: 1 }] }, // azul
              textData: { characters: '28 ms', fontSize: 18, fontWeight: 700, fontFamily: 'Inter' }
            },
            {
              id: 'stat-2-lbl',
              name: 'Label',
              type: 'TEXT',
              layout: { mode: 'NONE', padding: { top:0,right:0,bottom:0,left:0 }, itemSpacing: 0, width: 'HUG', height: 'HUG' },
              styles: { fills: [{ r: 0.45, g: 0.52, b: 0.62, a: 1 }] },
              textData: { characters: 'Latencia p99', fontSize: 11, fontWeight: 400, fontFamily: 'Inter' }
            }
          ]
        }
      ]
    },

    // Botones de acción (Row)
    {
      id: 'actions-row',
      name: 'Actions Row',
      type: 'FRAME',
      layout: {
        mode: 'HORIZONTAL',
        padding: { top: 4, right: 0, bottom: 0, left: 0 },
        itemSpacing: 10,
        width: 'FILL',
        height: 'HUG',
        primaryAxisAlignItems: 'MAX',
        counterAxisAlignItems: 'CENTER'
      },
      styles: { fills: [] },
      children: [
        // Botón Secundario
        {
          id: 'btn-secondary',
          name: 'Button / Secondary',
          type: 'FRAME',
          layout: {
            mode: 'HORIZONTAL',
            padding: { top: 8, right: 14, bottom: 8, left: 14 },
            itemSpacing: 6,
            width: 'HUG',
            height: 'HUG',
            counterAxisAlignItems: 'CENTER'
          },
          styles: {
            fills: [{ r: 0.15, g: 0.2, b: 0.28, a: 0.4 }],
            strokes: [{ r: 0.25, g: 0.32, b: 0.42, a: 1, width: 1 }],
            cornerRadius: 8
          },
          children: [
            {
              id: 'btn-sec-text',
              name: 'Label',
              type: 'TEXT',
              layout: { mode: 'NONE', padding: { top:0,right:0,bottom:0,left:0 }, itemSpacing: 0, width: 'HUG', height: 'HUG' },
              styles: { fills: [{ r: 0.8, g: 0.85, b: 0.9, a: 1 }] },
              textData: { characters: 'Detalles', fontSize: 12, fontWeight: 500, fontFamily: 'Inter' }
            }
          ]
        },
        // Botón Primario con Icono SVG
        {
          id: 'btn-primary',
          name: 'Button / Primary',
          type: 'FRAME',
          layout: {
            mode: 'HORIZONTAL',
            padding: { top: 8, right: 16, bottom: 8, left: 14 },
            itemSpacing: 8,
            width: 'HUG',
            height: 'HUG',
            counterAxisAlignItems: 'CENTER'
          },
          styles: {
            fills: [{ r: 0.23, g: 0.51, b: 0.96, a: 1 }], // #3b82f6
            cornerRadius: 8
          },
          children: [
            // Icono SVG (Checkmark)
            {
              id: 'btn-icon',
              name: 'Icon / Check',
              type: 'SVG',
              layout: { mode: 'NONE', padding: { top:0,right:0,bottom:0,left:0 }, itemSpacing: 0, width: 14, height: 14 },
              styles: { fills: [] },
              svgContent: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
            },
            {
              id: 'btn-prim-text',
              name: 'Label',
              type: 'TEXT',
              layout: { mode: 'NONE', padding: { top:0,right:0,bottom:0,left:0 }, itemSpacing: 0, width: 'HUG', height: 'HUG' },
              styles: { fills: [{ r: 1, g: 1, b: 1, a: 1 }] },
              textData: { characters: 'Desplegar', fontSize: 12, fontWeight: 600, fontFamily: 'Inter' }
            }
          ]
        }
      ]
    }
  ]
};

async function main() {
  const ws = new WebSocket('ws://localhost:8080');

  console.log('Conectando a ws://localhost:8080...');

  ws.on('open', () => {
    console.log('Conectado al Hub. Registrando como CLI/Test Sender...');
    ws.send(JSON.stringify({
      type: 'REGISTER_CLIENT',
      clientType: 'CLI_OR_MCP'
    }));

    console.log('Enviando componente dummy a Figma...');
    const message: WSMessage<WSRenderPayload> = {
      type: 'RENDER_NODES',
      payload: {
        rootNode: dummyComponent,
        clearPage: false
      }
    };

    ws.send(JSON.stringify(message));
    console.log('Mensaje RENDER_NODES transmitido!');
  });

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'RENDER_SUCCESS') {
        console.log(`\n🎉 ÉXITO: El plugin de Figma confirmó que dibujó el componente en el lienzo!`);
        console.log(`Detalles: Nodo ID ${msg.nodeId} (${msg.name})\n`);
        ws.close();
        process.exit(0);
      } else if (msg.type === 'RENDER_ERROR') {
        console.error(`\n❌ ERROR: El plugin de Figma reportó un fallo:`, msg.error);
        ws.close();
        process.exit(1);
      }
    } catch (_e) {}
  });

  ws.on('error', (err) => {
    console.error('Error de conexión:', err.message);
    console.error('¿Está corriendo el servidor ws-hub? Inícialo con: npm run start:hub');
    process.exit(1);
  });

  // Timeout de 15 segundos
  setTimeout(() => {
    console.log('Esperando respuesta del plugin de Figma... (Asegúrate de tener Figma abierto con el plugin ejecutándose)');
  }, 3000);
}

main();
