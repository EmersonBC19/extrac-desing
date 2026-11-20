export interface RGBAColor {
  r: number; // 0 to 1
  g: number; // 0 to 1
  b: number; // 0 to 1
  a: number; // 0 to 1
}

export interface BoxSpacing {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface BoxShadow {
  color: RGBAColor;
  offset: { x: number; y: number };
  radius: number;
  spread: number;
}

export interface StrokeStyle extends RGBAColor {
  width: number;
  align?: 'INSIDE' | 'OUTSIDE' | 'CENTER';
}

export type LayoutMode = 'NONE' | 'HORIZONTAL' | 'VERTICAL';
export type PrimaryAxisAlign = 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
export type CounterAxisAlign = 'MIN' | 'CENTER' | 'MAX' | 'BASELINE';
export type LayoutSizing = number | 'FILL' | 'HUG';
export type PositioningMode = 'AUTO' | 'ABSOLUTE';

export interface UILayout {
  mode: LayoutMode;
  primaryAxisAlignItems?: PrimaryAxisAlign;
  counterAxisAlignItems?: CounterAxisAlign;
  padding: BoxSpacing;
  itemSpacing: number;
  width: LayoutSizing;
  height: LayoutSizing;
  measuredWidth?: number;
  measuredHeight?: number;
  positioning?: PositioningMode;
  layoutWrap?: 'NO_WRAP' | 'WRAP';
  x?: number;
  y?: number;
}

export interface GradientStop {
  /** Fracción 0..1 (CSS en %); puede faltar: se reparte como en CSS */
  position?: number;
  /** Posición en px a lo largo del rayo (CSS en px) */
  px?: number;
  color: RGBAColor;
}

/** Degradado CSS (fase 5.4): parámetros CSS; el plugin calcula la geometría con el tamaño del nodo */
export interface GradientPaint {
  type: 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'GRADIENT_ANGULAR';
  /** Lineal: grados CSS (0 = hacia arriba) */
  angle?: number;
  /** Lineal: "top right", "bottom left"… */
  toCorner?: string;
  /** Radial */
  shape?: 'circle' | 'ellipse';
  size?: string | { v: number; u: '%' | 'px' }[];
  /** Radial y angular: centro */
  at?: { x?: { v: number; u: '%' | 'px' }; y?: { v: number; u: '%' | 'px' } };
  /** Angular (conic-gradient): ángulo inicial */
  from?: number;
  stops: GradientStop[];
}

export type CanvasFill = RGBAColor | GradientPaint;

export interface BorderSides {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export interface UIStyles {
  fills: (RGBAColor | GradientPaint)[];
  strokes?: StrokeStyle[];
  borderSides?: BorderSides;
  cornerRadius?: number | [number, number, number, number];
  opacity?: number;
  boxShadow?: BoxShadow[];
  backdropBlur?: number;
  imageScaleMode?: 'FILL' | 'FIT' | 'CROP' | 'TILE';
}

export interface UITextData {
  characters: string;
  fontSize: number;
  fontWeight: number | string;
  fontFamily: string;
  /** Pila CSS completa ("Circular, Helvetica, sans-serif"): el plugin prueba cada familia */
  fontStack?: string;
  lineHeight?: number;
  letterSpacing?: number;
  textAlign?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
  textTransform?: 'UPPERCASE' | 'LOWERCASE' | 'CAPITALIZE' | 'NONE';
  isMultiline?: boolean;
  /** Los '\n' de characters son los saltos de línea reales del navegador: Figma no debe re-acomodar */
  noWrap?: boolean;
  lineCount?: number;
  /** Tramos con estilo propio dentro del mismo texto (links, negritas, <sup>) */
  segments?: UITextSegment[];
}

export interface UITextSegment {
  start: number;
  end: number;
  fontFamily?: string;
  fontStack?: string;
  fontWeight?: number | string;
  fontSize?: number;
  italic?: boolean;
  color?: { r: number; g: number; b: number; a?: number };
  underline?: boolean;
  strike?: boolean;
  baseline?: 'SUPER' | 'SUB';
}

export type UINodeType = 'FRAME' | 'TEXT' | 'SVG' | 'COMPONENT' | 'INSTANCE';

export interface UINode {
  id: string;
  name: string;
  type: UINodeType;
  layout: UILayout;
  styles: UIStyles;
  textData?: UITextData;
  svgContent?: string;
  imageData?: string;
  clipsContent?: boolean;
  metadata?: {
    componentName?: string;
    props?: Record<string, unknown>;
    sourceFile?: string;
    astId?: string;
    [key: string]: unknown;
  };
  children?: UINode[];
}

// Eventos de comunicación WebSocket
export type WSClientType = 'FIGMA_PLUGIN' | 'CLI_OR_MCP' | 'WEB_EXTRACTOR';

export interface DesignTokens {
  colors?: Record<string, RGBAColor>;
  radii?: Record<string, number>;
  spacing?: Record<string, number>;
}

export interface WSRenderPayload {
  rootNode: UINode;
  clearPage?: boolean;
  createAsComponent?: boolean;
  targetCanvasPosition?: { x: number; y: number };
  pageName?: string;
  groupName?: string;
  sectionTitle?: string;
  tokens?: DesignTokens;
}

export interface WSMessage<T = unknown> {
  type: 'RENDER_NODES' | 'RENDER_SUCCESS' | 'RENDER_ERROR' | 'PING' | 'PONG' | 'REGISTER_CLIENT';
  clientType?: WSClientType;
  payload?: T;
  error?: string;
}
