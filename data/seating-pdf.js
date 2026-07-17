/* Sonor Seating Configurator — luxury PDF proposal (v0.4.0)
   SeatingPdf.generate(model) — crisp vector A4 PDF via pdf-lib, embedded Gilroy.
   Gold-standard aligned (pdf-lib vector, branded cover) in the cinema luxury aesthetic:
   Page 1 dark dramatic cover · Page 2 cream specification + itemised quote.
   Falls back to window.print() if pdf-lib is unavailable (see seating-app savePdf()).
*/
(function (global) {
  'use strict';

  var A4 = { w: 595.28, h: 841.89 };
  var M = 48;                                  // page margin (pt)
  // palette (0–255)
  var GOLD = [173, 153, 120], GOLDL = [200, 180, 142], PUR = [128, 88, 161],
      CREAM = [246, 242, 234], CREAM2 = [237, 231, 219], INK = [26, 24, 20],
      INK2 = [60, 55, 47], MUT = [120, 112, 96], DARK = [9, 8, 7], DARK2 = [22, 19, 24],
      LINE = [214, 205, 188], WHITE = [255, 255, 255];

  // Sonor house-mark (official logo components), viewBox 0 0 93 95
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

  // ── low-level draw helpers (top-origin y) ────────────────────────────────────
  function mk(page) {
    return {
      page: page,
      // text with top-origin baseline
      text: function (str, x, top, size, font, c, opts) {
        opts = opts || {};
        page.drawText(String(str), { x: x, y: A4.h - top - size, size: size, font: font, color: col(c || INK), lineHeight: opts.lineHeight, maxWidth: opts.maxWidth });
      },
      // tracked (letter-spaced) text, returns width
      tracked: function (str, x, top, size, font, c, track) {
        track = track || 0; str = String(str); var cx = x, y = A4.h - top - size;
        for (var i = 0; i < str.length; i++) { var ch = str[i]; page.drawText(ch, { x: cx, y: y, size: size, font: font, color: col(c || INK) }); cx += font.widthOfTextAtSize(ch, size) + track; }
        return cx - x - track;
      },
      trackedRight: function (str, right, top, size, font, c, track) {
        track = track || 0; str = String(str); var w = 0; for (var i = 0; i < str.length; i++) w += font.widthOfTextAtSize(str[i], size) + track; w -= track;
        this.tracked(str, right - w, top, size, font, c, track); return w;
      },
      right: function (str, right, top, size, font, c) {
        var w = font.widthOfTextAtSize(String(str), size);
        page.drawText(String(str), { x: right - w, y: A4.h - top - size, size: size, font: font, color: col(c || INK) });
      },
      center: function (str, cx, top, size, font, c, track) {
        if (track) { var w = 0; for (var i = 0; i < str.length; i++) w += font.widthOfTextAtSize(str[i], size) + track; w -= track; this.tracked(str, cx - w / 2, top, size, font, c, track); }
        else { var ww = font.widthOfTextAtSize(String(str), size); page.drawText(String(str), { x: cx - ww / 2, y: A4.h - top - size, size: size, font: font, color: col(c || INK) }); }
      },
      rect: function (x, top, w, h, c, o) { page.drawRectangle({ x: x, y: A4.h - top - h, width: w, height: h, color: col(c), opacity: o == null ? 1 : o }); },
      rectB: function (x, top, w, h, c, bw, o) { page.drawRectangle({ x: x, y: A4.h - top - h, width: w, height: h, borderColor: col(c), borderWidth: bw, opacity: 0, borderOpacity: o == null ? 1 : o }); },
      hline: function (x1, x2, top, c, t, o) { page.drawLine({ start: { x: x1, y: A4.h - top }, end: { x: x2, y: A4.h - top }, thickness: t || 0.6, color: col(c), opacity: o == null ? 1 : o }); },
      logo: function (x, top, h, c) { var sc = h / 95; page.drawSvgPath(HOUSE, { x: x, y: A4.h - top, scale: sc, color: col(c || GOLD) }); }
    };
  }

  function money(n) { return n == null ? 'POA' : '£' + Number(n).toLocaleString('en-GB', { maximumFractionDigits: 0 }); }

  // ── COVER (dark) ─────────────────────────────────────────────────────────────
  function cover(P, F, m) {
    P.rect(0, 0, A4.w, A4.h, DARK);
    // faint purple + gold ambience bands
    P.rect(0, 0, A4.w, 250, PUR, 0.05);
    P.rect(0, A4.h - 150, A4.w, 150, GOLD, 0.045);
    // inset frame
    P.rectB(M * 0.66, M * 0.66, A4.w - M * 1.32, A4.h - M * 1.32, GOLD, 0.7, 0.28);

    // brand lockup
    P.logo(M, 70, 30, GOLD);
    var wx = P.tracked('SONOR', M + 40, 48, 13, F.b, CREAM, 3.4);
    P.tracked('SMART HOMES', M + 40, 66, 6.5, F.r, GOLDL, 2.6);

    // eyebrow
    P.hline(M, M + 26, 300, GOLD, 1, 0.9);
    P.tracked('LUXURY HOME CINEMA SEATING', M + 36, 296, 8.5, F.r, GOLDL, 3.2);

    // title
    P.text('Cinema Seating', M - 1, 322, 52, F.b, CREAM);
    P.text('Proposal', M - 1, 384, 52, F.l, GOLDL);

    // range subtitle
    P.hline(M, M + 46, 470, GOLD, 1.2, 0.9);
    P.text('Featuring the ' + (m.range || '') + ' range', M, 490, 15, F.r, [210, 202, 186]);
    if (m.manufacturer) P.text('by ' + m.manufacturer, M, 512, 15, F.l, GOLDL);

    // summary chips
    var chips = [
      ['ROOM', m.roomText || '—'],
      ['LAYOUT', m.layoutText || '—'],
      ['LEAD TIME', m.leadText || 'On request'],
      ['ESTIMATED MSRP', m.totalText || 'On request']
    ];
    var cy = 600, cw = (A4.w - M * 2) / 4;
    P.hline(M, A4.w - M, cy - 14, GOLD, 0.5, 0.3);
    chips.forEach(function (c, i) {
      var x = M + i * cw;
      P.tracked(c[0], x, cy, 7, F.r, MUT2(), 1.8);
      P.text(c[1], x, cy + 14, 14, F.b, CREAM);
    });
    P.hline(M, A4.w - M, cy + 44, GOLD, 0.5, 0.3);

    // footer
    P.hline(M, A4.w - M, A4.h - 74, GOLD, 0.6, 0.5);
    P.tracked('PROJECTS@SONOR.CO.UK   ·   SONOR.CO.UK', M, A4.h - 62, 7.5, F.r, GOLDL, 1.6);
    P.trackedRight('DESIGNED & INSTALLED SINCE 2003   ·   CEDIA MEMBER', A4.w - M, A4.h - 62, 7.5, F.r, MUT2(), 1.4);
  }
  function MUT2() { return [150, 140, 120]; }

  // ── SPECIFICATION + QUOTE (cream) ────────────────────────────────────────────
  function quote(P, F, m) {
    P.rect(0, 0, A4.w, A4.h, CREAM);
    P.rect(0, 0, A4.w, 4, GOLD);

    // header
    P.logo(M, 62, 24, GOLD);
    P.tracked('SONOR', M + 32, 44, 11, F.b, INK, 3);
    P.trackedRight('CINEMA SEATING PROPOSAL', A4.w - M, 47, 8, F.r, MUT, 2.4);
    P.hline(M, A4.w - M, 78, LINE, 0.8);

    // title block
    P.tracked((m.manufacturer || 'SONOR').toUpperCase(), M, 104, 8.5, F.r, GOLD, 2.6);
    P.text(m.range || 'Cinema Seating', M - 1, 120, 30, F.b, INK);
    P.right(m.dateText || '', A4.w - M, 116, 10, F.r, MUT);

    var top = 176;
    // two columns: left details, right plan
    var colX = M, colW = 250, planX = M + colW + 20, planW = A4.w - M - planX;

    // details (left)
    var rows = [
      ['Room', m.roomText],
      ['Layout', m.layoutText],
      ['Upholstery', m.upholsteryText],
      ['Recline', m.reclineText],
      ['Lead time', m.leadText || 'On request']
    ].filter(function (r) { return r[1]; });
    P.tracked('SPECIFICATION', colX, top - 24, 8, F.b, GOLD, 2.2);
    rows.forEach(function (r, i) {
      var y = top + i * 30;
      P.tracked(String(r[0]).toUpperCase(), colX, y, 7, F.r, MUT, 1.6);
      P.text(r[1], colX, y + 11, 12.5, F.b, INK);
      P.hline(colX, colX + colW, y + 26, LINE, 0.5, 0.7);
    });

    // plan (right)
    P.tracked('YOUR CINEMA', planX, top - 24, 8, F.b, GOLD, 2.2);
    drawPlan(P, F, m, planX, top - 6, planW, 190);

    // ── quote table ──
    var qy = top + Math.max(rows.length * 30, 210) + 26;
    P.tracked('ESTIMATED QUOTE', M, qy - 22, 8, F.b, GOLD, 2.2);
    var cItem = M, cQty = A4.w - M - 210, cUnit = A4.w - M - 110, cLine = A4.w - M;
    P.tracked('ITEM', cItem, qy, 7, F.r, MUT, 1.4);
    P.trackedRight('QTY', cQty + 20, qy, 7, F.r, MUT, 1.4);
    P.trackedRight('UNIT MSRP', cUnit + 40, qy, 7, F.r, MUT, 1.4);
    P.trackedRight('LINE MSRP', cLine, qy, 7, F.r, MUT, 1.4);
    P.hline(M, A4.w - M, qy + 12, INK, 0.8, 0.5);

    var y = qy + 30;
    (m.lines || []).forEach(function (l) {
      P.text(l.label, cItem, y - 10, 11, F.r, INK, { maxWidth: cQty - cItem - 12 });
      P.right(String(l.qty), cQty + 20, y - 10, 11, F.r, INK2);
      P.right(money(l.unit), cUnit + 40, y - 10, 11, F.r, INK2);
      P.right(l.unit != null ? money(l.unit * l.qty) : 'POA', cLine, y - 10, 11, F.b, INK);
      P.hline(M, A4.w - M, y + 6, LINE, 0.5, 0.7);
      y += 26;
    });

    // subtotal + delivery + total
    y += 4;
    P.text('Products subtotal', cItem, y - 10, 10.5, F.r, MUT);
    P.right(money(m.productTotal), cLine, y - 10, 10.5, F.r, INK2); y += 22;
    P.text(m.deliveryLabel || 'Delivery', cItem, y - 10, 10.5, F.r, MUT);
    P.right(m.deliveryCost != null ? money(m.deliveryCost) : 'On request', cLine, y - 10, 10.5, F.r, INK2); y += 20;
    P.hline(cQty, A4.w - M, y, INK, 0.8, 0.6); y += 20;
    P.text('Estimated total', cItem, y - 12, 13, F.b, INK);
    P.tracked('EX VAT', cItem + F.b.widthOfTextAtSize('Estimated total', 13) + 10, y - 6, 7, F.r, MUT, 1.4);
    P.right(m.totalText || 'On request', cLine, y - 14, 17, F.b, [140, 116, 60]); y += 30;

    // terms
    var terms = 'Indicative MSRP from the Sonor library' + (m.deliveryCost != null ? ', including ' + (m.deliveryLabel || 'delivery').toLowerCase() : '') + (m.leadText ? ' and a typical ' + m.leadText + ' lead time for ' + m.manufacturer : '') + '. Final pricing, fabric grades, delivery and lead times are confirmed on a formal quotation. Prices exclude VAT.';
    P.hline(M, A4.w - M, y, LINE, 0.6); y += 16;
    wrapText(P, terms, M, y, A4.w - M * 2, 8.5, F.r, MUT, 12);

    // footer
    P.hline(M, A4.w - M, A4.h - 52, LINE, 0.8);
    P.tracked('SONOR SMART HOMES', M, A4.h - 42, 7, F.b, INK, 1.6);
    P.trackedRight('PROJECTS@SONOR.CO.UK  ·  CHESHIRE · WIRRAL · WALES', A4.w - M, A4.h - 42, 7, F.r, MUT, 1.2);
  }

  function wrapText(P, str, x, top, maxW, size, font, c, lh) {
    var words = str.split(' '), line = '', yy = top;
    for (var i = 0; i < words.length; i++) {
      var t = line ? line + ' ' + words[i] : words[i];
      if (font.widthOfTextAtSize(t, size) > maxW && line) { P.text(line, x, yy, size, font, c); line = words[i]; yy += lh; }
      else line = t;
    }
    if (line) P.text(line, x, yy, size, font, c);
    return yy + lh;
  }

  // seating plan — screen bar + seat grid (top-origin box)
  function drawPlan(P, F, m, x, top, w, h) {
    P.rect(x, top, w, h, DARK2);
    P.rectB(x, top, w, h, [70, 60, 80], 0.8, 0.5);
    // screen
    var sw = w * 0.62, sx = x + (w - sw) / 2;
    P.rect(sx, top + 12, sw, 4, GOLDL);
    P.center('S C R E E N', x + w / 2, top + 20, 5.5, F.r, GOLDL, 1.5);
    var rows = (m.rows || 2), per = (m.seatsPerRow || 3);
    var gx = 10, gy = 14, areaW = w - gx * 2, areaTop = top + 34, areaH = h - 46;
    var gap = 6;
    var seatW = Math.min((areaW - (per - 1) * gap) / per, 46);
    var seatH = Math.min((areaH - (rows - 1) * gap) / rows, 62);
    var totalW = per * seatW + (per - 1) * gap;
    var sx0 = x + (w - totalW) / 2;
    for (var r = 0; r < rows; r++) {
      for (var s = 0; s < per; s++) {
        var cx = sx0 + s * (seatW + gap), cy = areaTop + r * (seatH + gap);
        P.rect(cx, cy, seatW, seatH, [138, 108, 168]);
        P.rect(cx, cy, seatW, seatH * 0.28, GOLDL, 0.16);
        P.rectB(cx, cy, seatW, seatH, [180, 150, 210], 0.6, 0.6);
      }
    }
    P.center((m.roomWidthText || '') + ' · ' + (rows * per) + ' seats', x + w / 2, top + h - 12, 6.5, F.r, [150, 140, 120], 0.5);
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
      var b = await doc.embedFont(await fetchBytes(BASE + 'fonts/gilroy-extrabold.otf'), { subset: false });
      var r = await doc.embedFont(await fetchBytes(BASE + 'fonts/gilroy-regular.otf'), { subset: false });
      var l = await doc.embedFont(await fetchBytes(BASE + 'fonts/gilroy-ultralight.otf'), { subset: false });
      F = { b: b, r: r, l: l };
    } catch (e) {
      var hb = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
      var hr = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
      F = { b: hb, r: hr, l: hr };
    }
    doc.setTitle('Sonor — ' + (m.range || 'Cinema Seating') + ' Proposal');
    doc.setAuthor('Sonor Smart Homes'); doc.setCreator('Sonor Seating Configurator');
    doc.setSubject('Cinema seating proposal'); doc.setKeywords(['Sonor', 'cinema seating', 'CEDIA']);
    cover(mk(doc.addPage([A4.w, A4.h])), F, m);
    quote(mk(doc.addPage([A4.w, A4.h])), F, m);
    var bytes = await doc.save();
    download(bytes, m.filename || 'sonor-cinema-seating-proposal.pdf');
    return true;
  }

  global.SeatingPdf = { generate: generate, available: function () { return !!(global.PDFLib && global.PDFLib.PDFDocument); } };
})(typeof window !== 'undefined' ? window : this);
