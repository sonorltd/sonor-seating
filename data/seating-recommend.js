/* Sonor Seating Configurator — recommendation + constraint engine (v0.2.0)
   SonorRecommend.rank(layout) → ranked ranges with fit score + human-readable flags.
   Pure logic over SonorSeating capability data. Kept separate from UI (modular).
*/
(function (global) {
  'use strict';
  var CFG = global.__SEATING_CONFIG__ || {};
  var CL = CFG.clearance || { sideWallMm: 150, seatFallbackWidthMm: 650, rowGapMm: 600 };

  // layout = { widthMm, lengthMm, rows, seatsPerRow, prefs:{reclining,daybed,sofa} }
  function rank(layout) {
    var E = global.SonorSeating;
    var prefs = layout.prefs || {};
    var usableWidth = layout.widthMm - 2 * CL.sideWallMm;

    var scored = E.seatingRanges().map(function (r) {
      var seatW = E.seatWidthMm(r);
      var rowWidth = layout.seatsPerRow * seatW;
      var fitsWidth = rowWidth <= usableWidth;
      var flags = [], plus = [], score = 0;

      // width fit — the dominant factor
      if (fitsWidth) { score += 40; }
      else {
        var maxAcross = Math.floor(usableWidth / seatW);
        flags.push({ kind: 'warn', text: layout.seatsPerRow + ' across won’t fit this room — max ~' + Math.max(1, maxAcross) + ' of this seat (≈' + Math.round(seatW) + 'mm) per row' });
      }

      // depth fit (§7.4) — room length must hold the rows + gaps + reclined depth
      var seatD = E.seatDepthMm(r);
      var wallClear = ((r.capability || {}).wall_clearance_mm) || 400;   // walkway front + rear
      var requiredDepth = layout.rows * seatD + (layout.rows - 1) * (CL.rowGapMm || 600) + wallClear;
      var fitsDepth = requiredDepth <= layout.lengthMm;
      if (fitsDepth) { score += 12; }
      else {
        var maxRows = Math.max(1, Math.floor((layout.lengthMm - wallClear + (CL.rowGapMm || 600)) / (seatD + (CL.rowGapMm || 600))));
        flags.push({ kind: 'warn', text: layout.rows + ' rows won’t fit the ' + (layout.lengthMm / 1000).toFixed(1) + 'm length (needs ≈' + (requiredDepth / 1000).toFixed(1) + 'm) — max ~' + maxRows + ' row' + (maxRows !== 1 ? 's' : '') + ' of this seat' });
      }

      // preference matches / constraints
      if (prefs.reclining) {
        if (E.feature(r, 'reclining')) { score += 12; plus.push('Powered recline'); }
        else flags.push({ kind: 'warn', text: 'Not a reclining range' });
      }
      if (prefs.daybed) {
        if (E.feature(r, 'daybed') || E.feature(r, 'chaise')) { score += 14; plus.push('Daybed / chaise option'); }
        else flags.push({ kind: 'info', text: 'No daybed option in this range' });
      }
      if (prefs.sofa) {
        if (E.feature(r, 'sofa') || E.feature(r, 'loveseat')) { score += 10; plus.push('Sofa / loveseat option'); }
        else flags.push({ kind: 'info', text: 'No sofa / loveseat in this range' });
      }

      // seat-count capability (Cineca ranges carry min/max)
      var cap = r.capability || {};
      if (cap.max_seats && layout.seatsPerRow > cap.max_seats) flags.push({ kind: 'warn', text: 'Max ' + cap.max_seats + ' seats per row in this range' });

      // pricing / data completeness
      if (E.priced(r)) { score += 10; } else { flags.push({ kind: 'info', text: 'MSRP on request' }); }
      if ((r.materials || []).length) { score += 6; plus.push((r.materials || []).length + ' upholstery options'); }
      if ((r.metadata || {}).needs_review) score -= 2;

      // gentle brand nudge: fully-modelled ranges first
      if ((r.metadata || {}).is_cineca) score += 4;

      return { range: r, score: score, fitsWidth: fitsWidth, fitsDepth: fitsDepth, fits: fitsWidth && fitsDepth, flags: flags, plus: plus, rowWidthMm: rowWidth, seatWidthMm: seatW };
    });

    scored.sort(function (a, b) {
      if (a.fits !== b.fits) return a.fits ? -1 : 1;   // ranges that fit width AND depth first
      if (b.score !== a.score) return b.score - a.score;
      var pa = E.fromPrice(a.range), pb = E.fromPrice(b.range);
      if (pa != null && pb != null) return pa - pb;                    // cheaper first
      return (a.range.sort_order || 0) - (b.range.sort_order || 0);
    });
    return scored;
  }

  global.SonorRecommend = { rank: rank };
})(typeof window !== 'undefined' ? window : this);
