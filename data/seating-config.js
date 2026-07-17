/* Sonor Seating Configurator — static flow config (v0.2.0)
   window.__SEATING_CONFIG__ — UI rules + labels only. Catalogue = Library SSOT.
   Flow: Layout → Recommended Ranges → Configure → Summary. MSRP only (trade later).
*/
(function () {
  window.__SEATING_CONFIG__ = {
    version: '0.2.2',
    buildDate: '2026-07-17',
    steps: ['Layout', 'Choose Range', 'Configure', 'Summary'],
    // Step 1 generic setup — standard defaults per the brief
    rowOptions: [1, 2, 3, 4],
    seatsPerRowOptions: [2, 3, 4, 5, 6],
    // sensible default room (mm)
    defaultRoom: { widthMm: 4000, lengthMm: 6000, rows: 2, seatsPerRow: 3 },
    // clearance rules used by the recommender (mm)
    clearance: { sideWallMm: 150, aisleMm: 0, rowGapMm: 600, seatFallbackWidthMm: 650 },
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
    cacheKey: 'sonor_seating_ssot_v2'
  };
})();
