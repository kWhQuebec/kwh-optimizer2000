import { useState, useMemo } from "react";
import { format } from "date-fns";
import { FileText, Edit2, Save, X, Loader2, Eye, Code } from "lucide-react";
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

function renderValue(val: any, depth = 0): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (Array.isArray(val)) {
    return val.map((item, i) => {
      if (typeof item === "string") {
        return `<li>${item}</li>`;
      }
      return `<div class="preview-array-item" style="margin-bottom:12px;padding:12px;border:1px solid #e5e7eb;border-radius:6px;background:${depth % 2 === 0 ? '#f9fafb' : '#ffffff'}">${renderValue(item, depth + 1)}</div>`;
    }).join("");
  }
  if (typeof val === "object") {
    const entries = Object.entries(val);
    return entries.map(([key, v]) => {
      const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
      if (typeof v === "object" && v !== null && !Array.isArray(v) && ("fr" in (v as any) || "en" in (v as any))) {
        const bilingual = v as Record<string, any>;
        return `<div style="margin-bottom:8px;">
          <strong style="color:#003DA6;font-size:13px;">${label}</strong>
          <div style="display:flex;gap:12px;margin-top:4px;">
            <div style="flex:1;padding:8px;background:#eff6ff;border-radius:4px;font-size:13px;">
              <span style="font-weight:600;color:#003DA6;font-size:11px;">FR</span><br/>${renderValue(bilingual.fr, depth + 1)}
            </div>
            <div style="flex:1;padding:8px;background:#f0fdf4;border-radius:4px;font-size:13px;">
              <span style="font-weight:600;color:#16A34A;font-size:11px;">EN</span><br/>${renderValue(bilingual.en, depth + 1)}
            </div>
          </div>
        </div>`;
      }
      if (Array.isArray(v)) {
        const isBilingualList = v.length === 0;
        return `<div style="margin-bottom:8px;">
          <strong style="color:#003DA6;font-size:13px;">${label}</strong>
          <ul style="margin:4px 0 0 16px;padding:0;list-style:disc;font-size:13px;">${renderValue(v, depth + 1)}</ul>
        </div>`;
      }
      if (typeof v === "object" && v !== null) {
        return `<div style="margin-bottom:8px;">
          <strong style="color:#003DA6;font-size:13px;">${label}</strong>
          <div style="margin-left:12px;padding-left:8px;border-left:2px solid #e5e7eb;">${renderValue(v, depth + 1)}</div>
        </div>`;
      }
      return `<div style="margin-bottom:4px;font-size:13px;"><strong style="color:#003DA6;font-size:12px;">${label}:</strong> ${renderValue(v, depth + 1)}</div>`;
    }).join("");
  }
  return String(val);
}

function ContentPreview({ item, language }: { item: SiteContentItem; language: string }) {
  const val = item.value;

  const html = useMemo(() => {
    if (!val) return "<p style='color:#999;'>Aucun contenu</p>";

    if (item.contentKey === "testimonials" && Array.isArray(val)) {
      return val.map((t: any, i: number) => {
        const text = t.text?.[language] || t.text?.fr || "";
        const name = t.name || "";
        const role = t.role?.[language] || t.role?.fr || "";
        const company = t.company || "";
        return `<div style="padding:16px;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:12px;background:#fafafa;">
          <p style="font-style:italic;color:#374151;font-size:14px;margin:0 0 8px;">"${text}"</p>
          <div style="font-size:13px;"><strong>${name}</strong>${role ? ` — ${role}` : ""}${company ? `, ${company}` : ""}</div>
        </div>`;
      }).join("");
    }

    if (item.contentKey === "faq" && Array.isArray(val)) {
      return val.map((faq: any, i: number) => {
        const q = faq.question?.[language] || faq.question?.fr || "";
        const a = faq.answer?.[language] || faq.answer?.fr || "";
        return `<div style="padding:12px;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:8px;">
          <p style="font-weight:600;color:#003DA6;font-size:14px;margin:0 0 6px;">Q: ${q}</p>
          <p style="color:#374151;font-size:13px;margin:0;">R: ${a}</p>
        </div>`;
      }).join("");
    }

    if (item.contentKey === "landing_hero" && typeof val === "object") {
      const title = val.title?.[language] || val.title?.fr || "";
      const desc = val.description?.[language] || val.description?.fr || "";
      const cta = val.cta?.[language] || val.cta?.fr || "";
      return `<div style="background:linear-gradient(135deg,#003DA6,#002B75);color:white;padding:32px;border-radius:12px;text-align:center;">
        <h2 style="font-size:24px;font-weight:700;margin:0 0 12px;">${title}</h2>
        <p style="font-size:15px;opacity:0.9;margin:0 0 20px;">${desc}</p>
        ${cta ? `<span style="display:inline-block;padding:10px 24px;background:#FFB005;color:#002B75;font-weight:600;border-radius:6px;font-size:14px;">${cta}</span>` : ""}
      </div>`;
    }

    if (item.contentKey === "tripwire" && typeof val === "object") {
      const title = val.title?.[language] || val.title?.fr || "";
      const price = val.price || "";
      const cta = val.cta?.[language] || val.cta?.fr || "";
      const items = val.items?.[language] || val.items?.fr || [];
      return `<div style="border:2px solid #FFB005;border-radius:12px;padding:24px;">
        <h3 style="font-size:20px;font-weight:700;color:#003DA6;margin:0 0 4px;">${title}</h3>
        ${price ? `<p style="font-size:28px;font-weight:800;color:#FFB005;margin:8px 0 16px;">${price}</p>` : ""}
        <ul style="margin:0 0 16px;padding-left:20px;font-size:13px;color:#374151;">
          ${Array.isArray(items) ? items.map((it: string) => `<li style="margin-bottom:4px;">${it}</li>`).join("") : ""}
        </ul>
        ${cta ? `<span style="display:inline-block;padding:10px 24px;background:#003DA6;color:white;font-weight:600;border-radius:6px;font-size:14px;">${cta}</span>` : ""}
      </div>`;
    }

    if (item.contentKey === "referral" && typeof val === "object") {
      const title = val.title?.[language] || val.title?.fr || "";
      const amount = val.amount || "";
      const cta = val.cta?.[language] || val.cta?.fr || "";
      const steps = val.steps?.[language] || val.steps?.fr || [];
      return `<div style="background:linear-gradient(135deg,#16A34A,#15803d);color:white;border-radius:12px;padding:24px;">
        <h3 style="font-size:20px;font-weight:700;margin:0 0 4px;">${title}</h3>
        ${amount ? `<p style="font-size:28px;font-weight:800;color:#FFB005;margin:8px 0 16px;">${amount}</p>` : ""}
        <ol style="margin:0 0 16px;padding-left:20px;font-size:13px;">
          ${Array.isArray(steps) ? steps.map((s: string, i: number) => `<li style="margin-bottom:6px;">${s}</li>`).join("") : ""}
        </ol>
        ${cta ? `<span style="display:inline-block;padding:10px 24px;background:#FFB005;color:#002B75;font-weight:600;border-radius:6px;font-size:14px;">${cta}</span>` : ""}
      </div>`;
    }

    return renderValue(val);
  }, [val, item.contentKey, language]);

  return (
    <div
      className="prose prose-sm max-w-none p-4 bg-white dark:bg-slate-900 rounded-md border overflow-auto max-h-96"
      dangerouslySetInnerHTML={{ __html: html }}
      data-testid={`preview-${item.contentKey}`}
    />
  );
}

function ContentItemCard({
  item,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onToggleActive,
  isSaving,
  language,
}: {
  item: SiteContentItem;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (value: any) => void;
  onCancel: () => void;
  onToggleActive: (active: boolean) => void;
  isSaving: boolean;
  language: string;
}) {
  const [editValue, setEditValue] = useState(JSON.stringify(item.value, null, 2));
  const [viewMode, setViewMode] = useState<"json" | "preview">("preview");

  if (isEditing) {
    return (
      <Card className="border border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
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
          <div className="flex gap-1 mb-2">
            <Button
              variant={viewMode === "json" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("json")}
              data-testid="button-view-json-edit"
            >
              <Code className="w-3 h-3 mr-1" />
              JSON
            </Button>
            <Button
              variant={viewMode === "preview" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("preview")}
              data-testid="button-view-preview-edit"
            >
              <Eye className="w-3 h-3 mr-1" />
              {language === "fr" ? "Aperçu" : "Preview"}
            </Button>
          </div>

          {viewMode === "json" ? (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">
                JSON Value
              </label>
              <Textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="font-mono text-xs h-48"
                disabled={isSaving}
                data-testid="textarea-json-edit"
              />
            </div>
          ) : (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">
                {language === "fr" ? "Aperçu HTML" : "HTML Preview"}
              </label>
              <ContentPreview
                item={{ ...item, value: (() => { try { return JSON.parse(editValue); } catch { return item.value; } })() }}
                language={language}
              />
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={onCancel}
              disabled={isSaving}
              data-testid="button-cancel-edit"
            >
              <X className="w-4 h-4 mr-1" />
              {language === "fr" ? "Annuler" : "Cancel"}
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
              data-testid="button-save-edit"
            >
              {isSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              {language === "fr" ? "Sauvegarder" : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
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
                {item.updatedBy && <span> &bull; {item.updatedBy}</span>}
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
        <div className="flex gap-1 mb-1">
          <Button
            variant={viewMode === "json" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("json")}
            data-testid={`button-view-json-${item.contentKey}`}
          >
            <Code className="w-3 h-3 mr-1" />
            JSON
          </Button>
          <Button
            variant={viewMode === "preview" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("preview")}
            data-testid={`button-view-preview-${item.contentKey}`}
          >
            <Eye className="w-3 h-3 mr-1" />
            {language === "fr" ? "Aperçu" : "Preview"}
          </Button>
        </div>

        {viewMode === "json" ? (
          <div className="bg-muted p-3 rounded text-xs font-mono max-h-32 overflow-hidden text-ellipsis">
            <pre className="whitespace-pre-wrap break-words">
              {JSON.stringify(item.value, null, 2).slice(0, 500)}
            </pre>
          </div>
        ) : (
          <ContentPreview item={item} language={language} />
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={onEdit}
          disabled={isSaving}
          className="w-full"
          data-testid={`button-edit-${item.contentKey}`}
        >
          <Edit2 className="w-4 h-4 mr-2" />
          {language === "fr" ? "Modifier" : "Edit"}
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
        <h1 className="text-3xl font-bold tracking-tight" data-testid="text-content-title">
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
              <TabsTrigger key={cat} value={cat} className="text-xs sm:text-sm" data-testid={`tab-${cat}`}>
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
                      language={language}
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
