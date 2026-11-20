/**
 * Design tokens desde variables CSS de :root.
 * Fuente única del extractor: se empaqueta en packages/browser-extension/extractor.js (scripts/build-extractor.mjs).
 */
// ── 21. Extractor Automático de Design Tokens (CSS Variables) ──
export function extractDesignTokens() {
  const colors = {};
  const radii = {};

  function parseTokenColor(str) {
    if (!str || str === 'transparent' || str === 'inherit' || str === 'initial') return null;
    str = str.trim();
    if (str.startsWith('#')) {
      let hex = str.slice(1);
      if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
      if (hex.length >= 6) {
        return {
          r: parseInt(hex.slice(0, 2), 16) / 255,
          g: parseInt(hex.slice(2, 4), 16) / 255,
          b: parseInt(hex.slice(4, 6), 16) / 255,
          a: hex.length >= 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1
        };
      }
    }
    if (str.startsWith('rgb')) {
      const nums = str.match(/[\d.]+/g);
      if (nums && nums.length >= 3) {
        return {
          r: parseFloat(nums[0]) / 255,
          g: parseFloat(nums[1]) / 255,
          b: parseFloat(nums[2]) / 255,
          a: nums[3] !== undefined ? parseFloat(nums[3]) : 1
        };
      }
    }
    return null;
  }

  try {
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules || []) as any[]) {
          if (rule.selectorText && (rule.selectorText === ':root' || rule.selectorText === 'html' || rule.selectorText === 'body' || rule.selectorText.includes(':root'))) {
            const st = rule.style;
            for (let i = 0; i < st.length; i++) {
              const prop = st[i];
              if (prop && prop.startsWith('--')) {
                const val = st.getPropertyValue(prop).trim();
                if (val.startsWith('#') || val.startsWith('rgb') || val.startsWith('hsl')) {
                  const parsed = parseTokenColor(val);
                  if (parsed) colors[prop] = parsed;
                } else if (val.endsWith('px') && prop.toLowerCase().includes('radius')) {
                  const r = parseFloat(val);
                  if (!isNaN(r)) radii[prop] = r;
                }
              }
            }
          }
        }
      } catch (_sheetErr) {}
    }
  } catch (_e) {}

  return { colors, radii };
}
