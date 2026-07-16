/* Sonor Seating Configurator — wizard UI + seating-plan SVG + boot
   Renders the Manufacturer → Range → Upholstery → Build → Summary flow.
   All catalogue reads go through SonorSeating (data engine). No per-range code.
*/
(function (global) {
  'use strict';

  var CFG = global.__SEATING_CONFIG__ || {};
  var E = global.SonorSeating;
  var STEP_LABELS = CFG.steps || ['Manufacturer', 'Range', 'Upholstery', 'Build', 'Summary'];
  var ROW_OPTS = CFG.rowOptions || [1, 2, 3];

  var cfg = {
    step: 1, manufacturer: null, range: null, material: null, colour: null,
    options: [], rows: 2, rowConfigs: [], includeArmrests: true, accessories: {}
  };

  // ── helpers ────────────────────────────────────────────────────────────────
  function $(id) { return document.getElementById(id); }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function fmt(n, dp) { if (dp == null) dp = 2; return Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp }); }
  function motorLabel(t) { return (CFG.motorLabels || {})[t] || t; }
  function accLabel(t) { return (CFG.accLabels || {})[t] || cap(t); }
  function assetUrl(p) { if (!p) return ''; return (/^https?:|^\.\.\//).test(p) ? p : '../' + p; }
  function toast(m, kind) { try { if (global.SonorShell) return global.SonorShell.toast(m, { kind: kind || 'ok' }); } catch (e) {} }

  // ── boot ────────────────────────────────────────────────────────────────────
  async function boot() {
    try {
      var res = await E.load();
      var note = $('sourceNote');
      if (note) {
        var lbl = { supabase: 'Live catalogue', cache: 'Cached catalogue (offline)', seed: 'Bundled catalogue (offline)', inline: 'No catalogue data' }[E.source] || E.source;
        note.textContent = lbl;
        note.className = 'src-note src-' + E.source;
      }
      renderStep();
      try { if (global.SonorShell && res.db) global.SonorShell.selfTest(res.db); } catch (e) {}
    } catch (err) {
      var grid = $('mfrGrid');
      if (grid) grid.innerHTML = '<div class="loading-wrap" style="color:#c55">Failed to load catalogue: ' + esc(err && err.message) + '</div>';
    }
  }

  // ── navigation ───────────────────────────────────────────────────────────────
  function goNext() { if (cfg.step < STEP_LABELS.length) { cfg.step++; renderStep(); } }
  function goBack() { if (cfg.step > 1) { cfg.step--; renderStep(); } }
  function jumpTo(n) { if (n < cfg.step) { cfg.step = n; renderStep(); } }
  function resetConfig() {
    if (!global.confirm('Reset the configuration and start over?')) return;
    cfg = { step: 1, manufacturer: null, range: null, material: null, colour: null, options: [], rows: 2, rowConfigs: [], includeArmrests: true, accessories: {} };
    renderStep();
  }

  function stepNextDisabled() {
    if (cfg.step === 1) return !cfg.manufacturer;
    if (cfg.step === 2) return !cfg.range;
    if (cfg.step === 3) return !cfg.material;
    if (cfg.step === 4) return cfg.rowConfigs.reduce(function (s, rc) { return s + rc.seats; }, 0) === 0;
    return false;
  }

  function renderStep() {
    document.querySelectorAll('.step-wrap').forEach(function (el, i) { el.classList.toggle('active', i + 1 === cfg.step); });

    $('stepPills').innerHTML = STEP_LABELS.map(function (lbl, i) {
      var n = i + 1, done = n < cfg.step, active = n === cfg.step;
      var arr = i < STEP_LABELS.length - 1 ? '<span class="sp-arr">›</span>' : '';
      return '<div class="step-pill ' + (done ? 'done' : '') + ' ' + (active ? 'active' : '') + '" ' + (done ? 'onclick="SeatingApp.jumpTo(' + n + ')"' : '') +
        '><div class="sp-inner"><div class="sp-num">' + (done ? '✓' : n) + '</div>' + lbl + '</div></div>' + arr;
    }).join('');

    // manufacturer context strip (logo surfaces once chosen)
    var ctx = $('mfrContext');
    if (ctx) {
      if (cfg.manufacturer && cfg.step > 1) {
        var m = E.manufacturer(cfg.manufacturer);
        ctx.style.display = '';
        ctx.innerHTML = '<img class="ctx-logo" src="' + esc(assetUrl(m && m.logo_url)) + '" alt="' + esc(m && m.name) + '" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'\'">' +
          '<span class="ctx-name" style="display:none">' + esc(m && m.name) + '</span>' +
          (cfg.range ? '<span class="ctx-div"></span><span class="ctx-range">' + esc((E.range(cfg.range) || {}).name || '') + '</span>' : '');
      } else { ctx.style.display = 'none'; ctx.innerHTML = ''; }
    }

    var back = $('btnBack'); back.style.display = cfg.step > 1 ? '' : 'none';
    var next = $('btnNext');
    if (cfg.step === STEP_LABELS.length) {
      next.textContent = 'Start Over'; next.disabled = false; next.onclick = resetConfig;
    } else {
      next.textContent = 'Next →'; next.onclick = goNext; next.disabled = stepNextDisabled();
    }

    if (cfg.step === 1) renderManufacturerStep();
    if (cfg.step === 2) renderRangeStep();
    if (cfg.step === 3) renderMaterialStep();
    if (cfg.step === 4) renderBuildStep();
    if (cfg.step === 5) renderSummaryStep();
    global.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Step 1: Manufacturer ───────────────────────────────────────────────────
  function renderManufacturerStep() {
    var mfrs = E.manufacturers();
    var grid = $('mfrGrid');
    if (!mfrs.length) { grid.innerHTML = '<div class="loading-wrap">No manufacturers in the library yet.</div>'; return; }
    grid.innerHTML = mfrs.map(function (m) {
      var nRanges = E.ranges(m.id).length;
      return '<div class="mfr-card ' + (cfg.manufacturer === m.id ? 'selected' : '') + '" onclick="SeatingApp.selectManufacturer(\'' + m.id + '\')">' +
        '<div class="sel-check">✓</div>' +
        '<div class="mfr-logo-wrap"><img class="mfr-logo" src="' + esc(assetUrl(m.logo_url)) + '" alt="' + esc(m.name) + '" onerror="this.style.display=\'none\';this.parentElement.querySelector(\'.mfr-logo-fallback\').style.display=\'flex\'">' +
        '<div class="mfr-logo-fallback" style="display:none">' + esc(m.name) + '</div></div>' +
        '<div class="mfr-body"><div class="mfr-name">' + esc(m.name) + '</div>' +
        '<div class="mfr-blurb">' + esc(m.blurb || '') + '</div>' +
        '<div class="mfr-meta">' + nRanges + ' range' + (nRanges !== 1 ? 's' : '') + '</div></div></div>';
    }).join('');
  }
  function selectManufacturer(id) {
    cfg.manufacturer = id; cfg.range = null; cfg.material = null; cfg.colour = null; cfg.options = []; cfg.rowConfigs = []; cfg.accessories = {};
    renderStep();
  }

  // ── Step 2: Range ───────────────────────────────────────────────────────────
  function renderRangeStep() {
    var rs = E.ranges(cfg.manufacturer);
    var grid = $('rangeGrid');
    $('rangeHeading').textContent = 'Select a ' + ((E.manufacturer(cfg.manufacturer) || {}).name || '') + ' Range';
    if (!rs.length) { grid.innerHTML = '<div class="loading-wrap">No ranges for this manufacturer yet.</div>'; return; }
    grid.innerHTML = rs.map(function (r) {
      var from = E.rangeFromPrice(r.id, entryMaterial(r.id));
      var fromStr = from != null ? 'From <strong>£' + fmt(from, 0) + '</strong> / seat (trade)' : '';
      return '<div class="range-card ' + (cfg.range === r.id ? 'selected' : '') + '" onclick="SeatingApp.selectRange(\'' + r.id + '\')">' +
        '<div class="sel-check">✓</div>' +
        '<div class="rc-image" style="background-image:url(\'' + esc(assetUrl(r.thumb_img)) + '\')"></div>' +
        '<div class="rc-body"><div class="rc-name">' + esc(r.name) + '</div>' +
        '<div class="rc-tag">' + esc(r.tagline || '') + '</div>' +
        '<div class="rc-desc">' + esc(r.description || '') + '</div>' +
        (fromStr ? '<div class="rc-from">' + fromStr + '</div>' : '') + '</div></div>';
    }).join('');
  }
  // a sensible material for "from" pricing: first available material of the range
  function entryMaterial(rangeId) { var m = E.materialsForRange(rangeId)[0]; return m ? m.id : null; }
  function selectRange(id) {
    cfg.range = id; cfg.material = null; cfg.colour = null;
    var rc = E.rangeConfig(id);
    cfg.rowConfigs = Array.from({ length: cfg.rows }, function () { return { seats: rc.default_seats_per_row, motorType: null }; });
    cfg.accessories = {};
    renderStep();
  }

  // ── Step 3: Upholstery ──────────────────────────────────────────────────────
  function renderMaterialStep() {
    var mats = E.materialsForRange(cfg.range);
    var groups = {};
    mats.forEach(function (m) { (groups[m.group_id] = groups[m.group_id] || []).push(m); });
    var rname = (E.range(cfg.range) || {}).name || '';
    $('matSub').textContent = 'Choose the upholstery for the ' + rname + ' configuration. Only grades available for this range are shown.';

    $('matSections').innerHTML = Object.keys(groups).map(function (grp) {
      return '<div><div class="mat-sec-lbl">' + esc(cap(grp)) + '</div><div class="mat-grid">' +
        groups[grp].map(function (m) {
          var pr = seatPriceFor(m.id);
          var priceStr = pr != null ? 'Seat from £' + fmt(pr, 0) + ' trade' : '';
          var nCol = E.colours(m.id).length;
          var note = (m.metadata && m.metadata.note) ? m.metadata.note : '';
          return '<div class="mat-card ' + (cfg.material === m.id ? 'selected' : '') + '" onclick="SeatingApp.selectMaterial(\'' + m.id + '\')">' +
            '<div class="mat-swatch" style="background:' + esc(m.swatch_hex || '#555') + '"></div><div>' +
            '<div class="mat-name">' + esc(m.name) + '</div>' +
            '<div class="mat-tier">' + esc(cap(grp)) + ' · Tier ' + (m.tier || 1) + '</div>' +
            (note ? '<div class="mat-note">⚠ ' + esc(note) + '</div>' : '') +
            (priceStr ? '<div class="mat-price">' + priceStr + '</div>' : '') +
            '<div class="mat-price" style="opacity:.7">' + nCol + ' colourways</div></div></div>';
        }).join('') + '</div></div>';
    }).join('');
    if (cfg.material) showColourSection(cfg.material);
    else $('colourSection').style.display = 'none';
  }
  function seatPriceFor(materialId) {
    var it = E.seatItem(cfg.range, E.motorTypes(cfg.range)[0]);
    if (!it) return null; var pr = E.priceRow(it, materialId);
    return pr ? Number(pr.price_trade_gbp) : null;
  }
  function selectMaterial(id) { cfg.material = id; cfg.colour = null; renderStep(); }
  function showColourSection(materialId) {
    var cols = E.colours(materialId), sec = $('colourSection'); sec.style.display = '';
    var m = E.material(materialId) || {};
    $('colourSecSub').textContent = (m.name || '') + ' is available in ' + cols.length + ' colourways. Select your preference — samples can be arranged.';
    $('colourGrid').innerHTML = cols.map(function (c) {
      return '<div class="colour-chip ' + (cfg.colour === c.name ? 'selected' : '') + '" onclick="SeatingApp.selectColour(' + JSON.stringify(c.name).replace(/"/g, '&quot;') + ')">' +
        '<div class="colour-chip-swatch" style="background:' + esc(c.hex) + '"></div><div class="colour-chip-name">' + esc(c.name) + '</div></div>';
    }).join('');
    var fins = E.finishOptions(cfg.manufacturer);
    $('finishBlock').style.display = fins.length ? '' : 'none';
    $('finishOpts').innerHTML = fins.map(function (f) {
      return '<div class="finish-opt ' + (cfg.options.indexOf(f.id) >= 0 ? 'active' : '') + '" onclick="SeatingApp.toggleFinish(\'' + f.id + '\')">' +
        '<div class="fo-toggle"></div><div class="fo-info"><div class="fo-label">' + esc(f.label) + '</div><div class="fo-note">' + esc(f.note || '') + '</div></div></div>';
    }).join('');
  }
  function selectColour(name) { cfg.colour = name; renderMaterialStep(); }
  function toggleFinish(id) { var i = cfg.options.indexOf(id); if (i >= 0) cfg.options.splice(i, 1); else cfg.options.push(id); renderMaterialStep(); }

  // ── Step 4: Build ────────────────────────────────────────────────────────────
  function renderBuildStep() {
    var motors = E.motorTypes(cfg.range), defMt = motors[0] || 'fixed';
    var rc = E.rangeConfig(cfg.range);
    if (!cfg.rowConfigs.length) cfg.rowConfigs = Array.from({ length: cfg.rows }, function () { return { seats: rc.default_seats_per_row, motorType: defMt }; });
    cfg.rowConfigs.forEach(function (r) { if (!r.motorType || motors.indexOf(r.motorType) < 0) r.motorType = defMt; });

    $('rowPills').innerHTML = ROW_OPTS.map(function (n) {
      return '<button class="opt-pill ' + (cfg.rows === n ? 'active' : '') + '" onclick="SeatingApp.setRows(' + n + ')">' + n + ' Row' + (n !== 1 ? 's' : '') + '</button>';
    }).join('');
    renderRowCards();
    $('armToggle').classList.toggle('on', cfg.includeArmrests);
    updateArmInfo();

    var accItems = E.accessoryItems(cfg.range);
    $('accRows').innerHTML = accItems.length ? accItems.map(function (it) {
      var pr = E.priceRow(it, cfg.material); var trade = pr ? Number(pr.price_trade_gbp) : null;
      var qty = cfg.accessories[it.item_type] || 0;
      return '<div class="acc-row"><div style="flex:1"><div class="acc-name">' + esc(accLabel(it.item_type)) + '</div>' +
        (it.size_label ? '<div class="acc-note">' + esc(it.size_label) + '</div>' : '') +
        (it.is_universal ? '<div class="acc-note">Universal pricing</div>' : '') + '</div>' +
        '<div class="acc-price">' + (trade != null ? '<strong>£' + fmt(trade) + '</strong> trade' : '—') + '</div>' +
        '<div class="qty-ctrl"><button class="qty-btn" onclick="SeatingApp.changeAcc(\'' + it.item_type + '\',-1)">−</button>' +
        '<div class="qty-val" id="accQty_' + it.item_type + '">' + qty + '</div>' +
        '<button class="qty-btn" onclick="SeatingApp.changeAcc(\'' + it.item_type + '\',1)">+</button></div></div>';
    }).join('') : '<div style="color:var(--sc-muted);font-size:12px">No accessories available for this range.</div>';

    updateBuildSummary();
  }
  function renderRowCards() {
    var motors = E.motorTypes(cfg.range), multi = motors.length > 1;
    var rc = E.rangeConfig(cfg.range), minS = rc.min_seats, maxS = rc.max_seats;
    $('rowConfigCards').innerHTML = cfg.rowConfigs.map(function (row, idx) {
      var label = String.fromCharCode(65 + idx);
      var pos = idx === 0 ? 'Front row · nearest screen' : (idx === cfg.rowConfigs.length - 1 && cfg.rowConfigs.length > 1 ? 'Back row' : '');
      var pills = '';
      for (var n = minS; n <= maxS; n++) pills += '<button class="opt-pill ' + (row.seats === n ? 'active' : '') + '" onclick="SeatingApp.setRowSeats(' + idx + ',' + n + ')">' + n + '</button>';
      var motorHtml = '';
      if (multi) {
        motorHtml = '<div style="margin-top:12px"><div class="mini-lbl">Motor Type</div><div class="style-select">' +
          motors.map(function (mt) {
            var si = E.seatItem(cfg.range, mt); var pr = si && E.priceRow(si, cfg.material);
            var ps = pr ? '£' + fmt(pr.price_trade_gbp, 0) + ' trade' : '';
            return '<button class="style-btn ' + (row.motorType === mt ? 'active' : '') + '" onclick="SeatingApp.setRowMotorType(' + idx + ',\'' + mt + '\')">' + esc(motorLabel(mt)) + '<small>' + ps + '</small></button>';
          }).join('') + '</div></div>';
      }
      return '<div class="row-cfg-card"><div class="row-cfg-label"><span class="row-letter">' + label + '</span>' +
        '<span class="row-desc">' + pos + '</span><span class="row-seat-count">' + row.seats + ' seat' + (row.seats !== 1 ? 's' : '') + '</span></div>' +
        '<div class="option-pills">' + pills + '</div>' + motorHtml + '</div>';
    }).join('');
  }
  function setRows(n) {
    cfg.rows = n; var rc = E.rangeConfig(cfg.range), motors = E.motorTypes(cfg.range), defMt = motors[0] || 'fixed';
    while (cfg.rowConfigs.length < n) cfg.rowConfigs.push({ seats: rc.default_seats_per_row, motorType: defMt });
    cfg.rowConfigs = cfg.rowConfigs.slice(0, n);
    renderBuildStep();
  }
  function setRowSeats(idx, n) { if (cfg.rowConfigs[idx]) { cfg.rowConfigs[idx].seats = n; renderRowCards(); updateArmInfo(); updateBuildSummary(); } }
  function setRowMotorType(idx, mt) { if (cfg.rowConfigs[idx]) { cfg.rowConfigs[idx].motorType = mt; renderRowCards(); updateBuildSummary(); } }
  function toggleArmrests() { cfg.includeArmrests = !cfg.includeArmrests; $('armToggle').classList.toggle('on', cfg.includeArmrests); updateArmInfo(); updateBuildSummary(); }
  function updateArmInfo() {
    if (cfg.includeArmrests) {
      var total = cfg.rowConfigs.reduce(function (s, rc) { return s + rc.seats + 1; }, 0);
      var detail = cfg.rowConfigs.map(function (rc, i) { return 'Row ' + String.fromCharCode(65 + i) + ': ' + (rc.seats + 1); }).join(' · ');
      $('armCountInfo').textContent = total + ' armrests total  (' + detail + ')';
    } else $('armCountInfo').textContent = '';
  }
  function changeAcc(type, delta) {
    var max = (CFG.accMax && CFG.accMax[type]) || (CFG.accMax && CFG.accMax._default) || 6;
    var cur = cfg.accessories[type] || 0; cfg.accessories[type] = Math.max(0, Math.min(max, cur + delta));
    var el = $('accQty_' + type); if (el) el.textContent = cfg.accessories[type];
    updateBuildSummary();
  }
  function updateBuildSummary() {
    var totalSeats = cfg.rowConfigs.reduce(function (s, rc) { return s + rc.seats; }, 0);
    var maxRow = cfg.rowConfigs.reduce(function (m, rc) { return Math.max(m, rc.seats); }, 0);
    var rc = E.rangeConfig(cfg.range);
    var widthM = (maxRow * rc.seat_width_mm / 1000).toFixed(2);
    $('ssiTotal').textContent = totalSeats || '—';
    $('ssiRows').textContent = cfg.rows || '—';
    $('ssiWidth').textContent = totalSeats ? widthM + 'm' : '—';
    updateLivePanel(E.entries(cfg));
    $('btnNext').disabled = stepNextDisabled();
  }
  function updateLivePanel(entries) {
    var lines = $('liveLines');
    if (!entries.length) {
      lines.innerHTML = '<div class="live-empty">No items yet</div>';
      $('liveTotalRow').style.display = 'none';
      $('buildPlanWrap').innerHTML = '<div class="plan-empty">Configure rows to see the floor plan</div>';
      return;
    }
    var tradeTot = 0, srpTot = 0;
    lines.innerHTML = entries.map(function (e) {
      tradeTot += e.tradeTot; srpTot += e.srpTot;
      return '<div class="live-line"><span class="ll-name">' + e.qty + '× ' + esc(e.shortName) + '</span><span class="ll-price">£' + fmt(e.tradeTot, 0) + '</span></div>';
    }).join('');
    $('liveTradeTot').textContent = '£' + fmt(tradeTot);
    $('liveSrpTot').textContent = '£' + fmt(srpTot);
    $('liveTotalRow').style.display = '';
    $('buildPlanWrap').innerHTML = buildSeatPlanSVG(entries, false);
  }

  // ── Step 5: Summary ──────────────────────────────────────────────────────────
  function renderSummaryStep() {
    var entries = E.entries(cfg);
    var r = E.range(cfg.range) || {}, m = E.material(cfg.material) || {};
    var tradeTot = 0, srpTot = 0; entries.forEach(function (e) { tradeTot += e.tradeTot; srpTot += e.srpTot; });
    $('summaryDate').textContent = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    var totalSeats = cfg.rowConfigs.reduce(function (s, rc) { return s + rc.seats; }, 0);
    var motors = E.motorTypes(cfg.range), multi = motors.length > 1;
    var optLabels = cfg.options.map(function (id) { var f = E.finishOptions(cfg.manufacturer).find(function (x) { return x.id === id; }); return f ? f.label : null; }).filter(Boolean);
    var rowBreak = cfg.rowConfigs.map(function (rc, i) { return 'Row ' + String.fromCharCode(65 + i) + ': ' + rc.seats + ' seat' + (rc.seats !== 1 ? 's' : '') + (multi ? ' (' + motorLabel(rc.motorType) + ')' : ''); }).join(' · ');
    var mfr = E.manufacturer(cfg.manufacturer) || {};

    $('configStrip').innerHTML =
      block('Manufacturer', esc(mfr.name || '')) +
      block('Range', esc(r.name || ''), esc(r.tagline || '')) +
      block('Upholstery', esc(m.name || cfg.material), esc(cfg.colour || 'Colour TBC')) +
      block('Configuration', totalSeats + ' Seats', esc(rowBreak)) +
      block('Finish', optLabels.length ? esc(optLabels.join(', ')) : 'Standard') +
      block('Trade Total (ex VAT)', '£' + fmt(tradeTot), 'SRP ex VAT: £' + fmt(srpTot));

    $('summaryPlanWrap').innerHTML = buildSeatPlanSVG(entries, true);

    $('quoteBody').innerHTML = entries.map(function (e) {
      return '<tr><td>' + esc(e.item.item_name) + (e.item.size_label ? ' <span style="color:var(--sc-muted);font-size:9.5px">(' + esc(e.item.size_label) + ')</span>' : '') + '</td>' +
        '<td class="sku-cell">' + esc(e.sku || '—') + '</td><td class="price-cell">' + e.qty + '</td>' +
        '<td class="price-cell">£' + fmt(e.trade) + '</td><td class="price-cell">£' + fmt(e.tradeTot) + '</td>' +
        '<td class="price-cell" style="color:var(--sc-muted)">£' + fmt(e.srpTot) + '</td></tr>';
    }).join('') + '<tr class="total-row"><td colspan="4">Total (ex VAT)</td><td class="price-cell">£' + fmt(tradeTot) + '</td><td class="price-cell" style="color:var(--sc-muted)">£' + fmt(srpTot) + '</td></tr>';
  }
  function block(lbl, val, note) { return '<div class="cs-block"><div class="cs-lbl">' + lbl + '</div><div class="cs-val">' + val + '</div>' + (note ? '<div class="cs-note">' + note + '</div>' : '') + '</div>'; }

  // ── Seating-plan SVG (ported from Cineca; dims from range.config) ───────────
  function buildSeatPlanSVG(entries, large) {
    var dim = E.rangeConfig(cfg.range).plan_dims || { w: 72, d: 82, arm: 13, label: '' };
    var ROW_GAP = 22, MX = large ? 54 : 44, MY = 32, OTT_W = 52, OTT_H = 36, OTT_GAP = 10, BB_W = 48, BB_H = 44, STL_W = 32, STL_H = 32, HDR_H = 18;
    var CRN_W = Math.round(dim.w * 0.85), CRN_GAP = 12;
    var counts = {}; entries.forEach(function (e) { counts[e.item.item_type] = (counts[e.item.item_type] || 0) + e.qty; });
    var seatQty = counts.seat || 0, armQty = counts.armrest || 0, ottQty = counts.ottoman || 0, chaiseQty = counts.chaise || 0, cornerQty = counts.corner || 0, headrestQty = counts.headrest || 0, bbQty = counts.bean_bag || 0, stoolQty = counts.stool || 0;
    if (!seatQty) return '<svg viewBox="0 0 320 70" width="320" height="70" style="display:block"><text x="160" y="38" text-anchor="middle" fill="#3a3028" font-size="11" font-family="system-ui">Configure rows to see the seating plan</text></svg>';

    var hasArms = armQty > 0, hasCorner = cornerQty > 0;
    var rowSeats = cfg.rowConfigs.length ? cfg.rowConfigs.map(function (rc) { return rc.seats; }) : [seatQty];
    var rows = rowSeats.length, maxSeats = Math.max.apply(null, rowSeats);
    var rowW = maxSeats * dim.w + (hasArms ? (maxSeats + 1) * dim.arm : 0);
    var chaiseW = chaiseQty > 0 ? Math.round(dim.w * 1.45) + 14 : 0;
    var cornerW = hasCorner ? CRN_W + CRN_GAP : 0;
    var extraAccW = (bbQty * (BB_W + OTT_GAP) + stoolQty * (STL_W + OTT_GAP));
    var innerW = Math.max(rowW + chaiseW + cornerW + 20, ottQty * (OTT_W + OTT_GAP) + MX, extraAccW + MX);
    var totalW = innerW + MX * 2;
    var ottH = ottQty > 0 ? OTT_H + 18 : 0;
    var seatingH = rows * dim.d + (rows - 1) * ROW_GAP;
    var extraH = (bbQty > 0 || stoolQty > 0) ? Math.max(BB_H, STL_H) + 18 : 0;
    var totalH = MY + ottH + seatingH + extraH + MY + 16;
    var els = [];
    els.push('<rect x="0" y="0" width="' + totalW + '" height="' + totalH + '" rx="6" fill="#0e0c09" stroke="rgba(201,168,92,.18)" stroke-width="1.5"/>');
    for (var gx = MX; gx < totalW - MX; gx += 36) els.push('<line x1="' + gx + '" y1="' + MY + '" x2="' + gx + '" y2="' + (totalH - MY) + '" stroke="rgba(255,255,255,.018)" stroke-width="1"/>');
    for (var gy = MY; gy < totalH - MY; gy += 36) els.push('<line x1="' + MX + '" y1="' + gy + '" x2="' + (totalW - MX) + '" y2="' + gy + '" stroke="rgba(255,255,255,.018)" stroke-width="1"/>');
    var sX = MX, sY = MY, sW = totalW - MX * 2;
    els.push('<rect x="' + (sX - 8) + '" y="' + (sY - 8) + '" width="' + (sW + 16) + '" height="6" fill="rgba(201,168,92,.07)" stroke="rgba(201,168,92,.12)" stroke-width="1"/>');
    var curY = sY;
    if (ottQty > 0) {
      var ottTW = ottQty * OTT_W + (ottQty - 1) * OTT_GAP, ottX0 = sX + (sW - ottTW) / 2;
      for (var oi = 0; oi < ottQty; oi++) {
        var ox = ottX0 + oi * (OTT_W + OTT_GAP);
        els.push('<rect x="' + ox + '" y="' + curY + '" width="' + OTT_W + '" height="' + OTT_H + '" rx="7" fill="rgba(128,88,161,.18)" stroke="rgba(128,88,161,.45)" stroke-width="1"/>');
        els.push('<text x="' + (ox + OTT_W / 2) + '" y="' + (curY + OTT_H + 11) + '" text-anchor="middle" fill="rgba(122,112,96,.5)" font-size="7" font-family="system-ui" letter-spacing="1">OTTOMAN</text>');
      }
      curY += OTT_H + 18;
    }
    var gsn = 1;
    rowSeats.forEach(function (nSeats, rowIdx) {
      var rowLabel = String.fromCharCode(65 + rowIdx);
      var hasChaise = rowIdx === 0 && chaiseQty > 0;
      var hasCornerRow = hasCorner && rowIdx < Math.min(cornerQty, rows);
      var rW = nSeats * dim.w + (hasArms ? (nSeats + 1) * dim.arm : 0);
      var thisChW = hasChaise ? Math.round(dim.w * 1.45) + 14 : 0;
      var thisCrW = hasCornerRow ? CRN_W + CRN_GAP : 0;
      var rowX = sX + (sW - rW - thisChW - thisCrW) / 2;
      els.push('<text x="' + (rowX - 16) + '" y="' + (curY + dim.d / 2 + 4) + '" text-anchor="middle" fill="rgba(201,168,92,.45)" font-size="9" font-family="system-ui" font-weight="700">' + rowLabel + '</text>');
      var cx = rowX;
      for (var s = 0; s < nSeats; s++) {
        var num = gsn++;
        if (hasArms) { els.push('<rect x="' + cx + '" y="' + (curY + 10) + '" width="' + dim.arm + '" height="' + (dim.d - 20) + '" rx="2" fill="rgba(201,168,92,.22)" stroke="rgba(201,168,92,.15)" stroke-width="1"/>'); cx += dim.arm; }
        var headH = Math.round(dim.d * 0.28), cushH = Math.round(dim.d * 0.48), restH = Math.round(dim.d * 0.24);
        els.push('<rect x="' + cx + '" y="' + curY + '" width="' + dim.w + '" height="' + dim.d + '" rx="4" fill="rgba(128,88,161,.22)" stroke="rgba(128,88,161,.5)" stroke-width="1.2"/>');
        els.push('<rect x="' + (cx + 3) + '" y="' + (curY + 3) + '" width="' + (dim.w - 6) + '" height="' + headH + '" rx="3" fill="rgba(128,88,161,.45)"/>');
        if (headrestQty >= gsn - 1) els.push('<rect x="' + (cx + 3) + '" y="' + (curY + 3) + '" width="' + (dim.w - 6) + '" height="' + HDR_H + '" rx="2" fill="rgba(90,173,96,.35)" stroke="rgba(90,173,96,.4)" stroke-width="0.8"/>');
        els.push('<rect x="' + (cx + 5) + '" y="' + (curY + headH + 6) + '" width="' + (dim.w - 10) + '" height="' + cushH + '" rx="2" fill="rgba(128,88,161,.18)"/>');
        els.push('<text x="' + (cx + dim.w / 2) + '" y="' + (curY + dim.d - 7) + '" text-anchor="middle" fill="rgba(255,255,255,.45)" font-size="8" font-family="system-ui">' + num + '</text>');
        cx += dim.w;
      }
      if (hasArms) { els.push('<rect x="' + cx + '" y="' + (curY + 10) + '" width="' + dim.arm + '" height="' + (dim.d - 20) + '" rx="2" fill="rgba(201,168,92,.22)" stroke="rgba(201,168,92,.15)" stroke-width="1"/>'); cx += dim.arm; }
      if (hasChaise) {
        var chW = Math.round(dim.w * 1.45), chX = cx + 14;
        els.push('<rect x="' + chX + '" y="' + curY + '" width="' + chW + '" height="' + dim.d + '" rx="4" fill="rgba(128,88,161,.12)" stroke="rgba(128,88,161,.35)" stroke-width="1" stroke-dasharray="5,3"/>');
        els.push('<text x="' + (chX + chW / 2) + '" y="' + (curY + dim.d / 2 + 2) + '" text-anchor="middle" fill="rgba(128,88,161,.6)" font-size="7.5" font-family="system-ui" letter-spacing="2">CHAISE</text>');
        cx += chW + 14;
      }
      if (hasCornerRow) {
        var crX = cx + CRN_GAP, crW = CRN_W, crH = dim.d, notchW = Math.round(crW * 0.45), notchH = Math.round(crH * 0.45);
        els.push('<rect x="' + crX + '" y="' + curY + '" width="' + crW + '" height="' + crH + '" rx="4" fill="rgba(128,88,161,.15)" stroke="rgba(128,88,161,.4)" stroke-width="1"/>');
        els.push('<rect x="' + crX + '" y="' + curY + '" width="' + notchW + '" height="' + notchH + '" rx="3" fill="rgba(13,11,9,.7)"/>');
        els.push('<text x="' + (crX + crW / 2 + 4) + '" y="' + (curY + crH / 2 + 14) + '" text-anchor="middle" fill="rgba(128,88,161,.6)" font-size="7" font-family="system-ui" letter-spacing="1">CRN</text>');
      }
      els.push('<text x="' + (totalW - MX + 14) + '" y="' + (curY + dim.d / 2 + 4) + '" text-anchor="middle" fill="rgba(122,112,96,.4)" font-size="8.5" font-family="system-ui">' + nSeats + '</text>');
      curY += dim.d + ROW_GAP;
    });
    if (bbQty > 0 || stoolQty > 0) {
      var accItems = []; for (var b = 0; b < bbQty; b++) accItems.push('BB'); for (var st = 0; st < stoolQty; st++) accItems.push('STL');
      var totalAccW = accItems.reduce(function (s, t) { return (t === 'BB' ? BB_W : STL_W) + OTT_GAP + s; }, 0) - OTT_GAP;
      var ax = sX + (sW - totalAccW) / 2;
      accItems.forEach(function (t) {
        if (t === 'BB') {
          var bx = ax + BB_W / 2, by = curY + BB_H / 2;
          els.push('<ellipse cx="' + bx + '" cy="' + by + '" rx="' + (BB_W / 2) + '" ry="' + (BB_H / 2) + '" fill="rgba(212,136,58,.18)" stroke="rgba(212,136,58,.45)" stroke-width="1"/>');
          els.push('<text x="' + bx + '" y="' + (curY + BB_H + 11) + '" text-anchor="middle" fill="rgba(122,112,96,.5)" font-size="7" font-family="system-ui" letter-spacing="1">BEAN BAG</text>');
          ax += BB_W + OTT_GAP;
        } else {
          var sx2 = ax + STL_W / 2, sy = curY + STL_W / 2;
          els.push('<circle cx="' + sx2 + '" cy="' + sy + '" r="' + (STL_W / 2) + '" fill="rgba(183,177,167,.14)" stroke="rgba(183,177,167,.4)" stroke-width="1"/>');
          els.push('<text x="' + sx2 + '" y="' + (curY + STL_H + 11) + '" text-anchor="middle" fill="rgba(122,112,96,.5)" font-size="7" font-family="system-ui" letter-spacing="1">STOOL</text>');
          ax += STL_W + OTT_GAP;
        }
      });
      curY += Math.max(BB_H, STL_H) + 18;
    }
    els.push('<line x1="' + (MX - 12) + '" y1="' + (MY - 8) + '" x2="' + (MX - 12) + '" y2="' + (totalH - MY) + '" stroke="rgba(201,168,92,.1)" stroke-width="2"/>');
    els.push('<line x1="' + (totalW - MX + 12) + '" y1="' + (MY - 8) + '" x2="' + (totalW - MX + 12) + '" y2="' + (totalH - MY) + '" stroke="rgba(201,168,92,.1)" stroke-width="2"/>');
    var r = E.range(cfg.range) || {}, m = E.material(cfg.material) || {};
    var totSeats = rowSeats.reduce(function (s, n) { return s + n; }, 0);
    var annY = totalH - 6;
    els.push('<text x="' + MX + '" y="' + annY + '" fill="rgba(122,112,96,.5)" font-size="7.5" font-family="system-ui">' + esc(r.name || '') + '</text>');
    els.push('<text x="' + (totalW / 2) + '" y="' + annY + '" text-anchor="middle" fill="rgba(122,112,96,.5)" font-size="7.5" font-family="system-ui">' + esc(m.name || '') + (cfg.colour ? ' · ' + esc(cfg.colour) : '') + '</text>');
    els.push('<text x="' + (totalW - MX) + '" y="' + annY + '" text-anchor="end" fill="rgba(122,112,96,.5)" font-size="7.5" font-family="system-ui">' + totSeats + ' seat' + (totSeats !== 1 ? 's' : '') + ' · ' + rows + ' row' + (rows !== 1 ? 's' : '') + '</text>');
    els.push('<text x="' + (totalW / 2) + '" y="' + (totalH - 1) + '" text-anchor="middle" fill="rgba(122,112,96,.28)" font-size="6.5" font-family="system-ui" font-style="italic">illustrative plan — not to scale</text>');
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + totalW + ' ' + totalH + '" width="' + (large ? '100%' : totalW) + '" style="max-width:100%;display:block">' + els.join('') + '</svg>';
  }

  // ── Export ────────────────────────────────────────────────────────────────────
  function copySkus() {
    var lines = E.entries(cfg).map(function (e) { return e.sku + '\t' + e.qty + '\t' + e.item.item_name + '\t£' + fmt(e.trade) + '\t£' + fmt(e.tradeTot); });
    navigator.clipboard.writeText(lines.join('\n')).then(function () { toast('SKU list copied'); });
  }
  function exportCsv() {
    var m = E.material(cfg.material) || {};
    var rows = [['SKU', 'Description', 'Manufacturer', 'Range', 'Material', 'Colour', 'Qty', 'Unit Trade', 'Trade Total', 'Unit SRP', 'SRP Total']];
    var mfr = E.manufacturer(cfg.manufacturer) || {}, rng = E.range(cfg.range) || {};
    E.entries(cfg).forEach(function (e) {
      rows.push([e.sku, e.item.item_name, mfr.name || '', rng.name || '', m.name || cfg.material, cfg.colour || 'TBC', e.qty, e.trade.toFixed(2), e.tradeTot.toFixed(2), e.srp.toFixed(2), e.srpTot.toFixed(2)]);
    });
    var csv = rows.map(function (r) { return r.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
    var url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    var a = document.createElement('a'); a.href = url; a.download = 'seating-quote-' + (cfg.manufacturer || 'x') + '-' + (cfg.range || 'x') + '-' + new Date().toISOString().slice(0, 10) + '.csv'; a.click();
    URL.revokeObjectURL(url); toast('CSV exported');
  }
  function printSummary() { global.print(); }

  global.SeatingApp = {
    boot: boot, jumpTo: jumpTo, goBack: goBack, resetConfig: resetConfig,
    selectManufacturer: selectManufacturer, selectRange: selectRange,
    selectMaterial: selectMaterial, selectColour: selectColour, toggleFinish: toggleFinish,
    setRows: setRows, setRowSeats: setRowSeats, setRowMotorType: setRowMotorType,
    toggleArmrests: toggleArmrests, changeAcc: changeAcc,
    copySkus: copySkus, exportCsv: exportCsv, printSummary: printSummary
  };
})(typeof window !== 'undefined' ? window : this);
