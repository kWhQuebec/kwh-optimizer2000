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
  "landing.hero.title": { fr: "Solaire + stockage clé en main pour le secteur commercial et industriel québécois", en: "Turnkey Solar + Storage for Québec C&I Buildings" },
  "landing.hero.subtitle": { fr: "Incitatifs jusqu'à 40% du projet.", en: "Incentives up to 40% of project cost." },
  "landing.hero.subtitle2": { fr: "Analyse gratuite.", en: "Free analysis." },
  "landing.hero.description": { 
    fr: "", 
    en: "" 
  },
  "landing.hero.cta": { fr: "Obtenir mon analyse gratuite", en: "Get my free analysis" },
  "landing.hero.ctaSecondary": { fr: "Accès client", en: "Client access" },
  
  // Landing Page - Why Now Section (3 items only)
  "landing.whyNow.title": { fr: "Pourquoi maintenant?", en: "Why now?" },
  "landing.whyNow.subtitle": { fr: "Le Québec vit une transformation énergétique historique", en: "Québec is experiencing a historic energy transformation" },
  "landing.whyNow.hq.title": { fr: "Crédit jusqu'à 40% par Hydro-Québec", en: "Up to 40% Credit by Hydro-Québec" },
  "landing.whyNow.hq.description": { fr: "Sur les projets solaires et stockage", en: "On solar and storage projects" },
  "landing.whyNow.federal.title": { fr: "Crédit fédéral 30%", en: "Federal 30% ITC" },
  "landing.whyNow.federal.description": { fr: "Crédit d'impôt à l'investissement pour technologies propres", en: "Investment tax credit for clean technology" },
  "landing.whyNow.fiscal.title": { fr: "100% déductible en 1ère année", en: "100% Deductible Year 1" },
  "landing.whyNow.fiscal.description": { fr: "Traitement fiscal avantageux", en: "Advantageous fiscal treatment" },
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
  "landing.trust.experience": { fr: "Expertise commerciale et industrielle au Québec", en: "C&I expertise in Québec" },
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
  
  // Landing Page - Hero Stats (outcome-focused)
  "landing.hero.stat1.value": { fr: "kW", en: "kW" },
  "landing.hero.stat1.label": { fr: "Potentiel solaire de votre toit", en: "Your roof's solar potential" },
  "landing.hero.stat2.value": { fr: "$", en: "$" },
  "landing.hero.stat2.label": { fr: "Économies annuelles estimées", en: "Estimated annual savings" },
  "landing.hero.stat3.value": { fr: "Ans", en: "Yrs" },
  "landing.hero.stat3.label": { fr: "Période de récupération", en: "Payback period" },
  "landing.hero.stat4.value": { fr: "✓", en: "✓" },
  "landing.hero.stat4.label": { fr: "Éligibilité aux incitatifs", en: "Incentive eligibility" },
  
  // Landing Page - Footer
  "landing.footer.tagline": { fr: "Accélérez votre transition énergétique", en: "Accelerate your energy transition" },

  // Landing Page - Authorization Section
  "landing.auth.title": { fr: "Accélérez votre analyse", en: "Accelerate Your Analysis" },
  "landing.auth.subtitle": { 
    fr: "Vous avez déjà un compte Hydro-Québec? Autorisez-nous à accéder à votre profil de consommation pour une analyse plus précise.", 
    en: "Already have a Hydro-Québec account? Authorize us to access your consumption profile for a more precise analysis." 
  },
  "landing.auth.benefit1": { fr: "Analyse basée sur vos vraies données de consommation", en: "Analysis based on your real consumption data" },
  "landing.auth.benefit2": { fr: "Dimensionnement optimisé pour votre profil énergétique", en: "Sizing optimized for your energy profile" },
  "landing.auth.benefit3": { fr: "Projections financières plus précises", en: "More accurate financial projections" },
  "landing.auth.cta": { fr: "Signer la procuration", en: "Sign Authorization" },
  "landing.auth.note": { 
    fr: "Ce formulaire autorise kWh Québec à accéder à vos données de consommation Hydro-Québec. Signature électronique sécurisée.", 
    en: "This form authorizes kWh Québec to access your Hydro-Québec consumption data. Secure electronic signature." 
  },
  "landing.auth.badge": { fr: "Étape 2", en: "Step 2" },

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
  
  // Bifacial PV detection
  "bifacial.detected.title": { fr: "Membrane blanche détectée", en: "White membrane detected" },
  "bifacial.detected.description": { fr: "Notre analyse d'imagerie a détecté une membrane de toiture blanche hautement réfléchissante. Les panneaux PV bi-faciaux peuvent capter la lumière réfléchie du toit, augmentant potentiellement la production d'énergie de 10-15%.", en: "Our imagery analysis detected a highly reflective white roof membrane. Bi-facial PV panels can capture reflected light from the roof, potentially increasing energy production by 10-15%." },
  "bifacial.detected.question": { fr: "Voulez-vous analyser le PV bi-facial pour ce bâtiment?", en: "Do you want to analyze bi-facial PV for this building?" },
  "bifacial.detected.accept": { fr: "Oui, analyser bi-facial", en: "Yes, analyze bi-facial" },
  "bifacial.detected.decline": { fr: "Non, continuer standard", en: "No, continue standard" },
  "bifacial.enabled": { fr: "PV bi-facial activé", en: "Bi-facial PV enabled" },
  "bifacial.yieldBoost": { fr: "Gain de production estimé", en: "Estimated yield boost" },
  "bifacial.roofType.white_membrane": { fr: "Membrane blanche", en: "White membrane" },
  "bifacial.roofType.light": { fr: "Toit clair", en: "Light roof" },
  "bifacial.roofType.dark": { fr: "Toit foncé", en: "Dark roof" },
  "bifacial.roofType.gravel": { fr: "Gravier", en: "Gravel" },
  "bifacial.roofType.unknown": { fr: "Inconnu", en: "Unknown" },

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

  // Site Visits
  "siteVisit.title": { fr: "Visite technique", en: "Technical Visit" },
  "siteVisit.newVisit": { fr: "Nouvelle visite", en: "New Visit" },
  "siteVisit.editVisit": { fr: "Modifier la visite", en: "Edit Visit" },
  "siteVisit.scheduledFor": { fr: "Prévue le", en: "Scheduled for" },
  "siteVisit.visitedBy": { fr: "Visiteur", en: "Visited by" },
  "siteVisit.status": { fr: "Statut", en: "Status" },
  "siteVisit.status.scheduled": { fr: "Planifiée", en: "Scheduled" },
  "siteVisit.status.in_progress": { fr: "En cours", en: "In Progress" },
  "siteVisit.status.completed": { fr: "Terminée", en: "Completed" },
  "siteVisit.status.cancelled": { fr: "Annulée", en: "Cancelled" },
  "siteVisit.notes": { fr: "Notes", en: "Notes" },
  "siteVisit.noVisits": { fr: "Aucune visite technique planifiée", en: "No technical visit scheduled" },
  "siteVisit.createFirst": { fr: "Planifier une première visite technique", en: "Schedule a first technical visit" },
  "siteVisit.signAgreementFirst": { fr: "Obtenez d'abord une entente de design signée pour planifier une visite technique.", en: "Get a signed design agreement first to schedule a technical visit." },
  
  // Site Visit - Location
  "siteVisit.location": { fr: "Emplacement", en: "Location" },
  "siteVisit.gpsCoordinates": { fr: "Coordonnées GPS", en: "GPS Coordinates" },
  "siteVisit.latitude": { fr: "Latitude", en: "Latitude" },
  "siteVisit.longitude": { fr: "Longitude", en: "Longitude" },
  
  // Site Visit - Roof
  "siteVisit.roofInfo": { fr: "Information toiture", en: "Roof Information" },
  "siteVisit.roofType": { fr: "Type de toit", en: "Roof Type" },
  "siteVisit.roofType.flat": { fr: "Plat", en: "Flat" },
  "siteVisit.roofType.sloped": { fr: "Incliné", en: "Sloped" },
  "siteVisit.roofType.metal": { fr: "Tôle", en: "Metal" },
  "siteVisit.roofHeight": { fr: "Hauteur du toit (m)", en: "Roof Height (m)" },
  "siteVisit.roofMaterial": { fr: "Matériau", en: "Material" },
  "siteVisit.roofAge": { fr: "Âge du toit (années)", en: "Roof Age (years)" },
  "siteVisit.anchoringMethod": { fr: "Méthode d'ancrage", en: "Anchoring Method" },
  "siteVisit.roofCondition": { fr: "État du toit", en: "Roof Condition" },
  
  // Site Visit - Electrical
  "siteVisit.electrical": { fr: "Infrastructure électrique", en: "Electrical Infrastructure" },
  "siteVisit.mainPanelInfo": { fr: "Panneau principal", en: "Main Panel" },
  "siteVisit.mainPanelAmperage": { fr: "Ampérage (A)", en: "Amperage (A)" },
  "siteVisit.mainPanelVoltage": { fr: "Voltage (V)", en: "Voltage (V)" },
  "siteVisit.meterNumber": { fr: "Numéro de compteur", en: "Meter Number" },
  "siteVisit.transformerInfo": { fr: "Transformateur", en: "Transformer" },
  "siteVisit.hasSld": { fr: "Schéma unifilaire disponible", en: "Single Line Diagram Available" },
  "siteVisit.sldNeeded": { fr: "Schéma unifilaire requis", en: "Single Line Diagram Needed" },
  
  // Site Visit - Obstacles
  "siteVisit.obstacles": { fr: "Obstacles et ombrage", en: "Obstacles & Shading" },
  "siteVisit.obstacleDescription": { fr: "Description des obstacles", en: "Obstacle Description" },
  "siteVisit.shadingAnalysis": { fr: "Analyse d'ombrage", en: "Shading Analysis" },
  
  // Site Visit - Technical Room
  "siteVisit.technicalRoom": { fr: "Salle technique", en: "Technical Room" },
  "siteVisit.techRoomLocation": { fr: "Emplacement", en: "Location" },
  "siteVisit.techRoomAccess": { fr: "Accès", en: "Access" },
  "siteVisit.techRoomSpace": { fr: "Espace disponible", en: "Available Space" },
  
  // Site Visit - Cost Estimate
  "siteVisit.costEstimate": { fr: "Estimation des coûts", en: "Cost Estimate" },
  "siteVisit.buildingCount": { fr: "Nombre de bâtiments", en: "Building Count" },
  "siteVisit.travelDays": { fr: "Jours de déplacement", en: "Travel Days" },
  "siteVisit.travelCost": { fr: "Frais de déplacement", en: "Travel Cost" },
  "siteVisit.visitCost": { fr: "Visite sur site", en: "Site Visit" },
  "siteVisit.evaluationCost": { fr: "Évaluation technique", en: "Technical Evaluation" },
  "siteVisit.diagramsCost": { fr: "Dessins techniques", en: "Technical Drawings" },
  "siteVisit.sldSupplement": { fr: "Supplément sans schéma", en: "No SLD Supplement" },
  "siteVisit.totalCost": { fr: "Total estimé", en: "Estimated Total" },
  
  // Site Visit - Actions
  "siteVisit.save": { fr: "Enregistrer", en: "Save" },
  "siteVisit.cancel": { fr: "Annuler", en: "Cancel" },
  "siteVisit.delete": { fr: "Supprimer", en: "Delete" },
  "siteVisit.created": { fr: "Visite créée", en: "Visit created" },
  "siteVisit.updated": { fr: "Visite mise à jour", en: "Visit updated" },
  "siteVisit.deleted": { fr: "Visite supprimée", en: "Visit deleted" },
  "siteVisit.createError": { fr: "Erreur lors de la création", en: "Error creating visit" },
  "siteVisit.updateError": { fr: "Erreur lors de la mise à jour", en: "Error updating visit" },
  "siteVisit.deleteError": { fr: "Erreur lors de la suppression", en: "Error deleting visit" },

  // Design Agreement (Step 3)
  "designAgreement.title": { fr: "Entente de design (Étape 3)", en: "Design Agreement (Step 3)" },
  "designAgreement.subtitle": { fr: "Première étape payante vers votre projet solaire", en: "First paid step toward your solar project" },
  "designAgreement.generate": { fr: "Générer l'entente", en: "Generate Agreement" },
  "designAgreement.generateDescription": { fr: "Créez une entente de design pour formaliser les coûts de visite technique et livrables.", en: "Create a design agreement to formalize technical visit costs and deliverables." },
  "designAgreement.status": { fr: "Statut", en: "Status" },
  "designAgreement.status.draft": { fr: "Brouillon", en: "Draft" },
  "designAgreement.status.sent": { fr: "Envoyée", en: "Sent" },
  "designAgreement.status.accepted": { fr: "Acceptée", en: "Accepted" },
  "designAgreement.status.declined": { fr: "Déclinée", en: "Declined" },
  "designAgreement.validUntil": { fr: "Valide jusqu'au", en: "Valid until" },
  "designAgreement.costBreakdown": { fr: "Détail des coûts", en: "Cost Breakdown" },
  "designAgreement.siteVisitCosts": { fr: "Coûts de la visite technique", en: "Technical Visit Costs" },
  "designAgreement.travel": { fr: "Déplacement", en: "Travel" },
  "designAgreement.visit": { fr: "Visite sur site", en: "Site Visit" },
  "designAgreement.evaluation": { fr: "Évaluation technique", en: "Technical Evaluation" },
  "designAgreement.diagrams": { fr: "Dessins techniques", en: "Technical Drawings" },
  "designAgreement.sldSupplement": { fr: "Supplément schéma unifilaire", en: "SLD Supplement" },
  "designAgreement.subtotal": { fr: "Sous-total", en: "Subtotal" },
  "designAgreement.gst": { fr: "TPS (5%)", en: "GST (5%)" },
  "designAgreement.qst": { fr: "TVQ (9.975%)", en: "QST (9.975%)" },
  "designAgreement.total": { fr: "Total", en: "Total" },
  "designAgreement.paymentTerms": { fr: "Modalités de paiement", en: "Payment Terms" },
  "designAgreement.defaultPaymentTerms": { fr: "50% à la signature, 50% à la livraison des dessins", en: "50% at signing, 50% at drawing delivery" },
  "designAgreement.deliverables": { fr: "Livrables inclus", en: "Included Deliverables" },
  "designAgreement.deliverable1": { fr: "Visite technique complète du site", en: "Complete technical site visit" },
  "designAgreement.deliverable2": { fr: "Rapport d'évaluation technique", en: "Technical evaluation report" },
  "designAgreement.deliverable3": { fr: "Dessins d'implantation PV", en: "PV layout drawings" },
  "designAgreement.deliverable4": { fr: "Schéma unifilaire (si requis)", en: "Single line diagram (if required)" },
  "designAgreement.deliverable5": { fr: "Soumission détaillée à prix fixe", en: "Detailed fixed-price quote" },
  "designAgreement.send": { fr: "Envoyer au client", en: "Send to Client" },
  "designAgreement.markAccepted": { fr: "Marquer comme acceptée", en: "Mark as Accepted" },
  "designAgreement.noVisit": { fr: "Aucune visite technique planifiée", en: "No technical visit scheduled" },
  "designAgreement.scheduleVisitFirst": { fr: "Planifiez d'abord une visite technique pour générer une entente de design.", en: "Schedule a technical visit first to generate a design agreement." },
  "designAgreement.created": { fr: "Entente créée", en: "Agreement created" },
  "designAgreement.sent": { fr: "Entente envoyée", en: "Agreement sent" },
  "designAgreement.accepted": { fr: "Entente acceptée", en: "Agreement accepted" },
  "designAgreement.createError": { fr: "Erreur lors de la création", en: "Error creating agreement" },
  "designAgreement.sendError": { fr: "Erreur lors de l'envoi", en: "Error sending agreement" },
  "designAgreement.downloadPdf": { fr: "Télécharger PDF", en: "Download PDF" },
  "designAgreement.sendToClient": { fr: "Envoyer le lien au client", en: "Send Link to Client" },
  "designAgreement.copyLink": { fr: "Copier le lien", en: "Copy Link" },
  "designAgreement.linkCopied": { fr: "Lien copié!", en: "Link copied!" },
  "designAgreement.viewClientPage": { fr: "Voir la page client", en: "View Client Page" },
  
  // Design agreement - detailed terms
  "designAgreement.introduction": { fr: "À propos de cette entente", en: "About This Agreement" },
  "designAgreement.introText": { fr: "Cette entente couvre les frais de conception technique préalables à une soumission à prix fixe pour votre projet solaire. Les travaux inclus vous permettent d'obtenir tous les documents nécessaires pour prendre une décision éclairée.", en: "This agreement covers the technical design fees required before providing a fixed-price quote for your solar project. The included work provides you with all the documents needed to make an informed decision." },
  
  "designAgreement.deliverablesDetailed": { fr: "Ce qui est inclus", en: "What's Included" },
  "designAgreement.deliverableDetail1": { fr: "Visite technique complète du site par un technicien certifié", en: "Complete on-site technical visit by a certified technician" },
  "designAgreement.deliverableDetail2": { fr: "Relevé des dimensions de toiture et identification des obstacles", en: "Roof dimension survey and obstacle identification" },
  "designAgreement.deliverableDetail3": { fr: "Évaluation de la structure et de la capacité portante", en: "Structure and load-bearing capacity assessment" },
  "designAgreement.deliverableDetail4": { fr: "Documentation photographique complète du site", en: "Complete photographic documentation of the site" },
  "designAgreement.deliverableDetail5": { fr: "Dessins d'implantation PV (layout) professionnels", en: "Professional PV layout drawings" },
  "designAgreement.deliverableDetail6": { fr: "Schéma unifilaire électrique (SLD) si requis", en: "Electrical single-line diagram (SLD) if required" },
  "designAgreement.deliverableDetail7": { fr: "Rapport technique avec recommandations personnalisées", en: "Technical report with personalized recommendations" },
  "designAgreement.deliverableDetail8": { fr: "Soumission à prix fixe valide 30 jours", en: "Fixed-price quote valid for 30 days" },
  
  "designAgreement.exclusions": { fr: "Ce qui n'est PAS inclus", en: "What's NOT Included" },
  "designAgreement.exclusion1": { fr: "Analyse structurale par ingénieur (si requise par la municipalité)", en: "Structural analysis by engineer (if required by municipality)" },
  "designAgreement.exclusion2": { fr: "Démarches et frais de permis municipaux", en: "Municipal permit applications and fees" },
  "designAgreement.exclusion3": { fr: "Travaux d'installation du système solaire", en: "Solar system installation work" },
  "designAgreement.exclusion4": { fr: "Modifications au réseau électrique existant", en: "Modifications to existing electrical network" },
  
  "designAgreement.timeline": { fr: "Délais prévus", en: "Expected Timeline" },
  "designAgreement.timelineVisit": { fr: "Visite technique: 2-3 semaines après signature", en: "Technical visit: 2-3 weeks after signing" },
  "designAgreement.timelineDelivery": { fr: "Livraison des documents: 2-3 semaines après la visite", en: "Document delivery: 2-3 weeks after visit" },
  
  "designAgreement.creditPolicy": { fr: "Politique de crédit", en: "Credit Policy" },
  "designAgreement.creditPolicyText": { fr: "Le dépôt sera crédité intégralement sur votre projet si vous procédez à l'installation avec kWh Québec dans les 90 jours suivant la livraison des documents.", en: "The deposit will be fully credited to your project if you proceed with installation through kWh Québec within 90 days of document delivery." },
  
  // Pricing Configuration Dialog
  "designAgreement.pricingConfig": { fr: "Configuration des coûts", en: "Pricing Configuration" },
  "designAgreement.pricingConfigDescription": { fr: "Configurez les coûts de l'entente de design basés sur le système et les services requis.", en: "Configure design agreement costs based on the system and required services." },
  "designAgreement.systemConfig": { fr: "Configuration du système", en: "System Configuration" },
  "designAgreement.numBuildings": { fr: "Nombre de bâtiments", en: "Number of Buildings" },
  "designAgreement.travelDays": { fr: "Jours de déplacement", en: "Travel Days" },
  "designAgreement.pvSizeKW": { fr: "Taille PV (kW)", en: "PV Size (kW)" },
  "designAgreement.battEnergyKWh": { fr: "Batterie (kWh)", en: "Battery (kWh)" },
  "designAgreement.engineeringStamps": { fr: "Certifications d'ingénieur", en: "Engineering Stamps" },
  "designAgreement.structuralStamp": { fr: "Certification structure (toiture)", en: "Structural stamp (roof)" },
  "designAgreement.electricalStamp": { fr: "Certification électrique (SLD)", en: "Electrical stamp (SLD)" },
  "designAgreement.costSummary": { fr: "Résumé des coûts", en: "Cost Summary" },
  "designAgreement.baseFee": { fr: "Frais de base", en: "Base Fee" },
  "designAgreement.pvFee": { fr: "Frais PV", en: "PV Fee" },
  "designAgreement.batteryFee": { fr: "Frais batterie", en: "Battery Fee" },
  "designAgreement.travelFee": { fr: "Frais de déplacement", en: "Travel Fee" },
  
  "designAgreement.importantNotes": { fr: "Notes importantes", en: "Important Notes" },
  "designAgreement.note1": { fr: "Le dépôt de 50% est non remboursable une fois la visite technique effectuée.", en: "The 50% deposit is non-refundable once the technical visit is completed." },
  "designAgreement.note2": { fr: "Cette entente est valide pour 30 jours à compter de la date d'émission.", en: "This agreement is valid for 30 days from the issue date." },
  "designAgreement.note3": { fr: "Les travaux de conception appartiennent à kWh Québec jusqu'au paiement final.", en: "Design work belongs to kWh Québec until final payment." },
  
  // Public signing page
  "publicAgreement.title": { fr: "Entente de design", en: "Design Agreement" },
  "publicAgreement.preparedFor": { fr: "Préparé pour", en: "Prepared for" },
  "publicAgreement.site": { fr: "Site", en: "Site" },
  "publicAgreement.projectScope": { fr: "Portée du projet", en: "Project Scope" },
  "publicAgreement.scopeDescription": { fr: "Cette entente couvre les services de conception technique préalables à l'installation de votre système solaire photovoltaïque.", en: "This agreement covers the technical design services prior to the installation of your solar photovoltaic system." },
  "publicAgreement.termsTitle": { fr: "Termes et conditions", en: "Terms and Conditions" },
  "publicAgreement.term1": { fr: "Les travaux débuteront dans les 10 jours ouvrables suivant la réception du dépôt.", en: "Work will begin within 10 business days of receiving the deposit." },
  "publicAgreement.term2": { fr: "Les livrables seront fournis sous forme électronique.", en: "Deliverables will be provided in electronic format." },
  "publicAgreement.term3": { fr: "Cette soumission est valide pour 30 jours.", en: "This quote is valid for 30 days." },
  "publicAgreement.term4": { fr: "Le dépôt de 50% est non remboursable.", en: "The 50% deposit is non-refundable." },
  "publicAgreement.signatureSection": { fr: "Signature", en: "Signature" },
  "publicAgreement.yourName": { fr: "Votre nom", en: "Your Name" },
  "publicAgreement.yourEmail": { fr: "Votre courriel", en: "Your Email" },
  "publicAgreement.drawSignature": { fr: "Dessinez votre signature ci-dessous", en: "Draw your signature below" },
  "publicAgreement.clearSignature": { fr: "Effacer", en: "Clear" },
  "publicAgreement.signAndPay": { fr: "Signer et payer le dépôt", en: "Sign and Pay Deposit" },
  "publicAgreement.signOnly": { fr: "Signer l'entente", en: "Sign Agreement" },
  "publicAgreement.depositAmount": { fr: "Montant du dépôt", en: "Deposit Amount" },
  "publicAgreement.alreadySigned": { fr: "Cette entente a déjà été signée", en: "This agreement has already been signed" },
  "publicAgreement.expired": { fr: "Cette entente est expirée", en: "This agreement has expired" },
  "publicAgreement.signedOn": { fr: "Signée le", en: "Signed on" },
  "publicAgreement.signedBy": { fr: "Signée par", en: "Signed by" },
  "publicAgreement.thankYou": { fr: "Merci pour votre confiance!", en: "Thank you for your trust!" },
  "publicAgreement.nextSteps": { fr: "Notre équipe vous contactera sous peu pour planifier la visite technique.", en: "Our team will contact you shortly to schedule the technical visit." },
  "publicAgreement.signatureRequired": { fr: "Veuillez dessiner votre signature", en: "Please draw your signature" },
  "publicAgreement.nameRequired": { fr: "Veuillez entrer votre nom", en: "Please enter your name" },
  "publicAgreement.emailRequired": { fr: "Veuillez entrer votre courriel", en: "Please enter your email" },
  "publicAgreement.notFound": { fr: "Entente introuvable", en: "Agreement not found" },
  "publicAgreement.loading": { fr: "Chargement...", en: "Loading..." },
  "publicAgreement.error": { fr: "Une erreur est survenue", en: "An error occurred" },
  "publicAgreement.signingSuccess": { fr: "Entente signée avec succès!", en: "Agreement signed successfully!" },
  "publicAgreement.redirectingToPayment": { fr: "Redirection vers le paiement...", en: "Redirecting to payment..." },
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
