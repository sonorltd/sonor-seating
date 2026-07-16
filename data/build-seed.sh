#!/usr/bin/env bash
# build-seed.sh — regenerate data/seating-catalogue.js (Tier-2 offline snapshot)
# from the live seating_* Supabase tables. Run after any catalogue data change.
#
# Usage:  bash data/build-seed.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
URL="https://ysmvklstkzodlocttspy.supabase.co/rest/v1"
KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzbXZrbHN0a3pvZGxvY3R0c3B5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3Njc0OTMsImV4cCI6MjA4OTM0MzQ5M30.08kRS_dtbwz0rSYezNGMJHnOU_st8GKZseQPefcMEMc"
TABLES=(manufacturers ranges materials material_colours range_materials items prices finish_options)
TMP="$(mktemp -d)"
for t in "${TABLES[@]}"; do
  curl -s "$URL/seating_$t?select=*" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -o "$TMP/$t.json"
done
python3 - "$TMP" "$HERE/seating-catalogue.js" <<'PY'
import json, sys, datetime
tmp, out = sys.argv[1], sys.argv[2]
tables=['manufacturers','ranges','materials','material_colours','range_materials','items','prices','finish_options']
seed={t: json.load(open(f'{tmp}/{t}.json')) for t in tables}
body=json.dumps(seed, separators=(',',':'), ensure_ascii=False)
counts=' '.join(f'{t.capitalize()}:{len(seed[t])}' for t in ['manufacturers','ranges','materials','items','prices'])
open(out,'w').write(
"/* Sonor Seating Configurator — Tier-2 offline catalogue seed\n"
"   window.__SEATING_CATALOGUE_SEED__\n"
"   Auto-generated snapshot of the seating_* Supabase tables (data/build-seed.sh).\n"
f"   {counts}\n"
"*/\n"
"(function(){\n"
f"  window.__SEATING_CATALOGUE_SEED__ = {body};\n"
"})();\n")
print('wrote', out)
PY
rm -rf "$TMP"
node --check "$HERE/seating-catalogue.js" && echo "seating-catalogue.js regenerated + valid"
