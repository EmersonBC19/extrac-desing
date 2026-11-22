/**
 * Seguridad del WebSocket Hub (plan de mejoras, fase 1.1).
 *
 * Los navegadores permiten que CUALQUIER página web abra ws://localhost:8080. Sin estas
 * comprobaciones, un sitio malicioso podía dibujar en el Figma del usuario, leer lo que
 * se exporta y (vía REQUEST_VIEW_RENDER) ejecutar comandos en el equipo.
 *
 * Política por origen del handshake (el navegador no deja falsificar el header Origin):
 *  - sin Origin               → proceso local (CLI, MCP, crawler): confiable
 *  - chrome-extension://…     → service worker de la extensión: confiable
 *  - https://*.figma.com      → confiable
 *  - "null"                   → UI de plugin de Figma (iframe sin origen). Una página atacante
 *                               también puede producir "null" con un iframe sandbox, así que
 *                               exige CÓDIGO DE VINCULACIÓN
 *  - cualquier otro sitio web → rechazado
 */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
export function classifyOrigin(origin, allowedExtensionIds = []) {
    if (origin === undefined || origin === '')
        return 'local';
    if (origin === 'null')
        return 'needs-pairing';
    if (origin.startsWith('chrome-extension://')) {
        if (allowedExtensionIds.length === 0)
            return 'extension';
        const id = origin.slice('chrome-extension://'.length).replace(/\/.*$/, '');
        return allowedExtensionIds.includes(id) ? 'extension' : 'rejected';
    }
    try {
        const host = new URL(origin).hostname;
        if (host === 'figma.com' || host.endsWith('.figma.com'))
            return 'figma';
    }
    catch (_e) {
        return 'rejected';
    }
    return 'rejected';
}
// Sin caracteres ambiguos (0/O, 1/I/L) para que se pueda dictar o copiar a mano
const PAIRING_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function generatePairingCode() {
    const bytes = crypto.randomBytes(8);
    let s = '';
    for (let i = 0; i < 8; i++)
        s += PAIRING_ALPHABET[bytes[i] % PAIRING_ALPHABET.length];
    return `${s.slice(0, 4)}-${s.slice(4)}`;
}
export function normalizePairingCode(code) {
    return String(code || '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
}
/** Comparación en tiempo constante (no revela cuántos caracteres coinciden) */
export function pairingCodeMatches(expected, provided) {
    const a = Buffer.from(normalizePairingCode(expected));
    const b = Buffer.from(normalizePairingCode(provided));
    if (a.length !== b.length || a.length === 0)
        return false;
    return crypto.timingSafeEqual(a, b);
}
/**
 * Código persistente en ~/.code-to-figma/pairing-code: la vinculación se hace UNA vez
 * (el plugin lo guarda) y sobrevive a reinicios del hub.
 */
export function loadOrCreatePairingCode(dir = process.env.CTF_PAIRING_DIR || path.join(os.homedir(), '.code-to-figma')) {
    const file = path.join(dir, 'pairing-code');
    try {
        const existing = fs.readFileSync(file, 'utf-8').trim();
        if (normalizePairingCode(existing).length === 8)
            return { code: existing, file };
    }
    catch (_e) { }
    const code = generatePairingCode();
    try {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(file, code + '\n', { mode: 0o600 });
    }
    catch (_err) {
        // Si el entorno no permite escribir en el directorio de usuario (permisos restrictivos o sandbox),
        // se devuelve el código generado para la sesión en memoria sin abortar el proceso.
    }
    return { code, file };
}
/** Limita intentos fallidos de vinculación (fuerza bruta desde una página con origen "null") */
export class PairingRateLimiter {
    maxFailures;
    windowMs;
    failures = [];
    constructor(maxFailures = 5, windowMs = 60_000) {
        this.maxFailures = maxFailures;
        this.windowMs = windowMs;
    }
    isLocked(now = Date.now()) {
        this.failures = this.failures.filter(t => now - t < this.windowMs);
        return this.failures.length >= this.maxFailures;
    }
    recordFailure(now = Date.now()) {
        this.failures.push(now);
    }
}
/**
 * Devuelve la petición saneada o un mensaje de error. Solo se aceptan vistas del catálogo,
 * identificadores simples y rutas de URL; los argumentos van a execFile SIN shell.
 */
export function validateViewRenderRequest(payload, catalogIds) {
    const viewId = payload?.viewId;
    if (typeof viewId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(viewId))
        return 'viewId inválido';
    if (!catalogIds.includes(viewId))
        return `La vista "${viewId}" no está en el catálogo`;
    const route = payload?.route ?? '/administration/dashboard';
    if (typeof route !== 'string' || !/^\/[A-Za-z0-9_\-/]{0,200}$/.test(route))
        return 'route inválida';
    const clean = (v, fallback) => typeof v === 'string' ? v.replace(/[^\p{L}\p{N} _\-.·—]/gu, '').slice(0, 80) || fallback : fallback;
    return {
        viewId,
        route,
        name: clean(payload?.name, viewId),
        pageName: clean(payload?.pageName, viewId),
        useSeparatePage: payload?.useSeparatePage === true,
    };
}
//# sourceMappingURL=hub-security.js.map