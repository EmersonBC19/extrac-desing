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
  positioning?: PositioningMode;
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

export interface UIStyles {
  fills: RGBAColor[];
  strokes?: StrokeStyle[];
  borderSides?: BorderSides;
  cornerRadius?: number | [number, number, number, number];
  opacity?: number;
  boxShadow?: BoxShadow[];
}

export interface UITextData {
  characters: string;
  fontSize: number;
  fontWeight: number | string;
  fontFamily: string;
  lineHeight?: number;
  letterSpacing?: number;
  textAlign?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
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

export interface WSRenderPayload {
  rootNode: UINode;
  clearPage?: boolean;
  createAsComponent?: boolean;
  targetCanvasPosition?: { x: number; y: number };
  pageName?: string;
  groupName?: string;
  sectionTitle?: string;
}

export interface WSMessage<T = unknown> {
  type: 'RENDER_NODES' | 'RENDER_SUCCESS' | 'RENDER_ERROR' | 'PING' | 'PONG' | 'REGISTER_CLIENT';
  clientType?: WSClientType;
  payload?: T;
  error?: string;
}
