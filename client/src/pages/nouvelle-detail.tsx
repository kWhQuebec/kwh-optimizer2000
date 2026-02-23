import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Calendar, ExternalLink, ArrowLeft, Eye } from "lucide-react";
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

const CATEGORY_LABELS: Record<string, { fr: string; en: string }> = {
  politique: { fr: "Politique", en: "Policy" },
  technologie: { fr: "Technologie", en: "Technology" },
  financement: { fr: "Financement", en: "Financing" },
  "marché": { fr: "Marché", en: "Market" },
  "réglementation": { fr: "Réglementation", en: "Regulation" },
};

export default function NouvelleDetailPage() {
  const { language } = useI18n();
  const [match, params] = useRoute("/nouvelles/:slug");
  const slug = params?.slug || "";
  const currentLogo = language === "fr" ? logoFr : logoEn;

  const { data: article, isLoading, error } = useQuery<NewsArticle>({
    queryKey: [`/api/public/news/${slug}`],
    enabled: !!slug,
  });

  const comment = article?.editedCommentFr || article?.aiCommentFr;
  const catLabel = article?.category ? CATEGORY_LABELS[article.category] : null;

  return (
    <>
      {article && (
        <SEOHead
          title={`${article.originalTitle} - kWh Québec`}
          description={article.aiSummaryFr || article.originalExcerpt || article.originalTitle}
          ogType="article"
          locale={language}
          keywords={article.aiTags?.join(", ") || ""}
          canonical={`${window.location.origin}/nouvelles/${slug}`}
          structuredData={{
            "@context": "https://schema.org",
            "@type": "NewsArticle",
            headline: article.originalTitle,
            description: article.aiSummaryFr || article.originalExcerpt || "",
            ...(article.publishedAt ? { datePublished: new Date(article.publishedAt).toISOString() } : {}),
            ...(article.updatedAt ? { dateModified: new Date(article.updatedAt).toISOString() } : {}),
            url: `${window.location.origin}/nouvelles/${slug}`,
            ...(article.imageUrl ? { image: article.imageUrl } : {}),
            publisher: {
              "@type": "Organization",
              name: "kWh Québec",
              url: "https://kwhquebec.com",
            },
            author: {
              "@type": "Organization",
              name: article.sourceName,
            },
          }}
        />
      )}

      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <Link href="/">
              <img src={currentLogo} alt="kWh Québec" className="h-[50px] cursor-pointer" data-testid="img-logo" />
            </Link>
            <nav className="flex items-center gap-4">
              <Button variant="ghost" asChild data-testid="link-home">
                <Link href="/">
                  {language === "fr" ? "Accueil" : "Home"}
                </Link>
              </Button>
              <Button variant="ghost" asChild data-testid="link-blog">
                <Link href="/blog">
                  {language === "fr" ? "Ressources" : "Resources"}
                </Link>
              </Button>
              <LanguageToggle />
              <ThemeToggle />
            </nav>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-3xl">
          <Button variant="ghost" asChild className="mb-6" data-testid="button-back">
            <Link href="/blog?tab=nouvelles">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {language === "fr" ? "Retour aux nouvelles" : "Back to news"}
            </Link>
          </Button>

          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : error || !article ? (
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-lg text-muted-foreground" data-testid="text-not-found">
                  {language === "fr" ? "Article non trouvé" : "Article not found"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <article>
              {article.imageUrl && (
                <div className="aspect-video overflow-hidden rounded-lg mb-6">
                  <img
                    src={article.imageUrl}
                    alt={article.originalTitle}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    data-testid="img-article"
                  />
                </div>
              )}

              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <Badge variant="secondary" data-testid="badge-source">
                  {article.sourceName}
                </Badge>
                {catLabel && (
                  <Badge variant="outline" data-testid="badge-category">
                    {language === "fr" ? catLabel.fr : catLabel.en}
                  </Badge>
                )}
                {article.publishedAt && (
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(article.publishedAt).toLocaleDateString(
                      language === "fr" ? "fr-CA" : "en-CA",
                      { year: "numeric", month: "long", day: "numeric" }
                    )}
                  </span>
                )}
                {(article.viewCount ?? 0) > 0 && (
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    {article.viewCount}
                  </span>
                )}
              </div>

              <h1 className="text-3xl font-bold mb-6" data-testid="text-article-title">
                {article.originalTitle}
              </h1>

              {article.aiSummaryFr && (
                <Card className="mb-6">
                  <CardContent className="p-5">
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                      {language === "fr" ? "Résumé" : "Summary"}
                    </p>
                    <p className="text-base" data-testid="text-article-summary">
                      {article.aiSummaryFr}
                    </p>
                  </CardContent>
                </Card>
              )}

              {comment && (
                <Card className="mb-6 border-l-0">
                  <CardContent className="p-5">
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                      {language === "fr" ? "Analyse kWh Québec" : "kWh Québec Analysis"}
                    </p>
                    <p className="text-base" data-testid="text-article-comment">
                      {comment}
                    </p>
                  </CardContent>
                </Card>
              )}

              {article.aiTags && article.aiTags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-6" data-testid="tags-article">
                  {article.aiTags.map((tag, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-3 flex-wrap">
                <Button asChild data-testid="button-read-original">
                  <a href={article.sourceUrl} target="_blank" rel="noopener noreferrer">
                    {language === "fr" ? "Lire l'article original" : "Read original article"}
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </a>
                </Button>
                <Button variant="outline" asChild data-testid="button-more-news">
                  <Link href="/blog?tab=nouvelles">
                    {language === "fr" ? "Plus de nouvelles" : "More news"}
                  </Link>
                </Button>
              </div>
            </article>
          )}
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
