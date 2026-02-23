import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Newspaper, RefreshCw, Loader2, ExternalLink, Check, X, Send, Trash2, Shield, Eye } from "lucide-react";
import { SiLinkedin } from "react-icons/si";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { NewsArticle } from "@shared/schema";

const CATEGORY_OPTIONS = [
  { value: "politique", label: "Politique" },
  { value: "technologie", label: "Technologie" },
  { value: "financement", label: "Financement" },
  { value: "marché", label: "Marché" },
  { value: "réglementation", label: "Réglementation" },
] as const;

function RelevanceBadge({ score }: { score: number | null }) {
  if (score === null || score === undefined) {
    return <Badge variant="outline" data-testid="badge-relevance-none">N/A</Badge>;
  }
  const variant = score >= 80 ? "default" : score >= 50 ? "secondary" : "destructive";
  return (
    <Badge variant={variant} data-testid={`badge-relevance-${score}`}>
      {score}/100
    </Badge>
  );
}

function ArticleCard({ article, onUpdate, onDelete }: {
  article: NewsArticle;
  onUpdate: (id: string, updates: Partial<NewsArticle>) => void;
  onDelete: (id: string) => void;
}) {
  const [editedComment, setEditedComment] = useState(article.editedCommentFr || article.aiCommentFr || "");
  const [editedSocialPost, setEditedSocialPost] = useState(article.editedSocialPostFr || article.aiSocialPostFr || "");
  const [selectedCategory, setSelectedCategory] = useState(article.category || "");

  return (
    <Card className="mb-4" data-testid={`card-news-${article.id}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
          <div className="flex-1 min-w-0">
            <a
              href={article.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-lg font-semibold hover:underline inline-flex items-center gap-1"
              data-testid={`link-article-${article.id}`}
            >
              {article.originalTitle}
              <ExternalLink className="w-4 h-4 flex-shrink-0" />
            </a>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-sm text-muted-foreground" data-testid={`text-source-${article.id}`}>
                {article.sourceName}
              </span>
              {article.publishedAt && (
                <span className="text-sm text-muted-foreground">
                  {format(new Date(article.publishedAt), "d MMM yyyy", { locale: fr })}
                </span>
              )}
              <span className="text-sm text-muted-foreground inline-flex items-center gap-1" data-testid={`text-views-${article.id}`}>
                <Eye className="w-3 h-3" /> {article.viewCount || 0}
              </span>
              <RelevanceBadge score={article.aiRelevanceScore} />
              {article.category && (
                <Badge variant="outline" data-testid={`badge-category-${article.id}`}>
                  {CATEGORY_OPTIONS.find(c => c.value === article.category)?.label || article.category}
                </Badge>
              )}
              <Badge variant="outline">{article.language?.toUpperCase()}</Badge>
            </div>
          </div>
        </div>

        {article.aiSummaryFr && (
          <p className="text-sm text-muted-foreground mb-3 bg-muted/50 p-3 rounded-md" data-testid={`text-summary-${article.id}`}>
            {article.aiSummaryFr}
          </p>
        )}

        <div className="space-y-3 mb-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Commentaire expert
            </label>
            <Textarea
              value={editedComment}
              onChange={(e) => setEditedComment(e.target.value)}
              rows={3}
              className="text-sm"
              data-testid={`textarea-comment-${article.id}`}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Post réseaux sociaux (FR)
            </label>
            <Textarea
              value={editedSocialPost}
              onChange={(e) => setEditedSocialPost(e.target.value)}
              rows={2}
              className="text-sm"
              data-testid={`textarea-social-${article.id}`}
            />
          </div>
          {article.aiSocialPostEn && (
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Social post (EN)
              </label>
              <p className="text-sm text-muted-foreground bg-muted/30 p-2 rounded-md" data-testid={`text-social-en-${article.id}`}>
                {article.aiSocialPostEn}
              </p>
            </div>
          )}
        </div>

        {article.aiTags && article.aiTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4" data-testid={`tags-${article.id}`}>
            {article.aiTags.map((tag, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <div className="mb-4">
          <label className="text-xs font-medium text-muted-foreground block mb-1">
            Catégorie
          </label>
          <Select value={selectedCategory} onValueChange={setSelectedCategory} data-testid={`select-category-${article.id}`}>
            <SelectTrigger className="w-48" data-testid={`select-category-trigger-${article.id}`}>
              <SelectValue placeholder="Choisir une catégorie" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((cat) => (
                <SelectItem key={cat.value} value={cat.value} data-testid={`select-category-item-${cat.value}-${article.id}`}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {article.status === "pending" && (
            <>
              <Button
                size="sm"
                onClick={() => onUpdate(article.id, {
                  status: "approved",
                  editedCommentFr: editedComment,
                  editedSocialPostFr: editedSocialPost,
                  category: selectedCategory || null,
                })}
                data-testid={`button-approve-${article.id}`}
              >
                <Check className="w-4 h-4 mr-1" />
                Approuver
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onUpdate(article.id, {
                  status: "published",
                  editedCommentFr: editedComment,
                  editedSocialPostFr: editedSocialPost,
                  category: selectedCategory || null,
                })}
                data-testid={`button-publish-${article.id}`}
              >
                <Send className="w-4 h-4 mr-1" />
                Publier
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => onUpdate(article.id, { status: "rejected" })}
                data-testid={`button-reject-${article.id}`}
              >
                <X className="w-4 h-4 mr-1" />
                Rejeter
              </Button>
            </>
          )}
          {article.status === "approved" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onUpdate(article.id, {
                status: "published",
                editedCommentFr: editedComment,
                editedSocialPostFr: editedSocialPost,
                category: selectedCategory || null,
              })}
              data-testid={`button-publish-${article.id}`}
            >
              <Send className="w-4 h-4 mr-1" />
              Publier
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              onUpdate(article.id, {
                editedCommentFr: editedComment,
                editedSocialPostFr: editedSocialPost,
                category: selectedCategory || null,
              });
            }}
            data-testid={`button-save-${article.id}`}
          >
            Sauvegarder
          </Button>
          {(article.status === "approved" || article.status === "published") && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                const socialPost = article.editedSocialPostFr || article.aiSocialPostFr || "";
                const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(article.sourceUrl)}&summary=${encodeURIComponent(socialPost)}`;
                window.open(url, "_blank");
              }}
              data-testid={`button-linkedin-${article.id}`}
            >
              <SiLinkedin className="w-4 h-4" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onDelete(article.id)}
            data-testid={`button-delete-${article.id}`}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminNewsPage() {
  const { language } = useI18n();
  const { isAdmin, isStaff } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("pending");

  const { data: articles, isLoading } = useQuery<NewsArticle[]>({
    queryKey: ["/api/admin/news"],
  });

  const fetchMutation = useMutation({
    mutationFn: () => apiRequest<{ fetched: number; newArticles: number; analyzed: number }>("POST", "/api/admin/news/fetch"),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/news"] });
      toast({
        title: "Nouvelles récupérées",
        description: `${data.newArticles} nouveaux articles, ${data.analyzed} analysés par IA`,
      });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Échec de la récupération des nouvelles", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<NewsArticle> }) =>
      apiRequest("PATCH", `/api/admin/news/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/news"] });
      toast({ title: "Article mis à jour" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Échec de la mise à jour", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/news/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/news"] });
      toast({ title: "Article supprimé" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Échec de la suppression", variant: "destructive" });
    },
  });

  if (!isAdmin && !isStaff) {
    return (
      <div className="text-center py-12">
        <Shield className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <p className="text-lg text-muted-foreground">
          {language === "fr" ? "Accès réservé aux administrateurs" : "Admin access required"}
        </p>
      </div>
    );
  }

  const filterArticles = (status: string) => {
    if (!articles) return [];
    if (status === "approved") {
      return articles.filter(a => a.status === "approved" || a.status === "published");
    }
    return articles.filter(a => a.status === status);
  };

  const handleUpdate = (id: string, updates: Partial<NewsArticle>) => {
    updateMutation.mutate({ id, updates });
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div className="flex items-center gap-3">
          <Newspaper className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            Nouvelles de l'industrie — Curation
          </h1>
        </div>
        <Button
          onClick={() => fetchMutation.mutate()}
          disabled={fetchMutation.isPending}
          data-testid="button-fetch-news"
        >
          {fetchMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Récupérer les nouvelles
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList data-testid="tabs-news-status">
          <TabsTrigger value="pending" data-testid="tab-pending">
            En attente ({filterArticles("pending").length})
          </TabsTrigger>
          <TabsTrigger value="approved" data-testid="tab-approved">
            Approuvées ({filterArticles("approved").length})
          </TabsTrigger>
          <TabsTrigger value="rejected" data-testid="tab-rejected">
            Rejetées ({filterArticles("rejected").length})
          </TabsTrigger>
        </TabsList>

        {["pending", "approved", "rejected"].map((status) => (
          <TabsContent key={status} value={status}>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-5 space-y-3">
                      <Skeleton className="h-6 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-20 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filterArticles(status).length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Newspaper className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground" data-testid={`text-empty-${status}`}>
                    Aucun article {status === "pending" ? "en attente" : status === "approved" ? "approuvé" : "rejeté"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              filterArticles(status).map((article) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                />
              ))
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
