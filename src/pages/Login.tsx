import { useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2, ArrowRight } from "lucide-react";

export default function Login() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast({ title: "Sign in failed", description: error.message, variant: "destructive" });
    } else {
      navigate("/");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel: full-bleed photo ──────────────────────────── */}
      <div className="hidden lg:flex lg:w-[55%] xl:w-[60%] relative overflow-hidden">
        {/* Photo */}
        <img
          src="https://images.pexels.com/photos/1396122/pexels-photo-1396122.jpeg?auto=compress&cs=tinysrgb&w=1600"
          alt="Muskoka cottage lakeside"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />

        {/* Gradient overlay — dark at bottom for legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10" />

        {/* Top wordmark */}
        <div className="absolute top-8 left-8">
          <p
            className="text-white text-2xl font-bold tracking-tight leading-none"
            style={{ fontFamily: "var(--font-serif)", letterSpacing: "-0.03em" }}
          >
            E.L.M
          </p>
          <p className="text-white/50 text-[9px] uppercase tracking-[0.22em] mt-0.5 font-sans font-medium">
            Aster &amp; Spruce Living
          </p>
        </div>

        {/* Bottom caption */}
        <div className="absolute bottom-10 left-8 right-8">
          <p
            className="text-white/90 text-2xl font-semibold leading-snug max-w-xs"
            style={{ fontFamily: "var(--font-serif)", letterSpacing: "-0.015em" }}
          >
            Crafted for the way you build.
          </p>
          <p className="text-white/50 text-sm mt-2 max-w-sm leading-relaxed">
            Project management, estimating, and design — built for Muskoka renovation professionals.
          </p>
        </div>

        {/* Subtle vignette edge */}
        <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-black/20 to-transparent" />
      </div>

      {/* ── Right panel: sign-in form ──────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-background px-6 sm:px-10 py-12">
        {/* Mobile wordmark */}
        <div className="lg:hidden text-center mb-10">
          <p
            className="text-foreground text-2xl font-bold tracking-tight leading-none"
            style={{ fontFamily: "var(--font-serif)", letterSpacing: "-0.03em" }}
          >
            E.L.M
          </p>
          <p className="text-muted-foreground text-[9px] uppercase tracking-[0.22em] mt-0.5 font-medium">
            Aster &amp; Spruce Living
          </p>
        </div>

        <div className="w-full max-w-sm">
          {/* Heading */}
          <div className="mb-8">
            <h1
              className="text-3xl font-bold text-foreground leading-tight"
              style={{ fontFamily: "var(--font-serif)", letterSpacing: "-0.025em" }}
            >
              Welcome back.
            </h1>
            <p className="text-muted-foreground text-sm mt-1.5">
              Sign in to your ELM workspace.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                className="h-11"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                <button
                  type="button"
                  onClick={() => navigate("/forgot-password")}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="h-11"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11 gap-2 mt-1"
              disabled={loading}
            >
              {loading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <>Sign in <ArrowRight className="h-4 w-4" /></>
              }
            </Button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest">access</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <p className="text-center text-xs text-muted-foreground leading-relaxed">
            This portal is invite-only.{" "}
            <a
              href="mailto:info@asterandspruceliving.ca"
              className="text-foreground font-medium hover:underline underline-offset-2"
            >
              Request access
            </a>
          </p>
        </div>

        {/* Footer */}
        <p className="mt-auto pt-12 text-[10px] text-muted-foreground/50 text-center">
          &copy; {new Date().getFullYear()} Aster &amp; Spruce Living
        </p>
      </div>
    </div>
  );
}
