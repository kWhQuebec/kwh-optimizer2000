import React, { useState } from "react";
import { Shield, ChevronUp, ChevronDown, Loader2, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import type { Site } from "@shared/schema";
import type { StructuralConstraints } from "../types";

export function StructuralConstraintsEditor({
  site,
  onUpdate
}: {
  site: Site;
  onUpdate: () => void;
}) {
  const { language } = useI18n();
  const { token } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Parse existing constraints from site
  const existingConstraints = (site.structuralConstraints as StructuralConstraints | null) || {};

  // Local state for form fields
  const [notes, setNotes] = useState(site.structuralNotes || "");
  const [maxPvLoadKpa, setMaxPvLoadKpa] = useState(existingConstraints.maxPvLoadKpa?.toString() || "");
  const [roofChangeRequired, setRoofChangeRequired] = useState(existingConstraints.roofChangeRequired || false);
  const [engineeringReportRef, setEngineeringReportRef] = useState(existingConstraints.engineeringReportRef || "");

  // Check if there are any constraints to display
  const hasConstraints = site.structuralNotes || Object.keys(existingConstraints).length > 0;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const constraints: StructuralConstraints = {
        ...existingConstraints,
        maxPvLoadKpa: maxPvLoadKpa ? parseFloat(maxPvLoadKpa) : undefined,
        roofChangeRequired,
        engineeringReportRef: engineeringReportRef || undefined,
      };

      // Remove undefined values
      Object.keys(constraints).forEach(key => {
        if (constraints[key as keyof StructuralConstraints] === undefined) {
          delete constraints[key as keyof StructuralConstraints];
        }
      });

      const response = await fetch(`/api/sites/${site.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          structuralNotes: notes || null,
          structuralConstraints: Object.keys(constraints).length > 0 ? constraints : null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save");
      }

      toast({
        title: language === "fr" ? "Contraintes sauvegardées" : "Constraints saved",
        description: language === "fr"
          ? "Les contraintes structurales ont été mises à jour"
          : "Structural constraints have been updated",
      });

      onUpdate();
    } catch (error) {
      toast({
        title: language === "fr" ? "Erreur" : "Error",
        description: language === "fr"
          ? "Impossible de sauvegarder les contraintes"
          : "Failed to save constraints",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className={hasConstraints ? "border-amber-500/50 bg-amber-50/30 dark:bg-amber-950/20" : ""}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover-elevate rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className={`w-5 h-5 ${hasConstraints ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`} />
                <CardTitle className="text-lg">
                  {language === "fr" ? "Contraintes structurales" : "Structural Constraints"}
                </CardTitle>
                {hasConstraints && (
                  <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">
                    {language === "fr" ? "Données présentes" : "Data present"}
                  </Badge>
                )}
              </div>
              {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
            {!isOpen && hasConstraints && (
              <CardDescription className="mt-1">
                {existingConstraints.maxPvLoadKpa && (
                  <span className="mr-3">
                    {language === "fr" ? "Charge max:" : "Max load:"} {existingConstraints.maxPvLoadKpa} kPa
                  </span>
                )}
                {existingConstraints.roofChangeRequired && (
                  <Badge variant="destructive" className="mr-2 text-xs">
                    {language === "fr" ? "Réfection requise" : "Roof replacement required"}
                  </Badge>
                )}
              </CardDescription>
            )}
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {/* Engineering Report Reference */}
            <div className="space-y-2">
              <Label htmlFor="engineering-report">
                {language === "fr" ? "Référence du rapport d'ingénierie" : "Engineering Report Reference"}
              </Label>
              <Input
                id="engineering-report"
                placeholder={language === "fr" ? "Ex: MON.142502.0001" : "e.g., MON.142502.0001"}
                value={engineeringReportRef}
                onChange={(e) => setEngineeringReportRef(e.target.value)}
                data-testid="input-engineering-report"
              />
            </div>

            {/* Max Solar Load */}
            <div className="space-y-2">
              <Label htmlFor="max-pv-load">
                {language === "fr" ? "Charge max solaire admissible (kPa)" : "Max Allowable Solar Load (kPa)"}
              </Label>
              <Input
                id="max-pv-load"
                type="number"
                step="0.01"
                placeholder={language === "fr" ? "Ex: 0.60" : "e.g., 0.60"}
                value={maxPvLoadKpa}
                onChange={(e) => setMaxPvLoadKpa(e.target.value)}
                data-testid="input-max-pv-load"
              />
              <p className="text-xs text-muted-foreground">
                {language === "fr"
                  ? "Charge additionnelle que le toit peut supporter pour l'installation solaire"
                  : "Additional load the roof can support for solar installation"}
              </p>
            </div>

            {/* Roof Change Required Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg border bg-background">
              <div>
                <Label htmlFor="roof-change" className="font-medium">
                  {language === "fr" ? "Réfection de toiture requise" : "Roof Replacement Required"}
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {language === "fr"
                    ? "Le toit doit être refait avant l'installation solaire"
                    : "Roof must be replaced before solar installation"}
                </p>
              </div>
              <Switch
                id="roof-change"
                checked={roofChangeRequired}
                onCheckedChange={setRoofChangeRequired}
                data-testid="switch-roof-change"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="structural-notes">
                {language === "fr" ? "Notes de l'ingénieur" : "Engineer's Notes"}
              </Label>
              <Textarea
                id="structural-notes"
                placeholder={language === "fr"
                  ? "Notes sur la structure du bâtiment, les zones, les restrictions..."
                  : "Notes about building structure, zones, restrictions..."}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                data-testid="textarea-structural-notes"
              />
            </div>

            {/* Zones (read-only display if present) */}
            {existingConstraints.zones && existingConstraints.zones.length > 0 && (
              <div className="space-y-2">
                <Label>{language === "fr" ? "Zones de toiture" : "Roof Zones"}</Label>
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{language === "fr" ? "Zone" : "Zone"}</TableHead>
                        <TableHead>{language === "fr" ? "Charge max (kPa)" : "Max Load (kPa)"}</TableHead>
                        <TableHead>{language === "fr" ? "Superficie (m²)" : "Area (m²)"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {existingConstraints.zones.map((zone, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{zone.name}</TableCell>
                          <TableCell>{zone.maxLoadKpa}</TableCell>
                          <TableCell>{zone.areaM2 || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSave}
                disabled={isSaving}
                data-testid="button-save-constraints"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {language === "fr" ? "Sauvegarde..." : "Saving..."}
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    {language === "fr" ? "Sauvegarder" : "Save"}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
