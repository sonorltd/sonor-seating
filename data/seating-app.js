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
    includeArmrests: true, accessories: {}
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
      if (note) { note.textContent = { supabase: 'Live catalogue', cache: 'Offline (cached)', seed: 'Offline (bundled)', inline: 'No data' }[E.source] || E.source; note.className = 'src-note src-' + E.source; }
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
  function restart() { cfg = { step: 1, layout: Object.assign({ prefs: {} }, CFG.defaultRoom), rangeId: null, material: null, colour: null, motor: null, includeArmrests: true, accessories: {} }; renderStep(); }
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
    cfg.rangeId = id; cfg.material = null; cfg.colour = null; cfg.motor = null; cfg.accessories = {};
    var r = E.range(id); var mats = r.materials || [];
    if (mats.length) { cfg.material = mats[0].id; if ((mats[0].colours || []).length) cfg.colour = mats[0].colours[0].name; }
    var motors = E.motorOptions(r); cfg.motor = motors[0] || null;
    renderStep(); if (cfg.step === 2) { document.querySelectorAll('.rcard').forEach(function (c) { c.classList.remove('sel'); }); goNext(); }
  }

  // ── Step 3 · Configure ───────────────────────────────────────────────────────
  function renderConfigure() {
    var r = E.range(cfg.rangeId); if (!r) { cfg.step = 2; return renderStep(); }
    var mats = r.materials || [], fins = r.finishes || [], motors = E.motorOptions(r);
    var matHtml = mats.length ? '<div class="panel"><div class="ptt">Upholstery</div><div class="swatches">' +
      mats.map(function (m) { return '<button class="sw ' + (cfg.material === m.id ? 'on' : '') + '" style="--c:' + esc(m.swatch || '#888') + '" onclick="SeatingApp.setMaterial(\'' + m.id + '\')"><span></span>' + esc(m.name) + '</button>'; }).join('') + '</div>' + colourHtml(r) + '</div>'
      : (function () {
          var f = catFinish(r);
          if (!f && !(r.metadata && r.metadata.needs_review) && !fins.length) return '';
          return '<div class="panel"><div class="ptt">Upholstery</div><div class="hint">Fabric &amp; leather grades for this range are confirmed at quotation' + (f ? ' — ' + esc(f) : '') + '.</div></div>';
        })();
    var motorHtml = motors.length > 1 ? '<div class="panel"><div class="ptt">Recline</div><div class="opts">' +
      motors.map(function (mt) { return '<button class="opt ' + (cfg.motor === mt ? 'on' : '') + '" onclick="SeatingApp.setMotor(\'' + mt + '\')">' + esc((CFG.motorLabels || {})[mt] || mt) + '</button>'; }).join('') + '</div></div>' : '';
    var accs = E.accessoryItems(cfg.rangeId);
    var accHtml = accs.length ? '<div class="panel"><div class="ptt">Add-ons</div>' + accs.map(function (it) {
      var q = cfg.accessories[it.id] || 0, s = E.itemSell(it);
      return '<div class="acc"><div><div class="acc-n">' + esc(it.label) + '</div><div class="acc-p">' + (s != null ? money(s) + ' each' : 'POA') + '</div></div>' +
        '<div class="qty"><button onclick="SeatingApp.acc(\'' + it.id + '\',-1)">−</button><span id="q_' + it.id + '">' + q + '</span><button onclick="SeatingApp.acc(\'' + it.id + '\',1)">+</button></div></div>';
    }).join('') + '</div>' : '';
    var arm = E.armrestItems(cfg.rangeId).length ? '<div class="panel"><div class="ptt">Armrests</div><label class="toggle"><input type="checkbox" ' + (cfg.includeArmrests ? 'checked' : '') + ' onchange="SeatingApp.toggleArm(this.checked)"> Include separate armrests (1 per seat + row ends)</label></div>' : '';

    $('stepBody').innerHTML =
      '<div class="lead"><h2>Configure your ' + esc(r.name) + '</h2><p>' + esc(r.manufacturer) + (r.style ? ' · ' + esc(r.style) : '') + '</p></div>' +
      '<div class="cfg-grid"><div class="cfg-left">' +
        '<div class="panel"><div class="ptt">Layout</div><div class="lbl">Seats per row</div><div class="opts">' +
          CFG.seatsPerRowOptions.map(function (n) { return '<button class="opt ' + (cfg.layout.seatsPerRow === n ? 'on' : '') + '" onclick="SeatingApp.setLayout2(\'seatsPerRow\',' + n + ')">' + n + '</button>'; }).join('') +
          '</div><div class="lbl">Rows</div><div class="opts">' +
          CFG.rowOptions.map(function (n) { return '<button class="opt ' + (cfg.layout.rows === n ? 'on' : '') + '" onclick="SeatingApp.setLayout2(\'rows\',' + n + ')">' + n + '</button>'; }).join('') +
          '</div></div>' + motorHtml + matHtml + arm + accHtml +
        '</div>' +
        '<div class="cfg-right"><div class="panel sticky"><div class="ptt">Your cinema</div><div id="planWrap"></div>' +
          '<div id="liveTotal" class="live"></div></div></div>' +
      '</div>';
    updateLive();
  }
  function colourHtml(r) {
    var m = (r.materials || []).find(function (x) { return x.id === cfg.material; });
    var cols = (m && m.colours) || [];
    if (!cols.length) return '';
    return '<div class="lbl" style="margin-top:12px">Colour</div><div class="cols">' + cols.map(function (c) {
      return '<button class="col ' + (cfg.colour === c.name ? 'on' : '') + '" title="' + esc(c.name) + '" style="--c:' + esc(c.hex) + '" onclick="SeatingApp.setColour(' + JSON.stringify(c.name).replace(/"/g, '&quot;') + ')"></button>';
    }).join('') + '</div>';
  }
  function catFinish(r) { var it = E.seatItems(r.id)[0]; return it && it.finish; }
  function setMaterial(id) { cfg.material = id; var r = E.range(cfg.rangeId); var m = (r.materials || []).find(function (x) { return x.id === id; }); cfg.colour = m && (m.colours || [])[0] ? m.colours[0].name : null; renderConfigure(); }
  function setColour(n) { cfg.colour = n; renderConfigure(); }
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
  function quoteLines() {
    var lines = [], total = cfg.layout.rows * cfg.layout.seatsPerRow;
    var seat = primarySeat();
    if (seat) lines.push({ label: seat.label, qty: total, unit: E.itemSell(seat) });
    var arms = E.armrestItems(cfg.rangeId);
    if (cfg.includeArmrests && arms.length) { var a = arms[0]; lines.push({ label: a.label, qty: total + cfg.layout.rows, unit: E.itemSell(a) }); }
    Object.keys(cfg.accessories).forEach(function (id) { var q = cfg.accessories[id]; if (!q) return; var it = itemById(id); if (it) lines.push({ label: it.label, qty: q, unit: E.itemSell(it) }); });
    return lines;
  }
  // ── delivery + lead time (per manufacturer) ──────────────────────────────────
  function productTotal(lines) { return lines.reduce(function (s, l) { return s + (l.unit || 0) * l.qty; }, 0); }
  function deliveryInfo() {
    var r = E.range(cfg.rangeId); if (!r) return { cost: null, lead: null };
    var lines = quoteLines(), seats = cfg.layout.rows * cfg.layout.seatsPerRow, sub = productTotal(lines);
    return { cost: E.deliveryCost(r.manufacturer, { seats: seats, orderTotal: sub }), lead: E.leadWeeks(r.manufacturer) };
  }
  function leadText(lead) { return lead ? (lead[0] === lead[1] ? lead[0] + ' weeks' : lead[0] + '–' + lead[1] + ' weeks') : null; }
  function grandTotal(lines, di) { return productTotal(lines) + ((di && di.cost) || 0); }

  function updateLive() {
    var lines = quoteLines(), any = lines.some(function (l) { return l.unit != null; });
    var di = deliveryInfo(), total = grandTotal(lines, di);
    var poa = lines.some(function (l) { return l.unit == null; });
    $('planWrap').innerHTML = planSVG();
    var extra = di.cost != null
      ? '<div class="lt-sub">Incl. ' + esc((CFG.deliveryLabel || 'Delivery').toLowerCase()) + ' ' + money(di.cost) + (leadText(di.lead) ? ' · lead time ' + leadText(di.lead) : '') + '</div>'
      : (leadText(di.lead) ? '<div class="lt-sub">Lead time ' + leadText(di.lead) + '</div>' : '<div class="lt-sub">Delivery &amp; lead time confirmed at quotation</div>');
    $('liveTotal').innerHTML = '<div class="lt-row"><span>Estimated MSRP</span><b>' + (any ? money(total) + (poa ? ' + POA items' : '') : 'On request') + '</b></div><div class="lt-sub">ex VAT · indicative — confirmed at quotation</div>' + extra;
  }

  // ── Step 4 · Summary ─────────────────────────────────────────────────────────
  function renderSummary() {
    var r = E.range(cfg.rangeId); if (!r) { cfg.step = 2; return renderStep(); }
    var lines = quoteLines(), prod = productTotal(lines);
    var di = deliveryInfo(), total = prod + (di.cost || 0);
    var anyPriced = lines.some(function (l) { return l.unit != null; });
    var lt = leadText(di.lead);
    var delLbl = CFG.deliveryLabel || 'Delivery';
    var mat = (r.materials || []).find(function (m) { return m.id === cfg.material; });
    var deliveryRow = di.cost != null
      ? '<tr><td>' + esc(delLbl) + '</td><td>1</td><td class="r">' + money(di.cost) + '</td><td class="r">' + money(di.cost) + '</td></tr>'
      : '<tr><td>' + esc(delLbl) + '</td><td>1</td><td class="r">—</td><td class="r">On request</td></tr>';
    $('stepBody').innerHTML =
      '<div class="summary">' +
        '<div class="sm-head"><div><div class="sm-mfr">' + esc(r.manufacturer) + '</div><h2>' + esc(r.name) + '</h2></div><div class="sm-date">' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) + '</div></div>' +
        '<div class="strip">' +
          cell('Room', (cfg.layout.widthMm / 1000).toFixed(1) + 'm × ' + (cfg.layout.lengthMm / 1000).toFixed(1) + 'm') +
          cell('Layout', (cfg.layout.rows * cfg.layout.seatsPerRow) + ' seats', cfg.layout.rows + ' rows × ' + cfg.layout.seatsPerRow) +
          cell('Upholstery', mat ? esc(mat.name) : (catFinish(r) || 'TBC'), cfg.colour ? esc(cfg.colour) : '') +
          cell('Lead time', lt || 'On request', 'from order') +
          cell('Estimated MSRP', anyPriced ? money(total) : 'On request', 'inc. delivery · ex VAT') +
        '</div>' +
        '<div class="planbig">' + planSVG(true) + '</div>' +
        '<table class="quote"><thead><tr><th>Item</th><th>Qty</th><th class="r">Unit MSRP</th><th class="r">Line MSRP</th></tr></thead><tbody>' +
          lines.map(function (l) { return '<tr><td>' + esc(l.label) + '</td><td>' + l.qty + '</td><td class="r">' + money(l.unit) + '</td><td class="r">' + (l.unit != null ? money(l.unit * l.qty) : 'POA') + '</td></tr>'; }).join('') +
          '<tr class="sub2"><td colspan="3">Products subtotal</td><td class="r">' + money(prod) + '</td></tr>' +
          deliveryRow +
          '<tr class="tot"><td colspan="3">Estimated total (ex VAT)</td><td class="r">' + money(total) + '</td></tr>' +
        '</tbody></table>' +
        '<div class="actions"><button class="btn ghost" onclick="SeatingApp.csv()">⬇ Export CSV</button><button class="btn primary" onclick="SeatingApp.savePdf()">⬇ Download PDF proposal</button></div>' +
        '<div class="disc">Indicative MSRP from the Sonor library, including ' + esc(delLbl.toLowerCase()) + (lt ? ' and a typical ' + esc(lt) + ' lead time' : '') + ' for ' + esc(r.manufacturer) + '. Final pricing, fabric grades, delivery and lead times are confirmed on a formal quotation.</div>' +
      '</div>';
  }
  function cell(l, v, n) { return '<div class="cellx"><div class="cl">' + l + '</div><div class="cv">' + v + '</div>' + (n ? '<div class="cn">' + n + '</div>' : '') + '</div>'; }

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
    var lines = quoteLines(), prod = productTotal(lines), di = deliveryInfo(), total = prod + (di.cost || 0);
    var anyPriced = lines.some(function (l) { return l.unit != null; });
    var mat = (r.materials || []).find(function (m) { return m.id === cfg.material; });
    var uph = mat ? mat.name : (catFinish(r) || 'Confirmed at quotation');
    if (mat && cfg.colour) uph += ' · ' + cfg.colour;
    var recline = cfg.motor ? ((CFG.motorLabels || {})[cfg.motor] || cfg.motor) : null;
    var slug = function (s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); };
    return {
      range: r.name, manufacturer: r.manufacturer,
      roomText: (cfg.layout.widthMm / 1000).toFixed(1) + 'm × ' + (cfg.layout.lengthMm / 1000).toFixed(1) + 'm',
      roomWidthText: (cfg.layout.widthMm / 1000).toFixed(1) + 'm wide',
      layoutText: (cfg.layout.rows * cfg.layout.seatsPerRow) + ' seats · ' + cfg.layout.rows + ' × ' + cfg.layout.seatsPerRow,
      rows: cfg.layout.rows, seatsPerRow: cfg.layout.seatsPerRow,
      upholsteryText: uph, reclineText: recline,
      leadText: leadText(di.lead),
      lines: lines, productTotal: prod, deliveryCost: di.cost, deliveryLabel: CFG.deliveryLabel || 'Delivery',
      totalText: anyPriced ? money(total) : 'On request',
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
    var di = deliveryInfo(), prod = productTotal(lines), total = prod + (di.cost || 0), lt = leadText(di.lead);
    var delLbl = CFG.deliveryLabel || 'Delivery';
    var rows = [['Manufacturer', 'Range', 'Item', 'Qty', 'Unit MSRP', 'Line MSRP']];
    lines.forEach(function (l) { rows.push([r.manufacturer, r.name, l.label, l.qty, l.unit != null ? l.unit.toFixed(2) : 'POA', l.unit != null ? (l.unit * l.qty).toFixed(2) : 'POA']); });
    rows.push([r.manufacturer, r.name, 'Products subtotal', '', '', prod.toFixed(2)]);
    rows.push([r.manufacturer, r.name, delLbl, 1, di.cost != null ? di.cost.toFixed(2) : 'On request', di.cost != null ? di.cost.toFixed(2) : 'On request']);
    rows.push([r.manufacturer, r.name, 'Estimated total (ex VAT)', '', '', total.toFixed(2)]);
    rows.push([r.manufacturer, r.name, 'Lead time', '', '', lt || 'On request']);
    var csvs = rows.map(function (r) { return r.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csvs], { type: 'text/csv' })); a.download = 'seating-msrp-' + cfg.rangeId + '.csv'; a.click(); toast('CSV exported');
  }
  function print() { global.print(); }

  global.SeatingApp = {
    boot: boot, enter: enter, backToIntro: backToIntro, goBack: goBack, jumpTo: jumpTo, restart: restart,
    setLayout: setLayout, setLayout2: setLayout2, togglePref: togglePref,
    pickRange: pickRange, setMaterial: setMaterial, setColour: setColour, setMotor: setMotor,
    toggleArm: toggleArm, acc: acc, csv: csv, print: print, savePdf: savePdf
  };
})(typeof window !== 'undefined' ? window : this);
