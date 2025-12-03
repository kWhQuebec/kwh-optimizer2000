import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export function LanguageToggle() {
  const { language, setLanguage } = useI18n();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLanguage(language === "fr" ? "en" : "fr")}
      className="font-medium"
      data-testid="button-language-toggle"
    >
      {language === "fr" ? "EN" : "FR"}
    </Button>
  );
}
