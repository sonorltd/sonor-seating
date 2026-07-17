/* Sonor Seating Configurator — data engine (v0.2.0)
   SonorSeating — reads the Library SSOT (furniture_ranges + furniture_catalogue).
   4-tier load: Supabase → localStorage → bundled seed → inline empty.
   MSRP = furniture_catalogue.sell_price_gbp. No catalogue data hardcoded here.
*/
(function (global) {
  'use strict';
  var CFG = global.__SEATING_CONFIG__ || {};
  var ACC = CFG.accessoryTypes || [];
  var CACHE = CFG.cacheKey || 'sonor_seating_ssot_v2';

  var ranges = [], catalogue = [], idx = null, source = null;

  async function load() {
    // Tier 1 — Supabase live
    try {
      if (typeof global.SonorDB !== 'undefined') {
        var db = new global.SonorDB();
        var r = await db.client.from('furniture_ranges').select('*').order('sort_order');
        var c = await db.client.from('furniture_catalogue').select('*').order('sort_order');
        if (!r.error && !c.error && (r.data || []).length) {
          ranges = r.data; catalogue = c.data; source = 'supabase';
          try { localStorage.setItem(CACHE, JSON.stringify({ ranges: ranges, catalogue: catalogue })); } catch (e) {}
          _index(); return { source: source, db: db };
        }
      }
    } catch (e) { console.warn('[SonorSeating] supabase tier:', e && e.message); }
    // Tier 2 — cache
    try {
      var cached = JSON.parse(localStorage.getItem(CACHE) || 'null');
      if (cached && (cached.ranges || []).length) { ranges = cached.ranges; catalogue = cached.catalogue; source = 'cache'; _index(); return { source: source, db: null }; }
    } catch (e) {}
    // Tier 3 — bundled seed
    if (global.__SEATING_SEED__ && (global.__SEATING_SEED__.ranges || []).length) {
      ranges = global.__SEATING_SEED__.ranges; catalogue = global.__SEATING_SEED__.catalogue; source = 'seed'; _index(); return { source: source, db: null };
    }
    // Tier 4 — empty
    ranges = []; catalogue = []; source = 'inline'; _index(); return { source: source, db: null };
  }

  function _index() {
    idx = { rangeById: {}, itemsByRange: {} };
    ranges.forEach(function (r) { idx.rangeById[r.id] = r; });
    catalogue.forEach(function (it) { (idx.itemsByRange[it.range_id] = idx.itemsByRange[it.range_id] || []).push(it); });
    Object.values(idx.itemsByRange).forEach(function (a) { a.sort(function (x, y) { return (x.sort_order || 0) - (y.sort_order || 0); }); });
  }

  // ── ranges ────────────────────────────────────────────────────────────────
  function seatingRanges() {
    return ranges.filter(function (r) { return r.enabled !== false && (r.metadata || {}).seating_range === true; });
  }
  function range(id) { return idx.rangeById[id] || null; }
  function itemsOf(rangeId) { return idx.itemsByRange[rangeId] || []; }
  function feature(r, key) { return !!(((r.capability || {}).features) || {})[key]; }
  function priced(r) { return (r.pricing_from || {}).sell != null; }
  function fromPrice(r) { var p = (r.pricing_from || {}).sell; return p != null ? Number(p) : null; }

  // primary seat items of a range (Seating type, not armrest)
  function seatItems(rangeId) {
    return itemsOf(rangeId).filter(function (i) { return i.furniture_type === 'Seating' && !/armrest/i.test(i.label || ''); });
  }
  function armrestItems(rangeId) { return itemsOf(rangeId).filter(function (i) { return /armrest/i.test(i.label || ''); }); }
  function accessoryItems(rangeId) {
    return itemsOf(rangeId).filter(function (i) {
      var t = (i.furniture_type || '').toLowerCase();
      return t !== 'seating' || /ottoman|footrest|table|console/i.test(i.label || '');
    });
  }

  // motor variants a range's seat items expose (from Cineca motor_type or capability)
  function motorOptions(r) {
    var m = (r.capability || {}).motor_options;
    if (m && m.length) return m;
    // derive from labels
    var set = [];
    seatItems(r.id).forEach(function (i) {
      var lbl = (i.label || '').toLowerCase();
      var mt = /2-?motor/.test(lbl) ? '2motor' : /1-?motor/.test(lbl) ? '1motor' : /fixed|non-reclin/.test(lbl) ? 'fixed' : null;
      if (mt && set.indexOf(mt) < 0) set.push(mt);
    });
    return set;
  }

  // seat width used for layout math (mm)
  function seatWidthMm(r) {
    var c = r.capability || {};
    return c.seat_width_min_mm || c.seat_width_mm || (CFG.clearance && CFG.clearance.seatFallbackWidthMm) || 650;
  }

  // MSRP for an item (sell). qty pricing
  function itemSell(it) { return it && it.sell_price_gbp != null ? Number(it.sell_price_gbp) : null; }

  global.SonorSeating = {
    load: load, get source() { return source; },
    seatingRanges: seatingRanges, range: range, itemsOf: itemsOf,
    seatItems: seatItems, armrestItems: armrestItems, accessoryItems: accessoryItems,
    motorOptions: motorOptions, seatWidthMm: seatWidthMm, feature: feature,
    priced: priced, fromPrice: fromPrice, itemSell: itemSell
  };
})(typeof window !== 'undefined' ? window : this);
