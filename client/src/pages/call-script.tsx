import { useParams } from "wouter";
import { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const CallScriptWizard = lazy(() => import("@/components/qualification/call-script-wizard"));

export default function CallScriptPage() {
  const { language } = useI18n();
  const params = useParams();
  const leadId = params?.id;

  if (!leadId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">
            {language === "fr" ? "Prospect non trouvé" : "Lead not found"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-background">
      <Suspense
        fallback={
          <div className="flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mb-2" />
            <p className="text-muted-foreground">
              {language === "fr" ? "Chargement..." : "Loading..."}
            </p>
          </div>
        }
      >
        <CallScriptWizard
          leadId={leadId}
          open={true}
          onClose={() => window.close()}
          onComplete={() => {
            // Optionally close the window after completion
            setTimeout(() => {
              window.close();
            }, 1000);
          }}
        />
      </Suspense>
    </div>
  );
}
