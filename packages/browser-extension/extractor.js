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
  function isBoxless(el) {
    return window.getComputedStyle(el).display === "contents";
  }
  function boxChildren(el) {
    const out = [];
    for (const c of Array.from(el.children)) {
      if (isBoxless(c)) out.push(...boxChildren(c));
      else out.push(c);
    }
    return out;
  }
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
  function hasVisibleOverflow(element) {
    const visibleBox = (cs, w, h) => w > 4 && h > 4 && cs.display !== "none" && cs.visibility !== "hidden" && parseFloat(cs.opacity) > 0;
    for (const p of ["::before", "::after"]) {
      const ps = window.getComputedStyle(element, p);
      if (ps.content && ps.content !== "none" && ps.content !== "normal") {
        if (visibleBox(ps, parseFloat(ps.width) || 0, parseFloat(ps.height) || 0)) return true;
      }
    }
    let level = Array.from(element.children);
    for (let depth = 0; depth < 3 && level.length; depth++) {
      const next = [];
      for (const c of level.slice(0, 40)) {
        const r = c.getBoundingClientRect();
        if (visibleBox(window.getComputedStyle(c), r.width, r.height)) return true;
        next.push(...Array.from(c.children));
      }
      level = next;
    }
    return false;
  }
  function isVisuallyHidden(cs, rect, element) {
    if (cs.position !== "absolute" && cs.position !== "fixed") return false;
    if (rect.width <= 2 && rect.height <= 2) {
      const clips = CLIPPING_OVERFLOW.test(cs.overflowX) || CLIPPING_OVERFLOW.test(cs.overflowY) || /rect\(/.test(cs.clip || "") || !!cs.clipPath && cs.clipPath !== "none";
      return clips || !element || !hasVisibleOverflow(element);
    }
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
  function hasScrolledAncestor(el) {
    for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      if (p.scrollTop > 0 || p.scrollLeft > 0) {
        const oy = window.getComputedStyle(p).overflowY;
        if (/(auto|scroll|hidden|overlay)/.test(oy)) return true;
      }
    }
    return false;
  }
  function naturalRectOfSticky(el) {
    const s = el.style;
    if (!s) return null;
    const value = s.getPropertyValue("position");
    const priority = s.getPropertyPriority("position");
    try {
      s.setProperty("position", "static", "important");
      return el.getBoundingClientRect();
    } catch (_e) {
      return null;
    } finally {
      if (value) s.setProperty("position", value, priority);
      else s.removeProperty("position");
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
  function applyTextTransform(ch, tt, prevCh) {
    if (tt === "uppercase") return ch.toUpperCase();
    if (tt === "lowercase") return ch.toLowerCase();
    if (tt === "capitalize") {
      if (!prevCh || !/[\p{L}\p{N}'’]/u.test(prevCh)) return ch.toUpperCase();
    }
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
    const lineStarts = [];
    let lineStartPending = true;
    const styleKeyCache = /* @__PURE__ */ new Map();
    function styleFor(el) {
      if (styleKeyCache.has(el)) return styleKeyCache.get(el);
      const cs = window.getComputedStyle(el);
      const st = {
        fontFamily: (cs.fontFamily || "").split(",")[0].replace(/['"]/g, "").trim() || "Inter",
        fontStack: cs.fontFamily || "",
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
      lineStartPending = true;
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
              if (lineStartPending) {
                lineStarts.push({ at: out.length, left: r.left - rootRect.left, top: r.top - rootRect.top });
                lineStartPending = false;
              }
            }
          } catch (_e) {
            measureOk = false;
          }
        } else if (measured >= MAX_MEASURE) {
          measureOk = false;
        }
        let outCh = applyTextTransform(ch, st._tt, out.length > 0 ? out[out.length - 1] : void 0);
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
    let leadingRemoved = 0;
    while (chars.length && chars[0] === "\n") {
      chars.shift();
      styles.shift();
      leadingRemoved++;
    }
    if (truncated && ellipsis && chars.length) {
      chars.push("…");
      styles.push(styles[styles.length - 1]);
    }
    text = chars.join("");
    lines = text.split("\n").length;
    let lineLefts = null;
    let lineTops = null;
    if (measureOk && lineStarts.length) {
      const finalIndex = /* @__PURE__ */ new Map();
      keep.forEach((orig, k) => finalIndex.set(orig, k - leadingRemoved));
      const lineOf = [];
      let ln = 0;
      for (let k = 0; k < text.length; k++) {
        lineOf.push(ln);
        if (text[k] === "\n") ln++;
      }
      const lefts = new Array(lines).fill(void 0);
      const tops = new Array(lines).fill(void 0);
      for (const st of lineStarts) {
        const k = finalIndex.get(st.at);
        if (k === void 0 || k < 0 || k >= text.length) continue;
        const line = lineOf[k];
        if (lefts[line] === void 0) {
          lefts[line] = Math.round(st.left);
          tops[line] = Math.round(st.top);
        }
      }
      if (lefts.every((v) => v !== void 0)) {
        lineLefts = lefts;
        lineTops = tops;
      }
    }
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
        fontStack: st.fontStack,
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
      linesPreserved: measureOk && measured > 0,
      lineLefts,
      lineTops
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
    if (L.width === "FILL") {
      L.width = Math.round(W);
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
    const gap = gaps.length ? r(avg(gaps)) : 0;
    if (top < -1 || starts[0] < -1 || W - maxRight < -1 || H - lastRowBottom < -1) {
      L.mode = "NONE";
      return;
    }
    for (let i = 0; i < rows.length - 1; i++) {
      const last = rows[i].items[rows[i].items.length - 1];
      const rowEnd = last.layout.x + sz(last, true);
      const next = rows[i + 1].items[0];
      if (rowEnd + gap + sz(next, true) <= maxRight + 0.5) {
        L.mode = "NONE";
        return;
      }
    }
    L.primaryAxisAlignItems = "MIN";
    L.counterAxisAlignItems = "MIN";
    if (gaps.length) L.itemSpacing = gap;
    L.counterAxisSpacing = r(avg(rowGaps));
    L.padding = { left: r(starts[0]), top: r(top), right: r(W - maxRight), bottom: r(H - lastRowBottom) };
    if (node._gridWrap) {
      node._gridWrapOk = true;
      for (const row of rows) {
        row.items.forEach((c, i) => {
          const nextItem = row.items[i + 1];
          c.layout.width = nextItem ? nextItem.layout.x - c.layout.x - gap : Math.round(sz(c, true));
          c.layout.height = Math.round(sz(c, false));
        });
      }
    }
  }
  function isContainingBlock(s, fixedToo) {
    const transformed = s.transform !== "none" || s.filter !== "none" || /paint|layout|strict|content/.test(s.contain || "");
    return fixedToo ? transformed : transformed || s.position !== "static";
  }
  function pseudoPosition(element, ps, w, h) {
    const er = element.getBoundingClientRect();
    const es = window.getComputedStyle(element);
    const fixed = ps.position === "fixed";
    let cb = null;
    for (let el = element; el && el !== document.documentElement; el = el.parentElement) {
      const s = window.getComputedStyle(el);
      if (!isContainingBlock(s, fixed)) continue;
      const r = el.getBoundingClientRect();
      const bl = parseFloat(s.borderLeftWidth) || 0;
      const bt = parseFloat(s.borderTopWidth) || 0;
      const br = parseFloat(s.borderRightWidth) || 0;
      const bb = parseFloat(s.borderBottomWidth) || 0;
      cb = { left: r.left + bl, top: r.top + bt, width: r.width - bl - br, height: r.height - bt - bb };
      break;
    }
    if (!cb) {
      cb = fixed ? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight } : { left: -window.scrollX, top: -window.scrollY, width: window.innerWidth, height: window.innerHeight };
    }
    const parseVal = (v, dim) => {
      if (!v || v === "auto") return null;
      if (v.endsWith("%")) {
        const pct = parseFloat(v);
        return !isNaN(pct) ? pct / 100 * dim : null;
      }
      const num = parseFloat(v);
      return !isNaN(num) ? num : null;
    };
    const left = parseVal(ps.left, cb.width), right = parseVal(ps.right, cb.width), top = parseVal(ps.top, cb.height), bottom = parseVal(ps.bottom, cb.height);
    let x, y;
    if (left !== null) x = cb.left + left - er.left;
    else if (right !== null) x = cb.left + cb.width - right - w - er.left;
    else x = (parseFloat(es.borderLeftWidth) || 0) + (parseFloat(es.paddingLeft) || 0);
    if (top !== null) y = cb.top + top - er.top;
    else if (bottom !== null) y = cb.top + cb.height - bottom - h - er.top;
    else y = (parseFloat(es.borderTopWidth) || 0) + (parseFloat(es.paddingTop) || 0);
    const m = (ps.transform || "").match(/^matrix\(([^)]+)\)$/);
    if (m) {
      const k = m[1].split(",").map(parseFloat);
      x += k[4] || 0;
      y += k[5] || 0;
    }
    return { x: Math.round(x), y: Math.round(y) };
  }

  // packages/core-extractor/src/browser/float-text.ts
  var TOL = 3;
  function lineGroups(lineLefts, lineTops) {
    const groups = [];
    lineLefts.forEach((left, i) => {
      const g = groups[groups.length - 1];
      if (g && Math.abs(g.left - left) <= TOL) g.to = i + 1;
      else groups.push({ from: i, to: i + 1, left, top: lineTops[i] });
    });
    return groups;
  }
  function sliceSegments(segments, start, end) {
    if (!segments) return void 0;
    const out = segments.filter((s) => s.end > start && s.start < end).map((s) => ({ ...s, start: Math.max(s.start, start) - start, end: Math.min(s.end, end) - start }));
    return out.length > 1 ? out : void 0;
  }
  function splitTextAroundFloats(textNode, rich, width) {
    const { lineLefts, lineTops } = rich;
    const td = textNode.textData;
    if (!lineLefts || !lineTops || lineLefts.length < 2 || !td) return textNode;
    if (td.textAlign !== "LEFT" && td.textAlign !== "JUSTIFIED") return textNode;
    if (Math.max(...lineLefts) - Math.min(...lineLefts) <= TOL) return textNode;
    const groups = lineGroups(lineLefts, lineTops);
    if (groups.length < 2) return textNode;
    const lines = td.characters.split("\n");
    const offsets = [];
    let acc = 0;
    for (const l of lines) {
      offsets.push(acc);
      acc += l.length + 1;
    }
    const L = textNode.layout;
    const children = groups.map((g, i) => {
      const start = offsets[g.from];
      const end = offsets[g.to - 1] + lines[g.to - 1].length;
      const characters = td.characters.slice(start, end);
      const count = g.to - g.from;
      return {
        ...textNode,
        id: `${textNode.id}_l${i}`,
        name: `${textNode.name} · ${i + 1}`,
        layout: {
          ...L,
          width: Math.max(1, Math.round(width - g.left)),
          height: "HUG",
          measuredWidth: Math.max(1, Math.round(width - g.left)),
          measuredHeight: void 0,
          x: Math.max(0, g.left),
          y: Math.max(0, g.top),
          positioning: "AUTO"
        },
        textData: {
          ...td,
          characters,
          isMultiline: count > 1,
          lineCount: count,
          segments: sliceSegments(td.segments, start, end)
        }
      };
    });
    return {
      id: textNode.id,
      name: textNode.name,
      type: "FRAME",
      layout: {
        ...L,
        mode: "NONE",
        height: typeof L.measuredHeight === "number" ? L.measuredHeight : L.height
      },
      styles: { fills: [] },
      metadata: { textAroundFloat: true },
      children
    };
  }
  function alignTableCell(node, style) {
    const va = style.verticalAlign;
    const vertical = va === "middle" ? "CENTER" : va === "bottom" ? "MAX" : "MIN";
    const ta = style.textAlign || "";
    const horizontal = /center/.test(ta) ? "CENTER" : /right|end/.test(ta) ? "MAX" : "MIN";
    const L = node.layout;
    if (L.mode === "NONE") L.mode = "VERTICAL";
    if (L.mode === "VERTICAL") {
      L.primaryAxisAlignItems = vertical;
      L.counterAxisAlignItems = horizontal;
    } else {
      L.counterAxisAlignItems = vertical;
      L.primaryAxisAlignItems = horizontal;
    }
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
    if (parentRect !== null && isVisuallyHidden(style, rect, element)) return null;
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
    }
    const currentId = "node_" + ++counter.id;
    const relX = parentRect ? Math.round(rect.left - parentRect.left) : 0;
    let relY = parentRect ? Math.round(rect.top - parentRect.top) : 0;
    if (parentRect && style.position === "fixed" && window.scrollY > 0) {
      const parentEl = element.parentElement;
      const parentFixed = parentEl && window.getComputedStyle(parentEl).position === "fixed";
      const parentDocTop = parentRect.top + window.scrollY;
      if (!parentFixed) relY = Math.round(rect.top - parentDocTop);
    }
    if (parentRect && style.position === "sticky" && window.scrollY > 0 && !hasScrolledAncestor(element)) {
      const natural = naturalRectOfSticky(element);
      if (natural) relY = Math.round(natural.top - parentRect.top);
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
    function parseCornerRadius(elStyle) {
      const rtl = Math.round(parseFloat(elStyle.borderTopLeftRadius) || 0);
      const rtr = Math.round(parseFloat(elStyle.borderTopRightRadius) || 0);
      const rbr = Math.round(parseFloat(elStyle.borderBottomRightRadius) || 0);
      const rbl = Math.round(parseFloat(elStyle.borderBottomLeftRadius) || 0);
      return rtl === rtr && rtr === rbr && rbr === rbl ? rtl : [rtl, rtr, rbr, rbl];
    }
    function localClassName(c) {
      let m = c.match(/^_([A-Za-z][\w-]*?)_[a-z0-9]{5}(?:_\d+)?$/);
      if (m) return m[1];
      m = c.match(/^[A-Z][A-Za-z0-9]*_([A-Za-z][\w-]*?)__[A-Za-z0-9_-]{5}$/);
      if (m) return m[1];
      return c;
    }
    function hasAnyRadius(cr) {
      if (cr === void 0) return false;
      if (typeof cr === "number") return cr > 0;
      return Array.isArray(cr) && cr.some((v) => v > 0);
    }
    function transformText(str, tt) {
      if (!str || !tt) return str;
      if (tt === "uppercase") return str.toUpperCase();
      if (tt === "lowercase") return str.toLowerCase();
      if (tt === "capitalize") {
        return str.replace(/(^|[^\p{L}\p{N}'’])(\p{L})/gu, (_m, pre, ch) => pre + ch.toUpperCase());
      }
      return str;
    }
    function isIconFont(fontFamily, text, className) {
      const ff = (fontFamily || "").toLowerCase();
      const cls = (className || "").toLowerCase();
      if (/material[ -]icons|material[ -]symbols|font[ -]?awesome|dashicons|remixicon|lucide|tabler|bootstrap-icons|glyphicons/i.test(
        ff
      ) || /\b(material-icons|material-symbols|fa|fas|far|fal|fad|bi|tabler-icon|lucide)\b/i.test(cls)) {
        return true;
      }
      const trimmed = (text || "").trim();
      if (trimmed.length > 0 && trimmed.length <= 4 && /^[\uE000-\uF8FF\u{F0000}-\u{FFFFD}\u{100000}-\u{10FFFD}]+$/u.test(trimmed)) {
        return true;
      }
      return false;
    }
    function renderIconFontToDataUrl(text, elStyle, w, h) {
      try {
        const c = document.createElement("canvas");
        const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 2));
        const cw = Math.max(16, Math.round(w));
        const ch = Math.max(16, Math.round(h));
        c.width = Math.round(cw * dpr);
        c.height = Math.round(ch * dpr);
        const ctx = c.getContext("2d");
        if (!ctx) return null;
        ctx.scale(dpr, dpr);
        ctx.font = `${elStyle.fontStyle || "normal"} ${elStyle.fontWeight || "400"} ${elStyle.fontSize || "16px"} ${elStyle.fontFamily || "sans-serif"}`;
        ctx.fillStyle = elStyle.color || "#000000";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, cw / 2, ch / 2);
        return c.toDataURL("image/png");
      } catch (_e) {
        return null;
      }
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
          _sharedCtx.fillStyle = "#000000";
          _sharedCtx.fillStyle = str;
          const asBlack = _sharedCtx.fillStyle;
          _sharedCtx.fillStyle = "#ffffff";
          _sharedCtx.fillStyle = str;
          if (_sharedCtx.fillStyle !== asBlack) return null;
          _sharedCtx.clearRect(0, 0, 1, 1);
          _sharedCtx.fillRect(0, 0, 1, 1);
          const d = _sharedCtx.getImageData(0, 0, 1, 1).data;
          if (d[3] === 0) return null;
          return { r: d[0] / 255, g: d[1] / 255, b: d[2] / 255, a: d[3] / 255 };
        }
      } catch (_e) {
      }
      return null;
    }
    const COLOR_RE = /^(rgba?\([^)]*\)|hsla?\([^)]*\)|(?:oklch|oklab|lab|lch|color)\([^)]*\)|#[0-9a-f]{3,8}\b|[a-z]+)/i;
    function parseCssLen(tok) {
      const m = String(tok || "").match(/^(-?[\d.]+)(%|px)?$/i);
      if (!m) return null;
      return { v: parseFloat(m[1]), u: m[2] === "%" ? "%" : "px" };
    }
    function parseCssPosition(str) {
      const KW = {
        left: ["x", 0],
        right: ["x", 100],
        top: ["y", 0],
        bottom: ["y", 100]
      };
      const toks = str.trim().split(/\s+/).filter(Boolean);
      const out = {};
      const free = [];
      for (const t of toks) {
        const k = t.toLowerCase();
        if (KW[k]) out[KW[k][0]] = { v: KW[k][1], u: "%" };
        else if (k === "center") free.push({ v: 50, u: "%" });
        else {
          const l = parseCssLen(t);
          if (l) free.push(l);
        }
      }
      if (!out.x && free.length) out.x = free.shift();
      if (!out.y && free.length) out.y = free.shift();
      if (!out.x) out.x = { v: 50, u: "%" };
      if (!out.y) out.y = { v: 50, u: "%" };
      return out;
    }
    function parseStops(parts, angular) {
      const stops = [];
      for (const part of parts) {
        const cm = part.trim().match(COLOR_RE);
        if (!cm) continue;
        const color = parseColor(cm[0]);
        if (!color) continue;
        const rest = part.trim().slice(cm[0].length).trim();
        const positions = rest ? rest.split(/\s+/) : [];
        const toStop = (p) => {
          const m = p.match(/^(-?[\d.]+)(%|px|deg|turn)?$/i);
          if (!m) return { color };
          const v = parseFloat(m[1]);
          const u = (m[2] || "").toLowerCase();
          if (u === "%") return { color, position: v / 100 };
          if (u === "deg") return { color, position: v / 360 };
          if (u === "turn") return { color, position: v };
          if (angular) return { color };
          return { color, px: v };
        };
        if (!positions.length) stops.push({ color });
        else positions.slice(0, 2).forEach((p) => stops.push(toStop(p)));
      }
      return stops;
    }
    function parseGradientLayer(layer) {
      const m = layer.match(/^\s*(repeating-)?(linear|radial|conic)-gradient\(([\s\S]*)\)\s*$/i);
      if (!m) return null;
      const kind = m[2].toLowerCase();
      const parts = splitCssList(m[3]);
      if (!parts.length) return null;
      const first = parts[0].trim();
      const firstIsColorStop = COLOR_RE.test(first) && !!parseColor((first.match(COLOR_RE) || [""])[0]);
      if (kind === "linear") {
        let angle = 180;
        let toCorner;
        let stopParts2 = parts;
        if (!firstIsColorStop) {
          stopParts2 = parts.slice(1);
          const t = first.toLowerCase();
          const deg = t.match(/^(-?[\d.]+)(deg|turn|rad|grad)$/);
          if (deg) {
            const v = parseFloat(deg[1]);
            angle = deg[2] === "turn" ? v * 360 : deg[2] === "rad" ? v * 180 / Math.PI : deg[2] === "grad" ? v * 0.9 : v;
          } else if (/^to\s/.test(t)) {
            const dirs = t.slice(3).trim();
            const SIDES = { top: 0, right: 90, bottom: 180, left: 270 };
            if (SIDES[dirs] !== void 0) angle = SIDES[dirs];
            else {
              toCorner = dirs;
              angle = void 0;
            }
          }
        }
        const stops2 = parseStops(stopParts2, false);
        return stops2.length >= 2 ? { type: "GRADIENT_LINEAR", angle, toCorner, stops: stops2 } : null;
      }
      if (kind === "radial") {
        let shape;
        let size;
        let at2;
        let stopParts2 = parts;
        if (!firstIsColorStop) {
          stopParts2 = parts.slice(1);
          const [shapeSize, pos] = first.split(/\bat\b/i);
          if (pos !== void 0) at2 = parseCssPosition(pos);
          const lens = [];
          for (const t of shapeSize.trim().split(/\s+/).filter(Boolean)) {
            const k = t.toLowerCase();
            if (k === "circle" || k === "ellipse") shape = k;
            else if (/^(closest|farthest)-(side|corner)$/.test(k)) size = k;
            else {
              const l = parseCssLen(t);
              if (l) lens.push(l);
            }
          }
          if (lens.length) size = lens;
        }
        const stops2 = parseStops(stopParts2, false);
        return stops2.length >= 2 ? { type: "GRADIENT_RADIAL", shape, size, at: at2, stops: stops2 } : null;
      }
      let from = 0;
      let at;
      let stopParts = parts;
      if (!firstIsColorStop) {
        stopParts = parts.slice(1);
        const fm = first.match(/from\s+(-?[\d.]+)(deg|turn)?/i);
        if (fm) from = parseFloat(fm[1]) * (fm[2] && fm[2].toLowerCase() === "turn" ? 360 : 1);
        const am = first.split(/\bat\b/i);
        if (am.length > 1) at = parseCssPosition(am[1]);
      }
      const stops = parseStops(stopParts, true);
      return stops.length >= 2 ? { type: "GRADIENT_ANGULAR", from, at, stops } : null;
    }
    function parseAllGradients(bgStr) {
      if (!bgStr || !bgStr.includes("gradient")) return [];
      const list = [];
      for (const layer of splitCssList(bgStr)) {
        const g = parseGradientLayer(layer);
        if (g) list.push(g);
      }
      return list;
    }
    function parseGradient(bgStr) {
      return parseAllGradients(bgStr)[0] || null;
    }
    function generateGridPatternTile(bgImg, bgSize) {
      if (!bgImg || bgImg === "none") return null;
      const layers = splitCssList(bgImg).map((l) => l.trim());
      const sizes = splitCssList(bgSize || "auto").map((s) => s.trim());
      const sizeOf = (i) => sizes[i % Math.max(1, sizes.length)] || "auto";
      const pxPair = (sz) => {
        const m = sz.match(/^(\d+(?:\.\d+)?)px(?:\s+(\d+(?:\.\d+)?)px)?$/);
        if (!m) return null;
        const w = parseFloat(m[1]);
        const h = m[2] ? parseFloat(m[2]) : w;
        return w >= 4 && w <= 256 && h >= 4 && h <= 256 ? { w, h } : null;
      };
      const TRANSPARENT = "(?:transparent|rgba\\([^)]*,\\s*0\\))";
      const STOP_START = new RegExp("(\\d+(?:\\.\\d+)?)px\\s*,\\s*" + TRANSPARENT, "i");
      const STOP_END = new RegExp(TRANSPARENT + "\\s+(\\d+(?:\\.\\d+)?)px\\s*,\\s*rgba?\\(", "i");
      const COLOR = /(rgba?\([^)]+\)|#[a-f0-9]{3,8})/gi;
      const visibleColor = (layer) => (layer.match(COLOR) || []).find((c) => !/rgba\([^)]*,\s*0\)$/i.test(c)) || null;
      const lineOf = (layer) => {
        const first = (layer.match(/^[^(]*\(\s*([^,]+),/) || [])[1]?.trim().toLowerCase() || "";
        const isDir = first.startsWith("to ") || /^-?\d+(\.\d+)?(deg|turn|rad|grad)$/.test(first);
        if (!isDir) return "HLINE";
        if (/^to (right|left)$/.test(first) || /^(90|270|-90)deg$/.test(first)) return "VLINE";
        if (/^to (bottom|top)$/.test(first) || /^(0|180|360)deg$/.test(first)) return "HLINE";
        return null;
      };
      const thick = (v) => Math.min(4, Math.max(1, v));
      const marks = [];
      layers.forEach((layer, idx) => {
        const color = visibleColor(layer);
        if (!color || /url\(/i.test(layer)) return;
        if (/^repeating-linear-gradient\(/i.test(layer)) {
          const kind2 = lineOf(layer);
          const stopsPx = [...layer.matchAll(/(\d+(?:\.\d+)?)px/g)].map((m) => parseFloat(m[1]));
          const period = stopsPx.length ? Math.max(...stopsPx) : 0;
          const st2 = layer.match(STOP_START);
          if (!kind2 || !st2 || !(period >= 4 && period <= 256)) return;
          const t2 = thick(parseFloat(st2[1]));
          marks.push({ kind: kind2, t: t2, pos: "start", color, pw: kind2 === "VLINE" ? period : 0, ph: kind2 === "HLINE" ? period : 0, idx });
          return;
        }
        const size = pxPair(sizeOf(idx));
        if (!size) return;
        const isLin = /^linear-gradient\(/i.test(layer);
        const isRad = /^(repeating-)?radial-gradient\(/i.test(layer);
        if (!isLin && !isRad) return;
        const st = layer.match(STOP_START);
        const en = isLin && !st ? layer.match(STOP_END) : null;
        if (!st && !en) return;
        if (isRad) {
          if (!st) return;
          marks.push({ kind: "DOT", t: thick(parseFloat(st[1])), pos: "start", color, pw: size.w, ph: size.h, idx });
          return;
        }
        const kind = lineOf(layer);
        if (!kind) return;
        const cell = kind === "VLINE" ? size.w : size.h;
        const t = st ? thick(parseFloat(st[1])) : thick(cell - parseFloat(en[1]));
        marks.push({ kind, t, pos: st ? "start" : "end", color, pw: size.w, ph: size.h, idx });
      });
      if (!marks.length) return null;
      let W = Math.max(0, ...marks.map((m) => m.pw));
      let H = Math.max(0, ...marks.map((m) => m.ph));
      if (!W) W = H || 8;
      if (!H) H = W || 8;
      const fits = (period, total) => !period || Math.abs(total / period - Math.round(total / period)) < 0.01;
      const used = marks.filter((m) => fits(m.pw, W) && fits(m.ph, H));
      if (!used.length) return null;
      try {
        const c = document.createElement("canvas");
        c.width = Math.round(W);
        c.height = Math.round(H);
        const ctx = c.getContext("2d");
        if (!ctx) return null;
        for (const m of used) {
          ctx.fillStyle = m.color;
          if (m.kind === "VLINE") {
            const p = m.pw || W;
            for (let x = 0; x < W - 0.01; x += p) ctx.fillRect(m.pos === "start" ? x : x + p - m.t, 0, m.t, H);
          } else if (m.kind === "HLINE") {
            const p = m.ph || H;
            for (let y = 0; y < H - 0.01; y += p) ctx.fillRect(0, m.pos === "start" ? y : y + p - m.t, W, m.t);
          } else {
            for (let x = 0; x < W - 0.01; x += m.pw)
              for (let y = 0; y < H - 0.01; y += m.ph) {
                ctx.beginPath();
                ctx.arc(x + m.pw / 2, y + m.ph / 2, m.t, 0, Math.PI * 2);
                ctx.fill();
              }
          }
        }
        return { tile: c.toDataURL("image/png"), layers: used.map((m) => m.idx) };
      } catch (_e) {
        return null;
      }
    }
    function gradientsExcept(bgStr, skip) {
      if (!bgStr || bgStr === "none") return [];
      const out = [];
      splitCssList(bgStr).forEach((layer, i) => {
        if (skip.includes(i)) return;
        const g = parseGradientLayer(layer);
        if (g) out.push(g);
      });
      return out;
    }
    function parseBoxShadow(shadowStr) {
      if (!shadowStr || shadowStr === "none") return [];
      const shadows = [];
      const parts = splitCssList(shadowStr);
      for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const isInset = /\binset\b/i.test(trimmed);
        const colorMatch = trimmed.match(/(rgba?\([^)]+\)|#[a-f0-9]+)/i);
        const color = colorMatch ? parseColor(colorMatch[1]) : { r: 0, g: 0, b: 0, a: 0.15 };
        const cleanLength = trimmed.replace(/(rgba?\([^)]+\)|#[a-f0-9]+)/i, "").replace(/\binset\b/gi, "").trim();
        const lengths = cleanLength.split(/\s+/).map((l) => parseFloat(l) || 0);
        if (lengths.length >= 2 && color) {
          shadows.push({
            color,
            offset: { x: lengths[0], y: lengths[1] },
            radius: lengths[2] || 0,
            spread: lengths[3] || 0,
            inset: isInset || void 0
          });
        }
      }
      return shadows;
    }
    const BLEND_MODES = {
      multiply: "MULTIPLY",
      screen: "SCREEN",
      overlay: "OVERLAY",
      darken: "DARKEN",
      lighten: "LIGHTEN",
      "color-dodge": "COLOR_DODGE",
      "color-burn": "COLOR_BURN",
      "hard-light": "HARD_LIGHT",
      "soft-light": "SOFT_LIGHT",
      difference: "DIFFERENCE",
      exclusion: "EXCLUSION",
      hue: "HUE",
      saturation: "SATURATION",
      color: "COLOR",
      luminosity: "LUMINOSITY",
      "plus-lighter": "LINEAR_DODGE",
      "plus-darker": "LINEAR_BURN"
    };
    function parseShadowParts(str, withSpread) {
      const out = [];
      for (const part of splitCssList(str)) {
        const t = part.trim();
        if (!t || t === "none") continue;
        const cm = t.match(/(rgba?\([^)]+\)|#[a-f0-9]{3,8}\b)/i);
        const color = cm ? parseColor(cm[1]) : { r: 0, g: 0, b: 0, a: 0.5 };
        if (!color || color.a === 0) continue;
        const lens = t.replace(cm ? cm[1] : "", "").trim().split(/\s+/).map((l) => parseFloat(l)).filter((v) => !isNaN(v));
        if (lens.length < 2) continue;
        out.push({
          color,
          offset: { x: lens[0], y: lens[1] },
          radius: Math.max(0, lens[2] || 0),
          spread: withSpread ? lens[3] || 0 : 0
        });
      }
      return out;
    }
    function parseCssFilter(filter) {
      const res = {
        dropShadows: [],
        opacity: 1
      };
      if (!filter || filter === "none") return res;
      const IDENTITY = {
        grayscale: 0,
        sepia: 0,
        invert: 0,
        brightness: 1,
        contrast: 1,
        saturate: 1,
        "hue-rotate": 0
      };
      const re = /([a-z-]+)\(((?:[^()]|\([^()]*\))*)\)/gi;
      let m;
      while (m = re.exec(filter)) {
        const name = m[1].toLowerCase();
        const arg = m[2].trim();
        if (name === "blur") {
          const v = parseFloat(arg);
          if (v > 0) res.layerBlur = v;
        } else if (name === "drop-shadow") {
          res.dropShadows.push(...parseShadowParts(arg, false));
        } else if (name === "opacity") {
          const v = arg.endsWith("%") ? parseFloat(arg) / 100 : parseFloat(arg);
          if (!isNaN(v)) res.opacity *= Math.max(0, Math.min(1, v));
        } else if (name in IDENTITY) {
          const v = arg.endsWith("%") ? parseFloat(arg) / 100 : name === "hue-rotate" ? parseFloat(arg) : parseFloat(arg);
          if (!isNaN(v) && Math.abs(v - IDENTITY[name]) > 0.01) res.raster = `filter: ${name}`;
        } else {
          res.raster = `filter: ${name}`;
        }
      }
      return res;
    }
    function transformNeedsRaster(style2) {
      const rotate = style2.rotate;
      if (rotate && rotate !== "none" && parseFloat(rotate) !== 0) return "rotate";
      const t = style2.transform;
      if (!t || t === "none") return null;
      const inner = t.slice(t.indexOf("(") + 1, t.lastIndexOf(")"));
      const nums = inner.split(",").map((v) => parseFloat(v));
      let a, b, c, d;
      if (t.startsWith("matrix3d(") && nums.length === 16) {
        if (Math.abs(nums[2]) > 1e-4 || Math.abs(nums[6]) > 1e-4) return "transform 3D";
        if (Math.abs(nums[3]) > 1e-4 || Math.abs(nums[7]) > 1e-4 || Math.abs(nums[11]) > 1e-4) return "transform 3D";
        [a, b, c, d] = [nums[0], nums[1], nums[4], nums[5]];
      } else if (t.startsWith("matrix(") && nums.length === 6) {
        [a, b, c, d] = nums;
      } else return null;
      if (Math.abs(b) > 1e-3 || Math.abs(c) > 1e-3) return "transform: rotación/inclinación";
      if (a < 0 || d < 0) return "transform: volteado";
      return null;
    }
    function effectsNeedingRaster(style2, filterInfo2) {
      if (filterInfo2.raster) return filterInfo2.raster;
      const tr = transformNeedsRaster(style2);
      if (tr) return tr;
      const clip = style2.clipPath;
      if (clip && clip !== "none" && !/^inset\(/.test(clip)) return "clip-path";
      const mask = style2.maskImage || style2.webkitMaskImage;
      if (mask && mask !== "none") return "mask";
      if (/repeating-(linear|radial|conic)-gradient/.test(style2.backgroundImage || "")) return "degradado repetido";
      return null;
    }
    function textEffects(style2) {
      const out = {};
      const ts = parseShadowParts(style2.textShadow, false);
      if (ts.length) out.textShadow = ts;
      const blend = BLEND_MODES[style2.mixBlendMode];
      if (blend) out.blendMode = blend;
      return out;
    }
    function extractPseudoElement(element2, pseudo, parentRect2, parentLayout2, counter2) {
      try {
        const style2 = window.getComputedStyle(element2, pseudo);
        const content = style2.content;
        const hasContent = content && content !== "none" && content !== "normal" && content !== '""' && content !== "''";
        if (style2.display === "none") return null;
        if (!content || content === "none" || content === "normal") return null;
        const bg = parseColor(style2.backgroundColor);
        let w = parseFloat(style2.width) || 0;
        let h = parseFloat(style2.height) || 0;
        const bgUrl = extractBgUrl(style2.backgroundImage);
        const decoGrads = parseAllGradients(style2.backgroundImage);
        const hasBgGrad = decoGrads.length > 0;
        const topBW = parseFloat(style2.borderTopWidth) || 0;
        const rightBW2 = parseFloat(style2.borderRightWidth) || 0;
        const bottomBW = parseFloat(style2.borderBottomWidth) || 0;
        const leftBW2 = parseFloat(style2.borderLeftWidth) || 0;
        const maxBW2 = Math.max(topBW, rightBW2, bottomBW, leftBW2);
        const hasBorder2 = maxBW2 > 0;
        if (w <= 0 && (leftBW2 > 0 || rightBW2 > 0)) w = Math.max(leftBW2, rightBW2);
        if (h <= 0 && (topBW > 0 || bottomBW > 0)) h = Math.max(topBW, bottomBW);
        if (h <= 0 && parentRect2 && (leftBW2 > 0 || rightBW2 > 0)) h = Math.round(parentRect2.height);
        if (w <= 0 && parentRect2 && (topBW > 0 || bottomBW > 0)) w = Math.round(parentRect2.width);
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
              cornerRadius: parseCornerRadius(style2),
              imageScaleMode: bgScaleMode(style2)
            },
            children: []
          };
          pNode._pendingBgImageSrc = bgUrl;
          return pNode;
        }
        if (!hasContent) {
          if ((!bg || bg.a <= 0.05) && !hasBgGrad && !hasBorder2) return null;
          if (w <= 0 || h <= 0) return null;
        }
        const rawText = (content || "").replace(/^['"]|['"]$/g, "").trim();
        const tc = parseColor(style2.color) || { r: 0.1, g: 0.1, b: 0.1, a: 1 };
        const isPosAbs = style2.position === "absolute" || style2.position === "fixed";
        if (rawText.length > 0) {
          if (isIconFont(style2.fontFamily, rawText) && w > 0 && h > 0) {
            const iconImg = renderIconFontToDataUrl(rawText, style2, w, h);
            const iconNode = {
              id: "pseudo_" + ++counter2.id,
              name: "Icon / " + (pseudo === "::before" ? "Before" : "After"),
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
                fills: [],
                cornerRadius: parseCornerRadius(style2)
              },
              children: []
            };
            if (iconImg) iconNode.imageData = iconImg;
            else {
              iconNode._needsShot = true;
              iconNode._vpRect = vpRectOf(parentRect2);
            }
            return iconNode;
          }
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
              fontFamily: style2.fontFamily ? style2.fontFamily.split(",")[0].replace(/['"]/g, "").trim() : "Inter",
              fontStack: style2.fontFamily || void 0
            }
          };
        } else if (w > 0 && h > 0 && (bg && bg.a > 0.05 || hasBgGrad || hasBorder2)) {
          const gridTile2 = generateGridPatternTile(style2.backgroundImage, style2.backgroundSize);
          if (gridTile2) {
            return {
              id: "pseudo_" + ++counter2.id,
              name: pseudo === "::before" ? "Grid / Before" : "Grid / After",
              type: "FRAME",
              layout: {
                mode: "NONE",
                padding: { top: 0, right: 0, bottom: 0, left: 0 },
                itemSpacing: 0,
                width: Math.max(1, Math.round(w)),
                height: Math.max(1, Math.round(h)),
                positioning: isPosAbs ? "ABSOLUTE" : "AUTO",
                ...isPosAbs ? pseudoPosition(element2, style2, w, h) || {} : {}
              },
              styles: {
                // color de fondo debajo, mosaico en medio y el resto de capas (viñetas) encima
                fills: [
                  ...bg && bg.a > 0.01 ? [bg] : [],
                  ...gradientsExcept(style2.backgroundImage, gridTile2.layers)
                ],
                imageScaleMode: "TILE",
                cornerRadius: parseCornerRadius(style2)
              },
              imageData: gridTile2.tile,
              children: []
            };
          }
          const decoFills = decoGrads.length > 0 ? decoGrads : bg && bg.a > 0.01 ? [bg] : [];
          const decoStrokes = [];
          let borderSides2 = void 0;
          if (hasBorder2) {
            const borderColorStr = (leftBW2 > 0 ? style2.borderLeftColor : "") || (topBW > 0 ? style2.borderTopColor : "") || (bottomBW > 0 ? style2.borderBottomColor : "") || (rightBW2 > 0 ? style2.borderRightColor : "") || style2.borderColor || style2.color;
            const strokeColor2 = parseColor(borderColorStr, style2.color) || { r: 0.1, g: 0.8, b: 0.5, a: 1 };
            const sideStyles = [
              topBW > 0 ? style2.borderTopStyle : "",
              rightBW2 > 0 ? style2.borderRightStyle : "",
              bottomBW > 0 ? style2.borderBottomStyle : "",
              leftBW2 > 0 ? style2.borderLeftStyle : "",
              style2.borderStyle
            ].filter((s) => s && s !== "none");
            const bStyle2 = sideStyles.find((s) => s === "dashed" || s === "dotted") || sideStyles[0] || "solid";
            const strokeDashStyle2 = bStyle2 === "dashed" ? "DASHED" : bStyle2 === "dotted" ? "DOTTED" : "SOLID";
            decoStrokes.push({ ...strokeColor2, width: maxBW2 || 1, align: "INSIDE", style: strokeDashStyle2 });
            if (topBW !== rightBW2 || topBW !== bottomBW || topBW !== leftBW2) {
              borderSides2 = {
                top: Math.round(topBW),
                right: Math.round(rightBW2),
                bottom: Math.round(bottomBW),
                left: Math.round(leftBW2)
              };
            }
          }
          return {
            id: "pseudo_" + ++counter2.id,
            name: pseudo === "::before" ? "Decorator / Before" : "Decorator / After",
            type: "FRAME",
            layout: {
              mode: "NONE",
              padding: { top: 0, right: 0, bottom: 0, left: 0 },
              itemSpacing: 0,
              width: Math.max(1, Math.round(w)),
              height: Math.max(1, Math.round(h)),
              positioning: isPosAbs ? "ABSOLUTE" : "AUTO",
              ...isPosAbs ? pseudoPosition(element2, style2, Math.max(1, w), Math.max(1, h)) || {} : {}
            },
            styles: {
              fills: decoFills,
              strokes: decoStrokes,
              borderSides: borderSides2,
              cornerRadius: parseCornerRadius(style2)
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
        const cleanClasses = rawClass.split(/\s+/).filter((c) => {
          if (/^(mb-|mt-|ml-|mr-|p-|px-|py-|w-|h-|flex|grid|block|inline|relative|absolute|text-|bg-|border-|rounded-|ng-|mat-|cursor-|transition-|duration-|hover:|focus:)/.test(
            c
          ))
            return false;
          return !/^(svelte|astro|css|sc|jsx|emotion)-[A-Za-z0-9]+$/.test(c);
        }).map(localClassName).filter(Boolean);
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
      const origVectors = element.querySelectorAll("path, circle, rect, polygon, polyline, line, ellipse, text");
      const cloneVectors = svgClone.querySelectorAll("path, circle, rect, polygon, polyline, line, ellipse, text");
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
        const explicitFill = ov.getAttribute("fill") || "";
        const explicitStroke = ov.getAttribute("stroke") || "";
        const urlRef = (v) => (String(v || "").match(/url\(\s*["']?[^#"')]*#([^)"']+)["']?\s*\)/) || [])[1] || null;
        const fillRef = urlRef(explicitFill) || urlRef(vFill);
        const strokeRef = urlRef(explicitStroke) || urlRef(vStroke);
        const inlineDef = (id) => {
          if (!id) return false;
          const defEl = document.getElementById(id);
          if (!defEl) return false;
          let defs = svgClone.querySelector("defs");
          if (!defs) {
            defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
            svgClone.insertBefore(defs, svgClone.firstChild);
          }
          if (!svgClone.querySelector("#" + CSS.escape(id))) defs.appendChild(defEl.cloneNode(true));
          return true;
        };
        const setPaint = (attr, c, cssOpacity) => {
          const hex = (v) => Math.round(v * 255).toString(16).padStart(2, "0");
          cv.setAttribute(attr, "#" + hex(c.r) + hex(c.g) + hex(c.b));
          const alpha = (c.a !== void 0 ? c.a : 1) * (parseFloat(cssOpacity) >= 0 ? parseFloat(cssOpacity) : 1);
          if (alpha < 1) cv.setAttribute(attr + "-opacity", String(Math.round(alpha * 1e3) / 1e3));
          else cv.removeAttribute(attr + "-opacity");
        };
        if (fillRef && inlineDef(fillRef)) {
          cv.setAttribute("fill", `url(#${fillRef})`);
        } else if (vFill && vFill !== "none" && vFill !== "transparent") {
          const defaultBlackOnOutline = hasStroke && !explicitFill && /^rgb\(0,\s*0,\s*0\)$/.test(vFill);
          const pf = defaultBlackOnOutline ? null : (fillRef ? null : parseColor(vFill, style.color)) || parseColor(explicitFill, style.color) || cc;
          if (pf && pf.a > 0.01) setPaint("fill", pf, vs.fillOpacity);
          else cv.setAttribute("fill", "none");
        } else {
          cv.setAttribute("fill", "none");
        }
        const applyStrokeGeometry = () => {
          cv.setAttribute(
            "stroke-width",
            vs.strokeWidth && vs.strokeWidth !== "0px" ? vs.strokeWidth : svgCompStyle.strokeWidth || "2"
          );
          cv.setAttribute("stroke-linecap", vs.strokeLinecap || "round");
          cv.setAttribute("stroke-linejoin", vs.strokeLinejoin || "round");
        };
        if (strokeRef && inlineDef(strokeRef)) {
          cv.setAttribute("stroke", `url(#${strokeRef})`);
          applyStrokeGeometry();
        } else if (hasStroke) {
          const usable = (v) => !!v && v !== "none" && !urlRef(v);
          const strokeColorStr = usable(vStroke) ? vStroke : usable(svgCompStyle.stroke) ? svgCompStyle.stroke : style.color;
          const ps = parseColor(strokeColorStr, style.color) || cc;
          setPaint("stroke", ps, vs.strokeOpacity);
          applyStrokeGeometry();
        }
        const elOpacity = parseFloat(vs.opacity);
        if (elOpacity >= 0 && elOpacity < 1) cv.setAttribute("opacity", String(elOpacity));
        const explicitDash = ov.getAttribute("stroke-dasharray");
        const compDash = vs.strokeDasharray && vs.strokeDasharray !== "none" ? vs.strokeDasharray : "";
        const svgDash = svgCompStyle.strokeDasharray && svgCompStyle.strokeDasharray !== "none" ? svgCompStyle.strokeDasharray : "";
        const dash = explicitDash || compDash || svgDash;
        if (dash && dash !== "none") {
          cv.setAttribute("stroke-dasharray", dash);
        }
        const explicitOffset = ov.getAttribute("stroke-dashoffset");
        const compOffset = vs.strokeDashoffset && vs.strokeDashoffset !== "none" && vs.strokeDashoffset !== "0px" ? vs.strokeDashoffset : "";
        const offset = explicitOffset || compOffset;
        if (offset) {
          cv.setAttribute("stroke-dashoffset", offset);
        }
      }
      const SVG_NS2 = "http://www.w3.org/2000/svg";
      const origUses = element.querySelectorAll("use");
      const cloneUses = svgClone.querySelectorAll("use");
      for (let ui = 0; ui < cloneUses.length; ui++) {
        const u = cloneUses[ui];
        const href = u.getAttribute("href") || u.getAttribute("xlink:href") || "";
        if (!href.startsWith("#")) continue;
        const targetEl = document.getElementById(href.slice(1));
        if (!targetEl) continue;
        const us = window.getComputedStyle(origUses[ui] || element);
        const x = u.getAttribute("x") || "0";
        const y = u.getAttribute("y") || "0";
        let replacement;
        if (targetEl.tagName.toLowerCase() === "symbol") {
          replacement = document.createElementNS(SVG_NS2, "svg");
          for (const attr of ["viewBox", "preserveAspectRatio"]) {
            const v = targetEl.getAttribute(attr);
            if (v) replacement.setAttribute(attr, v);
          }
          replacement.setAttribute("x", x);
          replacement.setAttribute("y", y);
          replacement.setAttribute("width", u.getAttribute("width") || "100%");
          replacement.setAttribute("height", u.getAttribute("height") || "100%");
          for (const ch of Array.from(targetEl.childNodes)) replacement.appendChild(ch.cloneNode(true));
        } else {
          replacement = document.createElementNS(SVG_NS2, "g");
          const copy = targetEl.cloneNode(true);
          copy.removeAttribute("id");
          replacement.appendChild(copy);
          if (x !== "0" || y !== "0") replacement.setAttribute("transform", `translate(${x} ${y})`);
        }
        if (us.fill && us.fill !== "none" && !us.fill.includes("url(")) replacement.setAttribute("fill", us.fill);
        else if (us.fill === "none") replacement.setAttribute("fill", "none");
        if (us.stroke && us.stroke !== "none" && !us.stroke.includes("url(")) {
          replacement.setAttribute("stroke", us.stroke);
          if (us.strokeWidth) replacement.setAttribute("stroke-width", us.strokeWidth);
        }
        const resolvedColor = us.color || style.color;
        for (const node2 of [replacement, ...Array.from(replacement.querySelectorAll("*"))]) {
          for (const attr of ["fill", "stroke", "stop-color"]) {
            if ((node2.getAttribute(attr) || "").toLowerCase() === "currentcolor") node2.setAttribute(attr, resolvedColor);
          }
        }
        let finalNode = replacement;
        const useTransform = u.getAttribute("transform");
        if (useTransform) {
          finalNode = document.createElementNS(SVG_NS2, "g");
          finalNode.setAttribute("transform", useTransform);
          finalNode.appendChild(replacement);
        }
        u.parentNode?.replaceChild(finalNode, u);
      }
      let w = Math.max(1, Math.round(rect.width) || 24);
      let h = Math.max(1, Math.round(rect.height) || 24);
      if (Math.abs(w - h) <= 6 && Math.min(w, h) >= 14) {
        const squareSize = Math.min(w, h);
        w = squareSize;
        h = squareSize;
      }
      svgClone.setAttribute("width", String(w));
      svgClone.setAttribute("height", String(h));
      const vbAttr = (svgClone.getAttribute("viewBox") || "").trim();
      if (!vbAttr) {
        svgClone.setAttribute("viewBox", `0 0 ${w} ${h}`);
      } else if (/^none\b/.test((svgClone.getAttribute("preserveAspectRatio") || "").trim())) {
        const vb = vbAttr.split(/[\s,]+/).map(parseFloat);
        if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) {
          const sx = w / vb[2];
          const sy = h / vb[3];
          if (Math.abs(sx - sy) > 1e-3) {
            const g = document.createElementNS(SVG_NS2, "g");
            g.setAttribute("transform", `matrix(${sx} 0 0 ${sy} ${-vb[0] * sx} ${-vb[1] * sy})`);
            for (const ch of Array.from(svgClone.childNodes)) {
              if (!(ch.nodeType === Node.ELEMENT_NODE && ch.localName === "defs")) g.appendChild(ch);
            }
            svgClone.appendChild(g);
            svgClone.setAttribute("viewBox", `0 0 ${w} ${h}`);
            svgClone.removeAttribute("preserveAspectRatio");
          }
        }
      }
      let raw = svgClone.outerHTML;
      raw = raw.replace(/currentColor/gi, ccHex);
      raw = raw.replace(/var\(--[a-zA-Z0-9_-]+,\s*([^)]+)\)/g, "$1");
      raw = raw.replace(/style="[^"]*"/gi, "");
      raw = raw.replace(/\s+(ng-reflect-[a-z-]+|_ng[a-z]+-[a-z0-9-]+|data-mat-icon-[a-z]+|class)="[^"]*"/gi, "");
      const svgRadius = parseCornerRadius(style);
      const svgBg = parseColor(style.backgroundColor);
      const svgStyles = { fills: [] };
      if (svgBg && svgBg.a > 0.01) svgStyles.fills.push(svgBg);
      if (hasAnyRadius(svgRadius)) svgStyles.cornerRadius = svgRadius;
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
        styles: svgStyles,
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
          cornerRadius: parseCornerRadius(style),
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
      const imgRadius = parseCornerRadius(imgFitStyle);
      const nodeImgRadius = hasAnyRadius(imgRadius) ? imgRadius : parseCornerRadius(style);
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
          cornerRadius: nodeImgRadius,
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
    const grads = parseAllGradients(style.backgroundImage);
    const pendingBgSrc = extractBgUrl(style.backgroundImage);
    const bgColor = parseColor(style.backgroundColor);
    if (bgColor && bgColor.a > 0.01) fills.push(bgColor);
    if (grads.length > 0) fills.push(...grads);
    const topW = Math.round(parseFloat(style.borderTopWidth) || 0);
    const rightBW = Math.round(parseFloat(style.borderRightWidth) || 0);
    const bottomW = Math.round(parseFloat(style.borderBottomWidth) || 0);
    let leftBW = Math.round(parseFloat(style.borderLeftWidth) || 0);
    const hasBorder = topW > 0 && style.borderTopStyle !== "none" || rightBW > 0 && style.borderRightStyle !== "none" || bottomW > 0 && style.borderBottomStyle !== "none" || leftBW > 0 && style.borderLeftStyle !== "none";
    const topColor = parseColor(style.borderTopColor, style.color);
    const bottomColor = parseColor(style.borderBottomColor, style.color);
    const leftColor = parseColor(style.borderLeftColor, style.color);
    const rightColor = parseColor(style.borderRightColor, style.color);
    let activeStrokeColor = null;
    if (leftBW > 0 && leftColor && leftColor.a > 0.01) activeStrokeColor = leftColor;
    else if (topW > 0 && topColor && topColor.a > 0.01) activeStrokeColor = topColor;
    else if (bottomW > 0 && bottomColor && bottomColor.a > 0.01) activeStrokeColor = bottomColor;
    else if (rightBW > 0 && rightColor && rightColor.a > 0.01) activeStrokeColor = rightColor;
    let strokeColor = activeStrokeColor || topColor || leftColor || bottomColor || rightColor;
    const borderStyles = [
      topW > 0 ? style.borderTopStyle : "",
      rightBW > 0 ? style.borderRightStyle : "",
      bottomW > 0 ? style.borderBottomStyle : "",
      leftBW > 0 ? style.borderLeftStyle : "",
      style.borderTopStyle,
      style.borderRightStyle,
      style.borderBottomStyle,
      style.borderLeftStyle
    ].filter((s) => s && s !== "none");
    const dashOf = (s) => s === "dashed" ? "DASHED" : s === "dotted" ? "DOTTED" : "SOLID";
    const bStyle = borderStyles.find((s) => s === "dashed" || s === "dotted") || borderStyles[0] || "solid";
    let strokeDashStyle = dashOf(bStyle);
    let accentBorder = void 0;
    const refSide = topW > 0 ? { w: topW, c: topColor, s: style.borderTopStyle } : rightBW > 0 ? { w: rightBW, c: rightColor, s: style.borderRightStyle } : bottomW > 0 ? { w: bottomW, c: bottomColor, s: style.borderBottomStyle } : null;
    if (refSide && refSide.c && leftBW > 0 && leftColor && leftColor.a > 0.01) {
      const rc = refSide.c;
      const distinctColor = Math.abs(leftColor.r - rc.r) > 0.08 || Math.abs(leftColor.g - rc.g) > 0.08 || Math.abs(leftColor.b - rc.b) > 0.08 || Math.abs((leftColor.a ?? 1) - (rc.a ?? 1)) > 0.15;
      const distinctWidth = leftBW !== refSide.w;
      const distinctStyle = style.borderLeftStyle !== refSide.s;
      if (distinctColor || distinctWidth || distinctStyle) {
        accentBorder = { side: "LEFT", color: leftColor, width: leftBW, style: dashOf(style.borderLeftStyle) };
        strokeColor = rc;
        strokeDashStyle = dashOf(refSide.s);
        leftBW = 0;
      }
    }
    const strokes = [];
    let borderSides = void 0;
    const maxBW = Math.max(topW, rightBW, bottomW, leftBW);
    if (hasBorder && strokeColor && strokeColor.a > 0.01) {
      strokes.push({ ...strokeColor, width: maxBW || 1, align: "INSIDE", style: strokeDashStyle });
      if (topW !== rightBW || topW !== bottomW || topW !== leftBW) {
        borderSides = { top: topW, right: rightBW, bottom: bottomW, left: leftBW };
      }
    }
    const cornerRadius = parseCornerRadius(style);
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
    const layoutKids = boxChildren(element);
    let mode = "NONE";
    let itemSpacing = 0;
    let primaryAlign = "MIN";
    let counterAlign = "MIN";
    let layoutWrap = "NO_WRAP";
    let gridAsWrap = false;
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
      if (hasAreas) {
        mode = "NONE";
      } else if (cols.length > 1 && (rows.length > 1 || layoutKids.length > cols.length)) {
        mode = "HORIZONTAL";
        layoutWrap = "WRAP";
        gridAsWrap = true;
        itemSpacing = Math.round(parseFloat(style.columnGap || style.gap) || 0);
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
      if (layoutKids.length >= 2) {
        mode = "VERTICAL";
        itemSpacing = Math.round(parseFloat(style.gap) || 0);
      }
    }
    const visibleChildren = layoutKids.filter((ch) => {
      const cs = window.getComputedStyle(ch);
      return cs.display !== "none" && cs.visibility !== "hidden" && parseFloat(cs.opacity) > 0;
    });
    const elArea = Math.max(1, rect.width * rect.height);
    const hasCanvasOrViewer = layoutKids.some((c) => {
      if (!c.matches("canvas, video, model-viewer, [data-engine]")) return false;
      const cr = c.getBoundingClientRect();
      return cr.width * cr.height >= elArea * 0.5;
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
          if (hasCanvasOrViewer) {
            mode = "NONE";
          } else {
            const rects = inFlowChildren.map((ch) => ch.getBoundingClientRect()).filter((r) => r.width > 0 || r.height > 0);
            const TOL2 = 4;
            const byTop = [...rects].sort((a, b) => a.top - b.top);
            const byLeft = [...rects].sort((a, b) => a.left - b.left);
            let isVerticalStack = rects.length >= 2;
            let isHorizontalStack = rects.length >= 2;
            for (let i = 0; i < rects.length - 1; i++) {
              if (byTop[i + 1].top < byTop[i].top + 8) isVerticalStack = false;
              const a = byLeft[i], b = byLeft[i + 1];
              const shareRow = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > TOL2;
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
      const textLeaf = {
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
        styles: { fills: [tc], ...textEffects(style) },
        textData: {
          characters: rawText,
          fontSize: Math.round(fontSize),
          fontWeight: style.fontWeight || 400,
          fontFamily: cleanFontFamily,
          // Pila CSS completa: el plugin prueba cada familia en orden (fase 5.3)
          fontStack: style.fontFamily || void 0,
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
      const textOut = splitTextAroundFloats(textLeaf, rich, measuredW2);
      textOut._paint = paintLayerOf(element, style);
      return textOut;
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
    const hugFitsWidth = (() => {
      let left = Infinity, right = -Infinity;
      for (const n of Array.from(element.childNodes)) {
        let r = null;
        if (n.nodeType === Node.TEXT_NODE && (n.textContent || "").trim()) {
          const rg = document.createRange();
          rg.selectNodeContents(n);
          r = rg.getBoundingClientRect();
        } else if (n.nodeType === Node.ELEMENT_NODE) {
          r = n.getBoundingClientRect();
        }
        if (r && r.width > 0) {
          left = Math.min(left, r.left);
          right = Math.max(right, r.right);
        }
      }
      if (!isFinite(left)) return true;
      const chrome2 = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0) + (parseFloat(style.borderLeftWidth) || 0) + (parseFloat(style.borderRightWidth) || 0);
      return measuredW <= right - left + chrome2 + 2;
    })();
    if (isBadge) {
      initialWidth = hugFitsWidth ? "HUG" : measuredW;
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
    if ((tagName === "button" || semanticName.startsWith("Button") || semanticName.startsWith("Badge") || isBadge) && !isSearchOrFullWidth && !style.width?.includes("%") && measuredW < 250 && hugFitsWidth) {
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
        accentBorder: accentBorder || void 0,
        cornerRadius,
        opacity: parseFloat(style.opacity) || 1,
        boxShadow,
        backdropBlur
      },
      children: [],
      // Recorte según el CSS (overflow): si la web recorta, Figma también; si no, el contenido desbordado se ve
      clipsContent: isWholePage || CLIPPING_OVERFLOW.test(style.overflowX) || CLIPPING_OVERFLOW.test(style.overflowY) ? true : void 0
    };
    node._paint = paintLayerOf(element, style);
    const filterInfo = parseCssFilter(style.filter);
    if (filterInfo.layerBlur) node.styles.layerBlur = Math.round(filterInfo.layerBlur * 10) / 10;
    if (filterInfo.dropShadows.length) node.styles.dropShadows = filterInfo.dropShadows;
    if (filterInfo.opacity < 1) node.styles.opacity = Math.round(node.styles.opacity * filterInfo.opacity * 1e3) / 1e3;
    const blendMode = BLEND_MODES[style.mixBlendMode];
    if (blendMode) node.styles.blendMode = blendMode;
    const gridTile = generateGridPatternTile(style.backgroundImage, style.backgroundSize);
    let rasterReason = effectsNeedingRaster(style, filterInfo);
    if (rasterReason === "degradado repetido" && gridTile) {
      const repeating = splitCssList(style.backgroundImage).map((l, i) => /^\s*repeating-/i.test(l) ? i : -1).filter((i) => i >= 0);
      if (repeating.every((i) => gridTile.layers.includes(i))) rasterReason = null;
    }
    if (rasterReason) {
      node.metadata = { ...node.metadata || {}, cssEffect: rasterReason };
      const vpArea = (window.innerWidth || 1440) * (window.innerHeight || 900);
      const hasRichUiChildren = element.children.length > 1 && (!!element.querySelector('p, h1, h2, h3, h4, h5, h6, button, a, [role="button"], input, article, section') || element.querySelectorAll("div, span, p, a, button").length >= 4);
      if (!hasRichUiChildren && rect.width > 2 && rect.height > 2 && rect.width * rect.height <= vpArea * 1.5) {
        node._rasterize = rasterReason;
        node._vpRect = vpRectOf(rect);
      }
    }
    if (gridTile) {
      node.styles.fills = [
        ...node.styles.fills.filter((f) => !grads.includes(f)),
        ...gradientsExcept(style.backgroundImage, gridTile.layers)
      ];
      node.imageData = gridTile.tile;
      node.styles.imageScaleMode = "TILE";
    } else if (pendingBgSrc) {
      node._pendingBgImageSrc = pendingBgSrc;
      node.styles.imageScaleMode = bgScaleMode(style);
      node._vpRect = vpRectOf(rect);
    }
    const inlineRichRoot = !!(isDirectText && rich && rich.characters && element.children.length > 0);
    if (element.children.length === 0 || inlineRichRoot) {
      let txt = (element.textContent || "").trim();
      txt = transformText(txt, style.textTransform);
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
            fontFamily: style.fontFamily ? style.fontFamily.split(",")[0].replace(/['"]/g, "").trim() : "Inter",
            fontStack: style.fontFamily || void 0
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
        const clsName = typeof element.className === "string" ? element.className : "";
        if (isIconFont(style.fontFamily, txt, clsName) && rect.width <= 128 && rect.height <= 128) {
          const iconImg = renderIconFontToDataUrl(txt, style, rect.width, rect.height);
          if (iconImg) {
            node.imageData = iconImg;
            node.name = "Icon / " + (txt.length > 20 ? "Glyph" : txt);
            node.styles.imageScaleMode = "FIT";
            return node;
          }
        }
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
        const leafBefore = pseudoHasImage(element, "::before") || inlineRichRoot ? extractPseudoElement(element, "::before", rect, currentLayout, counter) : null;
        const leafAfter = pseudoHasImage(element, "::after") || inlineRichRoot ? extractPseudoElement(element, "::after", rect, currentLayout, counter) : null;
        const inFlowPseudo = [leafBefore, leafAfter].some((p) => p && p.layout?.positioning !== "ABSOLUTE");
        if (inFlowPseudo) {
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
            fontStack: style.fontFamily || void 0,
            textAlign: textAlignment,
            lineHeight: style.lineHeight && style.lineHeight.endsWith("px") ? Math.round(parseFloat(style.lineHeight)) : void 0,
            isMultiline: labelRich.lines > 1,
            noWrap: labelRich.linesPreserved || void 0,
            lineCount: labelRich.lines,
            segments: labelRich.segments || void 0
          }
        });
        if (leafAfter) node.children.push(leafAfter);
        if (style.display === "table-cell") alignTableCell(node, style);
      } else {
        const decoBefore = extractPseudoElement(element, "::before", rect, currentLayout, counter);
        if (decoBefore) node.children.push(decoBefore);
        const decoAfter = extractPseudoElement(element, "::after", rect, currentLayout, counter);
        if (decoAfter) node.children.push(decoAfter);
      }
    } else {
      const beforeNode = extractPseudoElement(element, "::before", rect, currentLayout, counter);
      if (beforeNode) node.children.push(beforeNode);
      const kidsOf = (el) => {
        if (el.shadowRoot) return [...el.shadowRoot.childNodes];
        if (el.localName === "slot") {
          const a = el.assignedNodes({ flatten: true });
          return a.length ? a : [...el.childNodes];
        }
        return [...el.childNodes];
      };
      const expandBoxless = (nodes) => nodes.flatMap(
        (n) => n.nodeType === Node.ELEMENT_NODE && isBoxless(n) ? expandBoxless(kidsOf(n)) : [n]
      );
      const __kids = expandBoxless(kidsOf(element));
      const elementStyle = style;
      for (const child of __kids) {
        if (child.nodeType === Node.ELEMENT_NODE) {
          const cn = extractNodeTree(child, counter, rect, currentLayout);
          if (cn) node.children.push(cn);
        } else if (child.nodeType === Node.TEXT_NODE) {
          const parentEl = child.parentElement;
          const style2 = parentEl && parentEl !== element ? window.getComputedStyle(parentEl) : elementStyle;
          const ws = style2.whiteSpace || "normal";
          let raw = child.textContent || "";
          if (ws === "pre-line") raw = raw.replace(/[ \t\r\f]+/g, " ").replace(/ *\n */g, "\n");
          else if (!/^pre|break-spaces/.test(ws)) raw = raw.replace(/[ \t\n\r\f]+/g, " ");
          raw = raw.trim();
          if (raw.length > 0) {
            raw = transformText(raw, style2.textTransform);
            const tc = parseColor(style2.color) || { r: 0.1, g: 0.1, b: 0.1, a: 1 };
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
            const nodeFontSize = parseFloat(style2.fontSize) || 14;
            let nodeLh = void 0;
            if (style2.lineHeight && style2.lineHeight !== "normal") {
              const lhV = parseFloat(style2.lineHeight);
              if (!isNaN(lhV))
                nodeLh = style2.lineHeight.endsWith("px") ? Math.round(lhV) : Math.round(lhV * nodeFontSize);
            }
            const effLh = nodeLh || Math.round(nodeFontSize * 1.3);
            const isNodeMulti = th > effLh * 1.35 || raw.includes("\n");
            let nodeLs = void 0;
            if (style2.letterSpacing && style2.letterSpacing !== "normal") {
              const lsV = parseFloat(style2.letterSpacing);
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
                fontWeight: style2.fontWeight || 400,
                fontFamily: style2.fontFamily ? style2.fontFamily.split(",")[0].replace(/['"]/g, "").trim() : "Inter",
                fontStack: style2.fontFamily || void 0,
                lineHeight: nodeLh,
                letterSpacing: nodeLs,
                textAlign: style2.textAlign.includes("center") ? "CENTER" : style2.textAlign.includes("right") ? "RIGHT" : "LEFT",
                isMultiline: isNodeMulti,
                // Una sola línea en la web → una sola línea en Figma: si la fuente sustituta es más ancha,
                // el plugin no la parte (antes los textos sueltos junto a otros elementos se partían)
                noWrap: !isNodeMulti && tw > 0 ? true : void 0,
                lineCount: !isNodeMulti && tw > 0 ? 1 : void 0
              }
            });
          }
        }
      }
      const afterNode = extractPseudoElement(element, "::after", rect, currentLayout, counter);
      if (afterNode) node.children.push(afterNode);
    }
    if (node.children.length > 0) {
      let mb = 0;
      let mr = 0;
      for (const ch of node.children) {
        const cy = ch.layout?.y || 0;
        const ch2 = typeof ch.layout?.height === "number" ? ch.layout.height : ch.layout?.measuredHeight || 40;
        if (cy + ch2 > mb) mb = cy + ch2;
        const cx = ch.layout?.x || 0;
        const cw = typeof ch.layout?.width === "number" ? ch.layout.width : ch.layout?.measuredWidth || 40;
        if (cx + cw > mr) mr = cx + cw;
      }
      const curH = typeof node.layout.height === "number" ? node.layout.height : node.layout.measuredHeight || 0;
      const curW = typeof node.layout.width === "number" ? node.layout.width : node.layout.measuredWidth || 0;
      if (!node.clipsContent) {
        if (curH < 1 && mb > 0) {
          node.layout.height = mb;
          node.layout.measuredHeight = mb;
          node.styles.fills = [];
        }
        if (curW < 1 && mr > 0) {
          node.layout.width = mr;
          node.layout.measuredWidth = mr;
          node.styles.fills = [];
        }
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
    node._stack = createsStackingContext(element, style);
    node._escZ = escapingZ(node);
    const paintsItself = (node.styles.fills || []).length > 0 || (node.styles.strokes || []).length > 0 || (node.styles.boxShadow || []).length > 0 || !!node.styles.backdropBlur || !!node.imageData || !!node._pendingBgImageSrc || !!node._needsShot || !!node._rasterize;
    node._elevatable = !node._stack && !paintsItself;
    if (node.children.length > 1) sortByPaintOrder(node.children, mode);
    if (gridAsWrap) node._gridWrap = true;
    fitAutoLayoutToGeometry(node);
    if (node._gridWrap && !node._gridWrapOk) {
      node.layout.mode = "NONE";
      node.layout.layoutWrap = "NO_WRAP";
    }
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
    return node;
  }
  function paintLayerOf(element, style) {
    const z = parseInt(style.zIndex, 10);
    const positioned = style.position !== "static";
    let flexItemWithZ = false;
    if (!positioned && !isNaN(z) && element.parentElement) {
      flexItemWithZ = /flex|grid/.test(window.getComputedStyle(element.parentElement).display);
    }
    if (!positioned && !flexItemWithZ) return null;
    return isNaN(z) ? 0 : z;
  }
  function createsStackingContext(element, style) {
    const pos = style.position;
    if (pos === "fixed" || pos === "sticky") return true;
    if (pos !== "static" && style.zIndex !== "auto") return true;
    if (parseFloat(style.opacity) < 1) return true;
    const s = style;
    for (const prop of ["transform", "filter", "backdropFilter", "clipPath", "maskImage", "webkitMaskImage"]) {
      if (s[prop] && s[prop] !== "none") return true;
    }
    if (style.mixBlendMode && style.mixBlendMode !== "normal") return true;
    if (style.isolation === "isolate") return true;
    if (/transform|opacity|filter/.test(style.willChange || "")) return true;
    if (/paint|layout|strict|content/.test(style.contain || "")) return true;
    if (style.zIndex !== "auto" && element.parentElement) {
      return /flex|grid/.test(window.getComputedStyle(element.parentElement).display);
    }
    return false;
  }
  function escapingZ(node) {
    if (node._stack) return 0;
    let max = 0;
    for (const c of node.children || []) {
      const own = typeof c._paint === "number" && c._paint > 0 ? c._paint : 0;
      const inner = !c._stack && typeof c._escZ === "number" ? c._escZ : 0;
      max = Math.max(max, own, inner);
    }
    return max;
  }
  function paintKey(n) {
    let z = n._paint;
    if (n._elevatable && typeof n._escZ === "number" && n._escZ > 0 && (z === null || z === void 0 || z <= 0)) {
      z = n._escZ;
    }
    if (z === null || z === void 0) return [1, 0];
    if (z < 0) return [0, z];
    if (z === 0) return [2, 0];
    return [3, z];
  }
  function sortByPaintOrder(children, mode) {
    const indexed = children.map((c, i) => ({ c, i, k: paintKey(c) }));
    const byPaint = (a, b) => a.k[0] - b.k[0] || a.k[1] - b.k[1] || a.i - b.i;
    if (mode === "NONE") {
      indexed.sort(byPaint);
      indexed.forEach((x, i) => children[i] = x.c);
      return;
    }
    const isAbs = (c) => c.layout?.positioning === "ABSOLUTE";
    const flow = indexed.filter((x) => !isAbs(x.c));
    const keyLt = (a, b) => a[0] < b[0] || a[0] === b[0] && a[1] < b[1];
    const goesBelow = (x) => x.k[0] === 0 || flow.some((f) => keyLt(x.k, f.k));
    const below = indexed.filter((x) => isAbs(x.c) && goesBelow(x)).sort(byPaint);
    const above = indexed.filter((x) => isAbs(x.c) && !goesBelow(x)).sort(byPaint);
    [...below, ...flow, ...above].forEach((x, i) => children[i] = x.c);
  }

  // packages/core-extractor/src/browser/capture.ts
  var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  var nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
  var intersects = (a, b) => a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;
  function hideFloatingElements(keep) {
    const hidden = [];
    for (const el of Array.from(document.body ? document.body.querySelectorAll("*") : [])) {
      const pos = getComputedStyle(el).position;
      if (pos !== "fixed" && pos !== "sticky") continue;
      const r = el.getBoundingClientRect();
      const rect = { left: r.left, top: r.top, width: r.width, height: r.height };
      if (keep.some((k) => intersects(rect, k))) continue;
      hidden.push([el, el.style.getPropertyValue("visibility"), el.style.getPropertyPriority("visibility")]);
      el.style.setProperty("visibility", "hidden", "important");
    }
    return () => {
      for (const [el, value, priority] of hidden) {
        if (value) el.style.setProperty("visibility", value, priority);
        else el.style.removeProperty("visibility");
      }
    };
  }
  async function captureRegionsAcrossPage(rects, capture, options = {}) {
    const { minIntervalMs = 600, maxBands = 20, settleMs = 120 } = options;
    const out = rects.map(() => null);
    if (!rects.length) return out;
    const vh = window.innerHeight;
    const startX = window.scrollX;
    const startY = window.scrollY;
    let lastShot = 0;
    const shoot = async (idx, shifted) => {
      const wait = lastShot + minIntervalMs - Date.now();
      if (lastShot && wait > 0) await sleep(wait);
      lastShot = Date.now();
      const crops = await capture(shifted) || [];
      idx.forEach((i, k) => {
        out[i] = crops[k] || null;
      });
    };
    const visible = [];
    const offscreen = [];
    rects.forEach((r, i) => (r.top < vh && r.top + r.height > 0 ? visible : offscreen).push(i));
    if (visible.length)
      await shoot(
        visible,
        visible.map((i) => rects[i])
      );
    if (!offscreen.length) return out;
    const docTop = (i) => rects[i].top + startY;
    const pending = offscreen.slice().sort((a, b) => docTop(a) - docTop(b));
    const restoreFloating = hideFloatingElements(offscreen.map((i) => rects[i]));
    try {
      let bands = 0;
      while (pending.length && bands < maxBands) {
        bands++;
        const target = Math.max(0, docTop(pending[0]) - 16);
        window.scrollTo({ left: startX, top: target, behavior: "instant" });
        await nextFrame();
        await sleep(settleMs);
        const y = window.scrollY;
        const band = pending.filter((i) => docTop(i) >= y - 1 && docTop(i) < y + vh);
        if (!band.length) break;
        await shoot(
          band,
          band.map((i) => ({ ...rects[i], top: docTop(i) - y }))
        );
        for (const i of band) pending.splice(pending.indexOf(i), 1);
      }
    } finally {
      restoreFloating();
      window.scrollTo({ left: startX, top: startY, behavior: "instant" });
      await nextFrame();
    }
    return out;
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
    const vw = window.innerWidth;
    const shotNodes = [];
    (function collectShot(n) {
      const r = n._vpRect;
      if (n._rasterize && r && r.width > 2 && r.height > 2 && r.left < vw && r.left + r.width > 0) {
        shotNodes.push(n);
        return;
      }
      if (!n.imageData && r && (n._needsShot || n._hadPendingImage) && (!n.children || n.children.length === 0) && r.width > 2 && r.height > 2 && r.left < vw && r.left + r.width > 0) {
        shotNodes.push(n);
      }
      (n.children || []).forEach(collectShot);
    })(rootNode);
    if (shotNodes.length > 0 && typeof window.__codeToFigmaCaptureRegions === "function") {
      try {
        const crops = await captureRegionsAcrossPage(
          shotNodes.map((n) => n._vpRect),
          window.__codeToFigmaCaptureRegions
        );
        (crops || []).forEach((c, i) => {
          if (!isImageDataUri(c)) return;
          const n = shotNodes[i];
          n.imageData = c;
          if (n._rasterize) {
            n.children = [];
            n.styles = { ...n.styles, fills: [], strokes: [], boxShadow: [], borderSides: void 0 };
            n.layout = { ...n.layout, mode: "NONE" };
            n.metadata = { ...n.metadata || {}, rasterized: n._rasterize };
          }
        });
      } catch (_shotErr) {
        console.warn("[CodeToFigma] Captura de pantalla no disponible:", _shotErr);
      }
    }
    (function cleanup(n) {
      delete n._vpRect;
      delete n._needsShot;
      delete n._hadPendingImage;
      delete n._rasterize;
      delete n._gridWrap;
      delete n._gridWrapOk;
      delete n._paint;
      delete n._stack;
      delete n._escZ;
      delete n._elevatable;
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

  // packages/core-extractor/src/browser/states.ts
  var ATTR = "data-ctf-state";
  var PSEUDO = {
    hover: /:hover\b/g,
    focus: /:focus(?:-visible|-within)?\b/g
  };
  function collectRules(list, out) {
    for (const rule of Array.from(list)) {
      if (rule instanceof CSSStyleRule) out.push(rule);
      else if (rule instanceof CSSMediaRule) {
        if (window.matchMedia(rule.conditionText || rule.media.mediaText).matches) collectRules(rule.cssRules, out);
      } else if ("cssRules" in rule && rule.cssRules) {
        collectRules(rule.cssRules, out);
      }
    }
  }
  function mark(el, state) {
    const touched = [];
    for (let p = el; p; p = p.parentElement) {
      const prev = p.getAttribute(ATTR);
      touched.push([p, prev]);
      p.setAttribute(ATTR, prev ? `${prev} ${state}` : state);
    }
    return () => {
      for (const [p, prev] of touched) {
        if (prev === null) p.removeAttribute(ATTR);
        else p.setAttribute(ATTR, prev);
      }
    };
  }
  function emulateState(target, state) {
    const pseudo = PSEUDO[state];
    const rules = [];
    let unreadableSheets = 0;
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        collectRules(sheet.cssRules, rules);
      } catch (_e) {
        unreadableSheets++;
      }
    }
    const unmark = mark(target, state);
    const css = [];
    for (const rule of rules) {
      const sel = rule.selectorText || "";
      pseudo.lastIndex = 0;
      if (!pseudo.test(sel)) continue;
      const parts = sel.split(/,(?![^(]*\))/).filter((part) => {
        pseudo.lastIndex = 0;
        return pseudo.test(part);
      }).map((part) => part.replace(pseudo, `[${ATTR}~="${state}"]`).trim());
      const relevant = parts.filter((part) => {
        try {
          return target.matches(part) || !!target.querySelector(part);
        } catch (_e) {
          return false;
        }
      });
      if (relevant.length) css.push(`${relevant.join(", ")} { ${rule.style.cssText} }`);
    }
    if (!css.length) {
      unmark();
      return null;
    }
    const removeState = addSheet(css.join("\n"));
    const removeFreeze = addSheet(`[${ATTR}], [${ATTR}] * { transition: none !important; animation: none !important; }`);
    void target.getBoundingClientRect();
    return {
      rules: css.length,
      unreadableSheets,
      undo: () => {
        removeState();
        void window.getComputedStyle(target).color;
        void target.getBoundingClientRect();
        unmark();
        removeFreeze();
      }
    };
  }
  function addSheet(cssText) {
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(cssText);
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
      return () => {
        document.adoptedStyleSheets = document.adoptedStyleSheets.filter((x) => x !== sheet);
      };
    } catch (_e) {
      const style = document.createElement("style");
      style.textContent = cssText;
      (document.head || document.documentElement).appendChild(style);
      return () => style.remove();
    }
  }

  // packages/core-extractor/src/browser/export-html.ts
  var SVG_NS = "http://www.w3.org/2000/svg";
  var IDX = "data-ctf-i";
  var IMPORT_RE = /@import\s+(?:url\(\s*)?(['"]?)([^'")\s;]+)\1\s*\)?([^;]*);/gi;
  async function parseCssText(text, base, fetchCss, depth, out, unreadable, media = "") {
    const imports = [];
    const body = text.replace(IMPORT_RE, (_m, _q, url, cond) => {
      imports.push({ url: absUrl(url, base), media: (cond || "").trim() });
      return "";
    });
    for (const imp of imports) {
      if (depth > 3 || !fetchCss) {
        unreadable.push(imp.url);
        continue;
      }
      const sub = await safeFetch(fetchCss, imp.url);
      if (sub == null) unreadable.push(imp.url);
      else await parseCssText(sub, imp.url, fetchCss, depth + 1, out, unreadable, imp.media || media);
    }
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(body);
      out.push({ rules: Array.from(sheet.cssRules), base, media, loadText: async () => body });
    } catch (_e) {
      unreadable.push(base);
    }
  }
  async function safeFetch(fetchCss, url) {
    try {
      const t = await fetchCss(url);
      return typeof t === "string" ? t : null;
    } catch (_e) {
      return null;
    }
  }
  async function addSheet2(sheet, fetchCss, out, unreadable, depth) {
    if (sheet.disabled) return;
    const base = sheet.href || document.baseURI;
    const media = sheet.media && sheet.media.mediaText && sheet.media.mediaText !== "all" ? sheet.media.mediaText : "";
    let rules = null;
    try {
      rules = Array.from(sheet.cssRules);
    } catch (_e) {
      rules = null;
    }
    if (!rules) {
      const text = sheet.href && fetchCss ? await safeFetch(fetchCss, sheet.href) : null;
      if (text == null) {
        unreadable.push(sheet.href || "(hoja sin URL)");
        return;
      }
      await parseCssText(text, sheet.href, fetchCss, depth + 1, out, unreadable, media);
      return;
    }
    const own = [];
    for (const rule of rules) {
      if (rule instanceof CSSImportRule) {
        if (rule.styleSheet && depth < 4) await addSheet2(rule.styleSheet, fetchCss, out, unreadable, depth + 1);
        else if (rule.href) unreadable.push(absUrl(rule.href, base));
      } else own.push(rule);
    }
    const owner = sheet.ownerNode;
    const loadText = async () => {
      if (owner && owner.tagName && owner.tagName.toLowerCase() === "style") return owner.textContent;
      if (!sheet.href) return null;
      if (fetchCss) return safeFetch(fetchCss, sheet.href);
      try {
        const r = await fetch(sheet.href);
        return r.ok ? await r.text() : null;
      } catch (_e) {
        return null;
      }
    };
    out.push({ rules: own, base, media, loadText });
  }
  function losesDeclarations(rule) {
    return /(?:^|[;\s])(?!--)[a-z-]+:\s*(?:;|$)/.test(rule.style.cssText);
  }
  function needsRecovery(rules) {
    for (const r of rules) {
      if (r instanceof CSSStyleRule) {
        if (losesDeclarations(r)) return true;
      } else if (!(r instanceof CSSKeyframesRule) && r.cssRules) {
        if (needsRecovery(Array.from(r.cssRules))) return true;
      }
    }
    return false;
  }
  function normSelector(s) {
    return s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/::?(before|after|first-line|first-letter)\b/gi, "::$1").replace(/["']/g, "").replace(/\s*([>+~,()])\s*/g, "$1").replace(/\s+/g, " ").trim();
  }
  function scanStyleRules(text) {
    const out = [];
    const n = text.length;
    const skipString = (j) => {
      const q = text[j];
      for (let k = j + 1; k < n; k++) {
        if (text[k] === "\\") k++;
        else if (text[k] === q) return k;
      }
      return n;
    };
    const skipComment = (j) => {
      const e = text.indexOf("*/", j + 2);
      return e < 0 ? n : e + 1;
    };
    const blockEnd = (start) => {
      let depth = 0;
      for (let j = start; j < n; j++) {
        const ch = text[j];
        if (ch === "/" && text[j + 1] === "*") j = skipComment(j);
        else if (ch === '"' || ch === "'") j = skipString(j);
        else if (ch === "{") depth++;
        else if (ch === "}" && --depth === 0) return j + 1;
      }
      return n;
    };
    const walk = (from, to) => {
      let preludeStart = from;
      for (let j = from; j < to; j++) {
        const ch = text[j];
        if (ch === "/" && text[j + 1] === "*") j = skipComment(j);
        else if (ch === '"' || ch === "'") j = skipString(j);
        else if (ch === ";" || ch === "}") preludeStart = j + 1;
        else if (ch === "{") {
          const prelude = text.slice(preludeStart, j).replace(/\/\*[\s\S]*?\*\//g, "").trim();
          const end = blockEnd(j);
          if (!prelude.startsWith("@")) out.push([prelude, text.slice(j + 1, end - 1)]);
          else if (/^@(?:media|supports|layer|container|scope|document|starting-style)\b/i.test(prelude))
            walk(j + 1, end - 1);
          j = end - 1;
          preludeStart = end;
        }
      }
    };
    walk(0, n);
    return out;
  }
  function buildRecovery(text, rules) {
    const bySelector = /* @__PURE__ */ new Map();
    for (const [sel, body] of scanStyleRules(text)) {
      const k = normSelector(sel);
      const list = bySelector.get(k) || [];
      list.push(body);
      bySelector.set(k, list);
    }
    const seen = /* @__PURE__ */ new Map();
    const out = /* @__PURE__ */ new Map();
    const walk = (list) => {
      for (const r of list) {
        if (r instanceof CSSStyleRule) {
          const k = normSelector(r.selectorText || "");
          const nth = seen.get(k) || 0;
          seen.set(k, nth + 1);
          if (!losesDeclarations(r)) continue;
          const body = (bySelector.get(k) || [])[nth];
          if (body != null && /var\(/.test(body)) out.set(r, body.trim().replace(/;?\s*$/, ";"));
        } else if (!(r instanceof CSSKeyframesRule) && r.cssRules) {
          walk(Array.from(r.cssRules));
        }
      }
    };
    walk(rules);
    return out;
  }
  async function gatherSheets(fetchCss) {
    const sources = [];
    const unreadable = [];
    for (const sheet of Array.from(document.styleSheets)) {
      await addSheet2(sheet, fetchCss, sources, unreadable, 0);
    }
    for (const sheet of Array.from(document.adoptedStyleSheets || [])) {
      await addSheet2(sheet, fetchCss, sources, unreadable, 0);
    }
    return { sources, unreadable };
  }
  function absUrl(u, base) {
    const s = (u || "").trim();
    if (!s || /^(?:data|blob|javascript|mailto|tel|about):|^#/i.test(s)) return s;
    try {
      return new URL(s, base).href;
    } catch (_e) {
      return s;
    }
  }
  function absolutizeCss(css, base) {
    return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (m, q, u) => {
      const abs = absUrl(u, base);
      return abs === u ? m : `url(${q || '"'}${abs}${q || '"'})`;
    });
  }
  function absolutizeSrcset(v, base) {
    if (/data:/i.test(v)) return v;
    return v.split(",").map((part) => {
      const bits = part.trim().split(/\s+/);
      if (!bits[0]) return part.trim();
      bits[0] = absUrl(bits[0], base);
      return bits.join(" ");
    }).join(", ");
  }
  var NON_STRUCTURAL = /::?(?:hover|active|focus-visible|focus-within|focus|visited|target|before|after|placeholder|marker|selection|first-line|first-letter|backdrop|file-selector-button|-webkit-[\w-]+|-moz-[\w-]+)(?![\w-])|::(?:part|slotted|highlight|cue)\([^)]*\)/gi;
  function splitSelectors(sel) {
    const out = [];
    let depth = 0;
    let quote = "";
    let cur = "";
    for (const ch of sel) {
      if (quote) {
        if (ch === quote) quote = "";
      } else if (ch === '"' || ch === "'") quote = ch;
      else if (ch === "(" || ch === "[") depth++;
      else if (ch === ")" || ch === "]") depth--;
      else if (ch === "," && depth === 0) {
        out.push(cur.trim());
        cur = "";
        continue;
      }
      cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }
  function selectorTouches(part, ctx) {
    const hit = ctx.cache.get(part);
    if (hit !== void 0) return hit;
    let s = part.replace(NON_STRUCTURAL, "").trim();
    s = s.replace(/[>+~]\s*$/, "").trim();
    if (!s || /^[>+~]/.test(s)) s = s ? `* ${s}` : "*";
    let res;
    try {
      res = ctx.scope.some((el) => el.matches(s)) || ctx.root.querySelector(s) !== null;
    } catch (_e) {
      res = true;
    }
    ctx.cache.set(part, res);
    return res;
  }
  function filterRules(rules, base, ctx) {
    const out = [];
    for (const rule of rules) {
      if (rule instanceof CSSStyleRule) {
        ctx.total++;
        const parts = splitSelectors(rule.selectorText || "");
        const kept = parts.filter((p) => selectorTouches(p, ctx));
        if (!kept.length) continue;
        ctx.kept++;
        const nested = rule.cssRules && rule.cssRules.length > 0;
        const recovered = ctx.recover && ctx.recover.get(rule);
        const text = recovered ? `${kept.join(", ")} { ${recovered} }` : nested || kept.length === parts.length ? rule.cssText : `${kept.join(", ")} { ${rule.style.cssText} }`;
        out.push(absolutizeCss(text, base));
      } else if (rule instanceof CSSKeyframesRule) {
        ctx.keyframes.push({ name: rule.name, text: absolutizeCss(rule.cssText, base) });
      } else if (rule instanceof CSSFontFaceRule) {
        const family = (rule.style.getPropertyValue("font-family") || "").replace(/^['"]|['"]$/g, "").trim();
        ctx.fontFaces.push({ family, text: absolutizeCss(rule.cssText, base) });
      } else if (typeof CSSPropertyRule !== "undefined" && rule instanceof CSSPropertyRule) {
        ctx.properties.push({ name: rule.name, text: rule.cssText });
      } else if (typeof CSSLayerStatementRule !== "undefined" && rule instanceof CSSLayerStatementRule) {
        out.push(rule.cssText);
      } else if (rule instanceof CSSImportRule || rule instanceof CSSNamespaceRule || rule instanceof CSSPageRule) {
        continue;
      } else if (rule.cssRules) {
        const inner = filterRules(Array.from(rule.cssRules), base, ctx);
        if (inner.length) {
          const header = rule.cssText.slice(0, rule.cssText.indexOf("{")).trim();
          out.push(`${header} {
${inner.map((r) => "  " + r).join("\n")}
}`);
        }
      } else if (rule.cssText) {
        out.push(rule.cssText);
      }
    }
    return out;
  }
  function dedupeKeepLast(rules) {
    const last = /* @__PURE__ */ new Map();
    rules.forEach((r, i) => last.set(r, i));
    return rules.filter((r, i) => last.get(r) === i);
  }
  var DECL_VALUE = String.raw`((?:[^;"'(){}]|"[^"]*"|'[^']*'|\((?:[^()"']|"[^"]*"|'[^']*'|\((?:[^()]|\([^()]*\))*\))*\))*)`;
  var VAR_REF = /var\(\s*(--[\w-]+)/g;
  function pruneCustomProperties(css, html) {
    const declRe = new RegExp(String.raw`(--[\w-]+)\s*:\s*${DECL_VALUE}\s*(?:;|(?=\}))`, "g");
    const values = /* @__PURE__ */ new Map();
    const withoutCustom = css.replace(declRe, (_m, name, value) => {
      const list = values.get(name) || [];
      list.push(value);
      values.set(name, list);
      return "";
    });
    if (!values.size) return css;
    const used = /* @__PURE__ */ new Set();
    const queue = [];
    const scan = (text) => {
      for (const m of text.matchAll(VAR_REF)) {
        if (!used.has(m[1])) {
          used.add(m[1]);
          queue.push(m[1]);
        }
      }
    };
    scan(withoutCustom);
    scan(html);
    while (queue.length) for (const v of values.get(queue.pop()) || []) scan(v);
    let out = css.replace(declRe, (m, name) => used.has(name) ? m : "");
    for (let i = 0; i < 4; i++) {
      const next = out.replace(/(^|[;}\n])\s*[^{}@;]+\{\s*\}/g, "$1").replace(/@(?:media|supports|container|layer)[^{}]*\{\s*\}/g, "");
      if (next === out) break;
      out = next;
    }
    return out;
  }
  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  var URL_ATTRS = ["src", "href", "poster", "action", "formaction", "data", "background", "xlink:href"];
  function cleanAttributes(o, c, base) {
    for (const attr of Array.from(c.attributes)) {
      const n = attr.name.toLowerCase();
      if (n.startsWith("on") || n === "nonce" || n === "integrity" || n.startsWith("data-ctf") && n !== IDX) {
        c.removeAttribute(attr.name);
      }
    }
    for (const n of URL_ATTRS) {
      const v = c.getAttribute(n);
      if (v == null) continue;
      if (/^\s*javascript:/i.test(v)) c.setAttribute(n, "#");
      else c.setAttribute(n, absUrl(v, base));
    }
    for (const n of ["srcset", "imagesrcset"]) {
      const v = c.getAttribute(n);
      if (v) c.setAttribute(n, absolutizeSrcset(v, base));
    }
    const style = c.getAttribute("style");
    if (style && /url\(/i.test(style)) c.setAttribute("style", absolutizeCss(style, base));
    const tag = o.tagName.toLowerCase();
    if (tag === "img") {
      const img = o;
      if (img.currentSrc && !/^data:image\/gif/i.test(img.currentSrc)) {
        const src = c.getAttribute("src") || "";
        if (!src || /^data:image\/(gif|svg)/i.test(src)) c.setAttribute("src", img.currentSrc);
      }
    } else if (tag === "input") {
      const inp = o;
      if (inp.type === "checkbox" || inp.type === "radio") {
        if (inp.checked) c.setAttribute("checked", "");
        else c.removeAttribute("checked");
      } else if (inp.type !== "password" && inp.type !== "file" && inp.value) {
        c.setAttribute("value", inp.value);
      }
    } else if (tag === "textarea") {
      c.textContent = o.value;
    } else if (tag === "select") {
      const opts = o.options;
      const copts = c.querySelectorAll("option");
      for (let i = 0; i < opts.length && i < copts.length; i++) {
        if (opts[i].selected) copts[i].setAttribute("selected", "");
        else copts[i].removeAttribute("selected");
      }
    }
  }
  function classDiff(active, inactive) {
    if (!active || !inactive.length) return "";
    const common = (el) => new Set(Array.from(el.classList));
    const others = inactive.map(common);
    return Array.from(active.classList).filter((c) => others.every((s) => !s.has(c))).join(" ");
  }
  function annotateWidgets(root, origToClone, widgets) {
    const cloneOf = (el) => el ? origToClone.get(el) || null : null;
    const byId = (id) => {
      if (!id) return null;
      const el = root.ownerDocument.getElementById(id);
      return el && (el === root || root.contains(el)) ? el : null;
    };
    const visibleDisplay = (el) => {
      const d = getComputedStyle(el).display;
      return d && d !== "none" ? d : "";
    };
    for (const list of Array.from(root.querySelectorAll('[role="tablist"]'))) {
      const tabs = Array.from(list.querySelectorAll('[role="tab"]'));
      if (tabs.length < 2) continue;
      const active = tabs.find((t) => t.getAttribute("aria-selected") === "true") || null;
      const inactive = tabs.filter((t) => t !== active);
      const cl = cloneOf(list);
      if (!cl) continue;
      widgets.add("tabs");
      cl.setAttribute("data-ctf-w", "tabs");
      const tabClass = classDiff(active, inactive);
      if (tabClass) cl.setAttribute("data-ctf-on", tabClass);
      const panels = tabs.map((t) => byId(t.getAttribute("aria-controls")));
      const activePanel = active ? byId(active.getAttribute("aria-controls")) : null;
      const panelClass = classDiff(
        activePanel,
        panels.filter((p) => !!p && p !== activePanel)
      );
      if (panelClass) cl.setAttribute("data-ctf-panel-on", panelClass);
      if (activePanel) {
        const d = visibleDisplay(activePanel);
        if (d) cl.setAttribute("data-ctf-display", d);
      }
    }
    for (const btn of Array.from(root.querySelectorAll("[aria-expanded][aria-controls]"))) {
      if (btn.getAttribute("role") === "tab") continue;
      const target = byId(btn.getAttribute("aria-controls"));
      const cb = cloneOf(btn);
      if (!target || !cb) continue;
      widgets.add("disclosure");
      cb.setAttribute("data-ctf-w", "disclosure");
      const ct = cloneOf(target);
      const d = visibleDisplay(target);
      if (ct && d && btn.getAttribute("aria-expanded") === "true") ct.setAttribute("data-ctf-display", d);
    }
    for (const btn of Array.from(root.querySelectorAll("[data-bs-toggle], [data-toggle]"))) {
      const kind = btn.getAttribute("data-bs-toggle") || btn.getAttribute("data-toggle") || "";
      if (!["collapse", "dropdown", "tab", "pill"].includes(kind)) continue;
      const cb = cloneOf(btn);
      if (!cb) continue;
      widgets.add(`bootstrap-${kind}`);
      cb.setAttribute("data-ctf-w", `bs-${kind}`);
    }
  }
  function externalRefs(clone, root) {
    const ids = /* @__PURE__ */ new Set();
    const html = clone.outerHTML;
    for (const m of html.matchAll(/(?:xlink:)?href="#([^"]+)"/g)) ids.add(m[1]);
    for (const m of html.matchAll(/url\(\s*['"]?#([^'")]+)['"]?\s*\)/g)) ids.add(m[1]);
    const out = [];
    for (const id of ids) {
      const el = root.ownerDocument.getElementById(id);
      if (!el || el === root || root.contains(el)) continue;
      if (el.namespaceURI === SVG_NS) out.push(el);
    }
    return out;
  }
  function cloneBlock(root) {
    const base = document.baseURI;
    const clone = root.cloneNode(true);
    const origs = [];
    const origToClone = /* @__PURE__ */ new Map();
    const warnings = [];
    const pending = [];
    const walk = (o, c) => {
      if (o.nodeType !== Node.ELEMENT_NODE) return;
      const oe = o;
      const ce = c;
      ce.setAttribute(IDX, String(origs.length));
      origs.push(oe);
      origToClone.set(oe, ce);
      cleanAttributes(oe, ce, base);
      const tag = oe.tagName.toLowerCase();
      if (tag === "script" || tag === "noscript" || tag === "base" || tag === "meta" || oe.id === "__code_to_figma_root") {
        pending.push(() => ce.remove());
        return;
      }
      if (tag === "style" || tag === "link" && /stylesheet/i.test(oe.getAttribute("rel") || "")) {
        pending.push(() => ce.remove());
        return;
      }
      if (tag === "canvas") {
        try {
          const data = oe.toDataURL("image/png");
          pending.push(() => {
            const img = document.createElement("img");
            for (const a of Array.from(ce.attributes)) img.setAttribute(a.name, a.value);
            img.setAttribute("src", data);
            img.setAttribute("alt", "");
            ce.replaceWith(img);
          });
        } catch (_e) {
          warnings.push("Un lienzo (canvas) de otro dominio no se pudo copiar: queda vacío");
        }
      }
      const sr = oe.shadowRoot;
      if (sr) {
        pending.push(() => {
          const tpl = document.createElement("template");
          tpl.setAttribute("shadowrootmode", "open");
          let styles = "";
          for (const s of Array.from(sr.adoptedStyleSheets || [])) {
            try {
              styles += Array.from(s.cssRules).map((r) => r.cssText).join("\n");
            } catch (_e) {
            }
          }
          tpl.innerHTML = (styles ? `<style>${styles}</style>` : "") + sr.innerHTML;
          ce.insertBefore(tpl, ce.firstChild);
        });
      }
      const oc = o.childNodes;
      const cc = c.childNodes;
      for (let i = 0; i < oc.length && i < cc.length; i++) walk(oc[i], cc[i]);
    };
    walk(root, clone);
    const widgets = /* @__PURE__ */ new Set();
    annotateWidgets(root, origToClone, widgets);
    for (const fn of pending) fn();
    return { clone, origs, widgets, warnings };
  }
  function ancestorChain(root) {
    const chain = [];
    for (let p = root.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      chain.unshift(p);
    }
    return chain;
  }
  function escapeAttr(v) {
    return v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }
  function attrsOf(el, extra = {}, base = document.baseURI) {
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    for (const a of Array.from(el.attributes)) {
      const n = a.name.toLowerCase();
      if (n.startsWith("on") || n === "nonce" || n.startsWith("data-ctf")) continue;
      let v = a.value;
      if (n === "style" && extra.style) v = `${v.replace(/;?\s*$/, ";")} ${extra.style}`;
      else if (URL_ATTRS.includes(n)) v = /^\s*javascript:/i.test(v) ? "#" : absUrl(v, base);
      if (n === "style" && /url\(/i.test(v)) v = absolutizeCss(v, base);
      seen.add(n);
      out.push(`${a.name}="${escapeAttr(v)}"`);
    }
    for (const [k, v] of Object.entries(extra)) if (!seen.has(k)) out.push(`${k}="${escapeAttr(v)}"`);
    return out.length ? " " + out.join(" ") : "";
  }
  function isTransparent(color) {
    if (!color || color === "transparent") return true;
    const m = color.match(/rgba?\(([^)]+)\)/);
    if (!m) return false;
    const parts = m[1].split(/[\s,/]+/).filter(Boolean);
    return parts.length >= 4 && parseFloat(parts[3]) === 0;
  }
  function backdropColor(root) {
    for (let p = root.parentElement; p; p = p.parentElement) {
      if (p === document.body || p === document.documentElement) return null;
      const bg = getComputedStyle(p).backgroundColor;
      if (!isTransparent(bg)) return bg;
    }
    return null;
  }
  function containerWidth(root) {
    const p = root.parentElement;
    if (!p) return Math.round(root.getBoundingClientRect().width);
    const cs = getComputedStyle(p);
    const w = p.getBoundingClientRect().width - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0) - (parseFloat(cs.borderLeftWidth) || 0) - (parseFloat(cs.borderRightWidth) || 0);
    const own = root.getBoundingClientRect().width;
    return Math.round(Math.max(w, own));
  }
  var COMPARE_PROPS = [
    "display",
    "position",
    "top",
    "right",
    "bottom",
    "left",
    "float",
    "box-sizing",
    "flex-direction",
    "flex-wrap",
    "justify-content",
    "align-items",
    "align-content",
    "align-self",
    "justify-items",
    "justify-self",
    "flex-grow",
    "flex-shrink",
    "flex-basis",
    "order",
    "grid-template-columns",
    "grid-template-rows",
    "grid-column-start",
    "grid-column-end",
    "grid-row-start",
    "grid-row-end",
    "grid-auto-flow",
    "row-gap",
    "column-gap",
    "min-width",
    "max-width",
    "min-height",
    "max-height",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "margin-top",
    "margin-right",
    "margin-bottom",
    "margin-left",
    "border-top-width",
    "border-right-width",
    "border-bottom-width",
    "border-left-width",
    "border-top-style",
    "border-right-style",
    "border-bottom-style",
    "border-left-style",
    "border-top-color",
    "border-right-color",
    "border-bottom-color",
    "border-left-color",
    "border-top-left-radius",
    "border-top-right-radius",
    "border-bottom-right-radius",
    "border-bottom-left-radius",
    "background-color",
    "background-image",
    "background-size",
    "background-position",
    "background-repeat",
    "box-shadow",
    "opacity",
    "transform",
    "filter",
    "backdrop-filter",
    "mix-blend-mode",
    "z-index",
    "overflow-x",
    "overflow-y",
    "visibility",
    "color",
    "font-family",
    "font-size",
    "font-weight",
    "font-style",
    "line-height",
    "letter-spacing",
    "text-align",
    "text-transform",
    "text-decoration-line",
    "text-decoration-color",
    "white-space",
    "text-overflow",
    "vertical-align",
    "list-style-type",
    "object-fit",
    "object-position",
    "clip-path",
    "mask-image"
  ];
  var PSEUDO_PROPS = [
    "content",
    "display",
    "position",
    "top",
    "right",
    "bottom",
    "left",
    "width",
    "height",
    "background-color",
    "background-image",
    "border-top-width",
    "border-top-style",
    "border-top-color",
    "border-top-left-radius",
    "color",
    "font-size",
    "opacity",
    "transform"
  ];
  function animatedProps(el) {
    const out = /* @__PURE__ */ new Set();
    try {
      for (const a of el.getAnimations ? el.getAnimations() : []) {
        const eff = a.effect;
        if (a.transitionProperty) out.add(a.transitionProperty);
        for (const kf of eff && eff.getKeyframes ? eff.getKeyframes() : []) {
          for (const k of Object.keys(kf)) {
            if (["offset", "easing", "composite", "computedOffset"].includes(k)) continue;
            out.add(k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase()));
          }
        }
      }
    } catch (_e) {
    }
    if (out.has("inset")) ["top", "right", "bottom", "left"].forEach((p) => out.add(p));
    return out;
  }
  function waitFor(p, ms, fallback) {
    return new Promise((resolve) => {
      const t = setTimeout(() => resolve(fallback), ms);
      p.then(
        (v) => {
          clearTimeout(t);
          resolve(v);
        },
        () => {
          clearTimeout(t);
          resolve(fallback);
        }
      );
    });
  }
  async function renderInFrame(docHtml, css, timeoutMs) {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.setAttribute("tabindex", "-1");
    frame.style.cssText = `position:fixed!important;left:-${innerWidth + 200}px!important;top:0!important;width:${innerWidth}px!important;height:${innerHeight}px!important;border:0!important;opacity:0!important;pointer-events:none!important;visibility:visible!important;display:block!important`;
    const loaded = new Promise((resolve) => frame.addEventListener("load", () => resolve(), { once: true }));
    frame.srcdoc = docHtml;
    document.documentElement.appendChild(frame);
    await waitFor(loaded, timeoutMs, void 0);
    const doc = frame.contentDocument;
    const win = frame.contentWindow;
    if (!doc || !win) {
      frame.remove();
      return null;
    }
    try {
      const sheet = new win.CSSStyleSheet();
      sheet.replaceSync(`${css}
*, *::before, *::after { transition: none !important; }`);
      doc.adoptedStyleSheets = [sheet];
    } catch (_e) {
      frame.remove();
      return null;
    }
    const imgs = Array.from(doc.images).map((im) => im.complete ? Promise.resolve() : im.decode().catch(() => {
    }));
    await waitFor(
      Promise.all([doc.fonts ? doc.fonts.ready : Promise.resolve(), ...imgs]),
      Math.min(4e3, timeoutMs),
      void 0
    );
    return frame;
  }
  var LAYOUT_RESOLVED = /* @__PURE__ */ new Set([
    "margin-top",
    "margin-right",
    "margin-bottom",
    "margin-left",
    "top",
    "right",
    "bottom",
    "left",
    "grid-template-columns",
    "grid-template-rows"
  ]);
  function sizeDiffers(o, c) {
    const a = o.getBoundingClientRect();
    const b = c.getBoundingClientRect();
    if (Math.abs(a.width - b.width) > 1) return true;
    const op = o.parentElement;
    const cp = c.parentElement;
    if (!op || !cp) return false;
    return Math.abs(op.getBoundingClientRect().width - cp.getBoundingClientRect().width) > 1;
  }
  function diffElement(o, c, cwin, pseudo) {
    const os = getComputedStyle(o, pseudo || null);
    const cs = cwin.getComputedStyle(c, pseudo || null);
    const out = {};
    if (pseudo) {
      const oc = os.getPropertyValue("content");
      const cc = cs.getPropertyValue("content");
      if ((oc === "none" || oc === "normal") && (cc === "none" || cc === "normal")) return out;
    }
    const skip = pseudo ? /* @__PURE__ */ new Set() : animatedProps(o);
    if (!pseudo && sizeDiffers(o, c)) LAYOUT_RESOLVED.forEach((p) => skip.add(p));
    for (const p of pseudo ? PSEUDO_PROPS : COMPARE_PROPS) {
      if (skip.has(p)) continue;
      const ov = os.getPropertyValue(p);
      const cv = cs.getPropertyValue(p);
      if (ov !== cv) out[p] = ov;
    }
    return out;
  }
  function geometryMatches(origs, cdoc) {
    const oRoot = origs[0].getBoundingClientRect();
    const cRootEl = cdoc.querySelector(`[${IDX}="0"]`);
    if (!cRootEl) return 0;
    const cRoot = cRootEl.getBoundingClientRect();
    let total = 0;
    let ok = 0;
    origs.forEach((o, i) => {
      const r = o.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      const c = cdoc.querySelector(`[${IDX}="${i}"]`);
      if (!c) return;
      total++;
      const k = c.getBoundingClientRect();
      if (Math.abs(r.left - oRoot.left - (k.left - cRoot.left)) <= 2 && Math.abs(r.top - oRoot.top - (k.top - cRoot.top)) <= 2 && Math.abs(r.width - k.width) <= 2 && Math.abs(r.height - k.height) <= 2)
        ok++;
    });
    return total ? Math.round(ok / total * 1e3) / 10 : 100;
  }
  function patchCss(patches, important) {
    return patches.map((p) => {
      const decl = Object.entries(p.props).map(([k, v]) => `${k}: ${v}${important.has(`${p.idx}${p.pseudo}|${k}`) ? " !important" : ""};`).join(" ");
      return `[data-ctf="${p.idx}"]:is(#_, *)${p.pseudo} { ${decl} }`;
    }).join("\n");
  }
  async function verify(origs, buildDoc, baseCss, timeoutMs, rootSkip) {
    const deadline = Date.now() + timeoutMs;
    const patches = /* @__PURE__ */ new Map();
    const important = /* @__PURE__ */ new Set();
    const pass = async (round) => {
      const css = baseCss + "\n" + patchCss(Array.from(patches.values()), important);
      const frame = await renderInFrame(buildDoc(css, true), css, Math.max(1500, deadline - Date.now()));
      if (!frame) return null;
      try {
        const cdoc = frame.contentDocument;
        const cwin = frame.contentWindow;
        const sentinel = cdoc.querySelector(`[${IDX}="0"]`);
        if (!sentinel) return null;
        origs.forEach((o, i) => {
          const c = cdoc.querySelector(`[${IDX}="${i}"]`);
          if (!c) return;
          for (const pseudo of ["", "::before", "::after"]) {
            if (pseudo && o.namespaceURI === SVG_NS) continue;
            const diff = diffElement(o, c, cwin, pseudo);
            if (i === 0 && !pseudo) for (const k of rootSkip) delete diff[k];
            const keys = Object.keys(diff);
            if (!keys.length) continue;
            const key = `${i}${pseudo}`;
            const patch = patches.get(key) || { idx: i, pseudo, props: {} };
            for (const k of keys) {
              if (round > 0 && k in patch.props) important.add(`${key}|${k}`);
              patch.props[k] = diff[k];
            }
            patches.set(key, patch);
          }
        });
        return geometryMatches(origs, cdoc);
      } finally {
        frame.remove();
      }
    };
    let fidelity = await pass(0);
    if (fidelity == null) return null;
    if (patches.size && Date.now() < deadline) {
      const again = await pass(1);
      if (again != null) fidelity = again;
      if (important.size && Date.now() < deadline) {
        const last = await pass(2);
        if (last != null) fidelity = last;
      }
    }
    return { patches: Array.from(patches.values()), important, fidelity };
  }
  var WIDGETS_JS = `/* Code to Figma — interacción de los widgets estándar del bloque exportado.
 * Pestañas ARIA (role=tab), botones aria-expanded/aria-controls y collapse/dropdown/tab de Bootstrap.
 * El JavaScript propio del sitio no se copia. */
(function () {
  'use strict';
  var byId = function (id) { return id ? document.getElementById(id) : null; };
  var show = function (el, display) {
    if (!el) return;
    el.removeAttribute('hidden');
    el.style.display = '';
    if (getComputedStyle(el).display === 'none') el.style.display = el.getAttribute('data-ctf-display') || display || 'block';
  };
  var hide = function (el) {
    if (!el) return;
    el.setAttribute('hidden', '');
    if (getComputedStyle(el).display !== 'none') el.style.display = 'none';
  };
  var toggleClasses = function (el, classes, on) {
    if (!el || !classes) return;
    classes.split(/\\s+/).forEach(function (c) { if (c) el.classList.toggle(c, on); });
  };

  document.querySelectorAll('[data-ctf-w="tabs"]').forEach(function (list) {
    var tabs = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));
    var select = function (tab) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.setAttribute('tabindex', on ? '0' : '-1');
        toggleClasses(t, list.getAttribute('data-ctf-on'), on);
        var panel = byId(t.getAttribute('aria-controls'));
        toggleClasses(panel, list.getAttribute('data-ctf-panel-on'), on);
        if (on) show(panel, list.getAttribute('data-ctf-display')); else hide(panel);
      });
    };
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function (e) { e.preventDefault(); select(t); });
      t.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        var next = tabs[(i + d + tabs.length) % tabs.length];
        select(next); next.focus();
      });
    });
  });

  document.querySelectorAll('[data-ctf-w="disclosure"]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      if (btn.tagName === 'A') e.preventDefault();
      var open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      var target = byId(btn.getAttribute('aria-controls'));
      if (open) show(target); else hide(target);
    });
  });

  var bsTarget = function (btn) {
    var sel = btn.getAttribute('data-bs-target') || btn.getAttribute('data-target') || btn.getAttribute('href');
    if (!sel || sel.charAt(0) !== '#') return null;
    try { return document.querySelector(sel); } catch (e) { return null; }
  };
  document.querySelectorAll('[data-ctf-w="bs-collapse"]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      var t = bsTarget(btn);
      if (!t) return;
      var open = !t.classList.contains('show');
      t.classList.toggle('show', open);
      btn.classList.toggle('collapsed', !open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });
  document.querySelectorAll('[data-ctf-w="bs-dropdown"]').forEach(function (btn) {
    var menu = btn.parentElement && btn.parentElement.querySelector('.dropdown-menu');
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      if (!menu) return;
      var open = !menu.classList.contains('show');
      menu.classList.toggle('show', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('click', function (e) {
      if (menu && !btn.contains(e.target) && !menu.contains(e.target)) menu.classList.remove('show');
    });
  });
  document.querySelectorAll('[data-ctf-w="bs-tab"], [data-ctf-w="bs-pill"]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      var pane = bsTarget(btn);
      var nav = btn.closest('.nav, [role="tablist"]');
      if (nav) nav.querySelectorAll('[data-ctf-w="bs-tab"], [data-ctf-w="bs-pill"]').forEach(function (b) {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
        var p = bsTarget(b);
        if (p) p.classList.remove('active', 'show');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      if (pane) pane.classList.add('active', 'show');
    });
  });
})();
`;
  function slug(s) {
    return (s || "componente").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "componente";
  }
  function blockName(root) {
    const heading = root.querySelector("h1, h2, h3, h4");
    const label = root.getAttribute("aria-label") || heading && heading.textContent || "";
    if (label.trim()) return label.trim();
    const cls = (root.getAttribute("class") || "").split(/\s+/).find((c) => c && !/^_|[0-9]{3,}/.test(c));
    return root.id || cls || root.tagName.toLowerCase();
  }
  async function exportBlock(input, opts = {}) {
    let root = input;
    if (root.namespaceURI === SVG_NS && root.tagName.toLowerCase() !== "svg") {
      root = root.ownerSVGElement || root;
    }
    const pageMode = root === document.body || root === document.documentElement;
    if (root === document.documentElement) root = document.body;
    const warnings = [];
    const chain = pageMode ? [] : ancestorChain(root);
    const scope = [root, ...chain, document.body, document.documentElement];
    const { sources, unreadable } = await gatherSheets(opts.fetchCss);
    const ctx = {
      root,
      scope,
      kept: 0,
      total: 0,
      keyframes: [],
      fontFaces: [],
      properties: [],
      cache: /* @__PURE__ */ new Map()
    };
    const ruleBlocks = [];
    for (const src of sources) {
      ctx.recover = void 0;
      if (src.loadText && needsRecovery(src.rules)) {
        const text = await src.loadText().catch(() => null);
        if (text) ctx.recover = buildRecovery(text, src.rules);
      }
      for (const r of filterRules(src.rules, src.base, ctx)) {
        ruleBlocks.push(src.media ? `@media ${src.media} {
${r}
}` : r);
      }
    }
    const { clone, origs, widgets, warnings: cloneWarnings } = cloneBlock(root);
    warnings.push(...cloneWarnings);
    clone.setAttribute("data-ctf-root", "");
    const defs = externalRefs(clone, root);
    const rulesText = pruneCustomProperties(dedupeKeepLast(ruleBlocks).join("\n"), clone.outerHTML);
    const usageText = rulesText + "\n" + clone.outerHTML;
    const keyframes = ctx.keyframes.filter(
      (k) => new RegExp(`(?:^|[\\s,:])${escapeRe(k.name)}(?:$|[\\s,;!])`, "m").test(usageText)
    );
    const lowerUsage = usageText.toLowerCase();
    const fontFaces = ctx.fontFaces.filter((f) => f.family && lowerUsage.includes(f.family.toLowerCase()));
    const properties = ctx.properties.filter((p) => usageText.includes(p.name));
    const overrides = [];
    if (!pageMode) {
      const bg = backdropColor(root);
      const width = containerWidth(root);
      overrides.push(
        "[data-ctf-chain] { display: contents !important; }",
        `body { display: block !important; box-sizing: border-box !important; width: ${width}px !important; max-width: 100% !important; margin: 0 auto !important; padding: 0 !important; min-height: 0 !important; height: auto !important; overflow: visible !important; }`
      );
      if (bg) overrides.push(`html { background: ${bg} !important; }`, "body { background: transparent !important; }");
      const pos = getComputedStyle(root).position;
      if (pos === "absolute" || pos === "fixed" || pos === "sticky") {
        overrides.push("[data-ctf-root] { position: relative !important; inset: auto !important; }");
      }
    }
    const source = `${location.href}`;
    const header = `/* Exportado con Code to Figma desde ${source.replace(/\*\//g, "* /")}
 * ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)} · ${ctx.kept} de ${ctx.total} reglas de la página */`;
    const baseCss = [
      header,
      ...fontFaces.map((f) => f.text),
      ...properties.map((p) => p.text),
      rulesText,
      ...keyframes.map((k) => k.text),
      overrides.length ? "/* El bloque fuera de su página */\n" + overrides.join("\n") : ""
    ].filter(Boolean).join("\n\n");
    const defsHtml = defs.length ? `<svg aria-hidden="true" width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden"><defs>${defs.map((d) => absolutizeCss(d.outerHTML, document.baseURI)).join("")}</defs></svg>` : "";
    const htmlAttrs = attrsOf(document.documentElement);
    const bodyAttrs = attrsOf(document.body);
    const title = `${blockName(root)} — ${document.title || location.hostname}`.slice(0, 120);
    const wrapChain = (cloneHtml) => {
      const open = chain.map((a) => `<${a.tagName.toLowerCase()}${attrsOf(a, { "data-ctf-chain": "" })}>`).join("");
      const close = chain.slice().reverse().map((a) => `</${a.tagName.toLowerCase()}>`).join("");
      return open + cloneHtml + close;
    };
    const buildDoc = (cloneHtml, head, tail) => {
      const body = pageMode ? cloneHtml.replace(/<\/body>\s*$/i, `
${defsHtml}
${tail}</body>`) : `<body${bodyAttrs}>
${wrapChain(cloneHtml)}
${defsHtml}
${tail}</body>`;
      return `<!doctype html>
<html${htmlAttrs}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeAttr(
        title
      )}</title>
${head}
</head>
${body}
</html>
`;
    };
    let patches = [];
    let important = /* @__PURE__ */ new Set();
    let fidelity = null;
    let verified = false;
    if (opts.verify !== false) {
      const indexed = clone.outerHTML;
      const rootSkip = new Set(
        overrides.some((o) => o.startsWith("[data-ctf-root]")) ? ["position", "top", "right", "bottom", "left"] : []
      );
      const res = await verify(
        origs,
        () => buildDoc(indexed, "", ""),
        baseCss,
        opts.verifyTimeoutMs ?? 15e3,
        rootSkip
      ).catch(() => null);
      if (res) {
        verified = true;
        patches = res.patches;
        important = res.important;
        fidelity = res.fidelity;
      } else {
        warnings.push("No se pudo verificar el resultado en esta página");
      }
    }
    const patched = new Set(patches.map((p) => p.idx));
    for (const el of [clone, ...Array.from(clone.querySelectorAll(`[${IDX}]`))]) {
      const i = el.getAttribute(IDX);
      el.removeAttribute(IDX);
      if (i != null && patched.has(Number(i))) el.setAttribute("data-ctf", i);
    }
    const css = baseCss + (patches.length ? `

/* Ajustes medidos en la página: estilos que las reglas copiadas no reproducen (hojas que no se
 * pudieron leer, estilos puestos por JavaScript o que dependían de elementos que no se exportan) */
${patchCss(patches, important)}` : "") + "\n";
    const js = widgets.size ? WIDGETS_JS : "";
    const finalHtml = clone.outerHTML;
    const html = buildDoc(
      finalHtml,
      '<link rel="stylesheet" href="styles.css">',
      js ? '<script src="script.js"><\/script>\n' : ""
    );
    const singleFile = buildDoc(
      finalHtml,
      `<style>
${css.replace(/<\/style/gi, "<\\/style")}</style>`,
      js ? `<script>
${js.replace(/<\/script/gi, "<\\/script")}<\/script>
` : ""
    );
    if (unreadable.length) {
      warnings.push(
        `${unreadable.length} hoja(s) de estilo no se pudieron leer; sus estilos llegan como ajustes medidos (sin @media ni :hover)`
      );
    }
    return {
      html,
      css,
      js,
      singleFile,
      baseName: slug(blockName(root)),
      stats: {
        elements: origs.length,
        rules: ctx.kept,
        totalRules: ctx.total,
        sheets: sources.length,
        unreadableSheets: unreadable,
        verified,
        patchedElements: patched.size,
        patchedProps: patches.reduce((n, p) => n + Object.keys(p.props).length, 0),
        fidelity,
        widgets: Array.from(widgets),
        warnings
      }
    };
  }
  var crcTable = null;
  function crc32(bytes) {
    if (!crcTable) {
      crcTable = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
        crcTable[n] = c >>> 0;
      }
    }
    let crc = 4294967295;
    for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 255] ^ crc >>> 8;
    return (crc ^ 4294967295) >>> 0;
  }
  function buildZip(files) {
    const enc = new TextEncoder();
    const now = /* @__PURE__ */ new Date();
    const dosTime = now.getHours() << 11 | now.getMinutes() << 5 | now.getSeconds() >> 1;
    const dosDate = now.getFullYear() - 1980 << 9 | now.getMonth() + 1 << 5 | now.getDate();
    const locals = [];
    const centrals = [];
    let offset = 0;
    for (const f of files) {
      const name = enc.encode(f.name);
      const data = enc.encode(f.content);
      const crc = crc32(data);
      const local = new Uint8Array(30 + name.length + data.length);
      const lv = new DataView(local.buffer);
      lv.setUint32(0, 67324752, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(6, 2048, true);
      lv.setUint16(8, 0, true);
      lv.setUint16(10, dosTime, true);
      lv.setUint16(12, dosDate, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, data.length, true);
      lv.setUint32(22, data.length, true);
      lv.setUint16(26, name.length, true);
      lv.setUint16(28, 0, true);
      local.set(name, 30);
      local.set(data, 30 + name.length);
      locals.push(local);
      const central = new Uint8Array(46 + name.length);
      const cv = new DataView(central.buffer);
      cv.setUint32(0, 33639248, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 2048, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, dosTime, true);
      cv.setUint16(14, dosDate, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, data.length, true);
      cv.setUint16(28, name.length, true);
      cv.setUint32(42, offset, true);
      central.set(name, 46);
      centrals.push(central);
      offset += local.length;
    }
    const centralSize = centrals.reduce((n, c) => n + c.length, 0);
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 101010256, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);
    const out = new Uint8Array(offset + centralSize + 22);
    let p = 0;
    for (const part of [...locals, ...centrals, end]) {
      out.set(part, p);
      p += part.length;
    }
    return out;
  }
  function exportFiles(res) {
    const files = [
      { name: "index.html", content: res.html },
      { name: "styles.css", content: res.css }
    ];
    if (res.js) files.push({ name: "script.js", content: res.js });
    return files;
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
  window.__codeToFigmaExtractState = async function(rootElement, state) {
    if (!rootElement || typeof window.__codeToFigmaExtract !== "function") return null;
    const emulation = emulateState(rootElement, state);
    if (!emulation) return null;
    try {
      const res = await window.__codeToFigmaExtract(rootElement);
      return res ? { rootNode: res.rootNode, rules: emulation.rules, unreadableSheets: emulation.unreadableSheets } : null;
    } finally {
      emulation.undo();
    }
  };
  window.__codeToFigmaPayload = { measurePayload, heavyPayloadReasons, withoutImages, formatBytes };
  window.__codeToFigmaExportHtml = async function(rootElement, opts = {}) {
    if (!rootElement || rootElement.nodeType !== Node.ELEMENT_NODE) return null;
    const fetchCss = opts.fetchCss || window.__codeToFigmaFetchCss;
    const res = await exportBlock(rootElement, { ...opts, fetchCss });
    return { ...res, files: exportFiles(res) };
  };
  window.__codeToFigmaZip = buildZip;
  if (!window.__codeToFigmaReadyLogged) {
    window.__codeToFigmaReadyLogged = true;
    console.log("[CodeToFigma] Extractor Engine v2.1 (Geometric Direction & Centered Stacking) ready.");
  }
})();
