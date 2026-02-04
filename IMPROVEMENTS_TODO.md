# Améliorations PDF/PPTX - À implémenter

## ✅ FAIT: Taille dynamique des KPIs
La ligne 149 de pdfGenerator.ts a été modifiée pour ajuster la taille de police selon la longueur de la valeur.

## 🔲 À FAIRE:

### 1. Logos (pdfGenerator.ts lignes 511-514)
**Problème:** Le logo actuel n'est pas toujours visible sur tous les fonds.
**Solution:** Utiliser les logos PNG avec transparence:
- FR: kWh_Quebec_Logo-01_1764778562811.png
- EN: kwh_logo_color_en.png

### 2. Section Références (pdfGenerator.ts)
**Problème:** Aucune mention du portfolio, des 15+ ans d'expérience, des 120 MW installés.
**Solution:** Ajouter une nouvelle page avant la fin du PDF avec:
- Stats: 15+ années | 120 MW installés | 25+ projets C&I
- Témoignage: "Le ROI prévu s'est avéré exact à 2% près"
- CTA: info@kwh.quebec | www.kwh.quebec

### 3. Numérotation des pages (pdfTemplates.ts)
**Problème:** Pas de numéros de page.
**Solution:** Ajouter "Page X / Y" dans le footer de chaque page.

### 4. Slide Références PPTX (pptxGenerator.ts)
**Problème:** Seulement 5 slides, pas de mention des réalisations.
**Solution:** Ajouter une slide "Ils nous font confiance" avec:
- Stats visuelles
- Témoignage
- Logos partenaires (si disponibles)

### 5. Montants Design Agreement
**Problème:** Montants fixes hardcodés (180$, 3500$, 9000$).
**Solution:** Externaliser dans un fichier config ou utiliser les prix du catalogue.

## Fichiers concernés:
- server/pdfGenerator.ts
- server/pptxGenerator.ts
- server/pdfTemplates.ts
- server/routes/designs.ts
