/* Sonor Seating Configurator — data engine
   SonorSeating  (IIFE, public API)

   Multi-manufacturer catalogue layer. Everything the wizard needs comes from
   DATA (Supabase seating_* tables, Tier-2 seed fallback) — never per-range code.
   A new manufacturer / range = new rows, zero code change.

   4-tier load (first success wins):
     1. Supabase live  (via SonorDB.client)          → source 'supabase'
     2. localStorage    (last good live snapshot)     → source 'cache'
     3. window.__SEATING_CATALOGUE_SEED__ (bundled)   → source 'seed'
     4. inline empty                                  → source 'inline'
*/
(function (global) {
  'use strict';

  var CFG = global.__SEATING_CONFIG__ || {};
  var ACC_TYPES = CFG.accessoryTypes || ['ottoman', 'corner', 'chaise', 'headrest', 'bean_bag', 'stool', 'accessory'];
  var CACHE_KEY = CFG.cacheKey || 'sonor_seating_catalogue_v1';
  var TABLES = ['manufacturers', 'ranges', 'materials', 'material_colours', 'range_materials', 'items', 'prices', 'finish_options'];

  var raw = null;      // { manufacturers:[], ranges:[], ... }
  var idx = null;      // indexed views
  var source = null;   // 'supabase' | 'cache' | 'seed' | 'inline'

  // ── 4-tier load ───────────────────────────────────────────────────────────
  async function load() {
    // Tier 1 — Supabase live
    try {
      if (typeof global.SonorDB !== 'undefined') {
        var db = new global.SonorDB();
        var results = await Promise.all(TABLES.map(function (t) {
          return db.client.from('seating_' + t).select('*');
        }));
        var ok = results.every(function (r) { return !r.error; });
        var data = {};
        TABLES.forEach(function (t, i) { data[t] = results[i].data || []; });
        if (ok && (data.manufacturers || []).length) {
          raw = data; source = 'supabase';
          try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (e) {}
          _index();
          return { source: source, db: db };
        }
      }
    } catch (e) { console.warn('[SonorSeating] Supabase tier failed:', e && e.message); }

    // Tier 2 — localStorage cache
    try {
      var cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        var parsed = JSON.parse(cached);
        if (parsed && (parsed.manufacturers || []).length) {
          raw = parsed; source = 'cache'; _index();
          return { source: source, db: null };
        }
      }
    } catch (e) {}

    // Tier 3 — bundled seed
    if (global.__SEATING_CATALOGUE_SEED__ && (global.__SEATING_CATALOGUE_SEED__.manufacturers || []).length) {
      raw = global.__SEATING_CATALOGUE_SEED__; source = 'seed'; _index();
      return { source: source, db: null };
    }

    // Tier 4 — inline empty
    raw = { manufacturers: [], ranges: [], materials: [], material_colours: [], range_materials: [], items: [], prices: [], finish_options: [] };
    source = 'inline'; _index();
    return { source: source, db: null };
  }

  // ── Index builders ────────────────────────────────────────────────────────
  function _index() {
    var i = {
      rangesByMfr: {}, rangeById: {},
      materialsById: {}, materialsByMfr: {},
      coloursByMaterial: {},
      availByRange: {},           // rangeId -> { materialId: {available, upcharge} }
      itemsById: {}, itemsByRange: {}, universalByMfr: {},
      pricesByItem: {},           // itemId -> { materialId|'universal': priceRow }
      finishByMfr: {}
    };
    (raw.ranges || []).forEach(function (r) {
      i.rangeById[r.id] = r;
      (i.rangesByMfr[r.manufacturer_id] = i.rangesByMfr[r.manufacturer_id] || []).push(r);
    });
    (raw.materials || []).forEach(function (m) {
      i.materialsById[m.id] = m;
      (i.materialsByMfr[m.manufacturer_id] = i.materialsByMfr[m.manufacturer_id] || []).push(m);
    });
    (raw.material_colours || []).forEach(function (c) {
      (i.coloursByMaterial[c.material_id] = i.coloursByMaterial[c.material_id] || []).push(c);
    });
    (raw.range_materials || []).forEach(function (rm) {
      (i.availByRange[rm.range_id] = i.availByRange[rm.range_id] || {})[rm.material_id] =
        { available: rm.available !== false, upcharge: Number(rm.upcharge_pct || 0) };
    });
    (raw.items || []).forEach(function (it) {
      i.itemsById[it.id] = it;
      if (it.range_id) (i.itemsByRange[it.range_id] = i.itemsByRange[it.range_id] || []).push(it);
      if (it.is_universal || !it.range_id) (i.universalByMfr[it.manufacturer_id || '_'] = i.universalByMfr[it.manufacturer_id || '_'] || []).push(it);
    });
    (raw.prices || []).forEach(function (p) {
      var key = p.material_id || 'universal';
      (i.pricesByItem[p.item_id] = i.pricesByItem[p.item_id] || {})[key] = p;
    });
    (raw.finish_options || []).forEach(function (f) {
      (i.finishByMfr[f.manufacturer_id] = i.finishByMfr[f.manufacturer_id] || []).push(f);
    });
    // stable sorts
    var bySort = function (a, b) { return (a.sort_order || 0) - (b.sort_order || 0); };
    Object.values(i.rangesByMfr).forEach(function (a) { a.sort(bySort); });
    Object.values(i.materialsByMfr).forEach(function (a) { a.sort(bySort); });
    Object.values(i.coloursByMaterial).forEach(function (a) { a.sort(bySort); });
    Object.values(i.itemsByRange).forEach(function (a) { a.sort(bySort); });
    Object.values(i.finishByMfr).forEach(function (a) { a.sort(bySort); });
    idx = i;
  }

  // ── Resolvers (all data-driven — the "flip per range" magic) ───────────────
  function manufacturers() {
    return (raw.manufacturers || []).filter(function (m) { return m.enabled !== false; })
      .sort(function (a, b) { return (a.sort_order || 0) - (b.sort_order || 0); });
  }
  function manufacturer(id) { return (raw.manufacturers || []).find(function (m) { return m.id === id; }) || null; }
  function ranges(mfrId) { return (idx.rangesByMfr[mfrId] || []).filter(function (r) { return r.enabled !== false; }); }
  function range(id) { return idx.rangeById[id] || null; }

  function rangeConfig(rangeId) {
    var r = range(rangeId) || {};
    var c = r.config || {};
    return {
      default_seats_per_row: c.default_seats_per_row || 4,
      min_seats: c.min_seats || 2,
      max_seats: c.max_seats || 6,
      seat_width_mm: c.seat_width_mm || (r.seat_width_cm ? r.seat_width_cm * 10 : 650),
      plan_dims: c.plan_dims || { w: 72, d: 82, arm: 13, label: (r.seat_width_cm || '') + 'cm' }
    };
  }

  // Materials available for a range (respects seating_range_materials.available)
  function materialsForRange(rangeId) {
    var r = range(rangeId); if (!r) return [];
    var avail = idx.availByRange[rangeId] || {};
    return (idx.materialsByMfr[r.manufacturer_id] || []).filter(function (m) {
      var a = avail[m.id];
      return !a || a.available !== false;   // default available if no join row
    });
  }
  function materialAvailable(rangeId, materialId) {
    var a = (idx.availByRange[rangeId] || {})[materialId];
    return !a || a.available !== false;
  }
  function material(id) { return idx.materialsById[id] || null; }
  function colours(materialId) { return idx.coloursByMaterial[materialId] || []; }
  function finishOptions(mfrId) { return idx.finishByMfr[mfrId] || []; }

  // Distinct motor types a range actually offers (from its seat items)
  function motorTypes(rangeId) {
    var seats = (idx.itemsByRange[rangeId] || []).filter(function (i) { return i.item_type === 'seat'; });
    var set = [];
    seats.forEach(function (s) { var mt = s.motor_type || 'fixed'; if (set.indexOf(mt) < 0) set.push(mt); });
    // canonical order
    var order = ['fixed', '1motor', '2motor'];
    set.sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); });
    return set.length ? set : ['fixed'];
  }
  function seatItem(rangeId, motorType) {
    var seats = (idx.itemsByRange[rangeId] || []).filter(function (i) { return i.item_type === 'seat'; });
    return seats.find(function (s) { return (s.motor_type || 'fixed') === motorType; }) || seats[0] || null;
  }
  function armrestItem(rangeId) {
    return (idx.itemsByRange[rangeId] || []).find(function (i) { return i.item_type === 'armrest'; }) || null;
  }
  // Accessory items offered for a range: its own + manufacturer-universal, one per type
  function accessoryItems(rangeId) {
    var r = range(rangeId); if (!r) return [];
    var own = (idx.itemsByRange[rangeId] || []).filter(function (i) { return ACC_TYPES.indexOf(i.item_type) >= 0; });
    var uni = (idx.universalByMfr[r.manufacturer_id] || []).filter(function (i) { return ACC_TYPES.indexOf(i.item_type) >= 0; });
    var seen = {}, out = [];
    own.concat(uni).forEach(function (i) {
      if (seen[i.item_type]) return; seen[i.item_type] = 1; out.push(i);
    });
    // keep config order
    out.sort(function (a, b) { return ACC_TYPES.indexOf(a.item_type) - ACC_TYPES.indexOf(b.item_type); });
    return out;
  }

  function priceRow(item, materialId) {
    var map = idx.pricesByItem[item.id]; if (!map) return null;
    if (item.is_universal) return map['universal'] || Object.values(map)[0] || null;
    return map[materialId] || null;
  }
  // starting "from" price for a range (cheapest seat in the entry material)
  function rangeFromPrice(rangeId, materialId) {
    var seats = (idx.itemsByRange[rangeId] || []).filter(function (i) { return i.item_type === 'seat'; });
    var min = null;
    seats.forEach(function (s) {
      var pr = priceRow(s, materialId);
      if (pr && pr.price_trade_gbp != null) { var v = Number(pr.price_trade_gbp); if (min == null || v < min) min = v; }
    });
    return min;
  }

  // ── Quantity + pricing (ported from Cineca, now range-aware) ───────────────
  function computeQuantities(cfg) {
    var q = {};
    var totalSeats = (cfg.rowConfigs || []).reduce(function (s, rc) { return s + rc.seats; }, 0);
    if (!totalSeats) return q;

    // seats grouped by motor type
    var byMotor = {};
    cfg.rowConfigs.forEach(function (rc) { var mt = rc.motorType || 'fixed'; byMotor[mt] = (byMotor[mt] || 0) + rc.seats; });
    Object.keys(byMotor).forEach(function (mt) {
      var it = seatItem(cfg.range, mt); if (it) q[it.id] = (q[it.id] || 0) + byMotor[mt];
    });
    // armrests: (seats+1) per row
    if (cfg.includeArmrests) {
      var arm = armrestItem(cfg.range);
      if (arm) q[arm.id] = cfg.rowConfigs.reduce(function (s, rc) { return s + rc.seats + 1; }, 0);
    }
    // accessories
    var accItems = accessoryItems(cfg.range);
    Object.keys(cfg.accessories || {}).forEach(function (type) {
      var qty = cfg.accessories[type]; if (!qty) return;
      var it = accItems.find(function (i) { return i.item_type === type; });
      if (it) q[it.id] = qty;
    });
    return q;
  }

  function entries(cfg) {
    var q = computeQuantities(cfg);
    return Object.keys(q).filter(function (id) { return q[id] > 0; }).map(function (idStr) {
      var item = idx.itemsById[idStr]; if (!item) return null;
      var pr = priceRow(item, cfg.material); if (!pr) return null;
      var trade = Number(pr.price_trade_gbp || 0), srp = Number(pr.price_srp_gbp || 0), qty = q[idStr];
      return {
        itemId: item.id, item: item, qty: qty, sku: pr.sku,
        trade: trade, srp: srp, tradeTot: trade * qty, srpTot: srp * qty,
        shortName: shortName(item)
      };
    }).filter(Boolean).sort(function (a, b) { return (a.item.sort_order || 0) - (b.item.sort_order || 0); });
  }

  function shortName(item) {
    var r = range(item.range_id); var mfr = r ? r.name : '';
    var n = item.item_name || '';
    if (mfr) n = n.replace(new RegExp('^' + mfr + '\\s+', 'i'), '');
    if (r) n = n.replace(new RegExp('^' + r.name + '\\s+', 'i'), '');
    return n;
  }

  global.SonorSeating = {
    load: load,
    get source() { return source; },
    manufacturers: manufacturers, manufacturer: manufacturer,
    ranges: ranges, range: range, rangeConfig: rangeConfig,
    materialsForRange: materialsForRange, materialAvailable: materialAvailable,
    material: material, colours: colours, finishOptions: finishOptions,
    motorTypes: motorTypes, seatItem: seatItem, armrestItem: armrestItem, accessoryItems: accessoryItems,
    priceRow: priceRow, rangeFromPrice: rangeFromPrice,
    computeQuantities: computeQuantities, entries: entries, shortName: shortName
  };
})(typeof window !== 'undefined' ? window : this);
