/**
 * sonor-wq-sync.js — CANONICAL MASTER (sonor-platform §24 — one WeQuote sync, every app)
 * v1.3.0 · 2026-10-02 — LINKING: listProjects() (one /project/list_project per run), suggestProjects(row) (postcode · customer · name
 *   matches for a Sonor project with no WQ number yet, e.g. an ENQ- lead once the WQ project exists), linkProject(client, row, wqNo)
 *   (stamps wequote_id, renames an ENQ- / SITE- ref to "<no> - <WQ description>", syncs the row). Board 🔗 and Hub use it.
 * v1.2.0 · 2026-10-01 — QUOTE INDEX: every WQ quote fetched once (/quote/get) and kept by WQ project_id / customer_id in the
 *   `wq_quote_index` table (B-506) or this browser's localStorage; a project's quotes are then a lookup, not a name guess (1192
 *   Linkside etc. had quotes whose descriptions never mentioned the project). Incremental after the first build.
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
  var VERSION = '1.3.0';
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
  function compact(q) {
    return { id: q.id, quote_no: q.quote_no, description: q.description, title: q.title, stage: q.stage, subtotal: q.subtotal, total: q.total, margin: q['total_margin_%'],
      quote_date: q.quote_date, expiry_date: q.expiry_date, accepted_date: q.accepted_date || null, created_at: q.created_datetime || null, updated_at: q.updated_datetime || null,
      project_id: q.project_id || null, customer_id: q.customer_id || null, revision: q.revision || null, is_latest: q.is_latest_revision !== false, archived: !!q.archived,
      subsystems: (q.subsystems || []).map(function (s) { return s.description; }),
      address: [q.address_line_1, q.address_line_2, q.address_line_3, q.posttown, q.county].filter(Boolean).join(', '), postcode: q.postcode || '' };
  }
  // ── v1.2.0 QUOTE INDEX — every WeQuote quote, keyed by WQ project / customer, so "which quotes belong to project N" is a
  // lookup instead of a name guess (WQ's /quote/list has no project filter and carries only id / no / description). Lives in
  // the `wq_quote_index` table when it exists (B-506 — shared by every device) and otherwise in localStorage on this
  // browser (Hub + Board share it: same origin). Built once (one /quote/get per quote), then only NEW quote ids are fetched
  // and the quotes of the projects being synced are re-fetched so stage changes land.
  var IDX_KEY = 'sonor:wq-quote-index';
  async function loadIndex(client, run) {
    if (run && run.index) return run.index;
    var idx = { quotes: {}, built_at: null, store: 'local' };
    try {
      var r = await client.from('wq_quote_index').select('*');
      if (!r.error && Array.isArray(r.data)) {
        idx.store = 'table';
        r.data.forEach(function (row) { idx.quotes[row.quote_id] = { id: row.quote_id, quote_no: row.quote_no, description: row.description, title: row.title, stage: row.stage, subtotal: row.subtotal, total: row.total, margin: row.margin_pct,
          quote_date: row.quote_date, expiry_date: row.expiry_date, accepted_date: row.accepted_date, created_at: row.wq_created_at, updated_at: row.wq_updated_at, project_id: row.project_id, customer_id: row.customer_id,
          revision: row.revision, is_latest: row.is_latest !== false, archived: !!row.archived, subsystems: row.subsystems || [], address: row.address || '', postcode: row.postcode || '' }; });
        idx.built_at = r.data.length ? 'table' : null;
      }
    } catch (e) { /* no table → local */ }
    if (idx.store === 'local') {
      try { var j = JSON.parse(localStorage.getItem(IDX_KEY) || 'null'); if (j && j.quotes) { idx.quotes = j.quotes; idx.built_at = j.built_at; } } catch (e) {}
    }
    if (run) run.index = idx;
    return idx;
  }
  async function saveIndex(client, idx, changedIds) {
    if (idx.store === 'table') {
      var rows = (changedIds || Object.keys(idx.quotes)).map(function (id) { var q = idx.quotes[id]; return q && { quote_id: q.id, quote_no: q.quote_no, project_id: q.project_id, customer_id: q.customer_id, stage: q.stage, description: q.description, title: q.title,
        revision: q.revision, is_latest: q.is_latest, archived: q.archived, quote_date: q.quote_date, expiry_date: q.expiry_date, accepted_date: q.accepted_date, subtotal: q.subtotal, total: q.total, margin_pct: q.margin,
        subsystems: q.subsystems, address: q.address, postcode: q.postcode, wq_created_at: wqIso(q.created_at), wq_updated_at: wqIso(q.updated_at), indexed_at: new Date().toISOString() }; }).filter(Boolean);
      for (var i = 0; i < rows.length; i += 200) { try { await client.from('wq_quote_index').upsert(rows.slice(i, i + 200), { onConflict: 'quote_id' }); } catch (e) {} }
    } else {
      try { localStorage.setItem(IDX_KEY, JSON.stringify({ v: 1, built_at: idx.built_at || new Date().toISOString(), quotes: idx.quotes })); } catch (e) {}
    }
  }
  // fetch every quote id not yet indexed (+ the ids in refreshIds) — one /quote/get each
  async function updateIndex(client, run, refreshIds, onProgress) {
    run = run || {};
    var idx = await loadIndex(client, run);
    var list = await listAllQuotes(client, run);
    var want = list.filter(function (q) { return !idx.quotes[q.id]; }).map(function (q) { return q.id; });
    (refreshIds || []).forEach(function (id) { if (want.indexOf(id) < 0 && idx.quotes[id]) want.push(id); });
    run.fetched = run.fetched || {}; want = want.filter(function (id) { return !run.fetched[id]; });   // once per run
    var changed = [];
    for (var i = 0; i < want.length; i++) {
      if (onProgress) try { onProgress(i + 1, want.length, { ref: 'WQ quote index', name: String(want[i]) }); } catch (_) {}
      var q = await apiFetch(client, '/quote/get', { id: want[i] });
      run.fetched[want[i]] = true;
      if (q && q.id) { idx.quotes[q.id] = compact(q); changed.push(q.id); }
    }
    if (changed.length || !idx.built_at) { idx.built_at = idx.built_at || new Date().toISOString(); await saveIndex(client, idx, changed); }
    return idx;
  }
  var byProject = function (idx, internalId) { return Object.keys(idx.quotes).map(function (k) { return idx.quotes[k]; }).filter(function (q) { return q.project_id === internalId && q.is_latest !== false; }); };
  // quotes for one project: the index by WQ project id (re-fetched so the stage is current); name-match on the list
  // only as a fallback for quotes filed under the customer without a project
  async function quotesFor(client, row, internalId, customerId, names, run) {
    run = run || {};
    try {
      var idx = await loadIndex(client, run);
      var mine = internalId ? byProject(idx, internalId) : [];
      if (mine.length) {
        await updateIndex(client, run, mine.map(function (q) { return q.id; }));
        mine = byProject(idx, internalId);
      } else {
        var m = row.metadata || {};
        var keys = [].concat(names || [], [m.wequote_name, row.name, row.client_name, m.wequote_customer]).map(norm).filter(function (n) { return n && n.length >= 3; });
        var list = await listAllQuotes(client, run);
        var cands = list.filter(function (q) { return !idx.quotes[q.id] && keys.some(function (n) { return norm((q.description || '') + ' ' + (q.quote_title || '')).indexOf(n) >= 0; }); }).slice(0, 8);
        for (var i = 0; i < cands.length; i++) { var q = await apiFetch(client, '/quote/get', { id: cands[i].id }); if (q && q.id) idx.quotes[q.id] = compact(q); }
        if (cands.length) await saveIndex(client, idx, cands.map(function (c) { return c.id; }));
        mine = internalId ? byProject(idx, internalId) : [];
        if (!mine.length && customerId) mine = Object.keys(idx.quotes).map(function (k) { return idx.quotes[k]; }).filter(function (q) { return q.customer_id === customerId && !q.project_id && q.is_latest !== false; });
      }
      return mine.sort(function (a, b) { return (Number(b.quote_no) || 0) - (Number(a.quote_no) || 0); });
    } catch (e) { return null; }
  }
  // WeQuote stamps are "YYYY-MM-DD HH:MM:SS" (UK) — normalise to ISO so every app compares them the same way
  var wqIso = function (v) { if (!v) return null; var d = new Date(String(v).replace(' ', 'T')); return isNaN(d) ? null : d.toISOString(); };
  // ── v1.3.0 linking ──
  async function listProjects(client, run) {
    if (run && run.projects) return run.projects;
    var j = await apiFetch(client, '/project/list_project', {});
    var list = Array.isArray(j) ? j : [];
    if (run) run.projects = list;
    return list;
  }
  var pcNorm = function (s) { return String(s || '').toUpperCase().replace(/\s+/g, ''); };
  var words = function (s) { return norm(s).split(/[^a-z0-9]+/).filter(function (w) { return w.length >= 3 && ['the','and','ltd','limited','mr','mrs','dr','house','road','lane','drive','court','avenue','street','new','build','project','electrical','home','smart','cinema','upgrade','upgrades','installation','room','enq'].indexOf(w) < 0; }); };
  // candidates for a Sonor row with no WQ number: scored by postcode (strong), customer/client name words, WQ description vs Sonor name/ref words
  async function suggestProjects(client, row, run, taken) {
    var list = await listProjects(client, run);
    taken = taken || {};
    var pc = pcNorm(row.postcode); var who = words([row.client_name, row.name, row.metadata && row.metadata.wequote_customer].join(' ')); var what = words([row.name, row.ref, row.address, row.notes].join(' '));
    var enq = (row.metadata && (row.metadata.enquiry_date || row.metadata.first_seen)) || row.created_at; var enqT = enq ? new Date(enq).getTime() : 0;
    return list.map(function (p) {
      var score = 0, why = [];
      // a WQ project no Sonor project owns yet, created around / after the enquiry, is the likeliest match of all
      var cT = p.created_datetime ? new Date(String(p.created_datetime).replace(' ', 'T')).getTime() : 0;
      if (!taken[String(p.project_no)]) { var dd = enqT && cT ? (cT - enqT) / 86400000 : null; if (dd != null && dd >= -3 && dd <= 45) { score += 40; why.push('unlinked, created ' + Math.round(dd) + 'd after the enquiry'); } else if (dd != null && dd > -45 && dd < 0) { score += 15; why.push('unlinked, created ' + Math.round(-dd) + 'd before the enquiry'); } }
      if (pc && pcNorm(p.postcode) === pc) { score += 60; why.push('postcode'); }
      var cw = words(p.customer_name); var hitC = cw.filter(function (w) { return who.indexOf(w) >= 0; });
      if (hitC.length) { score += 25 * hitC.length; why.push('customer ' + hitC.join(' ')); }
      var dw = words(p.description); var hitD = dw.filter(function (w) { return what.indexOf(w) >= 0; });
      if (hitD.length) { score += 10 * hitD.length; why.push('name ' + hitD.join(' ')); }
      if (taken[String(p.project_no)]) score -= 100;
      return { no: String(p.project_no), id: p.id, description: p.description, customer: p.customer_name, postcode: p.postcode, created: p.created_datetime, status: p.status, score: score, why: why.join(' · ') };
    }).filter(function (c) { return c.score > 0; }).sort(function (a, b) { return b.score - a.score || (b.created > a.created ? 1 : -1); }).slice(0, 6);
  }
  // link a Sonor project to a WQ project number, then sync it (names, customer, quotes, activity)
  async function linkProject(client, row, wqNo, opts) {
    opts = opts || {};
    wqNo = String(wqNo || '').trim(); if (!/^\d{3,5}$/.test(wqNo)) throw new Error('WeQuote project number expected (e.g. 1407)');
    var p = await findProject(client, wqNo); if (!p) throw new Error('WeQuote has no project ' + wqNo);
    var fresh = await client.from('projects').select('metadata,updated_at').eq('id', row.id).single();
    var fm = (fresh.data && fresh.data.metadata) || {};
    var meta = Object.assign({}, fm, { wequote_id: wqNo, wequote_internal_id: p.id, wequote_linked_at: new Date().toISOString(), wequote_linked_by: opts.by || 'board', wequote_touched_before: fm.wequote_touched_before || (fresh.data && fresh.data.updated_at) || null });
    var u = await client.from('projects').update({ metadata: meta }).eq('id', row.id);
    if (u.error) throw u.error;
    row.metadata = meta;
    var n = await syncProjects(client, [row], { force: true, onProgress: opts.onProgress });
    return { project: p, changed: n };
  }
  async function syncProjects(client, rows, opts) {
    opts = opts || {}; var force = !!opts.force;
    var staleBefore = Date.now() - 7 * 24 * 3600e3;
    var targets = (rows || []).filter(function (r) { var m = r.metadata || {}; if (!wqNoOf(r)) return false; if (force || !m.wequote_name || !m.wequote_id || !m.wequote_activity_at) return true;   /* v1.1.0: no activity stamp yet → pull once */ return !(m.wequote_synced_at && new Date(m.wequote_synced_at).getTime() > staleBefore); });
    var changed = 0, done = 0; var run = {};
    if (targets.length) { try { await updateIndex(client, run, null, opts.onProgress); } catch (e) {} }   // v1.2.0 quote index (new quotes only after the first build)
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
      if (/^(SITE-|ENQ\b|ENQ-)/.test(String(r.ref || '')) && r.metadata.wequote_id) colPatch.ref = r.metadata.wequote_id + ' - ' + (patch.wequote_name || r.name || '');   // v1.3.0: ENQ- leads take the WQ ref once linked
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
  global.SonorWqSync = { VERSION: VERSION, getConfig: getConfig, apiFetch: apiFetch, findProject: findProject, findCustomer: findCustomer, quotesFor: quotesFor, listAllQuotes: listAllQuotes, listProjects: listProjects, suggestProjects: suggestProjects, linkProject: linkProject, loadIndex: loadIndex, updateIndex: updateIndex, saveIndex: saveIndex, wqIso: wqIso, wqNoOf: wqNoOf, syncProjects: syncProjects };
})(typeof window !== 'undefined' ? window : this);
