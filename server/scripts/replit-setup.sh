#!/bin/bash
# =============================================================
# Script de setup Replit — à exécuter une seule fois après git pull
# Usage: bash server/scripts/replit-setup.sh
# =============================================================

set -e

echo "🔄 1/4 — Git pull (derniers changements)..."
git pull --rebase origin main
echo "✅ Code à jour."

echo ""
echo "🔧 2/4 — Activation du hook pre-commit (auto-sync)..."
git config core.hooksPath .githooks
chmod +x .githooks/pre-commit
echo "✅ Hook activé."

echo ""
echo "🗃️  3/4 — Reset kbKwDc des 3 sites Rampart..."
npx tsx server/scripts/resetKbKwDc.ts
echo "✅ Sites Rampart corrigés."

echo ""
echo "🔑 4/4 — Token Claude Code..."
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyMGQzOGUzZS02NzQzLTRkZWUtOWMzOC0wMzRjOGVjZjViNzUiLCJpYXQiOjE3NzE1Mzg4NDksImV4cCI6MTc3MjE0MzY0OX0.6rjxCB66jxVO1Vgt-LGiEepZbpLNCZ6xmwogHjbGvHY"
export TOKEN
echo "✅ Token exporté (expire 27 fév 2026)."
echo "   ⚠️  Note: ce export est valide pour cette session shell seulement."
echo "   Pour Claude Code, ajoute dans le .env ou lance-le depuis ce terminal."

echo ""
echo "========================================="
echo "✅ TOUT EST PRÊT."
echo "========================================="
echo ""
echo "Prochaine étape: redémarre le serveur Replit (Stop + Run)"
echo "Le Master Agreement Dream RFP devrait apparaître après restart."
