// Rutas de un sitio para el escaneo desde la extensión
import { describe, expect, it } from 'vitest';
import { collectSiteRoutes, parseSitemap, routePattern } from '../../packages/core-extractor/src/browser/site-routes';

const PAGE = 'https://app.ejemplo.com/inicio';
const paths = (links: { href: string; text?: string }[]) => collectSiteRoutes(links, PAGE);

describe('rutas del sitio', () => {
  it('solo el mismo origen, sin anclas ni archivos; la página actual primero', () => {
    const { routes } = paths([
      { href: '/precios', text: 'Precios' },
      { href: '/precios#planes' },
      { href: 'https://otro.com/x' },
      { href: 'mailto:hola@ejemplo.com' },
      { href: '/manual.pdf' },
      { href: '/logo.svg' },
      { href: 'https://app.ejemplo.com/equipo', text: 'Equipo' },
    ]);
    expect(routes.map(r => r.path)).toEqual(['/inicio', '/precios', '/equipo']);
    expect(routes[1].label).toBe('Precios');
  });

  it('enlaces que pueden ejecutar acciones con la sesión: excluidos y listados con el motivo', () => {
    const danger = [
      '/logout',
      '/cuenta/cerrar-sesion',
      '/api/user/delete?id=4',
      '/pedidos/7/cancelar',
      '/facturas/12/pagar',
      '/solicitudes/3/aprobar',
      '/newsletter/unsubscribe',
      '/salir',
      '/sign-out',
    ];
    const { routes, excluded } = paths(danger.map(href => ({ href })));
    expect(routes.map(r => r.path)).toEqual(['/inicio']);
    expect(excluded.map(e => e.path)).toEqual(danger);
    expect(excluded.every(e => /acción/.test(e.reason))).toBe(true);
  });

  it('URLs del mismo tipo se agrupan en una sola entrada (paginación, ids, fechas)', () => {
    const { routes } = paths([
      { href: '/blog/page/2' },
      { href: '/blog/page/3' },
      { href: '/blog/page/4' },
      { href: '/eventos?fecha=2026-11-01' },
      { href: '/eventos?fecha=2026-11-02' },
      { href: '/clientes/8f3a2c1e-1b2c-4d5e-8f9a-0b1c2d3e4f5a' },
      { href: '/clientes/1b2c3d4e-1b2c-4d5e-8f9a-0b1c2d3e4f5a' },
    ]);
    const blog = routes.find(r => r.path === '/blog/page/{n}')!;
    expect(blog.grouped).toBe(3);
    expect(routes.find(r => r.path.startsWith('/eventos'))!.grouped).toBe(2);
    expect(routes.find(r => r.path === '/clientes/{id}')!.grouped).toBe(2);
  });

  it('patrón y sitemap', () => {
    expect(routePattern(new URL('https://x.com/a/12/b?z=1&a=2'))).toBe('/a/{n}/b?a&z');
    expect(
      parseSitemap('<urlset><url><loc> https://x.com/a </loc></url><url><loc>https://x.com/b</loc></url></urlset>'),
    ).toEqual(['https://x.com/a', 'https://x.com/b']);
  });
});
