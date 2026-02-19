import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import {
  BarChart3,
  Target,
  Eye,
  AlertTriangle,
  Calendar,
  Zap,
  Plus,
  Check,
  Trash2,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Star,
  Trophy,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Tab definitions
const TABS = [
  { id: "scorecard", icon: BarChart3, labelFr: "Scorecard", labelEn: "Scorecard" },
  { id: "rocks", icon: Target, labelFr: "Rocks", labelEn: "Rocks" },
  { id: "vto", icon: Eye, labelFr: "V/TO", labelEn: "V/TO" },
  { id: "issues", icon: AlertTriangle, labelFr: "Issues", labelEn: "Issues" },
  { id: "l10", icon: Calendar, labelFr: "L10", labelEn: "L10" },
  { id: "gamification", icon: Zap, labelFr: "Gamification", labelEn: "Gamification" },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ─── SCORECARD TAB ───────────────────────────────────────────
function ScorecardTab({ language }: { language: string }) {
  const { data: metrics = [], isLoading } = useQuery({
    queryKey: ["/api/eos/scorecard"],
    queryFn: async () => {
      const res = await fetch("/api/eos/scorecard");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const [showAdd, setShowAdd] = useState(false);
  const [newMetric, setNewMetric] = useState({ name: "", target: "", unit: "", owner: "" });
  const queryClient = useQueryClient();

  const addMetric = useMutation({
    mutationFn: async (metric: typeof newMetric) => {
      const res = await fetch("/api/eos/scorecard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metric),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/eos/scorecard"] });
      setShowAdd(false);
      setNewMetric({ name: "", target: "", unit: "", owner: "" });
    },
  });

  // Sample data for demo when API not yet connected
  const sampleMetrics = [
    { id: 1, name: "Leads qualifiés / sem.", target: 10, actual: 8, unit: "leads", owner: "Marc-André", trend: "up" },
    { id: 2, name: "Propositions envoyées", target: 5, actual: 6, unit: "propositions", owner: "Équipe ventes", trend: "up" },
    { id: 3, name: "Taux de conversion", target: 25, actual: 18, unit: "%", owner: "Équipe ventes", trend: "down" },
    { id: 4, name: "kW signés / mois", target: 500, actual: 420, unit: "kW", owner: "Marc-André", trend: "up" },
    { id: 5, name: "Délai moyen qualification", target: 3, actual: 4.5, unit: "jours", owner: "BDR", trend: "down" },
    { id: 6, name: "Revenus mensuels", target: 150000, actual: 132000, unit: "$", owner: "Finance", trend: "up" },
    { id: 7, name: "Satisfaction client", target: 90, actual: 92, unit: "%", owner: "O&M", trend: "up" },
  ];

  const displayMetrics = metrics.length > 0 ? metrics : sampleMetrics;

  const getTrendIcon = (trend: string) => {
    if (trend === "up") return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (trend === "down") return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  const getStatus = (actual: number, target: number) => {
    const ratio = actual / target;
    if (ratio >= 1) return "on-track";
    if (ratio >= 0.8) return "caution";
    return "off-track";
  };

  const statusColors: Record<string, string> = {
    "on-track": "bg-green-500",
    "caution": "bg-yellow-500",
    "off-track": "bg-red-500",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">
            {language === "fr" ? "Scorecard hebdomadaire" : "Weekly Scorecard"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {language === "fr"
              ? "5 à 15 métriques clés suivies chaque semaine"
              : "5-15 key metrics tracked weekly"}
          </p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1" />
              {language === "fr" ? "Ajouter" : "Add"}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {language === "fr" ? "Nouvelle métrique" : "New Metric"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                placeholder={language === "fr" ? "Nom de la métrique" : "Metric name"}
                value={newMetric.name}
                onChange={(e) => setNewMetric({ ...newMetric, name: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder={language === "fr" ? "Cible" : "Target"}
                  type="number"
                  value={newMetric.target}
                  onChange={(e) => setNewMetric({ ...newMetric, target: e.target.value })}
                />
                <Input
                  placeholder={language === "fr" ? "Unité (%, $, kW)" : "Unit (%, $, kW)"}
                  value={newMetric.unit}
                  onChange={(e) => setNewMetric({ ...newMetric, unit: e.target.value })}
                />
              </div>
              <Input
                placeholder={language === "fr" ? "Responsable" : "Owner"}
                value={newMetric.owner}
                onChange={(e) => setNewMetric({ ...newMetric, owner: e.target.value })}
              />
              <Button onClick={() => addMetric.mutate(newMetric)} className="w-full">
                {language === "fr" ? "Ajouter" : "Add"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">{language === "fr" ? "Métrique" : "Metric"}</th>
              <th className="text-left p-3 font-medium">{language === "fr" ? "Responsable" : "Owner"}</th>
              <th className="text-right p-3 font-medium">{language === "fr" ? "Cible" : "Target"}</th>
              <th className="text-right p-3 font-medium">{language === "fr" ? "Actuel" : "Actual"}</th>
              <th className="text-center p-3 font-medium">{language === "fr" ? "Statut" : "Status"}</th>
              <th className="text-center p-3 font-medium">{language === "fr" ? "Tendance" : "Trend"}</th>
            </tr>
          </thead>
          <tbody>
            {displayMetrics.map((m: any) => {
              const status = getStatus(m.actual, m.target);
              return (
                <tr key={m.id} className="border-t hover:bg-muted/30 transition-colors">
                  <td className="p-3 font-medium">{m.name}</td>
                  <td className="p-3 text-muted-foreground">{m.owner}</td>
                  <td className="p-3 text-right">{m.target.toLocaleString()} {m.unit}</td>
                  <td className="p-3 text-right font-semibold">{m.actual.toLocaleString()} {m.unit}</td>
                  <td className="p-3 text-center">
                    <span className={`inline-block w-3 h-3 rounded-full ${statusColors[status]}`} />
                  </td>
                  <td className="p-3 text-center">{getTrendIcon(m.trend)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {metrics.length === 0 && (
        <p className="text-xs text-muted-foreground text-center italic">
          {language === "fr"
            ? "Données de démonstration — les vraies métriques seront liées à l'API"
            : "Demo data — real metrics will be connected to the API"}
        </p>
      )}
    </div>
  );
}

// ─── ROCKS TAB ───────────────────────────────────────────────
function RocksTab({ language }: { language: string }) {
  const { data: rocks = [] } = useQuery({
    queryKey: ["/api/eos/rocks"],
    queryFn: async () => {
      const res = await fetch("/api/eos/rocks");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const sampleRocks = [
    { id: 1, title: "Atteindre 2 MW signés ce trimestre", owner: "Marc-André", status: "on-track", progress: 65, quarter: "Q1 2026", priority: "company" },
    { id: 2, title: "Lancer le portail client V2", owner: "Dev", status: "on-track", progress: 40, quarter: "Q1 2026", priority: "company" },
    { id: 3, title: "Réduire le délai proposition→signature à < 15 jours", owner: "Ventes", status: "caution", progress: 30, quarter: "Q1 2026", priority: "company" },
    { id: 4, title: "Signer 3 partenariats installateurs", owner: "Marc-André", status: "on-track", progress: 66, quarter: "Q1 2026", priority: "department" },
    { id: 5, title: "Implanter EOS complet dans l'outil", owner: "Dev", status: "on-track", progress: 25, quarter: "Q1 2026", priority: "department" },
    { id: 6, title: "Automatiser le suivi O&M", owner: "O&M", status: "off-track", progress: 10, quarter: "Q1 2026", priority: "department" },
  ];

  const displayRocks = rocks.length > 0 ? rocks : sampleRocks;

  const statusConfig: Record<string, { color: string; label: string; labelEn: string }> = {
    "on-track": { color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", label: "En piste", labelEn: "On Track" },
    "caution": { color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", label: "Attention", labelEn: "Caution" },
    "off-track": { color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", label: "En retard", labelEn: "Off Track" },
    "done": { color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", label: "Complété", labelEn: "Done" },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">
            {language === "fr" ? "Rocks trimestriels" : "Quarterly Rocks"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {language === "fr"
              ? "3-7 priorités par personne pour le trimestre en cours"
              : "3-7 priorities per person for the current quarter"}
          </p>
        </div>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-1" />
          {language === "fr" ? "Nouveau Rock" : "New Rock"}
        </Button>
      </div>

      {/* Company Rocks */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          {language === "fr" ? "Rocks entreprise" : "Company Rocks"}
        </h3>
        <div className="grid gap-3">
          {displayRocks.filter((r: any) => r.priority === "company").map((rock: any) => {
            const cfg = statusConfig[rock.status] || statusConfig["on-track"];
            return (
              <Card key={rock.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Target className="w-4 h-4 text-primary shrink-0" />
                        <span className="font-medium truncate">{rock.title}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span>{rock.owner}</span>
                        <span>{rock.quarter}</span>
                      </div>
                    </div>
                    <Badge className={cfg.color}>
                      {language === "fr" ? cfg.label : cfg.labelEn}
                    </Badge>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{language === "fr" ? "Progression" : "Progress"}</span>
                      <span className="font-medium">{rock.progress}%</span>
                    </div>
                    <Progress value={rock.progress} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Department Rocks */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          {language === "fr" ? "Rocks départementaux" : "Department Rocks"}
        </h3>
        <div className="grid gap-3">
          {displayRocks.filter((r: any) => r.priority === "department").map((rock: any) => {
            const cfg = statusConfig[rock.status] || statusConfig["on-track"];
            return (
              <Card key={rock.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Target className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate">{rock.title}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span>{rock.owner}</span>
                        <span>{rock.quarter}</span>
                      </div>
                    </div>
                    <Badge className={cfg.color}>
                      {language === "fr" ? cfg.label : cfg.labelEn}
                    </Badge>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{language === "fr" ? "Progression" : "Progress"}</span>
                      <span className="font-medium">{rock.progress}%</span>
                    </div>
                    <Progress value={rock.progress} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── V/TO TAB ────────────────────────────────────────────────
function VtoTab({ language }: { language: string }) {
  const sections = [
    {
      title: language === "fr" ? "Valeurs fondamentales" : "Core Values",
      icon: Star,
      content: language === "fr"
        ? ["Intégrité et transparence", "Excellence technique", "Impact environnemental positif", "Partenariats durables", "Innovation pragmatique"]
        : ["Integrity and transparency", "Technical excellence", "Positive environmental impact", "Lasting partnerships", "Pragmatic innovation"],
    },
    {
      title: language === "fr" ? "Focus" : "Core Focus",
      icon: Target,
      purpose: language === "fr" ? "Accélérer la transition énergétique solaire au Québec" : "Accelerate the solar energy transition in Quebec",
      niche: language === "fr" ? "Solutions solaires clé-en-main pour C&I (commercial & industriel)" : "Turnkey solar solutions for C&I (commercial & industrial)",
    },
    {
      title: language === "fr" ? "Cible à 10 ans" : "10-Year Target",
      icon: TrendingUp,
      target: language === "fr" ? "100 MW installés • 500+ clients actifs • Référence #1 au Québec" : "100 MW installed • 500+ active clients • #1 reference in Quebec",
    },
    {
      title: language === "fr" ? "Stratégie marketing" : "Marketing Strategy",
      icon: Users,
      items: language === "fr"
        ? ["Cible: PME manufacturières et commerciales 100-5000 kW", "Différenciateur: Plateforme technologique + approche data-driven", "Processus éprouvé: Analyse → Design → Construction → O&M", "Garantie: Performance garantie avec monitoring en temps réel"]
        : ["Target: Manufacturing & commercial SMBs 100-5000 kW", "Differentiator: Technology platform + data-driven approach", "Proven process: Analysis → Design → Construction → O&M", "Guarantee: Performance guaranteed with real-time monitoring"],
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">
          {language === "fr" ? "Vision / Traction Organizer" : "Vision / Traction Organizer"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {language === "fr"
            ? "Le document stratégique fondamental d'EOS — vision partagée de l'entreprise"
            : "The foundational EOS strategic document — shared company vision"}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((section, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <section.icon className="w-5 h-5 text-primary" />
                {section.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {section.content && (
                <ul className="space-y-1">
                  {section.content.map((item, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm">
                      <ChevronRight className="w-3 h-3 mt-1 text-primary shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
              {section.purpose && (
                <div className="space-y-2">
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground uppercase">{language === "fr" ? "Raison d'être" : "Purpose"}</span>
                    <p className="text-sm mt-1">{section.purpose}</p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground uppercase">{language === "fr" ? "Niche" : "Niche"}</span>
                    <p className="text-sm mt-1">{section.niche}</p>
                  </div>
                </div>
              )}
              {section.target && (
                <p className="text-sm font-medium">{section.target}</p>
              )}
              {section.items && (
                <ul className="space-y-1">
                  {section.items.map((item, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm">
                      <ChevronRight className="w-3 h-3 mt-1 text-primary shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-dashed">
        <CardContent className="p-4 text-center text-sm text-muted-foreground">
          {language === "fr"
            ? "Le V/TO sera bientôt éditable directement dans l'outil. Pour l'instant, ces données sont configurables."
            : "The V/TO will soon be editable directly in the tool. For now, this data is configurable."}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── ISSUES TAB ──────────────────────────────────────────────
function IssuesTab({ language }: { language: string }) {
  const [issues, setIssues] = useState([
    { id: 1, title: language === "fr" ? "Délai trop long entre proposition et signature" : "Too long delay between proposal and signature", priority: "high", status: "open", votes: 3 },
    { id: 2, title: language === "fr" ? "Manque de visibilité sur le pipeline construction" : "Lack of visibility on construction pipeline", priority: "high", status: "open", votes: 2 },
    { id: 3, title: language === "fr" ? "Processus de qualification des leads pas assez strict" : "Lead qualification process not strict enough", priority: "medium", status: "ids", votes: 2 },
    { id: 4, title: language === "fr" ? "Formation des nouveaux employés trop longue" : "New employee training too long", priority: "medium", status: "open", votes: 1 },
    { id: 5, title: language === "fr" ? "Intégration CRM↔comptabilité manquante" : "CRM↔accounting integration missing", priority: "low", status: "open", votes: 1 },
  ]);
  const [newIssue, setNewIssue] = useState("");

  const addIssue = () => {
    if (!newIssue.trim()) return;
    setIssues([
      ...issues,
      { id: Date.now(), title: newIssue, priority: "medium", status: "open", votes: 0 },
    ]);
    setNewIssue("");
  };

  const priorityColors: Record<string, string> = {
    high: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    low: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  };

  const statusLabels: Record<string, { fr: string; en: string; color: string }> = {
    open: { fr: "Ouvert", en: "Open", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200" },
    ids: { fr: "IDS en cours", en: "IDS in progress", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
    solved: { fr: "Résolu", en: "Solved", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">
            {language === "fr" ? "Liste d'issues" : "Issues List"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {language === "fr"
              ? "Identifier → Discuter → Solutionner (IDS)"
              : "Identify → Discuss → Solve (IDS)"}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder={language === "fr" ? "Ajouter une issue..." : "Add an issue..."}
          value={newIssue}
          onChange={(e) => setNewIssue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addIssue()}
        />
        <Button onClick={addIssue} size="sm">
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      <div className="space-y-2">
        {issues
          .sort((a, b) => b.votes - a.votes)
          .map((issue) => {
            const sl = statusLabels[issue.status] || statusLabels.open;
            return (
              <Card key={issue.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-3 flex items-center gap-3">
                  <button
                    className="flex flex-col items-center text-xs text-muted-foreground hover:text-primary transition-colors"
                    onClick={() =>
                      setIssues(issues.map((i) => (i.id === issue.id ? { ...i, votes: i.votes + 1 } : i)))
                    }
                  >
                    <ChevronRight className="w-4 h-4 -rotate-90" />
                    <span className="font-bold">{issue.votes}</span>
                  </button>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{issue.title}</span>
                  </div>
                  <Badge className={priorityColors[issue.priority]}>
                    {issue.priority}
                  </Badge>
                  <Badge className={sl.color}>
                    {language === "fr" ? sl.fr : sl.en}
                  </Badge>
                  <Select
                    value={issue.status}
                    onValueChange={(val) =>
                      setIssues(issues.map((i) => (i.id === issue.id ? { ...i, status: val } : i)))
                    }
                  >
                    <SelectTrigger className="w-[120px] h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">{language === "fr" ? "Ouvert" : "Open"}</SelectItem>
                      <SelectItem value="ids">IDS</SelectItem>
                      <SelectItem value="solved">{language === "fr" ? "Résolu" : "Solved"}</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            );
          })}
      </div>
    </div>
  );
}

// ─── L10 TAB ─────────────────────────────────────────────────
function L10Tab({ language }: { language: string }) {
  const agenda = [
    { time: "5 min", item: language === "fr" ? "Bonnes nouvelles (personnel & pro)" : "Good news (personal & professional)", done: false },
    { time: "5 min", item: language === "fr" ? "Revue du Scorecard" : "Scorecard review", done: false },
    { time: "5 min", item: language === "fr" ? "Revue des Rocks" : "Rock review", done: false },
    { time: "5 min", item: language === "fr" ? "Titres clients/employés" : "Customer/employee headlines", done: false },
    { time: "5 min", item: language === "fr" ? "Liste de To-Do" : "To-Do list", done: false },
    { time: "60 min", item: language === "fr" ? "IDS — Résolution d'issues" : "IDS — Issue solving", done: false },
    { time: "5 min", item: language === "fr" ? "Conclusion" : "Conclude", done: false },
  ];

  const [todos, setTodos] = useState([
    { id: 1, text: language === "fr" ? "Envoyer proposition Solaris inc." : "Send proposal to Solaris inc.", owner: "Marc-André", done: false, dueDate: "2026-02-25" },
    { id: 2, text: language === "fr" ? "Relancer 3 leads en attente" : "Follow up on 3 pending leads", owner: "BDR", done: true, dueDate: "2026-02-20" },
    { id: 3, text: language === "fr" ? "Finaliser design 450kW Laval" : "Finalize 450kW Laval design", owner: "Ingénierie", done: false, dueDate: "2026-02-22" },
  ]);

  const [agendaItems, setAgendaItems] = useState(agenda);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">
          {language === "fr" ? "Réunion Level 10" : "Level 10 Meeting"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {language === "fr"
            ? "90 minutes, même jour, même heure, chaque semaine"
            : "90 minutes, same day, same time, every week"}
        </p>
      </div>

      {/* Agenda */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {language === "fr" ? "Agenda (90 min)" : "Agenda (90 min)"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {agendaItems.map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => {
                  const updated = [...agendaItems];
                  updated[i] = { ...updated[i], done: !updated[i].done };
                  setAgendaItems(updated);
                }}
              >
                <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${item.done ? "bg-primary border-primary" : "border-muted-foreground/30"}`}>
                  {item.done && <Check className="w-3 h-3 text-primary-foreground" />}
                </div>
                <span className="text-xs font-mono text-muted-foreground w-12">{item.time}</span>
                <span className={`text-sm ${item.done ? "line-through text-muted-foreground" : ""}`}>{item.item}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* To-Do list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <span>{language === "fr" ? "To-Do (7 jours)" : "To-Do (7 days)"}</span>
            <span className="text-sm font-normal text-muted-foreground">
              {todos.filter((t) => t.done).length}/{todos.length} {language === "fr" ? "complétés" : "completed"}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {todos.map((todo) => (
              <div
                key={todo.id}
                className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => setTodos(todos.map((t) => (t.id === todo.id ? { ...t, done: !t.done } : t)))}
              >
                <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${todo.done ? "bg-primary border-primary" : "border-muted-foreground/30"}`}>
                  {todo.done && <Check className="w-3 h-3 text-primary-foreground" />}
                </div>
                <span className={`text-sm flex-1 ${todo.done ? "line-through text-muted-foreground" : ""}`}>{todo.text}</span>
                <span className="text-xs text-muted-foreground">{todo.owner}</span>
                <span className="text-xs text-muted-foreground">{todo.dueDate}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── GAMIFICATION TAB ────────────────────────────────────────
function GamificationTab({ language }: { language: string }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">
          {language === "fr" ? "Gamification & Centrale Virtuelle" : "Gamification & Virtual Power Plant"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {language === "fr"
            ? "Suivez vos missions, badges et la progression de la centrale virtuelle kWh"
            : "Track your missions, badges, and the kWh virtual power plant progress"}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              {language === "fr" ? "Panneau Gamification" : "Gamification Panel"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {language === "fr"
                ? "Le panneau de gamification sera connecté aux endpoints API existants (/api/gamification/*)."
                : "The gamification panel will be connected to existing API endpoints (/api/gamification/*)."}
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm font-medium">kWh Points</span>
                </div>
                <span className="text-lg font-bold">0</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium">{language === "fr" ? "Niveau" : "Level"}</span>
                </div>
                <Badge>Bronze</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-medium">Badges</span>
                </div>
                <span className="text-lg font-bold">0/12</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-5 h-5 text-green-500" />
              {language === "fr" ? "Centrale Virtuelle" : "Virtual Power Plant"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {language === "fr"
                ? "Chaque deal fermé ajoute des panneaux à la centrale virtuelle collective."
                : "Every closed deal adds panels to the collective virtual power plant."}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "MW", value: "0.0", icon: "⚡" },
                { label: language === "fr" ? "Systèmes" : "Systems", value: "0", icon: "🏭" },
                { label: "CO₂", value: "0 t", icon: "🌱" },
                { label: language === "fr" ? "Maisons" : "Homes", value: "0", icon: "🏠" },
              ].map((stat) => (
                <div key={stat.label} className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-2xl mb-1">{stat.icon}</div>
                  <div className="text-lg font-bold">{stat.value}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-dashed">
        <CardContent className="p-4 text-center text-sm text-muted-foreground">
          {language === "fr"
            ? "Les composants GamificationPanel et VirtualPowerPlant seront connectés une fois les tables créées (drizzle-kit push)."
            : "GamificationPanel and VirtualPowerPlant components will be connected once tables are created (drizzle-kit push)."}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── MAIN EOS PAGE ───────────────────────────────────────────
export default function EOSPage() {
  const [activeTab, setActiveTab] = useState<TabId>("scorecard");
  const { language } = useI18n();

  const renderTab = () => {
    switch (activeTab) {
      case "scorecard": return <ScorecardTab language={language} />;
      case "rocks": return <RocksTab language={language} />;
      case "vto": return <VtoTab language={language} />;
      case "issues": return <IssuesTab language={language} />;
      case "l10": return <L10Tab language={language} />;
      case "gamification": return <GamificationTab language={language} />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">EOS</h1>
        <p className="text-muted-foreground">
          {language === "fr"
            ? "Entrepreneurial Operating System — Gérez votre entreprise avec traction"
            : "Entrepreneurial Operating System — Run your business with traction"}
        </p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b overflow-x-auto pb-px">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {language === "fr" ? tab.labelFr : tab.labelEn}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {renderTab()}
    </div>
  );
}
