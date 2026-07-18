/* Sonor Seating Configurator — static flow config (v0.3.0)
   window.__SEATING_CONFIG__ — UI rules + labels only. Catalogue = Library SSOT.
   Flow: Intro (landing) → Layout → Recommended Ranges → Configure → Summary. MSRP only (trade later).
*/
(function () {
  window.__SEATING_CONFIG__ = {
    version: '0.21.3',
    buildDate: '2026-07-17',
    // Manufacturer websites (for proposal links). Only verified domains — add as confirmed.
    manufacturerSites: {
      'Moovia': 'https://moovia.de',
      'Fortress Seating': 'https://fortresseating.com',
      'Cinema Deco': 'https://cinemadeco.com',
      'Cineca': 'https://www.cinecacs.com',
      'Cinelux': 'https://cineluxseating.co.uk',
      'FrontRow': 'https://www.homecinemaseating.co.uk'
    },
    // Payment terms shown on the proposal + summary
    paymentTerms: '50% deposit on order · 50% balance prior to delivery',
    termsLines: [
      'Indicative proposal for the seating package only — refer to the main cinema design plans for the final room specification.',
      'This proposal is an indicative estimate prepared from the Sonor seating library. Final pricing, fabric grades, delivery and lead times are confirmed on a formal quotation.',
      'Payment: 50% deposit on order, 50% balance prior to delivery. Prices include VAT at the prevailing rate where stated.',
      'Standard stock items (e.g. black leather) typically ship sooner than bespoke finishes.',
      'Delivery includes placement to room of choice; installation and integration by Sonor as quoted. E&OE.'
    ],
    // Client-facing landing hero. One-line swap: drop a new file at the app root and repoint.
    heroImage: '../venice-double-seats.png',
    // VAT (UK) applied at the summary to show gross totals. Library prices are ex-VAT.
    vatRate: 0.20,
    // Generic finish upgrades (from the Cineca finish set) — offered on every range.
    finishOptions: [
      { id: 'contrast_stitch', label: 'Contrast Stitching', note: 'Contrasting thread on all seams — colour to discuss with supplier' },
      { id: 'decorative_piping', label: 'Decorative Piping', note: 'Adds definition to seat cushion and back edges' },
      { id: 'headrest_monogram', label: 'Headrest Monogram / Embroidery', note: 'Initials or logo embroidered on each headrest panel' },
      { id: 'medialink_armrest', label: 'MediaLink Armrests', note: 'USB-A & USB-C charging ports integrated into armrest cap' }
    ],
    // ── Commercial terms per manufacturer (Sonor-set: delivery £ + lead time). ──
    //   NOT catalogue data — these are Sonor's own delivery pricing & typical lead times.
    //   Transitional home: migrate to SSOT seating_manufacturers when the Library exposes
    //   it (contract §6). Keyed by manufacturer name (as it appears in the library).
    //   delivery.type: 'flat' (gbp per order) · 'perSeat' (gbp × seats) · 'band' (bands[] by order £).
    //   leadWeeks: [min, max]. Any null / missing manufacturer → "confirmed at quotation".
    deliveryLabel: 'Delivery',
    // Installation: base £50 for the first seat, each additional seat adds 1/3 of base
    // (e.g. 6 seats = 50 + 5 × 16.67 ≈ £133).
    installation: { baseGbp: 50, incrementFactor: 1 / 3, label: 'Installation' },
    // Interim assumption until accurate per-manufacturer figures: £50 per seat delivery;
    // custom builds 8–12 weeks (standard stock items e.g. black leather ship sooner).
    manufacturerTerms: {
      _default: { delivery: { type: 'perSeat', gbp: 50 }, leadWeeks: [8, 12], note: 'Custom builds 8–12 weeks; standard stock items (e.g. black leather) ship sooner.' }
    },
    steps: ['Layout', 'Style', 'Options', 'Summary'],
    // Step 1 generic setup — standard defaults per the brief
    rowOptions: [1, 2, 3, 4],
    seatsPerRowOptions: [2, 3, 4, 5, 6, 7, 8, 9, 10],
    // sensible default room (mm)
    defaultRoom: { widthMm: 4000, lengthMm: 6000, rows: 2, seatsPerRow: 3 },
    // clearance rules used by the recommender (mm)
    clearance: { sideWallMm: 150, aisleMm: 0, rowGapMm: 50, seatFallbackWidthMm: 650, genericSeatMm: 600, genericArmMm: 150 },
    prefs: [
      { id: 'reclining', label: 'Powered recliners', hint: 'Motorised recline' },
      { id: 'daybed', label: 'Daybed / lounger', hint: 'A chaise or day-bed style seat' },
      { id: 'sofa', label: 'Sofa / loveseat style', hint: 'Wider shared seating' }
    ],
    motorLabels: { fixed: 'Fixed', '1motor': '1-Motor', '2motor': '2-Motor' },
    // item types treated as optional add-ons in Configure (not seats/armrests)
    accessoryTypes: ['ottoman', 'corner', 'chaise', 'headrest', 'bean_bag', 'stool', 'accessory'],
    accLabels: {
      ottoman: 'Ottoman', corner: 'Corner Unit', chaise: 'Chaise Longue',
      headrest: 'Motorised Headrest', bean_bag: 'Bean Bag', stool: 'Bar Stool', accessory: 'Accessory'
    },
    accMax: { chaise: 2, _default: 8 },
    cacheKey: 'sonor_seating_ssot_v5'
  };
})();
