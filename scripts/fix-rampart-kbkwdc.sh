#!/bin/bash
# One-shot fix: delete copied polygons + reset kbKwDc/kbPanelCount for 3 Rampart sites at 1305 Industrielle
# These received incorrect values via the polygon-sharing bug (now fixed)
#
# The script deletes all roof polygons then resets kbKwDc/kbPanelCount to null.
# On next load, the new confirmation dialog (Fix 1) will ask before re-copying.

API_BASE="${API_BASE:-https://kwhoptimizer.replit.app}"

if [ -z "$TOKEN" ]; then
  echo "Usage: TOKEN=your_jwt_token ./scripts/fix-rampart-kbkwdc.sh"
  echo "  Optional: API_BASE=http://localhost:5000 for local dev"
  echo ""
  echo "To get the full site UUIDs, run in the app or query the API:"
  echo '  curl -s -H "Authorization: Bearer $TOKEN" "$API_BASE/api/sites" | jq ".[] | select(.name | test(\"G4AE005606|G4AE005608\")) | {id, name}"'
  exit 1
fi

SITES=(
  "0758f7ee-c41b-4a32-8d04-fd6da5886091:G4AE0056067"
  "d026b5e3-43a1-45da-b6db-fda637044ddb:G4AE0056082"
  "b426d015-2f42-43fb-a4db-101bb1e35199:G4SH0004983"
)

for entry in "${SITES[@]}"; do
  ID="${entry%%:*}"
  LABEL="${entry##*:}"

  echo "=== $LABEL ($ID) ==="

  # Step 1: Delete all copied roof polygons
  echo -n "  Deleting roof polygons... "
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X DELETE "$API_BASE/api/sites/$ID/roof-polygons" \
    -H "Authorization: Bearer $TOKEN")
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "204" ]; then
    echo "OK"
  else
    echo "FAILED (HTTP $HTTP_CODE) — may not have a bulk delete endpoint, try manual cleanup"
  fi

  # Step 2: Reset kbKwDc and kbPanelCount to null
  echo -n "  Resetting kbKwDc/kbPanelCount... "
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X PATCH "$API_BASE/api/sites/$ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"kbKwDc": null, "kbPanelCount": null}')
  if [ "$HTTP_CODE" = "200" ]; then
    echo "OK"
  else
    echo "FAILED (HTTP $HTTP_CODE)"
  fi

  echo ""
done

echo "Done. Open each site in the app — the confirmation dialog will ask before copying polygons from siblings."
