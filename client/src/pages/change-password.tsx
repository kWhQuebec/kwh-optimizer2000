import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { useLocation } from "wouter";
import { AlertCircle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import logoFr from "@assets/kWh_Quebec_Logo-01_-_Rectangulaire_1764799021536.png";
import logoEn from "@assets/kWh_Quebec_Logo-02_-_Rectangle_1764799021536.png";

const changePasswordSchema = z.object({
  newPassword: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
  confirmPassword: z.string().min(1, "Veuillez confirmer votre mot de passe"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

export default function ChangePasswordPage() {
  const { language } = useI18n();
  const { token, refreshUser } = useAuth();
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const currentLogo = language === "fr" ? logoFr : logoEn;

  const t = {
    fr: {
      title: "Changement de mot de passe requis",
      description: "Pour la sécurité de votre compte, veuillez choisir un nouveau mot de passe.",
      newPassword: "Nouveau mot de passe",
      confirmPassword: "Confirmer le mot de passe",
      submit: "Changer le mot de passe",
      loading: "Chargement...",
      error: "Une erreur s'est produite. Veuillez réessayer.",
      success: "Mot de passe changé avec succès!",
    },
    en: {
      title: "Password Change Required",
      description: "For your account security, please choose a new password.",
      newPassword: "New Password",
      confirmPassword: "Confirm Password",
      submit: "Change Password",
      loading: "Loading...",
      error: "An error occurred. Please try again.",
      success: "Password changed successfully!",
    },
  };

  const text = t[language] || t.fr;

  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: ChangePasswordFormValues) => {
    setError(null);
    setIsLoading(true);

    try {
      await apiRequest("POST", "/api/auth/change-password", {
        newPassword: data.newPassword,
      });
      
      await refreshUser();
      setLocation("/app");
    } catch (err: any) {
      setError(err?.message || text.error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    setLocation("/login");
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            <a href="/">
              <img 
                src={currentLogo} 
                alt="kWh Québec" 
                className="h-[3.75rem] w-auto"
                data-testid="logo-change-password-header"
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
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">{text.title}</CardTitle>
            <CardDescription>{text.description}</CardDescription>
          </CardHeader>
          <CardContent>
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
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{text.newPassword}</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          autoComplete="new-password"
                          {...field} 
                          data-testid="input-new-password" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{text.confirmPassword}</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          autoComplete="new-password"
                          {...field} 
                          data-testid="input-confirm-password" 
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
                  data-testid="button-change-password-submit"
                >
                  {isLoading ? text.loading : text.submit}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
