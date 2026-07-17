/* Sonor Seating Configurator — wizard UI + plan (v0.2.0)
   SeatingApp — Layout → Choose Range → Configure → Summary.
   Consumes SonorSeating (SSOT) + SonorRecommend. MSRP only.
*/
(function (global) {
  'use strict';
  var CFG = global.__SEATING_CONFIG__ || {};
  var E, R;
  var STEPS = CFG.steps;
  var cfg = {
    step: 1,
    layout: Object.assign({ prefs: {} }, CFG.defaultRoom),
    rangeId: null, material: null, colour: null, motor: null,
    includeArmrests: true, accessories: {}, finishes: {},
    client: { name: '', project: '' }, rowOverrides: {}
  };

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmt(n) { return Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
  function money(n) { return n == null ? 'POA' : '£' + fmt(n); }
  function toast(m) { try { if (global.SonorShell) global.SonorShell.toast(m, { kind: 'ok' }); } catch (e) {} }

  async function boot() {
    E = global.SonorSeating; R = global.SonorRecommend;
    try {
      var res = await E.load();
      var note = $('sourceNote');
      if (note) { note.textContent = ({ supabase: 'Live catalogue', cache: 'Offline (cached)', seed: 'Offline (bundled)', inline: 'No data' }[E.source] || E.source) + ' · v' + (CFG.version || '?'); note.className = 'src-note src-' + E.source; }
      renderStep();
      try { if (global.SonorShell && res.db) global.SonorShell.selfTest(res.db); } catch (e) {}
    } catch (err) { var m = $('stepBody'); if (m) m.innerHTML = '<div class="empty">Failed to load catalogue: ' + esc(err && err.message) + '</div>'; }
  }

  // ── intro / wizard toggle (client-facing landing) ────────────────────────────
  function enter() {
    var intro = $('intro'), wiz = $('wizard');
    if (intro) intro.style.display = 'none';
    if (wiz) wiz.style.display = 'flex';
    cfg.step = 1; renderStep();
    global.scrollTo({ top: 0, behavior: 'auto' });
  }
  function backToIntro() {
    var intro = $('intro'), wiz = $('wizard');
    if (wiz) wiz.style.display = 'none';
    if (intro) intro.style.display = 'block';
    global.scrollTo({ top: 0, behavior: 'auto' });
  }

  // ── nav ─────────────────────────────────────────────────────────────────────
  function goNext() { if (cfg.step < STEPS.length && !nextDisabled()) { cfg.step++; renderStep(); } }
  function goBack() { if (cfg.step > 1) { cfg.step--; renderStep(); } }
  function jumpTo(n) { if (n < cfg.step) { cfg.step = n; renderStep(); } }
  function restart() { var keepClient = cfg.client; cfg = { step: 1, layout: Object.assign({ prefs: {} }, CFG.defaultRoom), rangeId: null, material: null, colour: null, motor: null, includeArmrests: true, accessories: {}, finishes: {}, client: keepClient || { name: '', project: '' }, rowOverrides: {} }; renderStep(); }
  function setClient(k, v) { cfg.client[k] = v; }
  function nextDisabled() {
    if (cfg.step === 2) return !cfg.rangeId;
    return false;
  }

  function renderStep() {
    $('stepPills').innerHTML = STEPS.map(function (l, i) {
      var n = i + 1, done = n < cfg.step, act = n === cfg.step;
      return '<div class="pill ' + (done ? 'done' : '') + ' ' + (act ? 'active' : '') + '"' + (done ? ' onclick="SeatingApp.jumpTo(' + n + ')"' : '') + '><span class="pn">' + (done ? '✓' : n) + '</span>' + l + '</div>' + (i < STEPS.length - 1 ? '<span class="parr">›</span>' : '');
    }).join('');
    var back = $('btnBack'); back.style.visibility = cfg.step > 1 ? 'visible' : 'hidden';
    var next = $('btnNext');
    if (cfg.step === STEPS.length) { next.textContent = 'Start again'; next.onclick = restart; next.disabled = false; }
    else { next.textContent = 'Continue →'; next.onclick = goNext; next.disabled = nextDisabled(); }
    if (cfg.step === 1) renderLayout();
    if (cfg.step === 2) renderRanges();
    if (cfg.step === 3) renderConfigure();
    if (cfg.step === 4) renderSummary();
    global.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Step 1 · Layout ──────────────────────────────────────────────────────────
  function renderLayout() {
    var L = cfg.layout;
    var prefBtns = (CFG.prefs || []).map(function (p) {
      return '<button class="chip ' + (L.prefs[p.id] ? 'on' : '') + '" onclick="SeatingApp.togglePref(\'' + p.id + '\')" title="' + esc(p.hint) + '">' + esc(p.label) + '</button>';
    }).join('');
    var rowP = CFG.rowOptions.map(function (n) { return '<button class="opt ' + (L.rows === n ? 'on' : '') + '" onclick="SeatingApp.setLayout(\'rows\',' + n + ')">' + n + '</button>'; }).join('');
    var spr = CFG.seatsPerRowOptions.map(function (n) { return '<button class="opt ' + (L.seatsPerRow === n ? 'on' : '') + '" onclick="SeatingApp.setLayout(\'seatsPerRow\',' + n + ')">' + n + '</button>'; }).join('');
    $('stepBody').innerHTML =
      '<div class="lead"><h2>Design your room</h2><p>Start with the space and how many seats you want. We’ll then recommend ranges that fit.</p></div>' +
      '<div class="layout-grid">' +
        '<div class="panel"><div class="ptt">Room size</div>' +
          '<label class="fld"><span>Width (m)</span><input type="number" step="0.1" min="1.5" value="' + (L.widthMm / 1000) + '" oninput="SeatingApp.setLayout(\'widthMm\', Math.round(this.value*1000))"></label>' +
          '<label class="fld"><span>Length (m)</span><input type="number" step="0.1" min="2" value="' + (L.lengthMm / 1000) + '" oninput="SeatingApp.setLayout(\'lengthMm\', Math.round(this.value*1000))"></label>' +
          '<div class="hint" id="fitHint"></div>' +
        '</div>' +
        '<div class="panel"><div class="ptt">Seating</div>' +
          '<div class="lbl">Rows</div><div class="opts">' + rowP + '</div>' +
          '<div class="lbl">Seats per row</div><div class="opts">' + spr + '</div>' +
          '<div class="lbl">Total seats</div><div class="big" id="totalSeats"></div>' +
        '</div>' +
        '<div class="panel"><div class="ptt">Preferences <span class="opt-tag">optional</span></div>' +
          '<div class="chips">' + prefBtns + '</div>' +
          '<div class="hint">We’ll flag ranges that don’t offer what you pick (e.g. no daybed).</div>' +
        '</div>' +
      '</div>' +
      '<div class="roomview" id="roomView"></div>';
    updateLayoutDerived();
  }
  function setLayout(k, v) { cfg.layout[k] = v; if (k === 'rows' || k === 'seatsPerRow') renderLayout(); else updateLayoutDerived(); }
  function togglePref(id) { cfg.layout.prefs[id] = !cfg.layout.prefs[id]; renderLayout(); }
  function updateLayoutDerived() {
    var L = cfg.layout, total = L.rows * L.seatsPerRow;
    if ($('totalSeats')) $('totalSeats').textContent = total;
    var usable = L.widthMm - 300;
    if ($('fitHint')) $('fitHint').innerHTML = 'Usable width ≈ <b>' + (usable / 1000).toFixed(1) + 'm</b> (allowing 150mm each side).';
    if ($('roomView')) $('roomView').innerHTML = roomSVG(L);
  }

  // ── Step 2 · Choose Range ────────────────────────────────────────────────────
  var _bestId = null;
  function renderRanges() {
    var ranked = R.rank(cfg.layout);
    var fitCount = ranked.filter(function (x) { return x.fits; }).length;
    _bestId = (ranked.find(function (x) { return x.fits; }) || ranked[0] || {}).range && (ranked.find(function (x) { return x.fits; }) || ranked[0]).range.id;
    // group by manufacturer, preserving fit order (first appearance = best-fit-first)
    var groups = {}, order = [];
    ranked.forEach(function (x) { var m = x.range.manufacturer; if (!groups[m]) { groups[m] = []; order.push(m); } groups[m].push(x); });
    var sections = order.map(function (m) {
      var items = groups[m];
      var logo = items.map(function (it) { return (it.range.metadata || {}).manufacturer_logo; }).find(Boolean) || null;
      var head = logo
        ? '<img class="mfr-logo" src="' + esc(logo) + '" alt="' + esc(m) + '" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'\'"><span class="mfr-word" style="display:none">' + esc(m) + '</span>'
        : '<span class="mfr-word">' + esc(m) + '</span>';
      var nFit = items.filter(function (x) { return x.fits; }).length;
      return '<section class="mfr-sec"><div class="mfr-head">' + head +
        '<span class="mfr-count">' + items.length + ' range' + (items.length !== 1 ? 's' : '') + (nFit ? ' · ' + nFit + ' fit' : '') + '</span></div>' +
        '<div class="range-grid">' + items.map(rangeCard).join('') + '</div></section>';
    }).join('');
    $('stepBody').innerHTML =
      '<div class="lead"><h2>Recommended ranges</h2><p>' + fitCount + ' of ' + ranked.length + ' ranges suit a ' + cfg.layout.seatsPerRow + '-across, ' + cfg.layout.rows + '-row layout in your ' + (cfg.layout.widthMm / 1000).toFixed(1) + 'm room. Grouped by manufacturer, ranked by fit.</p></div>' +
      sections;
  }
  function rangeCard(x) {
    var r = x.range, sel = cfg.rangeId === r.id;
    var from = E.fromPrice(r);
    var badge = r.id === _bestId && x.fits ? '<span class="rec">Best fit</span>' : (x.fits ? '<span class="fit">Fits</span>' : '<span class="nofit">Tight fit</span>');
    var flags = x.flags.map(function (f) { return '<span class="flag ' + f.kind + '">' + (f.kind === 'warn' ? '⚠ ' : '') + esc(f.text) + '</span>'; }).join('');
    var plus = x.plus.slice(0, 3).map(function (p) { return '<span class="plus">✓ ' + esc(p) + '</span>'; }).join('');
    var img = r.hero_img ? '<div class="rc-img" style="background-image:url(\'' + esc(r.hero_img) + '\')"></div>' : '<div class="rc-img rc-noimg">' + esc(r.manufacturer) + '</div>';
    return '<div class="rcard ' + (sel ? 'sel' : '') + ' ' + (x.fits ? '' : 'dim') + '" onclick="SeatingApp.pickRange(\'' + r.id + '\')">' +
      img +
      '<div class="rc-b">' +
        '<div class="rc-top"><div><div class="rc-mfr">' + esc(r.manufacturer) + '</div><div class="rc-name">' + esc(r.name) + '</div></div>' + badge + '</div>' +
        (r.style ? '<div class="rc-style">' + esc(r.style) + '</div>' : '') +
        '<div class="rc-price">' + (from != null ? 'From <b>' + money(from) + '</b> / seat' : '<b>MSRP on request</b>') + '</div>' +
        (plus ? '<div class="rc-plus">' + plus + '</div>' : '') +
        (flags ? '<div class="rc-flags">' + flags + '</div>' : '') +
      '</div></div>';
  }
  function pickRange(id) {
    cfg.rangeId = id; cfg.material = null; cfg.colour = null; cfg.motor = null; cfg.accessories = {}; cfg.rowOverrides = {};
    var r = E.range(id); var mats = r.materials || [];
    if (mats.length) { cfg.material = mats[0].id; if ((mats[0].colours || []).length) cfg.colour = mats[0].colours[0].name; }
    var motors = E.motorOptions(r); cfg.motor = motors[0] || null;
    renderStep(); if (cfg.step === 2) { document.querySelectorAll('.rcard').forEach(function (c) { c.classList.remove('sel'); }); goNext(); }
  }

  // ── Step 3 · Configure ───────────────────────────────────────────────────────
  function renderConfigure() {
    var r = E.range(cfg.rangeId); if (!r) { cfg.step = 2; return renderStep(); }
    var motors = E.motorOptions(r);
    var matHtml = materialsHtml(r);
    var finHtml = finishesHtml();
    var motorHtml = motors.length > 1 ? '<div class="panel"><div class="ptt">Recline</div><div class="opts">' +
      motors.map(function (mt) { return '<button class="opt ' + (cfg.motor === mt ? 'on' : '') + '" onclick="SeatingApp.setMotor(\'' + mt + '\')">' + esc((CFG.motorLabels || {})[mt] || mt) + '</button>'; }).join('') + '</div></div>' : '';
    var accs = E.accessoryItems(cfg.rangeId);
    var accHtml = accs.length ? '<div class="panel"><div class="ptt">Choose your accessories</div>' + accs.map(function (it) {
      var q = cfg.accessories[it.id] || 0, s = E.itemSell(it);
      return '<div class="acc"><div><div class="acc-n">' + esc(it.label) + '</div><div class="acc-p">' + (s != null ? money(s) + ' each' : 'POA') + '</div></div>' +
        '<div class="qty"><button onclick="SeatingApp.acc(\'' + it.id + '\',-1)">−</button><span id="q_' + it.id + '">' + q + '</span><button onclick="SeatingApp.acc(\'' + it.id + '\',1)">+</button></div></div>';
    }).join('') + '</div>'
      : '<div class="panel"><div class="ptt">Choose your accessories</div><div class="hint">Wine trays, ottomans and other extras for this range are specified and priced at quotation — ask us what\'s available.</div></div>';
    var arm = E.armrestItems(cfg.rangeId).length ? '<div class="panel"><div class="ptt">Armrests</div><label class="toggle"><input type="checkbox" ' + (cfg.includeArmrests ? 'checked' : '') + ' onchange="SeatingApp.toggleArm(this.checked)"> Include separate armrests (1 per seat + row ends)</label></div>' : '';

    $('stepBody').innerHTML =
      '<div class="lead"><h2>Configure your ' + esc(r.name) + '</h2><p>' + esc(r.manufacturer) + (r.style ? ' · ' + esc(r.style) : '') + '</p></div>' +
      '<div class="cfg-grid"><div class="cfg-left">' +
        '<div class="panel"><div class="ptt">Layout</div><div class="lbl">Seats per row</div><div class="opts">' +
          CFG.seatsPerRowOptions.map(function (n) { return '<button class="opt ' + (cfg.layout.seatsPerRow === n ? 'on' : '') + '" onclick="SeatingApp.setLayout2(\'seatsPerRow\',' + n + ')">' + n + '</button>'; }).join('') +
          '</div><div class="lbl">Rows</div><div class="opts">' +
          CFG.rowOptions.map(function (n) { return '<button class="opt ' + (cfg.layout.rows === n ? 'on' : '') + '" onclick="SeatingApp.setLayout2(\'rows\',' + n + ')">' + n + '</button>'; }).join('') +
          '</div></div>' + motorHtml + matHtml + finHtml + arm + accHtml +
        '</div>' +
        '<div class="cfg-right"><div class="panel sticky"><div class="ptt">Your cinema</div><div id="planWrap"></div>' +
          '<div id="liveTotal" class="live"></div></div></div>' +
      '</div>';
    updateLive();
  }
  // ── Cineca-style upholstery: grouped leather/fabric with tier, availability, upcharge ──
  var GROUP_ORDER = ['leather', 'fabric', 'velvet', 'alcantara'];
  function groupLabel(k) { return { leather: 'Leather', fabric: 'Fabric', velvet: 'Velvet', alcantara: 'Alcantara' }[k] || (k ? k.charAt(0).toUpperCase() + k.slice(1) : 'Fabric'); }
  function materialsHtml(r) {
    var mats = r.materials || [];
    if (!mats.length) {
      return '<div class="panel"><div class="ptt">Upholstery</div><div class="hint">Fabric &amp; leather grades for this range are confirmed at quotation.</div></div>';
    }
    var from = E.fromPrice(r);
    var groups = {}, order = [];
    mats.forEach(function (m) { var g = m.groupKey || 'fabric'; if (!groups[g]) { groups[g] = []; order.push(g); } groups[g].push(m); });
    order.sort(function (a, b) { var ia = GROUP_ORDER.indexOf(a), ib = GROUP_ORDER.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
    var secs = order.map(function (g) {
      var cards = groups[g].map(function (m) {
        var sel = cfg.material === m.id, avail = m.available !== false;
        var price = (from != null && avail) ? from * (1 + (m.upcharge || 0) / 100) : null;
        var meta = groupLabel(g) + (m.tierLabel ? ' · ' + m.tierLabel : '');
        var body = !avail
          ? '<div class="mc-un">Not available for ' + esc(r.name) + '</div>'
          : (price != null ? '<div class="mc-price">Seat from <b>' + money(Math.round(price)) + '</b></div>' : '<div class="mc-price">MSRP on request</div>') +
            (m.upcharge > 0 ? '<div class="mc-up">⚠ +' + m.upcharge + '% upgrade</div>' : '') +
            (m.colours && m.colours.length ? '<div class="mc-col">' + m.colours.length + ' colourways</div>' : '');
        return '<button class="mcard ' + (sel ? 'on' : '') + (avail ? '' : ' off') + '"' + (avail ? ' onclick="SeatingApp.setMaterial(\'' + m.id + '\')"' : ' disabled') + '>' +
          '<div class="mc-top"><span class="mc-sw" style="--c:' + esc(m.swatch || '#888') + '"></span><div class="mc-name">' + esc(m.name) + '</div></div>' +
          '<div class="mc-meta">' + esc(meta) + '</div>' + body + '</button>';
      }).join('');
      return '<div class="mgrp"><div class="lbl">' + groupLabel(g) + '</div><div class="mat-grid">' + cards + '</div></div>';
    }).join('');
    return '<div class="panel"><div class="ptt">Upholstery</div>' + secs + colourHtml(r) + '</div>';
  }
  // colour-name → hex fallback (many library colourways have no hex filed yet)
  var COLOUR_WORDS = [
    ['anthracite', '#3a3c3e'], ['charcoal', '#37393b'], ['graphite', '#4a4c4e'], ['black', '#141416'], ['onyx', '#1c1c20'],
    ['white', '#e9e6df'], ['ivory', '#e8e2d2'], ['cream', '#e5dcc6'], ['linen', '#ddd3bc'], ['beige', '#cfc0a2'], ['sand', '#c9b791'], ['stone', '#b3aa98'], ['taupe', '#9a8d7b'],
    ['chocolate', '#4a352a'], ['espresso', '#3d2c22'], ['brown', '#5d4632'], ['walnut', '#5a4230'], ['chestnut', '#6b4630'], ['cognac', '#8a512e'], ['tan', '#a97e50'], ['camel', '#b08a56'], ['caramel', '#a9713d'], ['tobacco', '#71512f'], ['mocha', '#6b5340'],
    ['bordeaux', '#5c1f2c'], ['burgundy', '#5e1e2b'], ['wine', '#63212f'], ['merlot', '#5a1f2e'], ['crimson', '#8e2230'], ['scarlet', '#a02532'], ['cherry', '#8c1f2c'], ['red', '#8e2230'], ['brick', '#8a4032'],
    ['terracotta', '#a3573a'], ['rust', '#96502f'], ['copper', '#a05f34'], ['orange', '#b06232'], ['amber', '#b07a35'],
    ['mustard', '#a9862f'], ['gold', '#a98b3f'], ['yellow', '#b59a3a'], ['ochre', '#a67e33'],
    ['olive', '#5f6136'], ['sage', '#7c8468'], ['forest', '#2c4a34'], ['emerald', '#1f5c44'], ['racing', '#1f4a35'], ['green', '#3d5c42'], ['moss', '#5a6140'], ['pistachio', '#96a06c'],
    ['teal', '#1f5c62'], ['petrol', '#1e4c58'], ['turquoise', '#2c7f88'], ['aqua', '#3e8b93'],
    ['navy', '#1d2a4a'], ['midnight', '#1a2138'], ['royal', '#25407f'], ['cobalt', '#2a4a9c'], ['denim', '#3a5578'], ['sky', '#7796b5'], ['steel', '#5f7186'], ['blue', '#2e4a72'],
    ['aubergine', '#42283f'], ['plum', '#57324f'], ['violet', '#5a3d78'], ['purple', '#5c3a72'], ['lavender', '#8a7ba5'], ['lilac', '#9a8ab0'], ['mauve', '#8a6f85'],
    ['magenta', '#8e2f63'], ['fuchsia', '#a03370'], ['pink', '#b06a86'], ['rose', '#a55f6e'], ['blush', '#c39a99'],
    ['pewter', '#77797c'], ['silver', '#a5a7aa'], ['dove', '#a8a7a2'], ['ash', '#8f9294'], ['smoke', '#6f7276'], ['slate', '#5a6672'], ['grey', '#75777a'], ['gray', '#75777a'], ['mink', '#8d7f72'], ['mushroom', '#a0937f']
  ];
  function guessHex(name) {
    var n = String(name || '').toLowerCase();
    // earliest keyword in the name wins ("White Onyx" → white, "Onyx Black" → onyx)
    var bestPos = 1e9, bestHex = null;
    for (var i = 0; i < COLOUR_WORDS.length; i++) {
      var p = n.indexOf(COLOUR_WORDS[i][0]);
      if (p >= 0 && p < bestPos) { bestPos = p; bestHex = COLOUR_WORDS[i][1]; }
    }
    if (bestHex) return bestHex;
    // deterministic muted fallback from the name (never an empty circle)
    var h = 0; for (var j = 0; j < n.length; j++) h = (h * 31 + n.charCodeAt(j)) % 360;
    return 'hsl(' + h + ',22%,38%)';
  }
  function colourHtml(r) {
    var m = (r.materials || []).find(function (x) { return x.id === cfg.material; });
    var cols = (m && m.colours) || [];
    if (!cols.length) return '';
    return '<div class="colsel"><div class="lbl">Colour — ' + esc(m.name) + ' <span class="opt-tag">' + cols.length + ' colourways</span></div><div class="cols">' + cols.map(function (c) {
      var hx = c.hex || guessHex(c.name);
      return '<button class="col ' + (cfg.colour === c.name ? 'on' : '') + '" title="' + esc(c.name) + '" aria-label="' + esc(c.name) + '" style="--c:' + esc(hx) + '" onclick="SeatingApp.setColour(' + JSON.stringify(c.name).replace(/"/g, '&quot;') + ')"></button>';
    }).join('') + '</div><div class="hint" id="colName">' + (cfg.colour ? 'Selected: <b style="color:var(--cream)">' + esc(cfg.colour) + '</b> · ' : '') + 'Hover a swatch for its name — samples on request.</div></div>';
  }
  function finishesHtml() {
    var fins = CFG.finishOptions || []; if (!fins.length) return '';
    return '<div class="panel"><div class="ptt">Finish options <span class="opt-tag">optional</span></div>' + fins.map(function (f) {
      var on = !!cfg.finishes[f.id];
      return '<label class="fin"><input type="checkbox" ' + (on ? 'checked' : '') + ' onchange="SeatingApp.toggleFinish(\'' + f.id + '\',this.checked)"><span class="fin-b"><span class="fin-n">' + esc(f.label) + '</span><span class="fin-d">' + esc(f.note) + '</span></span></label>';
    }).join('') + '<div class="hint">Finish upgrades are confirmed and priced with the supplier at quotation.</div></div>';
  }
  function catFinish(r) { var it = E.seatItems(r.id)[0]; return it && it.finish; }
  function materialUpcharge() { var r = E.range(cfg.rangeId); var m = ((r && r.materials) || []).find(function (x) { return x.id === cfg.material; }); return m ? (m.upcharge || 0) : 0; }
  function setMaterial(id) { cfg.material = id; var r = E.range(cfg.rangeId); var m = (r.materials || []).find(function (x) { return x.id === id; }); cfg.colour = m && (m.colours || [])[0] ? m.colours[0].name : null; renderConfigure(); }
  function setColour(n) { cfg.colour = n; renderConfigure(); }
  function toggleFinish(id, v) { cfg.finishes[id] = v; updateLive(); }
  function selectedFinishes() { return (CFG.finishOptions || []).filter(function (f) { return cfg.finishes[f.id]; }); }
  function setMotor(mt) { cfg.motor = mt; updateLive(); document.querySelectorAll('.cfg-left .opt').forEach(function () {}); renderConfigure(); }
  function setLayout2(k, v) { cfg.layout[k] = v; renderConfigure(); }
  function toggleArm(v) { cfg.includeArmrests = v; updateLive(); }
  function acc(id, d) { var m = itemById(id); var max = (CFG.accMax && CFG.accMax[accType(m)]) || (CFG.accMax && CFG.accMax._default) || 8; cfg.accessories[id] = Math.max(0, Math.min(max, (cfg.accessories[id] || 0) + d)); var el = $('q_' + id); if (el) el.textContent = cfg.accessories[id]; updateLive(); }
  function accType(it) { var l = (it.label || '').toLowerCase(); return /chaise/.test(l) ? 'chaise' : '_default'; }

  // ── quote build (MSRP) ──────────────────────────────────────────────────────
  function primarySeat() {
    var seats = E.seatItems(cfg.rangeId);
    if (!seats.length) return null;
    if (cfg.motor) { var m = seats.find(function (s) { var l = (s.label || '').toLowerCase(); return (cfg.motor === '2motor' && /2-?motor/.test(l)) || (cfg.motor === '1motor' && /1-?motor/.test(l)) || (cfg.motor === 'fixed' && /fixed|non-reclin/.test(l)); }); if (m) return m; }
    // cheapest priced seat, else first
    var priced = seats.filter(function (s) { return s.sell_price_gbp != null; }).sort(function (a, b) { return a.sell_price_gbp - b.sell_price_gbp; });
    return priced[0] || seats[0];
  }
  function itemById(id) { return E.itemsOf(cfg.rangeId).find(function (i) { return i.id === id; }); }
  // ── per-row overrides (different seats / finishes per row, edited at the end) ─
  function hasRowOverrides() { return Object.keys(cfg.rowOverrides).some(function (k) { var o = cfg.rowOverrides[k]; return o && (o.seatId || o.material || o.colour); }); }
  function rowConfig(rowIdx) {
    var o = cfg.rowOverrides[rowIdx] || {};
    var r = E.range(cfg.rangeId);
    var seat = o.seatId ? itemById(o.seatId) : primarySeat();
    var matId = o.material || cfg.material;
    var mat = ((r && r.materials) || []).find(function (x) { return x.id === matId; }) || null;
    var colour = o.material ? (o.colour || (mat && (mat.colours || [])[0] ? mat.colours[0].name : null)) : (o.colour || cfg.colour);
    return { seat: seat, mat: mat, colour: colour, upcharge: mat ? (mat.upcharge || 0) : 0 };
  }
  function rowSet(rowIdx, key, val) {
    var o = cfg.rowOverrides[rowIdx] = cfg.rowOverrides[rowIdx] || {};
    o[key] = val || null;
    if (key === 'material') o.colour = null;      // colour follows the material
    renderSummary();
  }
  function rowsReset() { cfg.rowOverrides = {}; renderSummary(); }

  function quoteLines() {
    var lines = [], total = cfg.layout.rows * cfg.layout.seatsPerRow;
    var globalUp = 1 + materialUpcharge() / 100;
    if (hasRowOverrides()) {
      for (var ri = 0; ri < cfg.layout.rows; ri++) {
        var rc = rowConfig(ri);
        if (!rc.seat) continue;
        var u = E.itemSell(rc.seat), up2 = 1 + (rc.upcharge || 0) / 100;
        var lbl = 'Row ' + (ri + 1) + ' — ' + rc.seat.label + (rc.mat ? ' · ' + rc.mat.name + (rc.colour ? ' (' + rc.colour + ')' : '') : '');
        lines.push({ label: lbl, qty: cfg.layout.seatsPerRow, unit: u != null ? Math.round(u * up2) : null });
      }
    } else {
      var seat = primarySeat();
      if (seat) { var su = E.itemSell(seat); lines.push({ label: seat.label, qty: total, unit: su != null ? Math.round(su * globalUp) : null }); }
    }
    var arms = E.armrestItems(cfg.rangeId);
    if (cfg.includeArmrests && arms.length) { var a = arms[0]; var au = E.itemSell(a); lines.push({ label: a.label, qty: total + cfg.layout.rows, unit: au != null ? Math.round(au * globalUp) : null }); }
    Object.keys(cfg.accessories).forEach(function (id) { var q = cfg.accessories[id]; if (!q) return; var it = itemById(id); if (it) lines.push({ label: it.label, qty: q, unit: E.itemSell(it) }); });
    return lines;
  }
  // ── VAT ──
  function vatRate() { return CFG.vatRate || 0; }
  function vatBreakdown(net) { var v = net * vatRate(); return { net: net, vat: v, gross: net + v }; }
  // ── delivery + lead time (per manufacturer) ──────────────────────────────────
  function productTotal(lines) { return lines.reduce(function (s, l) { return s + (l.unit || 0) * l.qty; }, 0); }
  function deliveryInfo() {
    var r = E.range(cfg.rangeId); if (!r) return { cost: null, lead: null };
    var lines = quoteLines(), seats = cfg.layout.rows * cfg.layout.seatsPerRow, sub = productTotal(lines);
    return { cost: E.deliveryCost(r.manufacturer, { seats: seats, orderTotal: sub }), lead: E.leadWeeks(r.manufacturer) };
  }
  function leadText(lead) { return lead ? (lead[0] === lead[1] ? lead[0] + ' weeks' : lead[0] + '–' + lead[1] + ' weeks') : null; }
  // installation: base £ for the first seat + increment × base per additional seat
  function installCost() {
    var I = CFG.installation; if (!I || I.baseGbp == null) return null;
    var seats = cfg.layout.rows * cfg.layout.seatsPerRow;
    return Math.round(I.baseGbp * (1 + Math.max(0, seats - 1) * (I.incrementFactor || 0)));
  }
  function grandTotal(lines, di) { return productTotal(lines) + ((di && di.cost) || 0) + (installCost() || 0); }

  function updateLive() {
    var lines = quoteLines(), any = lines.some(function (l) { return l.unit != null; });
    var di = deliveryInfo(), total = grandTotal(lines, di);
    var poa = lines.some(function (l) { return l.unit == null; });
    $('planWrap').innerHTML = planSVG();
    var inst = installCost();
    var extra = di.cost != null
      ? '<div class="lt-sub">Incl. ' + esc((CFG.deliveryLabel || 'Delivery').toLowerCase()) + ' ' + money(di.cost) + (inst != null ? ' &amp; installation ' + money(inst) : '') + (leadText(di.lead) ? ' · lead time ' + leadText(di.lead) : '') + '</div>'
      : (leadText(di.lead) ? '<div class="lt-sub">Lead time ' + leadText(di.lead) + '</div>' : '<div class="lt-sub">Delivery &amp; lead time confirmed at quotation</div>');
    var vb = vatBreakdown(total);
    $('liveTotal').innerHTML = '<div class="lt-row"><span>Estimated MSRP</span><b>' + (any ? money(total) + (poa ? ' + POA' : '') : 'On request') + '</b></div><div class="lt-sub">ex VAT' + (any ? ' · inc VAT ' + money(Math.round(vb.gross)) : '') + ' — indicative</div>' + extra;
  }

  // ── Step 4 · Summary ─────────────────────────────────────────────────────────
  function renderSummary() {
    var r = E.range(cfg.rangeId); if (!r) { cfg.step = 2; return renderStep(); }
    var lines = quoteLines(), prod = productTotal(lines);
    var di = deliveryInfo(), inst = installCost(), total = prod + (di.cost || 0) + (inst || 0);
    var anyPriced = lines.some(function (l) { return l.unit != null; });
    var lt = leadText(di.lead);
    var delLbl = CFG.deliveryLabel || 'Delivery';
    var mat = (r.materials || []).find(function (m) { return m.id === cfg.material; });
    var vb = vatBreakdown(total);
    var fins = selectedFinishes();
    var finNote = fins.length ? '<div class="disc">Selected finish upgrades: <b style="color:var(--gold2)">' + fins.map(function (f) { return esc(f.label); }).join(', ') + '</b> — confirmed and priced with the supplier at quotation.</div>' : '';
    var deliveryRow = di.cost != null
      ? '<tr><td>' + esc(delLbl) + '</td><td>1</td><td class="r">' + money(di.cost) + '</td><td class="r">' + money(di.cost) + '</td></tr>'
      : '<tr><td>' + esc(delLbl) + '</td><td>1</td><td class="r">—</td><td class="r">On request</td></tr>';
    $('stepBody').innerHTML =
      '<div class="summary">' +
        '<div class="sm-head"><div><div class="sm-mfr">' + esc(r.manufacturer) + '</div><h2>' + esc(r.name) + '</h2></div><div class="sm-date">' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) + '</div></div>' +
        '<div class="client-row">' +
          '<label class="cfld"><span>Client</span><input type="text" placeholder="Client name" value="' + esc(cfg.client.name) + '" oninput="SeatingApp.setClient(\'name\', this.value)"></label>' +
          '<label class="cfld"><span>Project</span><input type="text" placeholder="Project / address" value="' + esc(cfg.client.project) + '" oninput="SeatingApp.setClient(\'project\', this.value)"></label>' +
          '<div class="cfld-hint">Shown on the proposal cover.</div>' +
        '</div>' +
        '<div class="strip">' +
          cell('Room', (cfg.layout.widthMm / 1000).toFixed(1) + 'm × ' + (cfg.layout.lengthMm / 1000).toFixed(1) + 'm') +
          cell('Layout', (cfg.layout.rows * cfg.layout.seatsPerRow) + ' seats', cfg.layout.rows + ' rows × ' + cfg.layout.seatsPerRow) +
          cell('Upholstery', mat ? esc(mat.name) : (catFinish(r) || 'TBC'), cfg.colour ? esc(cfg.colour) : '') +
          cell('Lead time', lt || 'On request', 'from order') +
          cell('Total inc VAT', anyPriced ? money(Math.round(vb.gross)) : 'On request', 'inc. delivery & VAT') +
        '</div>' +
        rowEditorHtml(r) +
        '<div class="planbig">' + planSVG(true) + '</div>' +
        '<table class="quote"><thead><tr><th>Item</th><th>Qty</th><th class="r">Unit MSRP</th><th class="r">Line MSRP</th></tr></thead><tbody>' +
          lines.map(function (l) { return '<tr><td>' + esc(l.label) + '</td><td>' + l.qty + '</td><td class="r">' + money(l.unit) + '</td><td class="r">' + (l.unit != null ? money(l.unit * l.qty) : 'POA') + '</td></tr>'; }).join('') +
          '<tr class="divrow"><td colspan="4"></td></tr>' +
          '<tr class="sub2"><td colspan="3">Products subtotal</td><td class="r">' + money(prod) + '</td></tr>' +
          deliveryRow +
          (inst != null ? '<tr><td>' + esc((CFG.installation || {}).label || 'Installation') + '</td><td>1</td><td class="r">' + money(inst) + '</td><td class="r">' + money(inst) + '</td></tr>' : '') +
          '<tr class="sub2"><td colspan="3">Subtotal (ex VAT)</td><td class="r">' + money(total) + '</td></tr>' +
          '<tr class="sub2"><td colspan="3">VAT @ ' + Math.round(vatRate() * 100) + '%</td><td class="r">' + money(Math.round(vb.vat)) + '</td></tr>' +
          '<tr class="tot"><td colspan="3">Total (inc VAT)</td><td class="r">' + money(Math.round(vb.gross)) + '</td></tr>' +
        '</tbody></table>' +
        finNote +
        '<div class="actions"><button class="btn ghost" onclick="SeatingApp.csv()">⬇ Export CSV</button><button class="btn primary" onclick="SeatingApp.savePdf()">⬇ Download PDF proposal</button></div>' +
        '<div class="disc">Indicative MSRP from the Sonor library, including ' + esc(delLbl.toLowerCase()) + (lt ? ' and a typical ' + esc(lt) + ' lead time' : '') + ' for ' + esc(r.manufacturer) + '. Final pricing, fabric grades, delivery and lead times are confirmed on a formal quotation. VAT at ' + Math.round(vatRate() * 100) + '%. <b style="color:var(--gold2)">' + esc(CFG.paymentTerms || '') + '</b>.</div>' +
      '</div>';
  }
  function cell(l, v, n) { return '<div class="cellx"><div class="cl">' + l + '</div><div class="cv">' + v + '</div>' + (n ? '<div class="cn">' + n + '</div>' : '') + '</div>'; }

  // ── per-row editor (Summary) ─────────────────────────────────────────────────
  function rowEditorHtml(r) {
    var seats = E.seatItems(cfg.rangeId);
    var mats = (r.materials || []).filter(function (m) { return m.available !== false; });
    if (seats.length < 2 && mats.length < 2) return '';   // nothing to vary
    var any = hasRowOverrides();
    var rowsHtml = '';
    for (var ri = 0; ri < cfg.layout.rows; ri++) {
      var o = cfg.rowOverrides[ri] || {}, rc = rowConfig(ri);
      var seatOpts = '<option value="">' + esc((primarySeat() || {}).label || 'Standard seat') + ' (default)</option>' +
        seats.map(function (s) { return '<option value="' + s.id + '"' + (o.seatId === s.id ? ' selected' : '') + '>' + esc(s.label) + (E.itemSell(s) != null ? ' — ' + money(E.itemSell(s)) : '') + '</option>'; }).join('');
      var matOpts = '<option value="">' + esc(cfg.material ? ((mats.find(function (m) { return m.id === cfg.material; }) || {}).name || 'As configured') : 'As configured') + ' (default)</option>' +
        mats.map(function (m) { return '<option value="' + m.id + '"' + (o.material === m.id ? ' selected' : '') + '>' + esc(m.name) + (m.upcharge > 0 ? ' (+' + m.upcharge + '%)' : '') + '</option>'; }).join('');
      var colOpts = '';
      if (rc.mat && (rc.mat.colours || []).length) {
        colOpts = '<select onchange="SeatingApp.rowSet(' + ri + ',\'colour\',this.value)"><option value="">' + esc(rc.colour || 'Colour') + '</option>' +
          rc.mat.colours.map(function (c) { return '<option' + ((o.colour || rc.colour) === c.name ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</select>';
      }
      rowsHtml += '<div class="rowed"><span class="rowed-n">Row ' + (ri + 1) + '</span>' +
        '<select onchange="SeatingApp.rowSet(' + ri + ',\'seatId\',this.value?Number(this.value):null)">' + seatOpts + '</select>' +
        '<select onchange="SeatingApp.rowSet(' + ri + ',\'material\',this.value||null)">' + matOpts + '</select>' +
        colOpts + '</div>';
    }
    return '<div class="panel" style="margin-bottom:22px"><div class="ptt">Row configuration <span class="opt-tag">optional — mix seats &amp; finishes per row</span>' +
      (any ? '<button class="rowed-reset" onclick="SeatingApp.rowsReset()">Reset all rows</button>' : '') + '</div>' +
      rowsHtml +
      '<div class="hint">Rows are priced individually when varied — the quote below updates as you change them.</div></div>';
  }

  // ── plans (SVG) ──────────────────────────────────────────────────────────────
  function roomSVG(L, big) {
    var W = big ? 640 : 420, scale = W / Math.max(L.widthMm, 3000), H = Math.max(140, Math.min(big ? 340 : 240, L.lengthMm * scale * 0.5));
    var rw = L.widthMm * scale, id = big ? 'pb' : 'pr';
    return '<svg viewBox="0 0 ' + (rw + 20) + ' ' + (H + 36) + '" width="100%" style="max-width:' + (big ? 680 : 460) + 'px;display:block">' +
      '<defs>' +
        '<linearGradient id="' + id + 'scr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c8b48e"/><stop offset="1" stop-color="#ad9978" stop-opacity="0.25"/></linearGradient>' +
        '<radialGradient id="' + id + 'amb" cx="50%" cy="0%" r="85%"><stop offset="0" stop-color="rgba(173,153,120,0.16)"/><stop offset="55%" stop-color="rgba(128,88,161,0.12)"/><stop offset="100%" stop-color="rgba(128,88,161,0)"/></radialGradient>' +
        '<linearGradient id="' + id + 'seat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a883cc"/><stop offset="1" stop-color="#66467f"/></linearGradient>' +
      '</defs>' +
      '<rect x="10" y="14" width="' + rw + '" height="' + H + '" rx="9" fill="#09070f" stroke="rgba(173,153,120,0.24)"/>' +
      '<rect x="10" y="14" width="' + rw + '" height="' + H + '" rx="9" fill="url(#' + id + 'amb)"/>' +
      '<rect x="14" y="8" width="' + (rw - 8) + '" height="7" rx="3.5" fill="url(#' + id + 'scr)"/>' +
      '<text x="' + (10 + rw / 2) + '" y="5.5" text-anchor="middle" fill="rgba(200,180,142,0.92)" font-size="6.5" letter-spacing="3.5" font-family="Gilroy,system-ui">S C R E E N</text>' +
      seatsSVG(L, 10, 26, rw, H - 16, scale, id) +
      '<text x="' + (10 + rw / 2) + '" y="' + (H + 31) + '" text-anchor="middle" fill="rgba(143,133,116,0.85)" font-size="9" font-family="Gilroy,system-ui">' + (L.widthMm / 1000).toFixed(1) + 'm wide · ' + (L.rows * L.seatsPerRow) + ' seats</text></svg>';
  }
  function seatsSVG(L, x0, y0, rw, rh, scale, id) {
    var sw = (CFG.clearance.seatFallbackWidthMm) * scale;
    if (cfg.rangeId && E) sw = E.seatWidthMm(E.range(cfg.rangeId)) * scale;
    var out = '', rows = L.rows, per = L.seatsPerRow;
    var gap = 7, seatH = Math.max(15, (rh - (rows + 1) * gap) / rows);
    for (var r = 0; r < rows; r++) {
      var totalW = per * sw + (per - 1) * 4;
      var sx = x0 + (rw - totalW) / 2, sy = y0 + gap + r * (seatH + gap);
      for (var s = 0; s < per; s++) {
        var cx = sx + s * (sw + 4);
        out += '<rect x="' + cx + '" y="' + sy + '" width="' + (sw - 3) + '" height="' + seatH + '" rx="4" fill="url(#' + id + 'seat)" stroke="rgba(180,143,214,0.55)"/>';
        out += '<rect x="' + (cx + 2) + '" y="' + (sy + 2) + '" width="' + (sw - 7) + '" height="' + Math.max(3, seatH * 0.26) + '" rx="2" fill="rgba(200,180,142,0.18)"/>';
      }
    }
    return out;
  }
  function planSVG(large) { return roomSVG(cfg.layout, large); }

  // ── luxury PDF proposal ──────────────────────────────────────────────────────
  function pdfModel() {
    var r = E.range(cfg.rangeId); if (!r) return null;
    var lines = quoteLines(), prod = productTotal(lines), di = deliveryInfo(), inst = installCost(), total = prod + (di.cost || 0) + (inst || 0);
    var anyPriced = lines.some(function (l) { return l.unit != null; });
    var mat = (r.materials || []).find(function (m) { return m.id === cfg.material; });
    var uph = mat ? mat.name : (catFinish(r) || 'Confirmed at quotation');
    if (mat && cfg.colour) uph += ' · ' + cfg.colour;
    var recline = cfg.motor ? ((CFG.motorLabels || {})[cfg.motor] || cfg.motor) : null;
    var vb = vatBreakdown(total);
    var slug = function (s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); };
    var cap = r.capability || {}, meta = r.metadata || {};
    var seatW = E.seatWidthMm(r), seatD = E.seatDepthMm(r);
    var accLines = [];
    Object.keys(cfg.accessories).forEach(function (id) { var q = cfg.accessories[id]; if (!q) return; var it = itemById(id); if (it) accLines.push(q + ' × ' + it.label); });
    return {
      range: r.name, manufacturer: r.manufacturer,
      client: (cfg.client.name || '').trim(), project: (cfg.client.project || '').trim(),
      heroImage: CFG.heroImage || null,
      rangeImage: r.hero_img || null,
      // PDF embedding needs CORS-readable bytes. The seating-assets bucket serves ACAO:* —
      // prefer it (SSOT URLs already point there for Fortress/Cinema Deco; for other ranges
      // try the bucket copy by convention, then the display URL).
      rangeImagePdf: (function () {
        var h = r.hero_img || '';
        if (/seating-assets|^\.\.\//.test(h)) return h;             // bucket or app-hosted → safe
        return 'https://ysmvklstkzodlocttspy.supabase.co/storage/v1/object/public/seating-assets/' + r.id + '.jpg';
      })(),
      spec: {
        seatWidthMm: cap.seat_width_mm || seatW, seatDepthMm: cap.seat_depth_mm || null,
        reclinedDepthMm: cap.reclined_depth_mm || null, wallClearanceMm: cap.wall_clearance_mm || null,
        planSeatWidthMm: seatW, planSeatDepthMm: seatD,
        rowGapMm: (CFG.clearance && CFG.clearance.rowGapMm) || 600,
        sideWallMm: (CFG.clearance && CFG.clearance.sideWallMm) || 150,
        dimsReal: !!(cap.seat_width_mm || cap.seat_depth_mm || cap.reclined_depth_mm),
        style: r.style || meta.range_style || null
      },
      roomWidthMm: cfg.layout.widthMm, roomLengthMm: cfg.layout.lengthMm,
      accessories: accLines, includeArmrests: cfg.includeArmrests,
      rowDetails: (function () { if (!hasRowOverrides()) return null; var out = []; for (var ri = 0; ri < cfg.layout.rows; ri++) { var rc = rowConfig(ri); out.push('Row ' + (ri + 1) + ': ' + ((rc.seat && rc.seat.label) || '—') + (rc.mat ? ' · ' + rc.mat.name + (rc.colour ? ' (' + rc.colour + ')' : '') : '')); } return out; })(),
      materialName: mat ? mat.name : null, colourName: cfg.colour || null,
      materialGroup: mat ? (mat.group || null) : null,
      materialTier: mat ? (mat.tierLabel || null) : null,
      materialSwatchHex: mat ? (mat.swatch || null) : null,
      colourHex: (function () { if (!mat || !cfg.colour) return null; var c = (mat.colours || []).find(function (x) { return x.name === cfg.colour; }); return (c && c.hex) || guessHex(cfg.colour); })(),
      swatchImg: mat ? (mat.swatchImg || null) : null,
      installCost: inst, installLabel: (CFG.installation || {}).label || 'Installation',
      productUrl: meta.product_url || null,
      datasheetUrl: meta.datasheet_url || null,
      manufacturerUrl: (CFG.manufacturerSites || {})[r.manufacturer] || null,
      paymentTerms: CFG.paymentTerms || '', termsLines: CFG.termsLines || [],
      roomText: (cfg.layout.widthMm / 1000).toFixed(1) + 'm × ' + (cfg.layout.lengthMm / 1000).toFixed(1) + 'm',
      roomWidthText: (cfg.layout.widthMm / 1000).toFixed(1) + 'm wide',
      layoutText: (cfg.layout.rows * cfg.layout.seatsPerRow) + ' seats · ' + cfg.layout.rows + ' × ' + cfg.layout.seatsPerRow,
      rows: cfg.layout.rows, seatsPerRow: cfg.layout.seatsPerRow,
      upholsteryText: uph, reclineText: recline,
      finishes: selectedFinishes().map(function (f) { return f.label; }),
      leadText: leadText(di.lead),
      lines: lines, productTotal: prod, deliveryCost: di.cost, deliveryLabel: CFG.deliveryLabel || 'Delivery',
      exVat: total, vatRate: vatRate(), vat: vb.vat, gross: vb.gross,
      totalText: anyPriced ? money(total) : 'On request',
      grossText: anyPriced ? money(Math.round(vb.gross)) : 'On request',
      priced: anyPriced,
      dateText: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      filename: 'sonor-' + slug(r.manufacturer) + '-' + slug(r.name) + '-proposal.pdf'
    };
  }
  async function savePdf() {
    try {
      if (global.SeatingPdf && global.SeatingPdf.available()) {
        toast('Building PDF…');
        var ok = await global.SeatingPdf.generate(pdfModel());
        if (ok) { toast('PDF downloaded'); return; }
      }
    } catch (e) { console.warn('[SeatingPdf]', e && e.message); toast('PDF failed — using print'); }
    global.print();
  }

  // ── export ───────────────────────────────────────────────────────────────────
  function csv() {
    var r = E.range(cfg.rangeId), lines = quoteLines();
    var di = deliveryInfo(), prod = productTotal(lines), total = prod + (di.cost || 0) + (installCost() || 0), lt = leadText(di.lead);
    var delLbl = CFG.deliveryLabel || 'Delivery';
    var rows = [['Manufacturer', 'Range', 'Item', 'Qty', 'Unit MSRP', 'Line MSRP']];
    lines.forEach(function (l) { rows.push([r.manufacturer, r.name, l.label, l.qty, l.unit != null ? l.unit.toFixed(2) : 'POA', l.unit != null ? (l.unit * l.qty).toFixed(2) : 'POA']); });
    rows.push([r.manufacturer, r.name, 'Products subtotal', '', '', prod.toFixed(2)]);
    rows.push([r.manufacturer, r.name, delLbl, 1, di.cost != null ? di.cost.toFixed(2) : 'On request', di.cost != null ? di.cost.toFixed(2) : 'On request']);
    var instC = installCost();
    if (instC != null) rows.push([r.manufacturer, r.name, (CFG.installation || {}).label || 'Installation', 1, instC.toFixed(2), instC.toFixed(2)]);
    rows.push([r.manufacturer, r.name, 'Subtotal (ex VAT)', '', '', total.toFixed(2)]);
    var vb = vatBreakdown(total);
    rows.push([r.manufacturer, r.name, 'VAT @ ' + Math.round(vatRate() * 100) + '%', '', '', vb.vat.toFixed(2)]);
    rows.push([r.manufacturer, r.name, 'Total (inc VAT)', '', '', vb.gross.toFixed(2)]);
    rows.push([r.manufacturer, r.name, 'Lead time', '', '', lt || 'On request']);
    var upSel = (r.materials || []).find(function (m) { return m.id === cfg.material; });
    if (upSel) rows.push([r.manufacturer, r.name, 'Upholstery', '', '', upSel.name + (cfg.colour ? ' / ' + cfg.colour : '')]);
    selectedFinishes().forEach(function (f) { rows.push([r.manufacturer, r.name, 'Finish', '', '', f.label]); });
    var csvs = rows.map(function (r) { return r.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csvs], { type: 'text/csv' })); a.download = 'seating-msrp-' + cfg.rangeId + '.csv'; a.click(); toast('CSV exported');
  }
  function print() { global.print(); }

  global.SeatingApp = {
    boot: boot, enter: enter, backToIntro: backToIntro, goBack: goBack, jumpTo: jumpTo, restart: restart,
    setLayout: setLayout, setLayout2: setLayout2, togglePref: togglePref,
    pickRange: pickRange, setMaterial: setMaterial, setColour: setColour, setMotor: setMotor,
    toggleArm: toggleArm, acc: acc, csv: csv, print: print, savePdf: savePdf, toggleFinish: toggleFinish, setClient: setClient,
    rowSet: rowSet, rowsReset: rowsReset
  };
})(typeof window !== 'undefined' ? window : this);
