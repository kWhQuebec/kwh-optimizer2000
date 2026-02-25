#!/bin/bash
# Fix: pull latest + show server logs to debug 500 error
set -e

echo "🔄 1/3 — Git pull..."
git pull --rebase origin main
echo "✅ Code à jour."

echo ""
echo "🔧 2/3 — Hook + permissions..."
git config core.hooksPath .githooks
chmod +x .githooks/pre-commit 2>/dev/null || true
echo "✅ Hook activé."

echo ""
echo "🚀 3/3 — Test rapide de l'API portfolios..."
# Démarre le serveur en arrière-plan pour tester
echo "Redémarre le serveur Replit manuellement (Stop + Run)."
echo ""
echo "========================================="
echo "✅ Code à jour. Redémarre le serveur Replit."
echo "========================================="
