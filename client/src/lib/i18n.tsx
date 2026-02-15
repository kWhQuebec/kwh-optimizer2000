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
  "nav.procurations": { fr: "Procurations", en: "Authorizations" },
  "nav.userSites": { fr: "Sites utilisateur", en: "User Sites" },
  "nav.mySites": { fr: "Mes sites", en: "My Sites" },

  // Landing Page - Hero
  "landing.hero.title": { fr: "Réduisez vos coûts d'énergie avec le solaire commercial", en: "Cut Your Energy Costs with Commercial Solar" },
  "landing.hero.subtitle": { fr: "Incitatifs jusqu'à 40% du projet.", en: "Incentives up to 40% of project cost." },
  "landing.hero.subtitle2": { fr: "Analyse gratuite.", en: "Free analysis." },
  "landing.hero.description": {
    fr: "Vos coûts d'énergie augmentent chaque année. Le solaire les réduit dès le jour 1 — avec un retour sur investissement de 3 à 6 ans et des incitatifs couvrant jusqu'à 60% du projet.",
    en: "Your energy costs rise every year. Solar cuts them from day 1 — with a 3 to 6 year payback and incentives covering up to 60% of the project."
  },
  "landing.hero.cta": { fr: "Calculer mes économies gratuitement", en: "Calculate my savings for free" },
  "landing.hero.ctaSecondary": { fr: "Accès client", en: "Client access" },
  
  // Landing Page - Why Now Section (3 items only)
  "landing.whyNow.title": { fr: "Pourquoi maintenant?", en: "Why now?" },
  "landing.whyNow.subtitle": { fr: "Les incitatifs n'ont jamais été aussi généreux — et ils ne dureront pas", en: "Incentives have never been this generous — and they won't last" },
  "landing.whyNow.hq.title": { fr: "Crédit jusqu'à 40% par Hydro-Québec", en: "Up to 40% Credit by Hydro-Québec" },
  "landing.whyNow.hq.description": { fr: "Programme Hydro-Québec: jusqu'à 1 000$/kW (max 40% du CAPEX)", en: "Hydro-Québec program: up to $1,000/kW (max 40% of CAPEX)" },
  "landing.whyNow.federal.title": { fr: "Crédit fédéral 30%", en: "Federal 30% ITC" },
  "landing.whyNow.federal.description": { fr: "Crédit d'impôt à l'investissement pour technologies propres", en: "Investment tax credit for clean technology" },
  "landing.whyNow.fiscal.title": { fr: "100% déductible en 1ère année", en: "100% Deductible Year 1" },
  "landing.whyNow.fiscal.description": { fr: "Traitement fiscal avantageux", en: "Advantageous fiscal treatment" },
  "landing.whyNow.deadline": { fr: "Ces incitatifs peuvent changer à tout moment", en: "These incentives can change at any time" },
  
  // Landing Page - Process Steps (6 steps, 3 phases)
  // Phase Découverte
  "landing.step1.title": { fr: "Analyse gratuite", en: "Free Analysis" },
  "landing.step1.description": {
    fr: "Téléversez votre facture Hydro-Québec — notre IA calcule instantanément votre potentiel solaire, vos économies et votre ROI. Zéro engagement.",
    en: "Upload your Hydro-Québec bill — our AI instantly calculates your solar potential, savings and ROI. Zero commitment."
  },
  "landing.step1.time": { fr: "Quelques minutes", en: "A few minutes" },
  "landing.step2.title": { fr: "Étude personnalisée", en: "Personalized Study" },
  "landing.step2.description": {
    fr: "Signez une procuration Hydro-Québec (2 min) — on accède à vos données réelles de consommation heure par heure pour produire un rapport détaillé personnalisé.",
    en: "Sign a Hydro-Québec proxy (2 min) — we access your real hour-by-hour consumption data to produce a detailed personalized report."
  },
  "landing.step2.time": { fr: "48-72h", en: "48-72h" },
  // Phase Conception
  "landing.step3.title": { fr: "Mandat de conception préliminaire", en: "Preliminary Design Mandate" },
  "landing.step3.description": {
    fr: "Vous signez le mandat de conception préliminaire (2 500$ + taxes). Ce montant couvre la visite technique et la validation terrain. Crédité intégralement si vous signez le contrat EPC.",
    en: "You sign the preliminary design mandate ($2,500 + taxes). This covers the technical visit and site validation. Fully credited if you sign the EPC contract."
  },
  "landing.step3.time": { fr: "Signature + frais", en: "Signature + fees" },
  "landing.step4.title": { fr: "Visite & proposition", en: "Visit & Proposal" },
  "landing.step4.description": {
    fr: "Visite sur site par un ingénieur certifié, analyse structurelle, conception préliminaire — puis proposition ferme avec prix garanti et échéancier détaillé.",
    en: "On-site visit by certified engineer, structural analysis, preliminary design — then firm proposal with guaranteed price and detailed timeline."
  },
  "landing.step4.time": { fr: "2-3 semaines", en: "2-3 weeks" },
  // Phase Réalisation
  "landing.step5.title": { fr: "Permis & approvisionnement", en: "Permits & Procurement" },
  "landing.step5.description": {
    fr: "Plans finaux, permis municipaux et électriques, demande d'interconnexion Hydro-Québec, commande d'équipement — on gère tout, vous recevez des mises à jour régulières.",
    en: "Final plans, municipal and electrical permits, Hydro-Québec interconnection application, equipment ordering — we handle everything, you receive regular updates."
  },
  "landing.step5.time": { fr: "6-10 semaines", en: "6-10 weeks" },
  "landing.step6.title": { fr: "Installation & mise en service", en: "Installation & Commissioning" },
  "landing.step6.description": {
    fr: "Montage, câblage, onduleurs, inspections, raccordement Hydro-Québec, activation du système — début de vos économies. Monitoring et support continu inclus.",
    en: "Mounting, wiring, inverters, inspections, Hydro-Québec connection, system activation — start saving. Monitoring and ongoing support included."
  },
  "landing.step6.time": { fr: "4-8 semaines", en: "4-8 weeks" },

  // Landing Page - Process
  "landing.process.title": { fr: "Votre parcours simplifié", en: "Your Simplified Journey" },
  "landing.process.subtitle": {
    fr: "De l'analyse gratuite à la production d'énergie — en 6 étapes claires",
    en: "From free analysis to energy production — in 6 clear steps"
  },
  "landing.process.phase.discovery": { fr: "Découverte", en: "Discovery" },
  "landing.process.phase.design": { fr: "Conception", en: "Design" },
  "landing.process.phase.execution": { fr: "Réalisation", en: "Execution" },
  "landing.process.youAreHere": { fr: "Commencez ici", en: "Start here" },
  "landing.process.nextSteps": { fr: "Prochaines étapes", en: "Next steps" },
  "landing.step1.highlight": {
    fr: "Téléversez votre facture Hydro-Québec — notre IA l'analyse instantanément et calcule votre potentiel.",
    en: "Upload your Hydro-Québec bill — our AI analyzes it instantly and calculates your potential."
  },
  
  // Landing Page - Benefits
  "landing.benefits.title": { fr: "Ce que vous obtenez", en: "What you get" },
  "landing.benefits.subtitle": { fr: "Une approche complète pour votre projet solaire", en: "A complete approach for your solar project" },
  "landing.benefits.analysis": { fr: "Analyse personnalisée", en: "Personalized analysis" },
  "landing.benefits.analysisDesc": { fr: "Analyse heure par heure basée sur vos données réelles", en: "Hour-by-hour analysis based on your real data" },
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
  "landing.footer.tagline": { fr: "L'énergie solaire, optimisée pour votre réalité", en: "Solar energy, optimized for your reality" },

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
  "form.companyName": { fr: "Entreprise", en: "Company" },
  "form.contact": { fr: "Nom du contact", en: "Contact name" },
  "form.contactName": { fr: "Nom du contact", en: "Contact name" },
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
  "sites.roofValidated": { fr: "Toit validé", en: "Roof validated" },
  "sites.roofPending": { fr: "Toit à dessiner", en: "Roof pending" },
  "sites.empty": { fr: "Aucun site", en: "No sites" },
  "sites.emptyDescription": { fr: "Ajoutez un site pour commencer l'analyse.", en: "Add a site to start the analysis." },
  "sites.moreOptions": { fr: "Plus d'options", en: "More Options" },
  "sites.roofType": { fr: "Type de toiture", en: "Roof type" },
  "sites.roofType.flat": { fr: "Plat", en: "Flat" },
  "sites.roofType.inclined": { fr: "Incliné", en: "Inclined" },
  "sites.roofType.other": { fr: "Autre", en: "Other" },
  "sites.roofArea": { fr: "Surface de toiture (m²)", en: "Roof area (m²)" },
  "sites.latitude": { fr: "Latitude", en: "Latitude" },
  "sites.longitude": { fr: "Longitude", en: "Longitude" },
  "sites.gpsCoordinates": { fr: "Coordonnées GPS", en: "GPS Coordinates" },

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

  // Analysis Results — new sections
  "analysis.assumptions": { fr: "Hypothèses et exclusions", en: "Assumptions & Exclusions" },
  "analysis.assumptions.title": { fr: "Hypothèses", en: "Assumptions" },
  "analysis.exclusions.title": { fr: "Exclusions", en: "Exclusions" },
  "analysis.equipment": { fr: "Équipement et garanties", en: "Equipment & Warranties" },
  "analysis.timeline": { fr: "Échéancier type", en: "Typical Timeline" },
  "analysis.timeline.note": { fr: "Délais sujets à approbation Hydro-Québec", en: "Timelines subject to Hydro-Québec approval" },
  "analysis.credibility": { fr: "Ils nous font confiance", en: "They Trust Us" },
  "analysis.equipment.note": { fr: "Équipement indicatif — marques et modèles confirmés dans la soumission ferme", en: "Indicative equipment — brands and models confirmed in the firm quote" },

  // Presentation slides (interactive HTML)
  "presentation.snapshot": { fr: "Aperçu du projet", en: "Project Snapshot" },
  "presentation.kpi": { fr: "Vos résultats", en: "Your Results" },
  "presentation.waterfall": { fr: "Ventilation de l'investissement", en: "Investment Breakdown" },
  "presentation.roofConfig": { fr: "Configuration toiture", en: "Roof Configuration" },
  "presentation.cashflow": { fr: "Projections financières", en: "Financial Projections" },
  "presentation.assumptions": { fr: "Hypothèses et exclusions", en: "Assumptions & Exclusions" },
  "presentation.equipment": { fr: "Équipement et garanties", en: "Equipment & Warranties" },
  "presentation.timeline": { fr: "Échéancier type", en: "Typical Timeline" },
  "presentation.nextSteps": { fr: "Prochaines étapes", en: "Next Steps" },
  "presentation.credibility": { fr: "Ils nous font confiance", en: "They Trust Us" },
  "presentation.costOfInaction": { fr: "Coût de l'inaction sur 25 ans", en: "Cost of inaction over 25 years" },
  "presentation.sizingSummary": { fr: "Dimensionnement", en: "Sizing Summary" },

  // Bifacial PV detection
  "bifacial.detected.title": { fr: "Membrane blanche détectée", en: "White membrane detected" },
  "bifacial.detected.description": { fr: "Notre analyse d'imagerie a détecté une membrane de toiture blanche hautement réfléchissante. Les panneaux solaires bi-faciaux peuvent capter la lumière réfléchie du toit, augmentant potentiellement la production d'énergie de 10-15%.", en: "Our imagery analysis detected a highly reflective white roof membrane. Bi-facial solar panels can capture reflected light from the roof, potentially increasing energy production by 10-15%." },
  "bifacial.detected.question": { fr: "Voulez-vous analyser le solaire bi-facial pour ce bâtiment?", en: "Do you want to analyze bi-facial solar for this building?" },
  "bifacial.detected.accept": { fr: "Oui, analyser bi-facial", en: "Yes, analyze bi-facial" },
  "bifacial.detected.decline": { fr: "Non, continuer standard", en: "No, continue standard" },
  "bifacial.enabled": { fr: "Solaire bi-facial activé", en: "Bi-facial solar enabled" },
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
  "analysis.recommendedPV": { fr: "Solaire recommandé", en: "Recommended Solar" },
  "analysis.recommendedBattery": { fr: "Stockage recommandé", en: "Recommended Storage" },
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
  "design.selectBattery": { fr: "Sélectionner le stockage", en: "Select storage" },
  "design.pvSize": { fr: "Taille solaire (kWc)", en: "Solar size (kWp)" },
  "design.batteryEnergy": { fr: "Énergie stockage (kWh)", en: "Storage energy (kWh)" },
  "design.batteryPower": { fr: "Puissance stockage (kW)", en: "Storage power (kW)" },
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
  "design.configuration": { fr: "Configuration du design", en: "Design Configuration" },
  "design.selectPlaceholder": { fr: "Sélectionner...", en: "Select..." },
  "design.summary": { fr: "Résumé", en: "Summary" },
  "design.recommendedBattery": { fr: "Stockage recommandé", en: "Recommended storage" },
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
  "common.download": { fr: "Télécharger", en: "Download" },
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
  "catalog.module": { fr: "Module solaire", en: "Solar Module" },
  "catalog.inverter": { fr: "Onduleur", en: "Inverter" },
  "catalog.battery": { fr: "Stockage", en: "Storage" },
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
  "design.simulationNotFound": { fr: "Simulation non trouvée", en: "Simulation not found" },
  "design.generateSchedule": { fr: "Générer calendrier préliminaire", en: "Generate Preliminary Schedule" },
  "design.scheduleGenerated": { fr: "Calendrier préliminaire généré", en: "Preliminary schedule generated" },
  "design.scheduleGeneratedDesc": { fr: "Les tâches ont été créées avec succès", en: "Tasks have been created successfully" },
  "design.viewGantt": { fr: "Voir le diagramme Gantt", en: "View GANTT Chart" },
  "design.selectStartDate": { fr: "Sélectionner la date de début", en: "Select Start Date" },
  "design.projectStartDate": { fr: "Date de début du projet", en: "Project Start Date" },
  "design.scheduleDialogTitle": { fr: "Générer le calendrier préliminaire", en: "Generate Preliminary Schedule" },
  "design.scheduleDialogDesc": { fr: "Sélectionnez la date de début prévue pour générer automatiquement les tâches de construction basées sur le BOM.", en: "Select the planned start date to auto-generate construction tasks based on the BOM." },
  "design.generateScheduleError": { fr: "Erreur lors de la génération du calendrier", en: "Error generating schedule" },

  // Sites
  "sites.createError": { fr: "Erreur lors de la création", en: "Error creating site" },
  "sites.updateError": { fr: "Erreur lors de la mise à jour", en: "Error updating site" },
  "sites.deleteError": { fr: "Erreur lors de la suppression", en: "Error deleting site" },
  "sites.createClientFirst": { fr: "Créer un client d'abord", en: "Create a client first" },
  "sites.siteCreated": { fr: "Site créé", en: "Site created" },
  "sites.siteUpdated": { fr: "Site mis à jour", en: "Site updated" },
  "sites.siteDeleted": { fr: "Site supprimé", en: "Site deleted" },

  // Activities
  "activity.title": { fr: "Activités", en: "Activities" },

  // Clients
  "clients.subtitle": { fr: "Gérez vos clients et leurs sites", en: "Manage your clients and their sites" },
  "clients.createError": { fr: "Erreur lors de la création", en: "Error creating client" },
  "clients.updateError": { fr: "Erreur lors de la mise à jour", en: "Error updating client" },
  "clients.deleteError": { fr: "Erreur lors de la suppression", en: "Error deleting client" },
  "clients.clientCreated": { fr: "Client créé", en: "Client created" },
  "clients.clientUpdated": { fr: "Client mis à jour", en: "Client updated" },
  "clients.clientDeleted": { fr: "Client supprimé", en: "Client deleted" },
  "clients.grantPortalAccess": { fr: "Accorder l'accès au portail", en: "Grant Portal Access" },
  "clients.sendHqProcuration": { fr: "Envoyer procuration Hydro-Québec", en: "Send Hydro-Québec Procuration" },
  "clients.procurationSent": { fr: "Procuration envoyée", en: "Procuration sent" },
  "clients.procurationSendError": { fr: "Erreur d'envoi de la procuration", en: "Error sending procuration" },

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

  // Procurations Management
  "procurations.title": { fr: "Procurations Hydro-Québec", en: "Hydro-Québec Authorizations" },
  "procurations.description": { fr: "Gérez les procurations Hydro-Québec signées par les prospects", en: "Manage Hydro-Québec authorizations signed by prospects" },
  "procurations.recentTitle": { fr: "Procurations récentes", en: "Recent Authorizations" },
  "procurations.recentDescription": { fr: "Documents signés électroniquement via le formulaire d'analyse détaillée", en: "Documents signed electronically via the detailed analysis form" },
  "procurations.company": { fr: "Entreprise", en: "Company" },
  "procurations.contact": { fr: "Contact", en: "Contact" },
  "procurations.date": { fr: "Date de signature", en: "Signature Date" },
  "procurations.size": { fr: "Taille", en: "Size" },
  "procurations.unknown": { fr: "Inconnu", en: "Unknown" },
  "procurations.empty": { fr: "Aucune procuration disponible", en: "No authorizations available" },
  "procurations.infoTitle": { fr: "Processus de procuration", en: "Authorization Process" },

  // Scenario Comparison
  "compare.title": { fr: "Comparer", en: "Compare" },
  "compare.scenarios": { fr: "Comparaison des scénarios", en: "Scenario Comparison" },
  "compare.noScenarios": { fr: "Exécutez plusieurs analyses pour comparer les scénarios.", en: "Run multiple analyses to compare scenarios." },
  "compare.scenario": { fr: "Scénario", en: "Scenario" },
  "compare.best": { fr: "Meilleur", en: "Best" },
  "compare.pvSize": { fr: "Solaire (kWc)", en: "Solar (kWp)" },
  "compare.batterySize": { fr: "Stockage (kWh)", en: "Storage (kWh)" },
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
  "variant.pvSize": { fr: "Taille solaire (kWc)", en: "Solar Size (kWp)" },
  "variant.batterySize": { fr: "Stockage (kWh)", en: "Storage (kWh)" },
  "variant.batteryPower": { fr: "Puissance stockage (kW)", en: "Storage Power (kW)" },
  "variant.runAnalysis": { fr: "Lancer l'analyse", en: "Run Analysis" },
  "variant.cancel": { fr: "Annuler", en: "Cancel" },
  "variant.success": { fr: "Nouvelle variante créée", en: "New variant created" },
  "variant.error": { fr: "Erreur lors de la création", en: "Error creating variant" },

  // Financing Calculator
  "financing.title": { fr: "Options d'acquisition", en: "Acquisition Options" },
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
  "financing.ppa": { fr: "PPA Tiers", en: "Third-Party PPA" },
  "financing.ppaTerm": { fr: "Durée PPA (ans)", en: "PPA Term (years)" },
  "financing.ppaYear1Rate": { fr: "An 1: % tarif Hydro-Québec", en: "Year 1: % of Hydro-Québec rate" },
  "financing.ppaYear2Rate": { fr: "An 2+: % tarif Hydro-Québec", en: "Year 2+: % of Hydro-Québec rate" },
  "financing.ppaLegalWarning": { 
    fr: "⚠️ AVERTISSEMENT LÉGAL: Au Québec, les PPA tiers (achat d'électricité d'un producteur autre qu'Hydro-Québec) opèrent dans une zone grise réglementaire. Cette option est présentée à titre comparatif uniquement. Consultez un avocat spécialisé en énergie avant de considérer ce modèle.", 
    en: "⚠️ LEGAL WARNING: In Quebec, third-party PPAs (purchasing electricity from a producer other than Hydro-Québec) operate in a regulatory gray area. This option is presented for comparison purposes only. Consult an energy lawyer before considering this model." 
  },
  "financing.ppaNoIncentives": { fr: "Incitatifs conservés par le fournisseur PPA", en: "Incentives retained by PPA provider" },
  "financing.ppaTransfer": { fr: "Transfert propriété après terme", en: "Ownership transfer after term" },
  "financing.ppaCompetitorModel": { fr: "Modèle concurrent (ex: TRC Solar)", en: "Competitor model (e.g., TRC Solar)" },

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
  "siteVisit.signAgreementFirst": { fr: "Obtenez d'abord un mandat de conception signé pour planifier une visite technique.", en: "Get a signed design mandate first to schedule a technical visit." },
  
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
  
  // Site Visit - Additional Fields
  "siteVisit.numberOfMeters": { fr: "Nombre de compteurs", en: "Number of Meters" },
  "siteVisit.roofSurfaceArea": { fr: "Surface de toiture (m²)", en: "Roof Surface Area (m²)" },
  "siteVisit.circuitBreaker": { fr: "Disjoncteur principal", en: "Main Circuit Breaker" },
  "siteVisit.circuitBreakerManufacturer": { fr: "Fabricant disjoncteur", en: "Breaker Manufacturer" },
  "siteVisit.circuitBreakerModel": { fr: "Modèle disjoncteur", en: "Breaker Model" },
  "siteVisit.disconnectSwitch": { fr: "Sectionneur principal", en: "Main Disconnect Switch" },
  "siteVisit.disconnectSwitchManufacturer": { fr: "Fabricant sectionneur", en: "Disconnect Manufacturer" },
  "siteVisit.disconnectSwitchModel": { fr: "Modèle sectionneur", en: "Disconnect Model" },
  "siteVisit.secondaryElectrical": { fr: "Équipement électrique secondaire", en: "Secondary Electrical Equipment" },
  "siteVisit.manufacturer": { fr: "Fabricant", en: "Manufacturer" },
  "siteVisit.model": { fr: "Modèle", en: "Model" },
  "siteVisit.secondaryPanel": { fr: "Panneau secondaire", en: "Secondary Panel" },
  "siteVisit.secondaryBreaker": { fr: "Disjoncteur secondaire", en: "Secondary Breaker" },
  "siteVisit.secondaryDisconnect": { fr: "Sectionneur secondaire", en: "Secondary Disconnect" },
  "siteVisit.secondaryPanelManufacturer": { fr: "Fabricant panneau secondaire", en: "Secondary Panel Manufacturer" },
  "siteVisit.secondaryPanelModel": { fr: "Modèle panneau secondaire", en: "Secondary Panel Model" },
  "siteVisit.secondaryBreakerManufacturer": { fr: "Fabricant disjoncteur secondaire", en: "Secondary Breaker Manufacturer" },
  "siteVisit.secondaryBreakerModel": { fr: "Modèle disjoncteur secondaire", en: "Secondary Breaker Model" },
  "siteVisit.secondaryDisconnectManufacturer": { fr: "Fabricant sectionneur secondaire", en: "Secondary Disconnect Manufacturer" },
  "siteVisit.secondaryDisconnectModel": { fr: "Modèle sectionneur secondaire", en: "Secondary Disconnect Model" },
  "siteVisit.documentation": { fr: "Documentation", en: "Documentation" },
  "siteVisit.photosTaken": { fr: "Photos prises", en: "Photos Taken" },
  "siteVisit.documentsCollected": { fr: "Documents collectés", en: "Documents Collected" },
  "siteVisit.electricalDrawings": { fr: "Dessins électriques", en: "Electrical Drawings" },
  "siteVisit.meterDetails": { fr: "Détails compteur", en: "Meter Details" },
  "siteVisit.otherDocuments": { fr: "Autres documents", en: "Other Documents" },
  "siteVisit.inspectorSignature": { fr: "Signature de l'inspecteur", en: "Inspector Signature" },
  "siteVisit.signatureConfirmation": { fr: "Confirmation de signature", en: "Signature Confirmation" },
  "siteVisit.accessMethod.ladder": { fr: "Échelle", en: "Ladder" },
  "siteVisit.accessMethod.trapdoor": { fr: "Trappe", en: "Trapdoor" },
  "siteVisit.accessMethod.stairs": { fr: "Escalier", en: "Stairs" },
  "siteVisit.accessMethod.lift": { fr: "Nacelle / Lift", en: "Lift / Cherry picker" },
  "siteVisit.accessMethod.other": { fr: "Autre", en: "Other" },
  "siteVisit.downloadPdf": { fr: "Télécharger le rapport PDF", en: "Download PDF Report" },
  
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

  // Design Mandate (Step 3)
  "designAgreement.title": { fr: "Mandat de conception préliminaire (Étape 3)", en: "Preliminary Design Mandate (Step 3)" },
  "designAgreement.subtitle": { fr: "Première étape payante vers votre projet solaire", en: "First paid step toward your solar project" },
  "designAgreement.generate": { fr: "Générer l'entente", en: "Generate Agreement" },
  "designAgreement.generateDescription": { fr: "Créez un mandat de conception pour formaliser les coûts de visite technique et livrables.", en: "Create a design mandate to formalize technical visit costs and deliverables." },
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
  "designAgreement.deliverable3": { fr: "Dessins d'implantation solaire", en: "Solar layout drawings" },
  "designAgreement.deliverable4": { fr: "Schéma unifilaire (si requis)", en: "Single line diagram (if required)" },
  "designAgreement.deliverable5": { fr: "Soumission détaillée à prix fixe", en: "Detailed fixed-price quote" },
  "designAgreement.send": { fr: "Envoyer au client", en: "Send to Client" },
  "designAgreement.markAccepted": { fr: "Marquer comme acceptée", en: "Mark as Accepted" },
  "designAgreement.noVisit": { fr: "Aucune visite technique planifiée", en: "No technical visit scheduled" },
  "designAgreement.scheduleVisitFirst": { fr: "Planifiez d'abord une visite technique pour générer un mandat de conception.", en: "Schedule a technical visit first to generate a design mandate." },
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
  "designAgreement.introText": { fr: "Ce mandat couvre les frais de conception technique préalables à une soumission à prix fixe pour votre projet solaire. Les travaux inclus vous permettent d'obtenir tous les documents nécessaires pour prendre une décision éclairée.", en: "This mandate covers the technical design fees required before providing a fixed-price quote for your solar project. The included work provides you with all the documents needed to make an informed decision." },
  
  "designAgreement.deliverablesDetailed": { fr: "Ce qui est inclus", en: "What's Included" },
  "designAgreement.deliverableDetail1": { fr: "Visite technique complète du site par un technicien certifié", en: "Complete on-site technical visit by a certified technician" },
  "designAgreement.deliverableDetail2": { fr: "Relevé des dimensions de toiture et identification des obstacles", en: "Roof dimension survey and obstacle identification" },
  "designAgreement.deliverableDetail3": { fr: "Évaluation de la structure et de la capacité portante", en: "Structure and load-bearing capacity assessment" },
  "designAgreement.deliverableDetail4": { fr: "Documentation photographique complète du site", en: "Complete photographic documentation of the site" },
  "designAgreement.deliverableDetail5": { fr: "Dessins d'implantation solaire (layout) professionnels", en: "Professional solar layout drawings" },
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
  "designAgreement.creditPolicyText": { fr: "Le montant du mandat de conception préliminaire est crédité intégralement sur votre contrat EPC si vous procédez avec kWh Québec.", en: "The preliminary design mandate amount is fully credited toward your EPC contract if you proceed with kWh Québec." },
  
  // Pricing Configuration Dialog
  "designAgreement.pricingConfig": { fr: "Configuration des coûts", en: "Pricing Configuration" },
  "designAgreement.pricingConfigDescription": { fr: "Configurez les coûts du mandat de conception basés sur le système et les services requis.", en: "Configure design mandate costs based on the system and required services." },
  "designAgreement.systemConfig": { fr: "Configuration du système", en: "System Configuration" },
  "designAgreement.numBuildings": { fr: "Nombre de bâtiments", en: "Number of Buildings" },
  "designAgreement.travelDays": { fr: "Jours de déplacement", en: "Travel Days" },
  "designAgreement.pvSizeKW": { fr: "Taille solaire (kW)", en: "Solar Size (kW)" },
  "designAgreement.battEnergyKWh": { fr: "Stockage (kWh)", en: "Storage (kWh)" },
  "designAgreement.engineeringStamps": { fr: "Certifications d'ingénieur", en: "Engineering Stamps" },
  "designAgreement.structuralStamp": { fr: "Certification structure (toiture)", en: "Structural stamp (roof)" },
  "designAgreement.electricalStamp": { fr: "Certification électrique (SLD)", en: "Electrical stamp (SLD)" },
  "designAgreement.costSummary": { fr: "Résumé des coûts", en: "Cost Summary" },
  "designAgreement.baseFee": { fr: "Frais de base", en: "Base Fee" },
  "designAgreement.pvFee": { fr: "Frais solaire", en: "Solar Fee" },
  "designAgreement.batteryFee": { fr: "Frais stockage", en: "Storage Fee" },
  "designAgreement.travelFee": { fr: "Frais de déplacement", en: "Travel Fee" },
  
  "designAgreement.importantNotes": { fr: "Notes importantes", en: "Important Notes" },
  "designAgreement.note1": { fr: "Le montant du mandat est crédité sur le contrat EPC si vous procédez. L'ingénierie structurelle et les plans détaillés sont inclus dans le contrat EPC.", en: "The mandate amount is credited toward the EPC contract if you proceed. Structural engineering and detailed plans are included in the EPC contract." },
  "designAgreement.note2": { fr: "Cette entente est valide pour 30 jours à compter de la date d'émission.", en: "This agreement is valid for 30 days from the issue date." },
  "designAgreement.note3": { fr: "Les travaux de conception appartiennent à kWh Québec jusqu'au paiement final.", en: "Design work belongs to kWh Québec until final payment." },
  
  // Delete agreement
  "designAgreement.delete": { fr: "Supprimer", en: "Delete" },
  "designAgreement.deleted": { fr: "Entente supprimée", en: "Agreement deleted" },
  "designAgreement.deleteError": { fr: "Erreur lors de la suppression", en: "Error deleting agreement" },
  "designAgreement.deleteConfirmTitle": { fr: "Supprimer cette entente?", en: "Delete this agreement?" },
  "designAgreement.deleteConfirmDescription": { fr: "Cette action est irréversible. Le mandat de conception sera supprimé définitivement et vous pourrez en créer un nouveau.", en: "This action cannot be undone. The design mandate will be permanently deleted and you can create a new one." },
  
  // Public signing page
  "publicAgreement.title": { fr: "Mandat de conception préliminaire", en: "Preliminary Design Mandate" },
  "publicAgreement.preparedFor": { fr: "Préparé pour", en: "Prepared for" },
  "publicAgreement.site": { fr: "Site", en: "Site" },
  "publicAgreement.projectScope": { fr: "Portée du projet", en: "Project Scope" },
  "publicAgreement.scopeDescription": { fr: "Cette entente couvre les services de conception technique préalables à l'installation de votre système solaire photovoltaïque.", en: "This agreement covers the technical design services prior to the installation of your solar photovoltaic system." },
  "publicAgreement.termsTitle": { fr: "Termes et conditions", en: "Terms and Conditions" },
  "publicAgreement.term1": { fr: "Les travaux débuteront dans les 10 jours ouvrables suivant la réception du dépôt.", en: "Work will begin within 10 business days of receiving the deposit." },
  "publicAgreement.term2": { fr: "Les livrables seront fournis sous forme électronique.", en: "Deliverables will be provided in electronic format." },
  "publicAgreement.term3": { fr: "Cette soumission est valide pour 30 jours.", en: "This quote is valid for 30 days." },
  "publicAgreement.term4": { fr: "Le dépôt de 50% couvre les services d'ingénierie et la visite technique inclus dans le mandat de conception.", en: "The 50% deposit covers the engineering services and technical visit included in the design mandate." },
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
  
  // Step tracker
  "publicAgreement.step1": { fr: "Révision", en: "Review Details" },
  "publicAgreement.step2": { fr: "Signature & Paiement", en: "Sign & Pay" },
  "publicAgreement.step3": { fr: "Confirmation", en: "Confirmation" },
  
  // Success animation / What's next
  "publicAgreement.agreementSigned": { fr: "Entente signée!", en: "Agreement Signed!" },
  "publicAgreement.whatsNext": { fr: "Prochaines étapes", en: "What's Next" },
  "publicAgreement.nextStep1": { fr: "Vous recevrez une confirmation par courriel", en: "You will receive an email confirmation" },
  "publicAgreement.nextStep1Time": { fr: "Immédiat", en: "Immediate" },
  "publicAgreement.nextStep2": { fr: "Notre équipe planifiera la visite technique", en: "Our team will schedule the technical visit" },
  "publicAgreement.nextStep2Time": { fr: "24-48h", en: "24-48h" },
  "publicAgreement.nextStep3": { fr: "Visite sur site et collecte de données", en: "Site visit and data collection" },
  "publicAgreement.nextStep3Time": { fr: "1-2 semaines", en: "1-2 weeks" },
  "publicAgreement.nextStep4": { fr: "Livraison du design complet", en: "Delivery of complete design" },
  "publicAgreement.nextStep4Time": { fr: "2-3 semaines", en: "2-3 weeks" },
  "publicAgreement.downloadAgreement": { fr: "Télécharger l'entente signée", en: "Download Signed Agreement" },
  "publicAgreement.contactUs": { fr: "Des questions? Contactez-nous", en: "Questions? Contact us" },
  "publicAgreement.contactEmail": { fr: "info@kwh.quebec", en: "info@kwh.quebec" },
  "publicAgreement.contactPhone": { fr: "514.427.8871", en: "514.427.8871" },

  // Email Dialog for Design Agreement
  "designAgreement.emailDialog.title": { fr: "Envoyer l'entente par courriel", en: "Send Agreement by Email" },
  "designAgreement.emailDialog.description": { fr: "Personnalisez le message avant d'envoyer le mandat de conception au client.", en: "Customize the message before sending the design mandate to the client." },
  "designAgreement.emailDialog.recipientEmail": { fr: "Courriel du destinataire", en: "Recipient Email" },
  "designAgreement.emailDialog.recipientName": { fr: "Nom du destinataire", en: "Recipient Name" },
  "designAgreement.emailDialog.subject": { fr: "Sujet", en: "Subject" },
  "designAgreement.emailDialog.message": { fr: "Message", en: "Message" },
  "designAgreement.emailDialog.send": { fr: "Envoyer", en: "Send" },
  "designAgreement.emailDialog.sending": { fr: "Envoi en cours...", en: "Sending..." },
  "designAgreement.emailDialog.success": { fr: "Courriel envoyé avec succès!", en: "Email sent successfully!" },
  "designAgreement.emailDialog.error": { fr: "Erreur lors de l'envoi du courriel", en: "Error sending email" },
  "designAgreement.emailDialog.defaultSubject": { fr: "Mandat de conception préliminaire - {{siteName}}", en: "Preliminary Design Mandate - {{siteName}}" },
  "designAgreement.emailDialog.defaultBody": { fr: "Bonjour {{clientName}},\n\nVeuillez trouver ci-joint votre mandat de conception pour le site {{siteName}}.\n\nCe mandat détaille les coûts et livrables pour la conception technique de votre projet solaire.\n\nCordialement,\nL'équipe kWh Québec", en: "Hello {{clientName}},\n\nPlease find attached your design mandate for the site {{siteName}}.\n\nThis mandate details the costs and deliverables for the technical design of your solar project.\n\nBest regards,\nThe kWh Québec team" },
  "designAgreement.emailHistory": { fr: "Historique d'envois", en: "Email History" },
  "designAgreement.emailSentOn": { fr: "Envoyé le {{date}} à {{email}}", en: "Sent on {{date}} to {{email}}" },
  "designAgreement.noEmailsSent": { fr: "Aucun courriel envoyé", en: "No emails sent" },
  "designAgreement.resend": { fr: "Renvoyer", en: "Resend" },

  // GANTT Chart
  "gantt.title": { fr: "Diagramme de Gantt", en: "GANTT Chart" },
  "gantt.subtitle": { fr: "Visualisation des tâches de construction", en: "Construction tasks visualization" },
  "gantt.allProjects": { fr: "Tous les projets", en: "All Projects" },
  "gantt.selectProject": { fr: "Sélectionner un projet", en: "Select Project" },
  "gantt.noTasks": { fr: "Aucune tâche de construction", en: "No construction tasks" },
  "gantt.noTasksDescription": { fr: "Créez des tâches dans vos projets de construction pour les voir ici.", en: "Create tasks in your construction projects to see them here." },
  "gantt.timeScale.days": { fr: "Jours", en: "Days" },
  "gantt.timeScale.weeks": { fr: "Semaines", en: "Weeks" },
  "gantt.timeScale.months": { fr: "Mois", en: "Months" },
  "gantt.today": { fr: "Aujourd'hui", en: "Today" },
  "gantt.taskDetails": { fr: "Détails de la tâche", en: "Task Details" },
  "gantt.planned": { fr: "Planifié", en: "Planned" },
  "gantt.actual": { fr: "Réel", en: "Actual" },
  "gantt.progress": { fr: "Progression", en: "Progress" },
  "gantt.dependencies": { fr: "Dépendances", en: "Dependencies" },
  "gantt.status": { fr: "Statut", en: "Status" },
  "gantt.category": { fr: "Catégorie", en: "Category" },
  "gantt.assignedTo": { fr: "Assigné à", en: "Assigned To" },
  "gantt.legend": { fr: "Légende", en: "Legend" },
  "gantt.plannedDates": { fr: "Dates planifiées", en: "Planned Dates" },
  "gantt.actualOnTime": { fr: "Réel (à temps)", en: "Actual (on time)" },
  "gantt.actualDelayed": { fr: "Réel (retardé)", en: "Actual (delayed)" },
  "gantt.status.pending": { fr: "En attente", en: "Pending" },
  "gantt.status.in_progress": { fr: "En cours", en: "In Progress" },
  "gantt.status.blocked": { fr: "Bloqué", en: "Blocked" },
  "gantt.status.completed": { fr: "Terminé", en: "Completed" },
  "gantt.status.cancelled": { fr: "Annulé", en: "Cancelled" },
  "gantt.category.permitting": { fr: "Permis", en: "Permitting" },
  "gantt.category.procurement": { fr: "Approvisionnement", en: "Procurement" },
  "gantt.category.electrical": { fr: "Électrique", en: "Electrical" },
  "gantt.category.mechanical": { fr: "Mécanique", en: "Mechanical" },
  "gantt.category.structural": { fr: "Structure", en: "Structural" },
  "gantt.category.inspection": { fr: "Inspection", en: "Inspection" },
  "gantt.category.general": { fr: "Général", en: "General" },
  "gantt.category.commissioning": { fr: "Mise en service", en: "Commissioning" },
  "gantt.preliminary": { fr: "Préliminaire", en: "Preliminary" },
  "gantt.preliminaryTask": { fr: "Tâche préliminaire (auto-générée)", en: "Preliminary task (auto-generated)" },

  // Blog / Articles
  "blog.title": { fr: "Ressources et guides", en: "Resources & Guides" },
  "blog.subtitle": { fr: "Tout ce que vous devez savoir sur le solaire commercial au Québec", en: "Everything you need to know about commercial solar in Québec" },
  "blog.readMore": { fr: "Lire l'article", en: "Read article" },
  "blog.backToList": { fr: "Retour aux articles", en: "Back to articles" },
  "blog.publishedOn": { fr: "Publié le", en: "Published on" },
  "blog.category.guide": { fr: "Guide", en: "Guide" },
  "blog.category.news": { fr: "Actualité", en: "News" },
  "blog.category.case-study": { fr: "Étude de cas", en: "Case Study" },
  "blog.category.program": { fr: "Programme", en: "Program" },
  "blog.noArticles": { fr: "Aucun article pour le moment", en: "No articles yet" },
  "blog.relatedArticles": { fr: "Articles connexes", en: "Related Articles" },
  "blog.shareArticle": { fr: "Partager cet article", en: "Share this article" },
  "blog.ctaTitle": { fr: "Prêt à passer à l'action?", en: "Ready to take action?" },
  "blog.ctaDescription": { fr: "Obtenez une estimation gratuite du potentiel solaire de votre bâtiment.", en: "Get a free solar potential estimate for your building." },
  "blog.ctaButton": { fr: "Demander mon analyse", en: "Request my analysis" },

  // KB Racking Dashboard
  "kbRacking.title": { fr: "Tableau de bord KB Racking", en: "KB Racking Dashboard" },
  "kbRacking.subtitle": { fr: "Statistiques de portefeuille d'arrimage KB", en: "KB Racking Portfolio Statistics" },
  "kbRacking.totalMW": { fr: "MW total conçu", en: "Total MW Designed" },
  "kbRacking.totalValue": { fr: "Valeur totale d'arrimage", en: "Total Racking Value" },
  "kbRacking.sitesWithDesign": { fr: "Sites avec design KB", en: "Sites with KB Design" },
  "kbRacking.avgPrice": { fr: "Prix moyen par panneau", en: "Average Price per Panel" },
  "kbRacking.priceRange": { fr: "Plage de prix", en: "Price Range" },
  "kbRacking.expiringSoon": { fr: "Devis expirant bientôt", en: "Quotes Expiring Soon" },
  "kbRacking.daysPlural": { fr: "jours", en: "days" },
  "kbRacking.daysSingular": { fr: "jour", en: "day" },
  "kbRacking.expired": { fr: "Devis expirés", en: "Expired Quotes" },
  "kbRacking.loading": { fr: "Chargement des statistiques KB...", en: "Loading KB statistics..." },
  "kbRacking.error": { fr: "Erreur lors du chargement des données KB", en: "Error loading KB data" },
  "kbRacking.noData": { fr: "Aucune donnée KB Racking disponible", en: "No KB Racking data available" },
  "kbRacking.warning": { fr: "Attention", en: "Warning" },
  "kbRacking.alert": { fr: "Alerte", en: "Alert" },
  "kbRacking.min": { fr: "Min", en: "Min" },
  "kbRacking.max": { fr: "Max", en: "Max" },

  // Tripwire - Design Mandate
  "tripwire.title": { fr: "Mandat de conception préliminaire", en: "Preliminary Design Mandate" },
  "tripwire.subtitle": { fr: "L'étape intelligente avant d'investir", en: "The smart step before investing" },
  "tripwire.price": { fr: "2 500$", en: "$2,500" },
  "tripwire.description": {
    fr: "Avant d'engager plusieurs centaines de milliers de dollars, validez votre projet avec un mandat de conception complet et professionnel.",
    en: "Before committing hundreds of thousands, validate your project with a complete, professional design mandate."
  },
  "tripwire.includes.title": { fr: "L'étude comprend:", en: "The study includes:" },
  "tripwire.includes.siteVisit": { fr: "Visite sur site avec mesures précises", en: "On-site visit with precise measurements" },
  "tripwire.includes.shadeAnalysis": { fr: "Analyse d'ombrage avancée (3D)", en: "Advanced 3D shade analysis" },
  "tripwire.includes.roofModel": { fr: "Modèle 3D de votre toiture", en: "3D roof model" },
  "tripwire.includes.optimalDesign": { fr: "Design de système optimal (PV + batterie)", en: "Optimal system design (PV + storage)" },
  "tripwire.includes.roiProjections": { fr: "Projections de ROI sur 25 ans", en: "25-year ROI projections" },
  "tripwire.includes.financingComparison": { fr: "Comparaison des options de financement", en: "Financing options comparison" },
  "tripwire.includes.incentiveOptimization": { fr: "Optimisation des incitatifs", en: "Incentive optimization strategy" },
  "tripwire.cta": { fr: "Réserver mon mandat de conception", en: "Book my design mandate" },
  "tripwire.guarantee": {
    fr: "Le rapport de conception est complet et utilisable indépendamment du fournisseur choisi pour l'installation.",
    en: "The design report is complete and usable regardless of which provider you choose for installation."
  },
  "tripwire.guarantee.label": { fr: "Garantie", en: "Guarantee" },
  "tripwire.whyTripwire": {
    fr: "Pourquoi un mandat de conception?",
    en: "Why a design mandate?"
  },
  "tripwire.whyTripwire.description": {
    fr: "Chaque toiture est unique. Les ombres, l'orientation, la structure — tout compte. Un mandat professionnel évite les erreurs coûteuses et maximise votre retour.",
    en: "Every roof is unique. Shadows, orientation, structure — it all matters. A professional mandate avoids costly mistakes and maximizes your return."
  },

  // Expert consultation section
  "expert.title": { fr: "Parlez à un expert", en: "Talk to an expert" },
  "expert.subtitle": {
    fr: "Réservez une consultation gratuite de 30 minutes avec nos spécialistes en énergie solaire",
    en: "Book a free 30-minute consultation with our solar energy specialists"
  },
  "expert.calendlyPlaceholder": {
    fr: "Calendly non configuré",
    en: "Calendly not configured"
  },
  "expert.button": { fr: "Prendre un rendez-vous", en: "Schedule a call" },
  "expert.description": {
    fr: "Discutez directement avec un ingénieur spécialisé en solaire C&I. Pas de frais, pas d'engagement.",
    en: "Talk directly with a C&I solar engineer. No fees, no commitment."
  },

  // Testimonials Section
  "testimonials.title": { fr: "Ils nous font confiance", en: "They trust us" },
  "testimonials.subtitle": { fr: "Ce que nos clients disent de leur expérience", en: "What our clients say about their experience" },
  "testimonials.item1.name": { fr: "Martin Tremblay", en: "Martin Tremblay" },
  "testimonials.item1.role": { fr: "Directeur des opérations", en: "Operations Director" },
  "testimonials.item1.company": { fr: "Entrepôts Québec Inc.", en: "Entrepôts Québec Inc." },
  "testimonials.item1.text": { fr: "En 6 mois, notre facture d'énergie a baissé de 38%. Le retour sur investissement est même meilleur que ce que kWh Québec avait projeté.", en: "In 6 months, our energy bill dropped 38%. The ROI is even better than what kWh Québec projected." },
  "testimonials.item1.savings": { fr: "$42,000/an", en: "$42,000/year" },
  "testimonials.item1.system": { fr: "185 kW", en: "185 kW" },

  "testimonials.item2.name": { fr: "Sophie Lavoie", en: "Sophie Lavoie" },
  "testimonials.item2.role": { fr: "Propriétaire", en: "Owner" },
  "testimonials.item2.company": { fr: "Centre Commercial Rive-Sud", en: "Centre Commercial Rive-Sud" },
  "testimonials.item2.text": { fr: "Le processus était transparent du début à la fin. L'équipe de kWh Québec a géré les incitatifs, la procuration Hydro-Québec, tout. On n'a presque rien eu à faire.", en: "The process was transparent from start to finish. The kWh Québec team handled incentives, Hydro-Québec procuration, everything. We barely had to do anything." },
  "testimonials.item2.savings": { fr: "$67,000/an", en: "$67,000/year" },
  "testimonials.item2.system": { fr: "320 kW", en: "320 kW" },

  "testimonials.item3.name": { fr: "Jean-François Bouchard", en: "Jean-François Bouchard" },
  "testimonials.item3.role": { fr: "VP Finance", en: "VP Finance" },
  "testimonials.item3.company": { fr: "Industries Beauce Ltée", en: "Industries Beauce Ltée" },
  "testimonials.item3.text": { fr: "Le stockage combiné au solaire nous a permis de réduire notre appel de puissance de 22%. C'est un impact direct sur la facture que je n'avais pas anticipé.", en: "Combined storage and solar allowed us to reduce our peak demand by 22%. That's a direct bill impact I hadn't anticipated." },
  "testimonials.item3.savings": { fr: "$89,000/an", en: "$89,000/year" },
  "testimonials.item3.system": { fr: "450 kW + 200 kWh", en: "450 kW + 200 kWh" },

  // Referral Program Section
  "referral.title": { fr: "Référez un collègue, gagnez 1,000$", en: "Refer a colleague, earn $1,000" },
  "referral.subtitle": { fr: "Pour chaque entreprise référée qui signe un contrat d'installation, vous recevez 1,000$ en carte-cadeau.", en: "For every referred business that signs an installation contract, you receive a $1,000 gift card." },
  "referral.cta": { fr: "Référer maintenant", en: "Refer now" },
  "referral.howItWorks": { fr: "Comment ça fonctionne", en: "How it works" },
  "referral.step1": { fr: "Partagez votre lien unique avec un collègue", en: "Share your unique link with a colleague" },
  "referral.step2": { fr: "Ils obtiennent une analyse gratuite", en: "They get a free analysis" },
  "referral.step3": { fr: "Quand ils signent, vous recevez 1,000$", en: "When they sign, you get $1,000" },

  // FAQ Section
  "faq.title": { fr: "Questions fréquemment posées", en: "Frequently Asked Questions" },
  "faq.subtitle": { fr: "Trouvez des réponses à vos questions sur le solaire commercial au Québec", en: "Find answers to your questions about commercial solar in Quebec" },

  "faq.item1.question": { fr: "Combien coûte une installation solaire commerciale?", en: "How much does a commercial solar installation cost?" },
  "faq.item1.answer": { fr: "Le coût varie selon la taille du système et le bâtiment, mais en général de 1,800$ à 2,500$ par kW. Avec les incitatifs gouvernementaux couvrant jusqu'à 60% du projet, votre investissement net tombe à 700$ à 1,000$ par kW. Les systèmes plus grands bénéficient généralement de meilleurs prix unitaires.", en: "Cost varies by system size and building, but typically ranges from $1,800 to $2,500 per kW. With government incentives covering up to 60% of the project, your net investment drops to $700 to $1,000 per kW. Larger systems generally benefit from better unit pricing." },

  "faq.item2.question": { fr: "Quels incitatifs sont disponibles au Québec?", en: "What incentives are available in Quebec?" },
  "faq.item2.answer": { fr: "Trois niveaux d'incitatifs: (1) Crédit Hydro-Québec jusqu'à 40% du projet, (2) Crédit d'impôt fédéral 30% pour technologies propres, (3) Traitement fiscal avantageux avec 100% déductible en première année. Ces incitatifs peuvent être combinés pour un soutien total de jusqu'à 60% du coût du projet.", en: "Three levels of incentives: (1) Hydro-Québec credit up to 40% of the project, (2) Federal 30% investment tax credit for clean technology, (3) Favorable tax treatment with 100% deductible in year 1. These incentives can be combined for total support up to 60% of project cost." },

  "faq.item3.question": { fr: "Le solaire fonctionne-t-il en hiver au Québec?", en: "Does solar work in winter in Quebec?" },
  "faq.item3.answer": { fr: "Oui, absolument. Même si la production est plus faible en hiver, le solaire produit de l'électricité pendant les mois froids, particulièrement les jours clairs. Les panneaux fonctionnent même mieux par temps froid. En moyenne, un système québécois produit environ 35% de son énergie annuelle pendant l'hiver (novembre à mars).", en: "Yes, absolutely. While production is lower in winter, solar still generates electricity during cold months, especially on clear days. Panels actually perform better in cold weather. On average, a Quebec system produces about 35% of its annual energy during winter (November to March)." },

  "faq.item4.question": { fr: "Combien de temps prend l'installation?", en: "How long does installation take?" },
  "faq.item4.answer": { fr: "Le processus complet prend généralement 2-4 mois: analyse et procuration (2-3 semaines), design détaillé (2-4 semaines), approbations réglementaires (2-4 semaines), et installation physique (1-2 semaines). Les projets plus petits ou sans système de stockage peuvent être plus rapides.", en: "The complete process typically takes 2-4 months: analysis and procuration (2-3 weeks), detailed design (2-4 weeks), regulatory approvals (2-4 weeks), and physical installation (1-2 weeks). Smaller projects or those without storage can be faster." },

  "faq.item5.question": { fr: "Qu'est-ce que la procuration Hydro-Québec?", en: "What is Hydro-Québec procuration?" },
  "faq.item5.answer": { fr: "Une procuration est une autorisation qui nous permet d'accéder à votre profil de consommation détaillé (heure par heure) auprès d'Hydro-Québec. C'est essential pour dimensionner correctement votre système solaire et optimiser votre retour sur investissement. La procuration peut être signée électroniquement en quelques minutes.", en: "A procuration is an authorization that allows us to access your detailed consumption profile (hour-by-hour) from Hydro-Québec. It's essential for properly sizing your solar system and optimizing your return on investment. Procuration can be signed electronically in minutes." },

  "faq.item6.question": { fr: "Quelle est la durée de vie des panneaux solaires?", en: "What is the lifespan of solar panels?" },
  "faq.item6.answer": { fr: "Les panneaux solaires modernes ont une durée de vie de 25-30 ans avec une garantie de performance. Après 25 ans, ils continuent à produire de l'électricité, généralement à 80% de la capacité initiale. L'inverter, qui convertit l'électricité CC en CA, dure généralement 10-15 ans et peut être remplacé au besoin. Les onduleurs modernes sont très fiables et rarement besoin de maintenance.", en: "Modern solar panels have a lifespan of 25-30 years with a performance warranty. After 25 years, they continue generating electricity, typically at 80% of initial capacity. The inverter, which converts DC to AC power, typically lasts 10-15 years and can be replaced if needed. Modern inverters are highly reliable and rarely require maintenance." },

  "faq.item7.question": { fr: "Le solaire augmente-t-il la valeur de mon bâtiment?", en: "Does solar increase my building's property value?" },
  "faq.item7.answer": { fr: "Oui. Les études montrent que les bâtiments avec systèmes solaires se vendent entre 3-4% plus cher. Au-delà de la valeur immédiate, les acheteurs apprécient les factures énergétiques réduites et les faibles coûts d'exploitation. Si vous louez des espaces, les locataires sont de plus en plus attirés par les bâtiments durables et à faible consommation énergétique.", en: "Yes. Studies show that buildings with solar systems sell for 3-4% more. Beyond immediate value, buyers appreciate reduced energy bills and low operating costs. If you lease space, tenants are increasingly attracted to sustainable, low-energy buildings." },

  "faq.item8.question": { fr: "Que se passe-t-il si je vends mon bâtiment?", en: "What happens if I sell my building?" },
  "faq.item8.answer": { fr: "Le système solaire reste avec le bâtiment et augmente sa valeur de revente. Les contrats d'achat-vente standard incluent le transfert du système au nouveau propriétaire. Si vous avez un contrat de financement, il peut généralement être assumé par le nouveau propriétaire ou refinancé à des conditions compétitives. La plupart des acheteurs voient le système solaire comme un atout majeur.", en: "The solar system stays with the building and increases its resale value. Standard purchase agreements include system transfer to the new owner. If you have financing, it can typically be assumed by the new owner or refinanced at competitive rates. Most buyers see the solar system as a major asset." },
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
