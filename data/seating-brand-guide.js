/* Sonor Seating Configurator — CINEMA SEATING: THE MAKERS (brand guide PDF, v0.25.0)
   SeatingBrandGuide.generate() — a client-facing guide to the cinema-seating makers, built on the
   shared SonorPdfLuxury chrome (data/sonor-pdf-luxury.js root master = the exact seating-proposal
   system: venice cover, cream pages, gold rules, Gilroy). Downloaded from the landing page.

   Content = data below, written in Sonor's voice. Facts drawn from the makers' published
   information and the Custom Controls seating comparison (July 2026); Sonor's own view added.
   "Available through Sonor" pills come LIVE from seating_manufacturers (the SSOT) — a maker that
   is in the catalogue is marked, anything else is "on request". Photos = the app's own range
   assets (manufacturer marketing imagery — same rights position as the proposal PDF).
   No prices (WeQuote is price SSOT), no hosted links (sonor-platform §35). ff-safe copy only.
*/
(function (global) {
  'use strict';
  function L() { return global.SonorPdfLuxury; }
  var DOC_LABEL = 'CINEMA SEATING · THE MAKERS';
  function selfDir() {
    try { var s = document.currentScript; if (s && s.src) return s.src.replace(/[^/]*$/, ''); } catch (e) {}
    try { var arr = document.getElementsByTagName('script'); for (var i = arr.length - 1; i >= 0; i--) { if (/seating-brand-guide\.js/.test(arr[i].src)) return arr[i].src.replace(/[^/]*$/, ''); } } catch (e) {}
    return '../data/';
  }
  var BASE = selfDir();

  // ── the makers ───────────────────────────────────────────────────────────
  var MAKERS = [
    { key: 'cineak', name: 'Cineak', eyebrow: 'BELGIUM · FAMILY-RUN', origin: 'Belgium', style: 'Dedicated cinema',
      intro: 'A family-run Belgian maker whose seats have become the quiet benchmark for dedicated cinema rooms. Installations more than a decade old are still in near-daily use, which tells you most of what you need to know.',
      rows: [['Collections', 'More than a dozen families including Fortuny, Nero, Largo, Intimo, Cosymo and Strato — most are modular'], ['Mechanisms', 'Dual and triple motors on illuminated preset keypads; the Largo adds motorised storage tables'], ['Upholstery', 'Italian stitched leathers, French fabrics, or your own material'], ['Options', 'Motorised articulating headrests, electronic lumbar, heated and cooled ventilated leather, USB-C and wireless charging, cooled cup holders, backlit onyx side tables'], ['Customisation', 'Arm styles, widths, loveseats and chaises across the modular ranges'], ['Integration', 'Crestron and Kaleidescape ready'], ['Best for', 'Dedicated cinema rooms where build quality and longevity lead the brief']],
      view: 'Our default recommendation for a purpose-built cinema. If the room is the cinema and nothing else, start here.' },
    { key: 'moovia', name: 'Moovia', eyebrow: 'NAGOLD, GERMANY · SINCE 2003', origin: 'Germany', style: 'Design-led', photo: 'range-assets/moovia-chesterfield.jpg',
      intro: 'Founded in 2003 as a projection-screen and accessory house, Moovia grew into a design-first seating maker. Every dimension, armrest, material, stitch, light and control is specified rather than chosen from a list.',
      rows: [['Collections', 'Chesterfield, Stockholm, Milano, Marbella and Dallas among others'], ['Design service', '2D and 3D layouts, CAD integration, photorealistic renderings and mock-ups'], ['Upholstery', 'Leathers and fabrics specified per project'], ['Customisation', 'Dimensions, armrests, materials, stitching, lighting and controls are all open'], ['Best for', 'A statement piece, or a room that doubles as a living space']],
      view: 'Where the seating has to carry the look of the room as much as the function, Moovia gives us the most design latitude and the strongest support on complex layouts.' },
    { key: 'vismara', name: 'Vismara Design', eyebrow: 'BRIANZA, ITALY', origin: 'Italy', style: 'Classic Italian luxury',
      intro: 'From Brianza, the heartland of Italian furniture making, Vismara specialises in home-entertainment furniture with the craftsmanship you would expect of the region.',
      rows: [['Collections', 'Onassis, Luxor, Luxor Tech, Chest, Kubrik and Comfort (ergonomic head cushions)'], ['Mechanisms', 'Single or double reclining; single, loveseat, chaise-longue and daybed formats in straight or curved rows'], ['Upholstery', 'Leathers, nubucks and fabrics'], ['Accessories', 'Refrigerated cup holders, heaters, USB charging, touch light controls, tables, lamps and cocktail-bar drawers'], ['Best for', 'Classic luxury briefs and cinemas that sit within a wider entertainment space']],
      view: 'The choice when the interior is traditional and the seating must read as fine furniture first, cinema seating second.' },
    { key: 'cineca', name: 'Cineca', eyebrow: 'RIBBLE VALLEY, UK · BUILT IN EUROPE', origin: 'United Kingdom', style: 'Compact rooms', photo: 'cineca-assets/milan.jpg',
      intro: 'A Lancashire company with its seats built to order in a European factory. Cineca designs around real UK rooms, which makes it our go-to where space is tight.',
      rows: [['Collections', 'Siena, Modena, Amalfi, Milan, Como and the Savona modular sofa'], ['Mechanisms', 'Milan: steel three-way motorised wall-away. Amalfi: dual-motor zero-gravity. Battery pack option for powered recline without a socket'], ['Upholstery', 'Fabrics, two genuine Italian leathers, or your own material; contrast or tone-on-tone stitching; normal, wide or wedged armrests'], ['Integration', 'Contact-closure control'], ['Best for', 'Basements, lofts and smaller rooms where every millimetre counts']],
      view: 'The wall-away mechanisms and compact footprints make Cineca the first thing we configure when the room is small. Our stretched-fabric walls use the same supplier\'s fabric range.' },
    { key: 'hcm', name: 'Home Cinema Modules', eyebrow: 'UNITED KINGDOM · MADE TO YOUR DESIGN', origin: 'United Kingdom', style: 'Bespoke sofa-style',
      intro: 'Rather than choosing from a range, Home Cinema Modules builds to the design you agree — a practical alternative to the design-led European makers for unusual footprints.',
      rows: [['Approach', 'Custom-built seating to a drawn layout rather than a catalogue'], ['Example', 'Seating for six in a converted garage cinema: two double sofas flanked by individual chairs'], ['Best for', 'Non-standard rooms, and clients who want the look of a sofa with the function of cinema seating']],
      view: 'Worth the conversation when the room shape rules out standard modules, or when the brief is sofa first.' },
    { key: 'fortress', name: 'Fortress', eyebrow: 'LA VERNE, CALIFORNIA · HAND-BUILT', origin: 'United States', style: 'Traditional American theatre', photo: 'range-assets/fortress-matinee.jpg', photoAlt: 'range-assets/fortress-manhattan.jpg',
      intro: 'Hand-built in California to the traditional American theatre pattern: hardwood frames, deep foams and highly bespoke layouts, including curved and semicircular rows made to a template of the room.',
      rows: [['Construction', 'Alder hardwood and birch plywood frames to ANSI / BIFMA standards; high-density and memory-gel foam over flex webbing; double-stitched seams'], ['Collections', 'Dozens, including Matinee, Palace, Kensington and Manhattan'], ['Upholstery', 'Top-grain leather or fabric'], ['Customisation', 'Curved and semicircular rows, often tested in plywood first'], ['To confirm', 'Lead times, shipping and UK fire-regulation compliance are agreed up front on every order'], ['Best for', 'A traditional American theatre look']],
      view: 'Superb when the brief is a classic theatre. Because it ships from the US we confirm lead time and compliance before anything is specified.' },
    { key: 'cinemadeco', name: 'Cinema Deco', eyebrow: 'UNITED KINGDOM · MADE TO ORDER', origin: 'United Kingdom', style: 'British luxury',
      intro: 'A British maker of luxury home-cinema seating, made to order, with a range of named London-inspired collections.',
      rows: [['Collections', 'Chelsea, Hampstead, Islington, Kensington, Knightsbridge and more'], ['Approach', 'Made to order in the UK with a retail price structure'], ['Best for', 'A British-made recliner with a clear range to choose from']],
      view: 'A straightforward UK-made option in our catalogue when a client wants a known range rather than a bespoke build.' },
    { key: 'cinelux', name: 'Cinelux Seating', eyebrow: 'UNITED KINGDOM', origin: 'United Kingdom', style: 'Value recliners',
      intro: 'UK-supplied cinema recliners across eight ranges, with colourways agreed with the supplier at order and samples provided at quotation.',
      rows: [['Collections', 'Eight ranges in our catalogue'], ['Upholstery', 'Open colour choice — samples at quotation'], ['Best for', 'Media rooms and secondary spaces where budget matters']],
      view: 'Where the seating budget is tighter, Cinelux keeps the recline and the comfort without the bespoke premium.' },
    { key: 'frontrow', name: 'FrontRow Seating', eyebrow: 'UNITED KINGDOM · MODULAR', origin: 'United Kingdom', style: 'Modular configurations',
      intro: 'A modular system — the Serenity family — built up from modules into dozens of drawn configurations, from a single chair to full curved rows.',
      rows: [['Collections', 'Serenity — 140 drawn configurations from 27 modules'], ['Approach', 'Pick a configuration, or build one from modules'], ['Best for', 'Rooms that need an exact seats-per-row answer from a modular kit']],
      view: 'The configuration drawings make FrontRow quick to lay out accurately — useful when the row count is fixed by the room.' }
  ];
  var OTHER = [
    { title: 'Designer sofas (e.g. modular systems from the Italian houses)', text: 'For relaxed, family-led media rooms a modular designer sofa can be the right answer. Expect to give up motorised recline and dedicated control integration in exchange for the look.' },
    { title: 'Online and US retail brands', text: 'Several US brands sell mainly online, some with power headrests, lumbar support and motion-seat options. For UK clients we weigh availability, after-sales support, shipping, lead times and UK furniture fire regulations before recommending any of them.' }
  ];

  // ── the room, the formats, the features, the rules of thumb (from the seating page + our own practice) ──
  var FORMATS = [
    ['Single recliners', 'Individual motorised recliners with independent control. The most flexible answer — mixed preferences, and the seat count can change later.'],
    ['Loveseats and sofa pairs', 'Two- or three-seat units sharing a centre console with cup holders, charging and storage. Couples, families, or a VIP front row; the deep sofa versions give a living-room look with a full theatre specification.'],
    ['Day beds and chaises', 'A relaxed front row for family cinemas and young children — and a low front row helps the second row see over it without a tall riser.'],
    ['Row seating', 'Fixed rows with a consistent recline angle and shared armrests. Fits more seats into a given area than individual recliners.'],
    ['Tiered platforms', 'For any room with more than one row. Platform height and structural load are designed to deliver the sightlines, with power and control cabled through the riser.']
  ];
  var FEATURES = [
    ['Motors', 'Dual or triple motors move the backrest, footrest and headrest independently; presets on an illuminated keypad.'],
    ['Articulating headrest', 'Motorised on the better ranges — what keeps you comfortable at full recline instead of craning at the screen.'],
    ['Power lumbar', 'Specified on full recliners; worth having on anything the main viewer sits in.'],
    ['Centre console', 'Cup holders (cooled on some ranges), USB-C and wireless charging, storage.'],
    ['LED base lighting', 'Under each seat or along the row platform — aisle lighting and a design detail, dimmed with the room scenes.'],
    ['Haptic bass', 'Bass transducers in the seat frame on isolators, driven from the LFE channel by a dedicated amplifier — felt in the seat, not through the floor.'],
    ['Control integration', 'Seats go to viewing position when the film starts, lights dim, the projector fires, and everything returns upright when it ends — all cabled through the riser, nothing on show.']
  ];
  var RULES = [
    ['Row pitch', 'Fully reclined seat depth plus a walkway of around 500 mm — in practice about 2.0 m per row for full power recliners.'],
    ['Back row', 'Wall-hugger (wall-away) mechanisms let the back row sit close to the rear wall without losing recline.'],
    ['Second-row riser', 'Typically 300–450 mm in a residential room — calculated from screen height, viewing distance and seated eye height, never guessed.'],
    ['Aisles', 'Sized for real use and the building regulations; a side aisle is usually better than a centre aisle in a narrow room.'],
    ['Seat count', 'Decided by the room area and the layout, checked reclined against the plan — the configurator does this live.'],
    ['Viewing distance', 'Fixed with the row positions at design stage, alongside the screen size, so every seat sits inside the recommended viewing angles.']
  ];
  var MATERIALS = [
    ['Leather', 'Full-grain or top-grain — hard-wearing and easy to care for. Colour, grade, perforation, contrast stitching, headrest style and embossing are all open.'],
    ['Fabric', 'Chosen with the interior designer; warmer and more personal, with a modest acoustic benefit. Our stretched-fabric walls can share the same supplier range.'],
    ['Avoid', 'Bonded leather — it peels with regular use and we do not specify it.']
  ];
  var PROCESS = [
    ['Layout and acoustics', 'Row positions, heights, seat configurations, sightlines, recline clearance and aisle widths are fixed in the design — before anything is ordered.'],
    ['Specification', 'Mechanism, headrest, lumbar, console, lighting and upholstery agreed on the quotation.'],
    ['Samples', 'Leather and fabric samples approved in the room, under its lighting.'],
    ['Structure and cabling', 'Risers built to the load and height; power and control runs planned and routed through the platform.'],
    ['Installation', 'Seats arrive for installation into a room built to receive them, with the control system programmed to drive them.']
  ];
  var CRITERIA = [
    ['The room comes first', 'Width, depth, riser height and the walk-around decide the seat before taste does. We check the real footprint, reclined, against the plan.'],
    ['Function before finish', 'Recline type, headrest, lumbar, charging and integration with the control system are agreed before fabric and colour.'],
    ['One supplier, one warranty', 'Every seat we specify is supplied, delivered and installed by Sonor and sits on the same quotation as the rest of the room.'],
    ['Samples before orders', 'Leather and fabric samples are approved in the room, under the room\'s lighting, before anything is ordered.']
  ];

  function fit(F, s, size, w) { s = String(s == null ? '' : s); while (s.length > 3 && F.widthOfTextAtSize(s, size) > w) s = s.slice(0, -2).replace(/\s+$/, ''); return s; }
  function rule(P, F, lx, label, y) { P.tracked(label, lx.M, y, 6.5, F.r, lx.COL.MUT, 1.5); P.hline(lx.M, lx.A4.w - lx.M, y + 11, lx.COL.GOLD, 0.8, 0.75); return y + 26; }
  function pill(P, F, lx, x, y, t, rgb) {
    var h = 15, w = F.b.widthOfTextAtSize(t, 7) + (t.length - 1) * 1.2 + 22;
    P.dot(x + h / 2, y + h / 2, h / 2, rgb); P.dot(x + w - h / 2, y + h / 2, h / 2, rgb); P.rect(x + h / 2, y, w - h, h, rgb, 1);
    P.tracked(t, x + 11, y + 4.2, 7, F.b, [255, 255, 255], 1.2); return w;
  }


  // a titled list page: [[label, text]…] as gold-dot entries, chunked to fit
  function secList(label, eyebrow, title, note, items) {
    var lx = L();
    return function (P, F, pageNo, TOTAL) {
      var M = lx.M, A4 = lx.A4, COL = lx.COL;
      lx.pageHead(P, F, label, pageNo, TOTAL, DOC_LABEL);
      var y = lx.sectionHead(P, F, eyebrow, title, note);
      y = Math.max(y, 184);
      items.forEach(function (c) {
        P.dot(M + 3, y - 4, 2.2, COL.GOLD); P.text(c[0], M + 14, y - 9, 11, F.b, COL.INK);
        var lines = lx.wrap(c[1], F.r, 10, A4.w - M * 2 - 14);
        lines.forEach(function (ln, i) { P.text(ln, M + 14, y + 6 + i * 13.5, 10, F.r, COL.INK2); });
        y += 24 + lines.length * 13.5;
      });
      lx.pageFoot(P, F);
    };
  }
  function secIntro(m) {
    var lx = L();
    return function (P, F, pageNo, TOTAL) {
      var M = lx.M, A4 = lx.A4, COL = lx.COL;
      lx.pageHead(P, F, 'INTRODUCTION', pageNo, TOTAL, DOC_LABEL);
      var y = lx.sectionHead(P, F, 'A SONOR GUIDE', 'Choosing your seating', 'There is no single best cinema seat. Each maker below does one thing particularly well, and the right choice follows the room, the way it will be used and the look you are after. This guide sets out who makes what, and where we would steer you.');
      y = Math.max(y, 184);
      y = rule(P, F, lx, 'HOW WE CHOOSE', y);
      CRITERIA.forEach(function (c) {
        P.dot(M + 3, y - 4, 2.2, COL.GOLD); P.text(c[0], M + 14, y - 9, 10.5, F.b, COL.INK);
        var lines = lx.wrap(c[1], F.r, 9.5, A4.w - M * 2 - 14);
        lines.forEach(function (ln, i) { P.text(ln, M + 14, y + 5 + i * 12.5, 9.5, F.r, COL.INK2); });
        y += 20 + lines.length * 12.5;
      });
      y += 10; y = rule(P, F, lx, 'IN THIS GUIDE', y);
      var colW = (A4.w - M * 2) / 2, x = M, y0 = y;
      MAKERS.forEach(function (mk, i) {
        if (i === Math.ceil(MAKERS.length / 2)) { x = M + colW; y = y0; }
        P.dot(x + 3, y - 4, 2.2, COL.GOLD); P.text(mk.name, x + 14, y - 9, 10.5, F.r, COL.INK);
        P.text(fit(F.r, mk.style, 8, colW - 110), x + 14 + F.r.widthOfTextAtSize(mk.name, 10.5) + 8, y - 7.5, 8, F.r, COL.MUT);
        y += 19;
      });
      lx.pageFoot(P, F);
    };
  }
  function secMaker(mk, imgs, avail) {
    var lx = L();
    return function (P, F, pageNo, TOTAL) {
      var M = lx.M, A4 = lx.A4, COL = lx.COL;
      lx.pageHead(P, F, mk.name.toUpperCase(), pageNo, TOTAL, DOC_LABEL);
      var y = lx.sectionHead(P, F, mk.eyebrow, mk.name, mk.intro);
      // availability pill — LIVE from seating_manufacturers
      var isIn = avail[mk.key] === true;
      if (avail._known) { var pw = F.b.widthOfTextAtSize(isIn ? 'AVAILABLE THROUGH SONOR' : 'ON REQUEST', 7) + 46; pill(P, F, lx, A4.w - M - pw, 96, isIn ? 'AVAILABLE THROUGH SONOR' : 'ON REQUEST', isIn ? COL.GOLD : [150, 138, 116]); }
      y = Math.max(y, 186);
      var img = imgs[mk.key], logo = imgs[mk.key + ':logo'];
      if (img) {
        var w = A4.w - M * 2, h = img.height * (w / img.width), hMax = 170;
        if (h > hMax) { h = hMax; w = img.width * (h / img.height); }
        var hx = M + (A4.w - M * 2 - w) / 2;
        P.image(img, hx, y, w, h, 1); P.rectB(hx, y, w, h, COL.LINE, 0.8);
        y += h + 18;
      } else if (logo) {
        var lh = 34, lw = logo.width * (lh / logo.height); if (lw > 160) { lw = 160; lh = logo.height * (lw / logo.width); }
        P.image(logo, M, y, lw, lh, 0.95); y += lh + 18;
      }
      var b = lx.specRows(P, F, mk.rows, M, y, A4.w - M * 2 - 40);
      y = b + 14;
      var maxY = A4.h - 110;
      if (y < maxY - 40) {
        y = rule(P, F, lx, 'THE SONOR VIEW', y);
        lx.wrap(mk.view, F.r, 10.5, A4.w - M * 2).forEach(function (ln) { P.text(ln, M, y - 9, 10.5, F.r, COL.INK2); y += 15; });
      }
      lx.pageFoot(P, F);
    };
  }
  function secOther() {
    var lx = L();
    return function (P, F, pageNo, TOTAL) {
      var M = lx.M, A4 = lx.A4, COL = lx.COL;
      lx.pageHead(P, F, 'OTHER ROUTES', pageNo, TOTAL, DOC_LABEL);
      var y = lx.sectionHead(P, F, 'BEYOND THE SPECIALISTS', 'Other routes', 'Two further options come up in most conversations. Both can be right — with compromises worth knowing about.');
      y = Math.max(y, 186);
      OTHER.forEach(function (o) {
        y = rule(P, F, lx, o.title.toUpperCase(), y);
        lx.wrap(o.text, F.r, 10.5, A4.w - M * 2).forEach(function (ln) { P.text(ln, M, y - 9, 10.5, F.r, COL.INK2); y += 15; });
        y += 18;
      });
      lx.pageFoot(P, F);
    };
  }
  function secTable(avail) {
    var lx = L();
    return function (P, F, pageNo, TOTAL) {
      var M = lx.M, A4 = lx.A4, COL = lx.COL, W = A4.w - M * 2;
      lx.pageHead(P, F, 'AT A GLANCE', pageNo, TOTAL, DOC_LABEL);
      var y = lx.sectionHead(P, F, 'SIDE BY SIDE', 'At a glance', 'The makers in one view. "Best for" is our steer, not a rule — every room gets its own recommendation.');
      y = Math.max(y, 180);
      var cols = [{ l: 'Maker', w: W * 0.2 }, { l: 'Origin', w: W * 0.17 }, { l: 'Character', w: W * 0.23 }, { l: 'Best for', w: W * 0.3 }, { l: 'Via Sonor', w: W * 0.1, r: true }];
      var x = M; cols.forEach(function (c) { if (c.r) P.trackedRight(c.l.toUpperCase(), x + c.w, y, 6.2, F.r, COL.MUT, 1.2); else P.tracked(c.l.toUpperCase(), x, y, 6.2, F.r, COL.MUT, 1.2); x += c.w; });
      P.hline(M, A4.w - M, y + 10, COL.GOLD, 0.8, 0.75); y += 24;
      MAKERS.forEach(function (mk, i) {
        var best = (mk.rows.find(function (r) { return r[0] === 'Best for'; }) || ['', ''])[1];
        var cells = [mk.name, mk.origin, mk.style, best, avail._known ? (avail[mk.key] === true ? 'Yes' : 'Request') : '—'];
        var x2 = M, extra = 0;
        cols.forEach(function (c, ci) {
          var fnt = ci === 0 ? F.b : F.r;
          if (c.r) P.right(cells[ci], x2 + c.w, y - 7, 9, fnt, COL.INK);
          else if (ci === 3) { var lines = lx.wrap(cells[ci], F.r, 8.5, c.w - 14).slice(0, 2); lines.forEach(function (ln, li) { P.text(ln, x2, y - 7 + li * 11, 8.5, F.r, COL.INK2); }); extra = Math.max(extra, (lines.length - 1) * 11); }
          else P.text(fit(fnt, cells[ci], 9, c.w - 12), x2, y - 7, 9, fnt, ci === 0 ? COL.INK : COL.INK2);
          x2 += c.w;
        });
        if (i < MAKERS.length - 1) P.hline(M, A4.w - M, y + 9 + extra, COL.LINE, 0.5, 0.6);
        y += 22 + extra;
      });
      lx.pageFoot(P, F);
    };
  }
  function secDetail(ref, dateText) {
    var lx = L();
    return function (P, F, pageNo, TOTAL) {
      var M = lx.M, A4 = lx.A4, COL = lx.COL;
      lx.pageHead(P, F, 'THE DETAIL', pageNo, TOTAL, DOC_LABEL);
      P.tracked('THE DETAIL', M, 92, 8.5, F.r, COL.GOLD, 2.6);
      var y = 118;
      ['Every seat Sonor specifies is supplied, delivered and installed by Sonor and priced on the formal quotation, which governs.', 'Makers marked "available through Sonor" are in our live catalogue; the others are sourced on request for the right project.', 'Collections, mechanisms and options are the makers\' published ranges at the date of this guide and change without notice; the configuration we propose is confirmed on the quotation.', 'Imported seating is subject to UK furniture fire regulations; compliance, shipping and lead time are confirmed before any order.', 'Leather and fabric samples are approved before ordering; colourways are subject to availability.', 'Comparison informed by the makers\' published information and the Custom Controls home-cinema seating guide (July 2026). The views expressed are Sonor\'s own.'].forEach(function (t) {
        P.dot(M + 3, y - 3, 2.2, COL.GOLD); var lines = lx.wrap(t, F.r, 10.5, A4.w - M * 2 - 18); lines.forEach(function (ln, li) { P.text(ln, M + 14, y - 9 + li * 14.5, 10.5, F.r, COL.INK2); }); y += lines.length * 14.5 + 12;
      });
      P.hline(M, A4.w - M, A4.h - 130, COL.LINE, 0.8); P.tracked('GUIDE REFERENCE', M, A4.h - 116, 6.5, F.r, COL.MUT, 1.5); P.text(ref, M, A4.h - 106, 14, F.b, COL.INK);
      P.text('Please quote this reference in any correspondence about this guide.', M, A4.h - 86, 8.5, F.r, COL.MUT); P.right(dateText, A4.w - M, A4.h - 112, 9.5, F.r, COL.MUT);
      lx.pageFoot(P, F);
    };
  }

  function makeRef() { var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); }, c = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', r = ''; for (var i = 0; i < 4; i++) r += c[Math.floor(Math.random() * c.length)]; return 'SNR-SG-' + String(d.getFullYear()).slice(2) + p(d.getMonth() + 1) + p(d.getDate()) + '-' + r; }

  // availability — LIVE from the engine's manufacturers (seating_manufacturers), falling back to the catalogue seed
  // (ranges carry manufacturer_slug + manufacturer_meta._logo_url from seating_manufacturers)
  function availability() {
    var out = {}, logos = {}, E = global.SonorSeating;
    try {
      (E && E.seatingRanges ? E.seatingRanges() : []).forEach(function (r) {
        var k = String(r.manufacturer_slug || r.manufacturer || '').toLowerCase().replace(/[^a-z]/g, '');
        if (!k) return; out[k] = true;
        var lg = r.manufacturer_meta && r.manufacturer_meta._logo_url; if (lg && !logos[k]) logos[k] = lg;
      });
    } catch (e) {}
    out._logos = logos; out._known = Object.keys(out).length > 0;   // no catalogue loaded → say nothing rather than mark everyone 'on request'
    return out;
  }

  async function generate(opts) {
    opts = opts || {};
    var lx = L(); if (!lx) throw new Error('SonorPdfLuxury master not loaded');
    var PL = global.PDFLib, doc = await PL.PDFDocument.create();
    doc.setTitle('Cinema seating — the makers · Sonor'); doc.setAuthor('Sonor Ltd');
    lx.theme('luxury');
    var F = await lx.makeFonts(doc, BASE);
    var hero = null, cedia = null, fadeImg = null;
    var heroUrl = (global.__SEATING_CONFIG__ || {}).heroImage || (BASE + '../venice-double-seats.png');
    try { hero = await lx.loadImage(doc, heroUrl); } catch (e) {}
    try { cedia = await lx.loadImage(doc, BASE + 'cedia-member-stacked.png'); } catch (e) {}
    try { var fd = lx.fadePngDataUrl(); if (fd) fadeImg = await doc.embedPng(await lx.fetchBytes(fd)); } catch (e) {}
    var imgs = {}, avail = availability();
    for (var i = 0; i < MAKERS.length; i++) {
      var mk = MAKERS[i];
      if (mk.photo) { try { imgs[mk.key] = await lx.loadImage(doc, BASE + '../' + mk.photo); } catch (e) { if (mk.photoAlt) { try { imgs[mk.key] = await lx.loadImage(doc, BASE + '../' + mk.photoAlt); } catch (e2) {} } } }
      var lg = (opts.logos && opts.logos[mk.key]) || (avail._logos && avail._logos[mk.key]);
      if (!imgs[mk.key] && lg) { try { imgs[mk.key + ':logo'] = await lx.loadImage(doc, lg); } catch (e) {} }
    }
    var ref = makeRef(), dateText = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    var sections = [{ label: 'Introduction', draw: secIntro() },
      { label: 'Seating formats', draw: secList('SEATING FORMATS', 'THE SHAPE OF THE ROW', 'Seating formats', 'Seating is specified as part of the room, never chosen from a catalogue afterwards — it sets the sightlines, the recline clearance, the aisles and the colour scheme. These formats combine freely in one room.', FORMATS) },
      { label: 'What the seats do', draw: secList('FEATURES', 'WHAT THE SEATS DO', 'Features worth having', 'The mechanisms and comforts that separate cinema seating from a reclining sofa.', FEATURES) },
      { label: 'Rules of thumb', draw: secList('RULES OF THUMB', 'LAYOUT', 'Rules of thumb', 'The numbers we design to. Every room is set out properly in the configurator — these are the starting points.', RULES.concat(MATERIALS.map(function (m) { return [m[0] === 'Avoid' ? 'Avoid' : m[0] + ' upholstery', m[1]]; }))) },
      { label: 'How it happens', draw: secList('THE PROCESS', 'FROM DRAWING TO ROOM', 'How it happens', 'Five steps, in this order, so the seats land in a room that was built for them.', PROCESS) }].concat(MAKERS.map(function (mk) { return { label: mk.name, draw: secMaker(mk, imgs, avail) }; })).concat([{ label: 'Other routes', draw: secOther() }, { label: 'At a glance', draw: secTable(avail) }, { label: 'The detail', draw: secDetail(ref, dateText) }]);
    var TOTAL = sections.length + 1;
    var p1 = doc.addPage([lx.A4.w, lx.A4.h]);
    lx.cover(lx.mk(p1, doc), F, { hero: hero, fadeImg: fadeImg, cediaImg: cedia, eyebrow: DOC_LABEL, title: 'Choosing your seating', subtitle: 'A Sonor guide to the makers',
      info: [['PREPARED BY', 'Sonor'], ['EDITION', dateText], ['REFERENCE', ref]] });
    sections.forEach(function (s, idx) { var pg = doc.addPage([lx.A4.w, lx.A4.h]); var P = lx.mk(pg, doc); P.rect(0, 0, lx.A4.w, lx.A4.h, lx.COL.CREAM); s.draw(P, F, idx + 2, TOTAL); });
    var bytes = await doc.save();
    if (opts.returnBytes) return bytes;
    var blob = new Blob([bytes], { type: 'application/pdf' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'sonor-cinema-seating-the-makers-' + ref + '.pdf';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    return true;
  }
  global.SeatingBrandGuide = { generate: generate, MAKERS: MAKERS, available: function () { return !!(global.PDFLib && global.PDFLib.PDFDocument && global.SonorPdfLuxury); } };
})(window);
