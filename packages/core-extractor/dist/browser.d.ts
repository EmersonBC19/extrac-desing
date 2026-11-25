import { type Page } from 'playwright';
import type { UINode } from '@code-to-figma/contracts';
export interface ExtractOptions {
    url?: string;
    htmlContent?: string;
    selector?: string;
    viewport?: {
        width: number;
        height: number;
    };
    waitForSelector?: string;
    timeout?: number;
}
export interface ExtractedBundle {
    rootNode: UINode;
    tokens?: Record<string, unknown>;
}
/** Convierte imágenes <img src="*.svg"> de la página en <svg> inline antes de extraer */
export declare function inlineSvgImages(page: Page): Promise<void>;
export declare class BrowserExtractor {
    private browser;
    init(): Promise<void>;
    extractBundleFromUrl(options: ExtractOptions): Promise<ExtractedBundle>;
    extractFromUrl(options: ExtractOptions): Promise<UINode>;
    close(): Promise<void>;
}
//# sourceMappingURL=browser.d.ts.map