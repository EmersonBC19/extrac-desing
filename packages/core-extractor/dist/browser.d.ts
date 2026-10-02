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
export declare class BrowserExtractor {
    private browser;
    init(): Promise<void>;
    extractFromUrl(options: ExtractOptions): Promise<UINode>;
    close(): Promise<void>;
}
//# sourceMappingURL=browser.d.ts.map