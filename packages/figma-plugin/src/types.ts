/**
 * Tipos del árbol de nodos que recibe el plugin.
 */
// Tipos auxiliares internos para evitar fallos de compilación sin el paquete contracts
export interface RGBAColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface BoxSpacing {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface StrokeStyle extends RGBAColor {
  width: number;
  align?: 'INSIDE' | 'OUTSIDE' | 'CENTER';
}

export interface BoxShadow {
  color: RGBAColor;
  offset: { x: number; y: number };
  radius: number;
  spread: number;
}

export interface UITextData {
  characters: string;
  fontSize: number;
  fontWeight: number | string;
  fontFamily: string;
  lineHeight?: number;
  letterSpacing?: number;
  textAlign?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
  textTransform?: 'UPPERCASE' | 'LOWERCASE' | 'CAPITALIZE' | 'NONE';
  isMultiline?: boolean;
  /** Los '\n' de characters son los saltos reales del navegador: no re-acomodar */
  noWrap?: boolean;
  lineCount?: number;
  segments?: UITextSegment[];
}

export interface UITextSegment {
  start: number;
  end: number;
  fontFamily?: string;
  fontWeight?: number | string;
  fontSize?: number;
  italic?: boolean;
  color?: { r: number; g: number; b: number; a?: number };
  underline?: boolean;
  strike?: boolean;
  baseline?: 'SUPER' | 'SUB';
}

export interface UILayout {
  mode: 'NONE' | 'HORIZONTAL' | 'VERTICAL';
  primaryAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
  counterAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'BASELINE';
  padding: BoxSpacing;
  itemSpacing: number;
  width: number | 'FILL' | 'HUG';
  height: number | 'FILL' | 'HUG';
  measuredWidth?: number;
  measuredHeight?: number;
  positioning?: 'AUTO' | 'ABSOLUTE';
  layoutWrap?: 'NO_WRAP' | 'WRAP';
  x?: number;
  y?: number;
}

export interface BorderSides {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export interface UIGradientStop {
  position: number;
  color: RGBAColor;
}

export interface UIGradientPaint {
  type: 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL';
  angle?: number;
  stops: UIGradientStop[];
}

export interface UIStyles {
  fills: (RGBAColor | UIGradientPaint)[];
  strokes?: StrokeStyle[];
  borderSides?: BorderSides;
  cornerRadius?: number | [number, number, number, number];
  opacity?: number;
  boxShadow?: BoxShadow[];
  backdropBlur?: number;
  imageScaleMode?: 'FILL' | 'FIT' | 'CROP' | 'TILE';
}

export interface UINode {
  id: string;
  name: string;
  type: 'FRAME' | 'TEXT' | 'SVG' | 'COMPONENT' | 'INSTANCE';
  layout: UILayout;
  styles: UIStyles;
  textData?: UITextData;
  svgContent?: string;
  imageData?: string;
  clipsContent?: boolean;
  metadata?: Record<string, unknown>;
  children?: UINode[];
}

export interface RenderPayload {
  rootNode: UINode;
  clearPage?: boolean;
  createAsComponent?: boolean;
  targetCanvasPosition?: { x: number; y: number };
  pageName?: string;
  sectionTitle?: string;
  tokens?: {
    colors?: Record<string, RGBAColor>;
    radii?: Record<string, number>;
  };
}
