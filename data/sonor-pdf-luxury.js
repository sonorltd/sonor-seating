/* Sonor PDF Luxury — SHARED client-proposal chrome (v1.0.0, root master)
   window.SonorPdfLuxury — the proven pdf-lib page system from the Seating
   Configurator proposal (seating-pdf.js v0.22.x), extracted VERBATIM so every
   client-facing proposal (seating · cinema design · future docs) shares ONE
   styling source. Edit THIS master at workspace root; propagate with
   `bash sync-everything.sh --only sonor-pdf-luxury.js`. Rules: cinema-pdf-luxury
   skill (frame-edge, divider discipline, truncate-vs-wrap, Gilroy glyph traps).
   Consumers: data/aesthetic-pdf.js (Cinema Design Proposal). Seating adoption:
   SEATING-SSOT-CONTRACT §6 ask logged 2026-07-19.
*/
(function (global) {
  'use strict';

  var A4 = { w: 595.28, h: 841.89 };
  var M = 48;
  var COL = {
    GOLD: [173, 153, 120], GOLDL: [200, 180, 142], GDEEP: [140, 116, 60], PUR: [128, 88, 161],
    CREAM: [246, 242, 234], INK: [26, 24, 20], INK2: [60, 55, 47], MUT: [120, 112, 96],
    DARK: [9, 8, 7], DARK2: [22, 19, 24], LINE: [214, 205, 188], LABEL: [150, 138, 116], PAGE_NO: [170, 160, 140],
    INFO: [168, 156, 136]
  };

  var HOUSE = 'M92.02,38.41v51.4c0,2.63-2.13,4.75-4.75,4.75h-3.34c-2.62,0-4.75-2.12-4.75-4.75v-45.34c0-2.45-1.11-4.77-3.01-6.31l-25.23-20.41c-2.8-2.27-6.76-2.42-9.73-.36l-23.15,16.05.45,1.55c22.38,9.5,40.47,30.05,47.71,53.39.95,3.06-1.32,6.18-4.53,6.18h-5.36c-2.08,0-3.9-1.37-4.54-3.35-6.96-21.83-24.83-38.23-46.17-46.13-1.31-.49-2.31-1.5-2.79-2.75-.2-.51-.31-1.06-.32-1.64l-.12-9.11c-.02-1.58.75-3.06,2.05-3.96L28.74,10.74,42.11,1.45c.16-.11.32-.22.49-.31,2.35-1.4,5.22-1.5,7.64-.34.57.26,1.12.61,1.63,1.03l37.16,30.29c1.89,1.54,2.99,3.85,2.99,6.29Z ' +
    'M34.59,94.55h-5.25c-1.6,0-3.09-.81-3.97-2.15-5.47-8.37-11.98-15.35-20.72-20.32-1.5-.85-2.45-2.42-2.45-4.15v-5.58c0-3.52,3.68-5.79,6.85-4.26,12.79,6.15,23.95,16.91,29.85,29.73,1.45,3.14-.86,6.73-4.32,6.73h0Z ' +
    'M4.26,83.39c7.65-1.71,9.39,9.06,4.03,10.83-8.9,2.94-11.25-9.22-4.03-10.83Z';
  var WA = 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z';

  // smooth alpha fade (canvas-rendered PNG — no banding); cached per session
  var _fadePng = null;
  function fadePngDataUrl() {
    if (_fadePng) return _fadePng;
    try {
      var cv = document.createElement('canvas'); cv.width = 16; cv.height = 1024;
      var g = cv.getContext('2d'); var gr = g.createLinearGradient(0, 0, 0, 1024);
      gr.addColorStop(0, 'rgba(9,8,7,0)'); gr.addColorStop(0.45, 'rgba(9,8,7,0.55)'); gr.addColorStop(1, 'rgba(9,8,7,1)');
      g.fillStyle = gr; g.fillRect(0, 0, 16, 1024);
      _fadePng = cv.toDataURL('image/png');
    } catch (e) { _fadePng = null; }
    return _fadePng;
  }

  function col(a) { return global.PDFLib.rgb(a[0] / 255, a[1] / 255, a[2] / 255); }
  function hexRgb(hx) {
    hx = String(hx || '').replace('#', '');
    return /^[0-9a-f]{6}$/i.test(hx) ? [parseInt(hx.slice(0, 2), 16), parseInt(hx.slice(2, 4), 16), parseInt(hx.slice(4, 6), 16)] : [80, 76, 70];
  }
  async function fetchBytes(url) { var r = await fetch(url); if (!r.ok) throw new Error('fetch ' + url + ' ' + r.status); return new Uint8Array(await r.arrayBuffer()); }

  // load an image URL → embedded pdf image (webp handled via canvas → jpeg)
  async function loadImage(doc, url) {
    var abs = (typeof document !== 'undefined') ? new URL(url, document.baseURI).href : url;
    if (/\.jpe?g(\?|$)/i.test(abs)) return doc.embedJpg(await fetchBytes(abs));
    if (/\.png(\?|$)/i.test(abs)) return doc.embedPng(await fetchBytes(abs));
    var bytes = await fetchBytes(abs);
    var blob = new Blob([bytes]); var u = URL.createObjectURL(blob);
    try {
      var img = await new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = rej; i.src = u; });
      var cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
      cv.getContext('2d').drawImage(img, 0, 0);
      var dataUrl = cv.toDataURL('image/jpeg', 0.86);
      var b64 = dataUrl.split(',')[1], bin = atob(b64), out = new Uint8Array(bin.length);
      for (var k = 0; k < bin.length; k++) out[k] = bin.charCodeAt(k);
      return await doc.embedJpg(out);
    } finally { URL.revokeObjectURL(u); }
  }

  function mk(page, doc) {
    var P = {
      page: page,
      text: function (str, x, top, size, font, c, opts) { opts = opts || {}; page.drawText(String(str), { x: x, y: A4.h - top - size, size: size, font: font, color: col(c || COL.INK), lineHeight: opts.lineHeight, maxWidth: opts.maxWidth }); },
      tracked: function (str, x, top, size, font, c, track) {
        track = track || 0; str = String(str); var cx = x, y = A4.h - top - size;
        for (var i = 0; i < str.length; i++) { page.drawText(str[i], { x: cx, y: y, size: size, font: font, color: col(c || COL.INK) }); cx += font.widthOfTextAtSize(str[i], size) + track; }
        return cx - x - track;
      },
      trackedRight: function (str, right, top, size, font, c, track) {
        track = track || 0; str = String(str); var w = 0; for (var i = 0; i < str.length; i++) w += font.widthOfTextAtSize(str[i], size) + track; w -= track;
        P.tracked(str, right - w, top, size, font, c, track); return w;
      },
      right: function (str, right, top, size, font, c) { var w = font.widthOfTextAtSize(String(str), size); page.drawText(String(str), { x: right - w, y: A4.h - top - size, size: size, font: font, color: col(c || COL.INK) }); },
      center: function (str, cx, top, size, font, c, track) {
        var w = 0; str = String(str);
        for (var i = 0; i < str.length; i++) w += font.widthOfTextAtSize(str[i], size) + (track || 0);
        w -= (track || 0); P.tracked(str, cx - w / 2, top, size, font, c, track || 0);
      },
      rect: function (x, top, w, h, c, o) { page.drawRectangle({ x: x, y: A4.h - top - h, width: w, height: h, color: col(c), opacity: o == null ? 1 : o }); },
      rectB: function (x, top, w, h, c, bw, o) { page.drawRectangle({ x: x, y: A4.h - top - h, width: w, height: h, borderColor: col(c), borderWidth: bw, opacity: 0, borderOpacity: o == null ? 1 : o }); },
      hline: function (x1, x2, top, c, t, o) { page.drawLine({ start: { x: x1, y: A4.h - top }, end: { x: x2, y: A4.h - top }, thickness: t || 0.6, color: col(c), opacity: o == null ? 1 : o }); },
      vline: function (x, top1, top2, c, t, o) { page.drawLine({ start: { x: x, y: A4.h - top1 }, end: { x: x, y: A4.h - top2 }, thickness: t || 0.6, color: col(c), opacity: o == null ? 1 : o }); },
      logo: function (x, top, h, c) { var sc = h / 95; page.drawSvgPath(HOUSE, { x: x, y: A4.h - top, scale: sc, color: col(c || COL.GOLD) }); },
      image: function (img, x, top, w, h, o) { page.drawImage(img, { x: x, y: A4.h - top - h, width: w, height: h, opacity: o == null ? 1 : o }); },
      dot: function (x, top, r, c, borderC) { page.drawCircle({ x: x, y: A4.h - top, size: r, color: col(c), borderColor: borderC ? col(borderC) : undefined, borderWidth: borderC ? 0.6 : 0 }); },
      rrect: function (x, top, w, h, r, c, bw, o) {
        r = Math.min(r, w / 2, h / 2);
        var p = 'M ' + r + ',0 H ' + (w - r) + ' A ' + r + ',' + r + ' 0 0 1 ' + w + ',' + r + ' V ' + (h - r) + ' A ' + r + ',' + r + ' 0 0 1 ' + (w - r) + ',' + h + ' H ' + r + ' A ' + r + ',' + r + ' 0 0 1 0,' + (h - r) + ' V ' + r + ' A ' + r + ',' + r + ' 0 0 1 ' + r + ',0 Z';
        page.drawSvgPath(p, { x: x, y: A4.h - top, borderColor: col(c), borderWidth: bw || 0.8, borderOpacity: o == null ? 1 : o });
      },
      fadeDown: function (x, top, w, h, c, maxO, steps) {
        steps = steps || 56; maxO = maxO == null ? 1 : maxO;
        var slice = h / steps;
        for (var i = 0; i < steps; i++) {
          var t = (i + 1) / steps;
          var o = maxO * t * t * (1 - (1 - t) * 0.2);
          P.rect(x, top + slice * i, w, slice * 1.9, c, o * 0.62);
          P.rect(x, top + slice * i, w, slice * 1.1, c, o * 0.5);
        }
      },
      link: function (str, x, top, size, font, c, url) {
        P.text(str, x, top, size, font, c);
        var w = font.widthOfTextAtSize(String(str), size);
        P.hline(x, x + w, top + size + 2, c, 0.5, 0.5);
        try {
          var PL = global.PDFLib;
          var ann = doc.context.obj({ Type: 'Annot', Subtype: 'Link', Rect: [x, A4.h - top - size - 3, x + w, A4.h - top + 2], Border: [0, 0, 0], A: { Type: 'Action', S: 'URI', URI: PL.PDFString.of(url) } });
          var ref = doc.context.register(ann);
          var key = PL.PDFName.of('Annots');
          var existing = page.node.lookup(key);
          if (existing) existing.push(ref); else page.node.set(key, doc.context.obj([ref]));
        } catch (e) {}
        return w;
      }
    };
    return P;
  }

  function wrap(str, font, size, width) {
    var words = String(str || '').split(/\s+/), lines = [], cur = '';
    words.forEach(function (w) {
      var t = cur ? cur + ' ' + w : w;
      if (font.widthOfTextAtSize(t, size) > width && cur) { lines.push(cur); cur = w; } else cur = t;
    });
    if (cur) lines.push(cur);
    return lines;
  }
  function money(n) { return n == null ? 'POA' : '£' + Number(n).toLocaleString('en-GB', { maximumFractionDigits: 0 }); }
  function mm(v) { return v != null ? Math.round(v) + ' mm' : null; }

  // fonts — Gilroy trio with Helvetica fallback. `base` = app's data/ dir.
  async function makeFonts(doc, base) {
    var PL = global.PDFLib, F = {};
    try { if (global.fontkit) doc.registerFontkit(global.fontkit); } catch (e) {}
    try {
      F.b = await doc.embedFont(await fetchBytes(base + 'fonts/gilroy-extrabold.otf'), { subset: false });
      F.r = await doc.embedFont(await fetchBytes(base + 'fonts/gilroy-regular.otf'), { subset: false });
      F.l = await doc.embedFont(await fetchBytes(base + 'fonts/gilroy-ultralight.otf'), { subset: false });
    } catch (e) {
      F.b = await doc.embedFont(PL.StandardFonts.HelveticaBold);
      F.r = await doc.embedFont(PL.StandardFonts.Helvetica);
      F.l = F.r;
    }
    return F;
  }

  // shared page furniture — content pages. docLabel appears on pages 1–2's LHS;
  // pages 3+ carry their own section label (v0.19.0 rule).
  function pageHead(P, F, label, pageNo, total, docLabel) {
    var lhs = (pageNo >= 3 && label) ? label : (docLabel || 'PROPOSAL');
    P.tracked(lhs, M, 42, 8, F.r, COL.LABEL, 2.4);
    if (pageNo) P.trackedRight(pageNo + ' / ' + total, A4.w - M, 42, 8, F.r, COL.PAGE_NO, 1.6);
    P.hline(M, A4.w - M, 68, COL.LINE, 0.8);
  }
  function pageFoot(P, F) {
    var GDEEP = COL.GDEEP;
    P.hline(M, A4.w - M, A4.h - 56, COL.LINE, 0.8);
    P.tracked('PROJECTS@SONOR.CO.UK', M, A4.h - 44.2, 7.2, F.r, GDEEP, 1.4);
    var s = 'SONOR', ss = 9.5, tr = 2.8, tw = 0;
    for (var i = 0; i < s.length; i++) tw += F.b.widthOfTextAtSize(s[i], ss) + tr;
    tw -= tr;
    var markW = 15 * (93 / 95), gap = 7, totW = markW + gap + tw;
    var cx0 = (A4.w - totW) / 2;
    P.logo(cx0, A4.h - 47.5, 15, COL.GOLD);
    P.tracked(s, cx0 + markW + gap, A4.h - 44.6, ss, F.b, GDEEP, tr);
    var phone = '07933 684 000', ps = 8;
    var phW = 0; for (var j = 0; j < phone.length; j++) phW += F.r.widthOfTextAtSize(phone[j], ps) + 1.2;
    var phX = A4.w - M - phW;
    P.tracked(phone, phX, A4.h - 44.4, ps, F.r, GDEEP, 1.2);
    P.page.drawSvgPath(WA, { x: phX - 14, y: 45.6, scale: 9.5 / 24, color: col(GDEEP) });
  }

  // ── COVER — dark hero cover, identical anatomy to the seating proposal ─────
  // opts: { hero, fadeImg, eyebrow, title, subtitle, info:[[LABEL,value]×3],
  //         centreLogoImg, cediaImg }
  function cover(P, F, opts) {
    opts = opts || {};
    P.rect(0, 0, A4.w, A4.h, COL.DARK);
    if (opts.hero) {
      var iw = opts.hero.width, ih = opts.hero.height, s = Math.max(A4.w / iw, A4.h / ih);
      var dw = iw * s, dh = ih * s;
      P.image(opts.hero, (A4.w - dw) / 2, 0, dw, dh, 1);
      var fTop = A4.h * 0.66, fH = A4.h * 0.22;
      if (opts.fadeImg) P.image(opts.fadeImg, 0, fTop, A4.w, fH, 1);
      else P.fadeDown(0, fTop, A4.w, fH, COL.DARK, 1, 56);
      P.rect(0, fTop + fH - 1, A4.w, A4.h - (fTop + fH) + 1, COL.DARK, 1);
    }
    // inset frame — CONSISTENT inset on all four sides; content sits inside it
    P.rectB(M * 0.62, M * 0.62, A4.w - M * 1.24, A4.h - M * 1.24, COL.GOLD, 0.7, 0.34);

    var ty = 672;
    P.hline(M, M + 26, ty - 20, COL.GOLD, 1, 0.95);
    P.tracked(String(opts.eyebrow || 'PROPOSAL').toUpperCase(), M + 34, ty - 24, 8.5, F.r, COL.GOLDL, 3.2);
    var title = opts.title || 'Proposal';
    var tsize = F.b.widthOfTextAtSize(title, 54) > (A4.w - M * 2) ? 38 : 54;
    P.text(title, M - 2, ty + (tsize === 38 ? 12 : 0), tsize, F.b, COL.CREAM);
    if (opts.subtitle) P.text(opts.subtitle, M, ty + 62, 19, F.l, COL.GOLDL);

    var iy = 772, cw = (A4.w - M * 2) / 3;
    P.hline(M, A4.w - M, iy - 16, COL.GOLD, 0.5, 0.45);
    (opts.info || []).slice(0, 3).forEach(function (c, i) {
      var x = M + i * cw;
      P.tracked(c[0], x, iy, 7, F.r, COL.INFO, 1.8);
      P.text(c[1] || '—', x, iy + 13, 12.5, F.b, COL.CREAM, { maxWidth: cw - 16 });
    });
    // logo strip — clear band BELOW the frame (heights ≤13, one centreline)
    var cyL = A4.h - 14;
    P.logo(M, cyL - 6, 12, COL.CREAM);
    P.tracked('SONOR', M + 18, cyL - 4, 8, F.b, COL.CREAM, 2.4);
    if (opts.centreLogoImg) {
      var mlh = 10, mlw = opts.centreLogoImg.width * (mlh / opts.centreLogoImg.height);
      if (mlw > 95) { mlw = 95; mlh = opts.centreLogoImg.height * (mlw / opts.centreLogoImg.width); }
      P.image(opts.centreLogoImg, (A4.w - mlw) / 2, cyL - mlh / 2, mlw, mlh, 0.92);
    }
    if (opts.cediaImg) {
      var ch = (opts.cediaImg.width / opts.cediaImg.height) < 3 ? 13 : 9;
      var cwd = ch * (opts.cediaImg.width / opts.cediaImg.height);
      P.image(opts.cediaImg, A4.w - M - cwd, cyL - ch / 2, cwd, ch, 0.92);
    } else {
      P.trackedRight('CEDIA MEMBER', A4.w - M, cyL - 3, 6, F.r, COL.INFO, 1.2);
    }
  }

  // ── labelled spec rows (the p2/p4 pattern: LABEL / bold value / divider) ──
  // rows: [[label, value], …] (null/empty values dropped). Returns bottom y.
  function specRows(P, F, rows, x, top, colW) {
    rows = (rows || []).filter(function (r) { return r && r[1]; });
    var sy = top;
    rows.forEach(function (r, ri) {
      P.tracked(String(r[0]).toUpperCase(), x, sy, 6.5, F.r, COL.MUT, 1.5);
      var lines = wrap(String(r[1]), F.b, 11.5, colW - 12);
      lines.forEach(function (ln, li) { P.text(ln, x, sy + 11 + li * 13.5, 11.5, F.b, COL.INK); });
      sy += 11 + lines.length * 13.5 + 11;
      if (ri < rows.length - 1) P.hline(x, x + colW, sy - 7, COL.LINE, 0.5, 0.7);
    });
    return sy;
  }

  // ── section header on a cream page (eyebrow + big title + optional note) ──
  // v1.0.1 — note wraps to 4 lines max (was 3 — long standards blurbs clipped
  // mid-sentence); returned y always clears the painted lines.
  function sectionHead(P, F, eyebrow, title, note) {
    P.tracked(String(eyebrow || '').toUpperCase(), M, 92, 8.5, F.r, COL.GOLD, 2.6);
    P.text(title || '', M - 1, 106, 26, F.b, COL.INK);
    var y = 148;
    if (note) {
      wrap(note, F.r, 10.5, A4.w - M * 2).slice(0, 4).forEach(function (ln, i) {
        P.text(ln, M, 142 + i * 14, 10.5, F.r, COL.INK2); y = 142 + (i + 1) * 14 + 6;
      });
    }
    return Math.max(y, 156);
  }

  global.SonorPdfLuxury = {
    __version: '1.0.1',
    A4: A4, M: M, COL: COL, HOUSE: HOUSE, WA: WA,
    col: col, hexRgb: hexRgb, fadePngDataUrl: fadePngDataUrl,
    fetchBytes: fetchBytes, loadImage: loadImage,
    mk: mk, wrap: wrap, money: money, mm: mm,
    makeFonts: makeFonts, pageHead: pageHead, pageFoot: pageFoot,
    cover: cover, specRows: specRows, sectionHead: sectionHead
  };
})(window);
