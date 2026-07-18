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
      initProjectBar();
      bootDeepLink();
      try { if (global.SonorShell && res.db) global.SonorShell.selfTest(res.db); } catch (e) {}
    } catch (err) { var m = $('stepBody'); if (m) m.innerHTML = '<div class="empty">Failed to load catalogue: ' + esc(err && err.message) + '</div>'; }
  }



  // ── v0.16.0 · site-wide project selector (shared SonorProjectBar) ───────────
  // Internal build: the same picker as Takeoffs (SonorProjectList filtering —
  // recents → WQ tenders → trials → completed sink). Selecting a project binds
  // saved configurations to project_id and prefills the proposal project name.
  function initProjectBar() {
    if (global.__SEATING_CLIENT__) return;   // client build: no internal chrome
    try {
      var c0 = dbc();
      if (typeof SonorProjectBar === 'undefined' || !c0) {
        console.warn('[seating] project bar waiting', { bar: typeof SonorProjectBar !== 'undefined', db: !!c0 });
        // db client can arrive a beat after boot — retry a few times before giving up
        initProjectBar._n = (initProjectBar._n || 0) + 1;
        if (initProjectBar._n <= 5) setTimeout(initProjectBar, 1200);
        return;
      }
      SonorProjectBar.init({
        supa: c0,
        appKey: 'seating',
        host: $('projectBarHost'),
        onChange: function (detail) {
          cfg.projectId = (detail && detail.currentId) || null;
          applyProjectIdentity(detail && detail.project);
          if ($('savedList')) loadSavedList();
          pullRoomFromCinema();
        }
      });
    } catch (e) { console.warn('[seating] project bar init failed', e); }
  }

  // v0.18.0 — proposal identity from the projects table:
  // PREPARED FOR = projects.client_name · PROJECT = first line of projects.address.
  async function applyProjectIdentity(p) {
    try {
      if ((!p || p.client_name === undefined || p.address === undefined) && cfg.projectId) {
        var c = dbc();
        if (c) { var q = await c.from('projects').select('name,client_name,address').eq('id', cfg.projectId).single(); if (!q.error) p = q.data; }
      }
      if (!p) return;
      var client = (p.client_name || '').trim() || String(p.name || '').replace(/^\s*\d+\s*/, '').trim();
      var addr1 = String(p.address || '').split(/[\n,]/)[0].trim();
      if (client) cfg.client.name = client;
      cfg.client.project = addr1 || p.name || cfg.client.project;
      var nf = document.querySelector('.client-row input[placeholder^="Client"]');
      var pf = document.querySelector('.client-row input[placeholder^="Project"]');
      if (nf && cfg.client.name) nf.value = cfg.client.name;
      if (pf && cfg.client.project) pf.value = cfg.client.project;
    } catch (e) { console.warn('[seating] project identity', e); }
  }

  // v0.17.2 — the two apps TALK: on project selection, pull the cinema room dims
  // (cinema_designs.room_width/room_depth, mm — Cinema Takeoff-mastered, mirrored by
  // the Cinema Designer) into the seating layout, live.
  async function pullRoomFromCinema() {
    var c = dbc(); if (!c || !cfg.projectId) return;
    try {
      var q = await c.from('cinema_designs').select('room_width,room_depth,seat_count').eq('project_id', cfg.projectId).limit(1);
      if (q.error || !q.data || !q.data.length) return;
      var d = q.data[0];
      if (d.room_width > 1000 && d.room_depth > 1000) {
        cfg.layout.widthMm = Math.round(d.room_width);
        cfg.layout.lengthMm = Math.round(d.room_depth);
        toast('Room ' + (d.room_width / 1000).toFixed(1) + 'm × ' + (d.room_depth / 1000).toFixed(1) + 'm pulled from Cinema Designer');
        renderStep();
      }
    } catch (e) { console.warn('[seating] cinema room pull failed', e); }
  }

  // ── v0.15.0 · saved configurations per project (SSOT: seating_configs) ──────
  // Save/recall the whole cfg. Deep links: ?config=<id> opens a saved config,
  // ?project=<name> prefills the project and lists its configs — the URL contract
  // the Cinema Designer uses to link in.
  function dbc() { try { return (global.__SEATING_DB__ && global.__SEATING_DB__.client) || (global.db && global.db.client) || null; } catch (e) { return null; } }
  async function saveConfig() {
    if (global.__SEATING_CLIENT__) return;
    var c = dbc(); if (!c) return toast('Offline — connect to save');
    var proj = (cfg.client.project || '').trim();
    if (!proj) { toast('Enter a project name first'); var pf = document.querySelector('.client-row input[placeholder^="Project"]'); if (pf) pf.focus(); return; }
    var r = E.range(cfg.rangeId);
    var label = ((r && r.name) || 'Config') + ' · ' + cfg.layout.rows + '×' + cfg.layout.seatsPerRow + (cfg.colour ? ' · ' + cfg.colour : '');
    var body = { project_name: proj, project_id: cfg.projectId || null, label: label, range_id: cfg.rangeId, config: cfg, app_version: CFG.version, updated_at: new Date().toISOString() };
    try {
      var q;
      if (cfg._savedId) q = await c.from('seating_configs').update(body).eq('id', cfg._savedId).select('id').single();
      else q = await c.from('seating_configs').insert(body).select('id').single();
      if (q.error) throw q.error;
      cfg._savedId = q.data.id;
      toast('Saved to ' + proj);
      loadSavedList();
    } catch (e) { toast('Save failed: ' + (e && e.message)); }
  }
  async function loadSavedList() {
    if (global.__SEATING_CLIENT__) return;
    var el = $('savedList'); var c = dbc();
    var proj = (cfg.client.project || '').trim();
    if (!el || !c || !proj) { if (el) el.innerHTML = ''; return; }
    try {
      var qb = c.from('seating_configs').select('id,label,range_id,app_version,updated_at').eq('archived', false).order('updated_at', { ascending: false }).limit(20);
      var q = await (cfg.projectId ? qb.eq('project_id', cfg.projectId) : qb.eq('project_name', proj));
      if (q.error) throw q.error;
      if (!q.data.length) { el.innerHTML = '<div class="hint">No saved configurations for this project yet.</div>'; return; }
      el.innerHTML = q.data.map(function (row) {
        var d = new Date(row.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        return '<div class="saved-row' + (row.id === cfg._savedId ? ' cur' : '') + '">' +
          '<div class="saved-b"><div class="saved-n">' + esc(row.label) + '</div><div class="saved-d">' + d + ' · v' + esc(row.app_version || '?') + '</div></div>' +
          '<button class="ghost sm" onclick="SeatingApp.openSaved(\'' + row.id + '\')">Open</button>' +
          '<button class="ghost sm" onclick="SeatingApp.renameSaved(\'' + row.id + '\')" title="Rename">✎</button>' +
          '<button class="ghost sm" onclick="SeatingApp.copySavedLink(\'' + row.id + '\')">Link</button>' +
          '<button class="ghost sm" onclick="SeatingApp.deleteSaved(\'' + row.id + '\')" title="Delete">🗑</button></div>';
      }).join('');
    } catch (e) { el.innerHTML = '<div class="hint">Saved list unavailable: ' + esc(e && e.message) + '</div>'; }
  }
  async function openSaved(id) {
    var c = dbc(); if (!c) return toast('Offline');
    try {
      var q = await c.from('seating_configs').select('id,config').eq('id', id).single();
      if (q.error) throw q.error;
      applySaved(q.data);
    } catch (e) { toast('Load failed: ' + (e && e.message)); }
  }
  function applySaved(row) {
    var saved = row.config || {};
    cfg = Object.assign({ step: 4, layout: Object.assign({ prefs: {} }, CFG.defaultRoom), rangeId: null, material: null, colour: null, motor: null, includeArmrests: true, accessories: {}, finishes: {}, client: { name: '', project: '' }, rowOverrides: {} }, saved);
    cfg._savedId = row.id;
    if (!E.range(cfg.rangeId)) { toast('Saved range no longer in the catalogue'); cfg.step = 2; }
    enter(); cfg.step = Math.min(saved.step || 4, 4); renderStep();
    toast('Configuration loaded');
  }
  async function renameSaved(id) {
    var c = dbc(); if (!c) return toast('Offline');
    var n = global.prompt('New name for this configuration:'); if (!n) return;
    var q = await c.from('seating_configs').update({ label: n, updated_at: new Date().toISOString() }).eq('id', id);
    if (q.error) return toast('Rename failed: ' + q.error.message);
    toast('Renamed'); loadSavedList();
  }
  async function deleteSaved(id) {
    var c = dbc(); if (!c) return toast('Offline');
    if (!global.confirm('Delete this saved configuration?')) return;
    var q = await c.from('seating_configs').update({ archived: true, updated_at: new Date().toISOString() }).eq('id', id);
    if (q.error) return toast('Delete failed: ' + q.error.message);
    if (cfg._savedId === id) cfg._savedId = null;
    toast('Deleted'); loadSavedList();
  }
  function copySavedLink(id) {
    var u = location.origin + location.pathname + '?config=' + id;
    try { navigator.clipboard.writeText(u); toast('Link copied'); } catch (e) { global.prompt('Copy link:', u); }
  }
  async function bootDeepLink() {
    try {
      var sp = new URLSearchParams(location.search);
      var cid = sp.get('config'), proj = sp.get('project');
      if (cid) { await openSaved(cid); return true; }
      if (proj) { cfg.client.project = proj; enter(); cfg.step = 1; renderStep(); return false; }
    } catch (e) {}
    return false;
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
  function setClient(k, v) { cfg.client[k] = v; if (k === 'project' && $('savedList')) { clearTimeout(setClient._t); setClient._t = setTimeout(loadSavedList, 500); } }
  function nextDisabled() {
    if (cfg.step === 2) return !cfg.rangeId;
    if (cfg.step === 3) { try { if (fitCheck().over) return true; } catch (e) {} }
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
    // v0.17.3 — complete-chair from-price (seat + 2 armrests where modular)
    var from = E.chairFrom(r) != null ? E.chairFrom(r) : E.fromPrice(r);
    var badge = r.id === _bestId && x.fits ? '<span class="rec">Best fit</span>' : (x.fits ? '<span class="fit">Fits</span>' : '<span class="nofit">Tight fit</span>');
    var flags = x.flags.map(function (f) { return '<span class="flag ' + f.kind + '">' + (f.kind === 'warn' ? '⚠ ' : '') + esc(f.text) + '</span>'; }).join('');
    var plus = x.plus.slice(0, 3).map(function (p) { return '<span class="plus">✓ ' + esc(p) + '</span>'; }).join('');
    var img = r.hero_img ? '<div class="rc-img" style="background-image:url(\'' + esc(r.hero_img) + '\')"></div>' : '<div class="rc-img rc-noimg">' + esc(r.manufacturer) + '</div>';
    return '<div class="rcard ' + (sel ? 'sel' : '') + ' ' + (x.fits ? '' : 'dim') + '" onclick="SeatingApp.pickRange(\'' + r.id + '\')">' +
      img +
      '<div class="rc-b">' +
        '<div class="rc-top"><div><div class="rc-mfr">' + esc(r.manufacturer) + '</div><div class="rc-name">' + esc(r.name) + '</div></div>' + badge + '</div>' +
        (r.style ? '<div class="rc-style">' + esc(r.style) + '</div>' : '') +
        '<div class="rc-price">' + (from != null ? 'From <b>' + money(Math.round(from)) + '</b> / chair' : '<b>MSRP on request</b>') + '</div>' +
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
    var accHtml = accs.length ? '<div class="panel"><div class="ptt">Choose your accessories <span class="opt-tag">' + accs.length + ' available</span></div>' + accs.map(function (it) {
      var q = cfg.accessories[it.id] || 0, s = E.itemSell(it, cfg.material);
      var img = it.img || null;   // library item_metadata.img — shown as soon as the library files one
      return '<div class="acc' + (q ? ' has-qty' : '') + '">' +
        (img ? '<span class="acc-img" style="background-image:url(\'' + esc(img) + '\')"></span>' : '') +
        '<div class="acc-body"><div class="acc-n">' + esc(it.label) + (it.is_universal ? ' <span class="opt-tag">' + esc(r.manufacturer) + ' accessory</span>' : '') + '</div><div class="acc-p">' + (s != null ? money(s) + ' each' : 'Priced at quotation') + '</div></div>' +
        '<div class="qty"><button aria-label="fewer" onclick="SeatingApp.acc(\'' + it.id + '\',-1)">−</button><span id="q_' + it.id + '">' + q + '</span><button aria-label="more" onclick="SeatingApp.acc(\'' + it.id + '\',1)">+</button></div></div>';
    }).join('') + '<div class="hint">Quantities carry through to the summary, estimate and PDF proposal.</div></div>'
      : '<div class="panel"><div class="ptt">Choose your accessories</div><div class="hint">Wine trays, ottomans and other extras for this range are specified and priced at quotation — ask us what\'s available.</div></div>';
    var arm = E.armrestItems(cfg.rangeId).length ? '<div class="panel"><div class="ptt">Armrests</div><label class="toggle"><input type="checkbox" ' + (cfg.includeArmrests ? 'checked' : '') + ' onchange="SeatingApp.toggleArm(this.checked)"> Include separate armrests (1 per seat + row ends)</label></div>' : '';

    $('stepBody').innerHTML =
      '<div class="lead"><h2>Configure your ' + esc(r.name) + '</h2><p>' + esc(r.manufacturer) + (r.style ? ' · ' + esc(r.style) : '') + '</p></div>' +
      '<div id="fitBanner">' + fitBannerHtml() + '</div>' +
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
    scheduleTint();
  }

  // ── v0.14.0 · digital colour visualisation ──────────────────────────────────
  // When the chosen colourway has NO real swatch photo, tint the range hero to the
  // selected colour (canvas: grayscale-preserving 'color' blend) so the client still
  // sees the model in something like their colour. Clearly labelled as indicative.
  var _tintCache = {};
  function scheduleTint() { setTimeout(renderTint, 0); }
  function renderTint() {
    var wrap = $('tintWrap'); if (!wrap) return;
    var r = E.range(cfg.rangeId); if (!r || !cfg.colour) { wrap.innerHTML = ''; return; }
    var m = (r.materials || []).find(function (x) { return x.id === cfg.material; });
    var c = m && (m.colours || []).find(function (x) { return x.name === cfg.colour; });
    if (!c || c.img || !r.hero_img) { wrap.innerHTML = ''; return; }   // real swatch photo exists → no tint needed
    var hx = c.hex || guessHex(c.name);
    var key = r.id + '|' + hx;
    if (_tintCache[key]) { wrap.innerHTML = tintHtml(_tintCache[key], c.name); return; }
    wrap.innerHTML = '<div class="hint" style="margin-top:8px">Rendering colour preview…</div>';
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
      try {
        var cv = document.createElement('canvas');
        var sc2 = Math.min(1, 520 / img.naturalWidth);
        cv.width = Math.round(img.naturalWidth * sc2); cv.height = Math.round(img.naturalHeight * sc2);
        var g = cv.getContext('2d');
        g.drawImage(img, 0, 0, cv.width, cv.height);
        g.globalCompositeOperation = 'saturation'; g.fillStyle = '#000'; g.fillRect(0, 0, cv.width, cv.height);
        g.globalCompositeOperation = 'color'; g.fillStyle = hx; g.fillRect(0, 0, cv.width, cv.height);
        g.globalCompositeOperation = 'source-over';
        var url = cv.toDataURL('image/jpeg', 0.85);
        _tintCache[key] = url;
        var w2 = $('tintWrap'); if (w2 && cfg.colour === c.name) w2.innerHTML = tintHtml(url, c.name);
      } catch (e) { var w3 = $('tintWrap'); if (w3) w3.innerHTML = ''; }   // tainted canvas / CORS → skip quietly
    };
    img.onerror = function () { var w4 = $('tintWrap'); if (w4) w4.innerHTML = ''; };
    img.src = r.hero_img;
  }
  function tintHtml(url, name) {
    return '<div class="tint-prev"><img src="' + url + '" alt="Colour visualisation">' +
      '<div class="tint-cap">Digital colour visualisation — <b>' + esc(name) + '</b>. Indicative only; actual upholstery will differ. Fabric samples on request.</div></div>';
  }

  // ── Cineca-style upholstery: grouped leather/fabric with tier, availability, upcharge ──
  var GROUP_ORDER = ['leather', 'fabric', 'velvet', 'alcantara'];
  function groupLabel(k) { return { leather: 'Leather', fabric: 'Fabric', velvet: 'Velvet', alcantara: 'Alcantara' }[k] || (k ? k.charAt(0).toUpperCase() + k.slice(1) : 'Fabric'); }
  function materialsHtml(r) {
    var mats = r.materials || [];
    if (!mats.length) {
      return '<div class="panel"><div class="ptt">Upholstery</div><div class="hint">Fabric &amp; leather grades for this range are confirmed at quotation.</div></div>';
    }
    var from = E.chairFrom(r) != null ? E.chairFrom(r) : E.fromPrice(r);
    var groups = {}, order = [];
    mats.forEach(function (m) { var g = m.groupKey || 'fabric'; if (!groups[g]) { groups[g] = []; order.push(g); } groups[g].push(m); });
    order.sort(function (a, b) { var ia = GROUP_ORDER.indexOf(a), ib = GROUP_ORDER.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
    // v0.16.0 — COM (Customer's Own Material) — always offered as a third option
    // v0.16.0 — COM (Customer's Own Material) — always offered as a third option
    var comCard = '<div class="mgrp"><div class="lbl">Customer\'s Own</div><div class="mat-grid">' +
      '<button class="mcard ' + (cfg.material === '_com' ? 'on' : '') + '" onclick="SeatingApp.setMaterial(\'_com\')">' +
      '<div class="mc-top"><span class="mc-sw" style="--c:#9a8f7f"></span><div class="mc-name">COM — Customer\'s Own Material</div></div>' +
      '<div class="mc-meta">Supply your own fabric or leather</div>' +
      '<div class="mc-price">Priced at quotation</div>' +
      '<div class="mc-col">Subject to manufacturer approval</div></button>' +
      '</div></div>';
    var secs = order.map(function (g) {
      var cards = groups[g].map(function (m) {
        var sel = cfg.material === m.id, avail = m.available !== false;
        var exact = E.chairFrom(r, m.id);
        var price = avail ? (exact != null ? exact : (from != null ? from * (1 + (m.upcharge || 0) / 100) : null)) : null;
        var meta = groupLabel(g) + (m.tierLabel ? ' · ' + m.tierLabel : '');
        var body = !avail
          ? '<div class="mc-un">Not available for ' + esc(r.name) + '</div>'
          : (price != null ? '<div class="mc-price">Chair from <b>' + money(Math.round(price)) + '</b></div>' : '<div class="mc-price">MSRP on request</div>') +
            (m.upcharge > 0 ? '<div class="mc-up">⚠ +' + m.upcharge + '% upgrade</div>' : '') +
            (m.colours && m.colours.length ? '<div class="mc-col">' + m.colours.length + ' colourways</div>' : '');
        return '<button class="mcard ' + (sel ? 'on' : '') + (avail ? '' : ' off') + '"' + (avail ? ' onclick="SeatingApp.setMaterial(\'' + m.id + '\')"' : ' disabled') + '>' +
          '<div class="mc-top"><span class="mc-sw" style="--c:' + esc(m.swatch || '#888') + '"></span><div class="mc-name">' + esc(m.name) + '</div></div>' +
          '<div class="mc-meta">' + esc(meta) + '</div>' + body + '</button>';
      }).join('');
      return '<div class="mgrp"><div class="lbl">' + groupLabel(g) + '</div><div class="mat-grid">' + cards + '</div></div>';
    }).join('');
    return '<div class="panel"><div class="ptt">Upholstery</div>' + secs + comCard + colourHtml(r) + '</div>';
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
    if (cfg.material === '_com') return '<div class="colsel"><div class="lbl">Colour — COM</div><div class="hint" style="margin-top:4px">Customer\'s own material: you supply the fabric/leather. Quantity, suitability and fire rating are confirmed with the manufacturer before order.</div></div>';
    var m = (r.materials || []).find(function (x) { return x.id === cfg.material; });
    var cols = (m && m.colours) || [];
    // v0.15.1 — no colour card published (e.g. Cinelux: open choice, samples at order)
    if (!cols.length) {
      if (m && m.colourNote) return '<div class="colsel"><div class="lbl">Colour — ' + esc(m.name) + '</div><div class="hint" style="margin-top:4px">' + esc(m.colourNote) + '</div></div>';
      if (m) return '<div class="colsel"><div class="lbl">Colour — ' + esc(m.name) + '</div><div class="hint" style="margin-top:4px">Colourways for this range are agreed with the supplier — samples provided at quotation.</div></div>';
      return '';
    }
    return '<div class="colsel"><div class="lbl">Colour — ' + esc(m.name) + ' <span class="opt-tag">' + cols.length + ' colourways</span></div><div class="cols">' + cols.map(function (c) {
      var hx = c.hex || guessHex(c.name);
      var st = '--c:' + esc(hx) + (c.img ? ';background-image:url(\'' + esc(c.img) + '\');background-size:cover;background-position:center' : '');
      return '<button class="col ' + (cfg.colour === c.name ? 'on' : '') + (c.img ? ' has-img' : '') + '" title="' + esc(c.name) + '" aria-label="' + esc(c.name) + '" style="' + st + '" onclick="SeatingApp.setColour(' + JSON.stringify(c.name).replace(/"/g, '&quot;') + ')"></button>';
    }).join('') + '</div><div class="hint" id="colName">' + (cfg.colour ? 'Selected: <b style="color:var(--cream)">' + esc(cfg.colour) + '</b> · ' : '') + 'Hover a swatch for its name — samples on request.</div><div id="tintWrap"></div></div>';
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
  function setMaterial(id) { cfg.material = id; if (id === '_com') { cfg.colour = null; renderConfigure(); return; } var r = E.range(cfg.rangeId); var m = (r.materials || []).find(function (x) { return x.id === id; }); cfg.colour = m && (m.colours || [])[0] ? m.colours[0].name : null; renderConfigure(); }
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
  function itemById(id) {
    var u = (E.accessoryItems(cfg.rangeId) || []).find(function (x) { return String(x.id) === String(id); });
    if (u) return u; return E.itemsOf(cfg.rangeId).find(function (i) { return i.id === id; }); }
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
        var mid2 = rc.mat ? rc.mat.id : cfg.material;
        var u = E.itemSell(rc.seat, mid2), up2 = E.hasExactPrice(rc.seat, mid2) ? 1 : 1 + (rc.upcharge || 0) / 100;
        var lbl = 'Row ' + (ri + 1) + ' — ' + rc.seat.label + (rc.mat ? ' · ' + rc.mat.name + (rc.colour ? ' (' + rc.colour + ')' : '') : '');
        lines.push({ label: lbl, qty: cfg.layout.seatsPerRow, unit: u != null ? Math.round(u * up2) : null });
      }
    } else {
      var seat = primarySeat();
      if (seat) { var su = E.itemSell(seat, cfg.material); var gu = E.hasExactPrice(seat, cfg.material) ? 1 : globalUp; lines.push({ label: seat.label, qty: total, unit: su != null ? Math.round(su * gu) : null }); }
    }
    var arms = E.armrestItems(cfg.rangeId);
    if (cfg.includeArmrests && arms.length) { var a = arms[0]; var au = E.itemSell(a, cfg.material); var ga = E.hasExactPrice(a, cfg.material) ? 1 : globalUp; lines.push({ label: a.label, qty: total + cfg.layout.rows, unit: au != null ? Math.round(au * ga) : null }); }
    Object.keys(cfg.accessories).forEach(function (id) { var q = cfg.accessories[id]; if (!q) return; var it = itemById(id); if (it) lines.push({ label: it.label, qty: q, unit: E.itemSell(it, cfg.material), acc: true }); });
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
    var fb = $('fitBanner'); if (fb) fb.innerHTML = fitBannerHtml();
    var nx = $('btnNext'); if (nx && cfg.step === 3) nx.disabled = nextDisabled();
    var inst = installCost();
    var extra = di.cost != null
      ? '<div class="lt-sub">Incl. ' + esc((CFG.deliveryLabel || 'Delivery').toLowerCase()) + ' ' + money(di.cost) + (inst != null ? ' &amp; installation ' + money(inst) : '') + (leadText(di.lead) ? ' · lead time ' + leadText(di.lead) : '') + '</div>'
      : (leadText(di.lead) ? '<div class="lt-sub">Lead time ' + leadText(di.lead) + '</div>' : '<div class="lt-sub">Delivery &amp; lead time confirmed at quotation</div>');
    var vb = vatBreakdown(total);
    $('liveTotal').innerHTML = '<div class="lt-row"><span>Estimated MSRP</span><b>' + (any ? money(total) + (poa ? ' + POA' : '') : 'On request') + '</b></div><div class="lt-sub">ex VAT' + (any ? ' · inc VAT ' + money(Math.round(vb.gross)) : '') + ' — indicative</div>' + extra;
  }

  // ── Step 4 · Summary ─────────────────────────────────────────────────────────
  function renderSummary() {
    setTimeout(loadSavedList, 0);
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
        (global.__SEATING_CLIENT__ ? '' : '<div class="panel saved-panel"><div class="ptt">Saved configurations <span class="opt-tag">per project</span>' +
          '<button class="ghost sm" style="float:right" onclick="SeatingApp.saveConfig()">' + (cfg._savedId ? 'Update save' : 'Save this configuration') + '</button></div>' +
          '<div id="savedList"><div class="hint">Enter a project name above, then save — configurations can be reopened later or linked from the Cinema Designer.</div></div>' +
        '</div>') +
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

  // ── plans (SVG) ─────────────────────────────────────────────────────────────
  // Live TO-SCALE plan (v0.13.0) — same geometry as the PDF drawing page: one
  // uniform scale for both axes, seats butt arm-to-arm (no invented gap) and
  // anchor to the rear wall (backs to the wall, footrests toward the screen),
  // reclined envelope drawn lighter ahead of the upright footprint. Real
  // manufacturer dims flow in live as soon as a range is chosen.
  function parseCm(s) { var m = /([0-9]+(?:\.[0-9]+)?)\s*cm/i.exec(String(s || '')); return m ? Math.round(parseFloat(m[1]) * 10) : null; }
  function planSpec() {
    var r = (cfg.rangeId && E) ? E.range(cfg.rangeId) : null;
    var cap = (r && r.capability) || {};
    // v0.18.0 — the CHOSEN seat item's real width wins (e.g. Modena Fixed S = 57cm,
    // not the range's 67cm default); separate armrest modules add to the row run.
    var chosenW = null;
    try { var rc0 = rowConfig(0); chosenW = rc0 && rc0.seat ? parseCm(rc0.seat.size_label || rc0.seat.size) : null; } catch (e) {}
    var seatW = chosenW || cap.seat_width_mm || (r ? E.seatWidthMm(r) : null) || (CFG.clearance && CFG.clearance.seatFallbackWidthMm) || 650;
    var uprD = cap.seat_depth_mm || (r && E.seatDepthMm ? E.seatDepthMm(r) : null) || 1050;
    var reclD = cap.reclined_depth_mm || Math.round(uprD * 1.5);
    if (reclD < uprD) reclD = uprD;
    var arms = r ? (E.armrestItems(r.id) || []) : [];
    var armW0 = null;
    for (var ai = 0; ai < arms.length && !armW0; ai++) armW0 = parseCm(arms[ai].size_label || arms[ai].size);
    var modularArms = !!(arms.length && cfg.includeArmrests);
    return {
      seatW: seatW, uprD: uprD, reclD: reclD,
      armW: modularArms ? (armW0 || 150) : null, modularArms: modularArms,
      rowGap: (CFG.clearance && CFG.clearance.rowGapMm) || 50,
      wallClear: (cap.wall_clearance_mm != null && cap.wall_clearance_mm !== 0) ? cap.wall_clearance_mm : (cap.wall_clearance_mm === 0 ? 0 : 100),
      real: !!(cap.seat_width_mm || cap.seat_depth_mm || cap.reclined_depth_mm),
      rangeName: r ? r.name : null
    };
  }
  // row run in mm — arms as shared modules between/around seats when separate
  function rowRunMm(S, per) { return S.modularArms ? per * S.seatW + (per + 1) * S.armW : per * S.seatW; }
  // v0.18.1 — room-width fit guard: widest row's run vs the room. over ⇒ BLOCKS Continue.
  function fitCheck() {
    var S = planSpec(), per = cfg.layout.seatsPerRow, roomW = cfg.layout.widthMm || 4000;
    var maxRun = rowRunMm(S, per);
    try {
      for (var ri = 0; ri < cfg.layout.rows; ri++) {
        var rc = rowConfig(ri);
        var w = rc && rc.seat ? parseCm(rc.seat.size_label || rc.seat.size) : null;
        if (w) {
          var run = S.modularArms ? per * w + (per + 1) * S.armW : per * w;
          if (run > maxRun) maxRun = run;
        }
      }
    } catch (e) {}
    var side = (roomW - maxRun) / 2;
    var minSide = (CFG.clearance && CFG.clearance.sideWallMm) || 150;
    return { run: Math.round(maxRun), roomW: roomW, side: Math.round(side), over: maxRun > roomW, tight: maxRun <= roomW && side < minSide };
  }
  function fitBannerHtml() {
    if (!cfg.rangeId) return '';
    var f = fitCheck();
    if (f.over) return '<div class="fitwarn block">⚠ This configuration is ' + (f.run - f.roomW) + 'mm wider than the room (' + f.run + 'mm run in a ' + f.roomW + 'mm room). Reduce seats per row, choose a narrower seat, or adjust the room to continue.</div>';
    if (f.tight) return '<div class="fitwarn tight">⚠ Tight fit — only ' + f.side + 'mm free each side (we recommend at least ' + (((CFG.clearance || {}).sideWallMm) || 150) + 'mm). You can continue, but please double-check the room.</div>';
    return '';
  }
  function roomSVG(L, big) {
    var S = planSpec();
    var roomW = L.widthMm || 4000, roomL = L.lengthMm || 6000, rows = L.rows || 2, per = L.seatsPerRow || 3;
    var G = function (a) { return 'rgba(200,180,142,' + a + ')'; };
    var DIMC = 'rgba(173,153,120,0.9)', FONT = 'Gilroy,system-ui';
    var boxW = big ? 620 : 420, boxH = big ? 470 : 330;
    var padL = 42, padR = 46, padT = 30, padB = 40;
    var sc = Math.min((boxW - padL - padR) / roomW, (boxH - padT - padB) / roomL);
    var rw = roomW * sc, rl = roomL * sc;
    var rx = padL + ((boxW - padL - padR) - rw) / 2, ry = padT + ((boxH - padT - padB) - rl) / 2;
    var totalRowW = rowRunMm(S, per), sideMm = Math.round((roomW - totalRowW) / 2);
    var sx0 = rx + (rw - totalRowW * sc) / 2;
    var seatPX = S.seatW * sc, uprPX = S.uprD * sc, reclPX = S.reclD * sc, rowGapPX = S.rowGap * sc;
    var armPX = S.modularArms ? S.armW * sc : 0;
    var rearY = ry + rl - S.wallClear * sc, pitch = reclPX + rowGapPX;
    function rr(x, y, w, h, r2, fill, stroke, sw2) {
      return '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="' + r2 + '" fill="' + (fill || 'none') + '"' + (stroke ? ' stroke="' + stroke + '" stroke-width="' + (sw2 || 1) + '"' : '') + '/>';
    }
    function txt(s2, x, y, size, fill, anchor, ls) {
      return '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" font-size="' + size + '" fill="' + fill + '" font-family="' + FONT + '"' + (anchor ? ' text-anchor="' + anchor + '"' : '') + (ls ? ' letter-spacing="' + ls + '"' : '') + '>' + s2 + '</text>';
    }
    function line(x1, y1, x2, y2, c2, w2) {
      return '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="' + c2 + '" stroke-width="' + (w2 || 0.7) + '"/>';
    }
    function dimH(x1, x2, y, label, above) {
      return line(x1, y, x2, y, DIMC) + line(x1, y - 3, x1, y + 3, DIMC) + line(x2, y - 3, x2, y + 3, DIMC) +
        txt(label, (x1 + x2) / 2, above ? y - 4 : y + 10, 8, DIMC, 'middle');
    }
    function dimV(x, y1, y2, label) {
      return line(x, y1, x, y2, DIMC) + line(x - 3, y1, x + 3, y1, DIMC) + line(x - 3, y2, x + 3, y2, DIMC) +
        '<text x="' + (x - 5).toFixed(1) + '" y="' + ((y1 + y2) / 2).toFixed(1) + '" font-size="8" fill="' + DIMC + '" font-family="' + FONT + '" text-anchor="middle" transform="rotate(-90 ' + (x - 5).toFixed(1) + ' ' + ((y1 + y2) / 2).toFixed(1) + ')">' + label + '</text>';
    }
    var s = '';
    s += rr(rx - 2.5, ry - 2.5, rw + 5, rl + 5, 3, 'none', G(0.55), 1.3);
    s += rr(rx, ry, rw, rl, 2, 'rgba(9,7,15,0.55)', G(0.35), 0.7);
    s += rr(rx + rw * 0.14, ry + 6, rw * 0.72, 4, 1.5, '#ad9978');
    s += txt('S C R E E N', rx + rw / 2, ry + 20, 6, G(0.8), 'middle', 3);
    for (var r = 0; r < rows; r++) {
      var rRear = rearY - (rows - 1 - r) * pitch, ryU = rRear - uprPX, ryR = rRear - reclPX;
      var cx = sx0;
      for (var i = 0; i < per; i++) {
        if (S.modularArms) { s += rr(cx, ryU, armPX, uprPX, 2, G(0.1), G(0.55), 0.8); cx += armPX; }   // shared/end armrest module
        var aw = S.modularArms ? 0 : seatPX * 0.15;
        if (reclPX > uprPX + 2) s += rr(cx + 1, ryR, seatPX - 2, reclPX - uprPX + 2, 2, 'none', G(0.28), 0.7);
        s += rr(cx, ryU, seatPX, uprPX, 3, 'rgba(128,88,161,0.14)', G(0.85), 1);
        if (!S.modularArms) {
          s += rr(cx + 1, ryU + 1, aw, uprPX - 2, 2, 'none', G(0.4), 0.6);
          s += rr(cx + seatPX - aw - 1, ryU + 1, aw, uprPX - 2, 2, 'none', G(0.4), 0.6);
        }
        s += rr(cx + aw + 2, ryU + uprPX * 0.08, seatPX - 2 * aw - 4, uprPX * 0.52, 2, 'none', G(0.5), 0.7);
        s += rr(cx + aw + 2, ryU + uprPX * 0.66, seatPX - 2 * aw - 4, uprPX * 0.26, 2, G(0.14), G(0.7), 0.9);
        cx += seatPX;
      }
      if (S.modularArms) s += rr(cx, ryU, armPX, uprPX, 2, G(0.1), G(0.55), 0.8);
    }
    s += dimH(rx, rx + rw, ry - 12, roomW + '', true);
    s += dimV(rx - 14, ry, ry + rl, roomL + '');
    if (sideMm > 0) {
      var syc = rearY - uprPX / 2;
      s += dimH(rx, sx0, syc, sideMm + '', true);
      s += dimH(sx0 + totalRowW * sc, rx + rw, syc, sideMm + '', true);
    }
    s += dimH(sx0, sx0 + totalRowW * sc, ry + rl + 12, Math.round(totalRowW) + '', false);
    var capTxt = (S.rangeName ? S.rangeName + ' · ' : '') + (S.real ? 'manufacturer dimensions' : 'standard allowances') + ' · dims in mm';
    s += txt(capTxt, boxW / 2, boxH - 6, 8.5, 'rgba(143,133,116,0.9)', 'middle');
    if (sideMm < 0) s += txt('run exceeds room width by ' + Math.abs(sideMm * 2) + 'mm', boxW / 2, boxH - 18, 8.5, 'rgba(224,122,95,0.95)', 'middle');
    return '<svg viewBox="0 0 ' + boxW + ' ' + boxH + '" width="100%" style="max-width:' + (big ? 680 : 460) + 'px;display:block">' + s + '</svg>';
  }
  function planSVG(large) { return roomSVG(cfg.layout, large); }

  // ── luxury PDF proposal ──────────────────────────────────────────────────────
  function pdfModel() {
    var r = E.range(cfg.rangeId); if (!r) return null;
    var lines = quoteLines(), prod = productTotal(lines), di = deliveryInfo(), inst = installCost(), total = prod + (di.cost || 0) + (inst || 0);
    var anyPriced = lines.some(function (l) { return l.unit != null; });
    var isCom = cfg.material === '_com';
    var mat = (r.materials || []).find(function (m) { return m.id === cfg.material; });
    var uph = isCom ? "Customer's Own Material (COM)" : (mat ? mat.name : (catFinish(r) || 'Confirmed at quotation'));
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
        armWidthMm: (function () { var S0 = planSpec(); return S0.modularArms ? S0.armW : null; })(),
        modularArms: planSpec().modularArms,
        planSeatWidthSel: planSpec().seatW,
        rowRunMm: rowRunMm(planSpec(), cfg.layout.seatsPerRow),
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
      materialName: isCom ? "Customer's Own Material (COM)" : (mat ? mat.name : null),
      colourName: isCom ? 'Supplied by client — subject to manufacturer approval' : (cfg.colour || (mat && mat.colourNote ? 'Free choice of colour — samples supplied at order' : null)),
      colourIsOpenChoice: !!(isCom || (!cfg.colour && mat && mat.colourNote)),
      materialGroup: mat ? (mat.group || null) : null,
      materialTier: mat ? (mat.tierLabel || null) : null,
      materialSwatchHex: mat ? (mat.swatch || null) : null,
      colourHex: (function () { if (!mat || !cfg.colour) return null; var c = (mat.colours || []).find(function (x) { return x.name === cfg.colour; }); return (c && c.hex) || guessHex(cfg.colour); })(),
      swatchImg: (function () { if (mat && cfg.colour) { var c = (mat.colours || []).find(function (x) { return x.name === cfg.colour; }); if (c && c.img) return c.img; } return mat ? (mat.swatchImg || null) : null; })(),
      installCost: inst, installLabel: (CFG.installation || {}).label || 'Installation',
      manufacturerLogo: (r.metadata && r.metadata.manufacturer_logo) || null,
      // v0.18.0 — 'Additional options' page: everything available on this range that
      // wasn't picked, so nothing is missed in the config process
      optionsMenu: {
        accessories: E.accessoryItems(r.id).map(function (it) {
          var p = E.itemSell(it, cfg.material);
          return { label: it.label, price: p != null ? Math.round(p) : null, qty: cfg.accessories[it.id] || 0, generic: !!it.is_universal };
        }),
        finishes: (CFG.finishOptions || []).map(function (f) { return { label: f.label, note: f.note, selected: !!cfg.finishes[f.id] }; }),
        materials: (r.materials || []).filter(function (m) { return m.available !== false; }).map(function (m) {
          var p = E.chairFrom(r, m.id);
          return { name: m.name, group: m.group || '', price: p != null ? Math.round(p) : null, selected: cfg.material === m.id };
        }),
        seats: E.seatItems(r.id).slice(0, 14).map(function (s2) {
          var p = E.itemSell(s2, cfg.material);
          return { label: s2.label, price: p != null ? Math.round(p) : null };
        })
      },
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
    rowSet: rowSet, rowsReset: rowsReset,
    saveConfig: saveConfig, openSaved: openSaved, copySavedLink: copySavedLink, renameSaved: renameSaved, deleteSaved: deleteSaved
  };
})(typeof window !== 'undefined' ? window : this);
