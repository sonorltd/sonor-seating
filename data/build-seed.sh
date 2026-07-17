#!/usr/bin/env bash
# Regenerate data/seating-catalogue.js from the Library SSOT (furniture_ranges + furniture_catalogue).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
URL="https://ysmvklstkzodlocttspy.supabase.co/rest/v1"
KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzbXZrbHN0a3pvZGxvY3R0c3B5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3Njc0OTMsImV4cCI6MjA4OTM0MzQ5M30.08kRS_dtbwz0rSYezNGMJHnOU_st8GKZseQPefcMEMc"
T="$(mktemp -d)"
curl -s "$URL/furniture_ranges?select=*&order=sort_order" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -o "$T/r.json"
curl -s "$URL/furniture_catalogue?select=*&order=sort_order" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -o "$T/c.json"
python3 - "$T" "$HERE/seating-catalogue.js" <<'PY'
import json,sys
T,out=sys.argv[1],sys.argv[2]
ranges=json.load(open(T+'/r.json')); cat=json.load(open(T+'/c.json'))
def sr(r): return {k:r.get(k) for k in ['id','manufacturer','name','style','description','hero_img','thumb_img','product_url','capability','pricing_from','materials','finishes','sort_order','enabled','metadata']}
def si(i): return {k:i.get(k) for k in ['id','range_id','label','furniture_type','width_mm','depth_mm','height_mm','finish','supplier','sku','cost_price_gbp','sell_price_gbp','margin_pct','metadata','sort_order','enabled']}
seed={'ranges':[sr(r) for r in ranges],'catalogue':[si(i) for i in cat]}
body=json.dumps(seed,separators=(',',':'),ensure_ascii=False)
open(out,'w').write("/* Sonor Seating Configurator — Tier-2 offline seed (Library SSOT snapshot). Regenerate: data/build-seed.sh */\n"+f"(function(){{ window.__SEATING_SEED__ = {body}; }})();\n")
print('wrote',out)
PY
rm -rf "$T"; node --check "$HERE/seating-catalogue.js" && echo "seed regenerated"
