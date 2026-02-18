import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

const COOKIE_CONSENT_KEY = "kwh-cookie-consent";

export function CookieConsent() {
  const { language } = useI18n();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      setIsVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    setIsVisible(false);
  };

  const handleRefuse = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "refused");
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  const content = {
    fr: {
      title: "Consentement aux cookies",
      message: "Nous utilisons des cookies pour améliorer votre expérience et analyser notre site. Veuillez consulter notre",
      privacyLink: "politique de confidentialité",
      accept: "Accepter",
      refuse: "Refuser",
    },
    en: {
      title: "Cookie Consent",
      message: "We use cookies to improve your experience and analyze our site. Please see our",
      privacyLink: "privacy policy",
      accept: "Accept",
      refuse: "Refuse",
    },
  };

  const t = content[language];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background/80 backdrop-blur-sm">
      <div className="container mx-auto max-w-2xl">
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="space-y-2">
              <h3 className="font-semibold text-sm" data-testid="text-cookie-title">{t.title}</h3>
              <p className="text-sm text-muted-foreground" data-testid="text-cookie-message">
                {t.message}{" "}
                <Link href="/privacy" data-testid="link-privacy-policy" className="text-primary underline">
                  {t.privacyLink}
                </Link>
                .
              </p>
            </div>
            <div className="flex gap-3 justify-between">
              <Button
                variant="outline"
                onClick={handleRefuse}
                data-testid="button-refuse-cookies"
              >
                {t.refuse}
              </Button>
              <Button
                onClick={handleAccept}
                data-testid="button-accept-cookies"
              >
                {t.accept}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
