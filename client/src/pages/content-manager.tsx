import { useState, useMemo } from "react";
import { format } from "date-fns";
import { FileText, Edit2, Save, X, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useAdminSiteContent, useUpdateSiteContent, type SiteContentItem } from "@/hooks/useSiteContent";

type EditingId = string | null;

const CATEGORIES = ["landing", "pricing", "social_proof", "email"] as const;

const categoryLabels: Record<string, { fr: string; en: string }> = {
  landing: { fr: "Page d'accueil", en: "Landing Page" },
  pricing: { fr: "Tarification", en: "Pricing" },
  social_proof: { fr: "Preuve sociale", en: "Social Proof" },
  email: { fr: "Email", en: "Email" },
};

function ContentItemCard({
  item,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onToggleActive,
  isSaving
}: {
  item: SiteContentItem;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (value: any) => void;
  onCancel: () => void;
  onToggleActive: (active: boolean) => void;
  isSaving: boolean;
}) {
  const [editValue, setEditValue] = useState(JSON.stringify(item.value, null, 2));

  if (isEditing) {
    return (
      <Card className="border border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-base">{item.label || item.contentKey}</CardTitle>
              <CardDescription className="text-xs mt-1">
                <Badge variant="outline" className="mr-2">
                  {item.contentKey}
                </Badge>
                {item.contentType}
              </CardDescription>
            </div>
            <Switch
              checked={item.isActive}
              onCheckedChange={onToggleActive}
              disabled={isSaving}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">
              JSON Value
            </label>
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="font-mono text-xs h-48"
              disabled={isSaving}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={onCancel}
              disabled={isSaving}
            >
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                try {
                  const parsed = JSON.parse(editValue);
                  onSave(parsed);
                } catch (e) {
                  alert("Invalid JSON");
                }
              }}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate">{item.label || item.contentKey}</CardTitle>
            <CardDescription className="text-xs mt-1 space-y-1">
              <div>
                <Badge variant="outline" className="mr-2">
                  {item.contentKey}
                </Badge>
                <span className="text-muted-foreground">{item.contentType}</span>
              </div>
              <div className="text-muted-foreground">
                {format(new Date(item.updatedAt), "MMM d, yyyy HH:mm")}
                {item.updatedBy && <span> • {item.updatedBy}</span>}
              </div>
            </CardDescription>
          </div>
          <Switch
            checked={item.isActive}
            onCheckedChange={onToggleActive}
            disabled={isSaving}
            className="ml-2 shrink-0"
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="bg-muted p-3 rounded text-xs font-mono max-h-32 overflow-hidden text-ellipsis">
          <pre className="whitespace-pre-wrap break-words">
            {JSON.stringify(item.value, null, 2).slice(0, 500)}
          </pre>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onEdit}
          disabled={isSaving}
          className="w-full"
        >
          <Edit2 className="w-4 h-4 mr-2" />
          Edit
        </Button>
      </CardContent>
    </Card>
  );
}

export default function ContentManagerPage() {
  const { t, language } = useI18n();
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const [editingId, setEditingId] = useState<EditingId>(null);
  const [activeCategory, setActiveCategory] = useState<string>("landing");

  const { data: allItems = [], isLoading } = useAdminSiteContent();
  const updateMutation = useUpdateSiteContent();

  const groupedByCategory = useMemo(() => {
    const grouped: Record<string, SiteContentItem[]> = {};
    for (const category of CATEGORIES) {
      grouped[category] = allItems.filter(item => item.category === category)
        .sort((a, b) => a.sortOrder - b.sortOrder);
    }
    return grouped;
  }, [allItems]);

  const handleEdit = (id: string) => {
    setEditingId(id);
  };

  const handleCancel = () => {
    setEditingId(null);
  };

  const handleSave = (itemId: string, newValue: any) => {
    const item = allItems.find(i => i.id === itemId);
    if (!item) return;

    updateMutation.mutate(
      { id: itemId, data: { value: newValue } },
      {
        onSuccess: () => {
          toast({
            title: language === "fr" ? "Sauvegardé" : "Saved",
            description: language === "fr"
              ? "Le contenu a été mis à jour."
              : "Content has been updated.",
          });
          setEditingId(null);
        },
        onError: (error: Error) => {
          toast({
            title: language === "fr" ? "Erreur" : "Error",
            description: error.message,
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleToggleActive = (itemId: string, active: boolean) => {
    const item = allItems.find(i => i.id === itemId);
    if (!item) return;

    updateMutation.mutate(
      { id: itemId, data: { isActive: active } },
      {
        onSuccess: () => {
          toast({
            title: language === "fr" ? "Mis à jour" : "Updated",
            description: language === "fr"
              ? `Le contenu est maintenant ${active ? "actif" : "inactif"}.`
              : `Content is now ${active ? "active" : "inactive"}.`,
          });
        },
        onError: (error: Error) => {
          toast({
            title: language === "fr" ? "Erreur" : "Error",
            description: error.message,
            variant: "destructive",
          });
        },
      }
    );
  };

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <p className="text-lg text-muted-foreground">
          {language === "fr" ? "Accès réservé aux administrateurs" : "Admin access required"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {language === "fr" ? "Gestion du contenu" : "Content Management"}
        </h1>
        <p className="text-muted-foreground mt-2">
          {language === "fr"
            ? "Modifiez le contenu du site et des pages de destination"
            : "Manage site and landing page content"}
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="h-10 bg-muted rounded w-full" />
          <div className="grid gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        </div>
      ) : (
        <Tabs defaultValue="landing" value={activeCategory} onValueChange={setActiveCategory}>
          <TabsList className="grid w-full grid-cols-4">
            {CATEGORIES.map((cat) => (
              <TabsTrigger key={cat} value={cat} className="text-xs sm:text-sm">
                {language === "fr" ? categoryLabels[cat].fr : categoryLabels[cat].en}
              </TabsTrigger>
            ))}
          </TabsList>

          {CATEGORIES.map((category) => (
            <TabsContent key={category} value={category} className="space-y-4 mt-6">
              {groupedByCategory[category].length > 0 ? (
                <div className="grid gap-4">
                  {groupedByCategory[category].map((item) => (
                    <ContentItemCard
                      key={item.id}
                      item={item}
                      isEditing={editingId === item.id}
                      onEdit={() => handleEdit(item.id)}
                      onSave={(value) => handleSave(item.id, value)}
                      onCancel={handleCancel}
                      onToggleActive={(active) => handleToggleActive(item.id, active)}
                      isSaving={updateMutation.isPending}
                    />
                  ))}
                </div>
              ) : (
                <Card className="text-center py-12">
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">
                    {language === "fr"
                      ? "Aucun contenu dans cette catégorie"
                      : "No content in this category"}
                  </p>
                </Card>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
