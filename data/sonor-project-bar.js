// sonor-project-bar.js — CANONICAL MASTER (Spine v1.2.5 §16 family)
//
// Shared project picker + metadata strip for every Sonor app that wants
// to bind to a `projects` row from Supabase. Replaces the hand-rolled
// project bars in each app (Takeoffs, Leads, Cinema Design, etc) with
// one consistent component synced across the family.
//
// Architecture:
//   - Loads `projects` table on init (RLS: anon SELECT) into a local cache
//   - Renders a top strip: dropdown picker + metadata pills (ref / status /
//     client / address) + Refresh button + "+ New" button
//   - Active project ID persisted in localStorage `sonor_active_project_id`
//     (cross-tab synced via the `storage` event — switch project in one
//     tab, every other Sonor tab follows)
//   - Fires CustomEvent `sonor:project-changed` on document with detail
//     { previousId, currentId, project } so apps can rebuild state
//
// Loading patterns:
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
//   <script src="data/sonor-project-bar.js"></script>     ← AFTER supabase-js
//   <script>
//     SonorProjectBar.init({
//       supa: db,                                  // initialised SupabaseClient
//       host: document.getElementById('projectBarHost'),  // optional, lazily creates if absent
//       onChange: function(detail) { ... }         // optional callback
//     });
//   </script>
//
// Namespace: window.SonorProjectBar
//
// Version: 1.5.0 — 📄 Brief link (2026-07-16, B-398). When the active project
//                  has a structured client brief (projects.metadata.brief —
//                  the pattern established on 1387 Andy Bell), the bar shows a
//                  "📄 Brief" link next to the meta pills that opens the live
//                  per-project brief page in a NEW TAB:
//                  https://sonorltd.github.io/sonor-project-master/brief.html?pid={id}
//                  The page renders metadata.brief + the notes timeline, so it
//                  needs no rebuild as more client info is logged. Shown in
//                  BOTH normal and readOnly (host-mode) bars.
// Version: 1.4.0 — PER-APP project memory (`appKey` init option, 2026-07-16).
//                  Bryn: "we just want same menu layout, not the same project to
//                  be selected on refresh in different apps." Pass `appKey`
//                  ('takeoffs', 'cinema-design', …): the bar persists/restores
//                  the active project under `sonor_active_project_id::{appKey}`
//                  — each app remembers ITS OWN project across refreshes. The
//                  bar still PUBLISHES to the bus (global key = "last touched",
//                  which hosts stamp for embedded children), but a standalone
//                  bar no longer FOLLOWS other apps' bus events — it only syncs
//                  its own app's tabs via a storage listener on the scoped key.
//                  `readOnly` (host-mode) bars are the exception: they follow
//                  ALL bus events + boot from the GLOBAL key, so an embedded
//                  app stays in lockstep with its host. No appKey → legacy
//                  global-key behaviour unchanged.
// Version: 1.3.0 — `readOnly` init option (host mode, 2026-07-16). When an app
//                  runs EMBEDDED inside another Sonor app (e.g. Cinema Takeoff
//                  inside Cinema Design's Takeoff tab), pass `readOnly: true`:
//                  the bar renders the active project as a static label — no
//                  <select>, no ↻/+New — so there is exactly ONE picker (the
//                  host's) and the embedded app can never diverge to a second
//                  project. The bar still subscribes to the bus, so it follows
//                  every host switch and always shows what it's locked to.
// Version: 1.2.0 — picker delegates grouping/ordering to SonorProjectList when
//                  present (2026-07-16): same Recently-edited / WQ-tenders /
//                  Trials / Completed-sink view as the Takeoffs project selector —
//                  ONE SSOT (`sonor-project-list.js`) for every Sonor picker.
//                  Additive: without the module the bar renders the v1.1.0 flat
//                  list unchanged. Load `data/sonor-project-list.js` BEFORE this
//                  file to opt in.
// Version: 1.1.0 — consumes sonor-project-bus.js when present (2026-05-17, B-263)
//                  No behaviour change for callers — bus integration is additive.
//                  If bus is loaded, all cross-tab/iframe/Realtime sync routes
//                  through the bus (single writer). If bus is NOT loaded, the
//                  bar falls back to its own localStorage + storage event
//                  handling exactly as in v1.0.0.
// Version: 1.0.0 — initial extraction (2026-04-28 / PM v3.5.0)
(function () {
  'use strict';

  if (typeof window !== 'undefined' && window.SonorProjectBar && window.SonorProjectBar.__version) {
    return;  // idempotent — second load is a no-op
  }

  // v1.1.0 — bus integration. If sonor-project-bus.js is loaded, the bar
  // becomes a pure UI layer over it: state lives in the bus, events come
  // from the bus, broadcasts go through the bus. If absent, the bar keeps
  // its v1.0.0 self-contained behaviour (localStorage + storage event).
  // Looked up dynamically (not cached) so script load order doesn't matter.
  function _bus() {
    return (typeof window !== 'undefined' && window.SonorProjectBus) || null;
  }

  const LS_KEY = 'sonor_active_project_id';
  // v1.5.0 — per-project client-brief page (repo-slug URL form per the
  // GITHUB PAGES URL LAW; page lives in the Project Master repo).
  const BRIEF_URL = 'https://sonorltd.github.io/sonor-project-master/brief.html';
  function _briefLink(active) {
    if (!active || !active.metadata || !active.metadata.brief) return '';
    return `<a class="brief-link" href="${BRIEF_URL}?pid=${encodeURIComponent(active.id)}" target="_blank" rel="noopener" title="Client brief for this project — opens in a new tab">📄 Brief</a>`;
  }

  // ---- Internal state ----
  let _supa = null;
  let _projects = [];                 // cached rows
  let _activeId = null;
  let _onChange = null;
  let _readOnly = false;   // v1.3.0 — host mode: label instead of picker
  let _appKey = null;      // v1.4.0 — per-app project memory (scoped LS key)

  // v1.4.0 — which LS key this bar instance persists/restores from.
  // readOnly (embedded) bars use the GLOBAL key — the host stamps it.
  // appKey bars use the app-scoped key — per-app memory.
  function _lsKeyFor() {
    if (_readOnly || !_appKey) return LS_KEY;
    return LS_KEY + '::' + _appKey;
  }
  let _hostEl = null;
  let _initialised = false;

  // ---- Helpers ----
  function _read(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function _write(key, val) {
    try { localStorage.setItem(key, val); } catch (e) { /* quota — ignore */ }
  }
  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ---- Status colour ----
  // Keys mirror the canonical `project_status` enum in Supabase
  // (enquiry|quoted|won|active|install|commission|snagging|complete|on_hold|lost).
  // Legacy uppercase aliases retained for back-compat with older surfaces.
  const STATUS_COLOUR = {
    ENQUIRY:    '#b7b1a7',
    QUOTED:     '#e37c59',
    QUOTE:      '#e37c59',  // legacy alias
    WON:        '#78ba57',
    ACTIVE:     '#4bb9d3',
    INSTALL:    '#4bb9d3',
    COMMISSION: '#4bb9d3',
    SNAGGING:   '#ec6061',
    COMPLETE:   '#78ba57',
    COMPLETED:  '#78ba57', // legacy alias
    ON_HOLD:    '#f5d05c',
    LOST:       '#b7b1a7',
    // legacy aliases (kept so old localStorage / old rows don't crash colour lookup)
    PROPOSED:   '#e37c59',
    ISSUED:     '#4bb9d3',
    LIVE:       '#4bb9d3',
    APPROVED:   '#78ba57',
    CANCELLED:  '#b7b1a7',
    ARCHIVED:   '#b7b1a7'
  };
  function _statusColour(status) {
    if (!status) return '#b7b1a7';
    return STATUS_COLOUR[String(status).toUpperCase()] || '#b7b1a7';
  }

  // ---- Inject the project bar CSS (one-shot, idempotent) ----
  function _injectStyles() {
    if (document.getElementById('sonor-project-bar-styles')) return;
    const css = `
      .sonor-project-bar {
        background: var(--footer-bg, #141008);
        color: var(--body, #F4F1EC);
        padding: 10px 16px;
        display: flex; flex-wrap: wrap; align-items: center; gap: 12px;
        font-family: 'DM Sans', -apple-system, sans-serif; font-size: 12.5px;
        border-bottom: 1px solid rgba(244, 241, 236, 0.10);
      }
      .sonor-project-bar .label {
        font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase;
        opacity: 0.55; font-weight: 600;
      }
      .sonor-project-bar select {
        background: transparent;
        color: var(--body, #F4F1EC);
        border: 1px solid rgba(244, 241, 236, 0.22);
        border-radius: 4px;
        padding: 5px 10px;
        font-family: 'DM Mono', SF Mono, monospace; font-size: 12px;
        min-width: 220px; cursor: pointer;
      }
      .sonor-project-bar select:focus { outline: 1px solid var(--accent, #6b4a8a); outline-offset: 1px; }
      .sonor-project-bar select option { background: #2a1f15; color: #F4F1EC; }
      .sonor-project-bar .meta {
        display: inline-flex; align-items: center; gap: 14px;
        font-family: 'DM Mono', SF Mono, monospace; font-size: 11px;
        opacity: 0.85;
      }
      .sonor-project-bar .meta-cell { display: inline-flex; gap: 5px; align-items: baseline; }
      .sonor-project-bar .meta-cell .k {
        font-size: 9px; letter-spacing: 0.08em; opacity: 0.55; text-transform: uppercase;
      }
      .sonor-project-bar .brief-link {
        font-size: 11.5px; font-weight: 600; text-decoration: none;
        color: #F4F1EC; background: rgba(107, 74, 138, 0.55);
        border: 1px solid rgba(107, 74, 138, 0.9);
        padding: 2px 9px; border-radius: 999px; white-space: nowrap;
      }
      .sonor-project-bar .brief-link:hover { background: rgba(107, 74, 138, 0.85); }
      .sonor-project-bar .status-pill {
        display: inline-flex; align-items: center; gap: 4px;
        padding: 2px 9px; border-radius: 10px;
        font-size: 10px; font-weight: 700; letter-spacing: 0.06em;
      }
      .sonor-project-bar .actions { margin-left: auto; display: inline-flex; gap: 6px; }
      .sonor-project-bar button {
        background: transparent; color: var(--body, #F4F1EC);
        border: 1px solid rgba(244, 241, 236, 0.22);
        border-radius: 4px; padding: 5px 11px;
        font-family: 'DM Mono', SF Mono, monospace; font-size: 11px;
        cursor: pointer; transition: background 0.12s;
      }
      .sonor-project-bar button:hover { background: rgba(244, 241, 236, 0.07); }
      .sonor-project-bar button.primary {
        background: var(--accent, #6b4a8a); border-color: var(--accent, #6b4a8a);
      }
      .sonor-project-bar button.primary:hover {
        background: rgba(107, 74, 138, 0.85);
      }
      .sonor-project-bar .note {
        font-size: 10.5px; opacity: 0.55; font-style: italic;
      }
    `;
    const style = document.createElement('style');
    style.id = 'sonor-project-bar-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ---- Render the bar into _hostEl ----
  function _render() {
    if (!_hostEl) return;
    const active = _projects.find(p => p && p.id === _activeId) || null;
    const status = active && active.status ? String(active.status).toUpperCase() : '';
    const statusCol = _statusColour(status);
    const opts = [
      '<option value="">— select project —</option>',
      ..._projects.map(p => {
        const sel = p.id === _activeId ? ' selected' : '';
        const ref = p.ref ? `[${p.ref}] ` : '';
        return `<option value="${_esc(p.id)}"${sel}>${_esc(ref + (p.name || 'Untitled'))}</option>`;
      })
    ].join('');
    // v1.3.0 — host mode: the active project is DISPLAYED, never picked here.
    // The host app's bar is the single selector; this bar follows via the bus.
    if (_readOnly) {
      _hostEl.innerHTML = `
        <div class="sonor-project-bar" role="region" aria-label="Project (set by host app)">
          <span class="label">Project</span>
          <span class="meta-cell" title="Project is selected in the host app — this embedded view follows it automatically."><span class="k">🔗</span><span>${active ? _esc((active.ref ? '[' + active.ref + '] ' : '') + (active.name || 'Untitled')) : '— follows host app —'}</span></span>
          ${active ? `
            <span class="meta">
              ${active.client_name ? `<span class="meta-cell"><span class="k">CLIENT</span><span>${_esc(active.client_name)}</span></span>` : ''}
              ${status ? `<span class="status-pill" style="background:${statusCol}33;border:1px solid ${statusCol};color:#F4F1EC">${_esc(status)}</span>` : ''}
              ${_briefLink(active)}
            </span>
          ` : '<span class="note">No project selected in the host app yet.</span>'}
        </div>
      `;
      return;   // no select / refresh / +New wiring in host mode
    }
    _hostEl.innerHTML = `
      <div class="sonor-project-bar" role="region" aria-label="Project picker">
        <span class="label">Project</span>
        <select id="sonorProjectPicker" aria-label="Select active project">${opts}</select>
        ${active ? `
          <span class="meta">
            ${active.ref ? `<span class="meta-cell"><span class="k">REF</span><span>${_esc(active.ref)}</span></span>` : ''}
            ${active.client_name ? `<span class="meta-cell"><span class="k">CLIENT</span><span>${_esc(active.client_name)}</span></span>` : ''}
            ${active.address ? `<span class="meta-cell"><span class="k">ADDR</span><span>${_esc(active.address)}</span></span>` : ''}
            ${status ? `<span class="status-pill" style="background:${statusCol}33;border:1px solid ${statusCol};color:#F4F1EC">${_esc(status)}</span>` : ''}
            ${_briefLink(active)}
          </span>
        ` : '<span class="note">No project selected — pick one above to load it into this app.</span>'}
        <span class="actions">
          <button id="sonorProjectRefresh" title="Re-fetch projects from Supabase">↻</button>
          <button id="sonorProjectNew" class="primary" title="Create a new project">+ New</button>
        </span>
      </div>
    `;
    // Wire the selector
    const sel = document.getElementById('sonorProjectPicker');
    // v1.2.0 — delegate grouping/ordering to the workspace SSOT when loaded
    // (data/sonor-project-list.js): ⏱ Recently edited → WQ tenders (desc) →
    // Trials/no-WQ → ✔ Completed/cancelled sink. EXACTLY the Takeoffs
    // selector view, from the same module. The inline flat `opts` above
    // remains the no-module fallback (offline / fetch fail) — same pattern
    // as Takeoffs' _populateProjectDropdown (v5.34.0).
    if (sel && window.SonorProjectList && typeof window.SonorProjectList.populateSelect === 'function') {
      try {
        window.SonorProjectList.populateSelect(sel, _projects, {
          currentId: _activeId,
          placeholder: '— select project —'
        });
      } catch (e) {
        console.warn('[ProjectBar] SonorProjectList delegate failed — flat list kept:', e && e.message);
      }
    }
    if (sel) {
      sel.addEventListener('change', e => {
        const newId = e.target.value || null;
        _setActiveProject(newId);
      });
    }
    const refreshBtn = document.getElementById('sonorProjectRefresh');
    if (refreshBtn) refreshBtn.addEventListener('click', () => loadProjects());
    const newBtn = document.getElementById('sonorProjectNew');
    if (newBtn) newBtn.addEventListener('click', _openNewProjectDialog);
  }

  // ---- Active project state machine ----
  function _setActiveProject(newId) {
    const previousId = _activeId;
    if (previousId === newId) return;
    _activeId = newId;
    // v1.4.0 — per-app memory: ALWAYS persist to this app's scoped key (this is
    // what boot restores from). The bus write below still maintains the global
    // "last touched" key for hosts/embedded handoffs.
    if (_appKey && !_readOnly) {
      if (newId) _write(_lsKeyFor(), newId);
      else { try { localStorage.removeItem(_lsKeyFor()); } catch (e) {} }
    }
    // v1.1.0 — when bus is present, route the write through it (single writer).
    // The bus handles LS + cross-tab/iframe/Realtime fan-out + dispatches the
    // same `sonor:project-changed` CustomEvent. Our subscriber (bound in init)
    // catches the echo, updates _activeId/_render again no-op, and calls onChange.
    const bus = _bus();
    if (bus && typeof bus.set === 'function') {
      bus.set(newId, { source: _appKey || 'project-bar', actor: 'human' });
      // No early-return here — the bar's UI also wants the onChange callback
      // fired locally with the project object. Bus dispatches the doc event;
      // we still need to invoke _onChange with the resolved project row.
      _render();
      const project = _projects.find(p => p && p.id === newId) || null;
      const detail = { previousId, currentId: newId, project };
      if (typeof _onChange === 'function') {
        try { _onChange(detail); } catch (e) { console.warn('[ProjectBar] onChange threw:', e); }
      }
      return;
    }
    // v1.0.0 fallback path — no bus, self-contained
    if (newId) _write(LS_KEY, newId); else { try { localStorage.removeItem(LS_KEY); } catch (e) {} }
    _render();
    const project = _projects.find(p => p && p.id === newId) || null;
    const detail = { previousId, currentId: newId, project };
    document.dispatchEvent(new CustomEvent('sonor:project-changed', { detail }));
    if (typeof _onChange === 'function') {
      try { _onChange(detail); } catch (e) { console.warn('[ProjectBar] onChange threw:', e); }
    }
  }

  // ---- Cross-tab sync — listen to storage events ----
  // v1.1.0 — when bus is present, bus owns storage event handling.
  // We subscribe to the bus instead. If bus is absent, fall back to v1.0.0.
  function _bindStorageSync() {
    const bus = _bus();
    // v1.4.0 — per-app bars DO NOT follow the bus (that's what made every app
    // land on the same project). They sync only their OWN app's tabs via a
    // storage listener on the scoped key. Embedded readOnly bars still follow
    // the bus below (host lockstep); legacy no-appKey bars keep v1.1.0 behaviour.
    if (_appKey && !_readOnly) {
      window.addEventListener('storage', (e) => {
        if (e.key !== _lsKeyFor()) return;
        const newId = e.newValue || null;
        if (newId === _activeId) return;
        _activeId = newId;
        _render();
        const project = _projects.find(p => p && p.id === newId) || null;
        const detail = { previousId: null, currentId: newId, project, fromOtherTab: true, via: 'storage-event' };
        document.dispatchEvent(new CustomEvent('sonor:project-changed', { detail }));
        if (typeof _onChange === 'function') {
          try { _onChange(detail); } catch (e2) { /* ignore */ }
        }
      });
      return;
    }
    if (bus && typeof bus.subscribe === 'function') {
      bus.subscribe((detail) => {
        // Skip if we initiated this set (project-bar source) — onChange already fired.
        if (detail && detail.source === 'project-bar' && detail.via === 'set') return;
        const newId = detail && detail.currentId || null;
        if (newId === _activeId) return;
        _activeId = newId;
        _render();
        const project = _projects.find(p => p && p.id === newId) || null;
        const onChangeDetail = {
          previousId: detail && detail.previousId,
          currentId: newId,
          project,
          fromOtherTab: detail && detail.via === 'storage-event',
          via: detail && detail.via
        };
        if (typeof _onChange === 'function') {
          try { _onChange(onChangeDetail); } catch (e) { /* ignore */ }
        }
      });
      return;
    }
    // v1.0.0 fallback — direct storage event handling
    window.addEventListener('storage', (e) => {
      if (e.key !== LS_KEY) return;
      const newId = e.newValue || null;
      if (newId === _activeId) return;
      _activeId = newId;
      _render();
      const project = _projects.find(p => p && p.id === newId) || null;
      const detail = { previousId: null, currentId: newId, project, fromOtherTab: true };
      document.dispatchEvent(new CustomEvent('sonor:project-changed', { detail }));
      if (typeof _onChange === 'function') {
        try { _onChange(detail); } catch (e) { /* ignore */ }
      }
    });
  }

  // ---- Project list loader ----
  async function loadProjects() {
    if (!_supa) return [];
    try {
      const { data, error } = await _supa
        .from('projects')
        .select('id, ref, name, client_name, address, postcode, status, metadata, created_at, updated_at')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      _projects = Array.isArray(data) ? data : [];
      _render();
      return _projects;
    } catch (e) {
      console.warn('[ProjectBar] loadProjects failed:', e && e.message);
      return [];
    }
  }

  // Suggest a unique-looking project ref so users don't have to invent one.
  // Pattern: SON-{YYYY}-{NNN} where NNN is the next free number for the year
  // across the loaded _projects list. Falls back to SON-{YYYY}-001 if no
  // existing refs match the pattern.
  function _suggestRef() {
    const yr = String(new Date().getFullYear());
    const re = new RegExp('^SON-' + yr + '-(\\d{3,})$', 'i');
    let max = 0;
    for (const p of _projects) {
      if (!p || !p.ref) continue;
      const m = String(p.ref).match(re);
      if (m) {
        const n = parseInt(m[1], 10);
        if (Number.isFinite(n) && n > max) max = n;
      }
    }
    return 'SON-' + yr + '-' + String(max + 1).padStart(3, '0');
  }

  // Inserts a project; returns the resolved promise the caller awaits.
  // Centralised so the retry-on-conflict path doesn't duplicate logic.
  function _insertProject(payload) {
    return _supa.from('projects')
      .insert(payload)
      .select('id, ref, name, client_name, address, postcode, status, metadata')
      .single();
  }

  function _openNewProjectDialog() {
    const name = prompt('New project name:');
    if (!name) return;
    const suggestion = _suggestRef();
    let ref = prompt(
      'Reference (leave blank for none, or accept the suggestion):',
      suggestion
    );
    // null = user cancelled the second prompt entirely. Treat as abort,
    // not as "use no ref" — the user might have second-thoughts.
    if (ref === null) return;
    if (!_supa) {
      alert('Supabase not connected — can\'t create a project.');
      return;
    }
    const payload = {
      name: String(name).trim(),
      ref: String(ref).trim() || null,
      // Supabase project_status enum is lowercase:
      // enquiry|quoted|won|active|install|commission|snagging|complete|on_hold|lost
      status: 'enquiry'
    };
    _insertProject(payload).then(({ data, error }) => {
      if (error) {
        // Postgres unique-violation = SQLSTATE 23505. Surfaced by Supabase
        // with `code: '23505'` AND `message` containing the constraint name.
        // Detect the projects.ref unique violation specifically and offer
        // a one-step retry with a different ref (don't lose the name input).
        const isRefDup = (error.code === '23505' && /projects_ref/i.test(error.message || '')) ||
                         /duplicate key.*projects_ref/i.test(error.message || '');
        if (isRefDup && payload.ref) {
          const retry = prompt(
            'Reference "' + payload.ref + '" is already in use.\n\n' +
            'Pick a different reference (or leave blank for none):',
            _suggestRef()
          );
          if (retry === null) return; // cancelled
          const retryPayload = Object.assign({}, payload, {
            ref: String(retry).trim() || null
          });
          _insertProject(retryPayload).then(({ data: data2, error: err2 }) => {
            if (err2) {
              alert('Create project failed: ' + (err2.message || err2));
              return;
            }
            _projects.unshift(data2);
            _setActiveProject(data2.id);
          });
          return;
        }
        alert('Create project failed: ' + (error.message || error));
        return;
      }
      _projects.unshift(data);
      _setActiveProject(data.id);
    });
  }

  // ---- Public init ----
  async function init(opts) {
    if (_initialised) {
      console.warn('[ProjectBar] already initialised — call refresh() instead.');
      return;
    }
    _initialised = true;
    _supa = (opts && opts.supa) || null;
    _onChange = (opts && typeof opts.onChange === 'function') ? opts.onChange : null;
    _readOnly = !!(opts && opts.readOnly);   // v1.3.0 — host mode
    _appKey = (opts && opts.appKey) || null; // v1.4.0 — per-app memory
    _hostEl = (opts && opts.host) || null;
    if (!_hostEl) {
      // Auto-create at top of body
      _hostEl = document.createElement('div');
      _hostEl.id = 'sonorProjectBarHost';
      const first = document.body.firstChild;
      if (first) document.body.insertBefore(_hostEl, first);
      else document.body.appendChild(_hostEl);
    }
    _injectStyles();
    _bindStorageSync();
    // Restore active project from localStorage — v1.4.0: scoped key when
    // appKey given (per-app memory); GLOBAL key for readOnly/legacy bars.
    _activeId = _read(_lsKeyFor()) || null;
    _render();   // initial empty render so the bar shows immediately
    if (_supa) await loadProjects();
    // If we have an active id but the project isn't in the list, render anyway
    // (consumer can detect missing project via getProject() returning null)
    _render();
    return _projects;
  }

  function getActiveId() { return _activeId; }
  function getProject(id) {
    const target = id || _activeId;
    if (!target) return null;
    return _projects.find(p => p && p.id === target) || null;
  }
  function getProjects() { return _projects.slice(); }
  function setActive(id) { _setActiveProject(id); }
  function refresh() { return loadProjects(); }

  // ---- Export ----
  const api = {
    init, refresh, loadProjects,
    getActiveId, getProject, getProjects, setActive,
    __version: '1.5.0',
    __ls_key: LS_KEY
  };
  if (typeof window !== 'undefined') window.SonorProjectBar = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
