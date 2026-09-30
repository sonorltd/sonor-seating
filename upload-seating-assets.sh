#!/usr/bin/env bash
# Upload seating image assets into the Supabase Storage bucket `seating-assets`,
# then the SSOT hero_img local paths become public URLs (run the SQL below after).
# RUN FROM: APP - Seating Configurator (has range-assets/ + cineca-assets/).
# NEEDS: SUPABASE_SERVICE_ROLE_KEY env var (service_role key, NOT anon) + network.
set -euo pipefail
PROJECT="ysmvklstkzodlocttspy"
BUCKET="seating-assets"
BASE="https://${PROJECT}.supabase.co/storage/v1/object/${BUCKET}"
: "${SUPABASE_SERVICE_ROLE_KEY:?export SUPABASE_SERVICE_ROLE_KEY first (Supabase dashboard → Project settings → API → service_role)}"
cd "$(dirname "$0")"   # 2026-09-30 moved from workspace root into the app folder (root sweep)
upload_dir() {
  local dir="$1"
  [ -d "$dir" ] || { echo "skip (no dir): $dir"; return; }
  for f in "$dir"/*; do
    [ -f "$f" ] || continue
    name="$(basename "$f")"
    ct="image/jpeg"; case "$name" in *.png) ct=image/png;; *.webp) ct=image/webp;; *.pdf) ct=application/pdf;; esac
    echo -n "→ $name … "
    curl -s -X POST "${BASE}/${name}" \
      -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
      -H "Content-Type: ${ct}" -H "x-upsert: true" \
      --data-binary "@${f}" >/dev/null && echo "ok  → ${BASE//\/object\//\/object\/public\/}/${name}"
  done
}
upload_dir "range-assets"
upload_dir "cineca-assets"
echo
echo "DONE. Now run the path-swap SQL in Supabase (or via the Library MCP):"
cat <<'SQL'
  UPDATE seating_ranges
  SET hero_img  = replace(hero_img,  'range-assets/', 'https://ysmvklstkzodlocttspy.supabase.co/storage/v1/object/public/seating-assets/'),
      thumb_img = replace(thumb_img, 'range-assets/', 'https://ysmvklstkzodlocttspy.supabase.co/storage/v1/object/public/seating-assets/'),
      metadata  = metadata - '_img_needs_hosting'
  WHERE hero_img LIKE 'range-assets/%';
SQL
