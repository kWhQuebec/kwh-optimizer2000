import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Calendar, ArrowRight, BookOpen, FileText, Newspaper, Award, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useI18n } from "@/lib/i18n";
import { SEOHead } from "@/components/seo-head";
import type { BlogArticle, NewsArticle } from "@shared/schema";
import logoFr from "@assets/kWh_Quebec_Logo-01_-_Rectangulaire_1764799021536.png";
import logoEn from "@assets/kWh_Quebec_Logo-02_-_Rectangle_1764799021536.png";

const categoryIcons: Record<string, typeof BookOpen> = {
  guide: BookOpen,
  news: Newspaper,
  "case-study": FileText,
  program: Award,
};

const NEWS_CATEGORY_LABELS: Record<string, { fr: string; en: string }> = {
  politique: { fr: "Politique", en: "Policy" },
  technologie: { fr: "Technologie", en: "Technology" },
  financement: { fr: "Financement", en: "Financing" },
  "marché": { fr: "Marché", en: "Market" },
  "réglementation": { fr: "Réglementation", en: "Regulation" },
};

const NEWS_CATEGORY_FILTERS = [
  { value: "", fr: "Tout", en: "All" },
  { value: "politique", fr: "Politique", en: "Policy" },
  { value: "technologie", fr: "Technologie", en: "Technology" },
  { value: "financement", fr: "Financement", en: "Financing" },
  { value: "marché", fr: "Marché", en: "Market" },
  { value: "réglementation", fr: "Réglementation", en: "Regulation" },
];

function ArticleCard({ article }: { article: BlogArticle }) {
  const { t, language } = useI18n();
  const title = language === "fr" ? article.titleFr : article.titleEn;
  const excerpt = language === "fr" ? article.excerptFr : article.excerptEn;
  const CategoryIcon = categoryIcons[article.category || "guide"] || BookOpen;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Link href={`/blog/${article.slug}`}>
        <Card className="h-full hover-elevate cursor-pointer group" data-testid={`card-article-${article.slug}`}>
          {article.featuredImage && (
            <div className="aspect-video overflow-hidden rounded-t-lg">
              <img 
                src={article.featuredImage} 
                alt={title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
          )}
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-3">
              {article.category && (
                <Badge variant="secondary" className="gap-1">
                  <CategoryIcon className="w-3 h-3" />
                  {t(`blog.category.${article.category}`)}
                </Badge>
              )}
              {article.publishedAt && (
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(article.publishedAt).toLocaleDateString(language === "fr" ? "fr-CA" : "en-CA")}
                </span>
              )}
            </div>
            
            <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors" data-testid={`text-article-title-${article.slug}`}>
              {title}
            </h3>
            
            {excerpt && (
              <p className="text-muted-foreground line-clamp-3 mb-4" data-testid={`text-article-excerpt-${article.slug}`}>
                {excerpt}
              </p>
            )}
            
            <div className="flex items-center text-primary font-medium">
              {t("blog.readMore")}
              <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}

function NewsArticleCard({ article }: { article: NewsArticle }) {
  const { language } = useI18n();
  const comment = article.editedCommentFr || article.aiCommentFr;
  const catLabel = article.category ? NEWS_CATEGORY_LABELS[article.category] : null;

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
            {catLabel && (
              <Badge variant="outline" className="text-xs" data-testid={`badge-category-${article.id}`}>
                {language === "fr" ? catLabel.fr : catLabel.en}
              </Badge>
            )}
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

          <div className="flex items-start gap-2 mb-2">
            <Link href={`/nouvelles/${article.slug}`} className="group flex-1" data-testid={`link-news-${article.id}`}>
              <h3 className="text-lg font-semibold group-hover:underline" data-testid={`text-news-title-${article.id}`}>
                {article.originalTitle}
              </h3>
            </Link>
            <Button size="icon" variant="ghost" asChild data-testid={`link-external-${article.id}`}>
              <a href={article.sourceUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4" />
              </a>
            </Button>
          </div>

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

export default function BlogPage() {
  const { t, language } = useI18n();
  const currentLogo = language === "fr" ? logoFr : logoEn;

  const [location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(location.split("?")[1] || "");
  const initialTab = searchParams.get("tab") === "nouvelles" ? "nouvelles" : "blog";
  const [activeTab, setActiveTab] = useState(initialTab);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setLocation(tab === "nouvelles" ? "/blog?tab=nouvelles" : "/blog", { replace: true });
  };
  const [selectedCategory, setSelectedCategory] = useState("");

  const { data: articles, isLoading } = useQuery<BlogArticle[]>({
    queryKey: ["/api/blog"],
  });

  const { data: newsArticles, isLoading: newsLoading } = useQuery<NewsArticle[]>({
    queryKey: ["/api/public/news"],
  });

  const filteredNews = selectedCategory
    ? newsArticles?.filter((a) => a.category === selectedCategory)
    : newsArticles;

  return (
    <>
      <SEOHead
        title={language === "fr" ? "Ressources et guides solaires - kWh Québec" : "Solar Resources & Guides - kWh Québec"}
        description={language === "fr" 
          ? "Tout ce que vous devez savoir sur le solaire commercial au Québec. Guides, actualités, incitatifs Hydro-Québec et ressources." 
          : "Everything you need to know about commercial solar in Québec. Guides, news, Hydro-Québec incentives and resources."}
        ogType="website"
        locale={language}
        keywords={language === "fr" 
          ? "solaire commercial, québec, hydro-québec, incitatifs, panneaux solaires, entreprise, guide" 
          : "commercial solar, quebec, hydro-quebec, incentives, solar panels, business, guide"}
        canonical={`${window.location.origin}/blog`}
        structuredData={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: language === "fr" ? "Ressources et guides solaires" : "Solar Resources & Guides",
          description: language === "fr" 
            ? "Collection de guides et ressources sur l'énergie solaire commerciale au Québec" 
            : "Collection of guides and resources on commercial solar energy in Québec",
          url: `${window.location.origin}/blog`,
          publisher: {
            "@type": "Organization",
            name: "kWh Québec"
          },
          mainEntity: {
            "@type": "ItemList",
            itemListElement: articles?.map((article, index) => ({
              "@type": "ListItem",
              position: index + 1,
              url: `${window.location.origin}/blog/${article.slug}`
            })) || []
          }
        }}
      />
      
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <Link href="/">
              <img src={currentLogo} alt={language === "fr" ? "Logo kWh Québec – Énergie solaire commerciale" : "kWh Québec Logo – Commercial Solar Energy"} className="h-[50px] cursor-pointer" data-testid="img-logo" />
            </Link>
            <nav className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" data-testid="link-home">{t("nav.home")}</Button>
              </Link>
              <Link href="/services">
                <Button variant="ghost" data-testid="link-services">{language === "fr" ? "Services" : "Services"}</Button>
              </Link>
              <Link href="/blog">
                <Button variant="ghost" className="bg-accent/50" data-testid="link-blog">{language === "fr" ? "Ressources" : "Resources"}</Button>
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
            <h1 className="text-4xl font-bold mb-4" data-testid="text-blog-title">
              {t("blog.title")}
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto" data-testid="text-blog-subtitle">
              {t("blog.subtitle")}
            </p>
          </motion.div>

          <Tabs value={activeTab} onValueChange={handleTabChange} className="mb-8">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2" data-testid="tabs-resources">
              <TabsTrigger value="blog" data-testid="tab-blog">
                <BookOpen className="w-4 h-4 mr-2" />
                {language === "fr" ? "Guides et articles" : "Guides & Articles"}
              </TabsTrigger>
              <TabsTrigger value="nouvelles" data-testid="tab-nouvelles">
                <Newspaper className="w-4 h-4 mr-2" />
                {language === "fr" ? "Nouvelles" : "News"}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="blog">
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
                    <ArticleCard key={article.id} article={article} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <BookOpen className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-xl text-muted-foreground" data-testid="text-no-articles">
                    {t("blog.noArticles")}
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="nouvelles">
              <div className="flex flex-wrap gap-2 mb-8 justify-center">
                {NEWS_CATEGORY_FILTERS.map((cat) => (
                  <Button
                    key={cat.value}
                    variant="outline"
                    className={selectedCategory === cat.value ? "toggle-elevate toggle-elevated" : "toggle-elevate"}
                    onClick={() => setSelectedCategory(cat.value)}
                    data-testid={`filter-category-${cat.value || "all"}`}
                  >
                    {language === "fr" ? cat.fr : cat.en}
                  </Button>
                ))}
              </div>

              {newsLoading ? (
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
              ) : filteredNews && filteredNews.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredNews.map((article) => (
                    <NewsArticleCard key={article.id} article={article} />
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
            </TabsContent>
          </Tabs>

          <motion.div 
            className="mt-16 bg-primary/5 rounded-2xl p-8 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <h2 className="text-2xl font-bold mb-4" data-testid="text-cta-title">
              {t("blog.ctaTitle")}
            </h2>
            <p className="text-muted-foreground mb-6 max-w-xl mx-auto" data-testid="text-cta-description">
              {t("blog.ctaDescription")}
            </p>
            <Link href="/#contact">
              <Button size="lg" data-testid="button-cta">
                {t("blog.ctaButton")}
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
