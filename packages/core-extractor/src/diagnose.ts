import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function diagnose() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  console.log('Cargando http://localhost:4210...');
  await page.goto('http://localhost:4210', { waitUntil: 'networkidle' });

  const artifactDir = path.resolve('scratch');
  if (!fs.existsSync(artifactDir)) fs.mkdirSync(artifactDir, { recursive: true });

  await page.screenshot({ path: path.join(artifactDir, 'page_screenshot.png') });
  console.log('Captura guardada en scratch/page_screenshot.png');

  const evalCode = `
    (() => {
      const left = document.querySelector('.wrapper-login-img') || document.querySelector('app-auth-mesh-background');
      const formLogin = document.querySelector('.form-login');
      const mfa = document.querySelector('.mfa-content');
      const reset = document.querySelector('.content-reset-password');

      function inspectEl(el) {
        if (!el) return null;
        const s = window.getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          display: s.display,
          visibility: s.visibility,
          opacity: s.opacity,
          position: s.position,
          left: r.left,
          top: r.top,
          width: r.width,
          height: r.height,
          bg: s.backgroundColor,
          bgImg: s.backgroundImage
        };
      }

      const allLinks = Array.from(document.querySelectorAll('a, button, [role="tab"]')).map(el => ({
        tag: el.tagName,
        text: el.textContent ? el.textContent.trim() : '',
        href: el.getAttribute('href'),
        role: el.getAttribute('role'),
        classes: el.className
      }));

      const logo = document.querySelector('.brand-logo');
      const logoDetails = logo ? {
        tagName: logo.tagName,
        html: logo.outerHTML,
        bgImg: window.getComputedStyle(logo).backgroundImage
      } : null;

      return {
        url: window.location.href,
        logoDetails,
        leftBox: inspectEl(left),
        formLoginBox: inspectEl(formLogin),
        mfaBox: inspectEl(mfa),
        resetBox: inspectEl(reset),
        linksCount: allLinks.length,
        sampleLinks: allLinks
      };
    })()
  `;

  const info = await page.evaluate(evalCode);
  console.log('Diagnóstico:', JSON.stringify(info, null, 2));
  await browser.close();
}

diagnose();
