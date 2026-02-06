import { CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";

export function FileStatusBadge({ status }: { status: string }) {
  const { t } = useI18n();

  switch (status) {
    case "PARSED":
      return (
        <Badge variant="default" className="gap-1">
          <CheckCircle2 className="w-3 h-3" />
          {t("status.parsed")}
        </Badge>
      );
    case "FAILED":
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="w-3 h-3" />
          {t("status.failed")}
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="gap-1">
          <Clock className="w-3 h-3" />
          {t("status.uploaded")}
        </Badge>
      );
  }
}
