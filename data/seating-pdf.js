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
  function pageHead(P, F, m, label) {
    P.rect(0, 0, A4.w, 4, GOLD); P.rect(A4.w - 130, 0, 130, 4, PUR);
    P.logo(M, 58, 22, GOLD);
    P.tracked('SONOR', M + 30, 41, 11, F.b, INK, 3);
    P.trackedRight(label, A4.w - M, 44, 8, F.r, MUT, 2.4);
    P.hline(M, A4.w - M, 72, LINE, 0.8);
  }
  function pageFoot(P, F, m, pageNo, total) {
    P.hline(M, A4.w - M, A4.h - 52, LINE, 0.8);
    P.tracked('SONOR', M, A4.h - 42, 7, F.b, INK, 1.6);
    P.trackedRight('PROJECTS@SONOR.CO.UK  ·  CHESHIRE · WIRRAL · WALES', A4.w - M - 34, A4.h - 42, 7, F.r, MUT, 1.2);
    P.right(pageNo + ' / ' + total, A4.w - M, A4.h - 42.5, 8, F.r, MUT);
  }

  // ── PAGE 1 · COVER ───────────────────────────────────────────────────────────
  function cover(P, F, m, hero) {
    P.rect(0, 0, A4.w, A4.h, DARK);
    if (hero) {
      var iw = hero.width, ih = hero.height, s = Math.max(A4.w / iw, A4.h / ih);
      var dw = iw * s, dh = ih * s;
      P.image(hero, (A4.w - dw) / 2, 0, dw, dh, 1);
      // gentle top scrim for the lockup (dark → transparent going down)
      var steps = 14;
      for (var ti = 0; ti < steps; ti++) { var tt = 1 - ti / steps; P.rect(0, (130 / steps) * ti, A4.w, 130 / steps + 0.5, DARK, 0.5 * tt * tt); }
      // long fade to brand dark at the bottom (transparent → solid)
      P.fadeDown(0, A4.h * 0.40, A4.w, A4.h * 0.36, DARK, 0.97, 30);
      P.rect(0, A4.h * 0.76, A4.w, A4.h * 0.24, DARK, 0.97);
    }
    // inset frame
    P.rectB(M * 0.62, M * 0.62, A4.w - M * 1.24, A4.h - M * 1.24, GOLD, 0.7, 0.34);

    // brand lockup — mark + wordmark on a shared baseline
    P.logo(M, 74, 26, GOLD);
    P.tracked('SONOR', M + 36, 52, 14, F.b, CREAM, 3.6);
    P.tracked('CINEMA SEATING', M + 36, 70.5, 6.5, F.r, GOLDL, 2.9);

    // title block — range-led, sits on the fade
    var ty = 596;
    P.hline(M, M + 26, ty - 20, GOLD, 1, 0.95);
    P.tracked('SEATING PROPOSAL', M + 34, ty - 24, 8.5, F.r, GOLDL, 3.2);
    P.text(m.range || 'Proposal', M - 2, ty, 54, F.b, CREAM);
    P.text('by ' + (m.manufacturer || 'Sonor'), M, ty + 64, 20, F.l, GOLDL);

    // client / project info (print-asset style)
    var iy = 716, cw = (A4.w - M * 2) / 3;
    P.hline(M, A4.w - M, iy - 14, GOLD, 0.5, 0.45);
    var info = [
      ['PREPARED FOR', m.client || '—'],
      ['PROJECT', m.project || '—'],
      ['DATE', m.dateText || '—']
    ];
    info.forEach(function (c, i) {
      var x = M + i * cw;
      P.tracked(c[0], x, iy, 7, F.r, [168, 156, 136], 1.8);
      P.text(c[1], x, iy + 13, 12.5, F.b, CREAM, { maxWidth: cw - 16 });
    });
    P.hline(M, A4.w - M, iy + 42, GOLD, 0.5, 0.45);

    // footer
    P.tracked('PROJECTS@SONOR.CO.UK   ·   SONOR.CO.UK', M, A4.h - 60, 7.5, F.r, GOLDL, 1.6);
    P.trackedRight('DESIGNED & INSTALLED SINCE 2003   ·   CEDIA MEMBER', A4.w - M, A4.h - 60, 7.5, F.r, [168, 156, 136], 1.4);
  }

  // ── PAGE 2 · SPECIFICATION + QUOTE + TERMS ───────────────────────────────────
  function quote(P, F, m, TOTAL_PAGES) {
    P.rect(0, 0, A4.w, A4.h, CREAM);
    pageHead(P, F, m, 'SEATING PROPOSAL');

    P.tracked((m.manufacturer || 'SONOR').toUpperCase(), M, 92, 8.5, F.r, GOLD, 2.6);
    P.text(m.range || '', M - 1, 106, 26, F.b, INK);
    P.right(m.dateText || '', A4.w - M, 104, 10, F.r, MUT);

    var top = 158, colW = 250;
    var rows = [
      ['Room', m.roomText],
      ['Layout', m.layoutText],
      ['Upholstery', m.materialName ? (m.materialName + (m.colourName ? ' · ' + m.colourName : '')) : (m.upholsteryText || 'Confirmed at quotation')],
      ['Recline', m.reclineText],
      ['Finish options', (m.finishes && m.finishes.length) ? m.finishes.join(', ') : null],
      ['Accessories', (m.accessories && m.accessories.length) ? m.accessories.join(', ') : null],
      ['Armrests', m.includeArmrests ? 'Included (1 per seat + row ends)' : null],
      ['Lead time', m.leadText || 'On request']
    ].filter(function (r) { return r[1]; });
    P.tracked('SPECIFICATION', M, top - 22, 8, F.b, GOLD, 2.2);
    var sy = top;
    rows.forEach(function (r) {
      P.tracked(String(r[0]).toUpperCase(), M, sy, 6.5, F.r, MUT, 1.5);
      var txt = String(r[1]);
      var lines = wrap(txt, F.b, 11.5, colW);
      lines.forEach(function (ln, li) { P.text(ln, M, sy + 10 + li * 13, 11.5, F.b, INK); });
      sy += 10 + lines.length * 13 + 9;
      P.hline(M, M + colW, sy - 6, LINE, 0.5, 0.7);
    });

    // plan thumbnail (right)
    var planX = M + colW + 22, planW = A4.w - M - planX;
    P.tracked('YOUR CINEMA', planX, top - 22, 8, F.b, GOLD, 2.2);
    drawMiniPlan(P, F, m, planX, top - 4, planW, 168);

    // quote table
    var qy = Math.max(sy + 18, top + 190);
    P.tracked('ESTIMATED QUOTE', M, qy - 6, 8, F.b, GOLD, 2.2); qy += 12;
    var cQty = A4.w - M - 210, cUnit = A4.w - M - 110, cLine = A4.w - M;
    P.tracked('ITEM', M, qy, 6.5, F.r, MUT, 1.4);
    P.trackedRight('QTY', cQty + 20, qy, 6.5, F.r, MUT, 1.4);
    P.trackedRight('UNIT MSRP', cUnit + 40, qy, 6.5, F.r, MUT, 1.4);
    P.trackedRight('LINE MSRP', cLine, qy, 6.5, F.r, MUT, 1.4);
    P.hline(M, A4.w - M, qy + 11, INK, 0.8, 0.5);
    var y = qy + 27;
    (m.lines || []).forEach(function (l) {
      P.text(l.label, M, y - 9, 10.5, F.r, INK, { maxWidth: cQty - M - 12 });
      P.right(String(l.qty), cQty + 20, y - 9, 10.5, F.r, INK2);
      P.right(money(l.unit), cUnit + 40, y - 9, 10.5, F.r, INK2);
      P.right(l.unit != null ? money(l.unit * l.qty) : 'POA', cLine, y - 9, 10.5, F.b, INK);
      P.hline(M, A4.w - M, y + 5, LINE, 0.5, 0.7);
      y += 22;
    });
    y += 2;
    [['Products subtotal', money(m.productTotal)],
     [m.deliveryLabel || 'Delivery', m.deliveryCost != null ? money(m.deliveryCost) : 'On request'],
     ['Subtotal (ex VAT)', money(Math.round(m.exVat))],
     ['VAT @ ' + Math.round((m.vatRate || 0) * 100) + '%', money(Math.round(m.vat))]].forEach(function (r) {
      P.text(r[0], M, y - 9, 10, F.r, MUT); P.right(r[1], cLine, y - 9, 10, F.r, INK2); y += 17;
    });
    P.hline(cQty, A4.w - M, y - 2, INK, 0.8, 0.6); y += 16;
    P.text('Total', M, y - 10, 13, F.b, INK);
    P.tracked('INC VAT', M + F.b.widthOfTextAtSize('Total', 13) + 10, y - 4, 7, F.r, MUT, 1.4);
    P.right(m.grossText || 'On request', cLine, y - 12, 17, F.b, [140, 116, 60]); y += 24;

    // terms & deposit
    P.hline(M, A4.w - M, y, LINE, 0.7); y += 12;
    P.tracked('TERMS & PAYMENT', M, y, 7.5, F.b, GOLD, 2); y += 14;
    (m.termsLines || []).forEach(function (t) {
      var lines = wrap(t, F.r, 8, A4.w - M * 2 - 12);
      P.text('·', M, y - 1, 8, F.b, GOLD);
      lines.forEach(function (ln, li) { P.text(ln, M + 10, y + li * 10.5, 8, F.r, MUT); });
      y += lines.length * 10.5 + 5;
    });
    pageFoot(P, F, m, 2, TOTAL_PAGES);
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
    pageHead(P, F, m, 'SEATING PLAN');
    P.tracked('DIMENSIONED LAYOUT', M, 92, 8.5, F.r, GOLD, 2.6);
    P.text(m.range + ' — ' + (m.rows || 2) + ' rows × ' + (m.seatsPerRow || 3), M - 1, 106, 22, F.b, INK);
    P.right('All dimensions in mm', A4.w - M, 108, 9, F.r, MUT);

    var S = m.spec || {};
    var seatW = S.planSeatWidthMm || 650, seatD = S.planSeatDepthMm || 1000;
    var rowGap = S.rowGapMm || 600, sideWall = S.sideWallMm || 150, wallClear = S.wallClearanceMm || 400;
    var roomW = m.roomWidthMm || 4000, roomL = m.roomLengthMm || 6000;
    var rows = m.rows || 2, per = m.seatsPerRow || 3;

    // fit room into plan box (leave generous margins for dimension strings)
    var bx = M + 46, bTop = 168, bw = A4.w - M * 2 - 92, bh = 470;
    var sc = Math.min(bw / roomW, bh / roomL);
    var rw = roomW * sc, rl = roomL * sc;
    var rx = bx + (bw - rw) / 2, rTop = bTop + (bh - rl) / 2;

    var DIM = [110, 100, 88], CADL = [90, 84, 72];
    // room outline (double line, architectural)
    P.rectB(rx - 3, rTop - 3, rw + 6, rl + 6, CADL, 1.4, 0.9);
    P.rectB(rx, rTop, rw, rl, CADL, 0.7, 0.8);
    // screen wall
    P.rect(rx + rw * 0.14, rTop + 8, rw * 0.72, 5, GOLD, 0.85);
    P.center('S C R E E N', rx + rw / 2, rTop + 18, 6, F.r, [140, 120, 88], 2);

    // seats
    var totalRowW = per * seatW + (per - 1) * 40;                 // 40mm between seats
    var sx0 = rx + (rw - totalRowW * sc) / 2;
    var firstRowTop = rTop + (wallClear * 0.6) * sc + rl * 0.16;  // sit rows in the lower ⅔
    var seatPX = seatW * sc, seatPD = seatD * sc, gapPX = 40 * sc, rowGapPX = rowGap * sc;
    for (var r = 0; r < rows; r++) {
      var ry = firstRowTop + r * (seatPD + rowGapPX);
      for (var s = 0; s < per; s++) {
        var cx = sx0 + s * (seatPX + gapPX);
        P.rectB(cx, ry, seatPX, seatPD, INK2, 0.9, 0.85);
        P.rectB(cx + seatPX * 0.12, ry + seatPD * 0.08, seatPX * 0.76, seatPD * 0.24, INK2, 0.6, 0.6); // backrest
        P.rectB(cx + seatPX * 0.08, ry + seatPD * 0.38, seatPX * 0.84, seatPD * 0.5, INK2, 0.6, 0.6);  // cushion
      }
    }
    var lastRowBottom = firstRowTop + rows * seatPD + (rows - 1) * rowGapPX;

    // ── dimension helpers ──
    function dimH(x1, x2, top, label, above) {
      var ty = above ? top - 4 : top + 6;
      P.hline(x1, x2, top, DIM, 0.7); P.vline(x1, top - 4, top + 4, DIM, 0.7); P.vline(x2, top - 4, top + 4, DIM, 0.7);
      P.center(label, (x1 + x2) / 2, above ? top - 13 : top + 6, 7.5, F.b, DIM);
    }
    function dimV(x, t1, t2, label) {
      P.vline(x, t1, t2, DIM, 0.7); P.hline(x - 4, x + 4, t1, DIM, 0.7); P.hline(x - 4, x + 4, t2, DIM, 0.7);
      P.center(label, x + 16, (t1 + t2) / 2 - 4, 7.5, F.b, DIM);
    }
    // room width (top, above room)
    dimH(rx, rx + rw, rTop - 16, roomW + '', true);
    // total seating run (below last row)
    dimH(sx0, sx0 + totalRowW * sc, lastRowBottom + 14, Math.round(totalRowW) + '', false);
    // seat width (first seat, below its row)
    dimH(sx0, sx0 + seatPX, firstRowTop + seatPD + 12, Math.round(seatW) + '', false);
    // room length (left)
    dimV(rx - 18, rTop, rTop + rl, roomL + '');
    // seat depth + row gap (right of last seat)
    var rgx = sx0 + totalRowW * sc + 16;
    dimV(rgx, firstRowTop, firstRowTop + seatPD, Math.round(seatD) + '');
    if (rows > 1) dimV(rgx, firstRowTop + seatPD, firstRowTop + seatPD + rowGapPX, Math.round(rowGap) + '');

    // notes
    var ny = bTop + bh + 26;
    P.hline(M, A4.w - M, ny - 12, LINE, 0.7);
    var notes = 'Seat width ' + Math.round(seatW) + 'mm' + (S.reclinedDepthMm ? ' · reclined depth ' + Math.round(S.reclinedDepthMm) + 'mm' : ' · plan depth ' + Math.round(seatD) + 'mm') + ' · row spacing ' + rowGap + 'mm · side clearance ' + sideWall + 'mm each side' + (wallClear ? ' · wall clearance ' + wallClear + 'mm' : '') + '. Indicative layout for discussion — site survey confirms final setting-out.';
    wrap(notes, F.r, 8.5, A4.w - M * 2).forEach(function (ln, li) { P.text(ln, M, ny + li * 11, 8.5, F.r, MUT); });
    pageFoot(P, F, m, 3, TOTAL_PAGES);
  }

  // ── PAGE 4 · TECHNICAL SPECIFICATION ─────────────────────────────────────────
  function techspec(P, F, m, rangeImg, TOTAL_PAGES) {
    P.rect(0, 0, A4.w, A4.h, CREAM);
    pageHead(P, F, m, 'TECHNICAL SPECIFICATION');
    P.tracked((m.manufacturer || '').toUpperCase(), M, 92, 8.5, F.r, GOLD, 2.6);
    P.text(m.range || '', M - 1, 106, 26, F.b, INK);
    if (m.spec && m.spec.style) P.right(m.spec.style, A4.w - M, 108, 10, F.r, MUT);

    // range photograph
    var top = 158;
    if (rangeImg) {
      var iw = rangeImg.width, ih = rangeImg.height;
      var boxW = A4.w - M * 2, boxH = 210;
      var s = Math.min(boxW / iw, boxH / ih);
      var dw = iw * s, dh = ih * s;
      P.rect(M, top, boxW, boxH, DARK2);
      P.image(rangeImg, M + (boxW - dw) / 2, top + (boxH - dh) / 2, dw, dh, 1);
      P.rectB(M, top, boxW, boxH, LINE, 0.8);
      top += boxH + 26;
    }

    var S = m.spec || {};
    var specs = [
      ['Seat width', mm(S.seatWidthMm)],
      ['Seat depth', mm(S.seatDepthMm)],
      ['Reclined depth', mm(S.reclinedDepthMm)],
      ['Wall clearance', mm(S.wallClearanceMm)],
      ['Recline', m.reclineText],
      ['Upholstery', m.materialName ? (m.materialName + (m.colourName ? ' · ' + m.colourName : '')) : null],
      ['Finish options', (m.finishes && m.finishes.length) ? m.finishes.join(', ') : null],
      ['Accessories', (m.accessories && m.accessories.length) ? m.accessories.join(', ') : null],
      ['Lead time', m.leadText]
    ].filter(function (r) { return r[1]; });
    P.tracked('MODEL DATA', M, top - 4, 8, F.b, GOLD, 2.2); top += 12;
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
    if (m.productUrl) { P.text('Product page:', M, top, 9.5, F.r, MUT); P.link(m.productUrl, M + 70, top, 9.5, F.r, [120, 90, 140], m.productUrl); top += 18; }
    if (m.manufacturerUrl) { P.text('Manufacturer:', M, top, 9.5, F.r, MUT); P.link(m.manufacturerUrl, M + 70, top, 9.5, F.r, [120, 90, 140], m.manufacturerUrl); top += 18; }
    P.text(m.datasheetUrl ? 'Manufacturer datasheet appended to this document.' : 'Manufacturer datasheet available on request.', M, top, 9, F.r, MUT);
    pageFoot(P, F, m, 4, TOTAL_PAGES);
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
    try { if (m.rangeImage) rangeImg = await loadImage(doc, m.rangeImage); } catch (e) {}
    if (!hero && rangeImg) hero = rangeImg;

    var TOTAL = 4;
    cover(mk(doc.addPage([A4.w, A4.h]), doc), F, m, hero);
    quote(mk(doc.addPage([A4.w, A4.h]), doc), F, m, TOTAL);
    drawing(mk(doc.addPage([A4.w, A4.h]), doc), F, m, TOTAL);
    techspec(mk(doc.addPage([A4.w, A4.h]), doc), F, m, rangeImg, TOTAL);

    // append manufacturer datasheet when the Library files one (PDF url)
    if (m.datasheetUrl) {
      try {
        var dsBytes = await fetchBytes(m.datasheetUrl);
        var ds = await PDFLib.PDFDocument.load(dsBytes, { updateMetadata: false });
        var pages = await doc.copyPages(ds, ds.getPageIndices());
        pages.forEach(function (p) { doc.addPage(p); });
      } catch (e) { console.warn('[SeatingPdf] datasheet append failed:', e && e.message); }
    }

    var bytes = await doc.save();
    download(bytes, m.filename || 'sonor-seating-proposal.pdf');
    return true;
  }

  global.SeatingPdf = { generate: generate, available: function () { return !!(global.PDFLib && global.PDFLib.PDFDocument); } };
})(typeof window !== 'undefined' ? window : this);
