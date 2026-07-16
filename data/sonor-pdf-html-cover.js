// =============================================================================
// sonor-pdf-html-cover.js — orchestrator for HTML PDF cover rendering
// =============================================================================
//
// Workspace-shared module (Spine S-4.2). Master at workspace root.
// One responsibility: thin orchestrator that glues the modular pieces
// together. Loads the canonical CSS once, calls the template builder,
// renders into a hidden iframe via html2canvas, returns dataURL ready for
// jsPDF.addImage().
//
// Module stack:
//   sonor-pdf-html-cover.css          ← brand styles (canonical, edit here)
//   sonor-pdf-html-helpers.js         ← esc, statusColour, statusInkOn
//   sonor-pdf-html-components.js      ← serviceStrip, statusPill, etc
//   sonor-pdf-html-templates.js       ← buildCover, buildSectionDivider
//   sonor-pdf-html-cover.js  ← THIS  ← renderCover, renderSectionDivider
//
// Load order on host page (or in iframe):
//   1. helpers.js
//   2. components.js
//   3. templates.js
//   4. cover.js (this file)
//   PLUS html2canvas CDN
//
// Public API (window.SonorPdfHtmlCover):
//   renderCover(opts)            → Promise<{dataUrl, w, h}>
//   renderSectionDivider(opts)   → Promise<{dataUrl, w, h}>
//   available()                  → boolean (every dep loaded?)
//   setStylesheetUrl(url)        → override CSS source (default: relative
//                                  './sonor-pdf-html-cover.css')
//
// Diagnostic:
//   window.__SONOR_HTMLCOVER_LAST_ERROR__  — last thrown error
//   window.__SONOR_HTMLCOVER_LAST_PATH__   — 'rendered' / 'cached-css' / etc

(function () {
  'use strict';

  const MODULE_VERSION = '1.7.1';

  // ---- CSS cache ---------------------------------------------------------

  let _cssCache = null;
  let _cssUrl = null;  // resolved lazily when first render runs

  function _resolveDefaultCssUrl() {
    // Try to find this script's <script> tag and resolve the sibling CSS
    // file relative to it. Falls back to './sonor-pdf-html-cover.css'.
    // v1.5.0 — preserve any ?v=X.Y.Z cache-bust query string from the .js src
    // so the CSS gets the same cache-busting (otherwise stale CSS would still
    // be served while new HTML modules render with old styles — this exact
    // mismatch caused the v5.4.41 "reverted to old style" Ty Hwnnw export).
    if (typeof document === 'undefined') return './sonor-pdf-html-cover.css';
    try {
      const scripts = document.getElementsByTagName('script');
      for (let i = 0; i < scripts.length; i++) {
        const src = scripts[i].src || '';
        const m = src.match(/sonor-pdf-html-cover\.js(\?[^#]*)?/);
        if (m) {
          // m[1] holds the original query string (e.g. "?v=5.4.42") or undefined.
          const qs = m[1] || '';
          return src.replace(/sonor-pdf-html-cover\.js(\?[^#]*)?/, 'sonor-pdf-html-cover.css' + qs);
        }
      }
    } catch (_) {}
    return './sonor-pdf-html-cover.css';
  }

  async function _loadCss() {
    if (_cssCache != null) return _cssCache;
    const url = _cssUrl || _resolveDefaultCssUrl();
    try {
      const r = await fetch(url, { credentials: 'same-origin' });
      if (!r.ok) throw new Error('CSS fetch ' + r.status);
      _cssCache = await r.text();
      return _cssCache;
    } catch (e) {
      console.warn('[SonorPdfHtmlCover] CSS load failed (' + url + ') — falling back to inline minimal styles:', e);
      // Minimal fallback so the page still renders something readable.
      _cssCache = `
        body { font-family: -apple-system, sans-serif; margin: 0; padding: 0; width: 1190px; height: 842px; }
        .hero { padding: 40px; background: #1a1f28; color: #fff; }
        .hero-title { font-size: 48px; font-weight: 800; margin: 20px 0; }
        .body { padding: 40px; }
      `;
      return _cssCache;
    }
  }

  // ---- Gilroy embed (v5.18.0) --------------------------------------------
  // The canonical CSS declares @font-face for Gilroy with ONLY local()
  // sources, so the brand font never loaded inside the render iframe — every
  // page rendered in the -apple-system fallback. Beyond being off-brand, the
  // fallback's whitespace metrics make html2canvas 1.4.1 DROP word spaces in
  // the footer title-block + at-a-glance cells (e.g. "BungalowTrial",
  // "QUANTITIESTBC"). Fetching the real Gilroy TTFs once and injecting them as
  // base64 @font-face gives html2canvas correct metrics → spaces preserved AND
  // the brand font actually renders. Fetch fails silently on file:// (the TTF
  // can't be read) → graceful fall-back to today's behaviour, no regression.

  let _gilroyFaceCache; // undefined = not tried, '' = unavailable, string = css

  function _resolveFontUrl(slug) {
    if (typeof document === 'undefined') return 'fonts/Gilroy-' + slug + '.ttf';
    try {
      const scripts = document.getElementsByTagName('script');
      for (let i = 0; i < scripts.length; i++) {
        const src = scripts[i].src || '';
        if (src.indexOf('sonor-pdf-html-cover.js') !== -1) {
          return src.replace(/sonor-pdf-html-cover\.js(\?[^#]*)?/, 'fonts/Gilroy-' + slug + '.ttf');
        }
      }
    } catch (_) {}
    return 'fonts/Gilroy-' + slug + '.ttf';
  }

  function _bufToB64(buf) {
    let bin = '';
    const bytes = new Uint8Array(buf);
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return (typeof btoa === 'function') ? btoa(bin) : '';
  }

  async function _gilroyFaceCss() {
    if (_gilroyFaceCache !== undefined) return _gilroyFaceCache;
    // file:// can't fetch local binaries in most browsers — skip cleanly.
    if (typeof window !== 'undefined' && window.location && window.location.protocol === 'file:') {
      _gilroyFaceCache = '';
      return _gilroyFaceCache;
    }
    const weights = [['Regular', 400], ['Medium', 600], ['Bold', 800]];
    const faces = [];
    for (let i = 0; i < weights.length; i++) {
      const slug = weights[i][0], wt = weights[i][1];
      try {
        const r = await fetch(_resolveFontUrl(slug), { credentials: 'same-origin' });
        if (!r.ok) continue;
        const b64 = _bufToB64(await r.arrayBuffer());
        if (!b64) continue;
        faces.push("@font-face{font-family:'Gilroy';font-weight:" + wt +
          ";font-style:normal;font-display:block;src:url(data:font/ttf;base64," +
          b64 + ") format('truetype');}");
      } catch (_) {}
    }
    _gilroyFaceCache = faces.length ? faces.join('\n') : '';
    return _gilroyFaceCache;
  }

  // ---- iframe pipeline ---------------------------------------------------

  async function _renderHtmlToImage(html, opts) {
    opts = opts || {};
    const targetW = opts.width || 1190;
    const targetH = opts.height || 842;
    const scale = opts.scale || 2;
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      throw new Error('SonorPdfHtmlCover: requires browser environment');
    }
    if (typeof html2canvas !== 'function') {
      throw new Error('SonorPdfHtmlCover: html2canvas not loaded — add CDN script');
    }
    const iframe = document.createElement('iframe');
    iframe.style.cssText = `
      position: fixed; left: -10000px; top: 0;
      width: ${targetW}px; height: ${targetH}px;
      border: 0; visibility: hidden;
    `;
    document.body.appendChild(iframe);
    try {
      const doc = iframe.contentDocument;
      doc.open();
      doc.write(html);
      doc.close();
      // v5.18.0 — inject the base64 Gilroy @font-face so the brand font
      // actually loads in the iframe (the canonical CSS only ships local()
      // sources). Done before the fonts.ready wait below so html2canvas
      // renders with correct Gilroy metrics → no dropped word spaces.
      try {
        const faceCss = await _gilroyFaceCss();
        if (faceCss) {
          const st = doc.createElement('style');
          st.setAttribute('data-sonor-gilroy', '1');
          st.textContent = faceCss;
          (doc.head || doc.documentElement).appendChild(st);
        }
      } catch (_) {}
      // Allow layout + font load.
      await new Promise(r => setTimeout(r, 80));
      // v1.7.1 (2026-05-09) — race fonts.ready with a 3 s timeout. Some
      // network conditions cause the iframe's font fetches to stall, and
      // doc.fonts.ready never resolves — hanging the entire renderCover /
      // renderSchedule / renderPlanPage pipeline. The race lets the render
      // proceed with whatever fonts ARE loaded after 3 s. Verified against
      // Cinema Design v4.10.4 PDF export hang at cover.
      if (doc.fonts && doc.fonts.ready) {
        try {
          await Promise.race([
            doc.fonts.ready,
            new Promise(r => setTimeout(r, 3000))
          ]);
        } catch (_) {}
      }
      await new Promise(r => requestAnimationFrame(r));
      // v1.7.1 — also race html2canvas with a 30 s timeout. If html2canvas
      // itself stalls (e.g. cross-origin image that 404s and never errors),
      // the export pipeline shouldn't block forever. 30 s is generous —
      // typical canvas of an A3 page renders in ~1.2 s.
      const canvas = await Promise.race([
        html2canvas(doc.body, {
          width: targetW, height: targetH,
          scale, useCORS: true,
          backgroundColor: '#ffffff',
          logging: false
        }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('html2canvas 30 s timeout')), 30000))
      ]);
      return { dataUrl: canvas.toDataURL('image/jpeg', 0.92), w: canvas.width, h: canvas.height };
    } finally {
      try { document.body.removeChild(iframe); } catch (_) {}
    }
  }

  // ---- Public API --------------------------------------------------------

  function setStylesheetUrl(url) { _cssUrl = url; _cssCache = null; }

  function available() {
    return (typeof window !== 'undefined') &&
           typeof html2canvas === 'function' &&
           !!window.SonorPdfHtmlHelpers &&
           !!window.SonorPdfHtmlComponents &&
           !!window.SonorPdfHtmlTemplates;
  }

  async function renderCover(opts) {
    try {
      const css = await _loadCss();
      const html = window.SonorPdfHtmlTemplates.buildCover(opts || {}, css);
      const result = await _renderHtmlToImage(html, { width: 1190, height: 842, scale: 3 });
      try { window.__SONOR_HTMLCOVER_LAST_PATH__ = 'rendered-cover'; } catch (_) {}
      return result;
    } catch (e) {
      try { window.__SONOR_HTMLCOVER_LAST_ERROR__ = e; } catch (_) {}
      throw e;
    }
  }

  // v5.147.0 — html2canvas page scale from the export-quality preset
  // (Quality selector). High (4) when absent.
  function _pageScale(fallback) {
    try {
      if (typeof window !== 'undefined' && typeof window._sonorPdfQuality === 'function') {
        const q = window._sonorPdfQuality();
        if (q && q.htmlScale > 0) return q.htmlScale;
      }
    } catch (_) {}
    return fallback || 4;
  }

  async function renderSectionDivider(opts) {
    try {
      const css = await _loadCss();
      const html = window.SonorPdfHtmlTemplates.buildSectionDivider(opts || {}, css);
      const result = await _renderHtmlToImage(html, { width: 1190, height: 842, scale: 3 });
      try { window.__SONOR_HTMLCOVER_LAST_PATH__ = 'rendered-divider'; } catch (_) {}
      return result;
    } catch (e) {
      try { window.__SONOR_HTMLCOVER_LAST_ERROR__ = e; } catch (_) {}
      throw e;
    }
  }

  // ---- renderSchedule ----------------------------------------------------
  // Schedules render at A3 landscape (1190×842 in jsPDF points) — matches the
  // host's existing schedule format. Caller passes the same opts shape that
  // SonorPdfHtmlTemplates.buildSchedule expects.
  async function renderSchedule(opts) {
    try {
      const css = await _loadCss();
      const html = window.SonorPdfHtmlTemplates.buildSchedule(opts || {}, css);
      // v5.147.0 — quality preset (min 3 so table text stays crisp on Draft).
      const result = await _renderHtmlToImage(html, { width: 1190, height: 842, scale: Math.max(3, _pageScale(4)) });
      try { window.__SONOR_HTMLCOVER_LAST_PATH__ = 'rendered-schedule'; } catch (_) {}
      return result;
    } catch (e) {
      try { window.__SONOR_HTMLCOVER_LAST_ERROR__ = e; } catch (_) {}
      throw e;
    }
  }

  // ---- renderPlanPage ----------------------------------------------------
  // Plan pages render at A3 landscape (1190×842) with the floor canvas
  // bitmap embedded inside the HTML chrome. Caller pre-snapshots the
  // Fabric canvas → dataURL → passes as opts.canvasDataUrl. Sidebar
  // panels (drawing key / legend / floor totals / notes) all render
  // as HTML/CSS for full consistency with the cover + schedule pipeline.
  async function renderPlanPage(opts) {
    try {
      const css = await _loadCss();
      const html = window.SonorPdfHtmlTemplates.buildPlanPage(opts || {}, css);
      // v5.147.0 — quality preset (v5.146.0 default High = 4; the canvas
      // snapshot follows the same preset in _snapshotCanvas).
      const result = await _renderHtmlToImage(html, { width: 1190, height: 842, scale: _pageScale(4) });
      try { window.__SONOR_HTMLCOVER_LAST_PATH__ = 'rendered-plan'; } catch (_) {}
      return result;
    } catch (e) {
      try { window.__SONOR_HTMLCOVER_LAST_ERROR__ = e; } catch (_) {}
      throw e;
    }
  }

  // v5.146.0 — CONTENTS page through the SAME pipeline as every other page
  // (Bryn: "fix this once and for all"). Rows arrive pre-laid-out from the
  // orchestrator (CONTENTS_METRICS geometry — shared with the pdf.link
  // overlay pass).
  async function renderContents(opts) {
    try {
      const css = await _loadCss();
      const html = window.SonorPdfHtmlTemplates.buildContents(opts || {}, css);
      const result = await _renderHtmlToImage(html, { width: 1190, height: 842, scale: Math.max(3, _pageScale(4)) });   // v5.147.0 — preset (min 3, text page)
      try { window.__SONOR_HTMLCOVER_LAST_PATH__ = 'rendered-contents'; } catch (_) {}
      return result;
    } catch (e) {
      try { window.__SONOR_HTMLCOVER_LAST_ERROR__ = e; } catch (_) {}
      throw e;
    }
  }

  async function renderCablingInfo(opts) {
    try {
      const css = await _loadCss();
      const html = window.SonorPdfHtmlTemplates.buildCablingInfoPage(opts || {}, css);
      const result = await _renderHtmlToImage(html, { width: 1190, height: 842, scale: 3 });
      try { window.__SONOR_HTMLCOVER_LAST_PATH__ = 'rendered-cabling'; } catch (_) {}
      return result;
    } catch (e) {
      try { window.__SONOR_HTMLCOVER_LAST_ERROR__ = e; } catch (_) {}
      throw e;
    }
  }

  // v5.111.0 — Electrical Requirements page (Bryn: "build the electrical
  // requirements page before bulk cable and design this nicely with specs
  // and info"). Same A3 chrome pipeline as every other page.
  async function renderElectricalRequirements(opts) {
    try {
      const css = await _loadCss();
      const html = window.SonorPdfHtmlTemplates.buildElectricalRequirementsPage(opts || {}, css);
      const result = await _renderHtmlToImage(html, { width: 1190, height: 842, scale: 3 });
      try { window.__SONOR_HTMLCOVER_LAST_PATH__ = 'rendered-elecreq'; } catch (_) {}
      return result;
    } catch (e) {
      try { window.__SONOR_HTMLCOVER_LAST_ERROR__ = e; } catch (_) {}
      throw e;
    }
  }

  // v1.7.4 — Image page (snapshot with full Takeoffs-style chrome).
  // Used by Cinema Design's Plan + 4 elevations + Sightlines pages so they
  // get the same header / footer / section label / revisions strip as
  // every other page in the deck. Caller passes opts.imageDataUrl
  // (e.g. SonorCT.captureViewAsJpeg('plan')) and the chrome wraps it.
  async function renderImagePage(opts) {
    try {
      const css = await _loadCss();
      const html = window.SonorPdfHtmlTemplates.buildImagePage(opts || {}, css);
      const result = await _renderHtmlToImage(html, { width: 1190, height: 842, scale: 3 });
      try { window.__SONOR_HTMLCOVER_LAST_PATH__ = 'rendered-image-page'; } catch (_) {}
      return result;
    } catch (e) {
      try { window.__SONOR_HTMLCOVER_LAST_ERROR__ = e; } catch (_) {}
      throw e;
    }
  }

  async function renderBendRadius(opts) {
    try {
      const css = await _loadCss();
      const html = window.SonorPdfHtmlTemplates.buildBendRadiusPage(opts || {}, css);
      const result = await _renderHtmlToImage(html, { width: 1190, height: 842, scale: 3 });
      try { window.__SONOR_HTMLCOVER_LAST_PATH__ = 'rendered-bend'; } catch (_) {}
      return result;
    } catch (e) {
      try { window.__SONOR_HTMLCOVER_LAST_ERROR__ = e; } catch (_) {}
      throw e;
    }
  }

  // ---- renderOverallCounts -----------------------------------------------
  // v1.7.0 (2026-05-09) — single scoreboard page emitted between Combined
  // Plans and per-service slice plans. Engineer's "what's in this project?"
  // overview at a glance. Caller passes grand totals + per-service rollup.
  async function renderOverallCounts(opts) {
    try {
      const css = await _loadCss();
      const html = window.SonorPdfHtmlTemplates.buildOverallCountsPage(opts || {}, css);
      const result = await _renderHtmlToImage(html, { width: 1190, height: 842, scale: 3 });
      try { window.__SONOR_HTMLCOVER_LAST_PATH__ = 'rendered-counts'; } catch (_) {}
      return result;
    } catch (e) {
      try { window.__SONOR_HTMLCOVER_LAST_ERROR__ = e; } catch (_) {}
      throw e;
    }
  }

  if (typeof window !== 'undefined') {
    window.SonorPdfHtmlCover = {
      __version: MODULE_VERSION,
      renderCover, renderSectionDivider, renderSchedule, renderPlanPage,
      renderCablingInfo, renderBendRadius, renderOverallCounts,
      renderContents,   // v5.146.0
      renderElectricalRequirements,
      renderImagePage,
      available, setStylesheetUrl
    };
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { renderCover, renderSectionDivider, renderSchedule, renderPlanPage, renderContents, renderCablingInfo, renderBendRadius, renderOverallCounts, renderElectricalRequirements, renderImagePage, available, setStylesheetUrl };
  }
})();
