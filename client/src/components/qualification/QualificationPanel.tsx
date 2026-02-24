import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Loader2,
} from "lucide-react";

interface GateScores {
  economic: number;
  property: number;
  roof: number;
  decision: number;
}

interface Blocker {
  type: string;
  description: string;
  severity: "critical" | "major" | "minor";
  suggestedSolutions: string[];
}

interface QualificationData {
  status: "hot" | "warm" | "nurture" | "cold" | "disqualified" | "pending";
  score: number;
  gateScores: GateScores;
  blockers: Blocker[];
  suggestedNextSteps: string[];
  leadColor: "green" | "yellow" | "red";
  leadColorReason: string;
}

interface QualificationPanelProps {
  leadId: string;
  language: "fr" | "en";
  onOpenForm?: () => void;
}

const LABELS = {
  en: {
    score: "Qualification Score",
    gates: {
      economic: "Economic Gate",
      property: "Property Gate",
      roof: "Roof Gate",
      decision: "Decision Gate",
    },
    blockers: "Blockers",
    suggestedSteps: "Suggested Next Steps",
    completeForm: "Complete Qualification",
    notQualified: "Not Qualified",
    qualifyLead: "Qualify Lead",
    loading: "Loading qualification data...",
    error: "Error loading qualification data",
    severity: {
      critical: "Critical",
      major: "Major",
      minor: "Minor",
    },
  },
  fr: {
    score: "Score de Qualification",
    gates: {
      economic: "Critère Économique",
      property: "Critère Propriété",
      roof: "Critère Toit",
      decision: "Critère Décision",
    },
    blockers: "Obstacles",
    suggestedSteps: "Prochaines Étapes Suggérées",
    completeForm: "Compléter la qualification",
    notQualified: "Non qualifié",
    qualifyLead: "Qualifier le lead",
    loading: "Chargement des données de qualification...",
    error: "Erreur lors du chargement des données",
    severity: {
      critical: "Critique",
      major: "Majeur",
      minor: "Mineur",
    },
  },
};

const getSeverityColor = (severity: "critical" | "major" | "minor") => {
  switch (severity) {
    case "critical":
      return "bg-red-100 text-red-800 border-red-300";
    case "major":
      return "bg-orange-100 text-orange-800 border-orange-300";
    case "minor":
      return "bg-yellow-100 text-yellow-800 border-yellow-300";
  }
};

const getSeverityIcon = (severity: "critical" | "major" | "minor") => {
  switch (severity) {
    case "critical":
      return <AlertOctagon className="w-4 h-4" />;
    case "major":
      return <AlertTriangle className="w-4 h-4" />;
    case "minor":
      return <AlertCircle className="w-4 h-4" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "hot":
      return "text-green-600";
    case "warm":
      return "text-yellow-600";
    case "cold":
      return "text-blue-600";
    case "nurture":
      return "text-purple-600";
    case "disqualified":
      return "text-red-600";
    case "pending":
      return "text-gray-600";
    default:
      return "text-gray-600";
  }
};

const getScoreColor = (score: number) => {
  if (score >= 75) return "text-green-600";
  if (score >= 50) return "text-yellow-600";
  if (score >= 25) return "text-orange-600";
  return "text-red-600";
};

const CircularProgress = ({
  score,
  size = 120,
}: {
  score: number;
  size?: number;
}) => {
  const radius = size / 2 - 8;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="8"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={`transition-all duration-500 ${getScoreColor(score)}`}
        />
        <text
          x={size / 2}
          y={size / 2 + 6}
          textAnchor="middle"
          fontSize="32"
          fontWeight="bold"
          fill="currentColor"
          className={getScoreColor(score)}
        >
          {score}
        </text>
      </svg>
    </div>
  );
};

export const QualificationPanel: React.FC<QualificationPanelProps> = ({
  leadId,
  language,
  onOpenForm,
}) => {
  const [data, setData] = useState<QualificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const labels = LABELS[language];

  useEffect(() => {
    const fetchQualification = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `/api/leads/${leadId}/qualification`,
          {
            method: "GET",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          if (response.status === 404) {
            setData(null);
          } else {
            throw new Error(`API error: ${response.status}`);
          }
        } else {
          const result = await response.json();
          setData(result);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : labels.error);
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchQualification();
  }, [leadId, labels.error]);

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center gap-2 text-gray-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>{labels.loading}</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="p-6">
        <div className="text-center space-y-4">
          <div className="text-gray-600">{labels.notQualified}</div>
          <Button onClick={onOpenForm} variant="default" size="sm">
            {labels.completeForm}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Overall Score Card */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-700">
                {labels.score}
              </h3>
              <p className="text-xs text-gray-500 mt-1">{data.leadColorReason}</p>
            </div>
            <Badge
              className={`${
                data.leadColor === "green"
                  ? "bg-green-100 text-green-800"
                  : data.leadColor === "yellow"
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-red-100 text-red-800"
              }`}
            >
              {data.status}
            </Badge>
          </div>
          <CircularProgress score={data.score} />
        </div>
      </Card>

      {/* Gate Scores */}
      <Card className="p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          Gate Scores
        </h3>
        <div className="space-y-4">
          {Object.entries(data.gateScores).map(([key, value]) => (
            <div key={key} className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs font-medium text-gray-600">
                  {labels.gates[key as keyof typeof labels.gates]}
                </label>
                <span className="text-sm font-semibold text-gray-900">
                  {value}/25
                </span>
              </div>
              <Progress
                value={(value / 25) * 100}
                className="h-2"
                barColor={
                  value >= 20
                    ? "bg-green-500"
                    : value >= 15
                      ? "bg-yellow-500"
                      : "bg-red-500"
                }
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Blockers */}
      {data.blockers.length > 0 && (
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            {labels.blockers}
          </h3>
          <div className="space-y-3">
            {data.blockers.map((blocker, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex items-start gap-2">
                  {getSeverityIcon(blocker.severity)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900">
                        {blocker.type}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-xs ${getSeverityColor(blocker.severity)}`}
                      >
                        {labels.severity[blocker.severity]}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">
                      {blocker.description}
                    </p>
                  </div>
                </div>
                {blocker.suggestedSolutions.length > 0 && (
                  <div className="ml-6 space-y-1">
                    {blocker.suggestedSolutions.map((solution, sIdx) => (
                      <div key={sIdx} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3 h-3 mt-1 text-gray-400 flex-shrink-0" />
                        <span className="text-xs text-gray-600">
                          {solution}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Suggested Next Steps */}
      {data.suggestedNextSteps.length > 0 && (
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            {labels.suggestedSteps}
          </h3>
          <div className="space-y-2">
            {data.suggestedNextSteps.map((step, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 text-blue-500 flex-shrink-0" />
                <span className="text-sm text-gray-700">{step}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Action Button */}
      <div className="pt-2">
        <Button
          onClick={onOpenForm}
          variant="default"
          className="w-full"
          size="sm"
        >
          {labels.completeForm}
        </Button>
      </div>
    </div>
  );
};
