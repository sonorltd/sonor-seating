# Seating Configurator — Claude Code Context (v0.1.0)

> **Spine version: 1.3** (SONOR-APP-SPINE.md §21 / S-4.21 — SonorShell mounted)
> Inherits: `../CLAUDE.md` (master brand rules + cross-project references)
> Brand source: `../Branding - CORE/brand-core.xml` (chrome) + scoped luxury override (canvas)
> Repo: `sonor-seating` · Hosted: https://sonorltd.github.io/sonor-seating/

## What this is

Internal **multi-manufacturer** cinema-seating configurator (trade tool). A 5-step
wizard — **Manufacturer → Range → Upholstery → Build → Summary** — that produces a
quote-ready spec with SKUs and trade/SRP totals. Unlike the customer-facing
`sonor-cineca` sub-brand app (single brand, hardcoded ranges), this app is fully
**data-driven**: every option (ranges, upholstery, colours, motor packages,
accessories, sizes) comes from the `seating_*` Supabase tables. A new manufacturer
or range is **new data, zero code**.

**Relationship to `sonor-cineca`:** completely separate app, own repo + Master Hub
card. Cineca is simply **manufacturer #1** in this library (migrated from the
`cineca_*` tables, which are left untouched and still power the live Cineca app).
More manufacturers will be added as a separate project.

## Data model (Supabase, `seating_*` — additive, never touches `cineca_*`)

| Table | Role |
|-------|------|
| `seating_manufacturers` | brands (id, name, logo_url, blurb, accent_hex) |
| `seating_ranges` | ranges per manufacturer + **`config` jsonb** (default/min/max seats, seat_width_mm, plan_dims) |
| `seating_materials` | upholstery per manufacturer (group, tier, swatch_hex, upcharge) |
| `seating_material_colours` | colourways per material |
| `seating_range_materials` | which materials a range allows (**captures "Como = Borium leather only"**) |
| `seating_items` | seats / armrests / accessories (range_id, motor_type, size_label, is_universal) |
| `seating_prices` | per item × material (sku, trade, srp) |
| `seating_finish_options` | finish add-ons per manufacturer |

Standard RLS (anon SELECT/INSERT/UPDATE, no DELETE), `metadata jsonb`, cascading FKs.

**Per-range "flip" is pure data:** the wizard reads `seating_range_materials`
(allowed upholstery), the seat items' `motor_type` set (motor packages), and the
range/universal accessory items — so Milan shows fixed/1-motor, Amalfi 2-motor only,
Como gets chaise/corner + leather lockout, Modena gets S/M/W + ottomans, with no
per-range branches in code.

## Architecture

Single-page dashboard app (vanilla) per Spine §1, SonorShell chrome (S-4.21).
- `dashboard/sonor-seating.html` — host: Sonor slate chrome + scoped luxury canvas + wizard skeleton.
- `data/seating-config.js` — `window.__SEATING_CONFIG__` (step labels, UI rules).
- `data/seating-catalogue.js` — `window.__SEATING_CATALOGUE_SEED__` (Tier-2 offline snapshot; regen with `data/build-seed.sh`).
- `data/seating-engine.js` — `SonorSeating` data layer: **4-tier load** (Supabase → localStorage cache → bundled seed → inline), per-range resolvers, quantity + pricing.
- `data/seating-app.js` — `SeatingApp` wizard UI + seating-plan SVG + export (CSV / Copy SKUs / print).

Data source: **Supabase** (via shared `SonorDB.client`, `supabase:false` shell mode — the app owns its data engine).

## Brand

- **Chrome:** Sonor slate (`data-theme="slate"`) via SonorShell — Sonor header, version badge, Cmd-K, source toggle. Manufacturer logos surface **only** at Step 1 and in the post-selection context strip (never as the app's own brand).
- **Fonts:** DM Sans + DM Mono (chrome) · Cormorant Garamond + Georgia (luxury canvas headings).

## Brand Overrides (preserved on brand regen)

- **Luxury configurator canvas** — deviates from **SLATE-FIRST LAW** and **S-4.1**
  (no raw hex): the `.seating-cfg` block defines a scoped dark gold/cream palette
  (`--sc-*`) with raw hex, confined entirely to that block — it never touches
  `:root`, so the rest of the app stays on brand tokens. Rationale: the brief is
  "keep the Cineca luxury look, Sonor branding only." The premium visual surface is
  a deliberate value proposition, mirroring how `sonor-cineca` documents the same
  deviation. SVG seating-plan colours (cinema purple / gold) are likewise scoped
  drawing content, not theme tokens.

## Adding a manufacturer / range (data only)

1. `INSERT` a `seating_manufacturers` row (logo_url, accent_hex).
2. `INSERT` `seating_ranges` (+ `config` jsonb), `seating_materials`, `seating_material_colours`, `seating_range_materials`, `seating_items`, `seating_prices`, `seating_finish_options`.
3. `bash data/build-seed.sh` to refresh the Tier-2 offline snapshot.
No app code changes — the wizard adapts automatically.

## Development rules

1. Version bump = atomic (`/version-bump` skill); never hand-write `app_versions` (S-4.5).
2. No raw hex outside the documented `.seating-cfg` override (S-4.1).
3. New persistent data → `seating_*` Supabase table first (S-4.8).
4. Shared `data/` files are SYNCED — edit workspace-root masters + `sync-everything.sh` (S-4.2).
5. Never edit the `cineca_*` tables or `sonor-cineca` app from here — additive only.
6. Regenerate `data/seating-catalogue.js` after any catalogue data change.

## Verification checklist

- [ ] Boots with no console errors; SonorShell self-test passes; version badge = live `app_versions`.
- [ ] Manufacturer → Range → Upholstery → Build → Summary flow completes; quote table + plan SVG render.
- [ ] Per-range correctness: Milan fixed/1-motor · Amalfi 2-motor only · Como chaise/corner + no non-Borium leather · Modena ottomans/S-M-W.
- [ ] Pricing matches the live Cineca app for identical selections (to the penny).
- [ ] 4-tier fallback: block network → bundled seed renders the same catalogue.
- [ ] CSV export + Copy SKUs + Print produce correct output.
