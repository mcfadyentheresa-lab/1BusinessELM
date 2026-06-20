import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Layers, Calendar, DollarSign, Users, Palette, Sparkles } from "lucide-react";

const FEATURES = [
  {
    icon: Layers,
    title: "Visual Planning Boards",
    description: "Milanote-style spatial canvas for every room. Pin swatches, photos, hardware, and notes exactly where they belong.",
  },
  {
    icon: DollarSign,
    title: "Muskoka Cost Estimator",
    description: "Regional market rates, crew billing, subcontractor assignments, and markup controls — all in one locked estimate.",
  },
  {
    icon: Users,
    title: "Client & Crew Portal",
    description: "Separate views for admin, crew, and clients. Clients see what they need; crew sees what they're working on.",
  },
  {
    icon: Calendar,
    title: "Master Calendar",
    description: "Project milestones, site visits, crew schedules, and client appointments — one shared calendar across all projects.",
  },
  {
    icon: Palette,
    title: "Color Portfolio",
    description: "Full Benjamin Moore and custom brand paint libraries. Assign colors to boards, track selections, log decisions.",
  },
  {
    icon: Sparkles,
    title: "AI Social Content",
    description: "Generate Instagram and LinkedIn copy from project photos in seconds. Build a content library that posts itself.",
  },
];

const PROOF_POINTS = [
  "Invite-only client access — no self-signup",
  "Estimate approval locks with audit trail",
  "Real-time board collaboration",
  "Business-hours SMS notifications",
  "PDF exports for estimates and presentations",
  "Public presentation mode with share link",
];

export default function LandingPage() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="fixed top-0 left-0 right-0 z-40 border-b border-border/50 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-xs font-bold">A</span>
            </div>
            <span className="font-serif font-bold text-foreground text-lg">Aster & Spruce</span>
          </div>
          <Button onClick={() => navigate("/login")} size="sm" className="gap-2">
            Sign in <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6">
        <div className="mx-auto max-w-4xl text-center">
          <div
            className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/50 px-4 py-1.5 text-xs text-muted-foreground mb-8"
            style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.15em" }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            PROJECT MANAGEMENT FOR RENOVATION STUDIOS
          </div>
          <h1
            className="text-5xl md:text-7xl font-bold text-foreground leading-[1.02] mb-6"
            style={{ fontFamily: "var(--font-serif)", letterSpacing: "-0.04em" }}
          >
            E.L.M.
            <br />
            <span className="text-primary">Elevated Living</span>
            <br />
            Management
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10">
            The end-to-end portal for Aster & Spruce projects. From spatial planning boards to locked estimates,
            client presentations to crew timesheets — everything your studio runs on.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" onClick={() => navigate("/login")} className="gap-2 min-w-[160px]">
              Sign in to portal <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Hero image band */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-6xl">
          <div className="relative rounded-2xl overflow-hidden" style={{ aspectRatio: "16/7" }}>
            <img
              src="https://images.pexels.com/photos/1643383/pexels-photo-1643383.jpeg?auto=compress&cs=tinysrgb&w=1600"
              alt="Beautiful renovated interior"
              className="w-full h-full object-cover"
              style={{ filter: "saturate(0.85) contrast(0.96)" }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
            <div
              className="absolute bottom-6 left-8 text-white/80 text-[10px] uppercase"
              style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.2em" }}
            >
              Muskoka, Ontario
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 pb-24 border-t border-border">
        <div className="mx-auto max-w-6xl pt-20">
          <div className="text-center mb-16">
            <p
              className="text-[11px] uppercase text-muted-foreground mb-3"
              style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.25em" }}
            >
              Platform
            </p>
            <h2
              className="text-4xl md:text-5xl font-bold text-foreground"
              style={{ fontFamily: "var(--font-serif)", letterSpacing: "-0.035em" }}
            >
              Built for the field and the studio
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="group">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3
                    className="text-lg font-semibold text-foreground mb-2"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {f.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Proof points */}
      <section className="px-6 pb-24 bg-card/40 border-t border-border">
        <div className="mx-auto max-w-4xl pt-20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PROOF_POINTS.map((point) => (
              <div key={point} className="flex items-center gap-3">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm text-foreground">{point}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-24 border-t border-border">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            className="text-4xl font-bold text-foreground mb-4"
            style={{ fontFamily: "var(--font-serif)", letterSpacing: "-0.03em" }}
          >
            Your studio portal
          </h2>
          <p className="text-muted-foreground mb-8">
            Access is invite-only. If you're an Aster & Spruce team member or client, sign in with your credentials.
          </p>
          <Button size="lg" onClick={() => navigate("/login")} className="gap-2">
            Sign in to E.L.M. <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-8">
        <div className="mx-auto max-w-6xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-[10px] font-bold">A</span>
            </div>
            <span className="text-sm text-muted-foreground">Aster & Spruce Living</span>
          </div>
          <p
            className="text-[10px] text-muted-foreground uppercase"
            style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.15em" }}
          >
            © {new Date().getFullYear()} Aster & Spruce Living · Muskoka, Ontario
          </p>
        </div>
      </footer>
    </div>
  );
}
