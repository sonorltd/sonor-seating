/* Sonor Seating Configurator — luxury PDF proposal (v0.8.0)
   SeatingPdf.generate(model) — crisp vector A4 via pdf-lib + embedded Gilroy.
   Pages: 1 photographic cover (fade-to-dark, client/project info, no pricing)
          2 specification + itemised quote + terms & deposit
          3 dimensioned seating plan (CAD-style)
          4 technical specification of the chosen model (+ library/manufacturer links)
          + appended manufacturer datasheet when the Library files `datasheet_url` (PDF).
   Falls back to window.print() via seating-app savePdf() if pdf-lib unavailable.
*/
(function (global) {
  'use strict';

  var A4 = { w: 595.28, h: 841.89 };
  var M = 48;
  var GOLD = [173, 153, 120], GOLDL = [200, 180, 142], PUR = [128, 88, 161],
      CREAM = [246, 242, 234], INK = [26, 24, 20], INK2 = [60, 55, 47], MUT = [120, 112, 96],
      DARK = [9, 8, 7], DARK2 = [22, 19, 24], LINE = [214, 205, 188];

  var HOUSE = 'M92.02,38.41v51.4c0,2.63-2.13,4.75-4.75,4.75h-3.34c-2.62,0-4.75-2.12-4.75-4.75v-45.34c0-2.45-1.11-4.77-3.01-6.31l-25.23-20.41c-2.8-2.27-6.76-2.42-9.73-.36l-23.15,16.05.45,1.55c22.38,9.5,40.47,30.05,47.71,53.39.95,3.06-1.32,6.18-4.53,6.18h-5.36c-2.08,0-3.9-1.37-4.54-3.35-6.96-21.83-24.83-38.23-46.17-46.13-1.31-.49-2.31-1.5-2.79-2.75-.2-.51-.31-1.06-.32-1.64l-.12-9.11c-.02-1.58.75-3.06,2.05-3.96L28.74,10.74,42.11,1.45c.16-.11.32-.22.49-.31,2.35-1.4,5.22-1.5,7.64-.34.57.26,1.12.61,1.63,1.03l37.16,30.29c1.89,1.54,2.99,3.85,2.99,6.29Z ' +
    'M34.59,94.55h-5.25c-1.6,0-3.09-.81-3.97-2.15-5.47-8.37-11.98-15.35-20.72-20.32-1.5-.85-2.45-2.42-2.45-4.15v-5.58c0-3.52,3.68-5.79,6.85-4.26,12.79,6.15,23.95,16.91,29.85,29.73,1.45,3.14-.86,6.73-4.32,6.73h0Z ' +
    'M4.26,83.39c7.65-1.71,9.39,9.06,4.03,10.83-8.9,2.94-11.25-9.22-4.03-10.83Z';
  // WhatsApp glyph (official path, viewBox 24 — same asset as the website)
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
  function selfDir() {
    try { var s = document.currentScript; if (s && s.src) return s.src.replace(/[^/]*$/, ''); } catch (e) {}
    try { var arr = document.getElementsByTagName('script'); for (var i = arr.length - 1; i >= 0; i--) { if (/seating-pdf\.js/.test(arr[i].src)) return arr[i].src.replace(/[^/]*$/, ''); } } catch (e) {}
    return '../data/';
  }
  var BASE = selfDir();
  async function fetchBytes(url) { var r = await fetch(url); if (!r.ok) throw new Error('fetch ' + url + ' ' + r.status); return new Uint8Array(await r.arrayBuffer()); }

  // load an image URL → embedded pdf image (webp handled via canvas → jpeg)
  async function loadImage(doc, url) {
    var abs = (typeof document !== 'undefined') ? new URL(url, document.baseURI).href : url;
    if (/\.jpe?g(\?|$)/i.test(abs)) return doc.embedJpg(await fetchBytes(abs));
    if (/\.png(\?|$)/i.test(abs)) return doc.embedPng(await fetchBytes(abs));
    // webp / unknown → canvas transcode
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
      text: function (str, x, top, size, font, c, opts) { opts = opts || {}; page.drawText(String(str), { x: x, y: A4.h - top - size, size: size, font: font, color: col(c || INK), lineHeight: opts.lineHeight, maxWidth: opts.maxWidth }); },
      tracked: function (str, x, top, size, font, c, track) {
        track = track || 0; str = String(str); var cx = x, y = A4.h - top - size;
        for (var i = 0; i < str.length; i++) { page.drawText(str[i], { x: cx, y: y, size: size, font: font, color: col(c || INK) }); cx += font.widthOfTextAtSize(str[i], size) + track; }
        return cx - x - track;
      },
      trackedRight: function (str, right, top, size, font, c, track) {
        track = track || 0; str = String(str); var w = 0; for (var i = 0; i < str.length; i++) w += font.widthOfTextAtSize(str[i], size) + track; w -= track;
        P.tracked(str, right - w, top, size, font, c, track); return w;
      },
      right: function (str, right, top, size, font, c) { var w = font.widthOfTextAtSize(String(str), size); page.drawText(String(str), { x: right - w, y: A4.h - top - size, size: size, font: font, color: col(c || INK) }); },
      center: function (str, cx, top, size, font, c, track) {
        var w = 0; str = String(str);
        for (var i = 0; i < str.length; i++) w += font.widthOfTextAtSize(str[i], size) + (track || 0);
        w -= (track || 0); P.tracked(str, cx - w / 2, top, size, font, c, track || 0);
      },
      rect: function (x, top, w, h, c, o) { page.drawRectangle({ x: x, y: A4.h - top - h, width: w, height: h, color: col(c), opacity: o == null ? 1 : o }); },
      rectB: function (x, top, w, h, c, bw, o) { page.drawRectangle({ x: x, y: A4.h - top - h, width: w, height: h, borderColor: col(c), borderWidth: bw, opacity: 0, borderOpacity: o == null ? 1 : o }); },
      hline: function (x1, x2, top, c, t, o) { page.drawLine({ start: { x: x1, y: A4.h - top }, end: { x: x2, y: A4.h - top }, thickness: t || 0.6, color: col(c), opacity: o == null ? 1 : o }); },
      vline: function (x, top1, top2, c, t, o) { page.drawLine({ start: { x: x, y: A4.h - top1 }, end: { x: x, y: A4.h - top2 }, thickness: t || 0.6, color: col(c), opacity: o == null ? 1 : o }); },
      logo: function (x, top, h, c) { var sc = h / 95; page.drawSvgPath(HOUSE, { x: x, y: A4.h - top, scale: sc, color: col(c || GOLD) }); },
      image: function (img, x, top, w, h, o) { page.drawImage(img, { x: x, y: A4.h - top - h, width: w, height: h, opacity: o == null ? 1 : o }); },
      dot: function (x, top, r, c, borderC) { page.drawCircle({ x: x, y: A4.h - top, size: r, color: col(c), borderColor: borderC ? col(borderC) : undefined, borderWidth: borderC ? 0.6 : 0 }); },
      rrect: function (x, top, w, h, r, c, bw, o) {
        r = Math.min(r, w / 2, h / 2);
        var p = 'M ' + r + ',0 H ' + (w - r) + ' A ' + r + ',' + r + ' 0 0 1 ' + w + ',' + r + ' V ' + (h - r) + ' A ' + r + ',' + r + ' 0 0 1 ' + (w - r) + ',' + h + ' H ' + r + ' A ' + r + ',' + r + ' 0 0 1 0,' + (h - r) + ' V ' + r + ' A ' + r + ',' + r + ' 0 0 1 ' + r + ',0 Z';
        page.drawSvgPath(p, { x: x, y: A4.h - top, borderColor: col(c), borderWidth: bw || 0.8, borderOpacity: o == null ? 1 : o });
      },
      // vertical fade: stacked slices from transparent → solid `c` moving DOWN
      fadeDown: function (x, top, w, h, c, maxO, steps) {
        steps = steps || 56; maxO = maxO == null ? 1 : maxO;
        var slice = h / steps;
        for (var i = 0; i < steps; i++) {
          var t = (i + 1) / steps;                       // 0→1 down the band
          var o = maxO * t * t * (1 - (1 - t) * 0.2);    // eased, overlapping slices soften banding
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

  function money(n) { return n == null ? 'POA' : '£' + Number(n).toLocaleString('en-GB', { maximumFractionDigits: 0 }); }
  function mm(v) { return v != null ? Math.round(v) + ' mm' : null; }

  // shared page furniture (content pages)
  function pageHead(P, F, m, label, pageNo, total) {
    // v0.19.0 — p2 keeps the proposal masthead; pages 3+ carry their own title
    var lhs = (pageNo >= 3 && label) ? label : 'LUXURY SEATING PROPOSAL';
    P.tracked(lhs, M, 42, 8, F.r, [150, 138, 116], 2.4);
    if (pageNo) P.trackedRight(pageNo + ' / ' + total, A4.w - M, 42, 8, F.r, [170, 160, 140], 1.6);
    P.hline(M, A4.w - M, 68, LINE, 0.8);
  }
  function pageFoot(P, F, m) {
    var GDEEP = [140, 116, 60];
    P.hline(M, A4.w - M, A4.h - 56, LINE, 0.8);
    // email LHS
    P.tracked('PROJECTS@SONOR.CO.UK', M, A4.h - 44.2, 7.2, F.r, GDEEP, 1.4);
    // centre: Sonor mark + wordmark only
    var s = 'SONOR', ss = 9.5, tr = 2.8, tw = 0;
    for (var i = 0; i < s.length; i++) tw += F.b.widthOfTextAtSize(s[i], ss) + tr;
    tw -= tr;
    var markW = 15 * (93 / 95), gap = 7, totW = markW + gap + tw;
    var cx0 = (A4.w - totW) / 2;
    P.logo(cx0, A4.h - 47.5, 15, GOLD);
    P.tracked(s, cx0 + markW + gap, A4.h - 44.6, ss, F.b, GDEEP, tr);
    // WA RHS
    var phone = '07933 684 000', ps = 8;
    var phW = 0; for (var j = 0; j < phone.length; j++) phW += F.r.widthOfTextAtSize(phone[j], ps) + 1.2;
    var phX = A4.w - M - phW;
    P.tracked(phone, phX, A4.h - 44.4, ps, F.r, GDEEP, 1.2);
    P.page.drawSvgPath(WA, { x: phX - 14, y: 45.6, scale: 9.5 / 24, color: col(GDEEP) });
  }

  // ── PAGE 1 · COVER ───────────────────────────────────────────────────────────
  function cover(P, F, m, hero, fadeImg, mfrLogoImg) {
    P.rect(0, 0, A4.w, A4.h, DARK);
    if (hero) {
      var iw = hero.width, ih = hero.height, s = Math.max(A4.w / iw, A4.h / ih);
      var dw = iw * s, dh = ih * s;
      P.image(hero, (A4.w - dw) / 2, 0, dw, dh, 1);
      // smooth fade to brand dark — starts lower, canvas-rendered so it never bands
      var fTop = A4.h * 0.66, fH = A4.h * 0.22;
      if (fadeImg) P.image(fadeImg, 0, fTop, A4.w, fH, 1);
      else P.fadeDown(0, fTop, A4.w, fH, DARK, 1, 56);
      P.rect(0, fTop + fH - 1, A4.w, A4.h - (fTop + fH) + 1, DARK, 1);
    }
    // inset frame — CONSISTENT inset on all four sides; content sits inside it
    P.rectB(M * 0.62, M * 0.62, A4.w - M * 1.24, A4.h - M * 1.24, GOLD, 0.7, 0.34);

    // title block — range-led, sits on the fade
    var ty = 672;
    P.hline(M, M + 26, ty - 20, GOLD, 1, 0.95);
    P.tracked('LUXURY SEATING PROPOSAL', M + 34, ty - 24, 8.5, F.r, GOLDL, 3.2);
    P.text(m.range || 'Proposal', M - 2, ty, 54, F.b, CREAM);
    P.text('by ' + (m.manufacturer || 'Sonor'), M, ty + 62, 19, F.l, GOLDL);

    // client / project info (print-asset style)
    var iy = 772, cw = (A4.w - M * 2) / 3;
    P.hline(M, A4.w - M, iy - 16, GOLD, 0.5, 0.45);
    var info = [
      ['PREPARED FOR', m.client || '—'],
      ['PROJECT', m.project || '—'],
      ['REFERENCE', m.quoteRef || '—']
    ];
    info.forEach(function (c, i) {
      var x = M + i * cw;
      P.tracked(c[0], x, iy, 7, F.r, [168, 156, 136], 1.8);
      P.text(c[1], x, iy + 13, 12.5, F.b, CREAM, { maxWidth: cw - 16 });
    });
    // (no divider below the info band — the frame's bottom edge closes the block;
    //  a second line here reads as a pointless double divider)

    // footer — Sonor lockup bottom-left (website style: mark + wordmark, same colour),
    // CEDIA member logo bottom-right. Nothing else.
    // v0.22.5 — ANALYSIS: the strip centred at h-27 while the frame's bottom edge is
    // at h - M*0.62 ≈ h-26, so the logos sat ON the border line. The strip now centres
    // in the clear band BELOW the frame (h-14, heights ≤13) and the title/info stack
    // came down with it (ty 672, iy 772).
    var cyL = A4.h - 14;
    P.logo(M, cyL - 6, 12, CREAM);
    P.tracked('SONOR', M + 18, cyL - 4, 8, F.b, CREAM, 2.4);
    if (mfrLogoImg) {
      // manufacturer logo centred (Sonor left · manufacturer centre · CEDIA right)
      var mlh = 10, mlw = mfrLogoImg.width * (mlh / mfrLogoImg.height);
      if (mlw > 95) { mlw = 95; mlh = mfrLogoImg.height * (mlw / mfrLogoImg.width); }
      P.image(mfrLogoImg, (A4.w - mlw) / 2, cyL - mlh / 2, mlw, mlh, 0.92);
    }
    if (m._cedia) {
      // stacked lockup (taller than wide) → size by aspect: 2-line ≈ h13, 1-line h9
      var ch = (m._cedia.width / m._cedia.height) < 3 ? 13 : 9;
      var cwd = ch * (m._cedia.width / m._cedia.height);
      P.image(m._cedia, A4.w - M - cwd, cyL - ch / 2, cwd, ch, 0.92);
    } else {
      P.trackedRight('CEDIA MEMBER', A4.w - M, cyL - 3, 6, F.r, [168, 156, 136], 1.2);
    }
  }

  // ── PAGE 2 · SPECIFICATION + QUOTE + TERMS ───────────────────────────────────
  function quote(P, F, m, TOTAL_PAGES, rangeImg, swatchImg) {
    P.rect(0, 0, A4.w, A4.h, CREAM);
    pageHead(P, F, m, 'SPECIFICATION & ESTIMATE', 2, TOTAL_PAGES);

    P.tracked((m.manufacturer || 'SONOR').toUpperCase(), M, 92, 8.5, F.r, GOLD, 2.6);
    P.text(m.range || '', M - 1, 106, 26, F.b, INK);

    var top = 158, colW = 250;
    var grpLabel = m.materialGroup ? (m.materialGroup.charAt(0).toUpperCase() + m.materialGroup.slice(1).toLowerCase()) : null;
    // v0.15.0 — seats only: Room + Lead time rows removed (room lives on the plan
    // page, lead time in Terms). No inline dots — the swatch presents as a framed
    // square on the right of the Colour row: real photo when the library has one,
    // otherwise the same framed square filled with the colour.
    var rows = [
      ['Layout', m.layoutText],
      // v0.16.0 — single Upholstery type row (was Upholstery type + Material duplicate)
      ['Upholstery', m.materialName || (m.upholsteryText || 'Confirmed at quotation')],
      ['Colour', m.colourName],
      ['Row configuration', (m.rowDetails && m.rowDetails.length) ? m.rowDetails.join('  —  ') : null],
      ['Recline', m.reclineText],
      ['Options', (m.finishes && m.finishes.length) ? m.finishes.join(', ') : null]
    ].filter(function (r) { return r[1]; });
    var sy = top, colourRowY = null;
    rows.forEach(function (r, ri) {
      if (r[0] === 'Colour') colourRowY = sy;
      P.tracked(String(r[0]).toUpperCase(), M, sy, 6.5, F.r, MUT, 1.5);
      var lines = wrap(String(r[1]), F.b, 11.5, colW - 54);
      lines.forEach(function (ln, li) { P.text(ln, M, sy + 11 + li * 13.5, 11.5, F.b, INK); });
      sy += 11 + lines.length * 13.5 + 11;
      if (ri < rows.length - 1) P.hline(M, M + colW, sy - 7, LINE, 0.5, 0.7);   // no dangling line after the last row
    });
    // swatch square — right of the Colour row: photo, else colour fill
    if (colourRowY != null && (swatchImg || (m.colourHex && !m.colourIsOpenChoice))) {
      // swatch keeps the photo's TRUE aspect (height-fixed, width follows), right-aligned
      // to the column and vertically clear of the row divider below
      var swH = 23, swW = 40, swY = colourRowY - 2;
      if (swatchImg) {
        swW = Math.max(23, Math.min(56, swH * (swatchImg.width / swatchImg.height)));
      }
      var swX = M + colW - swW;
      if (swatchImg) {
        P.image(swatchImg, swX, swY, swW, swH, 1);
      } else {
        var hx2 = String(m.colourHex || m.materialSwatchHex || '#8c8273').replace('#', '');
        var rgb2 = /^[0-9a-f]{6}$/i.test(hx2) ? [parseInt(hx2.slice(0, 2), 16), parseInt(hx2.slice(2, 4), 16), parseInt(hx2.slice(4, 6), 16)] : [140, 130, 115];
        P.rect(swX, swY, swW, swH, rgb2);
      }
      P.rectB(swX, swY, swW, swH, LINE, 0.7);
    }

    // the chosen model (right) — hero photograph, plan lives on page 3
    var planX = M + colW + 22, planW = A4.w - M - planX, imgBottom = top + 170;
    if (rangeImg) {
      // width-fit to the column (height-capped), right edge on the table edge
      var bhMax = 230, iw = rangeImg.width, ih = rangeImg.height;
      var dw2 = planW, dh2 = ih * (planW / iw);
      if (dh2 > bhMax) { dh2 = bhMax; dw2 = iw * (bhMax / ih); }
      var ix = A4.w - M - dw2, iyTop = (top - 4);
      try { P.image(rangeImg, ix, iyTop, dw2, dh2, 1); } catch (e) {}
      P.rectB(ix, iyTop, dw2, dh2, LINE, 0.8);
      imgBottom = iyTop + dh2;
    } else {
      drawMiniPlan(P, F, m, planX, top - 4, planW, 168);
    }

    // quote table
    var qy = Math.max(sy + 18, imgBottom + 28) + 4;   // straight into the table — no heading
    var cQty = A4.w - M - 210, cUnit = A4.w - M - 110, cLine = A4.w - M;
    P.tracked('SEATS', M, qy, 6.5, F.r, MUT, 1.4);
    P.trackedRight('QTY', cQty + 20, qy, 6.5, F.r, MUT, 1.4);
    P.trackedRight('UNIT', cUnit + 40, qy, 6.5, F.r, MUT, 1.4);
    P.trackedRight('TOTAL', cLine, qy, 6.5, F.r, MUT, 1.4);
    P.hline(M, A4.w - M, qy + 11, GOLD, 0.8, 0.75);
    var y = qy + 27, accStarted = false, nLines = (m.lines || []).length;
    (m.lines || []).forEach(function (l, li) {
      if (l.acc && !accStarted) {
        // one gold divider + section label between seats and accessories
        accStarted = true;
        y += 4;
        P.hline(M, A4.w - M, y - 6, GOLD, 0.8, 0.75);
        P.tracked('ACCESSORIES', M, y + 4, 6.5, F.r, MUT, 1.4);
        y += 24;
      }
      P.text(l.label, M, y - 9, 10.5, F.r, INK, { maxWidth: cQty - M - 12 });
      P.right(String(l.qty), cQty + 20, y - 9, 10.5, F.r, INK2);
      P.right(money(l.unit), cUnit + 40, y - 9, 10.5, F.r, INK2);
      P.right(l.unit != null ? money(l.unit * l.qty) : 'POA', cLine, y - 9, 10.5, F.b, INK);
      // thin divider between rows only — never after the last seat row (the gold
      // ACCESSORIES/totals divider follows it, so a thin line there doubles up)
      var nxt = (m.lines || [])[li + 1];
      if (li < nLines - 1 && !(nxt && nxt.acc && !l.acc)) P.hline(M, A4.w - M, y + 5, LINE, 0.5, 0.6);
      y += 22;
    });
    // ONE divider (gold) between items and totals — clear of the last row
    y += 4;
    P.hline(M, A4.w - M, y - 4, GOLD, 0.8, 0.75); y += 10;
    var totRows = [['Products subtotal', money(m.productTotal)],
     [m.deliveryLabel || 'Delivery', m.deliveryCost != null ? money(m.deliveryCost) : 'On request']];
    if (m.installCost != null) totRows.push([m.installLabel || 'Installation', money(m.installCost)]);
    totRows.push(['Subtotal (ex VAT)', money(Math.round(m.exVat))]);
    totRows.push(['VAT @ ' + Math.round((m.vatRate || 0) * 100) + '%', money(Math.round(m.vat))]);
    totRows.forEach(function (r) {
      P.text(r[0], M, y - 9, 10, F.r, MUT); P.right(r[1], cLine, y - 9, 10, F.r, INK2); y += 17;
    });
    P.hline(cQty, A4.w - M, y - 2, GOLD, 0.8, 0.75); y += 16;
    P.text('Total', M, y - 10, 13, F.b, [140, 116, 60]);
    P.tracked('INC VAT', M + F.b.widthOfTextAtSize('Total', 13) + 10, y - 4, 7, F.r, [160, 140, 96], 1.4);
    P.right(m.grossText || 'On request', cLine, y - 12, 17, F.b, [140, 116, 60]); y += 24;

    // v0.18.0 — full terms live on the FINAL page; p2 carries one indicative note
    P.center('Indicative pricing only — please refer to Terms & Payment on the final page for lead times, deposit and conditions.',
      A4.w / 2, A4.h - 84, 8, F.r, MUT);
    pageFoot(P, F, m);
  }

  function wrap(str, font, size, maxW) {
    var words = String(str).split(' '), line = '', out = [];
    for (var i = 0; i < words.length; i++) {
      var t = line ? line + ' ' + words[i] : words[i];
      if (font.widthOfTextAtSize(t, size) > maxW && line) { out.push(line); line = words[i]; }
      else line = t;
    }
    if (line) out.push(line);
    return out;
  }

  function drawMiniPlan(P, F, m, x, top, w, h) {
    P.rect(x, top, w, h, DARK2);
    P.rectB(x, top, w, h, [70, 60, 80], 0.8, 0.5);
    var sw = w * 0.62, sx = x + (w - sw) / 2;
    P.rect(sx, top + 10, sw, 3.5, GOLDL);
    P.center('S C R E E N', x + w / 2, top + 17, 5, F.r, GOLDL, 1.4);
    var rows = m.rows || 2, per = m.seatsPerRow || 3, gap = 5;
    var areaTop = top + 30, areaH = h - 42;
    var seatW = Math.min((w - 20 - (per - 1) * gap) / per, 40);
    var seatH = Math.min((areaH - (rows - 1) * gap) / rows, 52);
    var totalW = per * seatW + (per - 1) * gap, sx0 = x + (w - totalW) / 2;
    for (var r = 0; r < rows; r++) for (var s = 0; s < per; s++) {
      var cx = sx0 + s * (seatW + gap), cy = areaTop + r * (seatH + gap);
      P.rect(cx, cy, seatW, seatH, [138, 108, 168]);
      P.rect(cx, cy, seatW, seatH * 0.28, GOLDL, 0.16);
      P.rectB(cx, cy, seatW, seatH, [180, 150, 210], 0.5, 0.6);
    }
    P.center((m.roomWidthText || '') + ' · ' + (rows * per) + ' seats', x + w / 2, top + h - 11, 6, F.r, [150, 140, 120], 0.5);
  }

  // ── PAGE 3 · DIMENSIONED SEATING PLAN (CAD-style) ────────────────────────────
  function drawing(P, F, m, TOTAL_PAGES) {
    P.rect(0, 0, A4.w, A4.h, CREAM);
    pageHead(P, F, m, 'DIMENSIONED LAYOUT', 3, TOTAL_PAGES);
    P.text(m.range + ' — ' + (m.rows || 2) + ' rows × ' + (m.seatsPerRow || 3), M - 1, 106, 22, F.b, INK);
    P.right('All dimensions in mm', A4.w - M, 108, 9, F.r, MUT);

    var S = m.spec || {};
    var seatW = S.planSeatWidthSel || S.planSeatWidthMm || 650;
    var armW = S.modularArms ? (S.armWidthMm || 150) : 0;
    var uprD = S.seatDepthMm || 1050;                                   // upright footprint
    var reclD = S.reclinedDepthMm || Math.round(uprD * 1.5);            // reclined envelope
    if (reclD < uprD) reclD = uprD;
    // v0.14.0 — rows sit almost touching the reclined envelope ahead (rowGap default
    // 50mm) and the rear row runs close to the rear wall (manufacturer wall clearance
    // wins when the library has it).
    var rowGap = S.rowGapMm != null ? S.rowGapMm : 50;
    var wallClear = S.wallClearanceMm != null ? S.wallClearanceMm : 100;
    var roomW = m.roomWidthMm || 4000, roomL = m.roomLengthMm || 6000;
    var rows = m.rows || 2, per = m.seatsPerRow || 3;

    // fit room into plan box (generous margins so dimension strings never crowd)
    var bx = M + 58, bTop = 172, bw = A4.w - M * 2 - 116, bh = 452;
    var sc = Math.min(bw / roomW, bh / roomL);
    var rw = roomW * sc, rl = roomL * sc;
    var rx = bx + (bw - rw) / 2, rTop = bTop + (bh - rl) / 2;

    var DIM = [110, 100, 88], CADL = [90, 84, 72], GHOST = [150, 142, 126];
    // room outline (double line, architectural)
    P.rectB(rx - 3, rTop - 3, rw + 6, rl + 6, CADL, 1.4, 0.9);
    P.rectB(rx, rTop, rw, rl, CADL, 0.7, 0.8);
    // screen wall
    P.rect(rx + rw * 0.14, rTop + 8, rw * 0.72, 5, GOLD, 0.85);
    P.center('S C R E E N', rx + rw / 2, rTop + 18, 6, F.r, [140, 120, 88], 2);

    // seats — CENTRED across the room, anchored to the REAR wall (backs to the rear).
    // Solid = upright footprint; lighter ghost ahead = reclined envelope (footrest extends
    // toward the screen).
    // Seats butt arm-to-arm (manufacturer width includes arms) — no invented gap,
    // so the total run = per × seat width and the drawing reads truly to scale.
    // seats butt together; separate armrest MODULES sit between and at row ends
    var totalRowW = S.rowRunMm || (S.modularArms ? per * seatW + (per + 1) * armW : per * seatW);
    var sideSpace = Math.round((roomW - totalRowW) / 2);
    var sx0 = rx + (rw - totalRowW * sc) / 2;
    var seatPX = seatW * sc, uprPX = uprD * sc, reclPX = reclD * sc, armPX = armW * sc, rowGapPX = rowGap * sc;
    var rearY = rTop + rl - wallClear * sc;                             // back of rearmost row
    var pitchPX = reclPX + rowGapPX;
    var frontRowRear = rearY - (rows - 1) * pitchPX;                    // back of front row
    for (var r = 0; r < rows; r++) {
      var rRear = rearY - (rows - 1 - r) * pitchPX;                     // r=0 front … r=rows-1 rear
      var ryU = rRear - uprPX;                                          // upright top (front edge)
      var ryR = rRear - reclPX;                                         // reclined top
      var cx = sx0;
      for (var s = 0; s < per; s++) {
        if (armW) { P.rrect(cx, ryU, armPX, uprPX, 2.5, INK2, 0.7, 0.6); cx += armPX; }   // armrest module (shared / row end)
        var aw = armW ? 0 : seatPX * 0.15;
        if (reclPX > uprPX + 2) P.rrect(cx + 1.5, ryR, seatPX - 3, reclPX - uprPX + 3, 3, GHOST, 0.7, 0.55);
        P.rrect(cx, ryU, seatPX, uprPX, 4, INK2, 1, 0.9);
        if (!armW) {
          P.rrect(cx + 1.2, ryU + 1.2, aw, uprPX - 2.4, 2.5, INK2, 0.6, 0.55);
          P.rrect(cx + seatPX - aw - 1.2, ryU + 1.2, aw, uprPX - 2.4, 2.5, INK2, 0.6, 0.55);
        }
        P.rrect(cx + aw + 2.5, ryU + uprPX * 0.08, seatPX - 2 * aw - 5, uprPX * 0.52, 3, INK2, 0.7, 0.75);
        P.rrect(cx + aw + 2.5, ryU + uprPX * 0.66, seatPX - 2 * aw - 5, uprPX * 0.26, 3, INK2, 0.9, 0.9);
        cx += seatPX;
      }
      if (armW) P.rrect(cx, ryU, armPX, uprPX, 2.5, INK2, 0.7, 0.6);                        // closing end armrest
    }

    // ── dimension helpers ──
    function dimH(x1, x2, top, label, above) {
      P.hline(x1, x2, top, DIM, 0.7); P.vline(x1, top - 4, top + 4, DIM, 0.7); P.vline(x2, top - 4, top + 4, DIM, 0.7);
      P.center(label, (x1 + x2) / 2, above ? top - 14 : top + 7, 7.5, F.b, DIM);
    }
    function dimV(x, t1, t2, label, leftSide) {
      P.vline(x, t1, t2, DIM, 0.7); P.hline(x - 4, x + 4, t1, DIM, 0.7); P.hline(x - 4, x + 4, t2, DIM, 0.7);
      P.center(label, x + (leftSide ? -20 : 18), (t1 + t2) / 2 - 4, 7.5, F.b, DIM);
    }
    // room width (top) + room length (left) — outside the room
    dimH(rx, rx + rw, rTop - 18, roomW + '', true);
    dimV(rx - 20, rTop, rTop + rl, roomL + '', true);
    // seat width (above the front row's reclined envelope, clear of the room lines)
    dimH(sx0 + armPX, sx0 + armPX + seatPX, frontRowRear - reclPX - 12, Math.round(seatW) + '', true);
    // armrest width — only when the library holds a real armrest dimension
    if (armW) dimH(sx0, sx0 + armPX, frontRowRear - reclPX - 34, 'arm ' + Math.round(armW), true);
    // side space either side of the run — at the rear row, inside the room
    var sideYc = rearY - uprPX / 2;
    dimH(rx, sx0, sideYc, sideSpace + '', true);
    dimH(sx0 + totalRowW * sc, rx + rw, sideYc, sideSpace + '', true);
    // total seating run (below plan, outside)
    dimH(sx0, sx0 + totalRowW * sc, rTop + rl + 16, Math.round(totalRowW) + '', false);
    // right-hand chain OUTSIDE the room: reclined depth · upright depth · row gap · rear clearance
    var rgx = rx + rw + 18;
    dimV(rgx, frontRowRear - reclPX, frontRowRear, Math.round(reclD) + '');
    if (rows > 1) dimV(rgx, frontRowRear, frontRowRear + rowGapPX, Math.round(rowGap) + '');
    dimV(rgx, rearY - uprPX, rearY, Math.round(uprD) + '');

    // notes — with the data source made explicit
    var ny = bTop + bh + 58;
    P.hline(M, A4.w - M, ny - 20, LINE, 0.7);
    var src = S.dimsReal ? 'Seat dimensions from manufacturer data' : 'Seat dimensions are standard allowances (manufacturer data pending)';
    var notes = src + ': width ' + Math.round(seatW) + 'mm · upright depth ' + Math.round(uprD) + 'mm · reclined ' + Math.round(reclD) + 'mm (shown lighter)' + (S.armWidthMm ? ' · armrest ' + Math.round(S.armWidthMm) + 'mm' : '') + '. Rows sit ' + rowGap + 'mm behind the reclined envelope ahead · ' + sideSpace + 'mm free each side. Indicative seating layout only — refer to the main cinema design plans for the final specification; site survey confirms setting-out.';
    wrap(notes, F.r, 8.5, A4.w - M * 2).forEach(function (ln, li) { P.text(ln, M, ny + li * 11.5, 8.5, F.r, MUT); });
    pageFoot(P, F, m);
  }

  // ── PAGE 4 · TECHNICAL SPECIFICATION ─────────────────────────────────────────
  function techspec(P, F, m, rangeImg, TOTAL_PAGES, mfrLogoImg) {
    P.rect(0, 0, A4.w, A4.h, CREAM);
    pageHead(P, F, m, 'MODEL DATA', 4, TOTAL_PAGES);
    P.tracked((m.manufacturer || '').toUpperCase(), M, 92, 8.5, F.r, GOLD, 2.6);
    P.text(m.range || '', M - 1, 106, 26, F.b, INK);
    // v0.22.2 — no logo chip on Model Data (white-on-transparent logos need a dark
    // chip and it fights the cream page); style descriptor only. Logos live on the cover.
    if (m.spec && m.spec.style) {
      P.right(m.spec.style, A4.w - M, 108, 10, F.r, MUT);
    }

    // range photograph — as large as the page allows (grid + references + footer
    // still need ~330pt below), contain-fit, thin frame at the image bounds
    var top = 158;
    if (rangeImg) {
      // fit to the content width where the aspect allows (height-capped contain otherwise)
      var iw = rangeImg.width, ih = rangeImg.height;
      var boxW = A4.w - M * 2, boxH = 330;
      var dw = boxW, dh = ih * (boxW / iw), ix2 = M;
      if (dh > boxH) { dh = boxH; dw = iw * (boxH / ih); ix2 = M + (boxW - dw) / 2; }
      P.image(rangeImg, ix2, top, dw, dh, 1);
      P.rectB(ix2, top, dw, dh, LINE, 0.8);
      top += dh + 24;
    }

    var S = m.spec || {};
    var specs = [
      ['Seat width', mm(S.seatWidthMm)],
      ['Seat depth', mm(S.seatDepthMm)],
      ['Reclined depth', mm(S.reclinedDepthMm)],
      ['Country of origin', m.countryOfOrigin || null],
      ['Recline', m.reclineText],
      ['Upholstery', m.materialName ? (m.materialName + (m.colourName ? ' · ' + m.colourName : '')) : null],
      ['Options', (m.finishes && m.finishes.length) ? m.finishes.join(', ') : null],
      ['Lead time', m.leadText]
    ].filter(function (r) { return r[1]; });
    top += 6;
    var half = Math.ceil(specs.length / 2), colW2 = (A4.w - M * 2 - 24) / 2;
    // two-column layout
    for (var i = 0; i < specs.length; i++) {
      var colI = i < half ? 0 : 1;
      var rowI = colI === 0 ? i : i - half;
      var cx = M + colI * (colW2 + 24), cy = top + rowI * 34;
      P.tracked(String(specs[i][0]).toUpperCase(), cx, cy, 6.5, F.r, MUT, 1.5);
      P.text(String(specs[i][1]), cx, cy + 10, 11.5, F.b, INK, { maxWidth: colW2 });
      P.hline(cx, cx + colW2, cy + 27, LINE, 0.5, 0.7);
    }
    top += half * 34 + 22;

    // links
    P.tracked('REFERENCES', M, top, 8, F.b, GOLD, 2.2); top += 16;
    // display text is trimmed to the content width so nothing overspills; the
    // link annotation still carries the FULL url
    function fitUrl(u) {
      var maxW = A4.w - M - (M + 78), t = String(u).replace(/^https?:\/\//, '');
      while (t.length > 8 && F.r.widthOfTextAtSize(t, 9.5) > maxW) t = t.slice(0, -8) + '…';
      return t;
    }
    if (m.productUrl) { P.text('Product page:', M, top, 9.5, F.r, MUT); P.link(m.productUrl, M + 78, top, 9.5, F.r, [120, 90, 140], fitUrl(m.productUrl)); top += 18; }
    if (m.datasheetUrl) { P.text('Datasheet:', M, top, 9.5, F.r, MUT); P.link(m.datasheetUrl, M + 78, top, 9.5, F.r, [120, 90, 140], fitUrl(m.datasheetUrl)); top += 18; }
    if (m.manufacturerUrl) { P.text('Manufacturer:', M, top, 9.5, F.r, MUT); P.link(m.manufacturerUrl, M + 78, top, 9.5, F.r, [120, 90, 140], fitUrl(m.manufacturerUrl)); top += 18; }
    P.text(m._dsAppended ? 'The manufacturer datasheet is appended to this document.' : 'Manufacturer datasheet available via the link above or on request.', M, top, 9, F.r, MUT);
    pageFoot(P, F, m);
  }


  // ── PAGE 5 · ADDITIONAL OPTIONS — everything available that wasn't picked ─────
  function optionsPage(P, F, m, TOTAL_PAGES) {
    P.rect(0, 0, A4.w, A4.h, CREAM);
    pageHead(P, F, m, 'ADDITIONAL OPTIONS', 5, TOTAL_PAGES);
    P.tracked('AVAILABLE ON THIS RANGE', M, 96, 8.5, F.r, GOLD, 2.6);
    var introLines = wrap('A menu of everything available on the ' + (m.range || '') + ' — in case anything was missed during configuration. Values show the change to this proposal’s total (ex VAT) if swapped in; ask us to add any of these to your formal quotation.', F.r, 9, A4.w - M * 2);
    introLines.forEach(function (ln, li) { P.text(ln, M, 118 + li * 12, 9, F.r, MUT); });
    var om = m.optionsMenu || {};
    var y = 118 + introLines.length * 12 + 26, colR = A4.w - M;
    function section(title) { P.tracked(title, M, y, 8, F.b, GOLD, 2.2); y += 6; P.hline(M, A4.w - M, y + 4, GOLD, 0.8, 0.75); y += 16; }
    function fitLine(t, font, size, maxW) { t = String(t); while (t.length > 6 && font.widthOfTextAtSize(t, size) > maxW) t = t.slice(0, -4) + '…'; return t; }
    function row(label, right, sel) {
      if (sel) P.dot(M + 3, y + 1, 3, [173, 153, 120], [173, 153, 120]);
      P.text(fitLine(label, sel ? F.b : F.r, 9.5, A4.w - M * 2 - 120), M + (sel ? 12 : 12), y - 4, 9.5, sel ? F.b : F.r, sel ? INK : INK2);
      if (right) P.right(right, colR, y - 4, 9.5, F.r, MUT);
      y += 16;
    }
    // ± increments on THIS configuration's total (ex VAT) — not per-seat prices
    function deltaText(x) {
      if (x.selected) return 'selected';
      if (x.delta == null) return 'at quotation';
      if (x.delta === 0) return 'no change';
      return (x.delta > 0 ? '+ ' : '- ') + money(Math.abs(x.delta));
    }
    // price order: upgrades (+) above, the selected line in the middle, savings (−)
    // below, unpriced last
    function optSort(arr) {
      return arr.slice().sort(function (a, b) {
        var av = a.selected ? 0 : (a.delta == null ? -Infinity : a.delta);
        var bv = b.selected ? 0 : (b.delta == null ? -Infinity : b.delta);
        return bv - av;
      });
    }
    if ((om.materials || []).length) {
      section('UPHOLSTERY LINES');
      optSort(om.materials).forEach(function (x) { row(x.name + (x.group ? '  ·  ' + x.group : ''), deltaText(x), x.selected); });
      row("COM — customer's own material", 'at quotation', false);
      y += 8;
    }
    if ((om.recline || []).length) {
      section('RECLINE');
      optSort(om.recline).forEach(function (x) { row(x.label, deltaText(x), x.selected); });
      y += 8;
    }
    if ((om.finishes || []).length) {
      section('FINISH UPGRADES');
      om.finishes.forEach(function (x) { row(x.label + (x.note ? '  —  ' + x.note : ''), '', x.selected); });
      y += 8;
    }
    if ((om.accessories || []).length) {
      section('ACCESSORIES');
      om.accessories.forEach(function (x) {
        if (y > A4.h - 110) return;
        row(x.label + (x.qty ? '  (× ' + x.qty + ' selected)' : ''), x.price != null ? '+ ' + money(x.price) + ' each' : 'POA', !!x.qty);
      });
    }
    P.dot(M + 3, A4.h - 79, 3, [173, 153, 120], [173, 153, 120]);
    P.text('marks selections already in this proposal.', M + 12, A4.h - 84, 8, F.r, MUT);
    pageFoot(P, F, m);
  }

  // ── PAGE 6 · TERMS & PAYMENT — the full terms, on their own closing page ─────
  function termsPage(P, F, m, TOTAL_PAGES) {
    P.rect(0, 0, A4.w, A4.h, CREAM);
    pageHead(P, F, m, 'TERMS & PAYMENT', 6, TOTAL_PAGES);
    // v0.22.0 — THE DETAIL leads, PAYMENT follows it; quote reference sits alone near
    // the foot of the page; everything given air.
    var y = 100;
    P.tracked('THE DETAIL', M, y, 8.5, F.r, GOLD, 2.6); y += 24;
    var termAll = [
      'Proposal prepared ' + (m.dateText || '') + (m.client ? ' for ' + m.client : '') + (m.project ? ' — ' + m.project : '') + '.',
      'Estimate only — a formal quotation will be prepared for your final choices and accessories once all information and latest pricing have been verified.',
      'Lead time: ' + (m.leadText || 'confirmed at quotation') + ' from order confirmation and fabric approval.',
      'Made to order: each seat is manufactured to your exact specification. Once production begins the specification (model, size, upholstery, colour and options) cannot be altered, and bespoke items are non-returnable.'
    ].concat(m.termsLines || []);
    termAll.forEach(function (t) {
      var lines = wrap(t, F.r, 9.5, A4.w - M * 2 - 14);
      P.text('·', M, y - 1, 9.5, F.b, GOLD);
      lines.forEach(function (ln, li) { P.text(ln, M + 12, y + li * 14, 9.5, F.r, INK2); });
      y += lines.length * 14 + 12;
    });
    y += 10; P.hline(M, A4.w - M, y, GOLD, 0.8, 0.75); y += 26;
    P.tracked('PAYMENT', M, y, 8.5, F.b, GOLD, 2.6); y += 20;
    P.text(m.paymentTerms || '50% deposit on order · 50% balance prior to delivery', M, y, 12.5, F.b, INK);
    if (m.quoteRef) {
      var qy2 = A4.h - 158;
      P.hline(M, A4.w - M, qy2, GOLD, 0.8, 0.75); qy2 += 22;
      P.tracked('QUOTE REFERENCE', M, qy2, 8, F.b, GOLD, 2.2);
      P.right(m.quoteRef, A4.w - M, qy2 - 4, 14, F.b, INK); qy2 += 22;
      P.text('Please quote this reference in any correspondence about this proposal.', M, qy2, 8.5, F.r, MUT);
    }
    pageFoot(P, F, m);
  }

  // ── BOM — single-page internal bill of materials (v0.22.0) ───────────────────
  // Utilitarian companion to the client proposal: spec block + full line table with
  // ex-VAT unit/line values, delivery, installation, VAT and gross. INTERNAL USE.
  async function generateBom(m) {
    var PDFLib = global.PDFLib;
    if (!PDFLib || !PDFLib.PDFDocument) return false;
    var doc = await PDFLib.PDFDocument.create();
    try { if (global.fontkit) doc.registerFontkit(global.fontkit); } catch (e) {}
    var F;
    try {
      F = { b: await doc.embedFont(await fetchBytes(BASE + 'fonts/gilroy-extrabold.otf'), { subset: false }),
            r: await doc.embedFont(await fetchBytes(BASE + 'fonts/gilroy-regular.otf'), { subset: false }) };
    } catch (e) {
      var hb = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold), hr = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
      F = { b: hb, r: hr };
    }
    doc.setTitle('Sonor — ' + (m.range || 'Seating') + ' BOM (internal)');
    doc.setAuthor('Sonor'); doc.setCreator('Sonor Seating Configurator');
    var P = mk(doc.addPage([A4.w, A4.h]), doc);
    P.rect(0, 0, A4.w, A4.h, CREAM);
    // head
    P.tracked('BILL OF MATERIALS', M, 56, 8.5, F.b, GOLD, 2.6);
    P.trackedRight('INTERNAL USE ONLY', A4.w - M, 56, 8.5, F.b, [178, 88, 66], 2.2);
    P.hline(M, A4.w - M, 68, GOLD, 0.8, 0.75);
    P.tracked((m.manufacturer || '').toUpperCase(), M, 92, 8.5, F.r, GOLD, 2.6);
    P.text((m.range || '') + ' — ' + (m.layoutText || ''), M - 1, 106, 20, F.b, INK);
    // spec block
    var meta = [
      ['PROJECT', m.project || '—'], ['CLIENT', m.client || '—'],
      ['REFERENCE', m.quoteRef || '—'], ['DATE', m.dateText || '—'],
      ['UPHOLSTERY', (m.materialName || m.upholsteryText || '—') + (m.colourName ? ' · ' + m.colourName : '')],
      ['RECLINE', m.reclineText || '—'],
      ['ROOM', m.roomText || '—'], ['LEAD TIME', m.leadText || '—']
    ];
    // v0.22.4 — single-line values TRUNCATED to the cell: wrapping here collided
    // with the divider below and the neighbouring rows
    function fit1(t, font, size, maxW) { t = String(t); while (t.length > 4 && font.widthOfTextAtSize(t, size) > maxW) t = t.slice(0, -4) + '…'; return t; }
    var by = 148, bw = (A4.w - M * 2 - 36) / 4;
    meta.forEach(function (r2, i2) {
      var bx = M + (i2 % 4) * (bw + 12), byy = by + Math.floor(i2 / 4) * 34;
      P.tracked(r2[0], bx, byy, 6.5, F.r, MUT, 1.4);
      P.text(fit1(r2[1], F.b, 9.5, bw), bx, byy + 10, 9.5, F.b, INK);
    });
    var y = by + 2 * 34 + 16;
    P.hline(M, A4.w - M, y, GOLD, 0.8, 0.75); y += 18;
    // line table — TRADE breakdown when trade prices came back, MSRP fallback otherwise
    var hasTrade = !!(m.tradeLines && m.tradeLines.length);
    var rowsSrc = hasTrade ? m.tradeLines : (m.lines || []);
    var cQty = A4.w - M - 280, cT1 = A4.w - M - 200, cT2 = A4.w - M - 100, cLine = A4.w - M;
    P.tracked('ITEM', M, y, 6.5, F.r, MUT, 1.4);
    P.trackedRight('QTY', cQty + 18, y, 6.5, F.r, MUT, 1.4);
    P.trackedRight(hasTrade ? 'TRADE UNIT' : 'UNIT EX VAT', cT1 + 30, y, 6.5, F.r, MUT, 1.4);
    P.trackedRight(hasTrade ? 'TRADE LINE' : 'LINE EX VAT', cT2 + 30, y, 6.5, F.r, MUT, 1.4);
    P.trackedRight(hasTrade ? 'MSRP LINE' : '', cLine, y, 6.5, F.r, MUT, 1.4);
    P.hline(M, A4.w - M, y + 9, GOLD, 0.8, 0.75); y += 24;
    // v0.22.4 — item name truncated to its column on ONE line; SKU gets its own
    // small second line with a proper row-height advance (no more overlap)
    rowsSrc.forEach(function (l) {
      if (y > A4.h - 240) return;
      P.text(fit1(l.label, F.r, 9, cQty - M - 10), M, y - 8, 9, F.r, INK);
      P.right(String(l.qty), cQty + 18, y - 8, 9.5, F.r, INK2);
      if (hasTrade) {
        P.right(l.trade != null ? money(l.trade) : '—', cT1 + 30, y - 8, 9.5, F.r, INK2);
        P.right(l.trade != null ? money(l.trade * l.qty) : 'n/a', cT2 + 30, y - 8, 9.5, F.b, INK);
        P.right(l.unit != null ? money(l.unit * l.qty) : 'POA', cLine, y - 8, 9.5, F.r, MUT);
      } else {
        P.right(money(l.unit), cT1 + 30, y - 8, 9.5, F.r, INK2);
        P.right(l.unit != null ? money(l.unit * l.qty) : 'POA', cT2 + 30, y - 8, 9.5, F.b, INK);
      }
      if (l.sku) { P.text(fit1(l.sku, F.r, 7, cQty - M - 10), M, y + 3, 7, F.r, MUT); y += 24; }
      else y += 17;
    });
    y += 2; P.hline(M, A4.w - M, y - 4, GOLD, 0.8, 0.75); y += 14;
    // ── COMMERCIAL SUMMARY — trade cost vs MSRP with margin ──
    var msrpProd = m.productTotal || 0;
    if (hasTrade) {
      var tt = m.tradeTotal || 0;
      var margin = msrpProd - tt, pct = msrpProd ? Math.round((margin / msrpProd) * 100) : 0;
      P.tracked('COMMERCIAL SUMMARY', M, y, 7.5, F.b, GOLD, 2.2); y += 18;
      var sum = [
        ['Products — trade cost' + (m.tradeComplete ? '' : ' (some lines missing trade — see n/a)'), money(tt)],
        ['Products — MSRP (ex VAT)', money(msrpProd)],
        ['Product margin', money(margin) + '   (' + pct + '%)'],
        [(m.deliveryLabel || 'Delivery') + ' — charged', m.deliveryCost != null ? money(m.deliveryCost) : 'On request'],
        [(m.installLabel || 'Installation') + ' — charged', m.installCost != null ? money(m.installCost) : '—'],
        ['Client total (inc VAT)', m.grossText || 'On request']
      ];
      sum.forEach(function (r3, i3) {
        var strong = i3 === 2 || i3 === sum.length - 1;
        P.text(r3[0], M, y - 8, strong ? 10 : 9.5, strong ? F.b : F.r, strong ? INK : MUT);
        P.right(r3[1], cLine, y - 8, strong ? 10.5 : 9.5, strong ? F.b : F.r, i3 === 2 ? [110, 140, 90] : (strong ? [140, 116, 60] : INK2));
        y += strong ? 20 : 16;
      });
    } else {
      var tot = [['Products subtotal (MSRP ex VAT)', money(msrpProd)],
        [m.deliveryLabel || 'Delivery', m.deliveryCost != null ? money(m.deliveryCost) : 'On request']];
      if (m.installCost != null) tot.push([m.installLabel || 'Installation', money(m.installCost)]);
      tot.push(['Subtotal (ex VAT)', money(Math.round(m.exVat))]);
      tot.push(['VAT @ ' + Math.round((m.vatRate || 0) * 100) + '%', money(Math.round(m.vat))]);
      tot.push(['Total (inc VAT)', m.grossText || 'On request']);
      tot.forEach(function (r3, i3) {
        var last = i3 === tot.length - 1;
        P.text(r3[0], M, y - 8, last ? 10.5 : 9.5, last ? F.b : F.r, last ? INK : MUT);
        P.right(r3[1], cLine, y - 8, last ? 10.5 : 9.5, last ? F.b : F.r, last ? [140, 116, 60] : INK2);
        y += last ? 20 : 16;
      });
      P.text('Trade prices unavailable (offline or none filed for this range) — table shows MSRP.', M, y, 8.5, F.r, MUT); y += 14;
    }
    // finishes + accessories notes
    if (m.finishes && m.finishes.length) { P.text('Options: ' + m.finishes.join(', '), M, y, 8.5, F.r, MUT, { maxWidth: A4.w - M * 2 }); y += 14; }
    P.text('Trade values are CONFIDENTIAL. Internal document — not for client issue; use the proposal PDF for clients.', M, A4.h - 64, 8, F.r, MUT);
    P.hline(M, A4.w - M, A4.h - 50, GOLD, 0.5, 0.5);
    P.tracked('SONOR', M, A4.h - 40, 9, F.b, [140, 116, 60], 2.6);
    P.trackedRight((m.quoteRef || '') , A4.w - M, A4.h - 40, 9, F.b, MUT, 1.4);
    var bytes = await doc.save();
    download(bytes, m.filename || 'sonor-seating-bom.pdf');
    return true;
  }

  function download(bytes, filename) {
    var blob = new Blob([bytes], { type: 'application/pdf' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
  }

  async function generate(m) {
    var PDFLib = global.PDFLib;
    if (!PDFLib || !PDFLib.PDFDocument) return false;
    var doc = await PDFLib.PDFDocument.create();
    try { if (global.fontkit) doc.registerFontkit(global.fontkit); } catch (e) {}
    var F;
    try {
      F = { b: await doc.embedFont(await fetchBytes(BASE + 'fonts/gilroy-extrabold.otf'), { subset: false }),
            r: await doc.embedFont(await fetchBytes(BASE + 'fonts/gilroy-regular.otf'), { subset: false }),
            l: await doc.embedFont(await fetchBytes(BASE + 'fonts/gilroy-ultralight.otf'), { subset: false }) };
    } catch (e) {
      var hb = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold), hr = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
      F = { b: hb, r: hr, l: hr };
    }
    doc.setTitle('Sonor — ' + (m.range || 'Seating') + ' Proposal');
    doc.setAuthor('Sonor'); doc.setCreator('Sonor Seating Configurator');
    doc.setSubject('Cinema seating proposal'); doc.setKeywords(['Sonor', 'cinema seating', 'CEDIA']);

    var hero = null, rangeImg = null;
    try { if (m.heroImage) hero = await loadImage(doc, m.heroImage); } catch (e) {}
    try { if (m.rangeImagePdf || m.rangeImage) rangeImg = await loadImage(doc, m.rangeImagePdf || m.rangeImage); } catch (e) {}
    if (!rangeImg && m.rangeImage && m.rangeImagePdf && m.rangeImage !== m.rangeImagePdf) {
      try { rangeImg = await loadImage(doc, m.rangeImage); } catch (e2) {}
    }
    if (!hero && rangeImg) hero = rangeImg;
    // v0.21.2 — stacked (two-line) CEDIA MEMBER lockup on the cover for better
    // proportion beside the other logos; wide single-line kept as fallback.
    try { m._cedia = await doc.embedPng(await fetchBytes(BASE + 'cedia-member-stacked.png')); } catch (e) { m._cedia = null; }
    if (!m._cedia) { try { m._cedia = await doc.embedPng(await fetchBytes(BASE + 'cedia-member-wide.png')); } catch (e) { m._cedia = null; } }

    // pre-fetch the manufacturer datasheet (Library `datasheet_url`) so pages state it accurately
    var dsDoc = null;
    if (m.datasheetUrl) {
      try { dsDoc = await PDFLib.PDFDocument.load(await fetchBytes(m.datasheetUrl), { updateMetadata: false }); m._dsAppended = true; }
      catch (e) { dsDoc = null; m._dsAppended = false; console.warn('[SeatingPdf] datasheet fetch failed (CORS?):', e && e.message); }
    }

    var fadeImg = null;
    try { var fd = fadePngDataUrl(); if (fd) fadeImg = await doc.embedPng(fd); } catch (e) {}

    var swatchImg = null;
    try { if (m.swatchImg) swatchImg = await loadImage(doc, m.swatchImg); } catch (e) {}

    var TOTAL = 6 + (dsDoc ? dsDoc.getPageCount() : 0);
    var mfrLogoImg = null;
    try { if (m.manufacturerLogo) mfrLogoImg = await loadImage(doc, m.manufacturerLogo); } catch (e) {}
    cover(mk(doc.addPage([A4.w, A4.h]), doc), F, m, hero, fadeImg, mfrLogoImg);
    quote(mk(doc.addPage([A4.w, A4.h]), doc), F, m, TOTAL, rangeImg, swatchImg);
    drawing(mk(doc.addPage([A4.w, A4.h]), doc), F, m, TOTAL);
    techspec(mk(doc.addPage([A4.w, A4.h]), doc), F, m, rangeImg, TOTAL, mfrLogoImg);
    optionsPage(mk(doc.addPage([A4.w, A4.h]), doc), F, m, TOTAL);
    termsPage(mk(doc.addPage([A4.w, A4.h]), doc), F, m, TOTAL);
    if (dsDoc) {
      try { (await doc.copyPages(dsDoc, dsDoc.getPageIndices())).forEach(function (p) { doc.addPage(p); }); }
      catch (e) { console.warn('[SeatingPdf] datasheet append failed:', e && e.message); }
    }

    var bytes = await doc.save();
    download(bytes, m.filename || 'sonor-seating-proposal.pdf');
    return true;
  }

  global.SeatingPdf = { generate: generate, generateBom: generateBom, available: function () { return !!(global.PDFLib && global.PDFLib.PDFDocument); } };
})(typeof window !== 'undefined' ? window : this);
