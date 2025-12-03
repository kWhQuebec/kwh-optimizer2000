import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Sun, Battery, FileBarChart, Zap, Building2, Factory, School, HelpCircle, CheckCircle2, ArrowRight, BarChart3, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useI18n } from "@/lib/i18n";
import { apiRequest } from "@/lib/queryClient";

const leadFormSchema = z.object({
  companyName: z.string().min(1, "Ce champ est requis"),
  contactName: z.string().min(1, "Ce champ est requis"),
  email: z.string().email("Courriel invalide"),
  phone: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  estimatedMonthlyBill: z.coerce.number().optional(),
  buildingType: z.string().optional(),
  notes: z.string().optional(),
});

type LeadFormValues = z.infer<typeof leadFormSchema>;

export default function LandingPage() {
  const { t } = useI18n();
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      companyName: "",
      contactName: "",
      email: "",
      phone: "",
      city: "",
      province: "QC",
      estimatedMonthlyBill: undefined,
      buildingType: "",
      notes: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: LeadFormValues) => {
      return apiRequest("POST", "/api/leads", data);
    },
    onSuccess: () => {
      setSubmitted(true);
    },
  });

  const onSubmit = (data: LeadFormValues) => {
    mutation.mutate(data);
  };

  const buildingTypes = [
    { value: "industrial", label: t("form.buildingType.industrial"), icon: Factory },
    { value: "commercial", label: t("form.buildingType.commercial"), icon: Building2 },
    { value: "institutional", label: t("form.buildingType.institutional"), icon: School },
    { value: "other", label: t("form.buildingType.other"), icon: HelpCircle },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-semibold tracking-tight">kWh Québec</span>
            </div>
            
            <nav className="hidden md:flex items-center gap-6">
              <a href="#process" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-process">
                {t("landing.step1.title").split(".")[0]}
              </a>
              <a href="#contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-contact">
                {t("footer.contact")}
              </a>
            </nav>

            <div className="flex items-center gap-2">
              <LanguageToggle />
              <ThemeToggle />
              <Link href="/login">
                <Button variant="outline" size="sm" data-testid="button-login">
                  {t("nav.login")}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
                  {t("landing.hero.title")}
                </h1>
                <p className="text-2xl sm:text-3xl text-primary font-medium">
                  {t("landing.hero.subtitle")}
                </p>
                <p className="text-lg text-muted-foreground max-w-lg">
                  {t("landing.hero.description")}
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <a href="#contact">
                  <Button size="lg" className="gap-2" data-testid="button-hero-cta">
                    {t("landing.hero.cta")}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </a>
              </div>

              <div className="flex items-center gap-6 pt-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  <span className="text-sm text-muted-foreground">{t("landing.trust.certified")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  <span className="text-sm text-muted-foreground">{t("landing.trust.experience")}</span>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="aspect-square bg-gradient-to-br from-primary/20 via-primary/10 to-transparent rounded-3xl flex items-center justify-center">
                <div className="grid grid-cols-2 gap-6 p-8">
                  <div className="bg-card border border-card-border rounded-2xl p-6 space-y-3">
                    <Sun className="w-10 h-10 text-primary" />
                    <div className="text-2xl font-bold font-mono">250 kWc</div>
                    <div className="text-sm text-muted-foreground">{t("landing.hero.pvCapacity")}</div>
                  </div>
                  <div className="bg-card border border-card-border rounded-2xl p-6 space-y-3">
                    <Battery className="w-10 h-10 text-primary" />
                    <div className="text-2xl font-bold font-mono">500 kWh</div>
                    <div className="text-sm text-muted-foreground">{t("landing.hero.storage")}</div>
                  </div>
                  <div className="bg-card border border-card-border rounded-2xl p-6 space-y-3">
                    <BarChart3 className="w-10 h-10 text-primary" />
                    <div className="text-2xl font-bold font-mono">35%</div>
                    <div className="text-sm text-muted-foreground">{t("landing.hero.peakShaving")}</div>
                  </div>
                  <div className="bg-card border border-card-border rounded-2xl p-6 space-y-3">
                    <Leaf className="w-10 h-10 text-primary" />
                    <div className="text-2xl font-bold font-mono">120 t</div>
                    <div className="text-sm text-muted-foreground">{t("landing.hero.co2Year")}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section id="process" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">{t("landing.process.title")}</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t("landing.process.subtitle")}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="relative overflow-hidden hover-elevate">
              <CardContent className="p-8 space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <FileBarChart className="w-7 h-7 text-primary" />
                </div>
                <div className="absolute top-6 right-6 text-6xl font-bold text-muted/20">1</div>
                <h3 className="text-xl font-semibold">{t("landing.step1.title")}</h3>
                <p className="text-muted-foreground">{t("landing.step1.description")}</p>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden hover-elevate">
              <CardContent className="p-8 space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <BarChart3 className="w-7 h-7 text-primary" />
                </div>
                <div className="absolute top-6 right-6 text-6xl font-bold text-muted/20">2</div>
                <h3 className="text-xl font-semibold">{t("landing.step2.title")}</h3>
                <p className="text-muted-foreground">{t("landing.step2.description")}</p>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden hover-elevate">
              <CardContent className="p-8 space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Sun className="w-7 h-7 text-primary" />
                </div>
                <div className="absolute top-6 right-6 text-6xl font-bold text-muted/20">3</div>
                <h3 className="text-xl font-semibold">{t("landing.step3.title")}</h3>
                <p className="text-muted-foreground">{t("landing.step3.description")}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Contact Form Section */}
      <section id="contact" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-5 gap-12">
            <div className="lg:col-span-2 space-y-6">
              <h2 className="text-3xl sm:text-4xl font-bold">{t("landing.hero.cta")}</h2>
              <p className="text-lg text-muted-foreground">
                {t("landing.form.subtitle")}
              </p>
              
              <div className="space-y-4 pt-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <div className="font-medium">{t("landing.form.benefit1.title")}</div>
                    <div className="text-sm text-muted-foreground">{t("landing.form.benefit1.description")}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <div className="font-medium">{t("landing.form.benefit2.title")}</div>
                    <div className="text-sm text-muted-foreground">{t("landing.form.benefit2.description")}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <div className="font-medium">{t("landing.form.benefit3.title")}</div>
                    <div className="text-sm text-muted-foreground">{t("landing.form.benefit3.description")}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-3">
              <Card>
                <CardContent className="p-6 sm:p-8">
                  {submitted ? (
                    <div className="text-center py-12 space-y-4">
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-8 h-8 text-primary" />
                      </div>
                      <h3 className="text-2xl font-semibold">{t("form.success.title")}</h3>
                      <p className="text-muted-foreground max-w-md mx-auto">{t("form.success.message")}</p>
                    </div>
                  ) : (
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid sm:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="companyName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("form.company")} *</FormLabel>
                                <FormControl>
                                  <Input {...field} data-testid="input-company" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="contactName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("form.contact")} *</FormLabel>
                                <FormControl>
                                  <Input {...field} data-testid="input-contact" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("form.email")} *</FormLabel>
                                <FormControl>
                                  <Input type="email" {...field} data-testid="input-email" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="phone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("form.phone")}</FormLabel>
                                <FormControl>
                                  <Input type="tel" {...field} data-testid="input-phone" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="city"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("form.city")}</FormLabel>
                                <FormControl>
                                  <Input {...field} data-testid="input-city" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="province"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("form.province")}</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-province">
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="QC">Québec</SelectItem>
                                    <SelectItem value="ON">Ontario</SelectItem>
                                    <SelectItem value="NB">Nouveau-Brunswick</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="estimatedMonthlyBill"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("form.monthlyBill")}</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    placeholder="5000" 
                                    {...field} 
                                    data-testid="input-monthly-bill"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="buildingType"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("form.buildingType")}</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-building-type">
                                      <SelectValue placeholder={t("landing.form.select")} />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {buildingTypes.map((type) => (
                                      <SelectItem key={type.value} value={type.value}>
                                        {type.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name="notes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("form.notes")}</FormLabel>
                              <FormControl>
                                <Textarea 
                                  rows={3} 
                                  className="resize-none" 
                                  {...field} 
                                  data-testid="textarea-notes"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <Button 
                          type="submit" 
                          size="lg" 
                          className="w-full"
                          disabled={mutation.isPending}
                          data-testid="button-submit-lead"
                        >
                          {mutation.isPending ? t("form.submitting") : t("form.submit")}
                        </Button>

                        <p className="text-xs text-muted-foreground text-center">
                          {t("landing.form.privacy")}
                        </p>
                      </form>
                    </Form>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-lg font-semibold">kWh Québec</span>
            </div>
            
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">{t("footer.privacy")}</a>
              <a href="#contact" className="hover:text-foreground transition-colors">{t("footer.contact")}</a>
            </div>

            <div className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} kWh Québec. {t("footer.rights")}.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
