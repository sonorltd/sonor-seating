/*!
 * sonor-block-glow.js — BLOCK GLOW + INFO CARD (root master, synced to every app's data/) — v1.0.1 · 2026-10-12
 * ----------------------------------------------------------------------------------------------------------------
 * Bryn: "make the takeoffs icons glow and be ref'd to info … without it becoming a ball and chain to manage".
 *
 * ONE module for "a placed thing on a plan canvas glows in its service colour and tells you what it is":
 *   · hover  → soft halo in the block's own colour (+ a fainter halo on related blocks: pair master/slaves, same zone)
 *   · card   → a small card beside the block: what it is, where it is, the product it maps to, where it came from,
 *              and the notes / RFIs that sit on it. Click (select) pins the card so its links can be used.
 * Nothing here is stored: halos are painted on a separate overlay <canvas> (pointer-events:none, never saved, never
 * exported) and the card is built on demand from data the block ALREADY carries (+ the live Library row + plan notes).
 * So there is no second list to maintain — the "ball and chain" Bryn ruled out.
 *
 * API
 *   SonorBlockGlow.attachFabric(canvas, {
 *     resolve(obj)  -> info | null     // info = { colour, title, sub, rows:[[k,v,warn?]], chips:[{t,warn}], notes:[{id,text}], links:[{label,href|onClick}] }
 *     related(obj)  -> [obj]           // optional — fainter halos
 *     enabled()     -> bool            // optional — false while drawing tools are active
 *   })
 *   SonorBlockGlow.paintHalo(ctx, cx, cy, r, colour, {dpr, strength})   // pure painter (other canvases can reuse)
 *   SonorBlockGlow.cardHtml(info)                                        // pure HTML builder
 * Styling uses kit tokens (graphite first, slate fallback). The halo is a canvas effect for plan blocks — it is NOT
 * a control hover (sonor-platform §18 still governs buttons/rows; §32 governs this).
 */
(function (global) {
  'use strict';
  var VERSION = '1.0.1';

  function hexA(hex, a) {
    var h = String(hex || '#f5d05c').replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(h.slice(0, 6), 16); if (!isFinite(n)) n = 0xf5d05c;
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function paintHalo(ctx, cx, cy, r, colour, o) {
    o = o || {}; var dpr = o.dpr || 1, k = o.strength == null ? 1 : o.strength;
    ctx.save();
    var g = ctx.createRadialGradient(cx, cy, r * 0.35, cx, cy, r * 1.55);
    g.addColorStop(0, hexA(colour, 0.22 * k)); g.addColorStop(1, hexA(colour, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r * 1.55, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = hexA(colour, 0.95 * k); ctx.shadowBlur = 14 * dpr * k;
    ctx.strokeStyle = hexA(colour, 0.85 * k); ctx.lineWidth = 2 * dpr;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  function ensureStyles() {
    if (document.getElementById('sbg-styles')) return;
    var css = [
      '.sbg-card{position:absolute;z-index:7;max-width:300px;min-width:200px;pointer-events:none;box-sizing:border-box;',
      ' background:var(--card,var(--bg-1,#242426));color:var(--text-primary,#F5F5F7);border:1px solid var(--border,#3a3a3c);',
      ' border-left:3px solid var(--sbg-c,#f5d05c);border-radius:8px;padding:8px 10px;font:12px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;',
      ' box-shadow:0 8px 28px rgba(0,0,0,.35);transition:opacity var(--motion,120ms ease);}',
      '.sbg-card.pinned{pointer-events:auto;}',
      '.sbg-h{display:flex;align-items:center;gap:7px;font-weight:700;font-size:12.5px;}',
      '.sbg-dot{width:9px;height:9px;border-radius:50%;background:var(--sbg-c,#f5d05c);box-shadow:0 0 8px var(--sbg-c,#f5d05c);flex:none;}',
      '.sbg-sub{font-family:"DM Mono",ui-monospace,Menlo,monospace;font-size:10.5px;color:var(--text-muted,#98989D);margin:1px 0 5px 16px;}',
      '.sbg-rows{display:grid;grid-template-columns:auto 1fr;gap:2px 8px;}',
      '.sbg-k{color:var(--text-muted,#98989D);white-space:nowrap;}',
      '.sbg-v{color:var(--text-secondary,#C7C7CC);overflow-wrap:anywhere;}',
      '.sbg-warn{color:var(--status-amber,#E8A317)!important;}',
      '.sbg-chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px;}',
      '.sbg-chip{font-size:10px;font-weight:700;padding:1px 7px;border-radius:9px;border:1px solid var(--border,#3a3a3c);color:var(--text-secondary,#C7C7CC);}',
      '.sbg-chip.warn{border-color:var(--status-amber,#E8A317);color:var(--status-amber,#E8A317);}',
      '.sbg-notes{margin:6px 0 0;padding:5px 0 0;border-top:1px solid var(--border,#3a3a3c);list-style:none;}',
      '.sbg-notes li{margin:2px 0;color:var(--text-secondary,#C7C7CC);} .sbg-notes b{color:#8058a1;margin-right:4px;}',
      '.sbg-links{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px;}',
      '.sbg-links a,.sbg-links button{font-size:11px;font-weight:600;color:var(--text-primary,#F5F5F7);background:transparent;',
      ' border:1px solid var(--border,#3a3a3c);border-radius:5px;padding:2px 8px;cursor:pointer;text-decoration:none;}',
      '.sbg-hint{margin-top:6px;font-size:10px;color:var(--text-muted,#98989D);}'
    ].join('\n');
    var el = document.createElement('style'); el.id = 'sbg-styles'; el.textContent = css; document.head.appendChild(el);
  }

  function cardHtml(info) {
    if (!info) return '';
    var h = '<div class="sbg-h"><span class="sbg-dot"></span><span>' + esc(info.title || 'Block') + '</span></div>';
    if (info.sub) h += '<div class="sbg-sub">' + esc(info.sub) + '</div>';
    var rows = (info.rows || []).filter(function (r) { return r && r[1] != null && r[1] !== ''; });
    if (rows.length) h += '<div class="sbg-rows">' + rows.map(function (r) {
      return '<span class="sbg-k">' + esc(r[0]) + '</span><span class="sbg-v' + (r[2] ? ' sbg-warn' : '') + '">' + esc(r[1]) + '</span>';
    }).join('') + '</div>';
    if (info.chips && info.chips.length) h += '<div class="sbg-chips">' + info.chips.map(function (c) { return '<span class="sbg-chip' + (c.warn ? ' warn' : '') + '">' + esc(c.t) + '</span>'; }).join('') + '</div>';
    if (info.notes && info.notes.length) h += '<ul class="sbg-notes">' + info.notes.slice(0, 4).map(function (n) {
      return '<li>' + (n.id ? '<b>' + esc(n.id) + '</b>' : '') + esc(String(n.text || '').slice(0, 140)) + '</li>';
    }).join('') + '</ul>';
    if (info.links && info.links.length) h += '<div class="sbg-links">' + info.links.map(function (l, i) {
      return l.href ? '<a href="' + esc(l.href) + '" target="_blank" rel="noopener">' + esc(l.label) + '</a>' : '<button type="button" data-sbg-link="' + i + '">' + esc(l.label) + '</button>';
    }).join('') + '</div>';
    if (info.hint) h += '<div class="sbg-hint">' + esc(info.hint) + '</div>';
    return h;
  }

  function attachFabric(canvas, opts) {
    opts = opts || {};
    if (!canvas || !canvas.on || canvas.__sonorBlockGlow) return canvas && canvas.__sonorBlockGlow;
    ensureStyles();
    var hostEl = canvas.lowerCanvasEl && canvas.lowerCanvasEl.parentNode;
    var ov = document.createElement('canvas'); ov.className = 'sonor-block-glow-layer'; ov.setAttribute('aria-hidden', 'true');
    ov.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;z-index:5;';
    var card = document.createElement('div'); card.className = 'sbg-card'; card.style.display = 'none';
    if (hostEl) { hostEl.appendChild(ov); hostEl.appendChild(card); }
    var ctx = ov.getContext('2d'), hover = null, pinned = null, info = null, raf = 0;

    function enabled() { try { return opts.enabled ? !!opts.enabled() : true; } catch (e) { return true; } }
    function resolve(o) { try { return o ? opts.resolve(o) : null; } catch (e) { console.warn('[block-glow] resolve', e && e.message); return null; } }
    function related(o) { try { return (o && opts.related) ? (opts.related(o) || []) : []; } catch (e) { return []; } }
    function screenBox(o) {
      var r = o.getBoundingRect(false, true);   // viewport (screen) coords
      return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, r: Math.max(8, Math.max(r.width, r.height) / 2 + 5), box: r };
    }
    function paint() {
      var W = canvas.getWidth(), H = canvas.getHeight(), dpr = (canvas.getRetinaScaling && canvas.getRetinaScaling()) || global.devicePixelRatio || 1;
      if (ov.width !== Math.round(W * dpr) || ov.height !== Math.round(H * dpr)) { ov.width = Math.round(W * dpr); ov.height = Math.round(H * dpr); ov.style.width = W + 'px'; ov.style.height = H + 'px'; }
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ov.width, ov.height);
      var focus = pinned || hover; if (!focus || !info) return;
      if (canvas.getObjects().indexOf(focus) < 0) { clear(); return; }
      var t = (Date.now() % 1600) / 1600, breathe = 0.82 + 0.18 * Math.sin(t * Math.PI * 2);
      var rel = [];
      related(focus).forEach(function (o) { if (canvas.getObjects().indexOf(o) < 0) return; var rb = screenBox(o); rel.push(rb); paintHalo(ctx, rb.cx * dpr, rb.cy * dpr, rb.r * dpr, info.colour, { dpr: dpr, strength: 0.5 }); });
      var b = screenBox(focus); paintHalo(ctx, b.cx * dpr, b.cy * dpr, b.r * dpr, info.colour, { dpr: dpr, strength: breathe });
      place(b, rel);
    }
    function place(b, rel) {
      if (card.style.display === 'none') return;
      var W = canvas.getWidth(), H = canvas.getHeight(), cw = card.offsetWidth || 240, ch = card.offsetHeight || 120, g = 14;
      try {   // v1.0.1 — clamp to the VISIBLE part of the canvas (the canvas can be taller/wider than the window or its scroller)
        var hr = hostEl.getBoundingClientRect(), vw = global.innerWidth || W, vh = global.innerHeight || H;
        W = Math.min(W, vw - hr.left); H = Math.min(H, vh - hr.top - 34);   // 34 = fixed status bar
      } catch (e) { }
      var cands = [[b.box.left + b.box.width + g, b.cy - ch / 2], [b.box.left - cw - g, b.cy - ch / 2], [b.cx - cw / 2, b.box.top + b.box.height + g], [b.cx - cw / 2, b.box.top - ch - g]];
      var best = null, bestScore = 1e9;
      cands.forEach(function (c, i) {
        var x = Math.max(6, Math.min(W - cw - 6, c[0])), y = Math.max(6, Math.min(H - ch - 6, c[1]));
        var cover = (rel || []).concat([b]).filter(function (r) { return r.cx > x - r.r && r.cx < x + cw + r.r && r.cy > y - r.r && r.cy < y + ch + r.r; }).length;
        var score = cover * 100 + i;   // fewest blocks hidden, then right > left > below > above
        if (score < bestScore) { bestScore = score; best = [x, y]; }
      });
      card.style.left = Math.round(best[0]) + 'px'; card.style.top = Math.round(best[1]) + 'px';
    }
    function loop() { cancelAnimationFrame(raf); if (!(hover || pinned)) return; paint(); raf = requestAnimationFrame(loop); }
    function show(o, pin) {
      info = resolve(o); if (!info) { clear(); return; }
      card.style.setProperty('--sbg-c', info.colour || '#f5d05c');
      card.innerHTML = cardHtml(info); card.classList.toggle('pinned', !!pin); card.style.display = '';
      Array.prototype.forEach.call(card.querySelectorAll('[data-sbg-link]'), function (btn) {
        var l = info.links[+btn.getAttribute('data-sbg-link')];
        btn.addEventListener('click', function (ev) { ev.stopPropagation(); try { l.onClick && l.onClick(o); } catch (e) { console.warn('[block-glow] link', e && e.message); } });
      });
      loop();
    }
    function clear() { hover = null; pinned = null; info = null; card.style.display = 'none'; cancelAnimationFrame(raf); paint(); }

    canvas.on('mouse:over', function (e) {
      if (pinned || !enabled()) return; var o = e && e.target; if (!o || !resolve(o)) return;
      hover = o; show(o, false);
    });
    canvas.on('mouse:out', function (e) { if (pinned) return; if (e && e.target === hover) { hover = null; info = null; card.style.display = 'none'; paint(); } });
    function onSel() {
      var a = canvas.getActiveObject && canvas.getActiveObject();
      if (a && a.type !== 'activeSelection' && enabled() && resolve(a)) { pinned = a; hover = null; show(a, true); }
      else if (pinned) { clear(); }
    }
    canvas.on('selection:created', onSel); canvas.on('selection:updated', onSel); canvas.on('selection:cleared', function () { if (pinned) clear(); });
    canvas.on('object:moving', function () { if (pinned || hover) paint(); });
    canvas.on('after:render', function () { if (!(hover || pinned)) { if (ov.width) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ov.width, ov.height); } } });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && (pinned || hover)) clear(); });
    var api = { clear: clear, refresh: function () { var o = pinned || hover; if (o) show(o, !!pinned); }, VERSION: VERSION };
    canvas.__sonorBlockGlow = api; return api;
  }

  global.SonorBlockGlow = { VERSION: VERSION, attachFabric: attachFabric, paintHalo: paintHalo, cardHtml: cardHtml, ensureStyles: ensureStyles, hexA: hexA };
})(typeof window !== 'undefined' ? window : this);
