/**
 * sonor-board-log.js — CANONICAL MASTER (sonor-platform §22 — the client-interaction contract)
 * v1.0.1 · 2026-10-01 — touchedAt ignores WeQuote sync writes (metadata.wequote_synced_at + wequote_touched_before)
 * v1.0.0 · 2026-09-30
 *
 * ONE place every Sonor app reads and writes "where is this project with the client":
 *   projects.metadata.board = {
 *     star, priority (1|2|3), rank,                  — Board ordering (v1.3)
 *     next, by, set_at,                              — next action + chase date (v1.1)
 *     enquiry_on,                                    — enquiry date override (v1.6)
 *     contact_on, contact_kind, contact_note,        — LAST client interaction (v1.6)
 *     contacts: [{ on, kind, note, source }],        — history, last 12
 *     saved_at, touched_before                       — so Board writes don't count as a human "touch"
 *   (projects.metadata.wequote_synced_at + wequote_touched_before do the same for WeQuote sync writes — v1.0.1)
 *   }
 * Written ONLY through sonor_merge_project_metadata (merge-only law) via SonorBoardLog.* — never a
 * metadata rewrite, never a per-app copy of these rules. Sources that know a client was contacted
 * (Leads enquiry follow-ups, Follow-Up Portal emails / cold calls, Tasks site logs, WeQuote sends,
 * the Board itself) all call logContact(); the Board only ever DISPLAYS.
 *
 * Classic script (no export). Needs a supabase-js client (SonorDB().client or window.supabase.createClient).
 * Load AFTER sonor-db.js. Synced to every app's data/ by sync-everything.sh — edit the root master only.
 *
 * API
 *   SonorBoardLog.CONTACT_KINDS                        { call:'📞', email:'✉️', whatsapp:'💬', site:'🏠', meeting:'🤝' }
 *   SonorBoardLog.boardOf(project)                     → board object or {}
 *   SonorBoardLog.contactOf(project, quotes?)          → { on:'YYYY-MM-DD', kind, note, src:'logged'|'quote' } | null
 *   SonorBoardLog.enquiryOf(project, enquiries?)       → { on, src }
 *   SonorBoardLog.touchedAt(project)                   → ISO of the last HUMAN touch (ignores Board writes)
 *   await SonorBoardLog.save(client, projectId, patch, project?)          — generic board patch (keeps the rest)
 *   await SonorBoardLog.logContact(client, projectId, { kind, on?, note?, source }, project?)
 *   await SonorBoardLog.setEnquiryDate(client, projectId, iso|null, project?)
 *   await SonorBoardLog.findProjectId(client, { id?, ref?, wqNo?, email?, phone? })   → uuid | null
 */
(function (global) {
  'use strict';
  var VERSION = '1.0.1';
  var CONTACT_KINDS = { call: '📞', email: '✉️', whatsapp: '💬', site: '🏠', meeting: '🤝' };
  var DONE = ['accepted', 'won', 'approved', 'complete', 'declined', 'lost', 'expired', 'cancelled'];   // WeQuote stage vocabulary + older mirror names

  function isoDay(v) { if (!v) return null; var d = new Date(v); return isNaN(d) ? null : d.toISOString().slice(0, 10); }
  function boardOf(p) { return (p && p.metadata && p.metadata.board && typeof p.metadata.board === 'object') ? p.metadata.board : {}; }

  function lastSent(quotes) {
    var best = null;
    (quotes || []).forEach(function (q) {
      if (String(q.stage || '').toLowerCase() !== 'sent') return;
      var d = isoDay(q.since || q.quote_date || q.sent_at);
      if (d && (!best || d > best.on)) best = { on: d, no: q.quote_no };
    });
    return best;
  }
  function contactOf(p, quotes) {
    var b = boardOf(p);
    var c = b.contact_on ? { on: isoDay(b.contact_on), kind: b.contact_kind || 'call', note: b.contact_note || '', src: 'logged' } : null;
    var sn = lastSent(quotes);
    var q = sn ? { on: sn.on, kind: 'quote', note: '#' + sn.no + ' sent', src: 'quote' } : null;
    if (c && q) return c.on >= q.on ? c : q;
    return c || q;
  }
  function enquiryOf(p, enquiries) {
    var b = boardOf(p), m = (p && p.metadata) || {};
    if (b.enquiry_on) return { on: isoDay(b.enquiry_on), src: 'set on the Board' };
    if (m.enquiry_date) return { on: isoDay(m.enquiry_date), src: 'project enquiry_date' };
    var e = (enquiries || []).find(function (e) { var em = e.metadata || {}; return em.project_id === p.id || em.projectId === p.id || (p.ref && (em.project_ref === p.ref || em.projectRef === p.ref)); });
    if (e && e.enquiry_date) return { on: isoDay(e.enquiry_date), src: 'enquiries log' + (e.channel ? ' · ' + e.channel : '') };
    if (m.first_seen) return { on: isoDay(m.first_seen), src: 'first seen' };
    return { on: isoDay(p.created_at), src: 'project created' };
  }
  function touchedAt(p) {
    var b = boardOf(p), m = (p && p.metadata) || {};
    if (b.saved_at && b.touched_before && Math.abs(new Date(p.updated_at) - new Date(b.saved_at)) < 15000) return b.touched_before;
    // v1.0.1 — a WeQuote sync (sonor-wq-sync.js v1.1.0) is not a human touch either: it stamps wequote_touched_before
    if (m.wequote_synced_at && m.wequote_touched_before && Math.abs(new Date(p.updated_at) - new Date(m.wequote_synced_at)) < 120000) return m.wequote_touched_before;
    return p.updated_at;
  }

  async function fetchProject(client, id) {
    var r = await client.from('projects').select('id,ref,metadata,updated_at').eq('id', id).maybeSingle();
    if (r.error) throw r.error; return r.data;
  }
  // generic patch: keeps everything else in board, drops null/false keys, stamps saved_at/touched_before
  async function save(client, projectId, patch, project) {
    var p = project && project.id === projectId ? project : await fetchProject(client, projectId);
    if (!p) throw new Error('project not found: ' + projectId);
    var cur = boardOf(p); var nowIso = new Date().toISOString();
    var keepBefore = cur.saved_at && cur.touched_before && Math.abs(new Date(p.updated_at) - new Date(cur.saved_at)) < 15000;
    var next = Object.assign({}, cur, patch, { saved_at: nowIso, touched_before: keepBefore ? cur.touched_before : (p.updated_at || nowIso) });
    Object.keys(next).forEach(function (k) { if (next[k] == null || next[k] === false) delete next[k]; });
    var r = await client.rpc('sonor_merge_project_metadata', { p_project_id: projectId, p_patch: { board: next } });
    if (r.error) throw r.error;
    if (project && project.id === projectId) { project.metadata = Object.assign({}, project.metadata || {}, { board: next }); project.updated_at = nowIso; }
    return next;
  }
  // the one call every app makes when a client was spoken to / written to / visited
  async function logContact(client, projectId, opts, project) {
    opts = opts || {};
    var kind = CONTACT_KINDS[opts.kind] ? opts.kind : 'call';
    var on = isoDay(opts.on) || new Date().toISOString().slice(0, 10);
    var note = opts.note ? String(opts.note).slice(0, 160) : null;
    var p = project && project.id === projectId ? project : await fetchProject(client, projectId);
    if (!p) throw new Error('project not found: ' + projectId);
    var cur = boardOf(p); var hist = Array.isArray(cur.contacts) ? cur.contacts : [];
    var entry = { on: on, kind: kind, note: note, source: opts.source || null };
    // de-dupe: same day + kind + source → don't stack (Follow-Up Portal can fire twice)
    if (hist.some(function (h) { return h.on === on && h.kind === kind && (h.source || null) === (opts.source || null) && (h.note || null) === note; })) return cur;
    var contacts = hist.concat([entry]).slice(-12);
    var patch = { contacts: contacts };
    if (!cur.contact_on || on >= isoDay(cur.contact_on)) { patch.contact_on = on; patch.contact_kind = kind; patch.contact_note = note; }
    return save(client, projectId, patch, p);
  }
  async function setEnquiryDate(client, projectId, iso, project) {
    return save(client, projectId, { enquiry_on: iso ? isoDay(iso) : null }, project);
  }
  // resolve a project from whatever the caller has: id · ref · WeQuote number · client email · phone
  async function findProjectId(client, k) {
    k = k || {};
    if (k.id) return k.id;
    var q = client.from('projects').select('id,ref,client_email,client_phone');
    var r;
    if (k.ref) { r = await q.eq('ref', k.ref).maybeSingle(); if (r.data) return r.data.id; }
    if (k.wqNo) { r = await client.from('projects').select('id,ref').ilike('ref', String(k.wqNo) + ' - %').limit(1); if (r.data && r.data[0]) return r.data[0].id; }
    if (k.email) { r = await client.from('projects').select('id').ilike('client_email', String(k.email).trim()).order('updated_at', { ascending: false }).limit(1); if (r.data && r.data[0]) return r.data[0].id; }
    if (k.phone) { var digits = String(k.phone).replace(/\D/g, '').slice(-9); if (digits.length >= 9) { r = await client.from('projects').select('id,client_phone').not('client_phone', 'is', null).limit(500); var hit = (r.data || []).find(function (p) { return String(p.client_phone || '').replace(/\D/g, '').slice(-9) === digits; }); if (hit) return hit.id; } }
    return null;
  }

  global.SonorBoardLog = { VERSION: VERSION, CONTACT_KINDS: CONTACT_KINDS, boardOf: boardOf, contactOf: contactOf, enquiryOf: enquiryOf, touchedAt: touchedAt, lastSent: lastSent, isoDay: isoDay, save: save, logContact: logContact, setEnquiryDate: setEnquiryDate, findProjectId: findProjectId };
})(typeof window !== 'undefined' ? window : this);
