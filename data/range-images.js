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
    // Moovia — ORIGINAL per-range product shots (restored from pre-repoint furniture_ranges).
    // Alpha & Budapest are Habitech-only, no imagery yet.
    'moovia-berlin': 'https://images.squarespace-cdn.com/content/v1/5a8ec728f9a61e7fba3ec60b/1542650055789-WNLNQBL1SMZROM78LD50/products-berlin_swarowski_open-home-theater-seating.png',
    'moovia-chesterfield': 'https://images.squarespace-cdn.com/content/v1/5a8ec728f9a61e7fba3ec60b/1548419092010-Z1SJX7KTD6GXS9450C9W/product-chesterfield_red_velvet_floor_light.png',
    'moovia-dallas': 'https://images.squarespace-cdn.com/content/v1/5a8ec728f9a61e7fba3ec60b/1580301413904-JBZLJ4JWGV7DC755A03M/Moovia_Dallas6257.jpg',
    'moovia-ibiza': 'https://images.squarespace-cdn.com/content/v1/5a8ec728f9a61e7fba3ec60b/1580206693505-Z1XX4LEL3ZG9ULKSTTP7/products-ibiza-home-theater-seating.png',
    'moovia-venice': 'https://images.squarespace-cdn.com/content/v1/5a8ec728f9a61e7fba3ec60b/1542644571271-S4A69FZU7HLL346EJGJN/products-venice-home-theater-seating.png',
    // Cinelux Seating — ORIGINALS (restored from pre-repoint furniture_ranges)
    'cinelux-altman': 'https://images.leadconnectorhq.com/image/f_webp/q_80/r_1000/u_https://storage.googleapis.com/msgsndr/FQyt5AbKYkJf50Le7p3o/media/6684fb55e3e4821ca53da42c.png',
    'cinelux-coppola': 'https://images.leadconnectorhq.com/image/f_webp/q_80/r_1000/u_https://storage.googleapis.com/msgsndr/FQyt5AbKYkJf50Le7p3o/media/668508f0975d549f2b52fb2a.png',
    'cinelux-fellini': 'https://images.leadconnectorhq.com/image/f_webp/q_80/r_1000/u_https://storage.googleapis.com/msgsndr/FQyt5AbKYkJf50Le7p3o/media/66850e700360f21ce8ee9b36.png',
    'cinelux-kubrik': 'https://images.leadconnectorhq.com/image/f_webp/q_80/r_1000/u_https://storage.googleapis.com/msgsndr/FQyt5AbKYkJf50Le7p3o/media/66851e1a4918dc4523f6cecc.png',
    'cinelux-lucas': 'https://images.leadconnectorhq.com/image/f_webp/q_80/r_1000/u_https://storage.googleapis.com/msgsndr/FQyt5AbKYkJf50Le7p3o/media/6686676132d8475a91f055a8.png',
    'cinelux-lynch': 'https://images.leadconnectorhq.com/image/f_webp/q_80/r_1000/u_https://storage.googleapis.com/msgsndr/FQyt5AbKYkJf50Le7p3o/media/668526790360f22b88eebee2.png',
    'cinelux-richie': 'https://images.leadconnectorhq.com/image/f_webp/q_80/r_1000/u_https://storage.googleapis.com/msgsndr/FQyt5AbKYkJf50Le7p3o/media/668527dc975d5446ad532a13.png',
    'cinelux-scorsese': 'https://images.leadconnectorhq.com/image/f_webp/q_80/r_1000/u_https://storage.googleapis.com/msgsndr/FQyt5AbKYkJf50Le7p3o/media/66866ae8ea0cce5d39218846.png',
    // FrontRow Seating — ORIGINAL
    'frontrow-serenity': 'https://www.homecinemaseating.co.uk/wp-content/uploads/2021/03/FrontRow_Configs_Serenity_2021.png',
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
