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

  var ranges = [], catalogue = [], idx = null, source = null, COLOURS = {};

  var MFR_LOGO = { cineca: 'https://sonorltd.github.io/sonor-cineca/cineca-assets/cineca-logo.png' };

  // slim seed keys → full v_seating_catalogue keys
  function unslim(a) {
    return (a || []).map(function (r) {
      return {
        item_id: r.ii, item_type: r.it, item_name: r.nm, size_label: r.sz, motor_type: r.mo, item_sort: r.is, item_metadata: r.im || null,
        manufacturer_name: r.mf, manufacturer_slug: r.ms, range_id: r.rid, range_name: r.rn, range_tagline: r.rt,
        hero_img: r.hi, thumb_img: r.ti, seat_width_cm: r.sw, reclined_depth_cm: r.rd, seat_depth_cm: r.sd,
        wall_clearance_mm: r.wc, range_enabled: r.re, range_sort: r.rs, range_config: r.rc, range_metadata: r.rmeta,
        price_srp_from: r.pf, materials: r.mat
      };
    });
  }
  var TIER_LABEL = { 1: 'Entry', 2: 'Mid', 3: 'Premium', 4: 'Luxury', 5: 'Bespoke' };
  function adaptMaterials(mats, coloursMap) {
    if (!mats || !mats.length) return [];
    var seen = {}, out = [];
    mats.forEach(function (m) {
      var id = m.material_id || m.material_name; if (!id || seen[id]) return; seen[id] = 1;
      var g = (m.material_group || '').toLowerCase();
      var sw = m.swatch_hex || (g === 'leather' ? '#6b4f3a' : g === 'velvet' ? '#5b4a6b' : g === 'fabric' ? '#7a736a' : '#8a8078');
      var cols = (coloursMap && coloursMap[id]) ? coloursMap[id].map(function (c) { return { name: c.n || c.name, hex: c.h || c.hex }; }) : [];
      out.push({
        id: id, name: m.material_name, swatch: sw,
        group: m.material_group || 'Fabric', groupKey: g || 'fabric',
        tier: m.tier || null, tierLabel: TIER_LABEL[m.tier] || null,
        available: m.available !== false, upcharge: Number(m.upcharge_pct || 0),
        swatchImg: m.swatch_img || null,     // photo of the actual swatch — when the Library files one
        colours: cols
      });
    });
    return out;
  }
  // v_seating_catalogue rows → { ranges, catalogue } in the engine's native shape
  function adaptSSOT(rows) {
    var rmap = {}, order = [];
    rows.forEach(function (row) {
      var rid = row.range_id; if (!rid) return;
      if (!rmap[rid]) {
        order.push(rid);
        var meta = row.range_metadata || {}, cfg = row.range_config || {};
        rmap[rid] = {
          id: rid, manufacturer: row.manufacturer_name, name: row.range_name,
          style: row.range_tagline || meta.range_style || '',
          // Library is SSOT for imagery: absolute hero_img from the view wins;
          // the app-side map remains only as a fallback for unfiled ranges.
          hero_img: (/^https?:/.test(row.hero_img || '') ? row.hero_img : null) || (global.__RANGE_IMAGES__ || {})[rid] || null,
          thumb_img: row.thumb_img || null,
          sort_order: row.range_sort || 0, enabled: row.range_enabled !== false,
          pricing_from: { sell: null },
          capability: {
            seat_width_mm: row.seat_width_cm ? Math.round(row.seat_width_cm * 10) : null,
            seat_depth_mm: row.seat_depth_cm ? Math.round(row.seat_depth_cm * 10) : null,
            reclined_depth_mm: row.reclined_depth_cm ? Math.round(row.reclined_depth_cm * 10) : null,
            wall_clearance_mm: row.wall_clearance_mm || null,
            max_seats: cfg.max_seats || null, features: {}
          },
          materials: adaptMaterials(row.materials, COLOURS), finishes: [],
          metadata: { seating_range: true, needs_review: !!meta._needs_review, is_cineca: row.manufacturer_slug === 'cineca', manufacturer_logo: MFR_LOGO[row.manufacturer_slug] || null, range_style: meta.range_style || null, product_url: meta.product_url || null, datasheet_url: meta.datasheet_url || null },
          _items: []
        };
      }
      var R = rmap[rid], type = (row.item_type || '').toLowerCase();
      var isArm = type === 'armrest' || /armrest/i.test(row.item_name || '');
      var ft = (type === 'seat' || isArm) ? 'Seating' : (row.item_type || 'accessory');
      var label = row.item_name || row.size_label || 'Item';
      if (isArm && !/armrest/i.test(label)) label += ' Armrest';
      R._items.push({ id: row.item_id, range_id: rid, furniture_type: ft, kind: ((row.item_metadata || {}).kind) || null, label: label, sell_price_gbp: row.price_srp_from != null ? Number(row.price_srp_from) : null, sort_order: row.item_sort || 0, motor_type: row.motor_type || null, size_label: row.size_label || null });
    });
    var rs = [], cat = [];
    order.forEach(function (rid) {
      var R = rmap[rid];
      var seatSells = R._items.filter(function (i) { return i.furniture_type === 'Seating' && !/armrest/i.test(i.label) && i.sell_price_gbp != null; }).map(function (i) { return i.sell_price_gbp; });
      R.pricing_from = { sell: seatSells.length ? Math.min.apply(null, seatSells) : null };
      var f = R.capability.features, styleStr = ((R.metadata.range_style || '') + ' ' + R.name + ' ' + R.style).toLowerCase();
      if (R._items.some(function (i) { return i.motor_type; }) || /reclin|motor/.test(styleStr)) f.reclining = true;
      if (/daybed|day-bed|lounger|chaise/.test(styleStr) || R._items.some(function (i) { return /chaise|daybed|lounger/i.test(i.label); })) f.daybed = true;
      if (R._items.some(function (i) { return /chaise/i.test(i.label); })) f.chaise = true;
      if (/sofa|loveseat|love seat/.test(styleStr) || R._items.some(function (i) { return /sofa|loveseat|double|triple|2-seat|3-seat/i.test(i.label); })) f.sofa = true;
      cat = cat.concat(R._items); delete R._items; rs.push(R);
    });
    return { ranges: rs, catalogue: cat };
  }

  async function load() {
    // Tier 1 — Supabase live (SSOT view v_seating_catalogue)
    try {
      if (typeof global.SonorDB !== 'undefined') {
        var db = new global.SonorDB();
        var v = await db.client.from('v_seating_catalogue').select('*');
        if (!v.error && (v.data || []).length) {
          try { var cq = await db.client.from('seating_material_colours').select('material_id,name,hex,sort_order').order('material_id').order('sort_order'); if (!cq.error) { COLOURS = {}; (cq.data || []).forEach(function (c) { (COLOURS[c.material_id] = COLOURS[c.material_id] || []).push({ name: c.name, hex: c.hex }); }); } } catch (e) {}
          var ad = adaptSSOT(v.data); ranges = ad.ranges; catalogue = ad.catalogue; source = 'supabase';
          try { localStorage.setItem(CACHE, JSON.stringify({ ranges: ranges, catalogue: catalogue })); } catch (e) {}
          _index(); return { source: source, db: db };
        }
        // legacy fallback — furniture_* (being retired)
        var r = await db.client.from('furniture_ranges').select('*').order('sort_order');
        var c = await db.client.from('furniture_catalogue').select('*').order('sort_order');
        if (!r.error && !c.error && (r.data || []).length) {
          ranges = r.data; catalogue = c.data; source = 'supabase';
          try { localStorage.setItem(CACHE, JSON.stringify({ ranges: ranges, catalogue: catalogue })); } catch (e) {}
          _index(); return { source: source, db: db };
        }
      }
    } catch (e) { console.warn('[SonorSeating] supabase tier:', e && e.message); }
    // Tier 2 — cache (already adapted shape)
    try {
      var cached = JSON.parse(localStorage.getItem(CACHE) || 'null');
      if (cached && (cached.ranges || []).length) { ranges = cached.ranges; catalogue = cached.catalogue; source = 'cache'; _index(); return { source: source, db: null }; }
    } catch (e) {}
    // Tier 3 — bundled seed (ssot_slim | ssot rows | legacy ranges/catalogue)
    var seed = global.__SEATING_SEED__;
    if (seed) {
      if (seed.colours) COLOURS = seed.colours;
      if ((seed.ssot_slim || []).length) { var a2 = adaptSSOT(unslim(seed.ssot_slim)); ranges = a2.ranges; catalogue = a2.catalogue; source = 'seed'; _index(); return { source: source, db: null }; }
      if ((seed.ssot || []).length) { var a3 = adaptSSOT(seed.ssot); ranges = a3.ranges; catalogue = a3.catalogue; source = 'seed'; _index(); return { source: source, db: null }; }
      if ((seed.ranges || []).length) { ranges = seed.ranges; catalogue = seed.catalogue; source = 'seed'; _index(); return { source: source, db: null }; }
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

  // primary seat items of a range (Seating type, not armrest, not kind=accessory)
  function seatItems(rangeId) {
    return itemsOf(rangeId).filter(function (i) { return i.kind !== 'accessory' && i.furniture_type === 'Seating' && !/armrest/i.test(i.label || ''); });
  }
  function armrestItems(rangeId) { return itemsOf(rangeId).filter(function (i) { return i.kind !== 'accessory' && /armrest/i.test(i.label || ''); }); }
  // accessories: the Library's metadata.kind='accessory' flag is authoritative;
  // type/label heuristics remain as fallback for unflagged rows.
  function accessoryItems(rangeId) {
    return itemsOf(rangeId).filter(function (i) {
      if (i.kind === 'accessory') return true;
      if (i.kind) return false;                                   // flagged as module/config/seat etc.
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

  // seat width used for layout math (mm). Conservative: prefer the single/typical
  // width, then MAX (not min — min is optimistic, §7.5), then min, then fallback.
  function seatWidthMm(r) {
    var c = r.capability || {};
    return c.seat_width_mm || c.seat_width_max_mm || c.seat_width_min_mm || (CFG.clearance && CFG.clearance.seatFallbackWidthMm) || 650;
  }
  // reclined/plan depth of a seat row (mm) — for length-fit checks (§7.4)
  function seatDepthMm(r) {
    var c = r.capability || {};
    return c.reclined_depth_mm || c.seat_depth_mm || (r.metadata && r.metadata.reclined_depth_mm) || 1000;
  }

  // MSRP for an item (sell). qty pricing
  function itemSell(it) { return it && it.sell_price_gbp != null ? Number(it.sell_price_gbp) : null; }

  // ── commercial terms per manufacturer (delivery £ + lead time) ───────────────
  // Read from config (Sonor-set); SSOT-migrate later (contract §6). Not catalogue data.
  function manufacturerTerms(mfr) {
    var T = CFG.manufacturerTerms || {};
    var t = Object.prototype.hasOwnProperty.call(T, mfr) ? T[mfr] : T._default;
    return t || null;
  }
  // delivery £ for a manufacturer given order context {seats, orderTotal}. null = on request.
  function deliveryCost(mfr, ctx) {
    var t = manufacturerTerms(mfr); if (!t || !t.delivery) return null;
    var d = t.delivery, seats = (ctx && ctx.seats) || 0, order = (ctx && ctx.orderTotal) || 0;
    if (d.type === 'flat') return d.gbp != null ? Number(d.gbp) : null;
    if (d.type === 'perSeat') return d.gbp != null ? Number(d.gbp) * seats : null;
    if (d.type === 'band') {
      var bands = d.bands || [];
      for (var i = 0; i < bands.length; i++) { var b = bands[i]; if (b.maxOrder == null || order <= b.maxOrder) return b.gbp != null ? Number(b.gbp) : null; }
    }
    return null;
  }
  // lead time [minWeeks, maxWeeks] for a manufacturer, or null.
  function leadWeeks(mfr) { var t = manufacturerTerms(mfr); return t && t.leadWeeks && t.leadWeeks.length ? t.leadWeeks : null; }

  global.SonorSeating = {
    load: load, get source() { return source; },
    seatingRanges: seatingRanges, range: range, itemsOf: itemsOf,
    seatItems: seatItems, armrestItems: armrestItems, accessoryItems: accessoryItems,
    motorOptions: motorOptions, seatWidthMm: seatWidthMm, seatDepthMm: seatDepthMm, feature: feature,
    priced: priced, fromPrice: fromPrice, itemSell: itemSell,
    manufacturerTerms: manufacturerTerms, deliveryCost: deliveryCost, leadWeeks: leadWeeks
  };
})(typeof window !== 'undefined' ? window : this);
