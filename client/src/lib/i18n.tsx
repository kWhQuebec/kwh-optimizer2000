import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

type Language = "fr" | "en";

interface Translations {
  [key: string]: {
    fr: string;
    en: string;
  };
}

const translations: Translations = {
  // Sidebar
  "sidebar.main": { fr: "Principal", en: "Main" },
  "sidebar.analysis": { fr: "Analyse & Design", en: "Analysis & Design" },
  "sidebar.admin": { fr: "Administration", en: "Administration" },
  "sidebar.portal": { fr: "Portail client", en: "Client Portal" },

  // Navigation
  "nav.home": { fr: "Accueil", en: "Home" },
  "nav.login": { fr: "Connexion", en: "Login" },
  "nav.logout": { fr: "Déconnexion", en: "Logout" },
  "nav.dashboard": { fr: "Tableau de bord", en: "Dashboard" },
  "nav.clients": { fr: "Clients", en: "Clients" },
  "nav.sites": { fr: "Sites", en: "Sites" },
  "nav.analyses": { fr: "Analyses", en: "Analysis" },
  "nav.designs": { fr: "Designs", en: "Designs" },
  "nav.catalog": { fr: "Catalogue", en: "Catalog" },
  "nav.methodology": { fr: "Méthodologie", en: "Methodology" },
  "nav.userManagement": { fr: "Gestion des utilisateurs", en: "User Management" },
  "nav.userSites": { fr: "Sites utilisateur", en: "User Sites" },
  "nav.mySites": { fr: "Mes sites", en: "My Sites" },

  // Landing Page - Hero
  "landing.hero.title": { fr: "Un investissement rentable maintenant pour votre organisation, et pour les générations futures", en: "A Profitable Investment Now for Your Organization, And for Future Generations" },
  "landing.hero.subtitle": { fr: "Système solaire + stockage clé en main, optimisé pour les immeubles commerciaux et industriels du Québec", en: "Turnkey solar + storage systems, optimized for commercial and industrial buildings in Québec" },
  "landing.hero.description": { 
    fr: "Nous concevons, installons et gérons des systèmes solaires et de stockage pour les bâtiments commerciaux et industriels du Québec. Analyse gratuite en 48h.", 
    en: "We design, install, and manage solar and storage systems for commercial and industrial buildings in Québec. Free analysis in 48h." 
  },
  "landing.hero.cta": { fr: "Obtenir mon analyse gratuite", en: "Get my free analysis" },
  "landing.hero.ctaSecondary": { fr: "Accès client", en: "Client access" },
  
  // Landing Page - Why Now Section
  "landing.whyNow.title": { fr: "Pourquoi maintenant?", en: "Why now?" },
  "landing.whyNow.subtitle": { fr: "Le Québec vit une transformation énergétique historique", en: "Québec is experiencing a historic energy transformation" },
  "landing.whyNow.hqPlan.title": { fr: "Programme Hydro-Québec", en: "Hydro-Québec Program" },
  "landing.whyNow.hqPlan.description": { fr: "Nouvelle limite d'autoproduction de 1 000 kW", en: "New 1,000 kW self-generation limit" },
  "landing.whyNow.tender.title": { fr: "Rabais HQ 40%", en: "HQ 40% Rebate" },
  "landing.whyNow.tender.description": { fr: "Jusqu'à 1 000$/kW sur l'installation solaire", en: "Up to $1,000/kW on solar installation" },
  "landing.whyNow.rebate.title": { fr: "Crédit fédéral 30%", en: "Federal 30% Credit" },
  "landing.whyNow.rebate.description": { fr: "Crédit d'impôt pour technologies propres", en: "Clean technology investment tax credit" },
  "landing.whyNow.federal.title": { fr: "Mesurage net", en: "Net Metering" },
  "landing.whyNow.federal.description": { fr: "Vendez vos surplus à Hydro-Québec", en: "Sell your surplus to Hydro-Québec" },
  "landing.whyNow.deadline": { fr: "Ces incitatifs peuvent changer à tout moment", en: "These incentives can change at any time" },
  
  // Landing Page - Process Steps (5 steps)
  "landing.step1.title": { fr: "Analyse du toit", en: "Roof Analysis" },
  "landing.step1.description": { 
    fr: "Obtenez en quelques secondes une estimation du potentiel solaire et de la taille PV optimale pour votre bâtiment.", 
    en: "Get a solar potential estimate and optimal PV size for your building within seconds." 
  },
  "landing.step1.time": { fr: "Quelques secondes", en: "Within seconds" },
  "landing.step2.title": { fr: "Procuration HQ", en: "HQ Proxy" },
  "landing.step2.description": { 
    fr: "Signez la procuration Hydro-Québec pour nous permettre d'accéder à votre profil de consommation et obtenir une analyse détaillée.", 
    en: "Sign the Hydro-Québec proxy to let us access your consumption profile and get a detailed analysis." 
  },
  "landing.step2.time": { fr: "Signature électronique", en: "E-signature" },
  "landing.step3.title": { fr: "Analyse détaillée", en: "Detailed Analysis" },
  "landing.step3.description": { 
    fr: "Simulation 8 760h de votre système solaire + stockage optimal qui maximise votre retour sur investissement.", 
    en: "8,760h simulation of your optimal solar + storage system that maximizes your ROI." 
  },
  "landing.step3.time": { fr: "48h", en: "48h" },
  "landing.step4.title": { fr: "Visite et devis", en: "Site Visit & Quote" },
  "landing.step4.description": { 
    fr: "Visite sur site, dessins techniques et soumission à prix fixe pour votre projet.", 
    en: "On-site visit, technical drawings and fixed price quote for your project." 
  },
  "landing.step4.time": { fr: "~1 semaine", en: "~1 week" },
  "landing.step5.title": { fr: "Construction et O&M", en: "Construction & O&M" },
  "landing.step5.description": { 
    fr: "Installation clé en main et opération & maintenance continue pour maximiser la performance.", 
    en: "Turnkey installation and ongoing operation & maintenance to maximize performance." 
  },
  "landing.step5.time": { fr: "Clé en main", en: "Turnkey" },

  // Landing Page - Process
  "landing.process.title": { fr: "Notre processus", en: "Our Process" },
  "landing.process.subtitle": { 
    fr: "De l'analyse du toit à l'installation clé en main", 
    en: "From roof analysis to turnkey installation" 
  },
  "landing.process.youAreHere": { fr: "Commencez ici", en: "Start here" },
  "landing.process.nextSteps": { fr: "Prochaines étapes", en: "Next steps" },
  "landing.step1.highlight": { 
    fr: "Obtenez votre estimation en quelques secondes - c'est gratuit et sans engagement.", 
    en: "Get your estimate in seconds - it's free with no commitment." 
  },
  
  // Landing Page - Benefits
  "landing.benefits.title": { fr: "Ce que vous obtenez", en: "What you get" },
  "landing.benefits.subtitle": { fr: "Une approche complète pour votre projet solaire", en: "A complete approach for your solar project" },
  "landing.benefits.analysis": { fr: "Analyse personnalisée", en: "Personalized analysis" },
  "landing.benefits.analysisDesc": { fr: "Simulation 8 760h basée sur vos données réelles", en: "8,760h simulation based on your real data" },
  "landing.benefits.financial": { fr: "Projections financières", en: "Financial projections" },
  "landing.benefits.financialDesc": { fr: "ROI, VAN, TRI sur 25 ans avec tous les incitatifs", en: "ROI, NPV, IRR over 25 years with all incentives" },
  "landing.benefits.design": { fr: "Design détaillé", en: "Detailed design" },
  "landing.benefits.designDesc": { fr: "Liste de matériaux et devis complet", en: "Bill of materials and complete quote" },
  "landing.benefits.installation": { fr: "Installation clé en main", en: "Turnkey installation" },
  "landing.benefits.installationDesc": { fr: "Ingénierie, fourniture et construction", en: "Engineering, procurement and construction" },
  
  // Landing Page - Trust
  "landing.trust.title": { fr: "Pourquoi nous faire confiance", en: "Why trust us" },
  "landing.trust.certified": { fr: "Partenaire Hydro-Québec", en: "Hydro-Québec partner" },
  "landing.trust.experience": { fr: "Expertise C&I au Québec", en: "C&I expertise in Québec" },
  "landing.trust.datadriven": { fr: "Analyse basée sur les données", en: "Data-driven analysis" },
  "landing.trust.partners": { fr: "Nous travaillons avec Hydro-Québec", en: "We work with Hydro-Québec" },
  "landing.trust.partner.hq": { fr: "Hydro-Québec - Programme d'autoproduction", en: "Hydro-Québec - Self-generation program" },
  "landing.trust.partner.hqDesc": { fr: "Accès aux tarifs d'autoproduction et rabais dédiés", en: "Access to self-generation rates and dedicated rebates" },
  
  // Landing Page - Form
  "landing.form.title": { fr: "Estimez le potentiel de votre toiture", en: "Estimate your roof potential" },
  "landing.form.subtitle": { 
    fr: "Recevez une estimation gratuite du potentiel solaire de votre bâtiment par courriel.", 
    en: "Receive a free solar potential estimate for your building by email." 
  },
  "landing.form.benefit1.title": { fr: "Estimation rapide", en: "Quick estimate" },
  "landing.form.benefit1.description": { fr: "Potentiel de votre toiture en quelques minutes", en: "Your roof potential in just minutes" },
  "landing.form.benefit2.title": { fr: "Suivi personnalisé", en: "Personal follow-up" },
  "landing.form.benefit2.description": { fr: "Un conseiller vous accompagne pour la suite", en: "An advisor guides you through next steps" },
  "landing.form.benefit3.title": { fr: "Sans engagement", en: "No commitment" },
  "landing.form.benefit3.description": { fr: "Estimation gratuite et sans obligation", en: "Free estimate with no obligation" },
  "landing.form.privacy": { 
    fr: "En soumettant ce formulaire, vous acceptez notre politique de confidentialité.", 
    en: "By submitting this form, you accept our privacy policy." 
  },
  "landing.form.select": { fr: "Sélectionner...", en: "Select..." },
  
  // Landing Page - Hero Stats (service-focused)
  "landing.hero.stat1.value": { fr: "Gratuit", en: "Free" },
  "landing.hero.stat1.label": { fr: "Analyse détaillée", en: "Detailed analysis" },
  "landing.hero.stat2.value": { fr: "48h", en: "48h" },
  "landing.hero.stat2.label": { fr: "Délai de réponse", en: "Response time" },
  "landing.hero.stat3.value": { fr: "0 $", en: "$0" },
  "landing.hero.stat3.label": { fr: "Sans engagement", en: "No obligation" },
  "landing.hero.stat4.value": { fr: "Clé en main", en: "Turnkey" },
  "landing.hero.stat4.label": { fr: "Installation EPC", en: "EPC Installation" },
  
  // Landing Page - Footer
  "landing.footer.tagline": { fr: "Accélérez votre transition énergétique", en: "Accelerate your energy transition" },

  // Lead Form
  "form.company": { fr: "Nom de l'entreprise", en: "Company name" },
  "form.contact": { fr: "Nom du contact", en: "Contact name" },
  "form.email": { fr: "Courriel", en: "Email" },
  "form.phone": { fr: "Téléphone", en: "Phone" },
  "form.streetAddress": { fr: "Adresse du bâtiment", en: "Building address" },
  "form.city": { fr: "Ville", en: "City" },
  "form.province": { fr: "Province", en: "Province" },
  "form.postalCode": { fr: "Code postal", en: "Postal code" },
  "form.monthlyBill": { fr: "Facture mensuelle moyenne ($)", en: "Average monthly bill ($)" },
  "form.buildingType": { fr: "Type de bâtiment", en: "Building type" },
  "form.buildingType.industrial": { fr: "Industriel", en: "Industrial" },
  "form.buildingType.commercial": { fr: "Commercial", en: "Commercial" },
  "form.buildingType.institutional": { fr: "Institutionnel", en: "Institutional" },
  "form.buildingType.other": { fr: "Autre", en: "Other" },
  "form.notes": { fr: "Commentaires / Particularités", en: "Comments / Notes" },
  "form.submit": { fr: "Obtenir une analyse préliminaire", en: "Get a preliminary analysis" },
  "form.submitting": { fr: "Envoi en cours...", en: "Submitting..." },
  "form.success.title": { fr: "Merci!", en: "Thank you!" },
  "form.success.message": { 
    fr: "Nous analysons le potentiel de votre toiture. Vous recevrez un courriel avec votre estimation sous peu.", 
    en: "We are analyzing your roof potential. You will receive an email with your estimate shortly." 
  },
  "form.required": { fr: "Ce champ est requis", en: "This field is required" },
  "form.invalidEmail": { fr: "Courriel invalide", en: "Invalid email" },

  // Login
  "login.title": { fr: "Connexion", en: "Login" },
  "login.email": { fr: "Courriel", en: "Email" },
  "login.password": { fr: "Mot de passe", en: "Password" },
  "login.submit": { fr: "Se connecter", en: "Sign in" },
  "login.error": { fr: "Identifiants invalides", en: "Invalid credentials" },

  // Dashboard
  "dashboard.title": { fr: "Tableau de bord", en: "Dashboard" },
  "dashboard.totalSites": { fr: "Sites totaux", en: "Total Sites" },
  "dashboard.activeAnalyses": { fr: "Analyses actives", en: "Active Analyses" },
  "dashboard.totalSavings": { fr: "Économies totales", en: "Total Savings" },
  "dashboard.co2Avoided": { fr: "CO₂ évité", en: "CO₂ Avoided" },
  "dashboard.recentActivity": { fr: "Activité récente", en: "Recent Activity" },

  // Clients
  "clients.title": { fr: "Clients", en: "Clients" },
  "clients.add": { fr: "Ajouter un client", en: "Add client" },
  "clients.name": { fr: "Nom", en: "Name" },
  "clients.contact": { fr: "Contact principal", en: "Main contact" },
  "clients.sites": { fr: "Sites", en: "Sites" },
  "clients.empty": { fr: "Aucun client", en: "No clients" },
  "clients.emptyDescription": { fr: "Créez votre premier client pour commencer.", en: "Create your first client to get started." },

  // Sites
  "sites.title": { fr: "Sites", en: "Sites" },
  "sites.add": { fr: "Ajouter un site", en: "Add site" },
  "sites.name": { fr: "Nom du site", en: "Site name" },
  "sites.address": { fr: "Adresse", en: "Address" },
  "sites.client": { fr: "Client", en: "Client" },
  "sites.status": { fr: "Statut", en: "Status" },
  "sites.analysisReady": { fr: "Analyse disponible", en: "Analysis ready" },
  "sites.pending": { fr: "En attente", en: "Pending" },
  "sites.empty": { fr: "Aucun site", en: "No sites" },
  "sites.emptyDescription": { fr: "Ajoutez un site pour commencer l'analyse.", en: "Add a site to start the analysis." },

  // Site Detail
  "site.details": { fr: "Détails du site", en: "Site Details" },
  "site.consumption": { fr: "Données de consommation", en: "Consumption Data" },
  "site.uploadFiles": { fr: "Importer des fichiers CSV", en: "Import CSV files" },
  "site.dropzone": { fr: "Glissez-déposez vos fichiers CSV ici, ou cliquez pour sélectionner", en: "Drag and drop your CSV files here, or click to select" },
  "site.fileType": { fr: "Fichiers CSV Hydro-Québec (horaires et 15 minutes)", en: "Hydro-Québec CSV files (hourly and 15-minute)" },
  "site.files": { fr: "Fichiers importés", en: "Imported Files" },
  "site.fileName": { fr: "Nom du fichier", en: "File Name" },
  "site.granularity": { fr: "Granularité", en: "Granularity" },
  "site.period": { fr: "Période", en: "Period" },
  "site.runAnalysis": { fr: "Lancer l'analyse de potentiel", en: "Run potential analysis" },
  "site.downloadReport": { fr: "Télécharger le rapport PDF", en: "Download PDF report" },

  // Analysis Results
  "analysis.title": { fr: "Résultats de l'analyse", en: "Analysis Results" },
  "analysis.summary": { fr: "Sommaire", en: "Summary" },
  "analysis.annualConsumption": { fr: "Consommation annuelle", en: "Annual consumption" },
  "analysis.peakDemand": { fr: "Pic de puissance", en: "Peak demand" },
  "analysis.costBefore": { fr: "Coût annuel avant", en: "Annual cost before" },
  "analysis.recommendedPV": { fr: "PV recommandé", en: "Recommended PV" },
  "analysis.recommendedBattery": { fr: "Batterie recommandée", en: "Recommended battery" },
  "analysis.annualSavings": { fr: "Économies annuelles estimées", en: "Estimated annual savings" },
  "analysis.netInvestment": { fr: "Investissement net estimé", en: "Estimated net investment" },
  "analysis.npv20": { fr: "VAN (20 ans)", en: "NPV (20 years)" },
  "analysis.irr20": { fr: "TRI (20 ans)", en: "IRR (20 years)" },
  "analysis.payback": { fr: "Retour simple", en: "Simple payback" },
  "analysis.co2Avoided": { fr: "CO₂ évité", en: "CO₂ avoided" },
  "analysis.charts.loadProfile": { fr: "Profil de charge typique", en: "Typical load profile" },
  "analysis.charts.peakDistribution": { fr: "Distribution des pics", en: "Peak distribution" },
  "analysis.charts.beforeAfter": { fr: "Avant/Après écrêtage", en: "Before/After shaving" },
  "analysis.createDesign": { fr: "Créer un design", en: "Create design" },

  // Design
  "design.title": { fr: "Design du système", en: "System Design" },
  "design.name": { fr: "Nom du design", en: "Design name" },
  "design.selectModule": { fr: "Sélectionner le module", en: "Select module" },
  "design.selectInverter": { fr: "Sélectionner l'onduleur", en: "Select inverter" },
  "design.selectBattery": { fr: "Sélectionner la batterie", en: "Select battery" },
  "design.pvSize": { fr: "Taille PV (kWc)", en: "PV size (kWp)" },
  "design.batteryEnergy": { fr: "Énergie batterie (kWh)", en: "Battery energy (kWh)" },
  "design.batteryPower": { fr: "Puissance batterie (kW)", en: "Battery power (kW)" },
  "design.margin": { fr: "Marge (%)", en: "Margin (%)" },
  "design.generate": { fr: "Générer le design + BOM", en: "Generate design + BOM" },
  "design.bom": { fr: "Liste de matériaux (BOM)", en: "Bill of Materials (BOM)" },
  "design.category": { fr: "Catégorie", en: "Category" },
  "design.description": { fr: "Description", en: "Description" },
  "design.quantity": { fr: "Quantité", en: "Quantity" },
  "design.unitCost": { fr: "Coût unitaire", en: "Unit cost" },
  "design.totalCost": { fr: "Coût total", en: "Total cost" },
  "design.sellPrice": { fr: "Prix de vente", en: "Sell price" },
  "design.totalCapex": { fr: "CAPEX total", en: "Total CAPEX" },
  "design.totalSellPrice": { fr: "Prix de vente total", en: "Total sell price" },
  "design.syncZoho": { fr: "Créer/mettre à jour l'offre dans Zoho", en: "Create/update deal in Zoho" },
  "design.configuration": { fr: "Configuration du design", en: "Design Configuration" },
  "design.selectPlaceholder": { fr: "Sélectionner...", en: "Select..." },
  "design.summary": { fr: "Résumé", en: "Summary" },
  "design.recommendedBattery": { fr: "Batterie recommandée", en: "Recommended battery" },
  "design.costTotal": { fr: "Coût total", en: "Total cost" },
  "design.sellPriceTotal": { fr: "Prix de vente", en: "Sell price" },
  "design.marginAmount": { fr: "Marge", en: "Margin" },
  "design.loadOptimal": { fr: "Charger depuis analyse optimale", en: "Load from optimal analysis" },
  "design.designNameRequired": { fr: "Le nom du design est requis", en: "Design name is required" },

  // Common
  "common.save": { fr: "Enregistrer", en: "Save" },
  "common.cancel": { fr: "Annuler", en: "Cancel" },
  "common.delete": { fr: "Supprimer", en: "Delete" },
  "common.edit": { fr: "Modifier", en: "Edit" },
  "common.view": { fr: "Voir", en: "View" },
  "common.back": { fr: "Retour", en: "Back" },
  "common.loading": { fr: "Chargement...", en: "Loading..." },
  "common.error": { fr: "Une erreur est survenue", en: "An error occurred" },
  "common.years": { fr: "ans", en: "years" },
  "common.tonnesYear": { fr: "tonnes/an", en: "tonnes/year" },
  "common.actions": { fr: "Actions", en: "Actions" },
  "common.creating": { fr: "Création...", en: "Creating..." },
  "common.deleting": { fr: "Suppression...", en: "Deleting..." },
  "common.optional": { fr: "Optionnel", en: "Optional" },

  // Status
  "status.uploaded": { fr: "Téléversé", en: "Uploaded" },
  "status.parsed": { fr: "Analysé", en: "Parsed" },
  "status.failed": { fr: "Échec", en: "Failed" },
  "status.hour": { fr: "Horaire", en: "Hourly" },
  "status.fifteenMin": { fr: "15 minutes", en: "15 minutes" },

  // Footer
  "footer.rights": { fr: "Tous droits réservés", en: "All rights reserved" },
  "footer.contact": { fr: "Contactez-nous", en: "Contact us" },
  "footer.privacy": { fr: "Politique de confidentialité", en: "Privacy Policy" },

  // Catalog
  "catalog.title": { fr: "Catalogue", en: "Catalog" },
  "catalog.subtitle": { fr: "Gérez les composants disponibles pour les designs", en: "Manage available components for designs" },
  "catalog.addComponent": { fr: "Ajouter un composant", en: "Add component" },
  "catalog.editComponent": { fr: "Modifier le composant", en: "Edit component" },
  "catalog.category": { fr: "Catégorie", en: "Category" },
  "catalog.manufacturer": { fr: "Fabricant", en: "Manufacturer" },
  "catalog.model": { fr: "Modèle", en: "Model" },
  "catalog.unitCost": { fr: "Coût unitaire ($)", en: "Unit cost ($)" },
  "catalog.sellPrice": { fr: "Prix de vente ($)", en: "Sell price ($)" },
  "catalog.active": { fr: "Actif", en: "Active" },
  "catalog.inactive": { fr: "Inactif", en: "Inactive" },
  "catalog.activeDescription": { fr: "Rendre ce composant disponible pour les designs", en: "Make this component available for designs" },
  "catalog.cost": { fr: "Coût", en: "Cost" },
  "catalog.sale": { fr: "Vente", en: "Sale" },
  "catalog.noComponents": { fr: "Aucun composant dans le catalogue", en: "No components in the catalog" },
  "catalog.componentAdded": { fr: "Composant ajouté", en: "Component added" },
  "catalog.componentUpdated": { fr: "Composant mis à jour", en: "Component updated" },
  "catalog.componentDeleted": { fr: "Composant supprimé", en: "Component deleted" },
  "catalog.addError": { fr: "Erreur lors de l'ajout", en: "Error adding component" },
  "catalog.updateError": { fr: "Erreur lors de la mise à jour", en: "Error updating component" },
  "catalog.deleteError": { fr: "Erreur lors de la suppression", en: "Error deleting component" },
  "catalog.module": { fr: "Module PV", en: "PV Module" },
  "catalog.inverter": { fr: "Onduleur", en: "Inverter" },
  "catalog.battery": { fr: "Batterie", en: "Battery" },
  "catalog.racking": { fr: "Structure", en: "Racking" },
  "catalog.cable": { fr: "Câblage", en: "Cabling" },
  "catalog.bos": { fr: "BOS", en: "BOS" },

  // Dashboard
  "dashboard.exportPdf": { fr: "Exporter en PDF", en: "Export to PDF" },
  "dashboard.subtitle": { fr: "Vue d'ensemble de votre portefeuille", en: "Overview of your portfolio" },
  "dashboard.recentSites": { fr: "Sites récents", en: "Recent Sites" },
  "dashboard.recentAnalyses": { fr: "Analyses récentes", en: "Recent Analyses" },
  "dashboard.noRecentSites": { fr: "Aucun site récent", en: "No recent sites" },
  "dashboard.noRecentAnalyses": { fr: "Aucune analyse récente", en: "No recent analyses" },
  "dashboard.perYear": { fr: "an", en: "yr" },

  // Methodology
  "methodology.title": { fr: "Méthodologie", en: "Methodology" },
  "methodology.subtitle": { fr: "Documentation technique de notre approche d'analyse", en: "Technical documentation of our analysis approach" },
  "methodology.exportPdf": { fr: "Exporter en PDF", en: "Export to PDF" },
  "methodology.overview": { fr: "Aperçu", en: "Overview" },
  "methodology.financial": { fr: "Financier", en: "Financial" },
  "methodology.technical": { fr: "Technique", en: "Technical" },
  "methodology.glossary": { fr: "Glossaire", en: "Glossary" },

  // Design
  "design.generateError": { fr: "Erreur lors de la génération", en: "Error during generation" },
  "design.syncError": { fr: "Erreur lors de la synchronisation", en: "Error during sync" },
  "design.createDesign": { fr: "Créer un design", en: "Create design" },
  "design.designGenerated": { fr: "Design généré avec succès", en: "Design generated successfully" },
  "design.zohoSynced": { fr: "Offre synchronisée avec Zoho", en: "Quote synced with Zoho" },
  "design.simulationNotFound": { fr: "Simulation non trouvée", en: "Simulation not found" },

  // Sites
  "sites.createError": { fr: "Erreur lors de la création", en: "Error creating site" },
  "sites.updateError": { fr: "Erreur lors de la mise à jour", en: "Error updating site" },
  "sites.deleteError": { fr: "Erreur lors de la suppression", en: "Error deleting site" },
  "sites.createClientFirst": { fr: "Créer un client d'abord", en: "Create a client first" },
  "sites.siteCreated": { fr: "Site créé", en: "Site created" },
  "sites.siteUpdated": { fr: "Site mis à jour", en: "Site updated" },
  "sites.siteDeleted": { fr: "Site supprimé", en: "Site deleted" },

  // Clients
  "clients.subtitle": { fr: "Gérez vos clients et leurs sites", en: "Manage your clients and their sites" },
  "clients.createError": { fr: "Erreur lors de la création", en: "Error creating client" },
  "clients.updateError": { fr: "Erreur lors de la mise à jour", en: "Error updating client" },
  "clients.deleteError": { fr: "Erreur lors de la suppression", en: "Error deleting client" },
  "clients.clientCreated": { fr: "Client créé", en: "Client created" },
  "clients.clientUpdated": { fr: "Client mis à jour", en: "Client updated" },
  "clients.clientDeleted": { fr: "Client supprimé", en: "Client deleted" },
  "clients.grantPortalAccess": { fr: "Accorder l'accès au portail", en: "Grant Portal Access" },

  // Analyses
  "analyses.createDesign": { fr: "Créer un design", en: "Create design" },
  "analyses.noAnalyses": { fr: "Aucune analyse", en: "No analyses" },
  "analyses.noAnalysesDescription": { fr: "Créez un site et importez des données pour lancer une analyse.", en: "Create a site and import data to run an analysis." },
  "analyses.subtitle": { fr: "Consultez toutes les analyses de potentiel", en: "View all potential analyses" },
  "analyses.viewSite": { fr: "Voir le site", en: "View site" },
  "analyses.scenario": { fr: "Scénario", en: "Scenario" },
  "analyses.baseline": { fr: "Baseline", en: "Baseline" },
  "analyses.savings": { fr: "Économies", en: "Savings" },
  "analyses.payback": { fr: "Retour", en: "Payback" },
  "analyses.perYear": { fr: "an", en: "yr" },
  "analyses.years": { fr: "ans", en: "yrs" },

  // Client Portal
  "portal.welcome": { fr: "Bienvenue sur votre portail", en: "Welcome to your portal" },
  "portal.subtitle": { fr: "Consultez vos analyses solaires et rapports", en: "View your solar analyses and reports" },
  "portal.noSites": { fr: "Aucun site disponible", en: "No sites available" },
  "portal.noSitesDescription": { fr: "Vos sites avec analyses apparaîtront ici.", en: "Your sites with analyses will appear here." },
  "portal.viewDetails": { fr: "Voir les détails", en: "View details" },
  "portal.viewAnalysis": { fr: "Voir l'analyse", en: "View analysis" },
  "portal.analysisComplete": { fr: "Analyse complète", en: "Analysis complete" },
  "portal.analysisPending": { fr: "Analyse en attente", en: "Analysis pending" },
  "portal.location": { fr: "Emplacement", en: "Location" },
  "portal.roofArea": { fr: "Surface de toiture", en: "Roof area" },
  "portal.needHelp": { fr: "Besoin d'aide?", en: "Need help?" },
  "portal.helpText": { fr: "Contactez-nous pour toute question.", en: "Contact us with any questions." },

  // User Management
  "users.title": { fr: "Gestion des utilisateurs", en: "User Management" },
  "users.subtitle": { fr: "Gérez les comptes utilisateurs et les rôles", en: "Manage user accounts and roles" },
  "users.createUser": { fr: "Créer un utilisateur", en: "Create User" },
  "users.createUserDesc": { fr: "Ajouter un nouvel utilisateur au système", en: "Add a new user to the system" },
  "users.allUsers": { fr: "Tous les utilisateurs", en: "All Users" },
  "users.usersCount": { fr: "utilisateurs", en: "users" },
  "users.noUsers": { fr: "Aucun utilisateur", en: "No users" },
  "users.name": { fr: "Nom", en: "Name" },
  "users.email": { fr: "Courriel", en: "Email" },
  "users.password": { fr: "Mot de passe", en: "Password" },
  "users.role": { fr: "Rôle", en: "Role" },
  "users.linkedClient": { fr: "Client lié", en: "Linked Client" },
  "users.client": { fr: "Client", en: "Client" },
  "users.deleteUser": { fr: "Supprimer l'utilisateur", en: "Delete User" },
  "users.deleteUserConfirm": { fr: "Êtes-vous sûr de vouloir supprimer cet utilisateur?", en: "Are you sure you want to delete this user?" },
  "users.userCreated": { fr: "Utilisateur créé", en: "User created" },
  "users.userCreatedDesc": { fr: "Le compte a été créé avec succès.", en: "The account has been created successfully." },
  "users.userDeleted": { fr: "Utilisateur supprimé", en: "User deleted" },
  "users.userDeletedDesc": { fr: "Le compte a été supprimé.", en: "The account has been deleted." },
  "users.adminOnly": { fr: "Réservé aux administrateurs", en: "Admin only" },
  "users.accessDenied": { fr: "Accès refusé", en: "Access denied" },

  // Scenario Comparison
  "compare.title": { fr: "Comparer", en: "Compare" },
  "compare.scenarios": { fr: "Comparaison des scénarios", en: "Scenario Comparison" },
  "compare.noScenarios": { fr: "Exécutez plusieurs analyses pour comparer les scénarios.", en: "Run multiple analyses to compare scenarios." },
  "compare.scenario": { fr: "Scénario", en: "Scenario" },
  "compare.best": { fr: "Meilleur", en: "Best" },
  "compare.pvSize": { fr: "PV (kWc)", en: "PV (kWp)" },
  "compare.batterySize": { fr: "Batterie (kWh)", en: "Battery (kWh)" },
  "compare.investment": { fr: "Investissement net", en: "Net Investment" },
  "compare.savings": { fr: "Économies/an", en: "Savings/yr" },
  "compare.npv": { fr: "VAN (20 ans)", en: "NPV (20 yrs)" },
  "compare.irr": { fr: "TRI", en: "IRR" },
  "compare.payback": { fr: "Retour", en: "Payback" },
  "compare.co2": { fr: "CO₂ évité", en: "CO₂ avoided" },
  "compare.npvChart": { fr: "Comparaison VAN (20 ans)", en: "NPV Comparison (20 yrs)" },
  "compare.savingsChart": { fr: "Économies annuelles", en: "Annual Savings" },
  "compare.paybackChart": { fr: "Retour sur investissement", en: "Payback Period" },
  "compare.sizingChart": { fr: "Dimensionnement du système", en: "System Sizing" },
  "compare.years": { fr: "ans", en: "yrs" },
  "compare.scenarioCount": { fr: "scénarios disponibles pour ce site", en: "scenarios available for this site" },

  // Create Variant
  "variant.createVariant": { fr: "Créer une variante", en: "Create Variant" },
  "variant.title": { fr: "Créer une variante de scénario", en: "Create Scenario Variant" },
  "variant.description": { fr: "Modifier les paramètres pour créer une nouvelle analyse.", en: "Modify parameters to create a new analysis." },
  "variant.label": { fr: "Nom du scénario", en: "Scenario Name" },
  "variant.labelPlaceholder": { fr: "Ex: Système optimisé", en: "E.g.: Optimized System" },
  "variant.pvSize": { fr: "Taille PV (kWc)", en: "PV Size (kWp)" },
  "variant.batterySize": { fr: "Batterie (kWh)", en: "Battery (kWh)" },
  "variant.batteryPower": { fr: "Puissance batterie (kW)", en: "Battery Power (kW)" },
  "variant.runAnalysis": { fr: "Lancer l'analyse", en: "Run Analysis" },
  "variant.cancel": { fr: "Annuler", en: "Cancel" },
  "variant.success": { fr: "Nouvelle variante créée", en: "New variant created" },
  "variant.error": { fr: "Erreur lors de la création", en: "Error creating variant" },

  // Financing Calculator
  "financing.title": { fr: "Options de financement", en: "Financing Options" },
  "financing.description": { fr: "Comparez les options de paiement pour votre projet.", en: "Compare payment options for your project." },
  "financing.cash": { fr: "Comptant", en: "Cash" },
  "financing.loan": { fr: "Prêt", en: "Loan" },
  "financing.lease": { fr: "Crédit-bail", en: "Capital Lease" },
  "financing.loanTerm": { fr: "Durée du prêt (ans)", en: "Loan Term (years)" },
  "financing.interestRate": { fr: "Taux d'intérêt (%)", en: "Interest Rate (%)" },
  "financing.downPayment": { fr: "Mise de fonds (%)", en: "Down Payment (%)" },
  "financing.monthlyPayment": { fr: "Paiement mensuel", en: "Monthly Payment" },
  "financing.totalCost": { fr: "Coût total", en: "Total Cost" },
  "financing.netSavings": { fr: "Économies nettes", en: "Net Savings" },
  "financing.leasePayment": { fr: "Paiement crédit-bail/mois", en: "Lease Payment/month" },
  "financing.compare": { fr: "Comparer les options", en: "Compare Options" },
  "financing.leaseImplicitRate": { fr: "Taux crédit-bail (%)", en: "Lease Rate (%)" },
  "financing.cumulativeCashflow": { fr: "Comparaison flux trésorerie cumulés", en: "Cumulative Cashflow Comparison" },
  "financing.cumulativeCashflowAxis": { fr: "Cashflow Cumulé ($)", en: "Cumulative Cashflow ($)" },
  "financing.years": { fr: "Années", en: "Years" },

  // Proposal Builder
  "proposal.title": { fr: "Générateur de proposition", en: "Proposal Builder" },
  "proposal.description": { fr: "Créez une proposition professionnelle personnalisée.", en: "Create a customized professional proposal." },
  "proposal.sections": { fr: "Sections", en: "Sections" },
  "proposal.dragToReorder": { fr: "Glissez pour réorganiser", en: "Drag to reorder" },
  "proposal.introduction": { fr: "Introduction", en: "Introduction" },
  "proposal.technical": { fr: "Spécifications techniques", en: "Technical Specifications" },
  "proposal.financial": { fr: "Analyse financière", en: "Financial Analysis" },
  "proposal.bom": { fr: "Liste des matériaux", en: "Bill of Materials" },
  "proposal.terms": { fr: "Termes et conditions", en: "Terms & Conditions" },
  "proposal.branding": { fr: "Personnalisation", en: "Branding" },
  "proposal.logo": { fr: "Logo de l'entreprise", en: "Company Logo" },
  "proposal.accentColor": { fr: "Couleur d'accent", en: "Accent Color" },
  "proposal.includeCharts": { fr: "Inclure les graphiques", en: "Include Charts" },
  "proposal.generatePdf": { fr: "Générer le PDF", en: "Generate PDF" },
  "proposal.preview": { fr: "Aperçu", en: "Preview" },
};

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("language");
      if (stored === "fr" || stored === "en") return stored;
    }
    return "fr";
  });

  const handleSetLanguage = useCallback((lang: Language) => {
    setLanguage(lang);
    localStorage.setItem("language", lang);
    document.documentElement.lang = lang === "fr" ? "fr-CA" : "en-CA";
  }, []);

  const t = useCallback((key: string): string => {
    const translation = translations[key];
    if (!translation) {
      console.warn(`Missing translation for key: ${key}`);
      return key;
    }
    return translation[language];
  }, [language]);

  return (
    <I18nContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}
