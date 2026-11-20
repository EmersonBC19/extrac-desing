import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { loadImageFetchPolicy } = require('../helpers/code-loaders.cjs');
const { imageFetchPolicy, isPrivateHost, siteOf } = loadImageFetchPolicy();

describe('imageFetchPolicy (background.js)', () => {
  it.each([
    ['imagen de otro dominio desde web pública → sin cookies', 'https://is1-ssl.mzstatic.com/a.jpg', 'https://www.apple.com/co/', true, false],
    ['mismo sitio → con cookies', 'https://www.apple.com/img.png', 'https://www.apple.com/co/', true, true],
    ['subdominio del mismo sitio → con cookies', 'https://cdn.apple.com/a.jpg', 'https://www.apple.com/co/', true, true],
    ['.com.co mismo sitio', 'https://static.empresa.com.co/a.png', 'https://www.empresa.com.co/', true, true],
    ['.com.co otro sitio → sin cookies', 'https://otra.com.co/a.png', 'https://www.empresa.com.co/', true, false],
    ['dashboard en localhost → sus imágenes', 'http://localhost:4210/assets/logo.png', 'http://localhost:4210/dashboard', true, true],
    ['intranet 10.x → imagen interna', 'http://10.1.2.3/logo.png', 'http://10.1.2.3/app', true, true],
    ['data URI', 'data:image/png;base64,AAAA', 'https://sitio.com/', true, false],
  ])('permite: %s', (_n, url, tab, _allowed, credentials) => {
    expect(imageFetchPolicy(url, tab)).toEqual({ allowed: true, credentials });
  });

  it.each([
    ['web pública → router', 'http://192.168.1.1/admin.png'],
    ['web pública → localhost', 'http://localhost:4210/api/x'],
    ['web pública → 10.x', 'http://10.0.0.5/a.png'],
    ['web pública → 172.16.x', 'http://172.20.0.1/a.png'],
    ['web pública → IPv6 local', 'http://[::1]/a.png'],
    ['web pública → *.local', 'http://nas.local/a.png'],
    ['web pública → metadatos cloud', 'http://169.254.169.254/latest/meta-data'],
    ['protocolo file:', 'file:///C:/secreto.png'],
    ['protocolo ftp:', 'ftp://x/a.png'],
    ['URL inválida', 'no es url'],
  ])('bloquea: %s', (_n, url) => {
    expect(imageFetchPolicy(url, 'https://sitio-publico.com/').allowed).toBe(false);
  });

  it('sin pestaña conocida, bloquea la red local', () => {
    expect(imageFetchPolicy('http://127.0.0.1/x.png', undefined).allowed).toBe(false);
  });

  it('isPrivateHost y siteOf', () => {
    expect(isPrivateHost('172.15.0.1')).toBe(false);
    expect(isPrivateHost('172.31.255.1')).toBe(true);
    expect(isPrivateHost('ejemplo.com')).toBe(false);
    expect(siteOf('a.b.empresa.co.uk')).toBe('empresa.co.uk');
    expect(siteOf('www.apple.com')).toBe('apple.com');
  });
});
