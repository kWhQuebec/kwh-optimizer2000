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

  // Landing Page
  "landing.hero.title": { fr: "Optimisez votre facture d'électricité", en: "Optimize your electricity bill" },
  "landing.hero.subtitle": { fr: "Grâce au solaire et au stockage d'énergie", en: "With solar and energy storage" },
  "landing.hero.description": { 
    fr: "Solutions sur mesure pour les entreprises industrielles, commerciales et institutionnelles au Québec.", 
    en: "Custom solutions for industrial, commercial and institutional businesses in Québec." 
  },
  "landing.hero.cta": { fr: "Obtenir une analyse gratuite", en: "Get a free analysis" },
  
  "landing.step1.title": { fr: "1. Analyse de données", en: "1. Data Analysis" },
  "landing.step1.description": { 
    fr: "Nous analysons vos données de consommation horaires et de puissance pour comprendre votre profil énergétique.", 
    en: "We analyze your hourly consumption and power data to understand your energy profile." 
  },
  "landing.step2.title": { fr: "2. Rapport de potentiel", en: "2. Potential Report" },
  "landing.step2.description": { 
    fr: "Recevez un rapport détaillé avec le potentiel solaire + stockage, les économies estimées et le retour sur investissement.", 
    en: "Receive a detailed report with solar + storage potential, estimated savings and ROI." 
  },
  "landing.step3.title": { fr: "3. Design complet", en: "3. Complete Design" },
  "landing.step3.description": { 
    fr: "Obtenez un design système complet avec liste de matériaux détaillée et prix clé en main.", 
    en: "Get a complete system design with detailed bill of materials and turnkey pricing." 
  },

  // Landing Page Extra
  "landing.process.title": { fr: "Notre processus en 3 étapes", en: "Our 3-step process" },
  "landing.process.subtitle": { 
    fr: "De l'analyse de vos données à un système clé en main, nous vous accompagnons à chaque étape.", 
    en: "From analyzing your data to a turnkey system, we support you every step of the way." 
  },
  "landing.trust.certified": { fr: "Partenaire certifié Hydro-Québec", en: "Hydro-Québec certified partner" },
  "landing.trust.experience": { fr: "25+ ans d'expérience", en: "25+ years experience" },
  "landing.form.subtitle": { 
    fr: "Remplissez le formulaire et recevez une analyse préliminaire de votre potentiel solaire + stockage.", 
    en: "Fill out the form and receive a preliminary analysis of your solar + storage potential." 
  },
  "landing.form.benefit1.title": { fr: "Analyse personnalisée", en: "Personalized analysis" },
  "landing.form.benefit1.description": { fr: "Basée sur vos données réelles de consommation", en: "Based on your real consumption data" },
  "landing.form.benefit2.title": { fr: "Estimation des économies", en: "Savings estimate" },
  "landing.form.benefit2.description": { fr: "Calcul du ROI et du temps de retour", en: "ROI and payback calculation" },
  "landing.form.benefit3.title": { fr: "Sans engagement", en: "No commitment" },
  "landing.form.benefit3.description": { fr: "Consultation gratuite et sans obligation", en: "Free consultation with no obligation" },
  "landing.form.privacy": { 
    fr: "En soumettant ce formulaire, vous acceptez notre politique de confidentialité.", 
    en: "By submitting this form, you accept our privacy policy." 
  },
  "landing.form.select": { fr: "Sélectionner...", en: "Select..." },
  "landing.hero.pvCapacity": { fr: "Capacité PV", en: "PV capacity" },
  "landing.hero.storage": { fr: "Stockage", en: "Storage" },
  "landing.hero.peakShaving": { fr: "Écrêtage", en: "Peak shaving" },
  "landing.hero.co2Year": { fr: "CO₂/an", en: "CO₂/year" },

  // Lead Form
  "form.company": { fr: "Nom de l'entreprise", en: "Company name" },
  "form.contact": { fr: "Nom du contact", en: "Contact name" },
  "form.email": { fr: "Courriel", en: "Email" },
  "form.phone": { fr: "Téléphone", en: "Phone" },
  "form.city": { fr: "Ville", en: "City" },
  "form.province": { fr: "Province", en: "Province" },
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
    fr: "Nous avons bien reçu votre demande. Un conseiller vous contactera sous peu.", 
    en: "We have received your request. An advisor will contact you shortly." 
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
