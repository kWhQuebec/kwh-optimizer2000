import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Calendar, ArrowRight, BookOpen, FileText, Newspaper, Award } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useI18n } from "@/lib/i18n";
import { SEOHead } from "@/components/seo-head";
import type { BlogArticle } from "@shared/schema";
import logoFr from "@assets/kWh_Quebec_Logo-01_-_Rectangulaire_1764799021536.png";
import logoEn from "@assets/kWh_Quebec_Logo-02_-_Rectangle_1764799021536.png";

const categoryIcons: Record<string, typeof BookOpen> = {
  guide: BookOpen,
  news: Newspaper,
  "case-study": FileText,
  program: Award,
};

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

export default function BlogPage() {
  const { t, language } = useI18n();
  const currentLogo = language === "fr" ? logoFr : logoEn;

  const { data: articles, isLoading } = useQuery<BlogArticle[]>({
    queryKey: ["/api/blog"],
  });

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
              <img src={currentLogo} alt="kWh Québec" className="h-[50px] cursor-pointer" data-testid="img-logo" />
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
