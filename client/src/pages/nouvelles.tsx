import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Calendar, ExternalLink, Newspaper, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useI18n } from "@/lib/i18n";
import { SEOHead } from "@/components/seo-head";
import type { NewsArticle } from "@shared/schema";
import logoFr from "@assets/kWh_Quebec_Logo-01_-_Rectangulaire_1764799021536.png";
import logoEn from "@assets/kWh_Quebec_Logo-02_-_Rectangle_1764799021536.png";

function NewsCard({ article }: { article: NewsArticle }) {
  const { language } = useI18n();
  const comment = article.editedCommentFr || article.aiCommentFr;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="h-full hover-elevate" data-testid={`card-news-${article.id}`}>
        {article.imageUrl && (
          <div className="aspect-video overflow-hidden rounded-t-lg">
            <img
              src={article.imageUrl}
              alt={article.originalTitle}
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
        )}
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <Badge variant="secondary" className="text-xs" data-testid={`badge-source-${article.id}`}>
              {article.sourceName}
            </Badge>
            {article.publishedAt && (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(article.publishedAt).toLocaleDateString(
                  language === "fr" ? "fr-CA" : "en-CA",
                  { year: "numeric", month: "short", day: "numeric" }
                )}
              </span>
            )}
          </div>

          <a
            href={article.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group"
            data-testid={`link-news-${article.id}`}
          >
            <h3
              className="text-lg font-semibold mb-2 group-hover:underline inline-flex items-start gap-1"
              data-testid={`text-news-title-${article.id}`}
            >
              {article.originalTitle}
              <ExternalLink className="w-4 h-4 flex-shrink-0 mt-1" />
            </h3>
          </a>

          {comment && (
            <p className="text-muted-foreground text-sm mb-3 line-clamp-4" data-testid={`text-news-comment-${article.id}`}>
              {comment}
            </p>
          )}

          {article.aiTags && article.aiTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {article.aiTags.slice(0, 4).map((tag, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function NouvellesPage() {
  const { t, language } = useI18n();
  const currentLogo = language === "fr" ? logoFr : logoEn;

  const { data: articles, isLoading } = useQuery<NewsArticle[]>({
    queryKey: ["/api/public/news"],
  });

  const title = language === "fr" ? "Nouvelles de l'industrie" : "Industry News";
  const subtitle = language === "fr"
    ? "Les dernières actualités de l'énergie solaire et renouvelable au Québec, analysées par nos experts."
    : "The latest solar and renewable energy news in Québec, analyzed by our experts.";

  return (
    <>
      <SEOHead
        title={language === "fr" ? "Nouvelles de l'industrie solaire - kWh Québec" : "Solar Industry News - kWh Québec"}
        description={language === "fr"
          ? "Suivez les dernières nouvelles de l'industrie solaire au Québec. Analyses d'experts sur l'énergie renouvelable, Hydro-Québec et le stockage par batterie."
          : "Follow the latest solar industry news in Québec. Expert analysis on renewable energy, Hydro-Québec and battery storage."}
        ogType="website"
        locale={language}
        keywords={language === "fr"
          ? "nouvelles solaire, québec, hydro-québec, énergie renouvelable, panneaux solaires, industrie"
          : "solar news, quebec, hydro-quebec, renewable energy, solar panels, industry"}
        canonical={`${window.location.origin}/nouvelles`}
        structuredData={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: title,
          description: subtitle,
          url: `${window.location.origin}/nouvelles`,
          publisher: {
            "@type": "Organization",
            name: "kWh Québec",
          },
        }}
      />

      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <Link href="/">
              <img
                src={currentLogo}
                alt={language === "fr" ? "Logo kWh Québec" : "kWh Québec Logo"}
                className="h-[50px] cursor-pointer"
                data-testid="img-logo"
              />
            </Link>
            <nav className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" data-testid="link-home">
                  {language === "fr" ? "Accueil" : "Home"}
                </Button>
              </Link>
              <Link href="/blog">
                <Button variant="ghost" data-testid="link-blog">
                  {language === "fr" ? "Ressources" : "Resources"}
                </Button>
              </Link>
              <Link href="/nouvelles">
                <Button variant="ghost" className="bg-accent/50" data-testid="link-news">
                  {language === "fr" ? "Nouvelles" : "News"}
                </Button>
              </Link>
              <LanguageToggle />
              <ThemeToggle />
            </nav>
          </div>
        </header>

        <main className="container mx-auto px-4 py-12">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl font-bold mb-4" data-testid="text-news-page-title">
              {title}
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto" data-testid="text-news-page-subtitle">
              {subtitle}
            </p>
          </motion.div>

          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="h-full">
                  <Skeleton className="aspect-video rounded-t-lg" />
                  <CardContent className="p-6 space-y-4">
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : articles && articles.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {articles.map((article) => (
                <NewsCard key={article.id} article={article} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <Newspaper className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-xl text-muted-foreground" data-testid="text-no-news">
                {language === "fr"
                  ? "Aucune nouvelle pour le moment. Revenez bientôt!"
                  : "No news at the moment. Check back soon!"}
              </p>
            </div>
          )}

          <motion.div
            className="mt-16 bg-primary/5 rounded-2xl p-8 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <h2 className="text-2xl font-bold mb-4" data-testid="text-cta-title">
              {language === "fr"
                ? "Découvrez le potentiel solaire de votre entreprise"
                : "Discover your business's solar potential"}
            </h2>
            <p className="text-muted-foreground mb-6 max-w-xl mx-auto" data-testid="text-cta-description">
              {language === "fr"
                ? "Obtenez une analyse gratuite de votre potentiel d'économie avec l'énergie solaire."
                : "Get a free analysis of your savings potential with solar energy."}
            </p>
            <Link href="/#contact">
              <Button size="lg" data-testid="button-cta">
                {language === "fr" ? "Demander une analyse" : "Request an analysis"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </motion.div>
        </main>

        <footer className="border-t py-8 mt-12">
          <div className="container mx-auto px-4 text-center text-muted-foreground">
            <p>© 2026 kWh Québec inc. | Licence RBQ: 5656-6136-01</p>
          </div>
        </footer>
      </div>
    </>
  );
}
