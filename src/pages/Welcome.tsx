import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { ArrowRight, Home, Calendar, Clock, Users, Palette, MessageCircle } from "lucide-react";

const CLIENT_FEATURES = [
  { icon: Home, title: "Your project", desc: "Overview, milestones, and the latest updates from your team." },
  { icon: Calendar, title: "Timeline", desc: "Upcoming milestones, site visits, and important dates." },
  { icon: MessageCircle, title: "Updates", desc: "Stay in the loop with your Aster & Spruce team directly." },
];

const CREW_FEATURES = [
  { icon: Clock, title: "Log hours", desc: "Submit timesheets for each project and track weekly hours." },
  { icon: Calendar, title: "Calendar", desc: "View upcoming site visits, milestones, and deadlines." },
  { icon: Users, title: "Crew & Trade", desc: "Access crew contact info, trade contacts, and assignments." },
  { icon: Palette, title: "Colour Portfolio", desc: "Browse and reference colour selections across all projects." },
];

export default function Welcome() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const firstName = user?.name?.split(" ")[0] ?? "";
  const isClient = user?.role === "client";
  const features = isClient ? CLIENT_FEATURES : CREW_FEATURES;
  const subtitle = isClient
    ? "Your project portal is ready. Here is what you will find inside."
    : "Your team workspace is ready. Here is what you have access to.";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg text-center">
        <div className="mb-8">
          <p className="text-xs text-muted-foreground uppercase mb-3" style={{ letterSpacing: "0.2em" }}>
            Aster &amp; Spruce Living
          </p>
          <h1
            className="text-5xl font-bold text-foreground leading-none mb-3"
            style={{ fontFamily: "var(--font-serif)", letterSpacing: "-0.04em" }}
          >
            Welcome{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="text-muted-foreground leading-relaxed max-w-sm mx-auto">
            {subtitle}
          </p>
        </div>

        <div className={`grid ${features.length === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2"} gap-3 mb-10 text-left`}>
          {features.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="rounded-xl border border-border bg-card p-4 hover:border-primary/30 hover:shadow-sm transition-all">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">{item.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            );
          })}
        </div>

        <Button size="lg" onClick={() => navigate("/")} className="gap-2 min-w-[200px]">
          {isClient ? "Open my project" : "Go to dashboard"} <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

