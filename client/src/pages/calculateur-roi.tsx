import { useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { Link } from "wouter";
import { 
  Sun, DollarSign, TrendingUp, Calculator, Building2,
  ChevronRight, ArrowRight, Upload, FileText
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const SEO_CONTENT = {
  fr: {
    title: "Calculateur ROI Solaire Commercial | kWh Québec",
    h1: "Calculateur de retour sur investissement solaire",
    subtitle: "Estimez la rentabilité d'une installation solaire pour votre bâtiment commercial ou industriel au Québec. Analyse gratuite basée sur les tarifs Hydro-Québec 2026.",
    ctaTitle: "Obtenez une analyse personnalisée gratuite",
    ctaText: "Ce calculateur utilise des moyennes régionales. Pour une estimation précise basée sur votre consommation réelle et la configuration spécifique de votre toiture:",
    ctaButton: "Analyser mon bâtiment gratuitement",
    section1Title: "Pourquoi investir dans le solaire commercial au Québec en 2026?",
    section1Content: `Le solaire commercial au Québec offre un retour sur investissement de 15 à 25% annuellement, surpassant la plupart des investissements traditionnels. Avec les tarifs d'Hydro-Québec qui augmentent en moyenne de 3,5% par année et les coûts des panneaux solaires en baisse constante, le moment optimal pour investir est maintenant.

Le programme de mesurage net d'Hydro-Québec permet aux entreprises de créditer leur surproduction solaire sur leur facture, éliminant le besoin de batteries coûteuses. Combiné au crédit d'impôt fédéral de 30% (ITC) et à l'incitatif d'Hydro-Québec de 1 000$/kW, le coût net d'un système solaire commercial peut être réduit de 50 à 60%.

Les panneaux solaires modernes sont conçus pour résister aux conditions climatiques extrêmes du Québec. Le froid améliore réellement leur efficacité, et contrairement aux idées reçues, la neige fond rapidement sur les surfaces inclinées. Même en hiver, Montréal reçoit suffisamment de lumière pour une production significative. Les données historiques montrent que les installations solaires commerciales au Québec produisent environ 1 250 kWh par kilowatt installé par année, comparable aux meilleures installations en Europe du Nord.`,
    section2Title: "Comment fonctionne le calcul du ROI solaire?",
    section2Content: `Le retour sur investissement d'un système solaire se calcule en comparant le coût net de l'installation aux économies cumulatives sur la durée de vie du système (25+ ans). Notre calculateur utilise la méthodologie financière standard de l'industrie solaire, reconnue par les institutions financières et les auditeurs externes.

Les facteurs clés incluent: la production solaire annuelle (environ 1 250 kWh/kWc à Montréal), le taux de dégradation des panneaux (0,4%/an pour les panneaux TOPCon modernes), l'inflation des tarifs d'électricité (historiquement 3,5%/an au Québec), et les coûts d'exploitation et de maintenance (environ 1% du CAPEX par année).

Le retour simple sur investissement (payback) se situe typiquement entre 4 et 7 ans pour les projets commerciaux au Québec, après quoi l'énergie produite est essentiellement gratuite pendant les 18-21 années restantes de la garantie. Cela signifie qu'une entreprise installe un système en 2026, le récupère financièrement avant 2033, et bénéficie d'énergie gratuite ou presque jusqu'en 2051.

La plupart des organisations commerciales considèrent qu'un retour sur investissement inférieur à 7 ans représente une excellente opportunité d'investissement, rendant le solaire très compétitif par rapport aux autres projets d'efficacité énergétique.`,
    section3Title: "Incitatifs et subventions disponibles au Québec",
    section3Content: `Plusieurs programmes réduisent significativement le coût d'une installation solaire commerciale, rendant les projets marginalement viables soudainement très rentables.

Le Crédit d'impôt à l'investissement (ITC) fédéral offre un remboursement de 30% du coût admissible du système. Pour un système de 100 kW coûtant 185 000$, cela représente 55 500$ de crédit d'impôt utilisable immédiatement. Les entreprises avec suffisamment de revenus imposables peuvent appliquer ce crédit dans les années fiscales courantes ou futures.

Le programme d'Hydro-Québec offre 1 000$/kW installé, plafonné à 40% du coût du projet et à 1 MW de capacité. Pour un système de 100 kW, cela signifie potentiellement 74 000$ de réduction (le minimum entre 100 000$, 40% du coût total, et 1 000 000$). Ces fonds proviennent du fonds de développement des énergies renouvelables de la province.

L'amortissement accéléré (DPA classe 43.1/43.2) permet de déduire jusqu'à 50% du coût résiduel chaque année, créant un bouclier fiscal substantiel dès la première année. Une entreprise avec taux d'impôt marginal de 26% économise donc 26% du coût du système simplement en déductions fiscales supplémentaires.

Au total, ces incitatifs peuvent réduire le coût net de 50 à 60%, ramenant le retour sur investissement simple à aussi peu que 3-4 ans pour les projets les plus favorables. C'est comparable à un investissement immobilier, mais avec beaucoup moins de capital requis et une liquidité supérieure.`,
    section4Title: "Solaire commercial vs autres investissements",
    section4Content: `Comparé à d'autres investissements d'entreprise, le solaire offre un profil risque/rendement exceptionnellement favorable. Le rendement annualisé de 15-25% dépasse largement les certificats de placement garanti (CPG) à 4-5%, les obligations d'entreprise à 5-7%, et rivalise avec les meilleurs investissements immobiliers.

Le risque est minimal car la production solaire est prévisible: les données d'irradiation solaires sont fiables sur 25+ ans basées sur les satellites météorologiques, Hydro-Québec garantit constitutionnellement l'accès au réseau et le rachat via le mesurage net, et les panneaux modernes sont garantis 25-30 ans avec une dégradation maximale de 0,4% par année.

De plus, l'investissement solaire augmente la valeur de revente du bâtiment (immédiatement évaluée en capitalisant les économies d'énergie), améliore la cote ESG de l'entreprise (pertinent pour les contrats avec les grandes organisations), et protège contre les futures hausses de tarifs d'électricité. Les organisations comme Microsoft, Google et Amazon font passer le dossier ESG avant dans leurs critères de sélection des fournisseurs.

L'énergie solaire est également pratiquement à l'épreuve de l'inflation. Tandis que les coûts énergétiques augmentent avec l'inflation, la production d'un système solaire reste stable (ajustée seulement pour la dégradation mineure). Cela rend les contrats d'énergie solaire à long terme extrêmement attrayants pour les organisations préoccupées par la stabilité des coûts.`,
    faqTitle: "Questions fréquentes sur le ROI solaire",
    faqs: [
      {
        q: "Le solaire fonctionne-t-il vraiment en hiver au Québec?",
        a: "Absolument. Les panneaux solaires fonctionnent avec la lumière, pas la chaleur directe du soleil. En fait, le froid améliore réellement l'efficacité des panneaux - la physique des semi-conducteurs montre une meilleure performance à basse température. La neige fond rapidement sur les panneaux inclinés grâce à leur surface lisse et sombre. Montréal reçoit plus d'ensoleillement annuel que plusieurs villes européennes leaders en solaire comme l'Allemagne ou la Suisse. Le principal facteur est les nuages, pas la température."
      },
      {
        q: "Combien de temps durent les panneaux solaires?",
        a: "Les panneaux solaires modernes (TOPCon N-type comme ceux de Jinko Solar ou Canadian Solar) sont garantis 25-30 ans avec une dégradation maximale de 0,4% par année. Après 25 ans, ils produisent encore environ 87% de leur capacité initiale. Nombreux panneaux installés dans les années 1980 produisent toujours efficacement aujourd'hui. Les onduleurs, les composants électriques, durent typiquement 10-15 ans et sont remplaçables économiquement. Le système global peut fonctionner 40-50 ans avec les remplacements mineurs."
      },
      {
        q: "Qu'est-ce que le mesurage net d'Hydro-Québec?",
        a: "Le mesurage net est le programme établissant que votre surplus d'énergie solaire est renversé au réseau et crédité sur votre facture au taux plein de détail. En essence, vous produisez le jour (généralement midi à 16h), consommez le soir (17h à 22h), et Hydro-Québec règle le bilan mensuellement. C'est comme utiliser le réseau comme une batterie gratuite, efficacement à 100%. Sans mesurage net, il faudrait installer des batteries (30-50K$ pour 50kWh), réduisant drastiquement le ROI. Le mesurage net rend les projets viables."
      },
      {
        q: "Quel est l'entretien nécessaire?",
        a: "Minimal. Un nettoyage annuel (surtout après les tempêtes de printemps) et une inspection visuelle suffisent. Les systèmes commerciaux n'ont pas de pièces mobiles - pas de moteurs, pas de fluides. Le coût d'entretien est environ 1% du coût initial par année, inclus dans nos calculs de ROI. Beaucoup d'installations solaires fonctionnent 25+ ans pratiquement sans intervention."
      },
      {
        q: "Le calculateur est-il précis pour mon projet?",
        a: "Ce calculateur fournit une estimation basée sur des moyennes régionales crédibles et des constants de l'industrie. Pour une analyse précise avec vos données de consommation réelles, la configuration spécifique de votre toiture, l'ombrage local, et un design sur mesure par nos ingénieurs: utilisez notre service d'analyse gratuit. Nous utilisons des logiciels professionnels de modélisation solaire (PVDIY, PVsyst) reconnus par les institutions financières."
      },
    ],
  },
  en: {
    title: "Commercial Solar ROI Calculator | kWh Québec",
    h1: "Solar Return on Investment Calculator",
    subtitle: "Estimate the profitability of a solar installation for your commercial or industrial building in Québec. Free analysis based on 2026 Hydro-Québec rates.",
    ctaTitle: "Get a free personalized analysis",
    ctaText: "This calculator uses regional averages. For a precise estimate based on your actual consumption and specific roof configuration:",
    ctaButton: "Analyze my building for free",
    section1Title: "Why invest in commercial solar in Québec in 2026?",
    section1Content: `Commercial solar in Québec offers annual returns of 15 to 25%, outperforming most traditional investments. With Hydro-Québec rates increasing an average of 3.5% per year and solar panel costs continuously declining, the optimal time to invest is now.

Hydro-Québec's net metering program allows businesses to credit their solar surplus on their bill, eliminating the need for expensive batteries. Combined with the 30% federal Investment Tax Credit (ITC) and Hydro-Québec's $1,000/kW incentive, the net cost of a commercial solar system can be reduced by 50 to 60%.

Modern solar panels are engineered to withstand Québec's extreme climate conditions. Cold actually improves panel efficiency - semiconductor physics shows better performance at low temperatures. Snow melts quickly on angled surfaces thanks to their smooth, dark finish. Despite misconceptions, even in winter, Montréal receives sufficient light for significant production. Historical data shows commercial solar installations in Québec produce approximately 1,250 kWh per kilowatt installed annually, comparable to the best installations across Northern Europe.`,
    section2Title: "How is solar ROI calculated?",
    section2Content: `Solar system return on investment is calculated by comparing the net installation cost to cumulative savings over the system's lifetime (25+ years). Our calculator uses the standard financial methodology of the solar industry, recognized by financial institutions and external auditors.

Key factors include: annual solar production (approximately 1,250 kWh/kWp in Montréal), panel degradation rate (0.4%/year for modern N-type TOPCon panels), electricity rate inflation (historically 3.5%/year in Québec), and operations & maintenance costs (approximately 1% of CAPEX per year).

Simple payback typically ranges from 4 to 7 years for commercial projects in Québec, after which the energy produced is essentially free for the remaining 18-21 years of the warranty. This means a company installing a system in 2026 would recover it financially before 2033 and benefit from free or nearly free energy through 2051.

Most commercial organizations consider a return on investment under 7 years to represent an excellent investment opportunity, making solar highly competitive compared to other energy efficiency projects.`,
    section3Title: "Available incentives and subsidies in Québec",
    section3Content: `Several government programs significantly reduce the cost of a commercial solar installation, transforming marginally viable projects into highly profitable ones.

The federal Investment Tax Credit (ITC) offers a 30% refund of the eligible system cost. For a 100 kW system costing $185,000, this represents $55,500 in immediate tax credits. Businesses with sufficient taxable income can apply this credit in current or future fiscal years.

Hydro-Québec's program offers $1,000/kW installed, capped at 40% of project cost and 1 MW capacity. For a 100 kW system, this means potentially $74,000 in savings (the minimum of $100,000, 40% of total cost, and $1 million). These funds come from the province's renewable energy development fund.

Accelerated depreciation (CCA class 43.1/43.2) allows deducting up to 50% of residual cost each year, creating a substantial tax shield from year one. A company with a 26% marginal tax rate therefore saves 26% of system cost through additional tax deductions alone.

In total, these incentives can reduce the net cost by 50 to 60%, bringing simple payback to as low as 3-4 years for the most favorable projects. This rivals real estate investments but requires significantly less capital and offers superior liquidity.`,
    section4Title: "Commercial solar vs other investments",
    section4Content: `Compared to other business investments, solar offers an exceptionally favorable risk/return profile. The annualized return of 15-25% far exceeds GICs (4-5%), corporate bonds (5-7%) and rivals the best real estate investments.

Risk is minimal because solar production is predictable: solar irradiation data is reliable over 25+ years based on meteorological satellites, Hydro-Québec constitutionally guarantees grid access and buyback via net metering, and modern panels are warranted 25-30 years with maximum degradation of 0.4% per year.

Additionally, solar investment immediately increases building resale value (valued by capitalizing energy savings), improves the company's ESG rating (increasingly relevant for contracts with major organizations), and protects against future electricity rate increases. Organizations like Microsoft, Google, and Amazon prioritize ESG criteria in their supplier selection process.

Solar energy is also inflation-proof. While energy costs increase with inflation, a solar system's production remains stable (adjusted only for minor degradation). This makes long-term solar energy contracts extremely attractive for organizations concerned about cost stability.`,
    faqTitle: "Frequently Asked Questions about Solar ROI",
    faqs: [
      {
        q: "Does solar really work in winter in Québec?",
        a: "Absolutely. Solar panels work with light, not direct heat from the sun. In fact, cold actually improves panel efficiency - semiconductor physics shows better performance at low temperatures. Snow melts quickly on angled panels thanks to their smooth, dark surface. Montréal receives more annual sunshine than several European solar leader cities like Germany or Switzerland. The primary factor is cloud cover, not temperature."
      },
      {
        q: "How long do solar panels last?",
        a: "Modern solar panels (TOPCon N-type like Jinko Solar or Canadian Solar) are warranted 25-30 years with maximum degradation of 0.4% per year. After 25 years, they still produce about 87% of initial capacity. Many panels installed in the 1980s operate efficiently today. Inverters, the electrical components, typically last 10-15 years and are economically replaceable. The overall system can operate 40-50 years with minor component replacements."
      },
      {
        q: "What is Hydro-Québec net metering?",
        a: "Net metering is the program establishing that your solar energy surplus is fed back to the grid and credited on your bill at the full retail rate. Essentially, you produce during the day (typically noon to 4pm), consume in the evening (5pm to 10pm), and Hydro-Québec settles the balance monthly. It's like using the grid as a free battery, effectively at 100% efficiency. Without net metering, you'd need to install batteries ($30-50K for 50kWh), drastically reducing ROI. Net metering makes projects viable."
      },
      {
        q: "What maintenance is required?",
        a: "Minimal. Annual cleaning (especially after spring storms) and a visual inspection are sufficient. Commercial systems have no moving parts - no motors, no fluids. Maintenance cost is about 1% of initial cost per year, included in our ROI calculations. Many solar installations operate 25+ years with virtually no intervention."
      },
      {
        q: "Is this calculator accurate for my project?",
        a: "This calculator provides an estimate based on credible regional averages and industry-standard constants. For precise analysis with your actual consumption data, specific roof configuration, local shading, and custom design by our engineers: use our free analysis service. We use professional solar modeling software (PVDIY, PVsyst) recognized by financial institutions."
      },
    ],
  },
};

export default function CalculateurROIPage() {
  const { language } = useI18n();
  const txt = SEO_CONTENT[language === "en" ? "en" : "fr"];

  useEffect(() => {
    document.title = txt.title;
    
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', txt.subtitle);
  }, [txt.title, txt.subtitle]);

  useEffect(() => {
    const faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: txt.faqs.map(faq => ({
        "@type": "Question",
        name: faq.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.a,
        },
      })),
    };

    const webPageSchema = {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: txt.title,
      url: "https://www.kwh.quebec/ressources/calculateur-roi-solaire",
      description: txt.subtitle,
      isPartOf: {
        "@type": "WebSite",
        name: "kWh Québec",
        url: "https://www.kwh.quebec",
      },
      provider: {
        "@type": "Organization",
        name: "kWh Québec",
        url: "https://www.kwh.quebec",
      },
    };

    const faqScriptId = 'roi-faq-schema';
    const webAppScriptId = 'roi-webapp-schema';

    let faqScript = document.getElementById(faqScriptId);
    if (!faqScript) {
      faqScript = document.createElement('script');
      faqScript.id = faqScriptId;
      faqScript.setAttribute('type', 'application/ld+json');
      document.head.appendChild(faqScript);
    }
    faqScript.textContent = JSON.stringify(faqSchema);

    let webAppScript = document.getElementById(webAppScriptId);
    if (!webAppScript) {
      webAppScript = document.createElement('script');
      webAppScript.id = webAppScriptId;
      webAppScript.setAttribute('type', 'application/ld+json');
      document.head.appendChild(webAppScript);
    }
    webAppScript.textContent = JSON.stringify(webPageSchema);

    return () => {
      document.getElementById(faqScriptId)?.remove();
      document.getElementById(webAppScriptId)?.remove();
    };
  }, [txt, language]);

  const ctaHeading = language === "fr"
    ? "Calculez votre ROI solaire en 30 secondes"
    : "Calculate your solar ROI in 30 seconds";

  const ctaSubtext = language === "fr"
    ? "Téléversez votre facture Hydro-Québec pour des résultats précis basés sur votre consommation réelle, ou entrez votre montant mensuel approximatif."
    : "Upload your Hydro-Québec bill for precise results based on your actual consumption, or enter your approximate monthly amount.";

  const primaryBtnText = language === "fr"
    ? "Analyser mon bâtiment gratuitement"
    : "Analyze my building for free";

  const secondaryBtnText = language === "fr"
    ? "Entrer ma consommation manuellement"
    : "Enter my consumption manually";

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-[#003DA6] text-white py-4 px-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-2">
          <Link href="/" className="text-white font-bold text-lg hover:opacity-80" data-testid="link-home-logo">
            kWh Québec
          </Link>
          <Link href="/" className="text-white/80 text-sm hover:text-white flex items-center gap-1" data-testid="link-back-to-site">
            {language === "fr" ? "\u2190 Retour au site" : "\u2190 Back to site"}
          </Link>
        </div>
      </header>
      
      <section className="bg-gradient-to-b from-[#003DA6] to-[#002B75] text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 text-sm mb-6">
            <Calculator size={16} />
            {language === "fr" ? "Outil gratuit" : "Free tool"}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-4" data-testid="text-page-title">{txt.h1}</h1>
          <p className="text-lg text-white/80 max-w-2xl mx-auto">{txt.subtitle}</p>
        </div>
      </section>
      
      <section className="py-12 px-4 -mt-8">
        <div className="max-w-3xl mx-auto">
          <Card className="bg-gradient-to-br from-[#003DA6] to-[#002B75] text-white border-0 shadow-lg">
            <CardContent className="py-10 px-6 md:px-10 text-center space-y-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/10 mb-2">
                <Sun size={32} className="text-[#FFB005]" />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold" data-testid="text-cta-heading">{ctaHeading}</h2>
              <p className="text-white/80 text-base md:text-lg max-w-xl mx-auto leading-relaxed">{ctaSubtext}</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <Link href="/#analyse">
                  <Button
                    className="bg-[#FFB005] hover:bg-[#FFB005]/90 text-[#003DA6] font-bold px-6"
                    data-testid="button-analyze-building"
                  >
                    <Upload size={16} className="mr-2" />
                    {primaryBtnText}
                    <ArrowRight size={16} className="ml-2" />
                  </Button>
                </Link>
                <Link href="/#analyse">
                  <Button
                    variant="outline"
                    className="border-white/40 text-white bg-white/10 font-medium px-6"
                    data-testid="button-manual-entry"
                  >
                    <FileText size={16} className="mr-2" />
                    {secondaryBtnText}
                  </Button>
                </Link>
              </div>
              <p className="text-white/50 text-xs pt-2">
                {language === "fr"
                  ? "Gratuit, sans engagement, résultats en moins d'une minute"
                  : "Free, no commitment, results in under a minute"}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
      
      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-4xl mx-auto space-y-12">
          {[
            { title: txt.section1Title, content: txt.section1Content, icon: TrendingUp },
            { title: txt.section2Title, content: txt.section2Content, icon: Calculator },
            { title: txt.section3Title, content: txt.section3Content, icon: DollarSign },
            { title: txt.section4Title, content: txt.section4Content, icon: Building2 },
          ].map((section, i) => (
            <article key={i}>
              <h2 className="text-2xl font-bold mb-4 text-[#003DA6] flex items-center gap-2">
                <section.icon size={24} className="shrink-0" />
                {section.title}
              </h2>
              <div className="prose prose-slate dark:prose-invert max-w-none">
                {section.content.split('\n\n').map((para, j) => (
                  <p key={j} className="text-muted-foreground leading-relaxed mb-4">{para.trim()}</p>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
      
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-8 text-center" data-testid="text-faq-title">{txt.faqTitle}</h2>
          <div className="space-y-4">
            {txt.faqs.map((faq, i) => (
              <details key={i} className="group border rounded-md" data-testid={`faq-item-${i}`}>
                <summary className="flex items-center justify-between gap-2 p-4 cursor-pointer font-medium hover:bg-muted/50">
                  {faq.q}
                  <ChevronRight className="transition-transform group-open:rotate-90 shrink-0" size={18} />
                </summary>
                <div className="px-4 pb-4 text-muted-foreground text-sm leading-relaxed">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>
      
      <section className="py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <Card className="bg-[#003DA6] text-white border-0">
            <CardContent className="pt-6 pb-6 text-center">
              <h3 className="text-xl font-bold mb-2" data-testid="text-bottom-cta-title">{txt.ctaTitle}</h3>
              <p className="text-white/80 text-sm mb-4 max-w-lg mx-auto">{txt.ctaText}</p>
              <Link href="/#analyse">
                <Button
                  className="bg-[#FFB005] hover:bg-[#FFB005]/90 text-[#003DA6] font-bold px-8"
                  data-testid="button-bottom-cta"
                >
                  {txt.ctaButton} <ArrowRight size={16} className="ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>
      
      <footer className="py-8 px-4 border-t bg-muted/30 text-center">
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} kWh Québec — 514.427.8871 | info@kwh.quebec
        </p>
        <div className="flex items-center justify-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
          <Link href="/privacy" className="hover:underline" data-testid="link-privacy">
            {language === "fr" ? "Confidentialité" : "Privacy"}
          </Link>
          <Link href="/conditions" className="hover:underline" data-testid="link-terms">
            {language === "fr" ? "Conditions" : "Terms"}
          </Link>
        </div>
      </footer>
    </div>
  );
}
