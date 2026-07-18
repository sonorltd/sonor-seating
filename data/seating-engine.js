/* Sonor Seating Configurator — data engine (v0.2.0)
   SonorSeating — reads the Library SSOT (furniture_ranges + furniture_catalogue).
   4-tier load: Supabase → localStorage → bundled seed → inline empty.
   MSRP = furniture_catalogue.sell_price_gbp. No catalogue data hardcoded here.
*/
(function (global) {
  'use strict';
  var MATMETA = {}, MFRMETA = {}, FINOPTS = {};
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
        price_srp_from: r.pf, materials: r.mat, prices_map: r.pr || null
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
      var cols = (coloursMap && coloursMap[id]) ? coloursMap[id].map(function (c) { return { name: c.n || c.name, hex: c.h || c.hex, img: c.i || c.img || null }; }) : [];
      out.push({
        id: id, name: m.material_name, swatch: sw,
        group: m.material_group || 'Fabric', groupKey: g || 'fabric',
        tier: m.tier || null, tierLabel: TIER_LABEL[m.tier] || null,
        available: m.available !== false, upcharge: Number(m.upcharge_pct || 0),
        swatchImg: m.swatch_img || null,     // photo of the actual swatch — when the Library files one
        colourNote: ((typeof MATMETA !== 'undefined' && MATMETA[id]) || {}).colour_note || null,
        colours: cols
      });
    });
    return out;
  }
  // v_seating_catalogue rows → { ranges, catalogue } in the engine's native shape
  function adaptSSOT(rows) {
    var rmap = {}, order = [], universal = [];
    rows.forEach(function (row) {
      var rid = row.range_id;
      if (!rid) {
        // v0.17.0 — GENERIC items (null range_id): the price list's own grouping —
        // per-range seats/arms/chaises vs a generic Accessories block. Attach to
        // the manufacturer, surfaced in every range of that make.
        var upmap = row.prices_map || null;
        if (!upmap && Array.isArray(row.prices)) {
          upmap = {};
          row.prices.forEach(function (p) { if (p && p.available !== false && p.srp != null) upmap[p.material_id || '_'] = Number(p.srp); });
          if (!Object.keys(upmap).length) upmap = null;
        }
        universal.push({ id: row.item_id, range_id: null, manufacturer_slug: row.manufacturer_slug, is_universal: true,
          furniture_type: row.item_type || 'accessory', kind: ((row.item_metadata || {}).kind) || null,
          img: ((row.item_metadata || {}).img) || null, label: row.item_name || 'Accessory',
          sell_price_gbp: row.price_srp_from != null ? Number(row.price_srp_from) : null, prices: upmap,
          sort_order: row.item_sort || 0, motor_type: null, size_label: row.size_label || null });
        return;
      }
      if (!rmap[rid]) {
        order.push(rid);
        var meta = row.range_metadata || {}, cfg = row.range_config || {};
        rmap[rid] = {
          id: rid, manufacturer: row.manufacturer_name, manufacturer_slug: row.manufacturer_slug || null,
          manufacturer_meta: (typeof MFRMETA !== 'undefined' && MFRMETA[row.manufacturer_slug]) || {}, name: row.range_name,
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
          materials: adaptMaterials(row.materials, COLOURS),
          finishes: (typeof FINOPTS !== 'undefined' && FINOPTS[row.manufacturer_slug]) || [],
          metadata: { seating_range: true, needs_review: !!meta._needs_review, is_cineca: row.manufacturer_slug === 'cineca', manufacturer_logo: MFR_LOGO[row.manufacturer_slug] || null, range_style: meta.range_style || null, product_url: meta.product_url || null, datasheet_url: meta.datasheet_url || null },
          _items: []
        };
      }
      var R = rmap[rid], type = (row.item_type || '').toLowerCase();
      var isArm = type === 'armrest' || /armrest/i.test(row.item_name || '');
      // v0.17.0 — chaises/daybeds are SEAT TYPES (selectable per row), not accessories
      var ft = (type === 'seat' || type === 'chaise' || isArm) ? 'Seating' : (row.item_type || 'accessory');
      var label = row.item_name || row.size_label || 'Item';
      if (isArm && !/armrest/i.test(label)) label += ' Armrest';
      var pmap = row.prices_map || null;
      if (!pmap && Array.isArray(row.prices)) {
        pmap = {};
        row.prices.forEach(function (p) { if (p && p.available !== false && p.srp != null) pmap[p.material_id || '_'] = Number(p.srp); });
        if (!Object.keys(pmap).length) pmap = null;
      }
      R._items.push({ id: row.item_id, range_id: rid, furniture_type: ft, kind: ((row.item_metadata || {}).kind) || null, complete_chair: !!((row.item_metadata || {}).complete_chair), img: ((row.item_metadata || {}).img) || null, label: label, sell_price_gbp: row.price_srp_from != null ? Number(row.price_srp_from) : null, prices: pmap, sort_order: row.item_sort || 0, motor_type: row.motor_type || null, size_label: row.size_label || null });
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
    return { ranges: rs, catalogue: cat, universal: universal };
  }

  async function load() {
    // Tier 1 — Supabase live (SSOT view v_seating_catalogue)
    try {
      var db = null;
      if (typeof global.SonorDB !== 'undefined') db = new global.SonorDB();
      else if (global.db && global.db.client) db = global.db;    // client build: plain supabase-js shim
      if (db && db.client) {
        global.__SEATING_DB__ = db;                              // v0.17.2 — expose for project bar / saved configs
        var v = await db.client.from('v_seating_catalogue').select('*');
        if (!v.error && (v.data || []).length) {
          try { var cq = await db.client.from('seating_material_colours').select('material_id,name,hex,sort_order,metadata').order('material_id').order('sort_order'); if (!cq.error) { COLOURS = {}; (cq.data || []).forEach(function (c) { (COLOURS[c.material_id] = COLOURS[c.material_id] || []).push({ name: c.name, hex: c.hex, img: (c.metadata && c.metadata.swatch_img) || null }); }); }
          try { var mq = await db.client.from('seating_materials').select('id,metadata').neq('metadata', '{}'); if (!mq.error) { MATMETA = {}; (mq.data || []).forEach(function (m2) { MATMETA[m2.id] = m2.metadata || {}; }); } } catch (e2) {}
          try { var fq = await db.client.from('seating_manufacturers').select('id,metadata,logo_url'); if (!fq.error) { MFRMETA = {}; (fq.data || []).forEach(function (f2) { var mm2 = Object.assign({}, f2.metadata || {}); if (f2.logo_url) mm2._logo_url = f2.logo_url; MFRMETA[f2.id] = mm2; }); } } catch (e3) {}
          try { var oq = await db.client.from('seating_finish_options').select('id,manufacturer_id,label,note,sort_order').order('sort_order'); if (!oq.error) { FINOPTS = {}; (oq.data || []).forEach(function (o2) { (FINOPTS[o2.manufacturer_id] = FINOPTS[o2.manufacturer_id] || []).push({ id: o2.id, label: o2.label, note: o2.note }); }); } } catch (e4) {} } catch (e) {}
          var ad = adaptSSOT(v.data); ranges = ad.ranges; catalogue = ad.catalogue; UNIVERSAL = ad.universal || []; source = 'supabase';
          try { localStorage.setItem(CACHE, JSON.stringify({ ranges: ranges, catalogue: catalogue, universal: UNIVERSAL })); } catch (e) {}
          _index(); return { source: source, db: db };
        }
        // legacy fallback — furniture_* (being retired)
        var r = await db.client.from('furniture_ranges').select('*').order('sort_order');
        var c = await db.client.from('furniture_catalogue').select('*').order('sort_order');
        if (!r.error && !c.error && (r.data || []).length) {
          ranges = r.data; catalogue = c.data; source = 'supabase';
          try { localStorage.setItem(CACHE, JSON.stringify({ ranges: ranges, catalogue: catalogue, universal: UNIVERSAL })); } catch (e) {}
          _index(); return { source: source, db: db };
        }
      }
    } catch (e) { console.warn('[SonorSeating] supabase tier:', e && e.message); }
    // Tier 2 — cache (already adapted shape)
    try {
      var cached = JSON.parse(localStorage.getItem(CACHE) || 'null');
      if (cached && (cached.ranges || []).length) { ranges = cached.ranges; catalogue = cached.catalogue; UNIVERSAL = cached.universal || []; source = 'cache'; _index(); return { source: source, db: null }; }
    } catch (e) {}
    // Tier 3 — bundled seed (ssot_slim | ssot rows | legacy ranges/catalogue)
    var seed = global.__SEATING_SEED__;
    if (seed) {
      if (seed.colours) COLOURS = seed.colours;
      if (seed.matmeta) MATMETA = seed.matmeta;
      if (seed.mfrmeta) MFRMETA = seed.mfrmeta;
      if (seed.finopts) FINOPTS = seed.finopts;
      if ((seed.ssot_slim || []).length) { var a2 = adaptSSOT(unslim(seed.ssot_slim)); ranges = a2.ranges; catalogue = a2.catalogue; UNIVERSAL = a2.universal || []; source = 'seed'; _index(); return { source: source, db: null }; }
      if ((seed.ssot || []).length) { var a3 = adaptSSOT(seed.ssot); ranges = a3.ranges; catalogue = a3.catalogue; UNIVERSAL = a3.universal || []; source = 'seed'; _index(); return { source: source, db: null }; }
      if ((seed.ranges || []).length) { ranges = seed.ranges; catalogue = seed.catalogue; source = 'seed'; _index(); return { source: source, db: null }; }
    }
    // Tier 4 — empty
    ranges = []; catalogue = []; source = 'inline'; _index(); return { source: source, db: null };
  }

  var UNIVERSAL = [];
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
    var own = itemsOf(rangeId).filter(function (i) {
      if (i.kind === 'accessory') return true;
      if (i.kind) return false;                                   // flagged as module/config/seat etc.
      var t = (i.furniture_type || '').toLowerCase();
      return t !== 'seating' || /ottoman|footrest|table|console/i.test(i.label || '');
    });
    // + the manufacturer's GENERIC accessories (price-list 'Accessories' block)
    var r = idx.rangeById[rangeId];
    var slug = r ? (r.manufacturer_slug || (r.metadata && r.metadata.is_cineca ? 'cineca' : null)) : null;
    var gen = slug ? UNIVERSAL.filter(function (u) { return u.manufacturer_slug === slug; }) : [];
    return own.concat(gen);
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
  // v0.17.0 — EXACT per-material pricing when the library holds real price rows
  // (e.g. Cineca: six materials priced per item). Falls back to the base 'from'
  // price (caller applies the % upcharge only in that fallback case).
  function itemSell(it, materialId) {
    if (!it) return null;
    if (it.prices) {
      if (materialId != null && it.prices[materialId] != null) return Number(it.prices[materialId]);
      if (it.prices['_'] != null) return Number(it.prices['_']);
      var vals = Object.keys(it.prices).map(function (k) { return Number(it.prices[k]); });
      if (vals.length) return Math.min.apply(null, vals);
    }
    return it.sell_price_gbp != null ? Number(it.sell_price_gbp) : null;
  }
  function hasExactPrice(it, materialId) { return !!(it && it.prices && materialId != null && it.prices[materialId] != null); }
  // Single COMPLETE chair from-price: cheapest seat + 2 armrests where the range
  // is modular (price-list realism — a bare seat module understates the chair).
  function chairFrom(r, materialId) {
    if (!r) return null;
    var seats = seatItems(r.id), arms = armrestItems(r.id);
    // Module-built ranges with no separate armrests (FrontRow): a bare module
    // understates the chair — use items the library flags as complete chairs,
    // else exclude raw modules from the from-price.
    if (!arms.length) {
      var complete = seats.filter(function (i) { return i.complete_chair; });
      if (complete.length) seats = complete;
      else if (seats.some(function (i) { return i.kind === 'module'; }) && seats.some(function (i) { return i.kind !== 'module'; })) {
        seats = seats.filter(function (i) { return i.kind !== 'module'; });
      }
    }
    var sMin = null, aMin = null;
    seats.forEach(function (i) { var p = itemSell(i, materialId); if (p != null && (sMin == null || p < sMin)) sMin = p; });
    arms.forEach(function (i) { var p = itemSell(i, materialId); if (p != null && (aMin == null || p < aMin)) aMin = p; });
    if (sMin == null) return null;
    return arms.length && aMin != null ? sMin + 2 * aMin : sMin;
  }

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
    seatItems: seatItems, armrestItems: armrestItems, accessoryItems: accessoryItems, chairFrom: chairFrom, hasExactPrice: hasExactPrice,
    motorOptions: motorOptions, seatWidthMm: seatWidthMm, seatDepthMm: seatDepthMm, feature: feature,
    priced: priced, fromPrice: fromPrice, itemSell: itemSell,
    manufacturerTerms: manufacturerTerms, deliveryCost: deliveryCost, leadWeeks: leadWeeks
  };
})(typeof window !== 'undefined' ? window : this);
