/**
 * sonor-led-drawings.js — CANONICAL MASTER (workspace root → data/ in every app via sync, like sonor-led-engineering.js)
 * v1.0.0 · 2026-11-01 — Bryn: "can you include a schematic for the wiring and an elevation of head end decoders and psu's? there
 *   should be a toggle for head end or local per circuit and include electrical requirements which are linked with other apps" ·
 *   "use our current best methods preferably shared from other apps so there are no monoliths and apps dont fall out of sync".
 *
 * ONE drawing source for LED wiring, built from SonorLedEng.project() (engine ≥ 1.5.0). Each drawing is a plain DISPLAY LIST
 * (rect / line / text / dot in points) and the same list is painted two ways, so the screen and the PDF can never disagree:
 *   SonorLedDrawings.schematic(eng, { width, maxHeight })  → { sheets: [{ w, h, title, items }] }   ladder wiring schematic
 *   SonorLedDrawings.elevation(board, { width })           → { w, h, items, mm, board }               head-end board elevation
 *   SonorLedDrawings.toSvg(sheet, { theme: 'dark'|'paper' }) → SVG string (apps)
 *   SonorLedDrawings.toPdf(page, sheet, { x, top, scale, H, fonts, theme }) → draws vectors on a pdf-lib page (packs)
 * The head-end board is packed on the kit's slot grid (SonorSlotGrid.autoLayout — the same first-fit the Engineering rack and DIN
 * lighting panels use) when the kit is on the page; a built-in first-fit is the offline fallback. Item sizes are real Library
 * dimensions (lighting_items.metadata.led.dims_mm / pm_lighting_control_types metadata.led.dims_mm) — nominal sizes, labelled, when
 * a product has none yet.
 * No DOM, no DB — node-tested (tests/led-drawings.test.mjs).
 */
(function (global) {
  'use strict';
  var VERSION = '1.0.0';
  function num(x, d) { var n = Number(x); return isFinite(n) ? n : (d || 0); }
  function r1(x) { return Math.round(x * 10) / 10; }
  function pad3(n) { return ('00' + n).slice(-3); }

  // wire classes — colour by what the conductor carries (the legend prints these)
  var WIRE = {
    mains:  { label: '230 V unswitched',          dark: '#c08a5a', paper: [150, 98, 52], w: 1.4 },
    dimmed: { label: '230 V dimmed (triac)',      dark: '#e3a63a', paper: [214, 140, 31], w: 1.4, dash: [5, 3] },
    lv:     { label: '24 V DC feed',              dark: '#e06c5c', paper: [192, 57, 43], w: 1.6 },
    pwm:    { label: 'Decoder output (PWM)',      dark: '#e98aa0', paper: [196, 82, 110], w: 1.2 },
    dmx:    { label: 'DMX512 (screened data)',    dark: '#5aa4e6', paper: [52, 120, 196], w: 1.2, dash: [3, 2] },
    data:   { label: 'Ethernet / pixel data',     dark: '#a684d4', paper: [128, 88, 161], w: 1.2, dash: [1.5, 2] }
  };
  var THEME = {
    dark:  { bg: '#1c1f24', frame: '#3a3f47', box: '#262a31', boxLine: '#5b616b', text: '#eef0f3', muted: '#9aa2ad', accent: '#f5d05c', group: '#2b3038', rail: '#8d96a3', board: '#2a2e35', mcb: '#3b4250' },
    paper: { bg: null, frame: [214, 214, 214], box: [250, 250, 250], boxLine: [120, 120, 120], text: [24, 24, 24], muted: [118, 118, 118], accent: [173, 153, 120], group: [242, 242, 240], rail: [150, 150, 150], board: [246, 245, 242], mcb: [232, 232, 232] }
  };
  // nominal footprints (mm, L × W) when the Library row has no dims yet
  var NOMINAL = { driver: function (w) { var t = [[30, 158, 46], [60, 160, 58], [75, 170, 45], [100, 170, 45], [150, 179, 63], [200, 195, 67], [240, 210, 72], [320, 215, 78]]; for (var i = 0; i < t.length; i++) if (w <= t[i][0]) return [t[i][1], t[i][2]]; return [230, 80]; },
    decoder: [175, 46], node: [90, 62], pixel: [120, 70], psuElv: [90, 55] };

  // ── display list helpers ──
  function L() { var it = []; return {
    items: it,
    rect: function (x, y, w, h, o) { it.push({ t: 'rect', x: x, y: y, w: w, h: h, o: o || {} }); },
    line: function (pts, wire, o) { it.push({ t: 'line', pts: pts, wire: wire, o: o || {} }); },
    text: function (x, y, s, o) { it.push({ t: 'text', x: x, y: y, s: String(s == null ? '' : s), o: o || {} }); },
    dot: function (x, y, wire) { it.push({ t: 'dot', x: x, y: y, wire: wire }); }
  }; }
  function short(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function prodShort(label) { return String(label || '').replace(/^Tagra\s+/i, '').replace(/Constant Voltage\s*/i, 'CV ').replace(/LED Driver\s*·?\s*/i, '').replace(/\s*·\s*IP20/i, '').replace(/\s+/g, ' ').trim(); }

  // ══ WIRING SCHEMATIC (ladder) ══
  // One row per run, grouped by where the PSU sits: each head end (its board) then the local drivers. Columns left → right:
  // SUPPLY (radial C1 / dimmed feed D1 / fused spur) → PSU → DECODER (shared by the zone's runs) or PIXEL CONTROLLER → STRIP RUN.
  // The DMX bus drops from each node down the decoder column of its head end.
  function schematic(eng, opts) {
    opts = opts || {}; var W = num(opts.width, 1094), maxH = num(opts.maxHeight, 0) || 1e9, ROW = 44, GH = 30, TOP = 34;
    var el = eng.electrical || (global.SonorLedEng && global.SonorLedEng.electrical(eng)) || { boards: [], spurs: [] };
    var cx = { sup: 0, psu: W * 0.17, dec: W * 0.40, run: W * 0.63 }, bw = { sup: W * 0.13, psu: W * 0.19, dec: W * 0.18, run: W * 0.37 };
    var circOf = {}; (el.boards || []).forEach(function (b) { b.drivers.forEach(function (d) { circOf[d.run] = { id: d.circuit, board: b.id }; }); });
    var spurOf = {}; (el.spurs || []).forEach(function (s) { spurOf[s.run] = s; });
    var groups = [], heads = eng.headEnds || [];
    heads.forEach(function (h) { var rs = (eng.runs || []).filter(function (e) { return e.location === 'head-end' && e.headEnd === h.id; }); if (rs.length) groups.push({ key: h.id, title: h.label + (h.location ? '  ·  ' + h.location : '') + '  —  HEAD END', runs: rs, head: h }); });
    var local = (eng.runs || []).filter(function (e) { return e.location !== 'head-end'; });
    if (local.length) groups.push({ key: 'local', title: 'LOCAL DRIVERS  —  beside each strip (accessible)', runs: local, head: null });
    var nodes = (eng.controllers && eng.controllers.nodes || []).filter(function (n) { return n.runs; });
    // order rows inside a group so a decoder's runs sit together: zone, then id
    groups.forEach(function (g) { g.runs = g.runs.slice().sort(function (a, b) { var za = a.decoder ? a.decoder.zone : ('~' + a.id), zb = b.decoder ? b.decoder.zone : ('~' + b.id); return za.localeCompare(zb) || String(a.floor).localeCompare(String(b.floor)) || String(a.id).localeCompare(String(b.id)); }); });
    // paginate: a group may break across sheets; its header repeats
    var sheets = [], cur = null, y = 0;
    function newSheet() { cur = { w: W, h: 0, items: [], rows: [] }; sheets.push(cur); y = TOP; }
    newSheet();
    groups.forEach(function (g) {
      var i = 0;
      while (i < g.runs.length) {
        if (y + GH + ROW > maxH && cur.rows.length) newSheet();
        var room = Math.max(1, Math.floor((maxH - y - GH) / ROW));
        var take = g.runs.slice(i, i + room); i += take.length;
        cur.rows.push({ group: g, runs: take, y: y, cont: i - take.length > 0 });
        y += GH + take.length * ROW + 10;
        cur.h = Math.max(cur.h, y);
      }
    });
    sheets.forEach(function (sh, si) {
      var d = L();
      // column heads
      [['SUPPLY', cx.sup], ['PSU / DRIVER', cx.psu], ['DECODER / CONTROLLER', cx.dec], ['LED STRIP RUN', cx.run]].forEach(function (h) { d.text(h[1], 12, h[0], { size: 7, muted: true, track: 1.4 }); });
      d.line([[0, 22], [W, 22]], null, { frame: true });
      sh.rows.forEach(function (blk) {
        var g = blk.group, gy = blk.y;
        d.rect(0, gy, W, GH - 6, { group: true });
        d.text(8, gy + 8, g.title + (blk.cont ? '  (continued)' : ''), { size: 8, bold: true, track: 0.8 });
        var y0 = gy + GH, decSpans = {}, busX = cx.dec - 16, busTop = null, busBot = null, busWire = 'dmx';
        blk.runs.forEach(function (e, k) {
          var ry = y0 + k * ROW, mid = ry + ROW / 2 - 4, triac = e.control === 'triac';
          // supply
          var sp = spurOf[e.id], ci = circOf[e.id], supTxt, supSub, supWire = triac ? 'dimmed' : 'mains';
          if (e.location === 'head-end') { supTxt = triac ? 'Dimmed feed ' + ((ci && ci.id) || '') : 'Radial ' + ((ci && ci.id) || 'C1'); supSub = triac ? 'lighting control ch.' : (e.headEnd || '') + ' · 10 A type C'; }
          else { var pl = sp && sp.localSupply === 'plug', fz = sp && sp.fuse_a ? sp.fuse_a + ' A' : ''; supTxt = (pl ? (triac ? 'Dimmed socket' : 'Socket 13 A') : (triac ? 'Dimmed FCU' : 'FCU')) + (fz && !(sp.fuse_std === 'circuit') ? ' · ' + fz : ''); supSub = (pl ? 'plug-in · ' + (sp.fuse_std === 'circuit' ? 'no plug fuse' : fz + ' plug fuse') : 'fused spur · ' + fz + ' fuse') + ' · ' + (e.room || ''); }   // FCU or plug-in, with its fuse
          d.rect(cx.sup, ry + 4, bw.sup, ROW - 16, { box: true });
          d.text(cx.sup + 6, ry + 9, supTxt, { size: 7.4, bold: true });
          d.text(cx.sup + 6, ry + 20, short(supSub, 26), { size: 6.4, muted: true });
          // PSU
          var dr = e.driver || {}, pl = dr.drivers ? ((dr.drivers > 1 ? dr.drivers + ' no. ' : '') + dr.driver_w + ' W ' + (triac ? 'triac' : 'CV') + ' PSU') : 'no driver';
          d.rect(cx.psu, ry + 4, bw.psu, ROW - 16, { box: true });
          d.text(cx.psu + 6, ry + 9, pl, { size: 7.4, bold: true });
          d.text(cx.psu + 6, ry + 20, short(dr.product ? prodShort(dr.product.label) : 'generic size — no Library match', 40), { size: 6.2, muted: true });
          d.line([[cx.sup + bw.sup, mid], [cx.psu, mid]], supWire);
          // decoder / pixel controller / straight through
          if (e.decoder) {
            var z = decSpans[e.decoder.zone] = decSpans[e.decoder.zone] || { top: ry + 4, bot: ry + ROW - 12, dec: e.decoder, runs: [] };
            z.bot = ry + ROW - 12; z.runs.push({ e: e, mid: mid });
          } else if (e.pixel) {
            d.rect(cx.dec, ry + 4, bw.dec, ROW - 16, { box: true });
            d.text(cx.dec + 6, ry + 9, 'Pixel ctrl ' + (e.pixel.output || ''), { size: 7.4, bold: true });
            d.text(cx.dec + 6, ry + 20, short(e.pixel.controller || '', 32), { size: 6.2, muted: true });
            d.line([[cx.psu + bw.psu, mid], [cx.dec, mid]], 'lv');
            d.line([[cx.dec + bw.dec, mid], [cx.run, mid]], 'data');
            d.line([[busX, mid + 6], [cx.dec, mid + 6]], 'data'); busTop = busTop == null ? mid + 6 : Math.min(busTop, mid + 6); busBot = Math.max(busBot || 0, mid + 6); d.dot(busX, mid + 6, 'data');
          } else {
            d.line([[cx.psu + bw.psu, mid], [cx.run, mid]], 'lv');
          }
          // run
          d.rect(cx.run, ry + 4, bw.run, ROW - 16, { box: true });
          d.text(cx.run + 6, ry + 9, short(e.id + '  ·  ' + (e.floor ? e.floor + ' ' : '') + (e.room || ''), 54), { size: 7.4, bold: true });
          var feeds = e.feeds || [];
          var sub = short((e.strip.product && e.strip.product.sku ? e.strip.product.sku + ' ' : '') + e.strip.label + '  ·  ' + r1(e.metres) + ' m  ·  ' + Math.round(e.load_w) + ' W  ·  ' + feeds.length + ' feed' + (feeds.length === 1 ? '' : 's') + (e.cable ? ' on ' + e.cable.csa + ' mm²' : ''), 78);
          d.text(cx.run + 6, ry + 20, sub, { size: 6.2, muted: true });
          // strip glyph with feed ticks
          var sx = cx.run + bw.run - 8 - Math.min(110, bw.run * 0.3), sw = Math.min(110, bw.run * 0.3), sy = ry + 9;
          if (sx > cx.run + bw.run * 0.55) { d.rect(sx, sy, sw, 3, { strip: true }); feeds.forEach(function (f) { var fx = sx + (e.metres ? f / e.metres : 0) * sw; d.line([[fx, sy - 2], [fx, sy + 5]], 'lv'); }); }
        });
        Object.keys(decSpans).forEach(function (k) {
          var z = decSpans[k], h = z.bot - z.top, dmxTxt = z.runs.map(function (r) { return r.e.dmx && r.e.dmx.address ? 'U' + r.e.dmx.universe + ' ' + pad3(r.e.dmx.address) : ''; }).filter(Boolean);
          d.rect(cx.dec, z.top, bw.dec, h, { box: true, accent: true });
          d.text(cx.dec + 6, z.top + 5, short((z.dec.qty > 1 ? z.dec.qty + ' no. ' : '') + z.dec.label.replace(/^Skydance\s+/i, ''), 30), { size: 7.2, bold: true });
          d.text(cx.dec + 6, z.top + 16, short((z.dec.channels ? z.dec.channels + ' ch  ·  ' : '') + (dmxTxt[0] || '') + (dmxTxt.length > 1 ? ' …' : ''), 32), { size: 6.2, muted: true });
          z.runs.forEach(function (r) { d.line([[cx.psu + bw.psu, r.mid], [cx.dec, r.mid]], 'lv'); d.line([[cx.dec + bw.dec, r.mid], [cx.run, r.mid]], 'pwm'); });
          var dy = z.top + Math.min(h / 2, 12);
          d.line([[busX, dy], [cx.dec, dy]], 'dmx'); d.dot(busX, dy, 'dmx');
          busTop = busTop == null ? dy : Math.min(busTop, dy); busBot = Math.max(busBot || 0, dy);
        });
        if (busTop != null) {
          var nl = g.head ? nodes.filter(function (n) { return (n.headEnd || (heads[0] && heads[0].id)) === g.head.id; }) : nodes;
          var nodeTxt = nl.length ? nl.map(function (n) { return n.label + (n.interface && n.interface.product ? ' (' + n.interface.product.label.split(/\s+[—-]\s+/)[0] + ')' : ''); }).join(', ') : 'DMX node';
          d.line([[busX, gy + GH - 4], [busX, busBot]], 'dmx');
          d.text(busX + 4, gy + GH - 3, short('from ' + nodeTxt, 70), { size: 6, muted: true, wire: 'dmx' });
        }
      });
      // legend + sheet number
      var lx = 0, ly = sh.h + 4;
      Object.keys(WIRE).forEach(function (k) { d.line([[lx, ly + 4], [lx + 22, ly + 4]], k); d.text(lx + 27, ly, WIRE[k].label, { size: 6.4, muted: true }); lx += 30 + WIRE[k].label.length * 3.6 + 18; });
      sh.h = ly + 14; sh.items = d.items; sh.title = 'Wiring schematic' + (sheets.length > 1 ? ' — sheet ' + (si + 1) + ' of ' + sheets.length : ''); delete sh.rows;
    });
    return { sheets: sheets.length && sheets[0].items.length ? sheets : [], wires: WIRE };
  }

  // ══ HEAD-END BOARD ELEVATION ══
  // A backboard (ply / enclosure back) at true scale: top DIN rail with the main isolator, one MCB per radial and a dimmed-feed
  // terminal per triac circuit; below, the PSUs, decoders, nodes and pixel controllers packed into mounting rows on the kit slot grid.
  function elevation(board, opts) {
    opts = opts || {}; var targetW = num(opts.width, 760);
    var items = [];
    (board.drivers || []).forEach(function (d, i) { var dm = d.dims_mm && d.dims_mm.length >= 2 ? d.dims_mm : null, f = dm || NOMINAL.driver(d.size_w); for (var q = 0; q < (d.qty || 1); q++) items.push({ id: 'psu-' + d.run + '-' + q, kind: 'psu', label: d.size_w + ' W ' + (d.control === 'triac' ? 'triac' : 'CV') + ' PSU', sub: d.run + (d.circuit ? ' · ' + d.circuit : ''), mm: [num(f[0]), num(f[1])], nominal: !dm, colour: d.control === 'triac' ? 'dimmed' : 'mains' }); });
    (board.decoders || []).forEach(function (d, i) { var f = d.dims_mm || NOMINAL.decoder; for (var q = 0; q < (d.qty || 1); q++) items.push({ id: 'dec-' + i + '-' + q, kind: 'decoder', label: short(d.label.replace(/^Skydance\s+/i, '').split(' ')[0] + ' decoder', 22), sub: short(String(d.zone || '').split(' | ').pop(), 22), mm: [num(f[0]), num(f[1])], nominal: !d.dims_mm, colour: 'dmx' }); });
    (board.nodes || []).forEach(function (n, i) { var f = n.dims_mm || NOMINAL.node; items.push({ id: 'node-' + i, kind: 'node', label: short(n.label, 18), sub: short(n.product || 'DMX node', 22), mm: [num(f[0]), num(f[1])], nominal: !n.dims_mm, colour: 'data' }); });
    if ((board.pixel || []).length) { var pc = Math.ceil(board.pixel.length / 4); for (var p = 0; p < pc; p++) items.push({ id: 'px-' + p, kind: 'pixel', label: 'Pixel controller', sub: board.pixel.slice(p * 4, p * 4 + 4).map(function (x) { return x.output; }).join(' '), mm: NOMINAL.pixel.slice(), nominal: true, colour: 'data' }); }
    var GAP = 20, MARGIN = 30, maxL = items.reduce(function (a, i) { return Math.max(a, i.mm[0]); }, 0);
    var boardW = Math.max(600, Math.ceil((maxL + GAP) * 2 / 50) * 50 + MARGIN * 2);   // at least two of the longest across
    if (items.length > 10) boardW = Math.max(boardW, 900);
    var unit = 10, size = Math.floor((boardW - MARGIN * 2) / unit), rowH = 100;
    // slot-grid items: size in 10 mm slots, gap after each item
    var gItems = items.map(function (i) { return { id: i.id, size: Math.ceil((i.mm[0] + GAP) / unit), label: i.label, weightRank: i.kind === 'psu' ? 2 : 1 }; });
    var placed = null, rows = 1;
    for (rows = 1; rows < 40; rows++) {
      var grid = { orientation: 'horizontal', rows: rows, size: size, unit: unit };
      placed = (global.SonorSlotGrid && global.SonorSlotGrid.autoLayout) ? global.SonorSlotGrid.autoLayout(grid, gItems) : firstFit(grid, gItems);
      if (!placed.some(function (i) { return i.unplaced; })) break;
    }
    var at = {}; placed.forEach(function (p) { at[p.id] = p; });
    // DIN rail on top: isolator (2 × 18 mm) + MCB per radial (18 mm) + 6 mm terminal per dimmed feed + earth / neutral bars
    var din = [{ label: 'ISO', mm: 36, kind: 'iso' }].concat((board.circuits || []).map(function (c) { return { label: c.id, mm: 18, kind: 'mcb' }; })).concat((board.dimmedFeeds || []).map(function (f) { return { label: f.id, mm: 12, kind: 'dim' }; })).concat([{ label: 'N', mm: 30, kind: 'bar' }, { label: 'E', mm: 30, kind: 'bar' }]);
    var dinNote = 'ISO main isolator · ' + (board.circuits || []).map(function (c) { return c.id + ' ' + c.mcb_a + ' A type C (' + Math.round(c.input_w) + ' W)'; }).join(' · ') + ((board.dimmedFeeds || []).length ? ' · D = dimmed-feed terminals from the lighting control (' + board.dimmedFeeds.map(function (f) { return f.id + ' ' + f.run; }).join(', ') + ')' : '') + ' · N / E bars';
    var dinH = 90, boardH = MARGIN + dinH + rows * rowH + MARGIN;
    var k = targetW / boardW, d = L(), ox = 0, oy = 38;
    var mm = function (v) { return v * k; };
    d.text(0, 0, (board.label || 'Head end') + (board.location ? '  ·  ' + board.location : ''), { size: 9, bold: true });
    d.text(0, 12, 'Backboard ' + boardW + ' × ' + boardH + ' mm  ·  ' + (board.circuits || []).length + ' radial' + ((board.circuits || []).length === 1 ? '' : 's') + ', ' + (board.dimmedFeeds || []).length + ' dimmed feed' + ((board.dimmedFeeds || []).length === 1 ? '' : 's') + '  ·  ' + Math.round(board.input_w || 0) + ' W input', { size: 7, muted: true });
    d.text(0, 23, short(dinNote, Math.floor(targetW / 3.3)), { size: 6.2, muted: true });
    d.rect(ox, oy, mm(boardW), mm(boardH), { board: true });
    // DIN rail + devices
    var rx = ox + mm(MARGIN), ry = oy + mm(MARGIN);
    d.rect(rx, ry + mm(dinH / 2 - 4), mm(boardW - MARGIN * 2), mm(8), { rail: true });
    var dx = rx; din.forEach(function (m) { var w = mm(m.mm), h = mm(m.kind === 'dim' ? 50 : 76); d.rect(dx, ry + mm((dinH - (m.kind === 'dim' ? 50 : 76)) / 2), w - 1, h, { mcb: true, kind: m.kind }); d.text(dx + 1.5, ry + mm(dinH) + 2, m.label, { size: 5.6, muted: true }); dx += w + 1; });
    // mounting rows
    for (var r = 0; r < rows; r++) { var yy = oy + mm(MARGIN + dinH + r * rowH); d.line([[rx, yy + mm(rowH) - 1], [rx + mm(boardW - MARGIN * 2), yy + mm(rowH) - 1]], null, { faint: true }); }
    items.forEach(function (i) {
      var p = at[i.id]; if (!p || p.unplaced) return;
      var x = rx + mm(p.start * unit), y = oy + mm(MARGIN + dinH + p.row * rowH + (rowH - i.mm[1]) / 2), w = mm(i.mm[0]), h = mm(i.mm[1]);
      d.rect(x, y, w, h, { item: true, wire: i.colour, nominal: i.nominal });
      var ls = Math.min(9, Math.max(6, h / 3.4)), ss = Math.min(7.5, Math.max(5.2, h / 4.6));
      d.text(x + 4, y + 4, short(i.label, Math.max(6, Math.floor(w / (ls * 0.56)))), { size: ls, bold: true });
      if (h > ls * 2.4) d.text(x + 4, y + 6 + ls, short(i.sub + (i.nominal ? ' · nominal' : ''), Math.max(6, Math.floor(w / (ss * 0.52)))), { size: ss, muted: true });
    });
    // overall dimensions
    var by = oy + mm(boardH) + 10;
    d.line([[ox, by], [ox + mm(boardW), by]], null, { dim: true }); d.text(ox + mm(boardW) / 2 - 20, by + 3, boardW + ' mm', { size: 6.4, muted: true });
    var bx = ox + mm(boardW) + 8;
    d.line([[bx, oy], [bx, oy + mm(boardH)]], null, { dim: true }); d.text(bx + 4, oy + mm(boardH) / 2, boardH + ' mm', { size: 6.4, muted: true });
    return { w: Math.max(targetW + 60, mm(boardW) + 60), h: oy + mm(boardH) + 24, items: d.items, mm: [boardW, boardH], board: board, title: (board.label || 'Head end') + ' — board elevation', placedVia: (global.SonorSlotGrid && global.SonorSlotGrid.autoLayout) ? 'kit slot grid' : 'built-in first-fit' };
  }
  function firstFit(grid, items) {   // offline twin of SonorSlotGrid.autoLayout (horizontal)
    var out = [], loose = items.slice().sort(function (a, b) { return (b.weightRank || 0) - (a.weightRank || 0) || b.size - a.size; });
    loose.forEach(function (it) {
      for (var row = 0; row < grid.rows; row++) for (var s = 0; s + it.size <= grid.size; s++) {
        if (!out.some(function (o) { return o.row === row && s < o.start + o.size && o.start < s + it.size; })) { out.push(Object.assign({}, it, { start: s, row: row })); return; }
      }
      out.push(Object.assign({}, it, { start: -1, row: 0, unplaced: true }));
    });
    return out;
  }

  // ══ PAINTERS ══
  function hex(c) { return typeof c === 'string' ? c : 'rgb(' + c.join(',') + ')'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function styleOf(it, T, theme) {
    var o = it.o || {}, wire = it.wire || o.wire;
    if (it.t === 'rect') {
      if (o.group) return { fill: T.group, stroke: null };
      if (o.board) return { fill: T.board, stroke: T.boxLine, sw: 0.8 };
      if (o.rail) return { fill: T.rail, stroke: null };
      if (o.mcb) return { fill: o.kind === 'dim' ? WIRE.dimmed[theme] : T.mcb, stroke: T.boxLine, sw: 0.5 };
      if (o.strip) return { fill: T.accent, stroke: null };
      if (o.item) return { fill: T.box, stroke: WIRE[wire] ? WIRE[wire][theme] : T.boxLine, sw: 1, dash: o.nominal ? [3, 2] : null };
      return { fill: T.box, stroke: o.accent ? WIRE.dmx[theme] : T.boxLine, sw: o.accent ? 1 : 0.7 };
    }
    if (it.t === 'line') { if (!wire) return { stroke: o.dim ? T.muted : (o.faint ? T.frame : T.frame), sw: o.dim ? 0.5 : 0.6, dash: o.faint ? [2, 3] : null }; var w = WIRE[wire]; return { stroke: w[theme], sw: w.w, dash: w.dash || null }; }
    return {};
  }
  function toSvg(sheet, opts) {
    opts = opts || {}; var theme = opts.theme === 'paper' ? 'paper' : 'dark', T = THEME[theme], pad = opts.pad == null ? 12 : opts.pad;
    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + (-pad) + ' ' + (-pad) + ' ' + (sheet.w + pad * 2) + ' ' + (sheet.h + pad * 2) + '" font-family="DM Sans, Gilroy, system-ui, sans-serif">';
    if (T.bg) s += '<rect x="' + (-pad) + '" y="' + (-pad) + '" width="' + (sheet.w + pad * 2) + '" height="' + (sheet.h + pad * 2) + '" fill="' + T.bg + '"/>';
    sheet.items.forEach(function (it) {
      var st = styleOf(it, T, theme), o = it.o || {};
      if (it.t === 'rect') s += '<rect x="' + it.x.toFixed(1) + '" y="' + it.y.toFixed(1) + '" width="' + Math.max(0, it.w).toFixed(1) + '" height="' + Math.max(0, it.h).toFixed(1) + '" rx="' + (o.group || o.board ? 3 : 2) + '" fill="' + (st.fill ? hex(st.fill) : 'none') + '"' + (st.stroke ? ' stroke="' + hex(st.stroke) + '" stroke-width="' + st.sw + '"' : '') + (st.dash ? ' stroke-dasharray="' + st.dash.join(' ') + '"' : '') + '/>';
      else if (it.t === 'line') s += '<polyline points="' + it.pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + '" fill="none" stroke="' + hex(st.stroke) + '" stroke-width="' + st.sw + '"' + (st.dash ? ' stroke-dasharray="' + st.dash.join(' ') + '"' : '') + '/>';
      else if (it.t === 'dot') s += '<circle cx="' + it.x.toFixed(1) + '" cy="' + it.y.toFixed(1) + '" r="2.2" fill="' + hex(WIRE[it.wire][theme]) + '"/>';
      else if (it.t === 'text') { var sz = o.size || 8, col = o.wire ? WIRE[o.wire][theme] : (o.muted ? T.muted : T.text); s += '<text x="' + it.x.toFixed(1) + '" y="' + (it.y + sz * 0.82).toFixed(1) + '" font-size="' + sz + '"' + (o.bold ? ' font-weight="700"' : '') + (o.track ? ' letter-spacing="' + o.track + '"' : '') + ' fill="' + hex(col) + '">' + esc(it.s) + '</text>'; }
    });
    return s + '</svg>';
  }
  // pdf-lib: page = PDFPage, opts = { x, top (pt from the top of the canvas), scale, H (canvas height), fonts: {b, r}, theme, safe }
  function toPdf(page, sheet, opts) {
    var PL = global.PDFLib; opts = opts || {}; var theme = opts.theme === 'dark' ? 'dark' : 'paper', T = THEME[theme], k = num(opts.scale, 1), X = num(opts.x), Y = num(opts.top), H = num(opts.H, 841.89), F = opts.fonts || {}, safe = opts.safe || function (x) { return x; };
    function rgb(c) { if (typeof c === 'string') { var h = c.replace('#', ''); c = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; } return PL.rgb(c[0] / 255, c[1] / 255, c[2] / 255); }
    function px(x) { return X + x * k; } function py(y) { return H - (Y + y * k); }
    sheet.items.forEach(function (it) {
      var st = styleOf(it, T, theme), o = it.o || {};
      if (it.t === 'rect') { var opt = { x: px(it.x), y: py(it.y + it.h), width: Math.max(0, it.w * k), height: Math.max(0, it.h * k) }; if (st.fill) opt.color = rgb(st.fill); if (st.stroke) { opt.borderColor = rgb(st.stroke); opt.borderWidth = st.sw * Math.min(1, k + 0.2); if (st.dash) opt.borderDashArray = st.dash; } if (!st.fill) opt.opacity = 0; page.drawRectangle(opt); }
      else if (it.t === 'line') { for (var i = 1; i < it.pts.length; i++) { var lo = { start: { x: px(it.pts[i - 1][0]), y: py(it.pts[i - 1][1]) }, end: { x: px(it.pts[i][0]), y: py(it.pts[i][1]) }, thickness: st.sw * Math.min(1, k + 0.2), color: rgb(st.stroke) }; if (st.dash) lo.dashArray = st.dash; page.drawLine(lo); } }
      else if (it.t === 'dot') page.drawCircle({ x: px(it.x), y: py(it.y), size: 2.2 * k, color: rgb(WIRE[it.wire][theme]) });
      else if (it.t === 'text') { var sz = (o.size || 8) * k, font = o.bold ? (F.b || F.r) : F.r; if (!font) return; var str = safe(it.s); if (o.track) { var cxp = px(it.x); for (var j = 0; j < str.length; j++) { page.drawText(str[j], { x: cxp, y: py(it.y) - sz * 0.82, size: sz, font: font, color: rgb(o.wire ? WIRE[o.wire][theme] : (o.muted ? T.muted : T.text)) }); cxp += font.widthOfTextAtSize(str[j], sz) + o.track * k; } } else page.drawText(str, { x: px(it.x), y: py(it.y) - sz * 0.82, size: sz, font: font, color: rgb(o.wire ? WIRE[o.wire][theme] : (o.muted ? T.muted : T.text)) }); }
    });
  }

  global.SonorLedDrawings = { VERSION: VERSION, WIRE: WIRE, THEME: THEME, schematic: schematic, elevation: elevation, toSvg: toSvg, toPdf: toPdf };
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
