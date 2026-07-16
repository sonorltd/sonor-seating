/*!
 * sonor-project-list.js — SSOT for project-selector grouping + ordering.
 * ----------------------------------------------------------------------------
 * Canonical master lives at the WORKSPACE ROOT. It is copied into each app's
 * `data/` by `sync-everything.sh` (pair: "sonor-project-list.js|data/sonor-project-list.js").
 * NEVER edit a per-app copy — edit THIS master, then run `bash sync-everything.sh`.
 *
 * Every Sonor app that shows a project picker consumes this so the ordering
 * rules live in ONE place (HARMONY / no-islands). Change here = change everywhere.
 *
 * Rules (one source of truth):
 *   1. ⏱ Recently edited  — top N (default 5) by updated_at. CONVENIENCE
 *      DUPLICATES — each also appears in its real group below, so nothing
 *      "disappears" from the list.
 *   2. WQ tenders         — every project whose `ref` starts with a 3–5 digit
 *      WeQuote number, sorted by that number (descending = newest WQ first).
 *   3. Trials / no WQ     — `ref` without a leading number, parked at the bottom
 *      (mostly trials / sandboxes), sorted by name.
 *   4. ✔ Completed / cancelled — v1.1.0 (Bryn 2026-07-12: "the projects list
 *      should move completed projects to the bottom based on the wequote
 *      status"). Any project whose `metadata.wequote_status` is completed/
 *      cancelled (kept fresh weekly by Master Hub's syncWqProjectNames →
 *      WQ API /project/find_project), OR whose Sonor `status` column is
 *      complete/completed/cancelled/archived, sinks to a single group at
 *      the very bottom (WQ number desc, then name). Done projects are also
 *      excluded from the ⏱ Recently-edited convenience slots so they never
 *      hog the top of the list.
 *
 * Adoption (any app):
 *   <script src="data/sonor-project-list.js"></script>   // before the app script
 *   SonorProjectList.populateSelect(selectEl, rows, { currentId });
 *   // or pure:  SonorProjectList.group(rows) -> [{key,label,items:[...]}]
 *
 * The project `rows` only need: { id, ref, name, client_name?, updated_at?, created_at? }.
 * Pass `status` + `metadata` too when available — they drive the completed sink
 * (rows without them are treated as live, never hidden).
 *
 * @version 1.1.0
 */
(function (global) {
  'use strict';
  var VERSION = '1.1.0';

  // Parse the WeQuote number from a ref ("1381 - Awaken Spa" -> 1381). null if none.
  function wqOf(p) {
    var m = String((p && p.ref) || '').match(/^\s*(\d{3,5})\b/);
    return m ? parseInt(m[1], 10) : null;
  }
  function tsOf(p) {
    var t = Date.parse((p && (p.updated_at || p.created_at)) || '');
    return isNaN(t) ? 0 : t;
  }
  function defaultLabel(p) {
    var ref = (p && p.ref) ? '[' + p.ref + '] ' : '';
    return ref + ((p && (p.name || p.client_name)) || '(untitled)');
  }

  // v1.1.0 — is the project finished? WeQuote status is the primary signal
  // (metadata.wequote_status, synced weekly by Master Hub from the WQ API);
  // the Sonor status column is the fallback for non-WQ projects. Missing
  // both → live.
  var DONE_WQ    = { completed: 1, cancelled: 1 };
  var DONE_SONOR = { complete: 1, completed: 1, cancelled: 1, archived: 1 };
  function doneOf(p) {
    if (!p) return false;
    // Accept the WQ status either nested (full row: metadata.wequote_status)
    // or top-level (lean PostgREST select alias `wequote_status:metadata->>wequote_status`).
    var wq = String(p.wequote_status || ((p.metadata || {}).wequote_status) || '').toLowerCase();
    if (DONE_WQ[wq]) return true;
    var st = String(p.status || '').toLowerCase();
    return !!DONE_SONOR[st];
  }

  // Pure — returns ordered groups: [{ key, label, items:[...] }]
  function group(rows, opts) {
    opts = opts || {};
    var recentCount = (opts.recentCount != null) ? opts.recentCount : 5;
    var wqDescending = (opts.wqDescending !== false); // default newest-first
    var list = Array.isArray(rows) ? rows.slice() : [];
    var out = [];

    // v1.1.0 — completed/cancelled projects (WQ status first, Sonor status
    // fallback) sink to their own group at the very bottom and stay out of
    // the live groups + the recent convenience slots.
    var live = list.filter(function (p) { return !doneOf(p); });
    var done = list.filter(doneOf);

    var recent = live.filter(function (p) { return tsOf(p) > 0; })
      .sort(function (a, b) { return tsOf(b) - tsOf(a); })
      .slice(0, recentCount);
    if (recent.length) out.push({ key: 'recent', label: '⏱  Recently edited', items: recent });

    var wq = live.filter(function (p) { return wqOf(p) != null; })
      .sort(function (a, b) { return wqDescending ? (wqOf(b) - wqOf(a)) : (wqOf(a) - wqOf(b)); });
    if (wq.length) out.push({ key: 'wq', label: 'WQ tenders — by number', items: wq });

    var trials = live.filter(function (p) { return wqOf(p) == null; })
      .sort(function (a, b) {
        return String((a && (a.name || a.ref)) || '').localeCompare(String((b && (b.name || b.ref)) || ''));
      });
    if (trials.length) out.push({ key: 'trials', label: 'Trials / no WQ', items: trials });

    done.sort(function (a, b) {
      var wa = wqOf(a), wb = wqOf(b);
      if (wa != null && wb != null && wa !== wb) return wqDescending ? (wb - wa) : (wa - wb);
      if ((wa != null) !== (wb != null)) return (wa != null) ? -1 : 1;   // numbered before un-numbered
      return String((a && (a.name || a.ref)) || '').localeCompare(String((b && (b.name || b.ref)) || ''));
    });
    if (done.length) out.push({ key: 'done', label: '✔  Completed / cancelled', items: done });

    return out;
  }

  // DOM — (re)build a <select> with grouped <optgroup>s, preserving selection.
  // opts: { currentId, labelFor(p), valueFor(p), placeholder (string|false), recentCount, wqDescending }
  function populateSelect(selectEl, rows, opts) {
    if (!selectEl) return;
    opts = opts || {};
    var labelFor = opts.labelFor || defaultLabel;
    var valueFor = opts.valueFor || function (p) { return p.id; };
    var keep = (opts.currentId != null) ? opts.currentId : selectEl.value;
    var doc = selectEl.ownerDocument || global.document;

    selectEl.innerHTML = '';
    if (opts.placeholder !== false) {
      var blank = doc.createElement('option');
      blank.value = '';
      blank.textContent = opts.placeholder || '— Select project —';
      selectEl.appendChild(blank);
    }
    group(rows, opts).forEach(function (g) {
      var og = doc.createElement('optgroup');
      og.label = g.label;
      g.items.forEach(function (p) {
        var o = doc.createElement('option');
        o.value = valueFor(p);
        o.textContent = labelFor(p);
        og.appendChild(o);
      });
      selectEl.appendChild(og);
    });

    var arr = Array.isArray(rows) ? rows : [];
    if (keep && arr.some(function (p) { return valueFor(p) === keep; })) selectEl.value = keep;
    else if (keep) selectEl.value = '';
    return selectEl.value;
  }

  global.SonorProjectList = {
    VERSION: VERSION, wqOf: wqOf, tsOf: tsOf, doneOf: doneOf,
    group: group, populateSelect: populateSelect, defaultLabel: defaultLabel
  };
})(typeof window !== 'undefined' ? window : this);
