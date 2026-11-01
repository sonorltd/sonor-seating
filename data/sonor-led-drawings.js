/**
 * sonor-led-drawings.js — CANONICAL MASTER (workspace root → data/ in every app via sync-everything, like sonor-led-engineering.js)
 * v1.1.0 · 2026-11-01 — Bryn: "drawing could be better like it is from other apps". The drawings now speak the same language as the
 *   Engineering rack / DIN builder and the Stretched Fabric design pack: device boxes with a service band, ports and terminal labels;
 *   orthogonal wires with junction dots and cable labels (2C 1.5 mm² · 10 m, DMX, CH1–4); the head-end board as a dashed enclosure with
 *   its tab; the board elevation at true scale — DIN rail with isolator / MCB / dimmed-feed faces, slotted trunking between rows,
 *   filled device tiles with their L × W, the LV terminal rail with V+ / V− pairs per run, dimension strings with ticks — and the
 *   PDF draws them on Sonor drawing sheets (drawing no., notes column, legend strip, scale, NOT FOR CONSTRUCTION foot) from the
 *   shared luxury chrome (sonor-pdf-luxury.js ≥ 1.6.0 drawingSheet).
 * v1.0.0 · 2026-11-01 — Bryn: "can you include a schematic for the wiring and an elevation of head end decoders and psu's? … use our
 *   current best methods preferably shared from other apps so there are no monoliths and apps dont fall out of sync".
 *
 * ONE drawing source for LED wiring, built from SonorLedEng.project() (engine ≥ 1.5.0). Each drawing is a plain DISPLAY LIST in points
 * and the same list is painted two ways, so the screen and the PDF can never disagree:
 *   SonorLedDrawings.schematic(eng, { width, maxHeight, legend })  → { sheets: [{ w, h, title, items, groups }] }
 *   SonorLedDrawings.elevation(board, { width, maxHeight })        → { w, h, items, mm, kPerMm, schedule, board }
 *   SonorLedDrawings.legend()                                       → [{ key, label, colour }] (for a notes column)
 *   SonorLedDrawings.toSvg(sheet, { theme: 'dark'|'paper' })       → SVG string (apps)
 *   SonorLedDrawings.toPdf(page, sheet, { x, top, scale, H, fonts, theme, safe }) → vectors on a pdf-lib page (packs)
 * The board is packed on the kit's slot grid (SonorSlotGrid.autoLayout — the same first-fit as the Engineering rack and DIN panels)
 * when the kit is on the page; a built-in first-fit is the offline fallback. Sizes are Library dimensions (metadata.led.dims_mm);
 * nominal sizes are drawn dashed and say so. No DOM, no DB — node-tested (tests/led-drawings.test.mjs).
 */
(function (global) {
  'use strict';
  var VERSION = '1.1.0';
  function num(x, d) { var n = Number(x); return isFinite(n) ? n : (d || 0); }
  function r1(x) { return Math.round(x * 10) / 10; }
  function pad3(n) { return ('00' + n).slice(-3); }
  function short(s, n) { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, Math.max(1, n - 1)) + '…' : s; }
  function prodShort(label) { return String(label || '').replace(/^Tagra\s+/i, '').replace(/Constant Voltage\s*/i, 'CV ').replace(/LED Driver\s*·?\s*/i, '').replace(/\s*·\s*IP20/i, '').replace(/\s+/g, ' ').trim(); }

  // wire classes — colour by what the conductor carries
  var WIRE = {
    mains:  { label: '230 V unswitched',        dark: '#c99a6b', paper: [140, 92, 50],  w: 1.3 },
    dimmed: { label: '230 V dimmed (triac)',    dark: '#e3a63a', paper: [205, 130, 20], w: 1.3, dash: [5, 2.5] },
    lv:     { label: '24 V DC feed (2-core)',   dark: '#e2705f', paper: [190, 58, 44],  w: 1.5 },
    pwm:    { label: 'Decoder output (PWM)',    dark: '#e58fb0', paper: [186, 74, 120], w: 1.1 },
    dmx:    { label: 'DMX512 (screened, daisy-chain)', dark: '#5ea8ea', paper: [44, 112, 190], w: 1.2, dash: [3.5, 2] },
    data:   { label: 'Ethernet / pixel data (Cat6)', dark: '#ad8ce0', paper: [118, 80, 160], w: 1.1, dash: [1.4, 1.8] }
  };
  // device roles — the service band on each box / tile (lighting = service 04 yellow; mains brown; DMX blue; data purple)
  var ROLE = {
    supply:  { dark: '#c99a6b', paper: [140, 92, 50] },
    dimmed:  { dark: '#e3a63a', paper: [205, 130, 20] },
    psu:     { dark: '#9aa3ae', paper: [96, 104, 116] },
    decoder: { dark: '#5ea8ea', paper: [44, 112, 190] },
    node:    { dark: '#ad8ce0', paper: [118, 80, 160] },
    pixel:   { dark: '#ad8ce0', paper: [118, 80, 160] },
    run:     { dark: '#f5d05c', paper: [196, 160, 40] }
  };
  var THEME = {
    dark:  { bg: '#16191e', text: '#eef0f3', muted: '#98a1ac', faint: '#59606a', line: '#3a4049', box: '#22262d', boxLine: '#56606b', encl: '#7d8792', tab: '#2b3038',
             board: '#262b32', boardLine: '#6b7480', trunk: '#3a4049', trunkSlot: '#4b525c', rail: '#9aa3ae', mcb: '#d9dde2', mcbInk: '#16191e', term: '#c9ced4', knock: '#16191e', dim: '#98a1ac' },
    paper: { bg: null, text: [24, 24, 24], muted: [112, 112, 112], faint: [190, 190, 190], line: [214, 214, 214], box: [255, 255, 255], boxLine: [70, 70, 70], encl: [120, 120, 120], tab: [244, 243, 240],
             board: [250, 249, 246], boardLine: [90, 90, 90], trunk: [226, 226, 226], trunkSlot: [196, 196, 196], rail: [150, 150, 150], mcb: [255, 255, 255], mcbInk: [24, 24, 24], term: [236, 236, 236], knock: [251, 250, 247], dim: [70, 70, 70] }
  };
  var NOMINAL = { driver: function (w) { var t = [[30, 158, 46], [60, 160, 58], [75, 170, 45], [100, 170, 45], [150, 179, 63], [200, 195, 67], [240, 210, 72], [320, 215, 78]]; for (var i = 0; i < t.length; i++) if (w <= t[i][0]) return [t[i][1], t[i][2]]; return [230, 80]; },
    decoder: [175, 46], node: [90, 62], pixel: [120, 70] };

  // ── display list ──
  function DL() { var it = []; return {
    items: it,
    rect: function (x, y, w, h, o) { it.push({ t: 'rect', x: x, y: y, w: w, h: h, o: o || {} }); },
    line: function (pts, wire, o) { it.push({ t: 'line', pts: pts, wire: wire || null, o: o || {} }); },
    text: function (x, y, s, o) { it.push({ t: 'text', x: x, y: y, s: String(s == null ? '' : s), o: o || {} }); },
    dot: function (x, y, wire, o) { it.push({ t: 'dot', x: x, y: y, wire: wire, o: o || {} }); },
    port: function (x, y, wire) { it.push({ t: 'port', x: x, y: y, wire: wire }); },
    dim: function (x1, y1, x2, y2, s, o) { it.push({ t: 'dim', x1: x1, y1: y1, x2: x2, y2: y2, s: s, o: o || {} }); },
    tag: function (x, y, s, wire, o) { it.push({ t: 'tag', x: x, y: y, s: String(s), wire: wire, o: o || {} }); }   // a cable label knocked out of its wire
  }; }
  // a device box: white face, thin ink outline, the role band down the left, title / sub / third line
  function box(d, x, y, w, h, role, title, sub, third, o) {
    o = o || {};
    d.rect(x, y, w, h, { box: true, dash: o.dash });
    d.rect(x, y, 3.2, h, { band: role });
    d.text(x + 9, y + 5, short(title, Math.floor((w - 14) / 4.05)), { size: 7.6, bold: true });
    if (sub) d.text(x + 9, y + 16, short(sub, Math.floor((w - 14) / 3.25)), { size: 6.2, muted: true });
    if (third && h > 30) d.text(x + 9, y + 26, short(third, Math.floor((w - 14) / 3.25)), { size: 6, muted: true });
  }

  // ══ WIRING SCHEMATIC ══
  // One row per run, grouped by where its PSU sits. A head end is a dashed board enclosure holding SUPPLY (radial C / dimmed feed D)
  // → PSU → DECODER / PIXEL CONTROLLER, with its DMX node on top feeding the bus; the strip runs sit outside, in the rooms, joined by the
  // field cables. Local drivers each get a small enclosure (the void / joinery) with their FCU or plug-in socket.
  function schematic(eng, opts) {
    opts = opts || {}; var W = num(opts.width, 1094), maxH = num(opts.maxHeight, 0) || 1e9, ROW = 52, BH = 36, TAB = 18, NODE = 46;
    var el = eng.electrical || (global.SonorLedEng && global.SonorLedEng.electrical(eng)) || { boards: [], spurs: [] };
    var gap = 34, cw = (W - gap * 3) / 4.4;
    var X = { sup: 0, psu: cw * 0.85 + gap, ctl: cw * 0.85 + gap + cw + gap, run: cw * 0.85 + gap + cw * 2 + gap * 2 + 14 };
    var BW = { sup: cw * 0.85, psu: cw, ctl: cw, run: W - (cw * 0.85 + gap + cw * 2 + gap * 2 + 14) };
    var circOf = {}; (el.boards || []).forEach(function (b) { b.drivers.forEach(function (dv) { circOf[dv.run] = { id: dv.circuit, board: b.id, mcb: (b.circuits.find(function (c) { return c.id === dv.circuit; }) || {}).mcb_a }; }); });
    var spurOf = {}; (el.spurs || []).forEach(function (s) { spurOf[s.run] = s; });
    var heads = eng.headEnds || [], nodes = (eng.controllers && eng.controllers.nodes || []).filter(function (n) { return n.runs; });
    var groups = [];
    heads.forEach(function (h) { var rs = (eng.runs || []).filter(function (e) { return e.location === 'head-end' && e.headEnd === h.id; }); if (rs.length) groups.push({ key: h.id, head: h, runs: rs, title: h.id + '  ·  ' + h.label + (h.location ? '  ·  ' + h.location : ''), nodes: nodes.filter(function (n) { return (n.headEnd || (heads[0] && heads[0].id)) === h.id; }) }); });
    var local = (eng.runs || []).filter(function (e) { return e.location !== 'head-end'; });
    if (local.length) groups.push({ key: 'local', head: null, runs: local, title: 'LOCAL DRIVERS  ·  beside each strip, accessible', nodes: [] });
    groups.forEach(function (g) { g.runs = g.runs.slice().sort(function (a, b) { var za = a.decoder ? a.decoder.zone : ('~' + a.id), zb = b.decoder ? b.decoder.zone : ('~' + b.id); return za.localeCompare(zb) || String(a.floor).localeCompare(String(b.floor)) || String(a.id).localeCompare(String(b.id)); }); });
    // one sheet when the whole schematic is within 30 % of the space (the page scales it down a little) — never strand a row or two
    var est = 24 + groups.reduce(function (a, g) { return a + TAB + 10 + (g.head && (g.nodes.length || g.runs.some(function (e) { return e.decoder || e.pixel; })) ? NODE : 0) + g.runs.length * ROW + 18; }, 0);
    if (est <= maxH * 1.3) maxH = est + 20;
    // paginate (a group may break; its enclosure + tab repeat)
    var sheets = [], cur = null, y = 0, HEAD = 24;
    function newSheet() { cur = { w: W, h: 0, blocks: [] }; sheets.push(cur); y = HEAD; }
    newSheet();
    groups.forEach(function (g) {
      var i = 0, first = true;
      while (i < g.runs.length) {
        var extra = TAB + 10 + (first && g.head && (g.nodes.length || g.runs.some(function (e) { return e.decoder || e.pixel; })) ? NODE : 0);
        if (y + extra + ROW > maxH && cur.blocks.length) newSheet();
        var room = Math.max(1, Math.floor((maxH - y - extra - 14) / ROW)), take = g.runs.slice(i, i + room);
        cur.blocks.push({ g: g, runs: take, y: y, cont: !first, nodeBand: extra - TAB - 10 });
        i += take.length; first = false; y += extra + take.length * ROW + 18; cur.h = Math.max(cur.h, y);
      }
    });
    sheets.forEach(function (sh, si) {
      var d = DL();
      [['SUPPLY', X.sup], ['PSU / DRIVER', X.psu], ['CONTROL', X.ctl], ['LED STRIP RUN  ·  in the room', X.run]].forEach(function (h) { d.text(h[1], 4, h[0], { size: 6.6, muted: true, track: 1.4 }); });
      d.line([[0, 16], [W, 16]], null, { rule: true });
      sh.blocks.forEach(function (blk) {
        var g = blk.g, top = blk.y, y0 = top + TAB + 6 + blk.nodeBand, encW = X.ctl + BW.ctl + 12, rows = blk.runs.length;
        var encH = TAB + 6 + blk.nodeBand + rows * ROW + 2;
        // enclosure + tab
        if (g.head) { d.rect(-6, top, encW + 6, encH, { encl: true }); d.rect(-6, top, Math.min(encW, 26 + g.title.length * 4.6), TAB, { tab: true }); d.text(2, top + 4.5, g.title.toUpperCase() + (blk.cont ? '  (CONT.)' : ''), { size: 6.8, bold: true, track: 0.9 }); d.text(encW - 4, top + 5, 'HEAD-END BOARD', { size: 5.8, muted: true, track: 1.2, anchor: 'end' }); }
        else { d.text(0, top + 4.5, g.title.toUpperCase() + (blk.cont ? '  (CONT.)' : ''), { size: 6.8, bold: true, track: 0.9 }); }
        // DMX node(s) at the top of the control column
        var busX = X.ctl - 14, busTop = null, busBot = null, busWire = 'dmx';
        if (blk.nodeBand) {
          var nl = g.nodes.length ? g.nodes : [];
          var ny = top + TAB + 6, nTitle = nl.length ? nl.map(function (n) { return n.label; }).join(' + ') : 'DMX node (elsewhere)';
          var nSub = nl.length ? nl.map(function (n) { return n.interface && n.interface.product ? n.interface.product.label.split(/\s+[—-]\s+/)[0] : 'DMX interface'; }).join(' + ') : 'feed arrives from another board';
          box(d, X.ctl, ny, BW.ctl, NODE - 12, 'node', nTitle, nSub, nl.length ? nl.map(function (n) { return n.universes + ' U · ' + n.channels + ' ch'; }).join(' · ') : null);
          d.port(X.ctl, ny + (NODE - 12) / 2, 'dmx'); d.line([[X.ctl, ny + (NODE - 12) / 2], [busX, ny + (NODE - 12) / 2]], 'dmx'); busTop = ny + (NODE - 12) / 2;
          d.text(X.ctl - 2, ny + 1, 'DMX OUT', { size: 5.2, muted: true, anchor: 'end' });
        }
        var decSpans = {};
        blk.runs.forEach(function (e, k) {
          var ry = y0 + k * ROW, by = ry + (ROW - BH) / 2, mid = by + BH / 2, triac = e.control === 'triac', dr = e.driver || {};
          // SUPPLY
          var sp = spurOf[e.id], ci = circOf[e.id], sT, sS, s3, sRole = triac ? 'dimmed' : 'supply', sWire = triac ? 'dimmed' : 'mains';
          if (e.location === 'head-end') { sT = triac ? (ci && ci.id || 'D') + '  ·  dimmed feed' : (ci && ci.id || 'C1') + '  ·  ' + ((ci && ci.mcb) || 10) + ' A type C'; sS = triac ? 'lighting control dimmer ch.' : 'unswitched radial'; s3 = 'L  N  E'; }
          else { var plug = sp && sp.localSupply === 'plug', fz = sp && sp.fuse_a ? sp.fuse_a + ' A' : ''; sT = plug ? (triac ? 'Round-pin socket 5 A' : 'Socket 13 A') : (triac ? 'FCU · dimmed live' : 'FCU (fused spur)'); sS = plug ? (sp && sp.fuse_std === 'circuit' ? 'plug-in · no plug fuse' : 'plug-in · ' + fz + ' plug fuse') : fz + ' fuse · ' + (sp && sp.fuse_std || 'BS 1362'); s3 = (e.floor ? e.floor + ' · ' : '') + (e.room || ''); }
          box(d, X.sup, by, BW.sup, BH, sRole, sT, sS, s3);
          d.port(X.sup + BW.sup, mid, sWire);
          // PSU
          var pT = dr.drivers ? (dr.drivers > 1 ? dr.drivers + ' no. ' : '') + dr.driver_w + ' W ' + (triac ? 'triac' : 'CV') + ' PSU' : 'no driver';
          box(d, X.psu, by, BW.psu, BH, 'psu', pT, dr.product ? prodShort(dr.product.label) : 'generic size — no Library match', (e.strip.volts || 24) + ' V DC out  ·  ' + Math.round(e.input_w || 0) + ' W in');
          d.port(X.psu, mid, sWire); d.port(X.psu + BW.psu, mid, 'lv');
          d.line([[X.sup + BW.sup, mid], [X.psu, mid]], sWire); d.tag((X.sup + BW.sup + X.psu) / 2, mid, '230 V', sWire);
          // CONTROL
          if (e.decoder) { var z = decSpans[e.decoder.zone] = decSpans[e.decoder.zone] || { top: by, bot: by + BH, dec: e.decoder, runs: [] }; z.bot = by + BH; z.runs.push({ e: e, mid: mid }); }
          else if (e.pixel) {
            box(d, X.ctl, by, BW.ctl, BH, 'pixel', 'Pixel controller  ·  ' + (e.pixel.output || ''), short(e.pixel.controller || '', 40), 'SPI data out');
            d.port(X.ctl, mid - 6, 'lv'); d.port(X.ctl, mid + 7, 'data'); d.port(X.ctl + BW.ctl, mid, 'data');
            d.line([[X.psu + BW.psu, mid], [X.psu + BW.psu + 10, mid], [X.psu + BW.psu + 10, mid - 6], [X.ctl, mid - 6]], 'lv');
            d.line([[busX, mid + 7], [X.ctl, mid + 7]], 'data'); d.dot(busX, mid + 7, 'data'); busBot = Math.max(busBot || 0, mid + 7); if (busTop == null) busTop = mid + 7;
            d.line([[X.ctl + BW.ctl, mid], [X.run, mid]], 'data'); d.tag((X.ctl + BW.ctl + X.run) / 2, mid, 'data', 'data');
          } else {
            d.line([[X.psu + BW.psu, mid], [X.run, mid]], 'lv');
            d.tag(X.ctl + BW.ctl / 2, mid, e.cable ? '24 V  ·  2C ' + e.cable.csa + ' mm²  ·  ' + e.cable.length_m + ' m' : '24 V', 'lv');
            d.text(X.ctl + BW.ctl / 2, mid - 13, triac ? 'mains-dimmed at the PSU — no decoder' : (e.control === 'dmx' ? '' : e.controlLabel || ''), { size: 5.6, muted: true, anchor: 'middle' });
          }
          // RUN (in the room)
          box(d, X.run, by, BW.run, BH, 'run', e.id + '  ·  ' + (e.floor ? e.floor + ' ' : '') + (e.room || ''),
            (e.strip.product && e.strip.product.sku ? e.strip.product.sku + '  ' : '') + e.strip.label + '  ·  ' + r1(e.metres) + ' m  ·  ' + Math.round(e.load_w) + ' W',
            (e.feeds || []).length + ' feed' + ((e.feeds || []).length === 1 ? '' : 's') + (e.cable ? '  ·  2C ' + e.cable.csa + ' mm² ' + e.cable.drop_pct + ' % drop' : '') + (e.dmx && e.dmx.address ? '  ·  U' + e.dmx.universe + ' ' + pad3(e.dmx.address) : '') + (e.pixel ? '  ·  ' + e.pixel.output : ''));
          d.port(X.run, mid, e.decoder ? 'pwm' : (e.pixel ? 'data' : 'lv'));
          var gw = Math.min(150, BW.run * 0.32), gx = X.run + BW.run - gw - 8, gy = by + 7;
          if (BW.run > 260) { d.rect(gx, gy, gw, 3.2, { strip: true }); (e.feeds || []).forEach(function (f) { var fx = gx + (e.metres ? f / e.metres : 0) * gw; d.line([[fx, gy - 2.5], [fx, gy + 5.5]], 'lv'); d.dot(fx, gy + 1.6, 'lv', { r: 1.4 }); }); d.text(gx + gw, gy + 6, r1(e.metres) + ' m', { size: 5.4, muted: true, anchor: 'end' }); }
        });
        Object.keys(decSpans).forEach(function (k) {
          var z = decSpans[k], h = z.bot - z.top, addr = z.runs.filter(function (r) { return r.e.dmx && r.e.dmx.address; }).map(function (r) { return 'U' + r.e.dmx.universe + ' ' + pad3(r.e.dmx.address) + (r.e.dmx.channels > 1 ? '–' + pad3(r.e.dmx.address + r.e.dmx.channels - 1) : ''); });
          box(d, X.ctl, z.top, BW.ctl, h, 'decoder', (z.dec.qty > 1 ? z.dec.qty + ' no. ' : '') + z.dec.label.replace(/^Skydance\s+/i, '').replace(/\s+CV.*$/i, '') + ' decoder', (z.dec.channels ? z.dec.channels + ' ch × ' : '') + 'PWM out  ·  DMX in / thru', addr.join('  ·  '));
          var dy = z.top + 8; d.port(X.ctl, dy, 'dmx'); d.line([[busX, dy], [X.ctl, dy]], 'dmx'); d.dot(busX, dy, 'dmx');
          if (busTop == null) busTop = dy; busBot = Math.max(busBot || 0, dy);
          var chan = 1;
          z.runs.forEach(function (r) {
            var inY = r.mid + (h > BH ? 0 : 6);   // a one-row decoder takes DMX at the top and 24 V below it
            d.port(X.ctl, inY, 'lv'); d.port(X.ctl + BW.ctl, r.mid, 'pwm');
            d.line([[X.psu + BW.psu, r.mid], [X.psu + BW.psu + 10, r.mid], [X.psu + BW.psu + 10, inY], [X.ctl, inY]], 'lv');
            var ch = Math.max(1, r.e.dmx ? r.e.dmx.channels : 1), lab = 'CH' + chan + (ch > 1 ? '–' + (chan + ch - 1) : ''); chan += ch;
            d.line([[X.ctl + BW.ctl, r.mid], [X.run, r.mid]], 'pwm'); d.tag((X.ctl + BW.ctl + X.run) / 2, r.mid, lab, 'pwm');
          });
        });
        if (busTop != null && busBot != null && busBot > busTop) d.line([[busX, busTop], [busX, busBot]], busWire);
        if (blk.nodeBand && busTop != null) d.text(busX - 3, busTop + 4, 'DMX bus', { size: 5.2, muted: true, anchor: 'end' });
        if (!g.head) blk.runs.forEach(function (e, k) { var ry = y0 + k * ROW; d.rect(X.sup - 6, ry + (ROW - BH) / 2 - 5, X.psu + BW.psu + 12, BH + 10, { encl: true, light: true }); });
      });
      if (opts.legend !== false) { var lx = 0, ly = sh.h + 2; Object.keys(WIRE).forEach(function (k) { d.line([[lx, ly + 4], [lx + 22, ly + 4]], k); d.text(lx + 27, ly, WIRE[k].label, { size: 6.2, muted: true }); lx += 34 + WIRE[k].label.length * 3.4 + 12; }); sh.h = ly + 14; }
      sh.items = d.items; sh.title = 'Wiring schematic' + (sheets.length > 1 ? ' — sheet ' + (si + 1) + ' of ' + sheets.length : ''); sh.groups = sh.blocks.map(function (b) { return b.g.key; }); delete sh.blocks;
    });
    return { sheets: sheets.length && sheets[0].items.length > 6 ? sheets : [], wires: WIRE };
  }

  // ══ HEAD-END BOARD ELEVATION (true scale) ══
  function elevation(board, opts) {
    opts = opts || {}; var targetW = num(opts.width, 760);
    var items = [];
    (board.drivers || []).forEach(function (dv) { var dm = dv.dims_mm && dv.dims_mm.length >= 2 ? dv.dims_mm : null, f = dm || NOMINAL.driver(dv.size_w); for (var q = 0; q < (dv.qty || 1); q++) items.push({ id: 'psu-' + dv.run + '-' + q, role: 'psu', label: dv.size_w + ' W ' + (dv.control === 'triac' ? 'triac' : 'CV') + ' PSU', sub: dv.run + (dv.circuit ? '  ·  ' + dv.circuit : ''), mm: [num(f[0]), num(f[1])], nominal: !dm, product: dv.label, run: dv.run, band: dv.control === 'triac' ? 'dimmed' : 'supply' }); });
    (board.decoders || []).forEach(function (dc, i) { var f = dc.dims_mm || NOMINAL.decoder; for (var q = 0; q < (dc.qty || 1); q++) items.push({ id: 'dec-' + i + '-' + q, role: 'decoder', label: dc.label.replace(/^Skydance\s+/i, '').split(' ')[0] + ' decoder', sub: String(dc.zone || '').split(' | ').pop(), mm: [num(f[0]), num(f[1])], nominal: !dc.dims_mm, product: dc.label }); });
    (board.nodes || []).forEach(function (n, i) { var f = n.dims_mm || NOMINAL.node; items.push({ id: 'node-' + i, role: 'node', label: n.label, sub: n.product || 'DMX node', mm: [num(f[0]), num(f[1])], nominal: !n.dims_mm, product: n.product || 'DMX node' }); });
    if ((board.pixel || []).length) { var pc = Math.ceil(board.pixel.length / 4); for (var p = 0; p < pc; p++) items.push({ id: 'px-' + p, role: 'pixel', label: 'Pixel controller', sub: board.pixel.slice(p * 4, p * 4 + 4).map(function (x) { return x.output; }).join(' '), mm: NOMINAL.pixel.slice(), nominal: true, product: 'Pixel controller' }); }
    var runs = (board.drivers || []).map(function (dv) { return dv.run; });
    // geometry (mm)
    var M = 30, GAP = 22, DIN = 90, TRUNK = 40, ROWH = 100, TERM = 120;
    var maxL = items.reduce(function (a, i) { return Math.max(a, i.mm[0]); }, 0);
    var boardW = Math.max(600, Math.ceil(((maxL + GAP) * 2 + M * 2) / 50) * 50);
    if (items.length > 8) boardW = Math.max(boardW, 800); if (items.length > 14) boardW = Math.max(boardW, 1000);
    var unit = 10, size = Math.floor((boardW - M * 2) / unit);
    var gItems = items.map(function (i) { return { id: i.id, size: Math.ceil((i.mm[0] + GAP) / unit), label: i.label, weightRank: i.role === 'psu' ? 2 : 1 }; });
    var placed = null, rows = 1;
    for (rows = 1; rows < 40; rows++) {
      var grid = { orientation: 'horizontal', rows: rows, size: size, unit: unit };
      placed = (global.SonorSlotGrid && global.SonorSlotGrid.autoLayout) ? global.SonorSlotGrid.autoLayout(grid, gItems) : firstFit(grid, gItems);
      if (!placed.some(function (i) { return i.unplaced; })) break;
    }
    var at = {}; placed.forEach(function (p) { at[p.id] = p; });
    var termNeeded = runs.length * 2 * 6 + 40;   // 2-pole 6 mm terminals per run + end stops
    var termRows = Math.max(1, Math.ceil(termNeeded / (boardW - M * 2)));
    var boardH = M + DIN + TRUNK + rows * (ROWH + TRUNK) + termRows * TERM + M;
    var k = Math.min(targetW / (boardW + 70), opts.maxHeight ? (opts.maxHeight - 40) / (boardH + 40) : 1e9), d = DL(), ox = 0, oy = 6;
    var mm = function (v) { return v * k; }, X = function (v) { return ox + mm(v); }, Y = function (v) { return oy + mm(v); };
    // backboard + fixings
    d.rect(X(0), Y(0), mm(boardW), mm(boardH), { board: true });
    [[12, 12], [boardW - 12, 12], [12, boardH - 12], [boardW - 12, boardH - 12]].forEach(function (p) { d.dot(X(p[0]), Y(p[1]), null, { r: Math.max(1.2, mm(4)), hollow: true }); });
    // DIN rail + protective devices
    var dy = M, din = [{ id: 'ISO', mm: 36, kind: 'iso', face: 'ISO', sub: '2P' }].concat((board.circuits || []).map(function (c) { return { id: c.id, mm: 18, kind: 'mcb', face: c.id, sub: 'C' + c.mcb_a }; })).concat((board.dimmedFeeds || []).map(function (f) { return { id: f.id, mm: 12, kind: 'dim', face: f.id, sub: '' }; })).concat([{ id: 'N', mm: 36, kind: 'bar', face: 'N', sub: '' }, { id: 'E', mm: 36, kind: 'bar', face: 'E', sub: '' }]);
    d.rect(X(M), Y(dy + DIN / 2 - 4), mm(boardW - M * 2), mm(8), { rail: true });
    var dx = M + 4;
    din.forEach(function (m) {
      var h = m.kind === 'dim' ? 46 : (m.kind === 'bar' ? 22 : 80), y0 = dy + (DIN - h) / 2;
      d.rect(X(dx), Y(y0), mm(m.mm) - 0.6, mm(h), { mcb: m.kind });
      if (m.kind === 'mcb' || m.kind === 'iso') { d.rect(X(dx + m.mm * 0.28), Y(y0 + h * 0.36), mm(m.mm * 0.44), mm(h * 0.2), { toggle: m.kind }); }
      d.text(X(dx + m.mm / 2), Y(y0 + h) + 2, m.face, { size: Math.max(4.6, Math.min(6.6, mm(m.mm) * 0.45)), bold: true, anchor: 'middle' });
      if (m.sub) d.text(X(dx + m.mm / 2), Y(y0) + 1.5, m.sub, { size: Math.max(4, Math.min(5.6, mm(m.mm) * 0.36)), muted: true, anchor: 'middle', ink: m.kind === 'mcb' || m.kind === 'iso' });
      dx += m.mm + 1;
    });
    d.text(X(dx + 14), Y(dy + DIN / 2) - 9, 'DIN rail  ·  incoming supplies: ' + (board.circuits || []).length + ' radial' + ((board.circuits || []).length === 1 ? '' : 's') + (board.dimmedFeeds && board.dimmedFeeds.length ? ' + ' + board.dimmedFeeds.length + ' dimmed feed' + (board.dimmedFeeds.length === 1 ? '' : 's') : ''), { size: 5.8, muted: true });
    // trunking under the rail + between rows
    function trunk(ymm) { d.rect(X(M), Y(ymm), mm(boardW - M * 2), mm(TRUNK - 8), { trunk: true }); for (var sx = M + 20; sx < boardW - M - 10; sx += 40) d.rect(X(sx), Y(ymm + 4), mm(16), mm(TRUNK - 16), { slot: true }); }
    var ty = dy + DIN; trunk(ty);
    for (var r = 0; r < rows; r++) {
      var rowTop = ty + TRUNK + r * (ROWH + TRUNK);
      items.forEach(function (i) {
        var pz = at[i.id]; if (!pz || pz.unplaced || pz.row !== r) return;
        var xm = M + pz.start * unit, ym = rowTop + (ROWH - i.mm[1]) / 2, w = mm(i.mm[0]), h = mm(i.mm[1]);
        d.rect(X(xm), Y(ym), w, h, { tile: i.role, dash: i.nominal });
        d.rect(X(xm), Y(ym), Math.max(2, mm(5)), h, { band: i.band || i.role });
        var ls = Math.min(8.4, Math.max(5.2, h / 3.6)), ss = Math.min(6.6, Math.max(4.6, h / 5));
        d.text(X(xm) + Math.max(4, mm(9)), Y(ym) + 3, short(i.label, Math.floor((w - 8) / (ls * 0.56))), { size: ls, bold: true });
        if (h > ls * 2.3) d.text(X(xm) + Math.max(4, mm(9)), Y(ym) + 4 + ls, short(i.sub, Math.floor((w - 8) / (ss * 0.53))), { size: ss, muted: true });
        if (h > ls * 2.3 + ss * 1.6) d.text(X(xm) + Math.max(4, mm(9)), Y(ym) + 5 + ls + ss * 1.25, Math.round(i.mm[0]) + ' × ' + Math.round(i.mm[1]) + (i.nominal ? ' nominal' : ' mm'), { size: ss * 0.92, muted: true });
      });
      trunk(rowTop + ROWH);
    }
    // LV terminal rail — a V+ / V− pair per run, labelled
    var trTop = ty + TRUNK + rows * (ROWH + TRUNK);
    for (var tr = 0; tr < termRows; tr++) {
      var tyy = trTop + tr * TERM; d.rect(X(M), Y(tyy + 27), mm(boardW - M * 2), mm(8), { rail: true });
      var per = Math.floor((boardW - M * 2 - 40) / 12), slice = runs.slice(tr * per, tr * per + per), tx = M + 10, labels = [];
      d.rect(X(tx), Y(tyy + 10), mm(4), mm(42), { mcb: 'bar' }); tx += 6;
      slice.forEach(function (rid) { ['+', '−'].forEach(function (pol) { d.rect(X(tx), Y(tyy + 12), mm(5.4), mm(38), { term: pol }); tx += 6; }); labels.push([tx - 6, rid]); });
      d.rect(X(tx), Y(tyy + 10), mm(4), mm(42), { mcb: 'bar' });
      labels.forEach(function (l) { d.text(X(l[0]), Y(tyy + TERM - 6), short(l[1], 16), { size: Math.max(3.8, Math.min(5.4, mm(12) * 0.5)), muted: true, rot: true }); });   // after every terminal, so nothing paints over them
      if (tr === 0) d.text(X(tx + 20), Y(tyy + 31) - 9, 'LV terminals  ·  V+ / V− per run to the field', { size: 5.8, muted: true });
    }
    // overall dimensions
    d.dim(X(0), Y(boardH) + 14, X(boardW), Y(boardH) + 14, boardW + ' mm');
    d.dim(X(boardW) + 16, Y(0), X(boardW) + 16, Y(boardH), boardH + ' mm', { vertical: true });
    var schedule = [];
    var by = {}; items.forEach(function (i) { var key = i.role + '|' + i.label + '|' + i.product; var s = by[key] = by[key] || { role: i.role, label: i.label, product: i.product, mm: i.mm, nominal: i.nominal, qty: 0 }; s.qty++; });
    Object.keys(by).forEach(function (kk) { schedule.push(by[kk]); });
    return { w: mm(boardW) + 52, h: mm(boardH) + 32, items: d.items, mm: [boardW, boardH], kPerMm: k, schedule: schedule, board: board, rows: rows,
      title: (board.label || 'Head end') + ' — board elevation', placedVia: (global.SonorSlotGrid && global.SonorSlotGrid.autoLayout) ? 'kit slot grid' : 'built-in first-fit' };
  }
  function firstFit(grid, items) {
    var out = [], loose = items.slice().sort(function (a, b) { return (b.weightRank || 0) - (a.weightRank || 0) || b.size - a.size; });
    loose.forEach(function (it) {
      for (var row = 0; row < grid.rows; row++) for (var s = 0; s + it.size <= grid.size; s++) {
        if (!out.some(function (o) { return o.row === row && s < o.start + o.size && o.start < s + it.size; })) { out.push(Object.assign({}, it, { start: s, row: row })); return; }
      }
      out.push(Object.assign({}, it, { start: -1, row: 0, unplaced: true }));
    });
    return out;
  }
  function legend(kind) {
    if (kind === 'elevation') return [['supply', 'PSU on a radial (unswitched)'], ['dimmed', 'PSU on a dimmed feed (triac)'], ['decoder', 'DMX decoder'], ['node', 'DMX node / pixel controller']].map(function (r) { return { key: r[0], label: r[1], colour: ROLE[r[0]].paper, w: 3 }; }).concat([{ key: 'nominal', label: 'Dashed = nominal size', colour: [112, 112, 112], dash: [3, 2], w: 0.8 }]);
    return Object.keys(WIRE).map(function (k) { return { key: k, label: WIRE[k].label, colour: WIRE[k].paper, dash: WIRE[k].dash || null, w: WIRE[k].w }; });
  }

  // ══ PAINTERS ══
  function hex(c) { return typeof c === 'string' ? c : 'rgb(' + c.join(',') + ')'; }
  function mix(c, bg, t) { if (typeof c === 'string') return c; return [0, 1, 2].map(function (i) { return Math.round(c[i] * t + bg[i] * (1 - t)); }); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function rectStyle(o, T, theme) {
    if (o.box) return { fill: T.box, stroke: T.boxLine, sw: 0.7, dash: o.dash ? [3, 2] : null, rx: 2 };
    if (o.band) { var R = ROLE[o.band] || ROLE.psu; return { fill: R[theme] }; }
    if (o.encl) return { fill: null, stroke: T.encl, sw: o.light ? 0.5 : 0.8, dash: o.light ? [2, 2] : [6, 3], rx: 4 };
    if (o.tab) return { fill: T.tab, stroke: T.encl, sw: 0.6, rx: 3 };
    if (o.board) return { fill: T.board, stroke: T.boardLine, sw: 0.9, rx: 2 };
    if (o.rail) return { fill: T.rail };
    if (o.trunk) return { fill: T.trunk, stroke: T.faint, sw: 0.4 };
    if (o.slot) return { fill: T.trunkSlot };
    if (o.toggle) return { fill: o.toggle === 'iso' ? (theme === 'paper' ? [200, 40, 40] : '#e05a4f') : T.mcbInk };
    if (o.mcb) return { fill: o.mcb === 'dim' ? ROLE.dimmed[theme] : (o.mcb === 'bar' ? T.term : T.mcb), stroke: T.boxLine, sw: 0.5, rx: 1 };
    if (o.term) return { fill: o.term === '+' ? (theme === 'paper' ? [214, 84, 66] : '#c4574b') : (theme === 'paper' ? [60, 60, 60] : '#5a5f66'), stroke: T.boxLine, sw: 0.3 };
    if (o.tile) { var Rt = ROLE[o.tile] || ROLE.psu; return { fill: theme === 'paper' ? mix(Rt.paper, [255, 255, 255], 0.1) : T.box, stroke: Rt[theme], sw: 0.9, dash: o.dash ? [3, 2] : null, rx: 2 }; }
    if (o.strip) return { fill: ROLE.run[theme] };
    return { fill: T.box, stroke: T.boxLine, sw: 0.6 };
  }
  function toSvg(sheet, opts) {
    opts = opts || {}; var theme = opts.theme === 'paper' ? 'paper' : 'dark', T = THEME[theme], pad = opts.pad == null ? 14 : opts.pad;
    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + (-pad) + ' ' + (-pad) + ' ' + (sheet.w + pad * 2) + ' ' + (sheet.h + pad * 2) + '" font-family="DM Sans, Gilroy, system-ui, sans-serif">';
    if (T.bg) s += '<rect x="' + (-pad) + '" y="' + (-pad) + '" width="' + (sheet.w + pad * 2) + '" height="' + (sheet.h + pad * 2) + '" fill="' + T.bg + '"/>';
    sheet.items.forEach(function (it) {
      var o = it.o || {};
      if (it.t === 'rect') { var st = rectStyle(o, T, theme); s += '<rect x="' + it.x.toFixed(1) + '" y="' + it.y.toFixed(1) + '" width="' + Math.max(0, it.w).toFixed(1) + '" height="' + Math.max(0, it.h).toFixed(1) + '"' + (st.rx ? ' rx="' + st.rx + '"' : '') + ' fill="' + (st.fill ? hex(st.fill) : 'none') + '"' + (st.stroke ? ' stroke="' + hex(st.stroke) + '" stroke-width="' + st.sw + '"' : '') + (st.dash ? ' stroke-dasharray="' + st.dash.join(' ') + '"' : '') + '/>'; }
      else if (it.t === 'line') { var w = it.wire ? WIRE[it.wire] : null, col = w ? w[theme] : (o.rule ? T.line : T.faint); s += '<polyline points="' + it.pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + '" fill="none" stroke="' + hex(col) + '" stroke-width="' + (w ? w.w : 0.6) + '" stroke-linejoin="round"' + (w && w.dash ? ' stroke-dasharray="' + w.dash.join(' ') + '"' : '') + '/>'; }
      else if (it.t === 'dot') { var c = it.wire ? WIRE[it.wire][theme] : T.boxLine; s += '<circle cx="' + it.x.toFixed(1) + '" cy="' + it.y.toFixed(1) + '" r="' + (o.r || 2.2) + '"' + (o.hollow ? ' fill="none" stroke="' + hex(T.boardLine) + '" stroke-width="0.6"' : ' fill="' + hex(c) + '"') + '/>'; }
      else if (it.t === 'port') s += '<circle cx="' + it.x.toFixed(1) + '" cy="' + it.y.toFixed(1) + '" r="1.9" fill="' + hex(T.box) + '" stroke="' + hex(WIRE[it.wire][theme]) + '" stroke-width="1"/>';
      else if (it.t === 'tag') { var tw = it.s.length * 3.15 + 6, tc = WIRE[it.wire] ? WIRE[it.wire][theme] : T.muted; s += '<rect x="' + (it.x - tw / 2).toFixed(1) + '" y="' + (it.y - 4.6).toFixed(1) + '" width="' + tw.toFixed(1) + '" height="9.2" rx="2" fill="' + hex(T.knock) + '"/><text x="' + it.x.toFixed(1) + '" y="' + (it.y + 2.1).toFixed(1) + '" font-size="5.8" text-anchor="middle" fill="' + hex(tc) + '">' + esc(it.s) + '</text>'; }
      else if (it.t === 'dim') { var dc = hex(T.dim), v = o.vertical; s += '<line x1="' + it.x1 + '" y1="' + it.y1 + '" x2="' + it.x2 + '" y2="' + it.y2 + '" stroke="' + dc + '" stroke-width="0.5"/>'; [[it.x1, it.y1], [it.x2, it.y2]].forEach(function (p) { s += v ? '<line x1="' + (p[0] - 4) + '" y1="' + p[1] + '" x2="' + (p[0] + 4) + '" y2="' + p[1] + '" stroke="' + dc + '" stroke-width="0.5"/>' : '<line x1="' + p[0] + '" y1="' + (p[1] - 4) + '" x2="' + p[0] + '" y2="' + (p[1] + 4) + '" stroke="' + dc + '" stroke-width="0.5"/>'; });
        var mx = (it.x1 + it.x2) / 2, my = (it.y1 + it.y2) / 2; s += v ? '<text x="' + (mx + 4) + '" y="' + my + '" font-size="6.4" fill="' + dc + '" transform="rotate(-90 ' + (mx + 4) + ' ' + my + ')" text-anchor="middle" dy="6">' + esc(it.s) + '</text>' : '<text x="' + mx + '" y="' + (my + 10) + '" font-size="6.4" text-anchor="middle" fill="' + dc + '">' + esc(it.s) + '</text>'; }
      else if (it.t === 'text') { var sz = o.size || 8, colT = o.ink ? T.mcbInk : (o.muted ? T.muted : T.text), anc = o.anchor === 'end' ? 'end' : (o.anchor === 'middle' ? 'middle' : 'start');
        s += '<text x="' + it.x.toFixed(1) + '" y="' + (it.y + sz * 0.82).toFixed(1) + '" font-size="' + sz + '"' + (o.bold ? ' font-weight="700"' : '') + (o.track ? ' letter-spacing="' + o.track + '"' : '') + ' text-anchor="' + anc + '" fill="' + hex(colT) + '"' + (o.rot ? ' transform="rotate(-90 ' + it.x.toFixed(1) + ' ' + (it.y + sz * 0.82).toFixed(1) + ')"' : '') + '>' + esc(it.s) + '</text>'; }
    });
    return s + '</svg>';
  }
  // pdf-lib — page = PDFPage; opts = { x, top (pt from the top of the canvas), scale, H (canvas height), fonts: {b, r}, theme, safe }
  function toPdf(page, sheet, opts) {
    var PL = global.PDFLib; opts = opts || {}; var theme = opts.theme === 'dark' ? 'dark' : 'paper', T = THEME[theme], k = num(opts.scale, 1), OX = num(opts.x), OY = num(opts.top), H = num(opts.H, 841.89), F = opts.fonts || {}, safe = opts.safe || function (x) { return x; };
    function rgb(c) { if (typeof c === 'string') { var h = c.replace('#', ''); c = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; } return PL.rgb(c[0] / 255, c[1] / 255, c[2] / 255); }
    function px(x) { return OX + x * k; } function py(y) { return H - (OY + y * k); }
    function lw(w) { return Math.max(0.35, w * Math.min(1, k + 0.15)); }
    function txt(s, x, y, sz, font, col, anchor, rot) {
      if (!font) return; s = safe(s); var w = font.widthOfTextAtSize(s, sz);
      if (rot) { page.drawText(s, { x: x + sz * 0.3, y: y, size: sz, font: font, color: col, rotate: PL.degrees(90) }); return; }
      page.drawText(s, { x: anchor === 'end' ? x - w : (anchor === 'middle' ? x - w / 2 : x), y: y, size: sz, font: font, color: col });
    }
    sheet.items.forEach(function (it) {
      var o = it.o || {};
      if (it.t === 'rect') { var st = rectStyle(o, T, theme), opt = { x: px(it.x), y: py(it.y + it.h), width: Math.max(0, it.w * k), height: Math.max(0, it.h * k) }; if (st.fill) opt.color = rgb(st.fill); else opt.opacity = 0; if (st.stroke) { opt.borderColor = rgb(st.stroke); opt.borderWidth = lw(st.sw); if (st.dash) opt.borderDashArray = st.dash; } page.drawRectangle(opt); }
      else if (it.t === 'line') { var w = it.wire ? WIRE[it.wire] : null, col = rgb(w ? w[theme] : (o.rule ? T.line : T.faint)); for (var i = 1; i < it.pts.length; i++) { var lo = { start: { x: px(it.pts[i - 1][0]), y: py(it.pts[i - 1][1]) }, end: { x: px(it.pts[i][0]), y: py(it.pts[i][1]) }, thickness: lw(w ? w.w : 0.6), color: col }; if (w && w.dash) lo.dashArray = w.dash; page.drawLine(lo); } }
      else if (it.t === 'dot') { var dc = it.wire ? WIRE[it.wire][theme] : T.boxLine; if (o.hollow) page.drawCircle({ x: px(it.x), y: py(it.y), size: (o.r || 2.2) * k, borderColor: rgb(T.boardLine), borderWidth: 0.5, opacity: 0, borderOpacity: 1 }); else page.drawCircle({ x: px(it.x), y: py(it.y), size: (o.r || 2.2) * k, color: rgb(dc) }); }
      else if (it.t === 'port') page.drawCircle({ x: px(it.x), y: py(it.y), size: 1.9 * k, color: rgb(T.box), borderColor: rgb(WIRE[it.wire][theme]), borderWidth: lw(1) });
      else if (it.t === 'tag') { var tsz = 5.8 * k, tf = F.r, ts = safe(it.s), tw = tf ? tf.widthOfTextAtSize(ts, tsz) + 6 * k : 0; page.drawRectangle({ x: px(it.x) - tw / 2, y: py(it.y) - 4.6 * k, width: tw, height: 9.2 * k, color: rgb(theme === 'paper' ? [255, 255, 255] : T.knock) }); txt(ts, px(it.x), py(it.y) - 2.1 * k, tsz, tf, rgb(WIRE[it.wire] ? WIRE[it.wire][theme] : T.muted), 'middle'); }
      else if (it.t === 'dim') { var dcol = rgb(T.dim), v = o.vertical; page.drawLine({ start: { x: px(it.x1), y: py(it.y1) }, end: { x: px(it.x2), y: py(it.y2) }, thickness: 0.5, color: dcol }); [[it.x1, it.y1], [it.x2, it.y2]].forEach(function (p) { if (v) page.drawLine({ start: { x: px(p[0] - 4), y: py(p[1]) }, end: { x: px(p[0] + 4), y: py(p[1]) }, thickness: 0.5, color: dcol }); else page.drawLine({ start: { x: px(p[0]), y: py(p[1] - 4) }, end: { x: px(p[0]), y: py(p[1] + 4) }, thickness: 0.5, color: dcol }); });
        var mx = px((it.x1 + it.x2) / 2), my = py((it.y1 + it.y2) / 2); if (v) txt(it.s, mx + 9 * k, my - (F.r ? F.r.widthOfTextAtSize(safe(it.s), 6.4 * k) / 2 : 0), 6.4 * k, F.r, dcol, null, true); else txt(it.s, mx, my - 10 * k, 6.4 * k, F.r, dcol, 'middle'); }
      else if (it.t === 'text') { var sz = (o.size || 8) * k, font = o.bold ? (F.b || F.r) : F.r, colT = rgb(o.ink ? T.mcbInk : (o.muted ? T.muted : T.text)); if (!font) return; var str = safe(it.s);
        if (o.track) { var cxp = px(it.x); for (var j = 0; j < str.length; j++) { page.drawText(str[j], { x: cxp, y: py(it.y) - sz * 0.82, size: sz, font: font, color: colT }); cxp += font.widthOfTextAtSize(str[j], sz) + o.track * k; } }
        else txt(str, px(it.x), py(it.y) - sz * 0.82, sz, font, colT, o.anchor, o.rot); }
    });
  }

  global.SonorLedDrawings = { VERSION: VERSION, WIRE: WIRE, ROLE: ROLE, THEME: THEME, schematic: schematic, elevation: elevation, legend: legend, toSvg: toSvg, toPdf: toPdf };
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
