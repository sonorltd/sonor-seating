/* Sonor Seating Configurator — static config
   window.__SEATING_CONFIG__
   UI rules + label maps only. Catalogue DATA lives in Supabase (seating_*)
   with a Tier-2 fallback in seating-catalogue.js. Project data → Supabase.
*/
(function () {
  window.__SEATING_CONFIG__ = {
    version: '0.1.0',
    buildDate: '2026-07-16',

    // Wizard steps (Manufacturer + Range are the new multi-manufacturer front doors)
    steps: ['Manufacturer', 'Range', 'Upholstery', 'Build', 'Summary'],

    // Row layout is deliberately standard for v0.1.0 (per brief: "rows etc initially standard")
    rowOptions: [1, 2, 3],

    // Motor + accessory presentation labels (values come from the data)
    motorLabels: { fixed: 'Fixed Recliner', '1motor': '1-Motor', '2motor': '2-Motor Luxury' },
    accLabels: {
      ottoman: 'Ottoman', corner: 'Corner Unit', chaise: 'Chaise Longue',
      headrest: 'Motorised Headrest Upgrade', bean_bag: 'Bean Bag',
      stool: 'Bar Stool', accessory: 'Accessory'
    },
    // Item types treated as optional add-ons in the Build step (everything that is not seat/armrest)
    accessoryTypes: ['ottoman', 'corner', 'chaise', 'headrest', 'bean_bag', 'stool', 'accessory'],
    accMax: { chaise: 1, _default: 6 },

    // localStorage key for the Tier-3 cache
    cacheKey: 'sonor_seating_catalogue_v1'
  };
})();
