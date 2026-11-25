/**
 * Validación en tiempo de ejecución de los payloads (plan de mejoras, fase 1.3).
 *
 * TypeScript solo protege al compilar; por WebSocket o "Pegar JSON" los datos llegan sin
 * garantías. Estos esquemas son estrictos en lo que afecta a la seguridad y a la estabilidad
 * de Figma (tipos, tamaños, profundidad, imágenes, SVG) y permisivos en el resto
 * (`passthrough`), para no rechazar extracciones válidas por campos nuevos.
 */
import * as z from 'zod';
export declare const PAYLOAD_LIMITS: {
    /** Profundidad máxima del árbol (evita desbordar la pila del plugin) */
    readonly maxDepth: 400;
    /** Nodos totales (una landing grande ronda 5–15 mil) */
    readonly maxNodes: 150000;
    /** Caracteres de una imagen base64 (~30 MB) */
    readonly maxImageChars: number;
    readonly maxSvgChars: number;
    readonly maxTextChars: 200000;
    readonly maxNameChars: 1000;
};
export declare const UILayoutSchema: z.ZodObject<{
    mode: z.ZodOptional<z.ZodEnum<{
        NONE: "NONE";
        HORIZONTAL: "HORIZONTAL";
        VERTICAL: "VERTICAL";
    }>>;
    width: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"FILL">, z.ZodLiteral<"HUG">]>>;
    height: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"FILL">, z.ZodLiteral<"HUG">]>>;
    measuredWidth: z.ZodOptional<z.ZodNumber>;
    measuredHeight: z.ZodOptional<z.ZodNumber>;
    x: z.ZodOptional<z.ZodNumber>;
    y: z.ZodOptional<z.ZodNumber>;
    itemSpacing: z.ZodOptional<z.ZodNumber>;
    padding: z.ZodOptional<z.ZodObject<{
        top: z.ZodOptional<z.ZodNumber>;
        right: z.ZodOptional<z.ZodNumber>;
        bottom: z.ZodOptional<z.ZodNumber>;
        left: z.ZodOptional<z.ZodNumber>;
    }, z.core.$loose>>;
    positioning: z.ZodOptional<z.ZodEnum<{
        AUTO: "AUTO";
        ABSOLUTE: "ABSOLUTE";
    }>>;
}, z.core.$loose>;
export declare const UITextSegmentSchema: z.ZodObject<{
    start: z.ZodNumber;
    end: z.ZodNumber;
}, z.core.$loose>;
export declare const UITextDataSchema: z.ZodObject<{
    characters: z.ZodString;
    fontSize: z.ZodOptional<z.ZodNumber>;
    fontFamily: z.ZodOptional<z.ZodString>;
    segments: z.ZodOptional<z.ZodArray<z.ZodObject<{
        start: z.ZodNumber;
        end: z.ZodNumber;
    }, z.core.$loose>>>;
}, z.core.$loose>;
/** Un nodo SIN validar sus hijos (el árbol se recorre de forma iterativa, ver validateUINodeTree) */
export declare const UINodeShallowSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    type: z.ZodEnum<{
        FRAME: "FRAME";
        TEXT: "TEXT";
        SVG: "SVG";
        COMPONENT: "COMPONENT";
        INSTANCE: "INSTANCE";
    }>;
    name: z.ZodOptional<z.ZodString>;
    layout: z.ZodOptional<z.ZodObject<{
        mode: z.ZodOptional<z.ZodEnum<{
            NONE: "NONE";
            HORIZONTAL: "HORIZONTAL";
            VERTICAL: "VERTICAL";
        }>>;
        width: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"FILL">, z.ZodLiteral<"HUG">]>>;
        height: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"FILL">, z.ZodLiteral<"HUG">]>>;
        measuredWidth: z.ZodOptional<z.ZodNumber>;
        measuredHeight: z.ZodOptional<z.ZodNumber>;
        x: z.ZodOptional<z.ZodNumber>;
        y: z.ZodOptional<z.ZodNumber>;
        itemSpacing: z.ZodOptional<z.ZodNumber>;
        padding: z.ZodOptional<z.ZodObject<{
            top: z.ZodOptional<z.ZodNumber>;
            right: z.ZodOptional<z.ZodNumber>;
            bottom: z.ZodOptional<z.ZodNumber>;
            left: z.ZodOptional<z.ZodNumber>;
        }, z.core.$loose>>;
        positioning: z.ZodOptional<z.ZodEnum<{
            AUTO: "AUTO";
            ABSOLUTE: "ABSOLUTE";
        }>>;
    }, z.core.$loose>>;
    styles: z.ZodOptional<z.ZodObject<{}, z.core.$loose>>;
    textData: z.ZodOptional<z.ZodObject<{
        characters: z.ZodString;
        fontSize: z.ZodOptional<z.ZodNumber>;
        fontFamily: z.ZodOptional<z.ZodString>;
        segments: z.ZodOptional<z.ZodArray<z.ZodObject<{
            start: z.ZodNumber;
            end: z.ZodNumber;
        }, z.core.$loose>>>;
    }, z.core.$loose>>;
    svgContent: z.ZodOptional<z.ZodString>;
    imageData: z.ZodOptional<z.ZodString>;
    children: z.ZodOptional<z.ZodArray<z.ZodUnknown>>;
}, z.core.$loose>;
export type ValidationResult = {
    ok: true;
    nodeCount: number;
    maxDepth: number;
} | {
    ok: false;
    error: string;
};
/**
 * Valida el árbol completo de forma iterativa (sin recursión: un payload malicioso muy
 * profundo no puede desbordar la pila) y aplica los límites de profundidad y cantidad.
 */
export declare function validateUINodeTree(root: unknown): ValidationResult;
export declare const WSRenderPayloadSchema: z.ZodObject<{
    rootNode: z.ZodUnknown;
    tokens: z.ZodOptional<z.ZodObject<{}, z.core.$loose>>;
    createAsComponent: z.ZodOptional<z.ZodBoolean>;
    board: z.ZodOptional<z.ZodBoolean>;
    scan: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        index: z.ZodNumber;
        total: z.ZodNumber;
        path: z.ZodString;
        label: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    states: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        rootNode: z.ZodUnknown;
    }, z.core.$loose>>>;
    compare: z.ZodOptional<z.ZodObject<{
        targetNodeId: z.ZodString;
        width: z.ZodOptional<z.ZodNumber>;
    }, z.core.$loose>>;
    responsive: z.ZodOptional<z.ZodObject<{
        variants: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            width: z.ZodNumber;
            rootNode: z.ZodUnknown;
            dark: z.ZodOptional<z.ZodUnknown>;
        }, z.core.$loose>>;
        themeSource: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            media: "media";
            class: "class";
        }>>>;
    }, z.core.$loose>>;
    fontMap: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    prewarmFonts: z.ZodOptional<z.ZodBoolean>;
    viewport: z.ZodOptional<z.ZodObject<{
        width: z.ZodNumber;
        height: z.ZodNumber;
    }, z.core.$strip>>;
    clearPage: z.ZodOptional<z.ZodBoolean>;
    pageName: z.ZodOptional<z.ZodString>;
    sectionTitle: z.ZodOptional<z.ZodString>;
    source: z.ZodOptional<z.ZodObject<{
        url: z.ZodOptional<z.ZodString>;
        title: z.ZodOptional<z.ZodString>;
    }, z.core.$loose>>;
}, z.core.$loose>;
/** Payload de RENDER_NODES completo: forma del sobre + árbol de nodos */
export declare function validateRenderPayload(payload: unknown): ValidationResult;
/** Sobre mínimo de cualquier mensaje del bus */
export declare const WSMessageEnvelopeSchema: z.ZodObject<{
    type: z.ZodString;
}, z.core.$loose>;
//# sourceMappingURL=schemas.d.ts.map