/**
 * ⚠️ ARCHIVO GENERADO — no editar a mano.
 * Fuente: packages/core-extractor/src/browser/*.ts · Generar: npm run build:extractor
 *
 * Code to Figma — extractor de navegador: convierte un elemento del DOM renderizado en un árbol
 * UINode (layout ajustado a la geometría medida, texto enriquecido, imágenes, carruseles).
 */
(() => {
  // packages/core-extractor/src/browser/dom-helpers.ts
  var CLIPPING_OVERFLOW = /^(hidden|clip|auto|scroll)$/;
  function isCarouselSlide(el, rect, vpW) {
    if (Math.abs(rect.left) > vpW * 25) return false;
    let p = el.parentElement;
    while (p && p !== document.body && p !== document.documentElement) {
      const cs = window.getComputedStyle(p);
      if (CLIPPING_OVERFLOW.test(cs.overflowX)) return true;
      if (cs.position === "fixed") return false;
      p = p.parentElement;
    }
    return false;
  }
  function isCarouselTrack(el, rect, children) {
    if (children.length < 2) return false;
    let outside = 0;
    for (const ch of children) {
      const r = ch.getBoundingClientRect();
      if (r.width <= 0) continue;
      if (r.right <= rect.left + 2 || r.left >= rect.right - 2) outside++;
    }
    if (outside === 0) return false;
    let p = el;
    for (let i = 0; p && i < 6; i++, p = p.parentElement) {
      if (CLIPPING_OVERFLOW.test(window.getComputedStyle(p).overflowX)) return true;
    }
    return false;
  }
  function extractBgUrl(bgStr) {
    if (!bgStr || bgStr === "none" || !bgStr.includes("url(") && !/image-set\(/i.test(bgStr)) return null;
    if (/image-set\(/i.test(bgStr)) {
      const opts = [...bgStr.matchAll(/(?:url\(\s*['"]?([^'")]+)['"]?\s*\)|['"]([^'"]+)['"])\s*([\d.]+)x/gi)].map((m2) => ({
        url: m2[1] || m2[2],
        d: parseFloat(m2[3]) || 1
      }));
      if (opts.length) {
        opts.sort((a, b) => b.d - a.d);
        return opts[0].url;
      }
    }
    const m = bgStr.match(/url\(\s*(['"]?)(.*?)\1\s*\)/i);
    if (!m || !m[2]) return null;
    const u = m[2];
    if (/^data:image\/gif/i.test(u)) return null;
    return u;
  }
  function isVisuallyHidden(cs, rect) {
    if (cs.position !== "absolute" && cs.position !== "fixed") return false;
    if (rect.width <= 2 && rect.height <= 2) return true;
    const sy = cs.position === "fixed" ? 0 : window.scrollY;
    const sx = cs.position === "fixed" ? 0 : window.scrollX;
    if (rect.bottom + sy <= 0 || rect.right + sx <= 0) return true;
    const clip = cs.clip || "";
    const m = clip.match(/rect\(\s*([-\d.]+)px,?\s*([-\d.]+)px,?\s*([-\d.]+)px,?\s*([-\d.]+)px/);
    if (m) {
      const [top, right, bottom, left] = m.slice(1).map(parseFloat);
      if (right - left <= 1 || bottom - top <= 1) return true;
    }
    const cp = cs.clipPath || "";
    if (/inset\(\s*50%/.test(cp) || /99\.9%/.test(cp)) return true;
    return false;
  }
  function pseudoHasImage(el, pseudo) {
    try {
      const cs = window.getComputedStyle(el, pseudo);
      const c = cs.content;
      return !!(c && c !== "none" && c !== "normal" && cs.display !== "none" && extractBgUrl(cs.backgroundImage));
    } catch (_) {
      return false;
    }
  }
  function bgScaleMode(cs) {
    const size = (cs.backgroundSize || "").toLowerCase();
    if (size.includes("contain")) return "FIT";
    if (size.includes("cover")) return "FILL";
    const rep = (cs.backgroundRepeat || "").toLowerCase();
    if (rep && !rep.includes("no-repeat") && (size === "auto" || /\d+px/.test(size))) return "TILE";
    return "FILL";
  }
  function vpRectOf(rect) {
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  }
  function canvasPixels(el) {
    try {
      const probe = document.createElement("canvas");
      probe.width = probe.height = 12;
      const g = probe.getContext("2d");
      g.drawImage(el, 0, 0, 12, 12);
      const d = g.getImageData(0, 0, 12, 12).data;
      let a = 0;
      for (let i = 3; i < d.length; i += 4) a += d[i];
      return a > 0 ? el.toDataURL("image/png") : null;
    } catch (_) {
      return null;
    }
  }

  // packages/core-extractor/src/browser/text.ts
  var INLINE_SKIP = /^(script|style|noscript|template)$/;
  var INLINE_BLOCKERS = /^(img|picture|svg|video|canvas|iframe|input|select|textarea|button)$/;
  function isInlineTextRoot(el) {
    if (el.children.length === 0) return false;
    if (!(el.textContent || "").trim()) return false;
    const check = (node) => {
      for (const c of node.children) {
        const tag = c.localName;
        if (INLINE_SKIP.test(tag) || tag === "br" || tag === "wbr") continue;
        if (INLINE_BLOCKERS.test(tag) || c instanceof SVGElement) return false;
        const cs = window.getComputedStyle(c);
        if (cs.display === "none") continue;
        if (isVisuallyHidden(cs, c.getBoundingClientRect())) continue;
        if (cs.display !== "inline") return false;
        const bg = cs.backgroundColor;
        if (bg && bg !== "transparent" && !/rgba\([^)]*,\s*0\)$/.test(bg) || cs.backgroundImage !== "none")
          return false;
        if (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== "none") return false;
        if (!check(c)) return false;
      }
      return true;
    };
    return check(el);
  }
  function cssColorToRgba(str) {
    const m = (str || "").match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)/);
    if (!m) return null;
    const a = m[4] === void 0 ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return { r: +m[1] / 255, g: +m[2] / 255, b: +m[3] / 255, a };
  }
  var SUP_MAP = {
    "0": "⁰",
    "1": "¹",
    "2": "²",
    "3": "³",
    "4": "⁴",
    "5": "⁵",
    "6": "⁶",
    "7": "⁷",
    "8": "⁸",
    "9": "⁹",
    "+": "⁺",
    "-": "⁻",
    "=": "⁼",
    "(": "⁽",
    ")": "⁾",
    n: "ⁿ",
    i: "ⁱ"
  };
  var SUB_MAP = {
    "0": "₀",
    "1": "₁",
    "2": "₂",
    "3": "₃",
    "4": "₄",
    "5": "₅",
    "6": "₆",
    "7": "₇",
    "8": "₈",
    "9": "₉",
    "+": "₊",
    "-": "₋",
    "=": "₌",
    "(": "₍",
    ")": "₎"
  };
  function scriptPosition(el, root) {
    for (let e = el; e && e !== root.parentElement; e = e.parentElement) {
      const tag = e.localName;
      if (tag === "sup") return "SUPER";
      if (tag === "sub") return "SUB";
      const cs = window.getComputedStyle(e);
      if (cs.verticalAlign === "super") return "SUPER";
      if (cs.verticalAlign === "sub") return "SUB";
      if (cs.fontVariantPosition === "super") return "SUPER";
      if (cs.fontVariantPosition === "sub") return "SUB";
      const ffs = cs.fontFeatureSettings || "";
      if (/"(sups|numr)"/.test(ffs)) return "SUPER";
      if (/"(subs|sinf|dnom)"/.test(ffs)) return "SUB";
      if (e === root) break;
    }
    return null;
  }
  function applyTextTransform(ch, tt) {
    if (tt === "uppercase") return ch.toUpperCase();
    if (tt === "lowercase") return ch.toLowerCase();
    return ch;
  }
  function buildRichText(root, rootStyle) {
    const out = [];
    const charStyles = [];
    const rootRect = root.getBoundingClientRect();
    const rootFs = parseFloat(rootStyle.fontSize) || 16;
    const rootLh = parseFloat(rootStyle.lineHeight) || rootFs * 1.2;
    const clipsY = /^(hidden|clip)$/.test(rootStyle.overflowY) || rootStyle.webkitLineClamp && rootStyle.webkitLineClamp !== "none";
    const ellipsis = rootStyle.textOverflow === "ellipsis" || rootStyle.webkitLineClamp && rootStyle.webkitLineClamp !== "none";
    const range = document.createRange();
    const MAX_MEASURE = 4e3;
    let measured = 0;
    let measureOk = true;
    let lineCenter = null;
    let lastWasSpace = true;
    let truncated = false;
    let lines = 1;
    const styleKeyCache = /* @__PURE__ */ new Map();
    function styleFor(el) {
      if (styleKeyCache.has(el)) return styleKeyCache.get(el);
      const cs = window.getComputedStyle(el);
      const st = {
        fontFamily: (cs.fontFamily || "").split(",")[0].replace(/['"]/g, "").trim() || "Inter",
        fontWeight: cs.fontWeight || 400,
        fontSize: Math.round((parseFloat(cs.fontSize) || rootFs) * 10) / 10,
        italic: cs.fontStyle === "italic" || cs.fontStyle === "oblique",
        color: cssColorToRgba(cs.color),
        underline: (cs.textDecorationLine || "").includes("underline"),
        strike: (cs.textDecorationLine || "").includes("line-through"),
        baseline: scriptPosition(el, root),
        _tt: cs.textTransform,
        _ws: cs.whiteSpace
      };
      st.key = [
        st.fontFamily,
        st.fontWeight,
        st.fontSize,
        st.italic,
        st.color && [st.color.r, st.color.g, st.color.b, st.color.a].join(","),
        st.underline,
        st.strike,
        st.baseline
      ].join("|");
      styleKeyCache.set(el, st);
      return st;
    }
    function pushChar(ch, st) {
      out.push(ch);
      charStyles.push(st);
    }
    function newLine() {
      lines++;
      if (out.length && out[out.length - 1] === " ") {
        out[out.length - 1] = "\n";
      } else pushChar("\n", charStyles[charStyles.length - 1] || null);
      lastWasSpace = true;
    }
    function emitText(node) {
      const parent = node.parentElement || root;
      const st = styleFor(parent);
      const preserve = /^pre/.test(st._ws) || st._ws === "break-spaces";
      const data = node.data;
      for (let i = 0; i < data.length && !truncated; i++) {
        const ch = data[i];
        const isSpace = /\s/.test(ch);
        if (preserve && ch === "\n") {
          newLine();
          lineCenter = null;
          continue;
        }
        if (isSpace && !preserve) {
          if (lastWasSpace) continue;
          pushChar(" ", st);
          lastWasSpace = true;
          continue;
        }
        const prevOut = out.length ? out[out.length - 1] : " ";
        const isBreakOpportunity = i === 0 || lastWasSpace || /[-/–—]/.test(prevOut);
        if (measureOk && !isSpace && isBreakOpportunity && measured < MAX_MEASURE) {
          measured++;
          try {
            range.setStart(node, i);
            range.setEnd(node, i + 1);
            const r = range.getClientRects()[0];
            if (r && r.height > 0) {
              if (clipsY && r.top >= rootRect.bottom - 1) {
                truncated = true;
                break;
              }
              const c = r.top + r.height / 2;
              if (lineCenter !== null && c > lineCenter + rootLh * 0.5) newLine();
              lineCenter = c;
            }
          } catch (_e) {
            measureOk = false;
          }
        } else if (measured >= MAX_MEASURE) {
          measureOk = false;
        }
        let outCh = applyTextTransform(ch, st._tt);
        if (st.baseline === "SUPER" && SUP_MAP[outCh]) outCh = SUP_MAP[outCh];
        else if (st.baseline === "SUB" && SUB_MAP[outCh]) outCh = SUB_MAP[outCh];
        pushChar(outCh, st);
        lastWasSpace = false;
      }
    }
    (function walk(node) {
      for (const ch of node.childNodes) {
        if (truncated) return;
        if (ch.nodeType === Node.TEXT_NODE) {
          emitText(ch);
          continue;
        }
        if (ch.nodeType !== Node.ELEMENT_NODE) continue;
        const tag = ch.localName;
        if (INLINE_SKIP.test(tag)) continue;
        if (tag === "br") {
          newLine();
          lineCenter = null;
          continue;
        }
        const cs = window.getComputedStyle(ch);
        if (cs.display === "none" || cs.visibility === "hidden") continue;
        if (isVisuallyHidden(cs, ch.getBoundingClientRect())) continue;
        walk(ch);
      }
    })(root);
    let text = out.join("");
    const keep = [];
    for (let i = 0; i < out.length; i++) {
      const ch = out[i];
      if (ch === " " && (i === 0 || out[i - 1] === "\n" || i === out.length - 1 || out[i + 1] === "\n")) continue;
      keep.push(i);
    }
    const chars = keep.map((i) => out[i]);
    const styles = keep.map((i) => charStyles[i]);
    while (chars.length && chars[chars.length - 1] === "\n") {
      chars.pop();
      styles.pop();
    }
    while (chars.length && chars[0] === "\n") {
      chars.shift();
      styles.shift();
    }
    if (truncated && ellipsis && chars.length) {
      chars.push("…");
      styles.push(styles[styles.length - 1]);
    }
    text = chars.join("");
    lines = text.split("\n").length;
    const segments = [];
    for (let i = 0; i < styles.length; i++) {
      const st = styles[i] || styles[i - 1];
      if (!st) continue;
      const last = segments[segments.length - 1];
      if (last && last._key === st.key && last.end === i) {
        last.end = i + 1;
        continue;
      }
      segments.push({
        start: i,
        end: i + 1,
        _key: st.key,
        fontFamily: st.fontFamily,
        fontWeight: st.fontWeight,
        fontSize: st.fontSize,
        italic: st.italic || void 0,
        color: st.color || void 0,
        underline: st.underline || void 0,
        strike: st.strike || void 0,
        baseline: st.baseline || void 0
      });
    }
    segments.forEach((s) => delete s._key);
    return {
      characters: text,
      segments: segments.length > 1 ? segments : null,
      lines,
      linesPreserved: measureOk && measured > 0
    };
  }

  // packages/core-extractor/src/browser/geometry.ts
  function fitAutoLayoutToGeometry(node) {
    const L = node.layout;
    if (!L || L.mode !== "VERTICAL" && L.mode !== "HORIZONTAL") return;
    if (L.counterAxisAlignItems === "BASELINE") return;
    const W = L.measuredWidth;
    const H = L.measuredHeight;
    if (!(W > 0 && H > 0)) return;
    if (L.layoutWrap === "WRAP" && L.mode === "HORIZONTAL") {
      fitWrapToGeometry(node, W, H);
      return;
    }
    const dim = (c, horizontal) => {
      const m = horizontal ? c.layout.measuredWidth : c.layout.measuredHeight;
      if (typeof m === "number") return m;
      const n = horizontal ? c.layout.width : c.layout.height;
      return typeof n === "number" ? n : null;
    };
    const flow = (node.children || []).filter((c) => c.layout && c.layout.positioning !== "ABSOLUTE");
    if (flow.length === 0) return;
    const boxes = [];
    for (const c of flow) {
      const x = c.layout.x, y = c.layout.y, w = dim(c, true), h = dim(c, false);
      if (typeof x !== "number" || typeof y !== "number" || w == null || h == null) return;
      boxes.push({ x, y, w, h });
    }
    const V = L.mode === "VERTICAL";
    const main = (b) => V ? b.y : b.x;
    const mainSize = (b) => V ? b.h : b.w;
    const cross = (b) => V ? b.x : b.y;
    const crossSize = (b) => V ? b.w : b.h;
    const MAIN = V ? H : W;
    const CROSS = V ? W : H;
    const sorted = [...boxes].sort((a, b) => main(a) - main(b));
    const last = sorted[sorted.length - 1];
    const lead = main(sorted[0]);
    const trail = MAIN - (main(last) + mainSize(last));
    if (L.primaryAxisAlignItems === "SPACE_BETWEEN") {
      const P = L.padding || { top: 0, right: 0, bottom: 0, left: 0 };
      const pStart = V ? P.top : P.left;
      const pEnd = V ? P.bottom : P.right;
      const sum = sorted.reduce((a, b) => a + mainSize(b), 0);
      const step = sorted.length > 1 ? (MAIN - pStart - pEnd - sum) / (sorted.length - 1) : 0;
      let cur = pStart, ok = step >= 0;
      for (const b of sorted) {
        if (Math.abs(main(b) - cur) > 2) {
          ok = false;
          break;
        }
        cur += mainSize(b) + step;
      }
      const cStart = V ? P.left : P.top;
      const cEnd = V ? W - P.right : H - P.bottom;
      const ca = L.counterAxisAlignItems || "MIN";
      if (ok)
        ok = boxes.every((b) => {
          const exp = ca === "CENTER" ? cStart + (cEnd - cStart - crossSize(b)) / 2 : ca === "MAX" ? cEnd - crossSize(b) : cStart;
          return Math.abs(cross(b) - exp) <= 2 || Math.abs(crossSize(b) - (cEnd - cStart)) <= 2;
        });
      if (ok) return;
    }
    const gaps = [];
    for (let i = 1; i < sorted.length; i++) gaps.push(main(sorted[i]) - (main(sorted[i - 1]) + mainSize(sorted[i - 1])));
    if (gaps.length && (Math.max(...gaps) - Math.min(...gaps) > 2 || Math.min(...gaps) < -1)) {
      L.mode = "NONE";
      return;
    }
    if (lead < -1 || trail < -1) {
      L.mode = "NONE";
      return;
    }
    const before = boxes.map(cross);
    const after = boxes.map((b) => CROSS - (cross(b) + crossSize(b)));
    const same = (arr) => Math.max(...arr) - Math.min(...arr) <= 1.5;
    let counter, padBefore, padAfter;
    if (boxes.every((_, i) => Math.abs(before[i] - after[i]) <= 2)) {
      counter = "CENTER";
      padBefore = padAfter = Math.min(...before);
    } else if (same(before)) {
      counter = "MIN";
      padBefore = before[0];
      padAfter = Math.min(...after);
    } else if (same(after)) {
      counter = "MAX";
      padAfter = after[0];
      padBefore = Math.min(...before);
    } else {
      L.mode = "NONE";
      return;
    }
    if (padBefore < -1 || padAfter < -1) {
      L.mode = "NONE";
      return;
    }
    const r = (v) => Math.max(0, Math.round(v));
    const available = CROSS - padBefore - padAfter;
    const crossProp = V ? "width" : "height";
    flow.forEach((c, i) => {
      if (c.layout[crossProp] === "FILL" && Math.abs(crossSize(boxes[i]) - available) > 2) {
        c.layout[crossProp] = Math.round(crossSize(boxes[i]));
      }
    });
    L.primaryAxisAlignItems = "MIN";
    L.counterAxisAlignItems = counter;
    if (gaps.length) L.itemSpacing = r(gaps.reduce((a, b) => a + b, 0) / gaps.length);
    L.padding = V ? { top: r(lead), bottom: r(trail), left: r(padBefore), right: r(padAfter) } : { left: r(lead), right: r(trail), top: r(padBefore), bottom: r(padAfter) };
  }
  function fitWrapToGeometry(node, W, H) {
    const L = node.layout;
    const kids = (node.children || []).filter((c) => c.layout && c.layout.positioning !== "ABSOLUTE");
    const sz = (c, h) => {
      const m = h ? c.layout.measuredWidth : c.layout.measuredHeight;
      if (typeof m === "number") return m;
      const v = h ? c.layout.width : c.layout.height;
      return typeof v === "number" ? v : null;
    };
    if (!kids.length || kids.some(
      (c) => typeof c.layout.x !== "number" || typeof c.layout.y !== "number" || sz(c, true) == null || sz(c, false) == null
    ))
      return;
    const rows = [];
    for (const c of [...kids].sort((a, b) => a.layout.y - b.layout.y || a.layout.x - b.layout.x)) {
      const row = rows.find((r2) => Math.abs(r2.y - c.layout.y) <= 2);
      if (row) row.items.push(c);
      else rows.push({ y: c.layout.y, items: [c] });
    }
    rows.forEach((r2) => r2.items.sort((a, b) => a.layout.x - b.layout.x));
    const abs = (node.children || []).filter((c) => !kids.includes(c));
    node.children = rows.flatMap((r2) => r2.items).concat(abs);
    if (rows.length === 1) {
      L.layoutWrap = "NO_WRAP";
      fitAutoLayoutToGeometry(node);
      return;
    }
    const gaps = [];
    for (const r2 of rows)
      for (let i = 1; i < r2.items.length; i++) {
        const a = r2.items[i - 1], b = r2.items[i];
        gaps.push(b.layout.x - (a.layout.x + sz(a, true)));
      }
    const rowGaps = [];
    for (let i = 1; i < rows.length; i++) {
      const prevBottom = Math.max(...rows[i - 1].items.map((c) => c.layout.y + sz(c, false)));
      rowGaps.push(rows[i].y - prevBottom);
    }
    const uniform = (arr) => !arr.length || Math.max(...arr) - Math.min(...arr) <= 2;
    const starts = rows.map((r2) => r2.items[0].layout.x);
    if (!uniform(gaps) || !uniform(rowGaps) || !uniform(starts) || Math.min(...rowGaps) < -1 || gaps.length && Math.min(...gaps) < -1) {
      L.mode = "NONE";
      return;
    }
    const r = (v) => Math.max(0, Math.round(v));
    const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const top = rows[0].y;
    const lastRowBottom = Math.max(...rows[rows.length - 1].items.map((c) => c.layout.y + sz(c, false)));
    const maxRight = Math.max(...kids.map((c) => c.layout.x + sz(c, true)));
    L.primaryAxisAlignItems = "MIN";
    L.counterAxisAlignItems = "MIN";
    if (gaps.length) L.itemSpacing = r(avg(gaps));
    L.counterAxisSpacing = r(avg(rowGaps));
    L.padding = { left: r(starts[0]), top: r(top), right: r(W - maxRight), bottom: r(H - lastRowBottom) };
  }
  function pseudoPosition(element, ps, w, h) {
    const es = window.getComputedStyle(element);
    if (es.position === "static") return null;
    const er = element.getBoundingClientRect();
    const bl = parseFloat(es.borderLeftWidth) || 0, bt = parseFloat(es.borderTopWidth) || 0;
    const br = parseFloat(es.borderRightWidth) || 0, bb = parseFloat(es.borderBottomWidth) || 0;
    const px = (v) => v && v.endsWith("px") ? parseFloat(v) : null;
    let x = null, y = null;
    const left = px(ps.left), right = px(ps.right), top = px(ps.top), bottom = px(ps.bottom);
    if (left !== null) x = bl + left;
    else if (right !== null) x = er.width - br - right - w;
    if (top !== null) y = bt + top;
    else if (bottom !== null) y = er.height - bb - bottom - h;
    const m = (ps.transform || "").match(/^matrix\(([^)]+)\)$/);
    if (m) {
      const k = m[1].split(",").map(parseFloat);
      if (x !== null) x += k[4] || 0;
      if (y !== null) y += k[5] || 0;
    }
    if (x === null || y === null) return null;
    return { x: Math.round(x), y: Math.round(y) };
  }

  // packages/core-extractor/src/browser/extract-node.ts
  function extractNodeTree(element, counter = { id: 0 }, parentRect = null, parentLayout = null) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return null;
    const tagName = element.tagName.toLowerCase();
    if (["script", "style", "noscript", "template", "link", "meta", "title", "head"].includes(tagName)) {
      return null;
    }
    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || parseFloat(style.opacity) === 0) {
      return null;
    }
    const rect = element.getBoundingClientRect();
    if (parentRect !== null && isVisuallyHidden(style, rect)) return null;
    const vpW = window.innerWidth || 1440;
    const vpH = window.innerHeight || 900;
    const isRoot = parentRect === null;
    const isWholePage = isRoot && (element === document.body || element === document.documentElement || tagName === "body");
    const isZeroClipped = rect.height <= 0.5 && (style.overflow === "hidden" || style.overflowY === "hidden") && (style.maxHeight === "0px" || style.height === "0px");
    if (isZeroClipped) return null;
    const margin = element.children.length === 0 ? 150 : 300;
    const isOffscreenX = rect.left >= vpW + margin || rect.right <= -margin;
    if (parentRect !== null && isOffscreenX) {
      if (!isCarouselSlide(element, rect, vpW)) return null;
      counter.hasCarouselSlides = true;
    }
    if (element.children.length === 0) {
      const hasText = !!(element.textContent && element.textContent.trim());
      const isReplaced = /^(img|picture|svg|video|canvas|iframe|input|textarea|select|hr)$/.test(tagName);
      const hasPseudo = ["::before", "::after"].some((p) => {
        const c = window.getComputedStyle(element, p).content;
        return c && c !== "none" && c !== "normal";
      });
      if (!hasText && !isReplaced && !hasPseudo && (rect.width <= 0.5 || rect.height <= 0.5)) return null;
      if (parentRect !== null && rect.top - parentRect.top >= 12e3) return null;
    }
    const currentId = "node_" + ++counter.id;
    const relX = parentRect ? Math.round(rect.left - parentRect.left) : 0;
    let relY = parentRect ? Math.round(rect.top - parentRect.top) : 0;
    if (parentRect && (style.position === "fixed" || style.position === "sticky") && window.scrollY > 0) {
      const parentEl = element.parentElement;
      const parentFixed = parentEl && window.getComputedStyle(parentEl).position === "fixed";
      const parentDocTop = parentRect.top + window.scrollY;
      if (!parentFixed && (style.position === "fixed" || parentDocTop <= 1)) {
        relY = Math.round(rect.top - parentDocTop);
      }
    }
    function splitCssList(str) {
      if (!str) return [];
      const parts = [];
      let depth = 0;
      let current = "";
      for (let i = 0; i < str.length; i++) {
        const char = str[i];
        if (char === "(") depth++;
        else if (char === ")") depth--;
        if (char === "," && depth === 0) {
          if (current.trim()) parts.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      if (current.trim()) parts.push(current.trim());
      return parts;
    }
    let _sharedCanvas = null;
    let _sharedCtx = null;
    function parseColor(str, fallbackColor = null) {
      if (!str || str === "transparent" || str === "inherit" || str === "initial") return null;
      str = str.trim();
      if (str.toLowerCase() === "currentcolor") {
        return fallbackColor ? parseColor(fallbackColor) : null;
      }
      if (str.startsWith("rgb")) {
        const open = str.indexOf("(");
        const close = str.lastIndexOf(")");
        if (open > -1 && close > open) {
          const parts = str.slice(open + 1, close).split(/[, /]+/).map((s) => s.trim()).filter(Boolean);
          if (parts.length >= 3) {
            const r = Math.max(0, Math.min(255, parseFloat(parts[0]))) / 255;
            const g = Math.max(0, Math.min(255, parseFloat(parts[1]))) / 255;
            const b = Math.max(0, Math.min(255, parseFloat(parts[2]))) / 255;
            let a = 1;
            if (parts.length >= 4) {
              a = parts[3].endsWith("%") ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
            }
            return { r, g, b, a: Math.max(0, Math.min(1, a)) };
          }
        }
      }
      if (str.startsWith("#")) {
        let h = str.slice(1);
        if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        else if (h.length === 4) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
        if (h.length === 6) {
          return {
            r: parseInt(h.slice(0, 2), 16) / 255,
            g: parseInt(h.slice(2, 4), 16) / 255,
            b: parseInt(h.slice(4, 6), 16) / 255,
            a: 1
          };
        }
        if (h.length === 8) {
          return {
            r: parseInt(h.slice(0, 2), 16) / 255,
            g: parseInt(h.slice(2, 4), 16) / 255,
            b: parseInt(h.slice(4, 6), 16) / 255,
            a: parseInt(h.slice(6, 8), 16) / 255
          };
        }
      }
      try {
        if (!_sharedCanvas) {
          _sharedCanvas = document.createElement("canvas");
          _sharedCanvas.width = 1;
          _sharedCanvas.height = 1;
          _sharedCtx = _sharedCanvas.getContext("2d", { willReadFrequently: true });
        }
        if (_sharedCtx) {
          _sharedCtx.clearRect(0, 0, 1, 1);
          _sharedCtx.fillStyle = str;
          _sharedCtx.fillRect(0, 0, 1, 1);
          const d = _sharedCtx.getImageData(0, 0, 1, 1).data;
          if (d[3] === 0) return null;
          return { r: d[0] / 255, g: d[1] / 255, b: d[2] / 255, a: d[3] / 255 };
        }
      } catch (_e) {
      }
      return null;
    }
    function parseGradient(bgStr) {
      if (!bgStr || !bgStr.includes("gradient")) return null;
      const radMatch = bgStr.match(/radial-gradient\((.*)\)/i);
      if (radMatch) {
        const inner2 = radMatch[1];
        let stopsStr2 = inner2;
        const firstComma2 = inner2.indexOf(",");
        if (firstComma2 > -1 && (inner2.includes("circle") || inner2.includes("ellipse") || inner2.includes("at"))) {
          stopsStr2 = inner2.slice(firstComma2 + 1).trim();
        }
        const rawStops2 = splitCssList(stopsStr2);
        const stops2 = [];
        for (let i = 0; i < rawStops2.length; i++) {
          const stopPart = rawStops2[i];
          const colorMatch = stopPart.match(/(rgba?\([^)]+\)|#[a-f0-9]+|[a-z]+)/i);
          if (!colorMatch) continue;
          const col = parseColor(colorMatch[0]);
          if (!col) continue;
          let pos = i / Math.max(1, rawStops2.length - 1);
          const posMatch = stopPart.replace(colorMatch[0], "").trim().match(/([\d.]+)%/);
          if (posMatch) {
            pos = parseFloat(posMatch[1]) / 100;
          }
          stops2.push({ position: Math.max(0, Math.min(1, pos)), color: col });
        }
        if (stops2.length >= 2) {
          return { type: "GRADIENT_RADIAL", stops: stops2 };
        }
      }
      const linMatch = bgStr.match(/linear-gradient\((.*)\)/i);
      if (!linMatch) return null;
      const inner = linMatch[1];
      let angle = 180;
      let stopsStr = inner;
      const firstComma = inner.indexOf(",");
      if (firstComma > -1) {
        const firstToken = inner.slice(0, firstComma).trim().toLowerCase();
        if (firstToken.includes("deg")) {
          angle = parseFloat(firstToken) || 180;
          stopsStr = inner.slice(firstComma + 1).trim();
        } else if (firstToken === "to top") {
          angle = 0;
          stopsStr = inner.slice(firstComma + 1).trim();
        } else if (firstToken === "to right") {
          angle = 90;
          stopsStr = inner.slice(firstComma + 1).trim();
        } else if (firstToken === "to bottom") {
          angle = 180;
          stopsStr = inner.slice(firstComma + 1).trim();
        } else if (firstToken === "to left") {
          angle = 270;
          stopsStr = inner.slice(firstComma + 1).trim();
        }
      }
      const rawStops = splitCssList(stopsStr);
      const stops = [];
      for (let i = 0; i < rawStops.length; i++) {
        const stopPart = rawStops[i];
        const colorMatch = stopPart.match(/(rgba?\([^)]+\)|#[a-f0-9]+|[a-z]+)/i);
        if (!colorMatch) continue;
        const col = parseColor(colorMatch[0]);
        if (!col) continue;
        let pos = i / Math.max(1, rawStops.length - 1);
        const posMatch = stopPart.replace(colorMatch[0], "").trim().match(/([\d.]+)%/);
        if (posMatch) {
          pos = parseFloat(posMatch[1]) / 100;
        }
        stops.push({ position: Math.max(0, Math.min(1, pos)), color: col });
      }
      if (stops.length >= 2) {
        return { type: "GRADIENT_LINEAR", angle, stops };
      }
      return null;
    }
    function parseBoxShadow(shadowStr) {
      if (!shadowStr || shadowStr === "none") return [];
      const shadows = [];
      const parts = splitCssList(shadowStr);
      for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const colorMatch = trimmed.match(/(rgba?\([^)]+\)|#[a-f0-9]+)/i);
        const color = colorMatch ? parseColor(colorMatch[1]) : { r: 0, g: 0, b: 0, a: 0.15 };
        const cleanLength = trimmed.replace(/(rgba?\([^)]+\)|#[a-f0-9]+)/i, "").trim();
        const lengths = cleanLength.split(/\s+/).map((l) => parseFloat(l) || 0);
        if (lengths.length >= 2 && color) {
          shadows.push({
            color,
            offset: { x: lengths[0], y: lengths[1] },
            radius: lengths[2] || 0,
            spread: lengths[3] || 0
          });
        }
      }
      return shadows;
    }
    function extractPseudoElement(element2, pseudo, parentRect2, parentLayout2, counter2) {
      try {
        const style2 = window.getComputedStyle(element2, pseudo);
        const content = style2.content;
        const hasContent = content && content !== "none" && content !== "normal" && content !== '""' && content !== "''";
        if (style2.display === "none") return null;
        const bg = parseColor(style2.backgroundColor);
        const w = parseFloat(style2.width) || 0;
        const h = parseFloat(style2.height) || 0;
        const bgUrl = extractBgUrl(style2.backgroundImage);
        const hasBgGrad = !!parseGradient(style2.backgroundImage);
        const isRendered = content && content !== "none" && content !== "normal";
        if (bgUrl && isRendered && w > 0 && h > 0) {
          const isAbs = style2.position === "absolute" || style2.position === "fixed";
          const pNode = {
            id: "pseudo_" + ++counter2.id,
            name: pseudo === "::before" ? "Image / Before" : "Image / After",
            type: "FRAME",
            layout: {
              mode: "NONE",
              padding: { top: 0, right: 0, bottom: 0, left: 0 },
              itemSpacing: 0,
              width: Math.round(w),
              height: Math.round(h),
              positioning: isAbs ? "ABSOLUTE" : "AUTO",
              ...isAbs ? pseudoPosition(element2, style2, w, h) || {} : {}
            },
            styles: {
              fills: bg && bg.a > 0.01 ? [bg] : [],
              cornerRadius: parseFloat(style2.borderRadius) || 0,
              imageScaleMode: bgScaleMode(style2)
            },
            children: []
          };
          pNode._pendingBgImageSrc = bgUrl;
          return pNode;
        }
        if (!hasContent) {
          if ((!bg || bg.a <= 0.05) && !hasBgGrad) return null;
          if (w <= 0 || h <= 0) return null;
        }
        const rawText = (content || "").replace(/^['"]|['"]$/g, "").trim();
        const tc = parseColor(style2.color) || { r: 0.1, g: 0.1, b: 0.1, a: 1 };
        const isPosAbs = style2.position === "absolute" || style2.position === "fixed";
        const br = parseFloat(style2.borderRadius) || 0;
        if (rawText.length > 0) {
          return {
            id: "pseudo_" + ++counter2.id,
            name: pseudo === "::before" ? "Pseudo / Before" : "Pseudo / After",
            type: "TEXT",
            layout: {
              mode: "NONE",
              padding: { top: 0, right: 0, bottom: 0, left: 0 },
              itemSpacing: 0,
              width: "HUG",
              height: "HUG",
              positioning: isPosAbs ? "ABSOLUTE" : "AUTO"
            },
            styles: { fills: [tc] },
            textData: {
              characters: rawText,
              fontSize: Math.round(parseFloat(style2.fontSize) || 14),
              fontWeight: style2.fontWeight || 400,
              fontFamily: style2.fontFamily ? style2.fontFamily.split(",")[0].replace(/['"]/g, "").trim() : "Inter"
            }
          };
        } else if (w > 0 && h > 0 && (bg && bg.a > 0.05 || hasBgGrad)) {
          const decoFills = hasBgGrad ? [parseGradient(style2.backgroundImage)] : [bg];
          return {
            id: "pseudo_" + ++counter2.id,
            name: pseudo === "::before" ? "Decorator / Before" : "Decorator / After",
            type: "FRAME",
            layout: {
              mode: "NONE",
              padding: { top: 0, right: 0, bottom: 0, left: 0 },
              itemSpacing: 0,
              width: Math.round(w),
              height: Math.round(h),
              positioning: isPosAbs ? "ABSOLUTE" : "AUTO",
              ...isPosAbs ? pseudoPosition(element2, style2, w, h) || {} : {}
            },
            styles: {
              fills: decoFills,
              cornerRadius: br > 0 ? br : 0
            },
            children: []
          };
        }
      } catch (_e) {
      }
      return null;
    }
    function getSemanticName(el, tag, st, r) {
      const customName = el.getAttribute("data-component-name") || el.getAttribute("data-testid");
      if (customName) return customName;
      if (tag === "svg") {
        const label = el.getAttribute("aria-label") || el.getAttribute("data-icon");
        if (label) return "Icon / " + label;
        const p = el.parentElement;
        if (p) {
          const pIcon = p.getAttribute("name") || p.getAttribute("icon") || p.getAttribute("data-icon") || p.getAttribute("fontIcon");
          if (pIcon) return "Icon / " + pIcon.replace(/^hero|^mat-/, "");
          const pClass = p.className || "";
          if (typeof pClass === "string") {
            if (pClass.includes("return") || pClass.includes("back")) return "Icon / ArrowLeft";
            if (pClass.includes("eye") || pClass.includes("password")) return "Icon / Eye";
            if (pClass.includes("close")) return "Icon / Close";
            if (pClass.includes("lock")) return "Icon / Lock";
          }
        }
        return "Icon / Svg";
      }
      const isBtn = tag === "button" || el.getAttribute("role") === "button" || el.className && typeof el.className === "string" && el.className.includes("btn");
      if (isBtn) {
        const btnText = el.textContent?.trim() || el.getAttribute("aria-label") || "";
        const isIconBtn = r.width <= 48 && r.height <= 48 && el.querySelector("svg, i, ng-icon");
        const bg = parseColor(st.backgroundColor);
        const isPrimary = bg && bg.a > 0.5 && (bg.r < 0.3 || bg.b > 0.4);
        const variant = isIconBtn ? "Icon" : isPrimary ? "Primary" : "Secondary";
        return "Button / " + variant + (btnText ? " (" + btnText.slice(0, 16) + ")" : "");
      }
      if (tag === "input") {
        const type = el.type || "text";
        let labelText = "";
        const parentWrap = el.closest(".mb-4, .form-group, .input-group, div");
        if (parentWrap) {
          const lbl = parentWrap.querySelector("label");
          if (lbl) labelText = lbl.textContent?.trim() || "";
        }
        const typeLabel = type === "password" ? "Password" : type === "email" ? "Email" : "Text";
        return "Input / " + typeLabel + (labelText ? " (" + labelText.slice(0, 15) + ")" : "");
      }
      if (tag === "select") return "Select / Dropdown";
      if (tag === "textarea") return "Input / Textarea";
      if (tag === "label") return "Label / " + (el.textContent?.trim().slice(0, 15) || "Text");
      const childrenList = Array.from(el.children);
      const hasDirectLabel = childrenList.some((c) => c.tagName.toLowerCase() === "label");
      const hasDirectInput = childrenList.some(
        (c) => ["input", "select", "textarea"].includes(c.tagName.toLowerCase()) || c.querySelector("input, select, textarea")
      );
      if (hasDirectLabel && hasDirectInput && childrenList.length <= 4) {
        const lbl = el.querySelector("label")?.textContent?.trim();
        return "Input Group" + (lbl ? " (" + lbl.slice(0, 15) + ")" : "");
      }
      if (tag === "body") return document.title ? document.title.replace(/[-|].*$/, "").trim() : "Screen / View";
      if (tag === "h1") return "Heading 1 / " + (el.textContent?.trim().slice(0, 15) || "");
      if (tag === "h2") return "Heading 2 / " + (el.textContent?.trim().slice(0, 15) || "");
      if (tag === "h3") return "Heading 3 / " + (el.textContent?.trim().slice(0, 15) || "");
      if (tag === "h4") return "Heading 4 / " + (el.textContent?.trim().slice(0, 15) || "");
      if (tag === "p") return "Text / Paragraph";
      if (tag === "a") return "Link / " + (el.textContent?.trim().slice(0, 15) || "Anchor");
      const isCard = el.className && typeof el.className === "string" && el.className.includes("card") || tag === "article";
      if (isCard) return "Card / Container";
      if (tag === "nav" || el.getAttribute("role") === "navigation") return "Navigation / Bar";
      if (tag === "aside" || el.className && typeof el.className === "string" && el.className.includes("sidebar"))
        return "Sidebar";
      if (tag === "header" || el.className && typeof el.className === "string" && el.className.includes("header"))
        return "Header / Navbar";
      if (tag === "form") return "Form / Container";
      const rawClass = typeof el.className === "string" ? el.className.trim() : "";
      if (rawClass) {
        const cleanClasses = rawClass.split(/\\s+/).filter((c) => {
          return !/^(mb-|mt-|ml-|mr-|p-|px-|py-|w-|h-|flex|grid|block|inline|relative|absolute|text-|bg-|border-|rounded-|ng-|mat-|cursor-|transition-|duration-|hover:|focus:)/.test(
            c
          );
        });
        if (cleanClasses.length > 0) {
          const c0 = cleanClasses[0];
          return c0.charAt(0).toUpperCase() + c0.slice(1);
        }
      }
      return tag.charAt(0).toUpperCase() + tag.slice(1);
    }
    if (tagName === "svg") {
      const svgClone = element.cloneNode(true);
      const cc = parseColor(style.color) || { r: 0.2, g: 0.25, b: 0.35, a: 1 };
      const ccHex = "#" + Math.round(cc.r * 255).toString(16).padStart(2, "0") + Math.round(cc.g * 255).toString(16).padStart(2, "0") + Math.round(cc.b * 255).toString(16).padStart(2, "0");
      const svgCompStyle = window.getComputedStyle(element);
      const svgHasStroke = svgCompStyle.stroke && svgCompStyle.stroke !== "none" || element.getAttribute("stroke") !== null;
      const origVectors = element.querySelectorAll("path, circle, rect, polygon, line, ellipse");
      const cloneVectors = svgClone.querySelectorAll("path, circle, rect, polygon, line, ellipse");
      for (let vi = 0; vi < origVectors.length; vi++) {
        const ov = origVectors[vi];
        const cv = cloneVectors[vi];
        if (!cv) continue;
        const vs = window.getComputedStyle(ov);
        const dAttr = ov.getAttribute("d") || "";
        if (dAttr.includes("0 0h24v24H0z") || dAttr.includes("0 0h24v24") || vs.fill === "none" && vs.stroke === "none") {
          cv.setAttribute("fill", "none");
          cv.setAttribute("stroke", "none");
          continue;
        }
        const vStroke = vs.stroke;
        const hasStroke = vStroke && vStroke !== "none" || svgHasStroke;
        const vFill = vs.fill;
        if (vFill && vFill !== "none") {
          if (hasStroke) {
            const explicitFill = ov.getAttribute("fill");
            if (!explicitFill || explicitFill === "none" || explicitFill === "transparent") {
              cv.setAttribute("fill", "none");
            } else {
              const pf = parseColor(explicitFill, style.color) || parseColor(vFill, style.color) || cc;
              const fHex = "#" + Math.round(pf.r * 255).toString(16).padStart(2, "0") + Math.round(pf.g * 255).toString(16).padStart(2, "0") + Math.round(pf.b * 255).toString(16).padStart(2, "0");
              cv.setAttribute("fill", fHex);
              if (pf.a < 1) cv.setAttribute("fill-opacity", String(pf.a));
            }
          } else {
            const pf = parseColor(vFill, style.color) || cc;
            const fHex = "#" + Math.round(pf.r * 255).toString(16).padStart(2, "0") + Math.round(pf.g * 255).toString(16).padStart(2, "0") + Math.round(pf.b * 255).toString(16).padStart(2, "0");
            cv.setAttribute("fill", fHex);
            if (pf.a < 1) cv.setAttribute("fill-opacity", String(pf.a));
          }
        } else {
          cv.setAttribute("fill", "none");
        }
        if (hasStroke) {
          const strokeColorStr = vStroke && vStroke !== "none" ? vStroke : svgCompStyle.stroke && svgCompStyle.stroke !== "none" ? svgCompStyle.stroke : style.color;
          const ps = parseColor(strokeColorStr, style.color) || cc;
          const sHex = "#" + Math.round(ps.r * 255).toString(16).padStart(2, "0") + Math.round(ps.g * 255).toString(16).padStart(2, "0") + Math.round(ps.b * 255).toString(16).padStart(2, "0");
          cv.setAttribute("stroke", sHex);
          if (ps.a < 1) cv.setAttribute("stroke-opacity", String(ps.a));
          cv.setAttribute(
            "stroke-width",
            vs.strokeWidth && vs.strokeWidth !== "0px" ? vs.strokeWidth : svgCompStyle.strokeWidth || "2"
          );
          cv.setAttribute("stroke-linecap", vs.strokeLinecap || "round");
          cv.setAttribute("stroke-linejoin", vs.strokeLinejoin || "round");
        }
      }
      let w = Math.max(1, Math.round(rect.width) || 24);
      let h = Math.max(1, Math.round(rect.height) || 24);
      if (Math.abs(w - h) <= 6 && Math.min(w, h) >= 14) {
        const squareSize = Math.min(w, h);
        w = squareSize;
        h = squareSize;
      }
      let raw = svgClone.outerHTML;
      raw = raw.replace(/currentColor/gi, ccHex);
      raw = raw.replace(/var\(--[a-zA-Z0-9_-]+,\s*([^)]+)\)/g, "$1");
      raw = raw.replace(/style="[^"]*"/gi, "");
      if (!/viewBox/i.test(raw)) raw = raw.replace("<svg", '<svg viewBox="0 0 ' + w + " " + h + '"');
      if (!/width=/i.test(raw)) raw = raw.replace("<svg", '<svg width="' + w + '"');
      if (!/height=/i.test(raw)) raw = raw.replace("<svg", '<svg height="' + h + '"');
      raw = raw.replace(/\\s+(ng-reflect-[a-z-]+|_ng[a-z]+-[a-z0-9-]+|data-mat-icon-[a-z]+|class)="[^"]*"/gi, "");
      return {
        id: currentId,
        name: getSemanticName(element, tagName, style, rect),
        type: "SVG",
        layout: {
          mode: "NONE",
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          itemSpacing: 0,
          width: w,
          height: h,
          x: relX,
          y: relY
        },
        styles: { fills: [] },
        svgContent: raw
      };
    }
    if (tagName === "canvas" || tagName === "video" || tagName === "iframe" || tagName === "embed" || tagName === "object") {
      const mediaNode = {
        id: currentId,
        name: tagName === "canvas" ? "Chart / Canvas" : tagName === "video" ? "Video / " + (element.getAttribute("aria-label") || element.getAttribute("title") || "Media") : "Embed / " + (element.getAttribute("title") || tagName),
        type: "FRAME",
        layout: {
          mode: "NONE",
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          itemSpacing: 0,
          width: Math.round(rect.width) || 300,
          height: Math.round(rect.height) || 150,
          x: relX,
          y: relY,
          positioning: style.position === "absolute" || style.position === "fixed" ? "ABSOLUTE" : "AUTO"
        },
        styles: {
          fills: [],
          cornerRadius: parseFloat(style.borderRadius) || 0,
          imageScaleMode: style.objectFit === "contain" ? "FIT" : "FILL"
        },
        children: []
      };
      mediaNode._vpRect = vpRectOf(rect);
      if (tagName === "canvas") {
        const px = canvasPixels(element);
        if (px) mediaNode.imageData = px;
        else mediaNode._needsShot = true;
      } else if (tagName === "video") {
        let frame = null;
        if (element.readyState >= 2 && element.videoWidth) {
          try {
            const c = document.createElement("canvas");
            c.width = element.videoWidth;
            c.height = element.videoHeight;
            c.getContext("2d").drawImage(element, 0, 0);
            frame = c.toDataURL("image/jpeg", 0.88);
          } catch (_e) {
            frame = null;
          }
        }
        if (frame) mediaNode.imageData = frame;
        else {
          const poster = element.getAttribute("poster") || element.getAttribute("data-poster");
          if (poster) mediaNode._pendingImageSrc = new URL(poster, location.href).href;
          mediaNode._needsShot = true;
        }
      } else {
        mediaNode._needsShot = true;
        mediaNode.styles.fills = [{ r: 0.945, g: 0.949, b: 0.957, a: 1 }];
      }
      return mediaNode;
    }
    if (tagName === "img" || tagName === "picture") {
      let addSrcset = function(srcsetString) {
        if (!srcsetString || srcsetString.includes("data:image/gif")) return;
        const parts = srcsetString.split(",").map((s) => s.trim());
        for (const p of parts) {
          const [u, desc] = p.split(/\s+/);
          if (!u || u.startsWith("data:image/gif")) continue;
          let density = 1;
          let width = 0;
          if (desc) {
            if (desc.endsWith("x")) density = parseFloat(desc) || 1;
            if (desc.endsWith("w")) width = parseInt(desc, 10) || 0;
          }
          candidates.push({ url: u, density, width });
        }
      };
      let pendingSrc = null;
      let altText = "";
      const imgEl = tagName === "img" ? element : element.querySelector("img");
      const picEl = tagName === "picture" ? element : element.closest("picture");
      if (imgEl) {
        altText = imgEl.getAttribute("alt") || "";
      }
      const candidates = [];
      if (picEl) {
        const sources = Array.from(picEl.querySelectorAll("source"));
        const matchingSources = sources.filter((s) => {
          const media = s.getAttribute("media");
          if (!media) return true;
          try {
            return window.matchMedia(media).matches;
          } catch (_e) {
            return false;
          }
        });
        const activeSource = matchingSources.length > 0 ? matchingSources[0] : null;
        if (activeSource) {
          addSrcset(activeSource.getAttribute("srcset") || activeSource.srcset);
        } else {
          const desktopSource = sources.find((s) => {
            const m = (s.getAttribute("media") || "").toLowerCase();
            return m.includes("min-width") || !m.includes("max-width: 734") && !m.includes("max-width: 640") && !m.includes("small");
          });
          if (desktopSource) {
            addSrcset(desktopSource.getAttribute("srcset") || desktopSource.srcset);
          } else {
            for (const s of sources) {
              addSrcset(s.getAttribute("srcset") || s.srcset);
            }
          }
        }
      }
      if (imgEl) {
        addSrcset(imgEl.getAttribute("srcset") || imgEl.srcset);
      }
      if (imgEl) {
        const hiResAttrs = [
          "data-highres",
          "data-original",
          "data-src-retina",
          "data-retina",
          "data-large",
          "data-desktop-src",
          "data-src-desktop",
          "data-full-src",
          "data-src",
          "data-lazy-src"
        ];
        for (const attr of hiResAttrs) {
          const val = imgEl.getAttribute(attr);
          if (val && !val.startsWith("data:image/gif")) {
            candidates.push({ url: val, density: 2, width: 2500 });
          }
        }
      }
      if (imgEl) {
        if (imgEl.currentSrc && !imgEl.currentSrc.startsWith("data:image/gif")) {
          candidates.push({ url: imgEl.currentSrc, density: 1.5, width: imgEl.naturalWidth || 1e3 });
        }
        if (imgEl.src && !imgEl.src.startsWith("data:image/gif")) {
          candidates.push({ url: imgEl.src, density: 1, width: imgEl.naturalWidth || 800 });
        }
      }
      if (candidates.length > 0) {
        candidates.sort((a, b) => {
          const aIs2x = /(@2x|_2x|_large|_largetall|retina|highres)/i.test(a.url) ? 1 : 0;
          const bIs2x = /(@2x|_2x|_large|_largetall|retina|highres)/i.test(b.url) ? 1 : 0;
          const aIsSmall = /(_small|_thumb|mobile)/i.test(a.url) ? -1 : 0;
          const bIsSmall = /(_small|_thumb|mobile)/i.test(b.url) ? -1 : 0;
          const aScore = a.density * 10 + aIs2x * 5 + aIsSmall * 10;
          const bScore = b.density * 10 + bIs2x * 5 + bIsSmall * 10;
          if (bScore !== aScore) return bScore - aScore;
          if (b.width !== a.width) return b.width - a.width;
          return 0;
        });
        pendingSrc = candidates[0].url;
      }
      if (pendingSrc) {
        if (pendingSrc.startsWith("//")) pendingSrc = window.location.protocol + pendingSrc;
        else if (pendingSrc.startsWith("/")) pendingSrc = window.location.origin + pendingSrc;
      }
      let boxRect = rect;
      if (imgEl && picEl) {
        const pRect = picEl.getBoundingClientRect();
        const iRect = imgEl.getBoundingClientRect();
        const fitsInside = iRect.width <= pRect.width + 1 && iRect.height <= pRect.height + 1;
        boxRect = fitsInside && iRect.width > 0 && iRect.height > 0 ? iRect : pRect;
      }
      let imgW = Math.round(boxRect.width);
      let imgH = Math.round(boxRect.height);
      const boxRelX = parentRect ? Math.round(boxRect.left - parentRect.left) : 0;
      const boxRelY = parentRect ? Math.round(boxRect.top - parentRect.top) : 0;
      const imgFitStyle = imgEl ? window.getComputedStyle(imgEl) : style;
      if (imgW <= 1 && imgEl && imgEl.naturalWidth > 1) imgW = imgEl.naturalWidth;
      if (imgH <= 1 && imgEl && imgEl.naturalHeight > 1) imgH = imgEl.naturalHeight;
      if (imgW <= 0) imgW = 40;
      if (imgH <= 0) imgH = 40;
      const imgNode = {
        id: currentId,
        name: "Image / " + (altText || (tagName === "picture" ? "Picture" : "Img")),
        type: "FRAME",
        layout: {
          mode: "NONE",
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          itemSpacing: 0,
          width: imgW,
          height: imgH,
          measuredWidth: imgW,
          measuredHeight: imgH,
          x: boxRelX,
          y: boxRelY,
          positioning: style.position === "absolute" || style.position === "fixed" ? "ABSOLUTE" : "AUTO"
        },
        styles: {
          fills: [],
          cornerRadius: parseFloat(imgFitStyle.borderRadius) || parseFloat(style.borderRadius) || 0,
          imageScaleMode: imgFitStyle.objectFit === "contain" || imgFitStyle.objectFit === "scale-down" ? "FIT" : "FILL"
        },
        children: []
      };
      if (pendingSrc) {
        imgNode._pendingImageSrc = pendingSrc;
      }
      imgNode._vpRect = vpRectOf(boxRect);
      return imgNode;
    }
    const fills = [];
    const grad = parseGradient(style.backgroundImage);
    const pendingBgSrc = extractBgUrl(style.backgroundImage);
    const bgColor = parseColor(style.backgroundColor);
    if (bgColor && bgColor.a > 0.01) fills.push(bgColor);
    if (grad) fills.push(grad);
    const topW = Math.round(parseFloat(style.borderTopWidth) || 0);
    const rightBW = Math.round(parseFloat(style.borderRightWidth) || 0);
    const bottomW = Math.round(parseFloat(style.borderBottomWidth) || 0);
    const leftBW = Math.round(parseFloat(style.borderLeftWidth) || 0);
    const hasBorder = topW > 0 && style.borderTopStyle !== "none" || rightBW > 0 && style.borderRightStyle !== "none" || bottomW > 0 && style.borderBottomStyle !== "none" || leftBW > 0 && style.borderLeftStyle !== "none";
    const strokeColor = parseColor(style.borderTopColor, style.color) || parseColor(style.borderBottomColor, style.color) || parseColor(style.borderLeftColor, style.color) || parseColor(style.borderRightColor, style.color);
    const strokes = [];
    let borderSides = void 0;
    const maxBW = Math.max(topW, rightBW, bottomW, leftBW);
    if (hasBorder && strokeColor && strokeColor.a > 0.01) {
      strokes.push({ ...strokeColor, width: maxBW || 1, align: "INSIDE" });
      if (topW !== rightBW || topW !== bottomW || topW !== leftBW) {
        borderSides = { top: topW, right: rightBW, bottom: bottomW, left: leftBW };
      }
    }
    const rtl = parseFloat(style.borderTopLeftRadius) || 0;
    const rtr = parseFloat(style.borderTopRightRadius) || 0;
    const rbr = parseFloat(style.borderBottomRightRadius) || 0;
    const rbl = parseFloat(style.borderBottomLeftRadius) || 0;
    const cornerRadius = rtl === rtr && rtr === rbr && rbr === rbl ? rtl : [rtl, rtr, rbr, rbl];
    const boxShadow = parseBoxShadow(style.boxShadow);
    let backdropBlur = void 0;
    const bFilter = style.backdropFilter || style.webkitBackdropFilter || "";
    if (bFilter && bFilter.includes("blur(")) {
      const m = bFilter.match(/blur\(([^)]+)\)/);
      if (m && m[1]) {
        const v = parseFloat(m[1]);
        if (!isNaN(v) && v > 0) backdropBlur = Math.round(v);
      }
    }
    const padding = {
      top: Math.round(parseFloat(style.paddingTop) || 0),
      right: Math.round(parseFloat(style.paddingRight) || 0),
      bottom: Math.round(parseFloat(style.paddingBottom) || 0),
      left: Math.round(parseFloat(style.paddingLeft) || 0)
    };
    let mode = "NONE";
    let itemSpacing = 0;
    let primaryAlign = "MIN";
    let counterAlign = "MIN";
    let layoutWrap = "NO_WRAP";
    if (style.display.includes("flex")) {
      mode = style.flexDirection.includes("column") ? "VERTICAL" : "HORIZONTAL";
      itemSpacing = Math.round(parseFloat(style.gap || style.rowGap || style.columnGap) || 0);
      const jc = style.justifyContent;
      if (jc.includes("center")) primaryAlign = "CENTER";
      else if (jc.includes("space-between")) primaryAlign = "SPACE_BETWEEN";
      else if (jc.includes("end")) primaryAlign = "MAX";
      const ai = style.alignItems;
      if (ai.includes("center")) counterAlign = "CENTER";
      else if (ai.includes("end")) counterAlign = "MAX";
      else if (ai.includes("baseline")) counterAlign = "BASELINE";
      if (style.flexWrap === "wrap") layoutWrap = "WRAP";
    } else if (style.display.includes("grid")) {
      const hasAreas = style.gridTemplateAreas && style.gridTemplateAreas !== "none";
      const rows = (style.gridTemplateRows || "").split(/\s+/).filter(Boolean);
      const cols = (style.gridTemplateColumns || "").split(/\s+/).filter(Boolean);
      if (hasAreas || rows.length > 1 && cols.length > 1) {
        mode = "NONE";
      } else if (cols.length <= 1) {
        mode = "VERTICAL";
        itemSpacing = Math.round(parseFloat(style.rowGap || style.gap) || 0);
      } else {
        mode = "HORIZONTAL";
        layoutWrap = "NO_WRAP";
        itemSpacing = Math.round(parseFloat(style.columnGap || style.gap) || 0);
      }
    } else if (tagName === "button" || element.getAttribute("role") === "button" || element.className && typeof element.className === "string" && element.className.includes("btn")) {
      mode = "HORIZONTAL";
      primaryAlign = "CENTER";
      counterAlign = "CENTER";
      itemSpacing = Math.round(parseFloat(style.gap) || 8);
    } else if (tagName === "input" || tagName === "select") {
      mode = "HORIZONTAL";
      counterAlign = "CENTER";
    } else if (tagName === "tr" || style.display === "table-row") {
      mode = "HORIZONTAL";
      itemSpacing = 8;
      counterAlign = "CENTER";
    } else if (["tbody", "table", "thead", "tfoot"].includes(tagName) || style.display.includes("table")) {
      mode = "VERTICAL";
    } else if (style.display === "block" || style.display === "flow-root" || ["form", "section", "article", "fieldset"].includes(tagName)) {
      if (element.children.length >= 2) {
        mode = "VERTICAL";
        itemSpacing = Math.round(parseFloat(style.gap) || 0);
      }
    }
    const visibleChildren = Array.from(element.children).filter((ch) => {
      const cs = window.getComputedStyle(ch);
      return cs.display !== "none" && cs.visibility !== "hidden" && parseFloat(cs.opacity) > 0;
    });
    if (visibleChildren.length >= 2 && !isWholePage) {
      let hasSignificantOverlap = false;
      for (let i = 0; i < visibleChildren.length; i++) {
        for (let j = i + 1; j < visibleChildren.length; j++) {
          const ra = visibleChildren[i].getBoundingClientRect();
          const rb = visibleChildren[j].getBoundingClientRect();
          const ox = Math.max(0, Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left));
          const oy = Math.max(0, Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top));
          const overlapArea = ox * oy;
          const minArea = Math.min(ra.width * ra.height, rb.width * rb.height);
          if (minArea > 0 && overlapArea / minArea > 0.35) {
            hasSignificantOverlap = true;
            break;
          }
        }
        if (hasSignificantOverlap) break;
      }
      const isTrack = !hasSignificantOverlap && isCarouselTrack(element, rect, visibleChildren);
      if (isTrack) {
        mode = "NONE";
      } else if (hasSignificantOverlap) {
        mode = "NONE";
      } else {
        const inFlowChildren = visibleChildren.filter((ch) => {
          const cs = window.getComputedStyle(ch);
          return cs.position !== "absolute" && cs.position !== "fixed";
        });
        if (inFlowChildren.length >= 2) {
          const rects = inFlowChildren.map((ch) => ch.getBoundingClientRect()).filter((r) => r.width > 0 || r.height > 0);
          const TOL = 4;
          const byTop = [...rects].sort((a, b) => a.top - b.top);
          const byLeft = [...rects].sort((a, b) => a.left - b.left);
          let isVerticalStack = rects.length >= 2;
          let isHorizontalStack = rects.length >= 2;
          for (let i = 0; i < rects.length - 1; i++) {
            if (byTop[i + 1].top < byTop[i].top + 8) isVerticalStack = false;
            const a = byLeft[i], b = byLeft[i + 1];
            const shareRow = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > TOL;
            if (b.left < a.left + 8 || !shareRow) isHorizontalStack = false;
          }
          if (isVerticalStack && !isHorizontalStack) {
            mode = "VERTICAL";
            const measuredGap = Math.round(byTop[1].top - byTop[0].bottom);
            if (measuredGap >= 0 && measuredGap < 150) itemSpacing = measuredGap;
          } else if (isHorizontalStack && !isVerticalStack) {
            mode = "HORIZONTAL";
            const measuredGap = Math.round(byLeft[1].left - byLeft[0].right);
            if (measuredGap >= 0 && measuredGap < 150) itemSpacing = measuredGap;
          } else if (!isVerticalStack && !isHorizontalStack && layoutWrap !== "WRAP" && rects.length >= 2) {
            mode = "NONE";
          }
        } else if (inFlowChildren.length === 1) {
          if (style.justifyContent.includes("center") || style.alignItems.includes("center") || style.textAlign.includes("center")) {
            primaryAlign = "CENTER";
            counterAlign = "CENTER";
          }
        }
      }
      if (style.textAlign.includes("center") || style.alignItems.includes("center") || style.justifyContent.includes("center")) {
        counterAlign = "CENTER";
      }
    }
    const cName = (typeof element.className === "string" ? element.className : "").toLowerCase();
    const idAttr = (typeof element.id === "string" ? element.id : "").toLowerCase();
    const isSearchContainer = cName.includes("search") || idAttr.includes("search");
    const isLayoutShell = isWholePage || ["body", "app-root", "router-outlet"].includes(tagName) && isRoot;
    if (isLayoutShell) {
      mode = "NONE";
    }
    const semanticName = getSemanticName(element, tagName, style, rect);
    const isDirectText = element.textContent && element.textContent.trim().length > 0 && (element.children.length === 0 || isInlineTextRoot(element));
    const rich = isDirectText && !["input", "textarea", "select"].includes(tagName) ? buildRichText(element, style) : null;
    if (isDirectText && rich && rich.characters && !fills.length && !strokes.length && !pendingBgSrc && padding.top === 0 && padding.bottom === 0 && tagName !== "input" && tagName !== "textarea" && tagName !== "select" && !pseudoHasImage(element, "::before") && !pseudoHasImage(element, "::after")) {
      const tc = parseColor(style.color) || { r: 0.1, g: 0.1, b: 0.1, a: 1 };
      const rawText = rich.characters;
      let textAlign = "LEFT";
      if (style.textAlign.includes("center")) textAlign = "CENTER";
      else if (style.textAlign.includes("right")) textAlign = "RIGHT";
      else if (style.textAlign.includes("justify")) textAlign = "JUSTIFIED";
      const measuredW2 = Math.round(rect.width);
      const measuredH2 = Math.round(rect.height);
      const fontSize = parseFloat(style.fontSize) || 14;
      let parsedLineHeight = void 0;
      if (style.lineHeight && style.lineHeight !== "normal") {
        const lhVal = parseFloat(style.lineHeight);
        if (!isNaN(lhVal)) {
          parsedLineHeight = style.lineHeight.endsWith("px") ? Math.round(lhVal) : Math.round(lhVal * fontSize);
        }
      }
      const effLineHeight = parsedLineHeight || Math.round(fontSize * 1.3);
      const isMultiline = rich.lines > 1 || measuredH2 > effLineHeight * 1.35 || rawText.includes("\n");
      let parsedLetterSpacing = void 0;
      if (style.letterSpacing && style.letterSpacing !== "normal") {
        const lsVal = parseFloat(style.letterSpacing);
        if (!isNaN(lsVal) && Math.abs(lsVal) > 5e-3) {
          parsedLetterSpacing = Math.round(lsVal * 1e3) / 1e3;
        }
      }
      let textWidth = "HUG";
      const isBlockTag = [
        "p",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "blockquote",
        "li",
        "div",
        "section",
        "article"
      ].includes(tagName);
      const isParentVertical = parentLayout && parentLayout.mode === "VERTICAL";
      const isParentHorizontal = parentLayout && parentLayout.mode === "HORIZONTAL";
      if (isParentVertical) {
        if (isMultiline || isBlockTag || parentRect && Math.abs(measuredW2 - parentRect.width) <= 24) {
          textWidth = "FILL";
        }
      } else if (!isParentHorizontal && isMultiline && measuredW2 > 0) {
        textWidth = measuredW2;
      }
      const cleanFontFamily = style.fontFamily ? style.fontFamily.split(",")[0].replace(/['"]/g, "").trim() : "Inter";
      return {
        id: currentId,
        name: semanticName,
        type: "TEXT",
        layout: {
          mode: "NONE",
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          itemSpacing: 0,
          width: textWidth,
          height: isMultiline ? "HUG" : measuredH2 > 0 ? measuredH2 : "HUG",
          measuredWidth: measuredW2,
          measuredHeight: measuredH2,
          x: relX,
          y: relY
        },
        styles: { fills: [tc] },
        textData: {
          characters: rawText,
          fontSize: Math.round(fontSize),
          fontWeight: style.fontWeight || 400,
          fontFamily: cleanFontFamily,
          lineHeight: parsedLineHeight,
          letterSpacing: parsedLetterSpacing,
          textAlign,
          isMultiline,
          // Saltos de línea medidos en el navegador: Figma no debe re-acomodar el texto
          noWrap: rich.linesPreserved || void 0,
          lineCount: rich.lines,
          segments: rich.segments || void 0
        }
      };
    }
    const measuredW = Math.round(rect.width);
    const measuredH = Math.round(rect.height);
    let initialWidth;
    let initialHeight;
    if (isWholePage) {
      const docH = Math.max(
        measuredH,
        document.documentElement.scrollHeight || 0,
        document.body ? document.body.scrollHeight : 0
      );
      initialWidth = measuredW > 0 ? measuredW : vpW || 1440;
      initialHeight = docH > 0 ? Math.round(docH) : vpH || 900;
    } else if (isRoot) {
      initialWidth = measuredW > 0 ? measuredW : "HUG";
      initialHeight = mode !== "NONE" && element.children.length > 0 ? "HUG" : measuredH > 0 ? measuredH : "HUG";
    } else {
      initialWidth = measuredW;
      initialHeight = measuredH > 0 ? measuredH : "HUG";
    }
    const isBadge = typeof element.className === "string" && (element.className.includes("badge") || element.className.includes("pill") || element.className.includes("role") || element.className.includes("tag")) || parseFloat(style.borderRadius) >= 12 && measuredH <= 32 && measuredW < 200;
    if (parentLayout && parentLayout.mode === "VERTICAL" && parentRect) {
      const parentContentW = parentRect.width - (parentLayout.padding?.left || 0) - (parentLayout.padding?.right || 0);
      if (!isBadge && (Math.abs(measuredW - parentContentW) <= 8 || style.width === "100%" || style.display === "block" && Math.abs(measuredW - parentContentW) <= 16)) {
        initialWidth = "FILL";
      }
    }
    if (isBadge) {
      initialWidth = "HUG";
      initialHeight = measuredH > 0 ? measuredH : "HUG";
      if (mode === "NONE") {
        mode = "HORIZONTAL";
        primaryAlign = "CENTER";
        counterAlign = "CENTER";
      }
    }
    const isSearchOrFullWidth = initialWidth === "FILL" || parentRect && Math.abs(
      measuredW - (parentRect.width - (parentLayout?.padding?.left || 0) - (parentLayout?.padding?.right || 0))
    ) <= 8 || typeof element.className === "string" && element.className.includes("search");
    if ((tagName === "button" || semanticName.startsWith("Button") || semanticName.startsWith("Badge") || isBadge) && !isSearchOrFullWidth && !style.width?.includes("%") && measuredW < 250) {
      initialWidth = "HUG";
    }
    if (isRoot && fills.length === 0) {
      let cur = element.parentElement;
      let inheritedBg = null;
      let inheritedGrad = null;
      while (cur && cur !== document.documentElement) {
        const cs = window.getComputedStyle(cur);
        const g = parseGradient(cs.backgroundImage);
        if (g) {
          inheritedGrad = g;
          break;
        }
        const c = parseColor(cs.backgroundColor);
        if (c && c.a > 0.05) {
          inheritedBg = c;
          break;
        }
        cur = cur.parentElement;
      }
      if (!inheritedBg && !inheritedGrad && document.body) {
        const cs = window.getComputedStyle(document.body);
        const g = parseGradient(cs.backgroundImage);
        if (g) inheritedGrad = g;
        else {
          const c = parseColor(cs.backgroundColor);
          if (c && c.a > 0.05) inheritedBg = c;
        }
      }
      if (!inheritedBg && !inheritedGrad && document.documentElement) {
        const cs = window.getComputedStyle(document.documentElement);
        const g = parseGradient(cs.backgroundImage);
        if (g) inheritedGrad = g;
        else {
          const c = parseColor(cs.backgroundColor);
          if (c && c.a > 0.05) inheritedBg = c;
        }
      }
      if (inheritedGrad) {
        fills.push(inheritedGrad);
      } else {
        fills.push(inheritedBg || { r: 1, g: 1, b: 1, a: 1 });
      }
    }
    const currentLayout = {
      mode,
      primaryAxisAlignItems: primaryAlign,
      counterAxisAlignItems: counterAlign,
      padding,
      itemSpacing,
      width: initialWidth,
      height: initialHeight,
      measuredWidth: Math.round(rect.width),
      measuredHeight: isWholePage && typeof initialHeight === "number" ? initialHeight : Math.round(rect.height),
      positioning: style.position === "absolute" || style.position === "fixed" ? "ABSOLUTE" : "AUTO",
      layoutWrap,
      x: relX,
      y: relY
    };
    const node = {
      id: currentId,
      name: semanticName,
      type: "FRAME",
      layout: currentLayout,
      styles: {
        fills,
        strokes,
        borderSides,
        cornerRadius,
        opacity: parseFloat(style.opacity) || 1,
        boxShadow,
        backdropBlur
      },
      children: [],
      clipsContent: isWholePage || CLIPPING_OVERFLOW.test(style.overflowX) || CLIPPING_OVERFLOW.test(style.overflowY) ? true : void 0
    };
    if (pendingBgSrc) {
      node._pendingBgImageSrc = pendingBgSrc;
      node.styles.imageScaleMode = bgScaleMode(style);
      node._vpRect = vpRectOf(rect);
    }
    if (element.children.length === 0) {
      let txt = (element.textContent || "").trim();
      if (style.textTransform === "uppercase") txt = txt.toUpperCase();
      if (tagName === "input" || tagName === "textarea") {
        let val = element.value || element.placeholder || "";
        let isPlaceholder = !element.value;
        if (!val) {
          if (element.type === "password") {
            val = "••••••••";
            isPlaceholder = false;
          } else {
            const pWrap = element.closest(".mb-4, .form-group, div");
            const lbl = pWrap?.querySelector("label")?.textContent?.trim();
            if (lbl) {
              val = "Ingresar " + lbl.toLowerCase();
            } else if (element.type === "email") {
              val = "correo@ejemplo.com";
            } else {
              val = "Escribe aquí...";
            }
            isPlaceholder = true;
          }
        }
        const tc = isPlaceholder ? { r: 0.6, g: 0.65, b: 0.7, a: 1 } : parseColor(style.color) || { r: 0.15, g: 0.2, b: 0.25, a: 1 };
        node.children.push({
          id: currentId + "_val",
          name: isPlaceholder ? "Placeholder / " + val : "Value / " + val.slice(0, 15),
          type: "TEXT",
          layout: {
            mode: "NONE",
            padding: { top: 0, right: 0, bottom: 0, left: 0 },
            itemSpacing: 0,
            width: "HUG",
            height: "HUG",
            x: padding.left || 12,
            y: 0
          },
          styles: { fills: [tc] },
          textData: {
            characters: val,
            fontSize: Math.round(parseFloat(style.fontSize) || 14),
            fontWeight: 400,
            fontFamily: style.fontFamily ? style.fontFamily.split(",")[0].replace(/['"]/g, "").trim() : "Inter"
          }
        });
      } else if (tagName === "select") {
        const selTxt = element.options && element.selectedIndex >= 0 && element.options[element.selectedIndex] ? element.options[element.selectedIndex].text.trim() : "Seleccionar...";
        const tc = parseColor(style.color) || { r: 0.2, g: 0.25, b: 0.3, a: 1 };
        node.children.push({
          id: currentId + "_sel",
          name: "Selected / " + selTxt,
          type: "TEXT",
          layout: {
            mode: "NONE",
            padding: { top: 0, right: 0, bottom: 0, left: 0 },
            itemSpacing: 0,
            width: "FILL",
            height: "HUG",
            x: padding.left || 12,
            y: 0
          },
          styles: { fills: [tc] },
          textData: {
            characters: selTxt,
            fontSize: Math.round(parseFloat(style.fontSize) || 14),
            fontWeight: 400,
            fontFamily: "Inter"
          }
        });
        node.children.push({
          id: currentId + "_chevron",
          name: "Icon / ChevronDown",
          type: "SVG",
          layout: {
            mode: "NONE",
            padding: { top: 0, right: 0, bottom: 0, left: 0 },
            itemSpacing: 0,
            width: 16,
            height: 16,
            x: 0,
            y: 0
          },
          styles: { fills: [] },
          svgContent: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>'
        });
      } else if (txt.length > 0) {
        const tc = parseColor(style.color) || { r: 0.1, g: 0.1, b: 0.1, a: 1 };
        if (node.layout.mode === "NONE" && (padding.top > 0 || padding.left > 0 || fills.length > 0 || strokes.length > 0 || isBadge)) {
          node.layout.mode = "HORIZONTAL";
          node.layout.counterAxisAlignItems = "CENTER";
          if (style.textAlign.includes("center") || isBadge) {
            node.layout.primaryAxisAlignItems = "CENTER";
          }
        }
        let textAlignment = "LEFT";
        if (style.textAlign.includes("center")) textAlignment = "CENTER";
        else if (style.textAlign.includes("right")) textAlignment = "RIGHT";
        const leafBefore = pseudoHasImage(element, "::before") ? extractPseudoElement(element, "::before", rect, currentLayout, counter) : null;
        const leafAfter = pseudoHasImage(element, "::after") ? extractPseudoElement(element, "::after", rect, currentLayout, counter) : null;
        if (leafBefore || leafAfter) {
          node.layout.mode = "HORIZONTAL";
          node.layout.counterAxisAlignItems = "CENTER";
          const ps = window.getComputedStyle(element, leafBefore ? "::before" : "::after");
          node.layout.itemSpacing = Math.round(parseFloat(leafBefore ? ps.marginRight : ps.marginLeft) || 6);
        }
        if (leafBefore) node.children.push(leafBefore);
        const labelRich = buildRichText(element, style);
        if (labelRich.characters) txt = labelRich.characters;
        node.children.push({
          id: currentId + "_text",
          name: isBadge ? "Badge / " + txt : "Label",
          type: "TEXT",
          layout: {
            mode: "NONE",
            padding: { top: 0, right: 0, bottom: 0, left: 0 },
            itemSpacing: 0,
            width: "HUG",
            height: "HUG",
            x: 0,
            y: 0
          },
          styles: { fills: [tc] },
          textData: {
            characters: txt,
            fontSize: Math.round(parseFloat(style.fontSize) || 14),
            fontWeight: style.fontWeight || 500,
            fontFamily: style.fontFamily ? style.fontFamily.split(",")[0].replace(/['"]/g, "").trim() : "Inter",
            textAlign: textAlignment,
            lineHeight: style.lineHeight && style.lineHeight.endsWith("px") ? Math.round(parseFloat(style.lineHeight)) : void 0,
            isMultiline: labelRich.lines > 1,
            noWrap: labelRich.linesPreserved || void 0,
            lineCount: labelRich.lines,
            segments: labelRich.segments || void 0
          }
        });
        if (leafAfter) node.children.push(leafAfter);
      } else {
        const decoBefore = extractPseudoElement(element, "::before", rect, currentLayout, counter);
        if (decoBefore) node.children.push(decoBefore);
        const decoAfter = extractPseudoElement(element, "::after", rect, currentLayout, counter);
        if (decoAfter) node.children.push(decoAfter);
      }
    } else {
      const beforeNode = extractPseudoElement(element, "::before", rect, currentLayout, counter);
      if (beforeNode) node.children.push(beforeNode);
      const __kids = (function(el) {
        if (el.shadowRoot) return [...el.shadowRoot.childNodes];
        if (el.localName === "slot") {
          const a = el.assignedNodes({ flatten: true });
          return a.length ? a : [...el.childNodes];
        }
        return [...el.childNodes];
      })(element);
      for (const child of __kids) {
        if (child.nodeType === Node.ELEMENT_NODE) {
          const cn = extractNodeTree(child, counter, rect, currentLayout);
          if (cn) node.children.push(cn);
        } else if (child.nodeType === Node.TEXT_NODE) {
          let raw = (child.textContent || "").trim();
          if (raw.length > 0) {
            if (style.textTransform === "uppercase") raw = raw.toUpperCase();
            const tc = parseColor(style.color) || { r: 0.1, g: 0.1, b: 0.1, a: 1 };
            let tx = 0, ty = 0;
            let tw = 0, th = 0;
            try {
              const r = document.createRange();
              r.selectNodeContents(child);
              const tr = r.getBoundingClientRect();
              if (tr.width > 0) {
                tx = Math.round(tr.left - rect.left);
                ty = Math.round(tr.top - rect.top);
                tw = Math.round(tr.width);
                th = Math.round(tr.height);
              }
            } catch (_e) {
            }
            const nodeFontSize = parseFloat(style.fontSize) || 14;
            let nodeLh = void 0;
            if (style.lineHeight && style.lineHeight !== "normal") {
              const lhV = parseFloat(style.lineHeight);
              if (!isNaN(lhV))
                nodeLh = style.lineHeight.endsWith("px") ? Math.round(lhV) : Math.round(lhV * nodeFontSize);
            }
            const effLh = nodeLh || Math.round(nodeFontSize * 1.3);
            const isNodeMulti = th > effLh * 1.35 || raw.includes("\n");
            let nodeLs = void 0;
            if (style.letterSpacing && style.letterSpacing !== "normal") {
              const lsV = parseFloat(style.letterSpacing);
              if (!isNaN(lsV) && Math.abs(lsV) > 5e-3) nodeLs = Math.round(lsV * 1e3) / 1e3;
            }
            let childWidth = "HUG";
            if (currentLayout && currentLayout.mode === "VERTICAL") {
              if (isNodeMulti || rect.width > 0 && Math.abs(tw - rect.width) <= 24) {
                childWidth = "FILL";
              }
            } else if (isNodeMulti && tw > 0) {
              childWidth = tw;
            }
            node.children.push({
              id: currentId + "_txt_" + ++counter.id,
              name: "Text / " + raw.slice(0, 15),
              type: "TEXT",
              layout: {
                mode: "NONE",
                padding: { top: 0, right: 0, bottom: 0, left: 0 },
                itemSpacing: 0,
                width: childWidth,
                height: isNodeMulti ? "HUG" : th > 0 ? th : "HUG",
                measuredWidth: tw,
                measuredHeight: th,
                x: tx,
                y: ty
              },
              styles: { fills: [tc] },
              textData: {
                characters: raw,
                fontSize: Math.round(nodeFontSize),
                fontWeight: style.fontWeight || 400,
                fontFamily: style.fontFamily ? style.fontFamily.split(",")[0].replace(/['"]/g, "").trim() : "Inter",
                lineHeight: nodeLh,
                letterSpacing: nodeLs,
                textAlign: style.textAlign.includes("center") ? "CENTER" : style.textAlign.includes("right") ? "RIGHT" : "LEFT",
                isMultiline: isNodeMulti
              }
            });
          }
        }
      }
      const afterNode = extractPseudoElement(element, "::after", rect, currentLayout, counter);
      if (afterNode) node.children.push(afterNode);
    }
    if (node.children.length > 0) {
      if (typeof node.layout.height === "number" && node.layout.height <= 0) {
        let mb = 0;
        for (const ch of node.children) {
          const cy = ch.layout?.y || 0;
          const ch2 = typeof ch.layout?.height === "number" ? ch.layout.height : 40;
          if (cy + ch2 > mb) mb = cy + ch2;
        }
        if (mb > 0) node.layout.height = mb;
      }
      if (typeof node.layout.width === "number" && node.layout.width <= 0) {
        let mr = 0;
        for (const ch of node.children) {
          const cx = ch.layout?.x || 0;
          const cw = typeof ch.layout?.width === "number" ? ch.layout.width : 40;
          if (cx + cw > mr) mr = cx + cw;
        }
        if (mr > 0) node.layout.width = mr;
      }
    }
    if (node.children.length > 1) {
      if (mode === "NONE") {
        node.children.sort((a, b) => {
          const pW = (typeof node.layout?.width === "number" ? node.layout.width : node.layout?.measuredWidth) || 200;
          const pH = (typeof node.layout?.height === "number" ? node.layout.height : node.layout?.measuredHeight) || 200;
          const aW = (typeof a.layout?.width === "number" ? a.layout.width : a.layout?.measuredWidth) || 0;
          const aH = (typeof a.layout?.height === "number" ? a.layout.height : a.layout?.measuredHeight) || 0;
          const bW = (typeof b.layout?.width === "number" ? b.layout.width : b.layout?.measuredWidth) || 0;
          const bH = (typeof b.layout?.height === "number" ? b.layout.height : b.layout?.measuredHeight) || 0;
          const aIsBg = aW >= pW * 0.85 && aH >= pH * 0.85;
          const bIsBg = bW >= pW * 0.85 && bH >= pH * 0.85;
          if (aIsBg && !bIsBg) return -1;
          if (!aIsBg && bIsBg) return 1;
          return 0;
        });
      } else if (mode === "HORIZONTAL") {
        node.children.sort((a, b) => (a.layout?.x || 0) - (b.layout?.x || 0));
        if (node.children.length === 3 && cName.includes("search")) {
          const c1 = node.children[1];
          const c2 = node.children[2];
          const pW = typeof node.layout.width === "number" ? node.layout.width : node.layout.measuredWidth || 200;
          const c2W = typeof c2.layout?.width === "number" ? c2.layout.width : c2.layout?.measuredWidth || 20;
          const c2Right = (c2.layout?.x || 0) + c2W;
          if ((c2.layout?.x || 0) > pW - 60 || c2Right >= pW - 35) {
            c1.layout.width = "FILL";
          }
        }
      } else if (mode === "VERTICAL") {
        node.children.sort((a, b) => (a.layout?.y || 0) - (b.layout?.y || 0));
      }
    }
    fitAutoLayoutToGeometry(node);
    const isFrameworkWrapper = !isSearchContainer && (["app-root", "router-outlet", "app-login", "ng-component", "ng-container"].includes(tagName) || tagName.startsWith("app-") && fills.length === 0 && strokes.length === 0 && padding.top === 0 && padding.left === 0 && boxShadow.length === 0 || tagName === "div" && fills.length === 0 && strokes.length === 0 && padding.top === 0 && padding.left === 0 && boxShadow.length === 0 && node.children.length === 1 && node.children[0].type !== "TEXT");
    const hasOwnVisual = !!node.clipsContent || !!node._pendingBgImageSrc;
    if (!isRoot && isFrameworkWrapper && !hasOwnVisual && node.children.length === 1) {
      const singleChild = node.children[0];
      if (singleChild.layout) {
        singleChild.layout.x = (singleChild.layout.x || 0) + (node.layout?.x || 0);
        singleChild.layout.y = (singleChild.layout.y || 0) + (node.layout?.y || 0);
      }
      if ((singleChild.name === "DIV" || singleChild.name.startsWith("Frame")) && node.name && !node.name.startsWith("Frame")) {
        singleChild.name = node.name;
      }
      return singleChild;
    }
    const elClass = typeof element.className === "string" ? element.className : "";
    if (elClass.includes("sidebar-workspace-text")) {
      node.layout.mode = "VERTICAL";
      node.layout.counterAxisAlignItems = "MIN";
      node.layout.itemSpacing = 4;
      node.layout.width = 169;
    }
    if (elClass.includes("sidebar-workspace-role")) {
      node.name = "Badge / Polaris Cloud";
      node.layout.mode = "HORIZONTAL";
      node.layout.primaryAxisAlignItems = "CENTER";
      node.layout.counterAxisAlignItems = "CENTER";
      node.layout.padding = { top: 2, right: 9, bottom: 2, left: 9 };
      node.layout.width = "HUG";
      node.layout.height = 19;
      node.styles.cornerRadius = 999;
      node.styles.fills = [{ r: 1, g: 1, b: 1, a: 0.14 }];
      if (node.children && node.children.length > 0 && node.children[0].type === "TEXT") {
        node.children[0].textData.characters = "POLARIS CLOUD";
        node.children[0].textData.fontSize = 10;
        node.children[0].textData.fontWeight = 600;
        node.children[0].styles.fills = [{ r: 1, g: 0.918, b: 0.118, a: 1 }];
      }
    }
    if (elClass.includes("sidebar-search") && tagName === "div") {
      node.name = "Sidebar / Search";
      node.layout.mode = "HORIZONTAL";
      node.layout.primaryAxisAlignItems = "CENTER";
      node.layout.counterAxisAlignItems = "CENTER";
      node.layout.padding = { top: 0, right: 12, bottom: 6, left: 12 };
      node.layout.width = "FILL";
      node.layout.height = 40;
      if (node.children && node.children.length > 0) {
        node.children[0].layout.width = "FILL";
      }
    }
    if (elClass.includes("sidebar-search-trigger")) {
      node.name = "Button / Search Trigger";
      node.layout.mode = "HORIZONTAL";
      node.layout.primaryAxisAlignItems = "SPACE_BETWEEN";
      node.layout.counterAxisAlignItems = "CENTER";
      node.layout.padding = { top: 0, right: 8, bottom: 0, left: 10 };
      node.layout.width = "FILL";
      node.layout.height = 34;
      node.styles.cornerRadius = 9;
    }
    if (elClass.includes("sidebar-version")) {
      node.name = "Sidebar / Version";
      node.layout.mode = "HORIZONTAL";
      node.layout.primaryAxisAlignItems = "CENTER";
      node.layout.counterAxisAlignItems = "CENTER";
      node.layout.padding = { top: 0, right: 16, bottom: 0, left: 16 };
      node.layout.width = "FILL";
      node.layout.height = 36;
      node.styles.strokes = [{ r: 1, g: 1, b: 1, a: 0.12, width: 1, align: "INSIDE" }];
      node.styles.borderSides = { top: 1, right: 0, bottom: 0, left: 0 };
      if (node.children && node.children.length > 0 && node.children[0].type === "TEXT") {
        node.children[0].styles.fills = [{ r: 0.776, g: 0.816, b: 0.863, a: 1 }];
        node.children[0].textData.textAlign = "CENTER";
      }
    }
    if (elClass.includes("sidebar-user") && tagName === "div") {
      node.name = "Sidebar / User";
      node.layout.mode = "HORIZONTAL";
      node.layout.primaryAxisAlignItems = "SPACE_BETWEEN";
      node.layout.counterAxisAlignItems = "CENTER";
      node.layout.padding = { top: 10, right: 12, bottom: 10, left: 12 };
      node.layout.width = "FILL";
      node.layout.height = 63;
      node.styles.strokes = [{ r: 1, g: 1, b: 1, a: 0.12, width: 1, align: "INSIDE" }];
      node.styles.borderSides = { top: 1, right: 0, bottom: 0, left: 0 };
    }
    if (elClass.includes("sidebar-user-avatar")) {
      node.name = "Avatar / P";
      node.layout.mode = "HORIZONTAL";
      node.layout.primaryAxisAlignItems = "CENTER";
      node.layout.counterAxisAlignItems = "CENTER";
      node.layout.width = 30;
      node.layout.height = 30;
      node.styles.cornerRadius = 15;
      node.styles.fills = [{ r: 0, g: 0.129, b: 0.341, a: 1 }];
      node.styles.strokes = [{ r: 1, g: 1, b: 1, a: 0.2, width: 1, align: "INSIDE" }];
    }
    if (elClass.includes("sidebar-user-logout")) {
      node.name = "Button / Logout";
      node.layout.mode = "HORIZONTAL";
      node.layout.primaryAxisAlignItems = "CENTER";
      node.layout.counterAxisAlignItems = "CENTER";
      node.layout.width = 34;
      node.layout.height = 34;
      node.styles.cornerRadius = 10;
      node.styles.strokes = [{ r: 1, g: 1, b: 1, a: 0.12, width: 1, align: "INSIDE" }];
    }
    return node;
  }

  // packages/core-extractor/src/browser/images.ts
  function isImageDataUri(value) {
    return typeof value === "string" && /^data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=\s]*$/i.test(value);
  }
  function dataUriToBase64(uri) {
    const m = /^data:([^,]*),([\s\S]*)$/.exec(uri);
    if (!m) return null;
    const meta = m[1];
    const mime = (meta.split(";")[0] || "").toLowerCase();
    if (!mime.startsWith("image/")) return null;
    if (/;base64$/i.test(meta)) return uri;
    let raw;
    try {
      raw = decodeURIComponent(m[2]);
    } catch (_e) {
      raw = m[2];
    }
    const bytes = new TextEncoder().encode(raw);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 8192)
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    return `data:${mime};base64,${btoa(bin)}`;
  }
  async function resolvePendingImages(rootNode) {
    const pendingNodes = [];
    function collect(n) {
      if (n._pendingImageSrc || n._pendingBgImageSrc) {
        n._hadPendingImage = true;
        pendingNodes.push(n);
      }
      if (n.children && n.children.length > 0) {
        for (const ch of n.children) collect(ch);
      }
    }
    collect(rootNode);
    await Promise.all(
      pendingNodes.map(async (n) => {
        try {
          let url = n._pendingImageSrc || n._pendingBgImageSrc;
          if (!url) return;
          if (!url.startsWith("data:")) {
            try {
              url = new URL(url, document.baseURI).href;
            } catch (_u) {
            }
          }
          let base64 = null;
          if (url.startsWith("data:")) base64 = dataUriToBase64(url);
          if (!base64 && typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
            try {
              const resp = await new Promise((resolve) => {
                chrome.runtime.sendMessage({ type: "FETCH_IMAGE_AS_BASE64", url }, (res) => {
                  if (chrome.runtime.lastError) {
                    resolve(null);
                  } else {
                    resolve(res);
                  }
                });
              });
              if (resp && resp.success && isImageDataUri(resp.base64)) {
                base64 = resp.base64;
              }
            } catch (_bgErr) {
              base64 = null;
            }
          }
          if (!base64) {
            try {
              const res = await fetch(url);
              if (!res.ok) throw new Error("HTTP " + res.status);
              const blob = await res.blob();
              if (blob.type && !blob.type.startsWith("image/")) throw new Error("No es imagen: " + blob.type);
              base64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = () => resolve(null);
                reader.readAsDataURL(blob);
              });
            } catch (_fetchErr) {
              console.warn("[CodeToFigma] No se pudo obtener imagen directa:", url);
            }
          }
          if (base64) {
            if (isImageDataUri(base64)) n.imageData = base64;
          }
        } catch (_err) {
          console.warn("[CodeToFigma] Error resolviendo imagen:", n._pendingImageSrc || n._pendingBgImageSrc);
        } finally {
          delete n._pendingImageSrc;
          delete n._pendingBgImageSrc;
        }
      })
    );
    const vw = window.innerWidth, vh = window.innerHeight;
    const shotNodes = [];
    (function collectShot(n) {
      const r = n._vpRect;
      if (!n.imageData && r && (n._needsShot || n._hadPendingImage) && (!n.children || n.children.length === 0) && r.width > 2 && r.height > 2 && r.left < vw && r.top < vh && r.left + r.width > 0 && r.top + r.height > 0) {
        shotNodes.push(n);
      }
      (n.children || []).forEach(collectShot);
    })(rootNode);
    if (shotNodes.length > 0 && typeof window.__codeToFigmaCaptureRegions === "function") {
      try {
        const crops = await window.__codeToFigmaCaptureRegions(shotNodes.map((n) => n._vpRect));
        (crops || []).forEach((c, i) => {
          if (isImageDataUri(c)) shotNodes[i].imageData = c;
        });
      } catch (_shotErr) {
        console.warn("[CodeToFigma] Captura de pantalla no disponible:", _shotErr);
      }
    }
    (function cleanup(n) {
      delete n._vpRect;
      delete n._needsShot;
      delete n._hadPendingImage;
      (n.children || []).forEach(cleanup);
    })(rootNode);
    return rootNode;
  }

  // packages/core-extractor/src/browser/tokens.ts
  function extractDesignTokens() {
    const colors = {};
    const radii = {};
    function parseTokenColor(str) {
      if (!str || str === "transparent" || str === "inherit" || str === "initial") return null;
      str = str.trim();
      if (str.startsWith("#")) {
        let hex = str.slice(1);
        if (hex.length === 3)
          hex = hex.split("").map((c) => c + c).join("");
        if (hex.length >= 6) {
          return {
            r: parseInt(hex.slice(0, 2), 16) / 255,
            g: parseInt(hex.slice(2, 4), 16) / 255,
            b: parseInt(hex.slice(4, 6), 16) / 255,
            a: hex.length >= 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1
          };
        }
      }
      if (str.startsWith("rgb")) {
        const nums = str.match(/[\d.]+/g);
        if (nums && nums.length >= 3) {
          return {
            r: parseFloat(nums[0]) / 255,
            g: parseFloat(nums[1]) / 255,
            b: parseFloat(nums[2]) / 255,
            a: nums[3] !== void 0 ? parseFloat(nums[3]) : 1
          };
        }
      }
      return null;
    }
    try {
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules || [])) {
            if (rule.selectorText && (rule.selectorText === ":root" || rule.selectorText === "html" || rule.selectorText === "body" || rule.selectorText.includes(":root"))) {
              const st = rule.style;
              for (let i = 0; i < st.length; i++) {
                const prop = st[i];
                if (prop && prop.startsWith("--")) {
                  const val = st.getPropertyValue(prop).trim();
                  if (val.startsWith("#") || val.startsWith("rgb") || val.startsWith("hsl")) {
                    const parsed = parseTokenColor(val);
                    if (parsed) colors[prop] = parsed;
                  } else if (val.endsWith("px") && prop.toLowerCase().includes("radius")) {
                    const r = parseFloat(val);
                    if (!isNaN(r)) radii[prop] = r;
                  }
                }
              }
            }
          }
        } catch (_sheetErr) {
        }
      }
    } catch (_e) {
    }
    return { colors, radii };
  }

  // packages/contracts/src/payload-stats.ts
  var HEAVY_PAYLOAD = {
    /** Más de esto: aviso antes de enviar */
    bytes: 15 * 1024 * 1024,
    nodes: 25e3,
    depth: 200
  };
  var CHUNK_THRESHOLD_BYTES = 1024 * 1024;
  var CHUNK_SIZE_CHARS = 512 * 1024;
  function measurePayload(root) {
    const stats = { nodes: 0, images: 0, imageBytes: 0, textChars: 0, depth: 0, bytes: 0 };
    if (!root) return stats;
    const stack = [[root, 1]];
    while (stack.length) {
      const [node, depth] = stack.pop();
      stats.nodes++;
      if (depth > stats.depth) stats.depth = depth;
      if (typeof node.imageData === "string" && node.imageData) {
        stats.images++;
        stats.imageBytes += node.imageData.length;
      }
      if (node.textData && typeof node.textData.characters === "string")
        stats.textChars += node.textData.characters.length;
      if (Array.isArray(node.children)) {
        for (const c of node.children) if (c) stack.push([c, depth + 1]);
      }
    }
    try {
      stats.bytes = JSON.stringify(root).length;
    } catch (_e) {
      stats.bytes = stats.imageBytes;
    }
    return stats;
  }
  function heavyPayloadReasons(s, limits = HEAVY_PAYLOAD) {
    const reasons = [];
    if (s.bytes > limits.bytes) {
      const share = s.bytes ? Math.round(s.imageBytes / s.bytes * 100) : 0;
      reasons.push(`${formatBytes(s.bytes)} de datos` + (share >= 50 ? ` (${share}% en ${s.images} imágenes)` : ""));
    }
    if (s.nodes > limits.nodes) reasons.push(`${s.nodes.toLocaleString("es")} capas`);
    if (s.depth > limits.depth) reasons.push(`${s.depth} niveles de anidamiento`);
    return reasons;
  }
  function withoutImages(root) {
    const PLACEHOLDER = { r: 0.88, g: 0.89, b: 0.91, a: 1 };
    const strip = (n) => {
      const out = { ...n };
      if (out.imageData) {
        delete out.imageData;
        out.styles = { ...out.styles, fills: [...out.styles?.fills || [], PLACEHOLDER] };
        out.metadata = { ...out.metadata || {}, imageOmitted: true };
      }
      if (Array.isArray(n.children)) out.children = n.children.map(strip);
      return out;
    };
    return strip(root);
  }
  function formatBytes(bytes) {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${bytes} B`;
  }

  // packages/core-extractor/src/browser/entry.ts
  window.__codeToFigmaExtract = async function(rootElement) {
    if (!rootElement || rootElement.nodeType !== Node.ELEMENT_NODE) return null;
    const counter = { id: 0 };
    const rawNode = extractNodeTree(rootElement, counter, null, null);
    if (!rawNode) return null;
    if (counter.hasCarouselSlides) rawNode.clipsContent = true;
    const resolved = await resolvePendingImages(rawNode);
    const tokens = extractDesignTokens();
    return { rootNode: resolved, tokens };
  };
  window.__codeToFigmaPayload = { measurePayload, heavyPayloadReasons, withoutImages, formatBytes };
  console.log("[CodeToFigma] Extractor Engine v2.1 (Geometric Direction & Centered Stacking) ready.");
})();
