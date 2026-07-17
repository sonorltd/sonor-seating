# Seating Configurator — Claude Code Context (v0.6.0)

> **v0.6.0 — fully-featured Material step + VAT + hero PDF cover.**
> **Materials (Cineca parity):** adapter keeps `available` / `upcharge` / `tier` and attaches
> **colourways** (from `seating_material_colours`, bundled in the seed `colours` map + fetched
> live). Configure groups **Leather / Fabric** cards with tier, "Not available for {range}",
> upcharge %, colourway counts + a colour picker. **Finish options** = 4 generic toggles
> (`CFG.finishOptions`, from the Cineca set) → recorded on summary/CSV/PDF (priced with supplier).
> **VAT:** `CFG.vatRate` (0.20) → summary shows Subtotal ex VAT → VAT → **Total inc VAT**; strip
> headline + CSV + PDF all carry gross. **Delivery/lead defaults:** `manufacturerTerms._default`
> = perSeat **£50** + **8–12 wks** (standard items sooner) until real figures. Material upcharge
> multiplies seat/armrest unit price. **PDF cover** now uses the **hero image** full-bleed with
> a scrim, **no price** (name + Prepared/Room/Layout/Lead-time chips only); page 2 has VAT rows +
> finishes. **Known gap:** per-material base pricing still flat (§7.2) and the +7% Avalon-type
> upcharge lives in `seating_range_materials` (not the view) so shows 0 — wire later.
> **Open:** per-row seat/finish overrides; curating the scraped manufacturer images (zips in
> ~/Downloads/images*.zip) → wire `hero_img` per range.


> **v0.5.0 — SSOT repoint + tool intro + gelled branding.**
> **Engine repoint (§7.1 done):** Tier-1 now reads the SSOT view **`v_seating_catalogue`**
> (anon SELECT ok) via `adaptSSOT()` (maps view rows → the engine's native range/item shape;
> materials from the `materials` jsonb, MSRP from `price_srp_from`, features inferred from
> style/labels). Legacy `furniture_*` kept as a fallback tier. Seed regenerated from the view
> (`data/seating-catalogue.js` → `__SEATING_SEED__.ssot_slim`, 214 rows). cacheKey bumped v2→v3.
> **Now surfaces all 68 ranges / 6 manufacturers** (was 26): adds Cinema Deco (priced) + full
> Fortress (POA) + Moovia/Cinelux/FrontRow. **Images:** only Cineca has them in the SSOT — the
> rest use the wordmark-fallback card until the Library files image URLs (contract §6).
> **Intro = tool, not website:** dropped the marketing sections + all "Book a consultation" CTAs;
> now a hero + numbered 4-step "how it works" with prominent **solid gold** CTAs (`.cta-lg.solid`)
> that flow into the wizard. Logo is **"Sonor"** only (dropped "Smart Homes"). **PDF cover** gained
> the purple ambience + gold/purple divider to gel with the app; "Smart Homes" removed there too.


> **v0.4.0 — luxury PDF proposal.** `data/seating-pdf.js` (`SeatingPdf.generate(model)`)
> builds a crisp **vector** A4 PDF with **pdf-lib** + embedded Gilroy (`@pdf-lib/fontkit`),
> gold-standard aligned in our cinema aesthetic: **Page 1** dark dramatic cover (house-mark,
> gold eyebrow, "Cinema Seating / Proposal", range + summary chips), **Page 2** cream
> specification + itemised quote (vector seating plan, products/delivery/total, lead time,
> terms, contact). Summary "Download PDF proposal" → `SeatingApp.savePdf()` (builds `pdfModel()`,
> falls back to `window.print()` if pdf-lib/CDN unavailable). pdf-lib + fontkit load from
> jsDelivr; fonts fetched from `data/fonts/*.otf` (same-origin on Pages).


> **v0.3.2 — whole-app consistency.** The wizard now shares the front-page/website
> design language end-to-end: **Gilroy** type (800 headings, 200 ultralight for large
> numerals) replacing Cormorant; website gold `#ad9978`/`#c8b48e` + `#8058a1` purple;
> flat dark buttons with gold hover (matching `.cta-lg`/site `.btn-p`). The header uses the
> **real Sonor house-mark SVG** (from the official logo components) + SONOR wordmark, not a
> text placeholder. Plan-SVG gold retuned to match. Cinema purple+gold luxury retained.


> **v0.3.0 — client-facing landing (deviation, this app only).** Unlike every other
> Sonor app, this one is customer-facing, so it **replaces the SonorShell chrome with a
> website-aligned header + intro/landing** modelled on sonor.co.uk. `#sonor-header` is
> hidden (SonorShell.mount is still called for version self-report + selfTest). The landing
> (`#intro`) uses the **website design tokens** — Gilroy type (bundled `data/fonts/*.otf`),
> muted gold `#ad9978` / `#c8b48e`, flat dark buttons w/ gold hover, ultralight `.lt`.
> `SeatingApp.enter()` hides the intro and reveals the `.sc` wizard (`#wizard`);
> `backToIntro()` returns. Hero image is one-line swappable via `config.heroImage`
> (currently `../venice-double-seats.png` at app root). The `.sc` wizard keeps its
> cinema-luxury look (Cormorant + gold/purple). Other apps are untouched.
>
> **v0.3.1 — delivery + lead time (per manufacturer).** `config.manufacturerTerms`
> (keyed by manufacturer name) holds Sonor's own delivery pricing + typical lead time —
> NOT catalogue data. `delivery.type` = `flat` (£/order) · `perSeat` (£×seats) · `band`
> (bands[] by order £); `leadWeeks:[min,max]`. Engine: `deliveryCost(mfr,{seats,orderTotal})`
> + `leadWeeks(mfr)`. Summary shows a Products subtotal, a **Delivery line folded into the
> ex-VAT total**, and a **Lead time** strip cell; CSV mirrors it. Any null/missing manufacturer
> → "confirmed at quotation" (nothing added to total). **Figures are placeholders (null)** —
> awaiting real per-manufacturer numbers. **SSOT-migrate** these to `seating_manufacturers`
> when the Library exposes them (contract §6).


> **⚠ READ `/SEATING-SSOT-CONTRACT.md` (workspace root) BEFORE any catalogue/schema/consumer work.**
> That file is the binding cross-session contract (Library ↔ Configurator ↔ WeQuote).
> After any such work, append a dated entry to its §8 Log in the same commit.
>
> **Spine version: 1.3** (SonorShell) · Repo: `sonor-seating` · Pages: https://sonorltd.github.io/sonor-seating/

## What this is
Customer-facing **cinema-seating configurator**. Data-driven, zero hardcoded catalogue.
Flow: **Layout → Choose Range → Configure → Summary**, MSRP-only (trade toggle deferred).
1. **Layout** — room width/length, rows, seats-per-row, preferences (reclining / daybed / sofa). Generic setup first.
2. **Choose Range** — ranked by **fit to the room** (width AND depth) with **constraint flags** ("won't fit 5-across in a 3m room", "no daybed in this range", "MSRP on request").
3. **Configure** — upholstery / colour / recline / add-ons; live MSRP.
4. **Summary** — MSRP quote + plan + CSV / print.

## SSOT (per `/SEATING-SSOT-CONTRACT.md` v2)
- **`seating_*` is the single source of truth**, Library-owned (only writer). This app is a
  **read-only consumer via views**. Prices live in `seating_prices` (item × material, ex VAT).
- **Target reads (once Library ships `v_seating_ranges`):** `v_seating_ranges` (range cards)
  + `v_seating_catalogue` (items × materials × `prices[]`).
- **Transitional (current):** the engine still reads `furniture_ranges` + `furniture_catalogue`
  (built by the v0.2.0 rebuild). These are being retired — see contract §6.7 / §7.1.
- **Nothing hardcoded** — catalogue changes are data-only. 4-tier load
  (Supabase → localStorage cache → bundled seed → empty); seed regenerated by `data/build-seed.sh`.

## Modules (keep modular — no monolith)
```
dashboard/sonor-seating.html   host: SonorShell chrome + luxury canvas + step skeleton
data/seating-config.js         window.__SEATING_CONFIG__ — flow rules/labels/clearances
data/seating-catalogue.js      window.__SEATING_SEED__ — Tier-2 offline snapshot (generated)
data/seating-engine.js         SonorSeating — SSOT load + item/price resolution
data/seating-recommend.js      SonorRecommend — fit scoring (width+depth) + constraint flags
data/seating-app.js            SeatingApp — wizard UI + plan SVG + export
data/build-seed.sh             regenerates the seed from the SSOT
```

## Brand
Sonor slate chrome (SonorShell) + a **scoped luxury dark-gold canvas** (`.sc` block) — a
documented Brand Override (deviates from SLATE-FIRST / S-4.1; raw hex confined to `.sc`,
`:root` untouched). Fonts: DM Sans/Mono (chrome) + Cormorant Garamond (canvas headings).

## Open work (contract §7 — configurator)
- ✅ §7.4 depth-fit in the recommender · §7.5 bug fixes (fit badge width+depth, upholstery
  hint, `planSVG` param, conservative `seatWidthMm`) · §7.7 this doc.
- ⏳ **Blocked on Library §6.3** (`v_seating_ranges` view): §7.1 repoint engine to the views
  + bump `cacheKey`; §7.2 **per-material pricing** from `v_seating_catalogue.prices[]` (the
  big quote-correctness fix — quotes must move when upholstery changes); §7.3 VAT ex-VAT;
  §7.6 verify Cineca to the penny vs `sonor-cineca`, then signal contract §6.7.

## Rules
1. Read the contract first; log after (§ protocol). Never edit the Library's app.
2. Consumer reads views only; never write catalogue tables.
3. No raw hex outside `.sc`; no hardcoded catalogue data.
4. Version bump = atomic (`/version-bump`); never hand-write `app_versions` (S-4.5).
5. New-app / first-publish + Pages: see git-push skill **Scenario F**.
