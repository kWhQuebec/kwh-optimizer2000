import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { Link } from "wouter";
import { AlertCircle, CheckCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useI18n } from "@/lib/i18n";
import { apiRequest } from "@/lib/queryClient";
import logoFr from "@assets/kWh_Quebec_Logo-01_-_Rectangulaire_1764799021536.png";
import logoEn from "@assets/kWh_Quebec_Logo-02_-_Rectangle_1764799021536.png";

const forgotPasswordSchema = z.object({
  email: z.string().email("Courriel invalide"),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const { language } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const currentLogo = language === "fr" ? logoFr : logoEn;

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data: ForgotPasswordFormValues) => {
    setError(null);
    setIsLoading(true);

    try {
      await apiRequest("POST", "/api/auth/forgot-password", { email: data.email });
      setSuccess(true);
    } catch (err) {
      setError(language === "fr" 
        ? "Une erreur s'est produite. Veuillez réessayer."
        : "An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const t = {
    title: language === "fr" ? "Mot de passe oublié" : "Forgot Password",
    description: language === "fr" 
      ? "Entrez votre courriel et nous vous enverrons un nouveau mot de passe temporaire."
      : "Enter your email and we'll send you a new temporary password.",
    email: language === "fr" ? "Courriel" : "Email",
    submit: language === "fr" ? "Envoyer" : "Send",
    loading: language === "fr" ? "Envoi..." : "Sending...",
    backToLogin: language === "fr" ? "Retour à la connexion" : "Back to login",
    successTitle: language === "fr" ? "Courriel envoyé" : "Email Sent",
    successMessage: language === "fr" 
      ? "Si un compte existe avec ce courriel, vous recevrez un nouveau mot de passe temporaire. Vérifiez votre boîte de réception."
      : "If an account exists with this email, you will receive a new temporary password. Check your inbox.",
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            <a href="/">
              <img 
                src={currentLogo} 
                alt={language === "fr" ? "Logo kWh Québec – Énergie solaire commerciale" : "kWh Québec Logo – Commercial Solar Energy"} 
                className="h-[3.75rem] w-auto"
                data-testid="logo-forgot-password-header"
              />
            </a>
            
            <div className="flex items-center gap-2">
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-2">
            <img 
              src={currentLogo} 
              alt={language === "fr" ? "Logo kWh Québec – Réinitialisation du mot de passe" : "kWh Québec Logo – Password Reset"} 
              className="h-[70px] w-auto mx-auto mb-2"
              data-testid="logo-forgot-password-card"
            />
            <CardTitle className="text-2xl">{t.title}</CardTitle>
            <CardDescription>{t.description}</CardDescription>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="space-y-4">
                <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700 dark:text-green-300">
                    <p className="font-medium">{t.successTitle}</p>
                    <p className="mt-1">{t.successMessage}</p>
                  </AlertDescription>
                </Alert>
                <Link href="/login">
                  <Button className="w-full" variant="outline" data-testid="button-back-to-login">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    {t.backToLogin}
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                {error && (
                  <Alert variant="destructive" className="mb-6">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t.email}</FormLabel>
                          <FormControl>
                            <Input 
                              type="email" 
                              autoComplete="email"
                              {...field} 
                              data-testid="input-forgot-email" 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={isLoading}
                      data-testid="button-forgot-submit"
                    >
                      {isLoading ? t.loading : t.submit}
                    </Button>
                  </form>
                </Form>

                <div className="mt-4 text-center">
                  <Link href="/login" className="text-sm text-primary hover:underline" data-testid="link-back-to-login">
                    <ArrowLeft className="w-3 h-3 inline mr-1" />
                    {t.backToLogin}
                  </Link>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
