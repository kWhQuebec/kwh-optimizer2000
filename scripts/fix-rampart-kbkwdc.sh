#!/bin/bash
# One-shot fix: reset kbKwDc/kbPanelCount for 3 Rampart sites at 1305 Industrielle
# These received incorrect values via the polygon-sharing bug (now fixed in T001)

API_BASE="${API_BASE:-https://kwh-optimizer2000.replit.app}"

if [ -z "$TOKEN" ]; then
  echo "Usage: TOKEN=your_jwt_token ./scripts/fix-rampart-kbkwdc.sh"
  echo "  Optional: API_BASE=http://localhost:5000 for local dev"
  exit 1
fi

SITES=(
  "0758f7ee:G4AE0056067"
  "d026b5e3:G4AE0056082"
  "b426d015:G4AE0056083"
)

for entry in "${SITES[@]}"; do
  ID="${entry%%:*}"
  LABEL="${entry##*:}"
  echo -n "Resetting kbKwDc/kbPanelCount for $LABEL ($ID)... "
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
done

echo "Done. Open each site in the app — RoofVisualization will recalculate kbKwDc from polygons."
