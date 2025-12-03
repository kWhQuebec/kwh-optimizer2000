import { Link } from "wouter";
import { Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="pt-12 pb-8 px-8">
          <div className="text-8xl font-bold text-muted-foreground/20 mb-4">404</div>
          <h1 className="text-2xl font-semibold mb-2">Page non trouvée</h1>
          <p className="text-muted-foreground mb-8">
            La page que vous recherchez n'existe pas ou a été déplacée.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/">
              <Button variant="outline" className="gap-2 w-full sm:w-auto">
                <Home className="w-4 h-4" />
                Accueil
              </Button>
            </Link>
            <Link href="/app">
              <Button className="gap-2 w-full sm:w-auto">
                <ArrowLeft className="w-4 h-4" />
                Tableau de bord
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
