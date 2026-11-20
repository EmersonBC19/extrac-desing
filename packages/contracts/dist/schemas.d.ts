/**
 * Validación en tiempo de ejecución de los payloads (plan de mejoras, fase 1.3).
 *
 * TypeScript solo protege al compilar; por WebSocket o "Pegar JSON" los datos llegan sin
 * garantías. Estos esquemas son estrictos en lo que afecta a la seguridad y a la estabilidad
 * de Figma (tipos, tamaños, profundidad, imágenes, SVG) y permisivos en el resto
 * (`passthrough`), para no rechazar extracciones válidas por campos nuevos.
 */
import { z } from 'zod';
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
    mode: z.ZodOptional<z.ZodEnum<["NONE", "HORIZONTAL", "VERTICAL"]>>;
    width: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodLiteral<"FILL">, z.ZodLiteral<"HUG">]>>;
    height: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodLiteral<"FILL">, z.ZodLiteral<"HUG">]>>;
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
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        top: z.ZodOptional<z.ZodNumber>;
        right: z.ZodOptional<z.ZodNumber>;
        bottom: z.ZodOptional<z.ZodNumber>;
        left: z.ZodOptional<z.ZodNumber>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        top: z.ZodOptional<z.ZodNumber>;
        right: z.ZodOptional<z.ZodNumber>;
        bottom: z.ZodOptional<z.ZodNumber>;
        left: z.ZodOptional<z.ZodNumber>;
    }, z.ZodTypeAny, "passthrough">>>;
    positioning: z.ZodOptional<z.ZodEnum<["AUTO", "ABSOLUTE"]>>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    mode: z.ZodOptional<z.ZodEnum<["NONE", "HORIZONTAL", "VERTICAL"]>>;
    width: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodLiteral<"FILL">, z.ZodLiteral<"HUG">]>>;
    height: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodLiteral<"FILL">, z.ZodLiteral<"HUG">]>>;
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
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        top: z.ZodOptional<z.ZodNumber>;
        right: z.ZodOptional<z.ZodNumber>;
        bottom: z.ZodOptional<z.ZodNumber>;
        left: z.ZodOptional<z.ZodNumber>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        top: z.ZodOptional<z.ZodNumber>;
        right: z.ZodOptional<z.ZodNumber>;
        bottom: z.ZodOptional<z.ZodNumber>;
        left: z.ZodOptional<z.ZodNumber>;
    }, z.ZodTypeAny, "passthrough">>>;
    positioning: z.ZodOptional<z.ZodEnum<["AUTO", "ABSOLUTE"]>>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    mode: z.ZodOptional<z.ZodEnum<["NONE", "HORIZONTAL", "VERTICAL"]>>;
    width: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodLiteral<"FILL">, z.ZodLiteral<"HUG">]>>;
    height: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodLiteral<"FILL">, z.ZodLiteral<"HUG">]>>;
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
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        top: z.ZodOptional<z.ZodNumber>;
        right: z.ZodOptional<z.ZodNumber>;
        bottom: z.ZodOptional<z.ZodNumber>;
        left: z.ZodOptional<z.ZodNumber>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        top: z.ZodOptional<z.ZodNumber>;
        right: z.ZodOptional<z.ZodNumber>;
        bottom: z.ZodOptional<z.ZodNumber>;
        left: z.ZodOptional<z.ZodNumber>;
    }, z.ZodTypeAny, "passthrough">>>;
    positioning: z.ZodOptional<z.ZodEnum<["AUTO", "ABSOLUTE"]>>;
}, z.ZodTypeAny, "passthrough">>;
export declare const UITextSegmentSchema: z.ZodObject<{
    start: z.ZodNumber;
    end: z.ZodNumber;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    start: z.ZodNumber;
    end: z.ZodNumber;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    start: z.ZodNumber;
    end: z.ZodNumber;
}, z.ZodTypeAny, "passthrough">>;
export declare const UITextDataSchema: z.ZodObject<{
    characters: z.ZodString;
    fontSize: z.ZodOptional<z.ZodNumber>;
    fontFamily: z.ZodOptional<z.ZodString>;
    segments: z.ZodOptional<z.ZodArray<z.ZodObject<{
        start: z.ZodNumber;
        end: z.ZodNumber;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        start: z.ZodNumber;
        end: z.ZodNumber;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        start: z.ZodNumber;
        end: z.ZodNumber;
    }, z.ZodTypeAny, "passthrough">>, "many">>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    characters: z.ZodString;
    fontSize: z.ZodOptional<z.ZodNumber>;
    fontFamily: z.ZodOptional<z.ZodString>;
    segments: z.ZodOptional<z.ZodArray<z.ZodObject<{
        start: z.ZodNumber;
        end: z.ZodNumber;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        start: z.ZodNumber;
        end: z.ZodNumber;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        start: z.ZodNumber;
        end: z.ZodNumber;
    }, z.ZodTypeAny, "passthrough">>, "many">>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    characters: z.ZodString;
    fontSize: z.ZodOptional<z.ZodNumber>;
    fontFamily: z.ZodOptional<z.ZodString>;
    segments: z.ZodOptional<z.ZodArray<z.ZodObject<{
        start: z.ZodNumber;
        end: z.ZodNumber;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        start: z.ZodNumber;
        end: z.ZodNumber;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        start: z.ZodNumber;
        end: z.ZodNumber;
    }, z.ZodTypeAny, "passthrough">>, "many">>;
}, z.ZodTypeAny, "passthrough">>;
/** Un nodo SIN validar sus hijos (el árbol se recorre de forma iterativa, ver validateUINodeTree) */
export declare const UINodeShallowSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    type: z.ZodEnum<["FRAME", "TEXT", "SVG", "COMPONENT", "INSTANCE"]>;
    name: z.ZodOptional<z.ZodString>;
    layout: z.ZodOptional<z.ZodObject<{
        mode: z.ZodOptional<z.ZodEnum<["NONE", "HORIZONTAL", "VERTICAL"]>>;
        width: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodLiteral<"FILL">, z.ZodLiteral<"HUG">]>>;
        height: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodLiteral<"FILL">, z.ZodLiteral<"HUG">]>>;
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
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            top: z.ZodOptional<z.ZodNumber>;
            right: z.ZodOptional<z.ZodNumber>;
            bottom: z.ZodOptional<z.ZodNumber>;
            left: z.ZodOptional<z.ZodNumber>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            top: z.ZodOptional<z.ZodNumber>;
            right: z.ZodOptional<z.ZodNumber>;
            bottom: z.ZodOptional<z.ZodNumber>;
            left: z.ZodOptional<z.ZodNumber>;
        }, z.ZodTypeAny, "passthrough">>>;
        positioning: z.ZodOptional<z.ZodEnum<["AUTO", "ABSOLUTE"]>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        mode: z.ZodOptional<z.ZodEnum<["NONE", "HORIZONTAL", "VERTICAL"]>>;
        width: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodLiteral<"FILL">, z.ZodLiteral<"HUG">]>>;
        height: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodLiteral<"FILL">, z.ZodLiteral<"HUG">]>>;
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
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            top: z.ZodOptional<z.ZodNumber>;
            right: z.ZodOptional<z.ZodNumber>;
            bottom: z.ZodOptional<z.ZodNumber>;
            left: z.ZodOptional<z.ZodNumber>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            top: z.ZodOptional<z.ZodNumber>;
            right: z.ZodOptional<z.ZodNumber>;
            bottom: z.ZodOptional<z.ZodNumber>;
            left: z.ZodOptional<z.ZodNumber>;
        }, z.ZodTypeAny, "passthrough">>>;
        positioning: z.ZodOptional<z.ZodEnum<["AUTO", "ABSOLUTE"]>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        mode: z.ZodOptional<z.ZodEnum<["NONE", "HORIZONTAL", "VERTICAL"]>>;
        width: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodLiteral<"FILL">, z.ZodLiteral<"HUG">]>>;
        height: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodLiteral<"FILL">, z.ZodLiteral<"HUG">]>>;
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
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            top: z.ZodOptional<z.ZodNumber>;
            right: z.ZodOptional<z.ZodNumber>;
            bottom: z.ZodOptional<z.ZodNumber>;
            left: z.ZodOptional<z.ZodNumber>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            top: z.ZodOptional<z.ZodNumber>;
            right: z.ZodOptional<z.ZodNumber>;
            bottom: z.ZodOptional<z.ZodNumber>;
            left: z.ZodOptional<z.ZodNumber>;
        }, z.ZodTypeAny, "passthrough">>>;
        positioning: z.ZodOptional<z.ZodEnum<["AUTO", "ABSOLUTE"]>>;
    }, z.ZodTypeAny, "passthrough">>>;
    styles: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
    textData: z.ZodOptional<z.ZodObject<{
        characters: z.ZodString;
        fontSize: z.ZodOptional<z.ZodNumber>;
        fontFamily: z.ZodOptional<z.ZodString>;
        segments: z.ZodOptional<z.ZodArray<z.ZodObject<{
            start: z.ZodNumber;
            end: z.ZodNumber;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            start: z.ZodNumber;
            end: z.ZodNumber;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            start: z.ZodNumber;
            end: z.ZodNumber;
        }, z.ZodTypeAny, "passthrough">>, "many">>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        characters: z.ZodString;
        fontSize: z.ZodOptional<z.ZodNumber>;
        fontFamily: z.ZodOptional<z.ZodString>;
        segments: z.ZodOptional<z.ZodArray<z.ZodObject<{
            start: z.ZodNumber;
            end: z.ZodNumber;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            start: z.ZodNumber;
            end: z.ZodNumber;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            start: z.ZodNumber;
            end: z.ZodNumber;
        }, z.ZodTypeAny, "passthrough">>, "many">>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        characters: z.ZodString;
        fontSize: z.ZodOptional<z.ZodNumber>;
        fontFamily: z.ZodOptional<z.ZodString>;
        segments: z.ZodOptional<z.ZodArray<z.ZodObject<{
            start: z.ZodNumber;
            end: z.ZodNumber;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            start: z.ZodNumber;
            end: z.ZodNumber;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            start: z.ZodNumber;
            end: z.ZodNumber;
        }, z.ZodTypeAny, "passthrough">>, "many">>;
    }, z.ZodTypeAny, "passthrough">>>;
    svgContent: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
    imageData: z.ZodOptional<z.ZodString>;
    children: z.ZodOptional<z.ZodArray<z.ZodUnknown, "many">>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    id: z.ZodOptional<z.ZodString>;
    type: z.ZodEnum<["FRAME", "TEXT", "SVG", "COMPONENT", "INSTANCE"]>;
    name: z.ZodOptional<z.ZodString>;
    layout: z.ZodOptional<z.ZodObject<{
        mode: z.ZodOptional<z.ZodEnum<["NONE", "HORIZONTAL", "VERTICAL"]>>;
        width: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodLiteral<"FILL">, z.ZodLiteral<"HUG">]>>;
        height: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodLiteral<"FILL">, z.ZodLiteral<"HUG">]>>;
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
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            top: z.ZodOptional<z.ZodNumber>;
            right: z.ZodOptional<z.ZodNumber>;
            bottom: z.ZodOptional<z.ZodNumber>;
            left: z.ZodOptional<z.ZodNumber>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            top: z.ZodOptional<z.ZodNumber>;
            right: z.ZodOptional<z.ZodNumber>;
            bottom: z.ZodOptional<z.ZodNumber>;
            left: z.ZodOptional<z.ZodNumber>;
        }, z.ZodTypeAny, "passthrough">>>;
        positioning: z.ZodOptional<z.ZodEnum<["AUTO", "ABSOLUTE"]>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        mode: z.ZodOptional<z.ZodEnum<["NONE", "HORIZONTAL", "VERTICAL"]>>;
        width: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodLiteral<"FILL">, z.ZodLiteral<"HUG">]>>;
        height: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodLiteral<"FILL">, z.ZodLiteral<"HUG">]>>;
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
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            top: z.ZodOptional<z.ZodNumber>;
            right: z.ZodOptional<z.ZodNumber>;
            bottom: z.ZodOptional<z.ZodNumber>;
            left: z.ZodOptional<z.ZodNumber>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            top: z.ZodOptional<z.ZodNumber>;
            right: z.ZodOptional<z.ZodNumber>;
            bottom: z.ZodOptional<z.ZodNumber>;
            left: z.ZodOptional<z.ZodNumber>;
        }, z.ZodTypeAny, "passthrough">>>;
        positioning: z.ZodOptional<z.ZodEnum<["AUTO", "ABSOLUTE"]>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        mode: z.ZodOptional<z.ZodEnum<["NONE", "HORIZONTAL", "VERTICAL"]>>;
        width: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodLiteral<"FILL">, z.ZodLiteral<"HUG">]>>;
        height: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodLiteral<"FILL">, z.ZodLiteral<"HUG">]>>;
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
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            top: z.ZodOptional<z.ZodNumber>;
            right: z.ZodOptional<z.ZodNumber>;
            bottom: z.ZodOptional<z.ZodNumber>;
            left: z.ZodOptional<z.ZodNumber>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            top: z.ZodOptional<z.ZodNumber>;
            right: z.ZodOptional<z.ZodNumber>;
            bottom: z.ZodOptional<z.ZodNumber>;
            left: z.ZodOptional<z.ZodNumber>;
        }, z.ZodTypeAny, "passthrough">>>;
        positioning: z.ZodOptional<z.ZodEnum<["AUTO", "ABSOLUTE"]>>;
    }, z.ZodTypeAny, "passthrough">>>;
    styles: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
    textData: z.ZodOptional<z.ZodObject<{
        characters: z.ZodString;
        fontSize: z.ZodOptional<z.ZodNumber>;
        fontFamily: z.ZodOptional<z.ZodString>;
        segments: z.ZodOptional<z.ZodArray<z.ZodObject<{
            start: z.ZodNumber;
            end: z.ZodNumber;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            start: z.ZodNumber;
            end: z.ZodNumber;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            start: z.ZodNumber;
            end: z.ZodNumber;
        }, z.ZodTypeAny, "passthrough">>, "many">>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        characters: z.ZodString;
        fontSize: z.ZodOptional<z.ZodNumber>;
        fontFamily: z.ZodOptional<z.ZodString>;
        segments: z.ZodOptional<z.ZodArray<z.ZodObject<{
            start: z.ZodNumber;
            end: z.ZodNumber;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            start: z.ZodNumber;
            end: z.ZodNumber;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            start: z.ZodNumber;
            end: z.ZodNumber;
        }, z.ZodTypeAny, "passthrough">>, "many">>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        characters: z.ZodString;
        fontSize: z.ZodOptional<z.ZodNumber>;
        fontFamily: z.ZodOptional<z.ZodString>;
        segments: z.ZodOptional<z.ZodArray<z.ZodObject<{
            start: z.ZodNumber;
            end: z.ZodNumber;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            start: z.ZodNumber;
            end: z.ZodNumber;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            start: z.ZodNumber;
            end: z.ZodNumber;
        }, z.ZodTypeAny, "passthrough">>, "many">>;
    }, z.ZodTypeAny, "passthrough">>>;
    svgContent: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
    imageData: z.ZodOptional<z.ZodString>;
    children: z.ZodOptional<z.ZodArray<z.ZodUnknown, "many">>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    id: z.ZodOptional<z.ZodString>;
    type: z.ZodEnum<["FRAME", "TEXT", "SVG", "COMPONENT", "INSTANCE"]>;
    name: z.ZodOptional<z.ZodString>;
    layout: z.ZodOptional<z.ZodObject<{
        mode: z.ZodOptional<z.ZodEnum<["NONE", "HORIZONTAL", "VERTICAL"]>>;
        width: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodLiteral<"FILL">, z.ZodLiteral<"HUG">]>>;
        height: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodLiteral<"FILL">, z.ZodLiteral<"HUG">]>>;
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
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            top: z.ZodOptional<z.ZodNumber>;
            right: z.ZodOptional<z.ZodNumber>;
            bottom: z.ZodOptional<z.ZodNumber>;
            left: z.ZodOptional<z.ZodNumber>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            top: z.ZodOptional<z.ZodNumber>;
            right: z.ZodOptional<z.ZodNumber>;
            bottom: z.ZodOptional<z.ZodNumber>;
            left: z.ZodOptional<z.ZodNumber>;
        }, z.ZodTypeAny, "passthrough">>>;
        positioning: z.ZodOptional<z.ZodEnum<["AUTO", "ABSOLUTE"]>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        mode: z.ZodOptional<z.ZodEnum<["NONE", "HORIZONTAL", "VERTICAL"]>>;
        width: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodLiteral<"FILL">, z.ZodLiteral<"HUG">]>>;
        height: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodLiteral<"FILL">, z.ZodLiteral<"HUG">]>>;
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
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            top: z.ZodOptional<z.ZodNumber>;
            right: z.ZodOptional<z.ZodNumber>;
            bottom: z.ZodOptional<z.ZodNumber>;
            left: z.ZodOptional<z.ZodNumber>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            top: z.ZodOptional<z.ZodNumber>;
            right: z.ZodOptional<z.ZodNumber>;
            bottom: z.ZodOptional<z.ZodNumber>;
            left: z.ZodOptional<z.ZodNumber>;
        }, z.ZodTypeAny, "passthrough">>>;
        positioning: z.ZodOptional<z.ZodEnum<["AUTO", "ABSOLUTE"]>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        mode: z.ZodOptional<z.ZodEnum<["NONE", "HORIZONTAL", "VERTICAL"]>>;
        width: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodLiteral<"FILL">, z.ZodLiteral<"HUG">]>>;
        height: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodLiteral<"FILL">, z.ZodLiteral<"HUG">]>>;
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
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            top: z.ZodOptional<z.ZodNumber>;
            right: z.ZodOptional<z.ZodNumber>;
            bottom: z.ZodOptional<z.ZodNumber>;
            left: z.ZodOptional<z.ZodNumber>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            top: z.ZodOptional<z.ZodNumber>;
            right: z.ZodOptional<z.ZodNumber>;
            bottom: z.ZodOptional<z.ZodNumber>;
            left: z.ZodOptional<z.ZodNumber>;
        }, z.ZodTypeAny, "passthrough">>>;
        positioning: z.ZodOptional<z.ZodEnum<["AUTO", "ABSOLUTE"]>>;
    }, z.ZodTypeAny, "passthrough">>>;
    styles: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
    textData: z.ZodOptional<z.ZodObject<{
        characters: z.ZodString;
        fontSize: z.ZodOptional<z.ZodNumber>;
        fontFamily: z.ZodOptional<z.ZodString>;
        segments: z.ZodOptional<z.ZodArray<z.ZodObject<{
            start: z.ZodNumber;
            end: z.ZodNumber;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            start: z.ZodNumber;
            end: z.ZodNumber;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            start: z.ZodNumber;
            end: z.ZodNumber;
        }, z.ZodTypeAny, "passthrough">>, "many">>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        characters: z.ZodString;
        fontSize: z.ZodOptional<z.ZodNumber>;
        fontFamily: z.ZodOptional<z.ZodString>;
        segments: z.ZodOptional<z.ZodArray<z.ZodObject<{
            start: z.ZodNumber;
            end: z.ZodNumber;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            start: z.ZodNumber;
            end: z.ZodNumber;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            start: z.ZodNumber;
            end: z.ZodNumber;
        }, z.ZodTypeAny, "passthrough">>, "many">>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        characters: z.ZodString;
        fontSize: z.ZodOptional<z.ZodNumber>;
        fontFamily: z.ZodOptional<z.ZodString>;
        segments: z.ZodOptional<z.ZodArray<z.ZodObject<{
            start: z.ZodNumber;
            end: z.ZodNumber;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            start: z.ZodNumber;
            end: z.ZodNumber;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            start: z.ZodNumber;
            end: z.ZodNumber;
        }, z.ZodTypeAny, "passthrough">>, "many">>;
    }, z.ZodTypeAny, "passthrough">>>;
    svgContent: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
    imageData: z.ZodOptional<z.ZodString>;
    children: z.ZodOptional<z.ZodArray<z.ZodUnknown, "many">>;
}, z.ZodTypeAny, "passthrough">>;
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
    tokens: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
    createAsComponent: z.ZodOptional<z.ZodBoolean>;
    board: z.ZodOptional<z.ZodBoolean>;
    clearPage: z.ZodOptional<z.ZodBoolean>;
    pageName: z.ZodOptional<z.ZodString>;
    sectionTitle: z.ZodOptional<z.ZodString>;
    source: z.ZodOptional<z.ZodObject<{
        url: z.ZodOptional<z.ZodString>;
        title: z.ZodOptional<z.ZodString>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        url: z.ZodOptional<z.ZodString>;
        title: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        url: z.ZodOptional<z.ZodString>;
        title: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">>>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    rootNode: z.ZodUnknown;
    tokens: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
    createAsComponent: z.ZodOptional<z.ZodBoolean>;
    board: z.ZodOptional<z.ZodBoolean>;
    clearPage: z.ZodOptional<z.ZodBoolean>;
    pageName: z.ZodOptional<z.ZodString>;
    sectionTitle: z.ZodOptional<z.ZodString>;
    source: z.ZodOptional<z.ZodObject<{
        url: z.ZodOptional<z.ZodString>;
        title: z.ZodOptional<z.ZodString>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        url: z.ZodOptional<z.ZodString>;
        title: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        url: z.ZodOptional<z.ZodString>;
        title: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">>>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    rootNode: z.ZodUnknown;
    tokens: z.ZodOptional<z.ZodObject<{}, "passthrough", z.ZodTypeAny, z.objectOutputType<{}, z.ZodTypeAny, "passthrough">, z.objectInputType<{}, z.ZodTypeAny, "passthrough">>>;
    createAsComponent: z.ZodOptional<z.ZodBoolean>;
    board: z.ZodOptional<z.ZodBoolean>;
    clearPage: z.ZodOptional<z.ZodBoolean>;
    pageName: z.ZodOptional<z.ZodString>;
    sectionTitle: z.ZodOptional<z.ZodString>;
    source: z.ZodOptional<z.ZodObject<{
        url: z.ZodOptional<z.ZodString>;
        title: z.ZodOptional<z.ZodString>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        url: z.ZodOptional<z.ZodString>;
        title: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        url: z.ZodOptional<z.ZodString>;
        title: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">>>;
}, z.ZodTypeAny, "passthrough">>;
/** Payload de RENDER_NODES completo: forma del sobre + árbol de nodos */
export declare function validateRenderPayload(payload: unknown): ValidationResult;
/** Sobre mínimo de cualquier mensaje del bus */
export declare const WSMessageEnvelopeSchema: z.ZodObject<{
    type: z.ZodString;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    type: z.ZodString;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    type: z.ZodString;
}, z.ZodTypeAny, "passthrough">>;
//# sourceMappingURL=schemas.d.ts.map