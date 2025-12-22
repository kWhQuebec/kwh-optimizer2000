import { useState } from "react";
import { Link } from "wouter";
import { Plus, Users, Building2, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface QuickAction {
  label: { fr: string; en: string };
  href: string;
  icon: typeof Users;
}

const quickActions: QuickAction[] = [
  {
    label: { fr: "+ Client", en: "+ Client" },
    href: "/app/clients?action=new",
    icon: Users,
  },
  {
    label: { fr: "+ Site", en: "+ Site" },
    href: "/app/sites?action=new",
    icon: Building2,
  },
  {
    label: { fr: "+ Opportunité", en: "+ Opportunity" },
    href: "/app/pipeline?action=new",
    icon: Target,
  },
];

export function GlobalActionBar() {
  const [isOpen, setIsOpen] = useState(false);
  const { language } = useI18n();

  return (
    <div className="fixed bottom-6 right-6 z-50" data-testid="global-action-bar">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            size="icon"
            className={cn(
              "h-14 w-14 rounded-full shadow-lg transition-transform duration-200",
              isOpen && "rotate-45"
            )}
            data-testid="button-global-action-trigger"
          >
            <Plus className="h-6 w-6" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="end"
          sideOffset={12}
          className="w-auto p-2"
        >
          <div className="flex flex-col gap-1">
            {quickActions.map((action) => {
              const actionName = action.href.includes("clients") ? "client" : action.href.includes("sites") ? "site" : "opportunity";
              return (
                <Button
                  key={action.href}
                  variant="ghost"
                  className="justify-start gap-3 px-3"
                  asChild
                  onClick={() => setIsOpen(false)}
                >
                  <Link href={action.href} data-testid={`link-quick-action-${actionName}`}>
                    <action.icon className="h-4 w-4" />
                    <span>{action.label[language]}</span>
                  </Link>
                </Button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
