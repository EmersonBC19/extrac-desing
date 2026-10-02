import type { UINode, RGBAColor } from '@code-to-figma/contracts';

/**
 * Genera un Frame Desktop completo de Figma con el Sistema de Diseño del Proyecto:
 * - Paleta de Colores (Brand, Surfaces, Neutrals, Status)
 * - Escala Tipográfica (Display, H1, H2, Body, Caption)
 * - Botones y Componentes Reutilizables (Primary, Secondary, Danger, Inputs, Badges)
 */
export function createDesignSystemFrame(counter = { id: 10000 }): UINode {
  const nextId = (prefix: string) => `${prefix}_${++counter.id}`;

  // Helper para crear colores RGBA
  const c = (r: number, g: number, b: number, a = 1): RGBAColor => ({ r: r / 255, g: g / 255, b: b / 255, a });

  // 1. Definición de Tokens de Color del Proyecto
  const colors = {
    // Brand
    pichinchaYellow: c(255, 221, 0),
    pichinchaNavy: c(15, 38, 92),
    accentBlue: c(37, 99, 235),
    // Neutrals & Surfaces
    sidebarDark: c(13, 30, 58),
    surfaceLight: c(248, 250, 252),
    surfaceWhite: c(255, 255, 255),
    borderGray: c(226, 232, 240),
    textDark: c(15, 23, 42),
    textMuted: c(100, 116, 139),
    // Status
    successGreen: c(16, 185, 129),
    dangerRed: c(239, 68, 68),
    warningAmber: c(245, 158, 11),
    infoBlue: c(59, 130, 246)
  };

  // Helper para crear texto Auto Layout
  function createTextNode(characters: string, fontSize = 14, fontWeight: string | number = 400, color = colors.textDark, lineHeight?: number): UINode {
    return {
      id: nextId('text'),
      name: `Text / ${characters.slice(0, 15)}`,
      type: 'TEXT',
      layout: {
        mode: 'NONE',
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        itemSpacing: 0,
        width: 'HUG',
        height: 'HUG'
      },
      styles: { fills: [color] },
      textData: {
        characters,
        fontSize,
        fontWeight,
        fontFamily: 'Inter',
        lineHeight
      }
    };
  }

  // Helper para crear una tarjeta de muestra de color (Color Swatch)
  function createColorSwatch(name: string, hex: string, rgbStr: string, color: RGBAColor): UINode {
    return {
      id: nextId('swatch'),
      name: `Swatch / ${name}`,
      type: 'FRAME',
      layout: {
        mode: 'VERTICAL',
        primaryAxisAlignItems: 'MIN',
        counterAxisAlignItems: 'MIN',
        padding: { top: 8, right: 8, bottom: 12, left: 8 },
        itemSpacing: 8,
        width: 140,
        height: 'HUG'
      },
      styles: {
        fills: [colors.surfaceWhite],
        strokes: [{ ...colors.borderGray, width: 1, align: 'INSIDE' }],
        cornerRadius: 10,
        boxShadow: [{ color: c(0, 0, 0, 0.04), offset: { x: 0, y: 2 }, radius: 6, spread: 0 }]
      },
      children: [
        // Muestra de color
        {
          id: nextId('color_box'),
          name: 'Preview',
          type: 'FRAME',
          layout: {
            mode: 'NONE',
            padding: { top: 0, right: 0, bottom: 0, left: 0 },
            itemSpacing: 0,
            width: 124,
            height: 64
          },
          styles: {
            fills: [color],
            cornerRadius: 6,
            strokes: color.a < 1 || (color.r > 0.9 && color.g > 0.9 && color.b > 0.9) 
              ? [{ ...colors.borderGray, width: 1, align: 'INSIDE' }] 
              : []
          }
        },
        // Nombre del token
        createTextNode(name, 12, 600, colors.textDark),
        // Código HEX
        createTextNode(hex, 11, 500, colors.textMuted),
        // Código RGB
        createTextNode(rgbStr, 10, 400, colors.textMuted)
      ]
    };
  }

  // 2. Sección: Paleta de Colores
  const colorSection: UINode = {
    id: nextId('section_colors'),
    name: 'Section / Color Palette',
    type: 'FRAME',
    layout: {
      mode: 'VERTICAL',
      primaryAxisAlignItems: 'MIN',
      counterAxisAlignItems: 'MIN',
      padding: { top: 24, right: 32, bottom: 28, left: 32 },
      itemSpacing: 16,
      width: 1480,
      height: 'HUG'
    },
    styles: {
      fills: [colors.surfaceLight],
      strokes: [{ ...colors.borderGray, width: 1, align: 'INSIDE' }],
      cornerRadius: 16
    },
    children: [
      createTextNode('01. PALETA DE COLORES Y TOKENS (COLOR SYSTEM)', 16, 700, colors.pichinchaNavy),
      createTextNode('Colores oficiales de marca, superficies, neutros y estados semánticos del sistema.', 13, 400, colors.textMuted),
      {
        id: nextId('swatches_row'),
        name: 'Color Grid',
        type: 'FRAME',
        layout: {
          mode: 'HORIZONTAL',
          primaryAxisAlignItems: 'MIN',
          counterAxisAlignItems: 'MIN',
          padding: { top: 12, right: 0, bottom: 0, left: 0 },
          itemSpacing: 16,
          layoutWrap: 'WRAP',
          width: 1416,
          height: 'HUG'
        },
        styles: { fills: [] },
        children: [
          createColorSwatch('Brand Yellow', '#FFDD00', 'rgb(255, 221, 0)', colors.pichinchaYellow),
          createColorSwatch('Brand Navy', '#0F265C', 'rgb(15, 38, 92)', colors.pichinchaNavy),
          createColorSwatch('Sidebar Dark', '#0D1E3A', 'rgb(13, 30, 58)', colors.sidebarDark),
          createColorSwatch('Accent Blue', '#2563EB', 'rgb(37, 99, 235)', colors.accentBlue),
          createColorSwatch('Surface Light', '#F8FAFC', 'rgb(248, 250, 252)', colors.surfaceLight),
          createColorSwatch('Surface Pure', '#FFFFFF', 'rgb(255, 255, 255)', colors.surfaceWhite),
          createColorSwatch('Text Primary', '#0F172A', 'rgb(15, 23, 42)', colors.textDark),
          createColorSwatch('Text Muted', '#64748B', 'rgb(100, 116, 139)', colors.textMuted),
          createColorSwatch('Success', '#10B981', 'rgb(16, 185, 129)', colors.successGreen),
          createColorSwatch('Danger', '#EF4444', 'rgb(239, 68, 68)', colors.dangerRed),
          createColorSwatch('Warning', '#F59E0B', 'rgb(245, 158, 11)', colors.warningAmber),
          createColorSwatch('Info', '#3B82F6', 'rgb(59, 130, 246)', colors.infoBlue)
        ]
      }
    ]
  };

  // Helper para fila de escala tipográfica
  function createTypeRow(level: string, specs: string, sample: string, size: number, weight: number | string): UINode {
    return {
      id: nextId('type_row'),
      name: `TypeRow / ${level}`,
      type: 'FRAME',
      layout: {
        mode: 'HORIZONTAL',
        primaryAxisAlignItems: 'MIN',
        counterAxisAlignItems: 'CENTER',
        padding: { top: 12, right: 16, bottom: 12, left: 16 },
        itemSpacing: 24,
        width: 1416,
        height: 'HUG'
      },
      styles: {
        fills: [colors.surfaceWhite],
        strokes: [{ ...colors.borderGray, width: 1, align: 'INSIDE' }],
        cornerRadius: 8
      },
      children: [
        {
          id: nextId('type_meta'),
          name: 'Meta',
          type: 'FRAME',
          layout: {
            mode: 'VERTICAL',
            padding: { top: 0, right: 0, bottom: 0, left: 0 },
            itemSpacing: 4,
            width: 240,
            height: 'HUG'
          },
          styles: { fills: [] },
          children: [
            createTextNode(level, 13, 700, colors.pichinchaNavy),
            createTextNode(specs, 11, 400, colors.textMuted)
          ]
        },
        createTextNode(sample, size, weight, colors.textDark)
      ]
    };
  }

  // 3. Sección: Escala Tipográfica
  const typographySection: UINode = {
    id: nextId('section_typography'),
    name: 'Section / Typography',
    type: 'FRAME',
    layout: {
      mode: 'VERTICAL',
      primaryAxisAlignItems: 'MIN',
      counterAxisAlignItems: 'MIN',
      padding: { top: 24, right: 32, bottom: 28, left: 32 },
      itemSpacing: 16,
      width: 1480,
      height: 'HUG'
    },
    styles: {
      fills: [colors.surfaceLight],
      strokes: [{ ...colors.borderGray, width: 1, align: 'INSIDE' }],
      cornerRadius: 16
    },
    children: [
      createTextNode('02. ESCALA TIPOGRÁFICA (TYPOGRAPHY SCALE)', 16, 700, colors.pichinchaNavy),
      createTextNode('Familia tipográfica oficial: Inter / Roboto con pesos 400, 500, 600 y 700.', 13, 400, colors.textMuted),
      createTypeRow('Display Title', '32px • Bold (700) • LineHeight 40', 'Polaris Cloud Banco Pichincha', 32, 700),
      createTypeRow('Heading 1', '24px • SemiBold (600) • LineHeight 32', 'Gestión Integral de Terminales y Grupos', 24, 600),
      createTypeRow('Heading 2', '20px • Medium (500) • LineHeight 28', 'Reporte Detallado de Transacciones y Descargas', 20, 500),
      createTypeRow('Subtitle / H3', '16px • SemiBold (600) • LineHeight 24', 'Configuración de Parámetros y Seguridad', 16, 600),
      createTypeRow('Body Regular', '14px • Regular (400) • LineHeight 20', 'Texto estándar para tablas de datos, formularios y tarjetas informativas.', 14, 400),
      createTypeRow('Caption / Meta', '12px • Medium (500) • LineHeight 16', 'Versión de sistema 1.8.0 • Última sincronización: Hoy 14:30', 12, 500)
    ]
  };

  // Helper para botón
  function createButtonSample(label: string, bg: RGBAColor, textColor: RGBAColor, border?: RGBAColor): UINode {
    return {
      id: nextId('btn'),
      name: `Button / ${label}`,
      type: 'FRAME',
      layout: {
        mode: 'HORIZONTAL',
        primaryAxisAlignItems: 'CENTER',
        counterAxisAlignItems: 'CENTER',
        padding: { top: 10, right: 20, bottom: 10, left: 20 },
        itemSpacing: 8,
        width: 'HUG',
        height: 'HUG'
      },
      styles: {
        fills: [bg],
        cornerRadius: 8,
        strokes: border ? [{ ...border, width: 1, align: 'INSIDE' }] : []
      },
      children: [
        createTextNode(label, 14, 600, textColor)
      ]
    };
  }

  // Helper para badge
  function createBadgeSample(label: string, bg: RGBAColor, textColor: RGBAColor): UINode {
    return {
      id: nextId('badge'),
      name: `Badge / ${label}`,
      type: 'FRAME',
      layout: {
        mode: 'HORIZONTAL',
        primaryAxisAlignItems: 'CENTER',
        counterAxisAlignItems: 'CENTER',
        padding: { top: 4, right: 12, bottom: 4, left: 12 },
        itemSpacing: 6,
        width: 'HUG',
        height: 'HUG'
      },
      styles: {
        fills: [bg],
        cornerRadius: 16
      },
      children: [
        createTextNode(label, 12, 600, textColor)
      ]
    };
  }

  // 4. Sección: Componentes y Botones Interactivos (UI Kit)
  const componentsSection: UINode = {
    id: nextId('section_components'),
    name: 'Section / UI Components',
    type: 'FRAME',
    layout: {
      mode: 'VERTICAL',
      primaryAxisAlignItems: 'MIN',
      counterAxisAlignItems: 'MIN',
      padding: { top: 24, right: 32, bottom: 28, left: 32 },
      itemSpacing: 20,
      width: 1480,
      height: 'HUG'
    },
    styles: {
      fills: [colors.surfaceLight],
      strokes: [{ ...colors.borderGray, width: 1, align: 'INSIDE' }],
      cornerRadius: 16
    },
    children: [
      createTextNode('03. BOTONES Y COMPONENTES REUTILIZABLES (UI KIT)', 16, 700, colors.pichinchaNavy),
      createTextNode('Estados de botones, badges, campos de texto y elementos de control del sistema.', 13, 400, colors.textMuted),
      // Fila de Botones
      {
        id: nextId('buttons_row'),
        name: 'Buttons Group',
        type: 'FRAME',
        layout: {
          mode: 'HORIZONTAL',
          primaryAxisAlignItems: 'MIN',
          counterAxisAlignItems: 'CENTER',
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          itemSpacing: 16,
          width: 'HUG',
          height: 'HUG'
        },
        styles: { fills: [] },
        children: [
          createButtonSample('Botón Principal (Brand)', colors.pichinchaYellow, colors.textDark),
          createButtonSample('Acción Secundaria', colors.pichinchaNavy, colors.surfaceWhite),
          createButtonSample('Botón Contorno', colors.surfaceWhite, colors.textDark, colors.borderGray),
          createButtonSample('Peligro / Eliminar', colors.dangerRed, colors.surfaceWhite),
          createButtonSample('+ Nuevo Registro', colors.accentBlue, colors.surfaceWhite)
        ]
      },
      // Fila de Badges y Pills
      {
        id: nextId('badges_row'),
        name: 'Badges Group',
        type: 'FRAME',
        layout: {
          mode: 'HORIZONTAL',
          primaryAxisAlignItems: 'MIN',
          counterAxisAlignItems: 'CENTER',
          padding: { top: 4, right: 0, bottom: 0, left: 0 },
          itemSpacing: 12,
          width: 'HUG',
          height: 'HUG'
        },
        styles: { fills: [] },
        children: [
          createBadgeSample('● Activo', c(209, 250, 229), c(6, 95, 70)),
          createBadgeSample('● En Línea', c(219, 234, 254), c(30, 64, 175)),
          createBadgeSample('● Pendiente', c(254, 243, 199), c(146, 64, 14)),
          createBadgeSample('● Inactivo / Error', c(254, 226, 226), c(153, 27, 27)),
          createBadgeSample('Terminal v1.8.0', c(241, 245, 249), c(71, 85, 105))
        ]
      },
      // Input de búsqueda / formulario simulado
      {
        id: nextId('input_sample'),
        name: 'Input / Search Field',
        type: 'FRAME',
        layout: {
          mode: 'HORIZONTAL',
          primaryAxisAlignItems: 'MIN',
          counterAxisAlignItems: 'CENTER',
          padding: { top: 10, right: 16, bottom: 10, left: 16 },
          itemSpacing: 10,
          width: 420,
          height: 'HUG'
        },
        styles: {
          fills: [colors.surfaceWhite],
          strokes: [{ ...colors.borderGray, width: 1, align: 'INSIDE' }],
          cornerRadius: 8
        },
        children: [
          createTextNode('🔍', 14, 400, colors.textMuted),
          createTextNode('Buscar por terminal, serie o usuario...', 13, 400, colors.textMuted)
        ]
      }
    ]
  };

  // 5. Marco Raíz Desktop del Sistema de Diseño (1600 px de ancho)
  return {
    id: nextId('root_design_system'),
    name: '🎨 Design System & UI Kit / Banco Pichincha',
    type: 'FRAME',
    layout: {
      mode: 'VERTICAL',
      primaryAxisAlignItems: 'MIN',
      counterAxisAlignItems: 'MIN',
      padding: { top: 48, right: 60, bottom: 60, left: 60 },
      itemSpacing: 36,
      width: 1600,
      height: 'HUG'
    },
    styles: {
      fills: [colors.surfaceWhite],
      cornerRadius: 0
    },
    children: [
      // Encabezado Principal del Artboard
      {
        id: nextId('header_block'),
        name: 'Header / Brand Title',
        type: 'FRAME',
        layout: {
          mode: 'VERTICAL',
          primaryAxisAlignItems: 'MIN',
          counterAxisAlignItems: 'MIN',
          padding: { top: 0, right: 0, bottom: 12, left: 0 },
          itemSpacing: 8,
          width: 1480,
          height: 'HUG'
        },
        styles: { fills: [] },
        children: [
          createTextNode('BANCO PICHINCHA • POLARIS CLOUD', 13, 700, colors.accentBlue),
          createTextNode('Design System, Tokens, Typography & Component Kit', 32, 700, colors.pichinchaNavy),
          createTextNode('Especificación oficial extraída del código en vivo. Guía canónica de colores, jerarquía de fuentes y botones reutilizables.', 15, 400, colors.textMuted)
        ]
      },
      colorSection,
      typographySection,
      componentsSection
    ]
  };
}
