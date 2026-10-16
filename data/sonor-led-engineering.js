/**
 * sonor-led-engineering.js — CANONICAL MASTER (workspace root → data/ in every app via sync-everything)
 * v1.0.0 · 2026-10-16 — Bryn: "what do we have for calcing led strips and drivers and cable feed points etc, does this need
 *   more work? and outputting to pdf schedule needs perfecting."
 *
 * ONE LED engineering calc for the whole workspace. Takeoffs (LED Schedule aspect + cable schedule feeds), Lighting Design
 * (LED & Drivers step + proposal PDF) and anything else that sizes a strip run call THIS — never a local 80 % rule.
 *
 *   SonorLedEng.run(run, stripType, opts)      → one engineered run (segments, feeds, driver, cable, flags)
 *   SonorLedEng.project(runs, stripsById, opts) → every run engineered + totals (strip m by type +waste, drivers by size,
 *                                                  controller channels, feed cable by csa) + schedule rows for a PDF
 *   SonorLedEng.driverFor(loadW, opts)        → { driver_w, drivers, loaded_pct }
 *   SonorLedEng.feedCable(loadW, volts, lengthM, opts) → { csa, amps, drop_v, drop_pct, ok }
 *
 * Inputs (all plain objects, no DOM):
 *   run  = { id, label, floor, room, metres, ledId, feeds: [m, m, …] | null, feedCableM: number | [per feed], driverAt: text,
 *            custom_feed_interval_m, dimming: 'dmx'|'0-10v'|'pwm'|'dali'|null }
 *   stripType (pm_led_strip_types row) = { id, label, watts_per_metre, volts, dmx_channels, kelvin, ip_rating,
 *            metadata: { max_single_feed_m?, lm_per_m?, default_cable_run_m?, default_cable_package? } }
 *
 * Engineering rules (Sonor house, 2026-08-20 lighting research + Bryn 2026-05-11 feed markers):
 *   · Load = metres × W/m. Driver ≥ load ÷ 0.8 (20 % headroom), next STANDARD size up (30 60 100 150 200 240 320 W);
 *     above the biggest → split into n drivers; a run never shares a driver across rooms.
 *   · Feed points: a strip is fed at most every MAX_SINGLE_FEED m (per type; default by W/m and V — see maxFeedM) so the
 *     far end holds ≥ 97 % of nominal volts. Manual markers win; otherwise ceil(metres / interval) evenly spaced from 0.
 *   · Feed cable: copper, two-core, voltage drop = 2 × L × I × ρ ÷ A with ρ = 0.0175 Ω·mm²/m; target ≤ 3 % (24 V ≈ 0.72 V),
 *     hard limit 5 %. csa from the trade sizes 0.75 / 1.0 / 1.5 / 2.5 / 4.0 / 6.0 mm². Each feed carries the load of the
 *     strip either side of it up to half-way to the next feed.
 *   · Controller channels: dmx_channels per strip type (RGBW 4, TW 2, SC 1, pixel ≥ 10 → data, not channels) → decoders
 *     sized at 4 ch per decoder (configurable), 1 per room group.
 *   · Waste: strip metres +10 % and rounded up to the 5 m reel (configurable).
 */
(function (global) {
  'use strict';
  var VERSION = '1.1.0';   // v1.1.0 2026-10-16 — control method (DMX / triac / 0-10V / DALI / switched) + DMX addressing on xx1 blocks (Bryn: "RGBW led will be dmx controlled … main also have triac dimmable driver, need options for all this … including DMX channel assignment")

  var DEFAULTS = {
    headroom: 0.8,                                   // driver ≥ load / headroom
    driverSizes: [30, 60, 100, 150, 200, 240, 320],  // W — standard CV sizes stocked
    maxDriverPerRoom: 6,
    dropTargetPct: 3, dropLimitPct: 5,
    rho: 0.0175,                                     // Ω·mm²/m copper
    csaSizes: [0.75, 1.0, 1.5, 2.5, 4.0, 6.0],
    defaultFeedCableM: 10,
    wastePct: 10, reelM: 5,
    decoderChannels: 4,
    dmxUniverseSize: 512,                            // DMX512 — addresses 1…512 per universe
    dmxBlock: 10,                                    // Sonor house rule (Bryn 16.10.26): every device starts on an xx1 address — 001, 011, 021 … (10-address blocks; a device needing more spans blocks)
    pixelControllerOutputs: 4,                       // outputs per pixel controller (data runs)
    maxFeedM: function (st) {                        // single-feed length by W/m and V when the type carries none
      var v = Number(st.volts) || 24, w = Number(st.watts_per_metre) || 10;
      if (v <= 5) return 3; if (v <= 12) return 5;
      if (w > 15) return 5; if (w > 10) return 7; return 10;
    }
  };
  function cfg(o) { var c = {}; Object.keys(DEFAULTS).forEach(function (k) { c[k] = DEFAULTS[k]; }); Object.keys(o || {}).forEach(function (k) { if (o[k] !== undefined) c[k] = o[k]; }); return c; }
  function num(x, d) { var n = Number(x); return isFinite(n) ? n : (d || 0); }
  function r1(x) { return Math.round(x * 10) / 10; }

  // ── control method ───────────────────────────────────────────────────────
  // run.control wins → strip metadata.control_default → house rule: data / pixel strips and anything with ≥ 2 channels
  // (RGB, RGBW, tunable white) are DMX; single-colour strips are on a TRIAC-dimmable CV driver (mains-dimmed from the
  // lighting panel). '0-10v' / 'dali' / 'switched' are explicit choices.
  var CONTROLS = {
    dmx:      { id: 'dmx',      label: 'DMX',               driver: 'CV driver + DMX decoder',            circuit: 'dmx' },
    triac:    { id: 'triac',    label: 'Triac dimmable',    driver: 'Triac-dimmable CV driver (mains-dimmed)', circuit: 'centralised' },
    '0-10v':  { id: '0-10v',    label: '0-10V',             driver: '0-10V dimmable CV driver',          circuit: '0-10v' },
    dali:     { id: 'dali',     label: 'DALI',              driver: 'DALI dimmable CV driver',           circuit: 'dali' },
    switched: { id: 'switched', label: 'Switched (on/off)', driver: 'CV driver, switched',               circuit: 'centralised' }
  };
  function controlFor(rn, st) {
    var ex = String((rn && rn.control) || '').toLowerCase(); if (CONTROLS[ex]) return CONTROLS[ex];
    var md = (st && st.metadata && String(st.metadata.control_default || '').toLowerCase()) || ''; if (CONTROLS[md]) return CONTROLS[md];
    var ch = num(st && st.dmx_channels, 1), data = ch >= 10 || /pixel|address/i.test(String((st && (st.label || st.id)) || ''));
    return (data || ch >= 2) ? CONTROLS.dmx : CONTROLS.triac;
  }
  function stripMaxFeedM(st, c) { var m = st && st.metadata && Number(st.metadata.max_single_feed_m); return m > 0 ? m : c.maxFeedM(st || {}); }

  // ── drivers ──────────────────────────────────────────────────────────────
  function driverFor(loadW, o) {
    var c = cfg(o); loadW = num(loadW); if (loadW <= 0) return { driver_w: 0, drivers: 0, loaded_pct: 0 };
    var minW = loadW / c.headroom, sizes = c.driverSizes.slice().sort(function (a, b) { return a - b; });
    for (var i = 0; i < sizes.length; i++) if (sizes[i] >= minW) return { driver_w: sizes[i], drivers: 1, loaded_pct: Math.round(loadW / sizes[i] * 100) };
    var big = sizes[sizes.length - 1], n = Math.ceil(minW / big);
    // a split run: re-pick the smallest standard size that still fits each share
    var share = loadW / n / c.headroom, pick = big; for (var j = 0; j < sizes.length; j++) if (sizes[j] >= share) { pick = sizes[j]; break; }
    return { driver_w: pick, drivers: n, loaded_pct: Math.round(loadW / (pick * n) * 100) };
  }

  // ── feed cable ───────────────────────────────────────────────────────────
  function feedCable(loadW, volts, lengthM, o) {
    var c = cfg(o); volts = num(volts, 24); lengthM = num(lengthM, c.defaultFeedCableM); loadW = num(loadW);
    var amps = volts > 0 ? loadW / volts : 0, out = null;
    for (var i = 0; i < c.csaSizes.length; i++) {
      var a = c.csaSizes[i], dropV = 2 * lengthM * amps * c.rho / a, pct = volts > 0 ? dropV / volts * 100 : 0;
      out = { csa: a, amps: r1(amps), drop_v: Math.round(dropV * 100) / 100, drop_pct: r1(pct), length_m: r1(lengthM), ok: pct <= c.dropTargetPct, limit: pct <= c.dropLimitPct };
      if (out.ok) return out;
    }
    return out;   // biggest size, still over — flagged by ok:false
  }

  // ── one run ──────────────────────────────────────────────────────────────
  function run(rn, st, o) {
    var c = cfg(o); st = st || {}; rn = rn || {};
    var metres = num(rn.metres), wpm = num(st.watts_per_metre, 10), volts = num(st.volts, 24);
    var load = metres * wpm, maxFeed = stripMaxFeedM(st, c), notes = [], flags = [];
    if (!(metres > 0)) return null;
    // feed points
    var feeds = Array.isArray(rn.feeds) && rn.feeds.length ? rn.feeds.map(num).filter(function (m) { return m >= 0 && m <= metres + 0.01; }).sort(function (a, b) { return a - b; }) : null;
    var manual = !!feeds;
    var interval = num(rn.custom_feed_interval_m) > 0 ? num(rn.custom_feed_interval_m) : maxFeed;
    if (!feeds) { var n = Math.max(1, Math.ceil(metres / interval)); feeds = []; for (var i = 0; i < n; i++) feeds.push(r1(n === 1 ? 0 : i * (metres / n))); }
    // coverage check: the far end and the gaps between feeds must each be inside maxFeed (a single feed covers maxFeed one way)
    var worst = 0;
    for (var k = 0; k < feeds.length; k++) {
      var prev = k === 0 ? null : feeds[k - 1], next = k === feeds.length - 1 ? null : feeds[k + 1];
      var reachBack = prev == null ? feeds[k] : (feeds[k] - prev) / 2, reachFwd = next == null ? metres - feeds[k] : (next - feeds[k]) / 2;
      worst = Math.max(worst, reachBack, reachFwd);
    }
    if (worst > maxFeed + 0.05) flags.push('UNDER-FED');
    if (worst > maxFeed + 0.05) notes.push('strip reach ' + r1(worst) + ' m from a feed — ' + (manual ? 'add a feed marker' : 'feed every ' + maxFeed + ' m') + ' (max ' + maxFeed + ' m at ' + volts + ' V / ' + wpm + ' W/m)');
    // load per feed = strip either side to half-way to the neighbour
    var perFeed = feeds.map(function (f, k) {
      var prev = k === 0 ? 0 : (feeds[k - 1] + f) / 2, next = k === feeds.length - 1 ? metres : (f + feeds[k + 1]) / 2;
      return r1((next - prev) * wpm);
    });
    // feed cable per feed
    var cableLens = Array.isArray(rn.feedCableM) ? rn.feedCableM : null;
    var cableDef = num(rn.feedCableM) > 0 ? num(rn.feedCableM) : (num(st.metadata && st.metadata.default_cable_run_m) > 0 ? num(st.metadata.default_cable_run_m) : c.defaultFeedCableM);
    var cables = feeds.map(function (f, k) { var L = cableLens ? num(cableLens[k], cableDef) : cableDef; return feedCable(perFeed[k], volts, L, c); });
    var worstCable = cables.reduce(function (a, b) { return !a || b.drop_pct > a.drop_pct ? b : a; }, null);
    if (worstCable && !worstCable.limit) { flags.push('VOLT DROP'); notes.push('feed cable drop ' + worstCable.drop_pct + ' % at ' + worstCable.csa + ' mm² — shorten the feed or move the driver'); }
    else if (worstCable && !worstCable.ok) notes.push('feed cable ' + worstCable.csa + ' mm² needed (' + worstCable.drop_pct + ' % drop)');
    var drv = driverFor(load, c);
    var ch = num(st.dmx_channels, 1), data = ch >= 10 || /pixel|address/i.test(String(st.label || st.id || ''));
    var ctl = controlFor(rn, st);
    var dmxCh = ctl.id === 'dmx' ? (data ? 0 : Math.max(1, ch)) : 0;   // data strips take a pixel-controller output, not channels
    return {
      id: rn.id || rn.label || '', label: rn.label || rn.id || '', floor: rn.floor || '', room: rn.room || '',
      strip: { id: st.id || rn.ledId || '', label: st.label || rn.ledLabel || 'LED strip', volts: volts, wpm: wpm, channels: ch, data: data, kelvin: st.kelvin || null, ip: st.ip_rating || null, maxFeedM: maxFeed },
      metres: r1(metres), load_w: r1(load),
      feeds: feeds, feedsManual: manual, feedLoads_w: perFeed, cables: cables, cable: worstCable,
      driver: drv, driverAt: rn.driverAt || rn.driver_location || null, dimming: rn.dimming || (data ? 'data' : (ch > 1 ? 'dmx' : null)),
      control: ctl.id, controlLabel: ctl.label, driverType: ctl.driver, circuitType: ctl.circuit, controlExplicit: !!(rn && rn.control),
      dmx: ctl.id === 'dmx' ? { channels: dmxCh, data: data, universe: num(rn.dmx_universe) > 0 ? num(rn.dmx_universe) : null, address: num(rn.dmx_address) > 0 ? num(rn.dmx_address) : null, manual: num(rn.dmx_address) > 0 } : null,
      flags: flags, notes: notes
    };
  }

  // ── a project ────────────────────────────────────────────────────────────
  function project(runs, stripsById, o) {
    var c = cfg(o); stripsById = stripsById || {};
    var out = [], byType = {}, drivers = {}, channels = {}, cable = {}, rooms = {};
    (runs || []).forEach(function (rn) {
      var st = stripsById[rn.ledId] || stripsById[String(rn.ledId || '').toUpperCase()] || (rn.strip || null) || { id: rn.ledId, label: rn.ledLabel, watts_per_metre: rn.wpm || 10, volts: rn.volts || 24, dmx_channels: rn.channels || 1 };
      var e = run(rn, st, c); if (!e) return; out.push(e);
      var t = byType[e.strip.id || e.strip.label] = byType[e.strip.id || e.strip.label] || { id: e.strip.id, label: e.strip.label, volts: e.strip.volts, wpm: e.strip.wpm, metres: 0, runs: 0, load_w: 0 };
      t.metres += e.metres; t.runs++; t.load_w += e.load_w;
      var dk = e.driver.driver_w + ' W'; drivers[dk] = (drivers[dk] || 0) + e.driver.drivers;
      if (!e.strip.data) { var rk = (e.floor || '') + ' · ' + (e.room || ''); rooms[rk] = (rooms[rk] || 0) + e.strip.channels; }
      e.cables.forEach(function (cb) { var ck = cb.csa + ' mm²'; cable[ck] = (cable[ck] || 0) + cb.length_m; });
    });
    Object.keys(byType).forEach(function (k) { var t = byType[k]; t.metres = r1(t.metres); t.load_w = r1(t.load_w); t.order_m = Math.ceil(t.metres * (1 + c.wastePct / 100) / c.reelM) * c.reelM; });
    var decoders = 0; Object.keys(rooms).forEach(function (k) { decoders += Math.ceil(rooms[k] / c.decoderChannels); channels[k] = rooms[k]; });
    // ── DMX addressing (v1.1.0): manual addresses are honoured; the rest are packed in run order from the next free address,
    // one universe of 512 then the next. Data / pixel strips take pixel-controller outputs instead (PX1, PX2 …).
    var used = {};   // universe → [[from,to]]
    out.forEach(function (e) { if (e.dmx && e.dmx.manual && e.dmx.channels) { var u = e.dmx.universe || 1; (used[u] = used[u] || []).push([e.dmx.address, e.dmx.address + e.dmx.channels - 1]); e.dmx.universe = u; } });
    var cur = { u: 1, a: 1 }, pxOut = 0;
    function free(u, a, n) { var r = used[u] || []; for (var i = 0; i < r.length; i++) { if (a <= r[i][1] && a + n - 1 >= r[i][0]) return false; } return true; }
    out.forEach(function (e) {
      if (!e.dmx) return;
      if (e.dmx.data) { pxOut++; e.dmx.universe = null; e.dmx.output = 'PX' + Math.ceil(pxOut / c.pixelControllerOutputs) + '-' + (((pxOut - 1) % c.pixelControllerOutputs) + 1); return; }
      if (e.dmx.manual) return;
      var n = e.dmx.channels, blk = Math.max(1, num(c.dmxBlock, 10));
      var snap = function (a) { return Math.floor((a - 1) / blk) * blk + 1; };   // → the xx1 at or below a
      if (snap(cur.a) !== cur.a) cur.a = snap(cur.a) + blk;                     // never start mid-block
      while (true) { if (cur.a + n - 1 > c.dmxUniverseSize) { cur.u++; cur.a = 1; } if (free(cur.u, cur.a, n)) break; cur.a += blk; }
      e.dmx.universe = cur.u; e.dmx.address = cur.a; (used[cur.u] = used[cur.u] || []).push([cur.a, cur.a + n - 1]);
      cur.a += Math.ceil(n / blk) * blk;                                        // next device on the next free xx1
    });
    var dmxRuns = out.filter(function (e) { return e.dmx && !e.dmx.data; }), dmxCh = dmxRuns.reduce(function (a, e) { return a + e.dmx.channels; }, 0);
    var byControl = {}; out.forEach(function (e) { byControl[e.control] = (byControl[e.control] || 0) + 1; });
    var totalM = out.reduce(function (a, e) { return a + e.metres; }, 0), totalW = out.reduce(function (a, e) { return a + e.load_w; }, 0);
    return {
      version: VERSION, runs: out,
      totals: { runs: out.length, metres: r1(totalM), load_w: r1(totalW), drivers: Object.keys(drivers).reduce(function (a, k) { return a + drivers[k]; }, 0), feeds: out.reduce(function (a, e) { return a + e.feeds.length; }, 0), flagged: out.filter(function (e) { return e.flags.length; }).length },
      byType: Object.keys(byType).map(function (k) { return byType[k]; }).sort(function (a, b) { return b.metres - a.metres; }),
      drivers: Object.keys(drivers).sort(function (a, b) { return parseFloat(a) - parseFloat(b); }).map(function (k) { return { size: k, qty: drivers[k] }; }),
      controllers: { channelsByRoom: channels, decoders: decoders, decoderChannels: c.decoderChannels,
        dmx: { runs: dmxRuns.length, channels: dmxCh, universes: Object.keys(used).length, decoders: Math.ceil(dmxCh / c.decoderChannels), pixelOutputs: pxOut, pixelControllers: Math.ceil(pxOut / c.pixelControllerOutputs) },
        byControl: byControl, triacDrivers: out.filter(function (e) { return e.control === 'triac'; }).reduce(function (a, e) { return a + e.driver.drivers; }, 0) },
      cable: Object.keys(cable).sort(function (a, b) { return parseFloat(a) - parseFloat(b); }).map(function (k) { return { csa: k, metres: Math.ceil(cable[k] * 1.15) }; }),   // +15 % like every other cable estimate
      schedule: out.map(scheduleRow)
    };
  }
  // one flat row per run for a schedule table (Takeoffs aspect / Lighting PDF) — strings, service order kept by the caller
  function scheduleRow(e) {
    var drv = e.driver.drivers ? ((e.driver.drivers > 1 ? e.driver.drivers + ' × ' : '') + e.driver.driver_w + ' W' + (e.driver.loaded_pct ? ' (' + e.driver.loaded_pct + ' %)' : '')) : '—';
    var feeds = e.feeds.length + (e.feedsManual ? ' (marked)' : '') + ' @ ' + e.feeds.map(function (m) { return m + 'm'; }).join(', ');
    var cab = e.cable ? e.cable.csa + ' mm² · ' + e.cable.length_m + ' m · ' + e.cable.drop_pct + ' %' : '—';
    return [e.floor || '—', e.id || '—', e.room || '—', e.strip.label + ' · ' + e.strip.volts + ' V · ' + e.strip.wpm + ' W/m', e.metres.toFixed(1), e.load_w.toFixed(0), feeds, drv, e.driverAt || 'local (accessible)', cab, e.controlLabel || '—', dmxText(e), (e.flags.length ? e.flags.join(' · ') + ' — ' : '') + e.notes.join('; ')];
  }
  function dmxText(e) {
    if (!e.dmx) return '—';
    if (e.dmx.data) return 'pixel ' + (e.dmx.output || 'output');
    if (!e.dmx.universe || !e.dmx.address) return e.dmx.channels + ' ch';
    var pad = function (n) { return ('00' + n).slice(-3); };
    return 'U' + e.dmx.universe + ' · ' + pad(e.dmx.address) + (e.dmx.channels > 1 ? '–' + pad(e.dmx.address + e.dmx.channels - 1) : '') + (e.dmx.manual ? ' (set)' : '');
  }
  var SCHEDULE_HEADERS = ['Floor', 'ID', 'Room', 'Strip', 'Metres', 'Load W', 'Feeds', 'Driver', 'Driver at', 'Feed cable', 'Control', 'DMX', 'Notes'];

  global.SonorLedEng = { VERSION: VERSION, DEFAULTS: DEFAULTS, CONTROLS: CONTROLS, controlFor: controlFor, dmxText: dmxText, run: run, project: project, driverFor: driverFor, feedCable: feedCable, stripMaxFeedM: function (st) { return stripMaxFeedM(st, cfg()); }, scheduleRow: scheduleRow, SCHEDULE_HEADERS: SCHEDULE_HEADERS };
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
