import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { motion } from "framer-motion";
import { Calendar, ArrowLeft, ArrowRight, BookOpen, Share2, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useI18n } from "@/lib/i18n";
import { SEOHead } from "@/components/seo-head";
import type { BlogArticle } from "@shared/schema";
import logoFr from "@assets/kWh_Quebec_Logo-01_-_Rectangulaire_1764799021536.png";
import logoEn from "@assets/kWh_Quebec_Logo-02_-_Rectangle_1764799021536.png";

export default function BlogArticlePage() {
  const { t, language } = useI18n();
  const { slug } = useParams<{ slug: string }>();
  const currentLogo = language === "fr" ? logoFr : logoEn;

  const { data: article, isLoading, error } = useQuery<BlogArticle>({
    queryKey: ["/api/blog", slug],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <Link href="/">
              <img src={currentLogo} alt={language === "fr" ? "Logo kWh Québec – Énergie solaire commerciale" : "kWh Québec Logo – Commercial Solar Energy"} className="h-[50px] cursor-pointer" />
            </Link>
            <div className="flex items-center gap-2">
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-16 text-center">
          <BookOpen className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-4">
            {language === "fr" ? "Article introuvable" : "Article not found"}
          </h1>
          <Link href="/blog">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t("blog.backToList")}
            </Button>
          </Link>
        </main>
      </div>
    );
  }

  const title = language === "fr" ? article.titleFr : article.titleEn;
  const content = language === "fr" ? article.contentFr : article.contentEn;
  const metaDescription = language === "fr" ? article.metaDescriptionFr : article.metaDescriptionEn;

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": language === "fr" ? "Accueil" : "Home", "item": "https://www.kwh.quebec/" },
      { "@type": "ListItem", "position": 2, "name": language === "fr" ? "Ressources" : "Resources", "item": "https://www.kwh.quebec/blog" },
      { "@type": "ListItem", "position": 3, "name": title, "item": `https://www.kwh.quebec/blog/${slug}` }
    ]
  };

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description: metaDescription || title,
    author: {
      "@type": "Organization",
      name: article.authorName || "kWh Québec"
    },
    publisher: {
      "@type": "Organization",
      name: "kWh Québec"
    },
    datePublished: article.publishedAt,
    dateModified: article.updatedAt || article.publishedAt,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${window.location.origin}/blog/${slug}`
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  return (
    <>
      <SEOHead
        title={`${title} - kWh Québec`}
        description={metaDescription || title}
        ogType="article"
        locale={language}
        keywords={article.keywords?.join(", ")}
        canonical={`${window.location.origin}/blog/${slug}`}
        structuredData={[articleSchema, breadcrumbSchema]}
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
              <Link href="/blog">
                <Button variant="ghost" data-testid="link-blog">{language === "fr" ? "Ressources" : "Resources"}</Button>
              </Link>
              <LanguageToggle />
              <ThemeToggle />
            </nav>
          </div>
        </header>

        <main className="container mx-auto px-4 py-12 max-w-4xl">
          <Link href="/blog">
            <Button variant="ghost" className="mb-6" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t("blog.backToList")}
            </Button>
          </Link>

          <motion.article
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {article.featuredImage && (
              <div className="aspect-video overflow-hidden rounded-xl mb-8">
                <img 
                  src={article.featuredImage} 
                  alt={title}
                  className="w-full h-full object-cover"
                  data-testid="img-featured"
                />
              </div>
            )}

            <div className="flex items-center gap-3 mb-4 flex-wrap">
              {article.category && (
                <Badge variant="secondary">
                  {t(`blog.category.${article.category}`)}
                </Badge>
              )}
              {article.publishedAt && (
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {t("blog.publishedOn")} {new Date(article.publishedAt).toLocaleDateString(language === "fr" ? "fr-CA" : "en-CA", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              )}
              <Button variant="ghost" size="sm" onClick={handleShare} data-testid="button-share">
                <Share2 className="w-4 h-4 mr-1" />
                {t("blog.shareArticle")}
              </Button>
            </div>

            <h1 className="text-4xl font-bold mb-6" data-testid="text-article-title">
              {title}
            </h1>

            <div 
              className="prose prose-lg dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: content }}
              data-testid="div-article-content"
            />
          </motion.article>

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
