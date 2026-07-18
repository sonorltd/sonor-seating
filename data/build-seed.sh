#!/usr/bin/env bash
# Regenerate data/seating-catalogue.js from the Library SSOT (v_seating_catalogue + seating_material_colours).
# Produces window.__SEATING_SEED__ = { ssot_slim: [...], colours: {material_id: [{n,h,i}]} }
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
URL="https://ysmvklstkzodlocttspy.supabase.co/rest/v1"
KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzbXZrbHN0a3pvZGxvY3R0c3B5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3Njc0OTMsImV4cCI6MjA4OTM0MzQ5M30.08kRS_dtbwz0rSYezNGMJHnOU_st8GKZseQPefcMEMc"
T="$(mktemp -d)"
curl -s "$URL/v_seating_catalogue?select=*&order=range_sort,item_sort" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -o "$T/v.json"
curl -s "$URL/seating_material_colours?select=material_id,name,hex,sort_order,metadata&order=material_id,sort_order" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -o "$T/c.json"
python3 - "$T" "$HERE/seating-catalogue.js" <<'PY'
import json, sys, datetime
T, out = sys.argv[1], sys.argv[2]
rows = json.load(open(T + '/v.json')); cols = json.load(open(T + '/c.json'))
def slim(r):
    d = {'ii': r.get('item_id'), 'it': r.get('item_type'), 'nm': r.get('item_name'), 'sz': r.get('size_label'),
         'mo': r.get('motor_type'), 'is': r.get('item_sort'), 'im': r.get('item_metadata') or {},
         'mf': r.get('manufacturer_name'), 'ms': r.get('manufacturer_slug'), 'rid': r.get('range_id'),
         'rn': r.get('range_name'), 'rt': r.get('range_tagline'), 'hi': r.get('hero_img'), 'ti': r.get('thumb_img'),
         'sw': r.get('seat_width_cm'), 'rd': r.get('reclined_depth_cm'), 'sd': r.get('seat_depth_cm'),
         'wc': r.get('wall_clearance_mm'), 're': r.get('range_enabled'), 'rs': r.get('range_sort'),
         'rc': r.get('range_config'), 'rmeta': r.get('range_metadata'), 'pf': r.get('price_srp_from'),
         'mat': r.get('materials')}
    return {k: v for k, v in d.items() if v is not None}
cm = {}
for c in cols:
    e = {'n': c['name'], 'h': c.get('hex')}
    img = (c.get('metadata') or {}).get('swatch_img')
    if img: e['i'] = img
    cm.setdefault(c['material_id'], []).append(e)
seed = {'ssot_slim': [slim(r) for r in rows], 'colours': cm}
body = json.dumps(seed, separators=(',', ':'), ensure_ascii=False)
today = datetime.date.today().isoformat()
open(out, 'w').write("/* Sonor Seating Configurator — Tier-2 offline seed (Library SSOT snapshot). Source: v_seating_catalogue " + today + ". Regenerate: data/build-seed.sh */\n(function(){ window.__SEATING_SEED__ = " + body + "; })();\n")
print('wrote', out, '-', len(rows), 'items,', sum(len(v) for v in cm.values()), 'colours')
PY
rm -rf "$T"; node --check "$HERE/seating-catalogue.js" && echo "seed regenerated"
