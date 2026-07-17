/* Sonor Seating Configurator — app-hosted range imagery (v0.7.0)
   window.__RANGE_IMAGES__ — range_id → image path (relative to dashboard/).
   Curated from the manufacturer site scrapes (Downloads/images*.zip, Jul 2026) into
   /range-assets (1200px, web weight). Cineca uses its own per-range assets.
   TRANSITIONAL: retire when the Library files hero_img URLs into the SSOT (contract §6).
   Note: manufacturer marketing photography — confirm usage rights before public launch.
*/
(function () {
  var A = '../range-assets/';
  window.__RANGE_IMAGES__ = {
    // Cineca (bundled app assets)
    'milan': '../cineca-assets/milan.jpg',
    'amalfi': '../cineca-assets/amalfi.jpg',
    'como': '../cineca-assets/como.jpg',
    'modena': '../cineca-assets/modena.jpg',
    // Moovia (moovia.de scrape) — Alpha & Budapest are Habitech-only, no imagery yet
    'moovia-berlin': A + 'moovia-berlin.jpg',
    'moovia-chesterfield': A + 'moovia-chesterfield.jpg',
    'moovia-dallas': A + 'moovia-dallas.jpg',
    'moovia-ibiza': A + 'moovia-ibiza.jpg',
    'moovia-venice': A + 'moovia-venice.jpg',
    // Cinema Deco (cinemadeco.com scrape)
    'cinemadeco-knightsbridge': A + 'cinemadeco-knightsbridge.webp',
    'cinemadeco-chelsea': A + 'cinemadeco-chelsea.webp',
    'cinemadeco-hampstead': A + 'cinemadeco-hampstead.webp',
    'cinemadeco-islington': A + 'cinemadeco-islington.webp',
    'cinemadeco-kensington': A + 'cinemadeco-kensington.webp',
    'cinemadeco-richmond': A + 'cinemadeco-richmond.webp',
    'cinemadeco-mayfair': A + 'cinemadeco-mayfair.webp',
    // Fortress Seating (fortresseating.com scrape)
    'fortress-airflo': A + 'fortress-airflo.jpg',
    'fortress-alex': A + 'fortress-alex.jpg',
    'fortress-alexa': A + 'fortress-alexa.jpg',
    'fortress-aspen': A + 'fortress-aspen.jpg',
    'fortress-balcony': A + 'fortress-balcony.jpg',
    'fortress-bel-aire': A + 'fortress-bel-aire.jpg',
    'fortress-bijou': A + 'fortress-bijou.jpg',
    'fortress-californian': A + 'fortress-californian.jpg',
    'fortress-casablanca': A + 'fortress-casablanca.jpg',
    'fortress-cinemilano': A + 'fortress-cinemilano.jpg',
    'fortress-corona': A + 'fortress-corona.jpg',
    'fortress-crosstown': A + 'fortress-crosstown.jpg',
    'fortress-dakota': A + 'fortress-dakota.jpg',
    'fortress-deco': A + 'fortress-deco.jpg',
    'fortress-el-dorado': A + 'fortress-el-dorado.jpg',
    'fortress-england': A + 'fortress-england.jpg',
    'fortress-guild': A + 'fortress-guild.jpg',
    'fortress-hudson': A + 'fortress-hudson.jpg',
    'fortress-jr2': A + 'fortress-jr2.jpg',
    'fortress-kensington': A + 'fortress-kensington.jpg',
    'fortress-langley': A + 'fortress-langley.jpg',
    'fortress-laurent': A + 'fortress-laurent.jpg',
    'fortress-lexington': A + 'fortress-lexington.jpg',
    'fortress-madison': A + 'fortress-madison.jpg',
    'fortress-manhattan': A + 'fortress-manhattan.jpg',
    'fortress-matinee': A + 'fortress-matinee.jpg',
    'fortress-metro': A + 'fortress-metro.jpg',
    'fortress-nova': A + 'fortress-nova.jpg',
    'fortress-odeon': A + 'fortress-odeon.jpg',
    'fortress-opus': A + 'fortress-opus.jpg',
    'fortress-palace': A + 'fortress-palace.jpg',
    'fortress-palladium': A + 'fortress-palladium.jpg',
    'fortress-pantages': A + 'fortress-pantages.jpg',
    'fortress-regal': A + 'fortress-regal.jpg',
    'fortress-san-clemente': A + 'fortress-san-clemente.jpg',
    'fortress-sierra': A + 'fortress-sierra.jpg',
    'fortress-solo': A + 'fortress-solo.jpg',
    'fortress-uptown': A + 'fortress-uptown.jpg',
    'fortress-valenti': A + 'fortress-valenti.jpg',
    'fortress-west-end': A + 'fortress-west-end.jpg',
    'fortress-windsor': A + 'fortress-windsor.jpg'
  };
})();
