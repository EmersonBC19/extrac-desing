import { type Page } from 'playwright';
import type { Logger, UINode } from '@code-to-figma/contracts';
export interface CrawlScreenResult {
    title: string;
    routeOrTab: string;
    rootNode: UINode;
    group?: string;
    routeKey?: string;
    variantType?: 'BASE' | 'TAB' | 'MODAL';
}
export interface CrawlOptions {
    baseUrl: string;
    routes?: string[];
    tabSelector?: string;
    contentSelector?: string;
    viewport?: {
        width: number;
        height: number;
    };
    maxScreens?: number;
    delayMs?: number;
    auth?: boolean;
    exploreTabs?: boolean;
    exploreModals?: boolean;
    onScreen?: (result: CrawlScreenResult, index: number, total: number) => Promise<void> | void;
    /** Destino de los mensajes de progreso. El servidor MCP pasa uno que escribe en stderr (stdout es su protocolo) */
    logger?: Logger;
}
export declare class SiteCrawler {
    private browser;
    init(headless?: boolean): Promise<void>;
    close(): Promise<void>;
    /**
     * Espera activa y estabilización profunda de la página:
     * 1. Red en reposo (networkidle)
     * 2. Desaparición total de loaders, skeletons, spinners
     * 3. Presencia de contenido real en el DOM (tablas, cards, formularios, textos)
     * 4. Carga completa de fuentes tipográficas
     * 5. Finalización de transiciones y animaciones CSS
     */
    waitForPageReady(page: Page, _timeoutMs?: number): Promise<void>;
    crawl(options: CrawlOptions): Promise<CrawlScreenResult[]>;
}
//# sourceMappingURL=crawler.d.ts.map