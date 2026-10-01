/**
 * sonor-wq-sync.js — CANONICAL MASTER (sonor-platform §24 — one WeQuote sync, every app)
 * v1.1.0 · 2026-10-01 — quotes matched on the FRESH WQ project / customer names (+ one /quote/list walk per run, not 3 pages per
 *   project); stores wequote_created_at / wequote_modified_at / wequote_activity_at (+ per-quote created_at / updated_at / accepted_date)
 *   so the Board can rank by WeQuote activity (Active · 90+ · Completed). API: quotesFor(client, row, internalId, customerId, names?, run?)
 * v1.0.0 · 2026-10-01 — lifted verbatim from sonor-master/index.html v3.31.0 (syncWqProjectNames + _wqApiFetch family,
 * v3.16–v3.31) so the Board (⟳ WQ refresh) and the Hub (⟳ Sync WeQuote) run the SAME code. No DOM; the caller re-renders.
 *
 *   await SonorWqSync.syncProjects(client, rows, { force, onProgress(done, total, row) })  → number changed
 *     rows = projects rows (id, ref, name, client_*, address, postcode, value_quoted, metadata) — mutated in place on success
 *     A project whose ref starts with the WQ number ('1404 - TV Upgrades') is a WQ project even without metadata.wequote_id.
 *   SonorWqSync.wqNoOf(row) · apiFetch(client, path, params) · findProject(client, no) · findCustomer(client, name) · quotesFor(client, row, internalId, customerId)
 *
 * Credentials: wq_config (api_base, proxy_enabled, proxy_url) — anon SELECT; the browser never sees api_key (B-469), the
 * wq-proxy edge function resolves it. Classic script, no export. Synced to every app's data/ by sync-everything.sh.
 */
(function (global) {
  'use strict';
  var VERSION = '1.1.0';
  var _cfgCache = new Map();   // client → config | false
  async function getConfig(client) {
    if (_cfgCache.has(client)) return _cfgCache.get(client);
    var c = false;
    try { var r = await client.from('wq_config').select('api_base, proxy_enabled, proxy_url').limit(1).single(); c = (r.data && r.data.proxy_enabled && r.data.proxy_url) ? r.data : false; } catch (e) { c = false; }
    _cfgCache.set(client, c); return c;
  }
  async function apiFetch(client, path, params) {
    var cfg = await getConfig(client); if (!cfg) return null;
    try {
      var url; var headers = { 'Accept': 'application/json' };
      if (cfg.proxy_enabled && cfg.proxy_url) { url = new URL(cfg.proxy_url); url.searchParams.set('endpoint', path); }
      else { url = new URL((cfg.api_base || 'https://app.wequote.cloud/external').replace(/\/$/, '') + path); headers['Api-Key'] = cfg.api_key; }
      Object.entries(params || {}).forEach(function (kv) { url.searchParams.set(kv[0], kv[1]); });
      var r = await fetch(url.toString(), { headers }); if (!r.ok) return null; return await r.json();
    } catch (e) { return null; }
  }
  async function findProject(client, projectNo) { var j = await apiFetch(client, '/project/find_project', { project_no: projectNo }); return (Array.isArray(j) && j[0] && j[0].project_no) ? j[0] : null; }
  async function findCustomer(client, name) { if (!name) return null; var j = await apiFetch(client, '/customer/find', { name: name }); return (Array.isArray(j) && j[0] && j[0].name) ? j[0] : null; }
  var wqNoOf = function (r) { var m = r.metadata || {}; if (m.wequote_id) return String(m.wequote_id); var x = String(r.ref || '').match(/^(\d{3,5})\b/); return x ? x[1] : null; };
  // v1.1.0 — one walk of /quote/list per sync run (it is paged 10/page, newest first, no project filter — see WQ-QUOTE-FORMAT.md),
  // shared by every project in the run instead of 3 pages per project. Capped at 80 pages (800 quotes).
  async function listAllQuotes(client, run) {
    if (run && run.quoteList) return run.quoteList;
    var all = [];
    for (var page = 1; page <= 80; page++) {
      var rows = await apiFetch(client, '/quote/list', { page: page });
      if (!Array.isArray(rows) || !rows.length) break;
      all = all.concat(rows);
      if (rows.length < 10) break;
    }
    if (run) run.quoteList = all;
    return all;
  }
  var norm = function (s) { return String(s || '').toLowerCase().replace(/^the\s+/, '').replace(/\s+/g, ' ').trim(); };
  // candidates = quotes whose description / title mentions the WQ project name, the Sonor name, the customer or the WQ number;
  // each is verified with /quote/get (project_id = this WQ project, or customer_id = this customer). v1.0.0 only matched the
  // STALE row names (first sync: "Marian Horrocks" vs quote "TV Upgrades" → 0 quotes) — now the fresh WQ names are used too.
  async function quotesFor(client, row, internalId, customerId, names, run) {
    var m = row.metadata || {};
    var keys = [].concat(names || [], [m.wequote_name, row.name, row.client_name, m.wequote_customer, wqNoOf(row)]).map(norm).filter(function (n) { return n && n.length >= 3; });
    keys = keys.filter(function (n, i) { return keys.indexOf(n) === i; });
    if (!keys.length) return null;
    try {
      var list = await listAllQuotes(client, run);
      var candidates = list.filter(function (q) { var d = norm((q.description || '') + ' ' + (q.quote_title || '')); return keys.some(function (n) { return d.indexOf(n) >= 0; }); });
      var out = [];
      for (var i = 0; i < Math.min(candidates.length, 8); i++) {
        var q = await apiFetch(client, '/quote/get', { id: candidates[i].id });
        if (!q || !q.id) continue;
        if (!(q.project_id === internalId || (customerId && q.customer_id === customerId))) continue;
        out.push({ id: q.id, quote_no: q.quote_no, description: q.description, title: q.title, stage: q.stage, subtotal: q.subtotal, total: q.total, margin: q['total_margin_%'],
          quote_date: q.quote_date, expiry_date: q.expiry_date, accepted_date: q.accepted_date || null, created_at: q.created_datetime || null, updated_at: q.updated_datetime || null,
          subsystems: (q.subsystems || []).map(function (s) { return s.description; }),
          address: [q.address_line_1, q.address_line_2, q.address_line_3, q.posttown, q.county].filter(Boolean).join(', '), postcode: q.postcode || '' });
      }
      return out;
    } catch (e) { return null; }
  }
  // WeQuote stamps are "YYYY-MM-DD HH:MM:SS" (UK) — normalise to ISO so every app compares them the same way
  var wqIso = function (v) { if (!v) return null; var d = new Date(String(v).replace(' ', 'T')); return isNaN(d) ? null : d.toISOString(); };
  async function syncProjects(client, rows, opts) {
    opts = opts || {}; var force = !!opts.force;
    var staleBefore = Date.now() - 7 * 24 * 3600e3;
    var targets = (rows || []).filter(function (r) { var m = r.metadata || {}; if (!wqNoOf(r)) return false; if (force || !m.wequote_name || !m.wequote_id || !m.wequote_activity_at) return true;   /* v1.1.0: no activity stamp yet → pull once */ return !(m.wequote_synced_at && new Date(m.wequote_synced_at).getTime() > staleBefore); });
    var changed = 0, done = 0; var run = {};
    for (var ti = 0; ti < targets.length; ti++) {
      var r = targets[ti]; done++; if (opts.onProgress) try { opts.onProgress(done, targets.length, r); } catch (_) {}
      var wqNo = wqNoOf(r);
      var p = await findProject(client, wqNo); if (!p) continue;
      r.metadata = r.metadata || {}; if (!r.metadata.wequote_id) r.metadata.wequote_id = wqNo;
      var patch = { wequote_id: wqNo, wequote_name: p.description || '', wequote_customer: p.customer_name || '', wequote_status: p.status || '', wequote_internal_id: p.id, wequote_synced_at: new Date().toISOString(),
        wequote_created_at: wqIso(p.created_datetime), wequote_modified_at: wqIso(p.modified_datetime) };   // v1.1.0 — WQ activity (Board 90+ rule)
      var cust = await findCustomer(client, p.customer_name); var colPatch = {};
      if (cust) {
        var addr = [cust.address_line_1, cust.address_line_2, cust.address_line_3, cust.posttown, cust.county].filter(Boolean).join(', ');
        patch.wequote_customer_id = cust.id; if (addr) patch.wequote_address = addr; if (cust.postcode) patch.wequote_postcode = cust.postcode; if (cust.phone_number) patch.wequote_phone = cust.phone_number; if (cust.email_address) patch.wequote_email = cust.email_address;
        if (!r.client_name && cust.name) colPatch.client_name = cust.name; if (!r.client_email && cust.email_address) colPatch.client_email = cust.email_address; if (!r.client_phone && cust.phone_number) colPatch.client_phone = cust.phone_number; if (!r.address && addr) colPatch.address = addr; if (!r.postcode && cust.postcode) colPatch.postcode = cust.postcode;
      }
      var qs = await quotesFor(client, r, patch.wequote_internal_id, patch.wequote_customer_id, [p.description, p.customer_name], run);
      if (qs && qs.length) {
        patch.wequote_quotes = qs; patch.wequote_quotes_synced_at = new Date().toISOString();
        var act = [patch.wequote_modified_at].concat(qs.map(function (q) { return wqIso(q.updated_at) || wqIso(q.quote_date); })).filter(Boolean).sort();
        if (act.length) patch.wequote_activity_at = act[act.length - 1];
        if (r.value_quoted == null && qs[0].subtotal != null) colPatch.value_quoted = qs[0].subtotal;
        if (qs[0].address) { patch.wequote_address = qs[0].address; if (qs[0].postcode) patch.wequote_postcode = qs[0].postcode; if (!r.address) colPatch.address = qs[0].address; if (!r.postcode && qs[0].postcode) colPatch.postcode = qs[0].postcode; }
      } else if (patch.wequote_modified_at) { patch.wequote_activity_at = patch.wequote_modified_at; }
      if (String(r.ref || '').startsWith('SITE-') && r.metadata.wequote_id) colPatch.ref = r.metadata.wequote_id + ' - ' + (patch.wequote_name || r.name || '');
      try {
        var fresh = await client.from('projects').select('metadata,updated_at').eq('id', r.id).single();
        var fm = (fresh.data && fresh.data.metadata) || {};
        // a sync is NOT a human touch: remember the updated_at we are about to bump (SonorBoardLog.touchedAt reads it back —
        // §22). If updated_at is still our own previous sync stamp, keep the older human date.
        var prevSync = fm.wequote_synced_at && fresh.data.updated_at && Math.abs(new Date(fresh.data.updated_at) - new Date(fm.wequote_synced_at)) < 120000;
        patch.wequote_touched_before = (prevSync && fm.wequote_touched_before) ? fm.wequote_touched_before : (fresh.data && fresh.data.updated_at) || new Date().toISOString();
        var meta = Object.assign({}, fm, patch);
        var u = await client.from('projects').update(Object.assign({ metadata: meta }, colPatch)).eq('id', r.id);
        if (u.error) continue;
        r.metadata = Object.assign({}, r.metadata, patch); Object.assign(r, colPatch); changed++;
      } catch (e) { /* keep cached */ }
    }
    return changed;
  }
  global.SonorWqSync = { VERSION: VERSION, getConfig: getConfig, apiFetch: apiFetch, findProject: findProject, findCustomer: findCustomer, quotesFor: quotesFor, listAllQuotes: listAllQuotes, wqIso: wqIso, wqNoOf: wqNoOf, syncProjects: syncProjects };
})(typeof window !== 'undefined' ? window : this);
