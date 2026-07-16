// Sonor Brand Config — shared across all apps
// Source of truth: brand-core.xml → Supabase brand_config → this file
// Load via <script src="../data/sonor-brand.js"> BEFORE app script
// Apps read window.__SONOR_BRAND__ — never hardcode these values
//
// To update: edit brand-core.xml → run generate-brand.py → update this file
// Or: read from Supabase brand_config table at Phase 2 init

window.__SONOR_BRAND__ = {
  version: "1.0.0",

  // ── Company ──────────────────────────────────────────
  company: {
    name:     "Sonor Smart Homes",
    legal:    "Sonor Ltd",
    tagline:  "Smart homes, beautifully done",
    trustLine:"Trusted by homeowners across the North West & Wales",
    location: "Chester, England",
    url:      "https://sonor.co.uk",
    phone:    "01244 676 373",
    email:    "projects@sonor.co.uk",
    office:   "office@sonor.co.uk",
    phoneSupport: "07933 684 000",
    emailSupport: "support@sonor.co.uk"
  },

  // ── 10 Services (permanent — never reassign) ─────────
  services: [
    { nn: "01", hex: "#8058a1", colour: "Purple",    brand: "Home Cinema",       client: "Cinema & Media",            core: "01 Cinema",         badge: "Cinema"      },
    { nn: "02", hex: "#4bb9d3", colour: "Aqua",      brand: "Multiroom Audio",   client: "Multiroom Audio",           core: "02 Audio",          badge: "Audio"       },
    { nn: "03", hex: "#78ba57", colour: "Green",      brand: "TV Everywhere",     client: "TV & Video",                core: "03 Video",          badge: "Video"       },
    { nn: "04", hex: "#f5d05c", colour: "Yellow",     brand: "Smart Lighting",    client: "Smart Lighting",            core: "04 Lighting",       badge: "Lighting"    },
    { nn: "05", hex: "#e37c59", colour: "Terracotta", brand: "Home Automation",   client: "Home Automation",           core: "05 Automation",     badge: "Automation"  },
    { nn: "06", hex: "#ec6061", colour: "Red",        brand: "Climate",           client: "Climate",                   core: "06 HVAC",           badge: "Climate"     },
    { nn: "07", hex: "#e67eb1", colour: "Pink",       brand: "Control",           client: "Control",                   core: "07 Control",        badge: "Control"     },
    { nn: "08", hex: "#ad9978", colour: "Gold",       brand: "CCTV & Security",   client: "CCTV, Security & Access",   core: "08 Security",       badge: "Security"    },
    { nn: "09", hex: "#b7b1a7", colour: "Silver",     brand: "Whole Home WiFi",   client: "WiFi & Data",               core: "09 Network",        badge: "WiFi"        },
    { nn: "10", hex: "#302f2e", colour: "Charcoal",   brand: "Design & Cabling",  client: "Infrastructure",            core: "10 Infrastructure", badge: "Structure"   }
  ],

  // ── Earthy Theme (locked — from brand-core.xml) ──────
  theme: {
    body:        "#F2EDE5",
    section1:    "#EDE6D9",
    section2:    "#CFC5B2",
    clay:        "#D9CFC0",
    textPrimary: "#2C2218",
    textSecondary:"#5a4e3e",
    textMuted:   "#8B7D6B",
    footerBg:    "#141008",
    ctaBg:       "#1e1810",
    accent:      "#2d718b",
    accentLight: "#4bb9d3",
    border:      "rgba(44,34,24,0.12)",
    borderStrong:"rgba(44,34,24,0.22)"
  },

  // ── Partners (trade associations + platform brands) ──
  partners: [
    { name: "Control4",     role: "Home automation & control platform", level: "Gold Dealer" },
    { name: "Lutron",       role: "Lighting control & shading systems", level: "Dealer" },
    { name: "CEDIA Member", role: "Custom Electronic Design & Installation Association", level: "Member" }
  ],

  // ── Personnel ────────────────────────────────────────
  personnel: [
    { name: "Bryn Bradley",  role: "Director", email: "bryn@sonor.co.uk" },
    { name: "Phil Bradley",  role: "Director", email: "phil@sonor.co.uk" },
    { name: "Mark Rimmer",   role: "Lead Engineer", email: "mark@sonor.co.uk" }
  ],

  // ── Fleet (vehicles) ─────────────────────────────────
  // Canonical list — mirrors brand-core.xml <vehicles>. Every app referencing
  // a van (Inventory, Accounts, Portal, RAMS, etc.) reads from here.
  // Keyed by van_code. Do NOT add SV3+ without Bryn explicitly confirming.
  vehicles: [
    { van_code: "SV1", reg: "CX67XEK", driver_slug: "bryn", driver_name: "Bryn Bradley", active: true, description: "Bryn's van" },
    { van_code: "SV2", reg: "S90NOR",  driver_slug: "mark", driver_name: "Mark",         active: true, description: "Mark's van" }
  ],

  // ── Contact contexts (which email/phone for which purpose) ──
  contacts: [
    { context: "Office",       usage: "Website, proposals, correspondence", phone: "01244 676 373", email: "projects@sonor.co.uk" },
    { context: "Support",      usage: "Client support, service calls",      phone: "01244 676 373", email: "office@sonor.co.uk" },
    { context: "General Docs", usage: "RAMS, formal documents",             phone: "01244 676 373", email: "office@sonor.co.uk" }
  ],

  // ── Fonts (by context) ──────────────────────────────
  fonts: {
    web:   { primary: "DM Sans", mono: "DM Mono", source: "Google Fonts" },
    print: { primary: "Gilroy",  weights: ["Heavy","Bold","Medium","Regular","Light"], source: "Local TTF" }
  },

  // ── App URLs (from Supabase app_versions) ───────────
  // Used by setAppSource() in all apps to switch between Drive and GitHub Pages
  appUrls: {
    local: {
      master:      './index.html',
      pm:          '../APP - Project Master/sonor-project-master.html',
      takeoffs:    '../APP - Takeoffs/sonor-takeoffs.html',
      netmap:      '../APP - Network Map/sonor-network-map.html',
      rams:        '../APP - RAMS Generator/sonor-rams-generator.html',
      leads:       '../APP - Leads/dashboard/sonor-leads.html',
      accounts:    '../APP - Accounts/dashboard/sonor-accounts.html',
      printworkwear: '../APP - Print & Workwear/dashboard/sonor-print-workwear.html',
      packs:       '../APP - Packs/dashboard/sonor-packs.html',
      cinema:         '../APP - Cinema Design/dashboard/sonor-cinema.html',
      cinemaTakeoff:  '../APP - Cinema Design/index.html?tab=takeoff',
      'cinema-takeoff': '../APP - Cinema Takeoff/index.html',
      engineering: '../APP - Engineering/index.html',
      'studio-hub': '../STUDIO - Hub/studio-hub.html',
      cinecacfg:   '../sonor-cineca/index.html',
      portal:      '../APP - Portal/dashboard/sonor-portal.html',
      inventory:   '../APP - Inventory/dashboard/sonor-inventory.html',
      email:       '../APP - Leads/dashboard/email-preview.html',
      webHome:     '../Website - WIP/index.html',
      webAbout:    '../Website - WIP/about.html',
      webPrice:    '../Website - WIP/pricing.html',
      swatches:    '../Branding - CORE/brand-swatches.html',
      tools:       '../Branding - CORE/brand-tools.html',
      subcontractors: 'subcontractors.html',
      dmx:         'https://github.com/sonorltd/sonor-dmx',
      wled:        'https://github.com/sonorltd/sonor-wled',
      arduino:     'https://github.com/sonorltd/sonor-arduino',
      resDatasheets: '../HUB - Resources/datasheets/product-datasheets.html',
      workshop:    '../sonor-workshop/dashboard/sonor-workshop.html',
      library:     '../APP - Library/sonor-library.html',
      tasks:       '../APP - Tasks/sonor-tasks.html',
      studio:      '../STUDIO - Hub/studio-hub.html',
      studioPortal:'../STUDIO - Hub/studio-portal.html',
      flyers:      '../MARKETING - Flyers/index.html',
      followup:    '../APP - Follow-Up Portal/dashboard/sonor-followup.html',
      tender:      '../APP - Tender/sonor-tender.html',
      seating:     '../APP - Seating Configurator/dashboard/sonor-seating.html'
    },
    hosted: {
      master:      'https://sonorltd.github.io/sonor-master/',
      pm:          'https://sonorltd.github.io/sonor-project-master/',
      takeoffs:    'https://sonorltd.github.io/sonor-takeoffs/',
      netmap:      'https://sonorltd.github.io/sonor-network-map/',
      rams:        'https://sonorltd.github.io/sonor-rams/',
      leads:       'https://sonorltd.github.io/sonor-leads/',
      accounts:    'https://sonorltd.github.io/sonor-accounts/',
      printworkwear: 'https://sonorltd.github.io/sonor-print-workwear/',
      packs:       'https://sonorltd.github.io/sonor-packs/',
      cinema:         'https://sonorltd.github.io/sonor-cinema/',
      cinemaTakeoff:  'https://sonorltd.github.io/sonor-cinema/?tab=takeoff',
      'cinema-takeoff': 'https://sonorltd.github.io/sonor-cinema-takeoff/',
      engineering: 'https://sonorltd.github.io/sonor-engineering/',
      'studio-hub': 'https://sonorltd.github.io/sonor-studio/',
      cinecacfg:   'https://sonorltd.github.io/sonor-cineca/',
      portal:      'https://sonorltd.github.io/sonor-portal/',
      inventory:   'https://sonorltd.github.io/sonor-inventory/',
      email:       'https://sonorltd.github.io/sonor-leads/dashboard/email-preview.html',
      webHome:     'https://sonorltd.github.io/sonor-website/',
      webAbout:    'https://sonorltd.github.io/sonor-website/about.html',
      webPrice:    'https://sonorltd.github.io/sonor-website/pricing.html',
      swatches:    'https://sonorltd.github.io/sonor-brand/brand-swatches.html',
      tools:       'https://sonorltd.github.io/sonor-brand/brand-tools.html',
      subcontractors: 'https://sonorltd.github.io/sonor-master/subcontractors.html',
      dmx:          'https://github.com/sonorltd/sonor-dmx',
      wled:         'https://github.com/sonorltd/sonor-wled',
      arduino:      'https://github.com/sonorltd/sonor-arduino',
      resDatasheets: 'https://sonorltd.github.io/sonor-resources/datasheets/product-datasheets.html',
      workshop:    'https://sonorltd.github.io/sonor-workshop/',
      library:     'https://sonorltd.github.io/sonor-library/',
      tasks:       'https://sonorltd.github.io/sonor-tasks/',
      studio:      'https://sonorltd.github.io/sonor-studio/',
      studioPortal:'https://sonorltd.github.io/sonor-studio/studio-portal.html',
      flyers:      'https://sonorltd.github.io/sonor-flyers/',
      followup:    'https://sonorltd.github.io/sonor-followup-portal/',
      tender:      'https://sonorltd.github.io/sonor-tender/',
      seating:     'https://sonorltd.github.io/sonor-seating/'
    }
  },

  // ── Deep-link contracts (cross-app navigation) ──────────
  // Document the URL-param shape every app accepts so QR codes / printed
  // labels / Slack links / cross-app handoffs can be built consistently.
  // Apps own their own consumers (parse window.location.search + act); this
  // block is the canonical SCHEMA. Builders helper at sonor-brand.deepLink(...)
  // below stitches together base URL + params.
  deepLinks: {
    pm: {
      // ?project=<ref>&rack=<rackId>&row=<rowId>#sched-rack-spec
      // Scrolls to the Rack Spec view + highlights the matching rack/row.
      // Used by: PRINT - Rack Plates QR codes (v4.1.x), Portal "Open in PM"
      // button on rack snags, Network Map device → rack handoff.
      rackRow: { params: ['project', 'rack', 'row'], hash: 'sched-rack-spec' },
      // ?project=<ref>&device=<deviceId>#sched-{disc}
      // Scrolls to the relevant schedule view + highlights the matching device.
      device:  { params: ['project', 'device', 'disc'], hash: null }
    }
  },

  // ── Helpers ──────────────────────────────────────────
  // Build a deep link from app key + contract id + param object.
  // Example: deepLink('pm', 'rackRow', {project: '1343', rack: 'AV1'})
  //       → 'https://sonorltd.github.io/sonor-project-master/?project=1343&rack=AV1#sched-rack-spec'
  // Defaults to hosted; pass {source: 'local'} to use the Drive path instead.
  deepLink: function(appKey, contractId, params) {
    var src    = (params && params.source === 'local') ? 'local' : 'hosted';
    var base   = (this.appUrls[src] || {})[appKey];
    var contract = (this.deepLinks[appKey] || {})[contractId];
    if (!base || !contract) return null;
    var qs = new URLSearchParams();
    (contract.params || []).forEach(function(k){
      if (params && params[k] != null && params[k] !== '') qs.set(k, String(params[k]));
    });
    var qstr = qs.toString();
    var hash = contract.hash ? ('#' + contract.hash) : '';
    return base + (qstr ? ('?' + qstr) : '') + hash;
  },

  // Get service by nn, hex, or index
  getService: function(key) {
    if (typeof key === 'number') return this.services[key];
    return this.services.find(s => s.nn === key || s.hex === key);
  },
  // Get hex by nn
  hex: function(nn) {
    const s = this.services.find(s => s.nn === nn);
    return s ? s.hex : '#8B7D6B';
  },
  // Get name by nn + tier
  name: function(nn, tier) {
    tier = tier || 'brand';
    const s = this.services.find(s => s.nn === nn);
    return s ? s[tier] : 'Unknown';
  },

  // ── Fleet helpers ──────────────────────────────────────
  // vehicle('SV1') → full vehicle record, or null if unknown
  vehicle: function(vanCode) {
    if (!vanCode || !this.vehicles) return null;
    const code = String(vanCode).toUpperCase();
    return this.vehicles.find(v => v.van_code === code) || null;
  },
  // activeVehicles() → only vans flagged active
  activeVehicles: function() {
    return (this.vehicles || []).filter(v => v.active !== false);
  },
  // vanLabel('SV1') → 'SV1 · CX67XEK · Bryn Bradley' for UI display
  vanLabel: function(vanCode) {
    const v = this.vehicle(vanCode);
    if (!v) return vanCode || '';
    return v.van_code + ' · ' + v.reg + ' · ' + v.driver_name;
  }
};

// Auto-run: set CSS variables from brand data
(function() {
  if (!window.__SONOR_BRAND__ || typeof window.__SONOR_BRAND__ !== 'object') {
    return; // Guard: brand data not loaded
  }

  const B = window.__SONOR_BRAND__;
  const root = document.documentElement;

  // Set theme variables (if theme object exists)
  // SPINE v1.2 (S-4.1 / S-4.6): if the app declares <html data-theme="…">,
  // the authoritative theme cascade comes from brand.css's [data-theme='…']
  // block. JS write-back would clobber the cascade, so we skip it and let
  // CSS win. Pre-Spine apps (no data-theme attribute) keep the legacy
  // behaviour — JS writes earthy defaults so they render correctly without
  // brand.css being present.
  if (B.theme && typeof B.theme === 'object' && !root.hasAttribute('data-theme')) {
    root.style.setProperty('--body', B.theme.body);
    root.style.setProperty('--section-1', B.theme.section1);
    root.style.setProperty('--section-2', B.theme.section2);
    root.style.setProperty('--clay', B.theme.clay);
    root.style.setProperty('--text-primary', B.theme.textPrimary);
    root.style.setProperty('--text-secondary', B.theme.textSecondary);
    root.style.setProperty('--text-muted', B.theme.textMuted);
    root.style.setProperty('--footer-bg', B.theme.footerBg);
    root.style.setProperty('--cta-bg', B.theme.ctaBg);
    root.style.setProperty('--accent', B.theme.accent);
    root.style.setProperty('--accent-light', B.theme.accentLight);
    root.style.setProperty('--border', B.theme.border);
    root.style.setProperty('--border-strong', B.theme.borderStrong);
  }

  // Set service colour variables (--s01 through --s10)
  if (B.services && Array.isArray(B.services)) {
    B.services.forEach(function(service) {
      if (service.nn && service.hex) {
        root.style.setProperty('--s' + service.nn, service.hex);
      }
    });
  }
})();
