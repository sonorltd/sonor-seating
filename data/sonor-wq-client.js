/*!
 * SonorWQClient v1.1.0 — workspace-shared READ-ONLY WeQuote client (B-444g, 2026-09-10).
 * ---------------------------------------------------------------------------
 * ROOT MASTER: /sonor-wq-client.js → synced to every app's data/ by sync-everything.sh.
 * Edit the root master only; never a per-app copy (S-4.3).
 *
 * Sonor law: WeQuote is the priced SSOT; nothing is ever written back. wq-proxy v2
 * is GET-only with an allowlist of /(project|quote|customer)/(list|get|find)* (B-340).
 * The WQ Api-Key is resolved SERVER-SIDE by the proxy; the browser never sees it.
 *
 * Data path:  app → wq-proxy edge fn (?endpoint=/quote/list_product&search=…) → WeQuote
 * Config:     public.wq_config (proxy_url / api_base / proxy_enabled) — one row, read once.
 *
 * Extracted from APP - Service Contracts/data/service-contracts-wq.js (SonorSvcWQ) and
 * APP - Library/data/sonor-wq-price.js (SonorWQPrice) — identical init/_get/_arr cores.
 * Consumers: SonorSvcWQ (delegates, v0.2.0). SonorWQPrice keeps its own copy until its
 * next version (Library follow-on) — the matching logic there stays app-specific.
 *
 * Usage:
 *   await SonorWQClient.init(supabaseClient);            // reads wq_config once
 *   const rows = await SonorWQClient.searchProducts('maintenance');
 *   const lines = await SonorWQClient.quoteLines(268809);
 *   const raw = await SonorWQClient.get('/project/list', { page: 1 });   // any allowlisted GET
 */
(function (root) {
  'use strict';

  var CFG = { proxyUrl: null, apiBase: 'https://app.wequote.cloud/external', proxyEnabled: true, anonKey: null, ready: false, source: 'none' };
  var _cache = {};
  var CACHE_MS = 5 * 60 * 1000;
  var _initP = null;

  // Pass a Supabase client (SonorDB.client or supabase.createClient(...)). Idempotent.
  function init(supa, opts) {
    opts = opts || {};
    if (opts.anonKey) CFG.anonKey = opts.anonKey;
    if (opts.proxyUrl) CFG.proxyUrl = opts.proxyUrl;
    if (!CFG.anonKey && root.SONOR_SUPABASE_ANON) CFG.anonKey = root.SONOR_SUPABASE_ANON;
    if (!CFG.anonKey && root.__SONOR_BRAND__ && root.__SONOR_BRAND__.supabase) CFG.anonKey = root.__SONOR_BRAND__.supabase.anonKey || CFG.anonKey;
    if (_initP && !opts.force) return _initP;
    _initP = (async function () {
      try {
        if (supa && supa.from) {
          var res = await supa.from('wq_config').select('api_base, proxy_url, proxy_enabled').limit(1).single();
          var cfg = res && res.data;
          if (cfg) {
            if (cfg.proxy_url) CFG.proxyUrl = cfg.proxy_url;
            if (cfg.api_base) CFG.apiBase = cfg.api_base;
            CFG.proxyEnabled = cfg.proxy_enabled !== false;
          }
        }
      } catch (e) { console.warn('[SonorWQClient] wq_config read failed', e); }
      CFG.ready = !!(CFG.proxyEnabled && CFG.proxyUrl);
      CFG.source = CFG.ready ? 'proxy' : 'none';
      return CFG.ready;
    })();
    return _initP;
  }
  function configure(opts) { Object.assign(CFG, opts || {}); CFG.ready = !!(CFG.proxyEnabled && CFG.proxyUrl); return status(); }
  function status() { return { ready: CFG.ready, proxyUrl: CFG.proxyUrl, source: CFG.source, anon: !!CFG.anonKey }; }

  // Low-level GET through the proxy (canonical ?endpoint= contract). Cached 5 min per URL.
  async function get(endpoint, params, opts) {
    opts = opts || {};
    if (!CFG.ready) throw new Error('WeQuote proxy not configured (wq_config.proxy_url / proxy_enabled)');
    if (!/^\/(project|quote|customer)\/(list|get|find)[a-z0-9_]*$/i.test(endpoint)) throw new Error('WQ endpoint not on the read-only allowlist: ' + endpoint);
    var u = new URL(CFG.proxyUrl);
    u.searchParams.set('endpoint', endpoint);
    Object.keys(params || {}).forEach(function (k) {
      var v = params[k];
      if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, v);
    });
    var headers = { 'Accept': 'application/json' };
    if (CFG.anonKey) { headers['apikey'] = CFG.anonKey; headers['Authorization'] = 'Bearer ' + CFG.anonKey; }
    var key = u.toString();
    var c = _cache[key];
    if (!opts.force && c && (Date.now() - c.at) < CACHE_MS) return c.data;
    var resp = await fetch(key, { method: 'GET', headers: headers });
    var text = await resp.text();
    var data; try { data = JSON.parse(text); } catch (e) { data = text; }
    if (!resp.ok) throw new Error('WQ ' + endpoint + ' HTTP ' + resp.status + ': ' + (typeof data === 'string' ? data.slice(0, 200) : JSON.stringify(data).slice(0, 200)));
    _cache[key] = { at: Date.now(), data: data };
    return data;
  }
  function arr(d) { return Array.isArray(d) ? d : (d && Array.isArray(d.data) ? d.data : []); }
  function one(d) { return Array.isArray(d) ? d[0] : (d && d.data && !Array.isArray(d.data) ? d.data : d); }
  function clearCache(prefix) { if (!prefix) { _cache = {}; return; } Object.keys(_cache).forEach(function (k) { if (k.indexOf(prefix) >= 0) delete _cache[k]; }); }

  // ── common lookups (all GET, all allowlisted) ─────────────────────────────
  async function searchProducts(term) { return arr(await get('/quote/list_product', { search: term })); }
  async function getProduct(sku, catalogueId) { return one(await get('/quote/get_product', { sku: sku, catalogue_id: catalogueId })); }
  async function listQuotes(page) { return arr(await get('/quote/list', { page: page || 1 })); }
  async function getQuote(quoteId) { return one(await get('/quote/get', { id: quoteId })); }   // WQ wants `id` here (quote_id on list_quote_lines)
  async function quoteLines(quoteId, force) { return arr(await get('/quote/list_quote_lines', { quote_id: quoteId }, { force: !!force })); }
  async function listProjects(page) { return arr(await get('/project/list', { page: page || 1 })); }
  async function findCustomer(term) { return arr(await get('/customer/find', { search: term })); }
  async function getProject(id) { return one(await get('/project/get_project', { id: id })); }        // WQ internal id → {id, project_no, description, customer_name, status}
  async function getCustomer(id) { return one(await get('/customer/get', { id: id })); }
  // Full own-catalogue map (~900 rows, cached 5 min) — quote lines only carry product_id, so this is how they get names.
  async function productMap(force) { var rows = arr(await get('/quote/list_product', {}, { force: !!force })); var m = {}; rows.forEach(function (p) { m[p.id] = p; }); return m; }
  async function quoteLinesResolved(quoteId, force) { var lines = await quoteLines(quoteId, force); var pm = await productMap(); return lines.map(function (l) { var p = pm[l.product_id] || {}; return Object.assign({}, l, { sku: p.sku || '', short_description: p.short_description || '', long_description: p.long_description || '', model: p.model || '', manufacturer_name: p.manufacturer_name || '', category_description: p.category_description || '', sell_price: l.unit_price != null && Number(l.unit_price) ? l.unit_price : p.sell_price, cost_price: l.unit_cost != null && Number(l.unit_cost) ? l.unit_cost : p.cost_price }); }); }

  root.SonorWQClient = {
    VERSION: '1.1.0', init: init, configure: configure, status: status,
    get: get, arr: arr, one: one, clearCache: clearCache,
    searchProducts: searchProducts, getProduct: getProduct, listQuotes: listQuotes, getQuote: getQuote,
    quoteLines: quoteLines, quoteLinesResolved: quoteLinesResolved, productMap: productMap, listProjects: listProjects, findCustomer: findCustomer, getProject: getProject, getCustomer: getCustomer
  };
})(typeof window !== 'undefined' ? window : this);
