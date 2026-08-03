import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, Users, Home } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  crew: "Crew member",
  client: "Client",
};

interface InviteData {
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  status: string;
  project_id: number | null;
}

export default function AcceptInvite() {
  const params = useParams<{ token: string }>();
  const [, navigate] = useLocation();
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!params.token) return;
    supabase
      .from("client_invites")
      .select("first_name, last_name, email, role, status, project_id")
      .eq("token", params.token)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) {
          toast({ title: "Invalid or expired invite link", variant: "destructive" });
        } else if (data.status === "accepted") {
          toast({ title: "This invite has already been used", description: "Please sign in instead.", variant: "destructive" });
        } else {
          setInvite(data as InviteData);
        }
        setFetching(false);
      });
  }, [params.token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invite || !params.token) return;
    if (password !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    setLoading(true);

    const role = invite.role ?? "client";

    const { error } = await supabase.auth.signUp({
      email: invite.email,
      password,
      options: {
        data: {
          name: `${invite.first_name} ${invite.last_name}`,
          role,
        },
      },
    });
    if (error) {
      toast({ title: "Error creating account", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    const newUserId = session?.user?.id;

    if (role === "client" && invite.project_id && newUserId) {
      const { error: linkError } = await supabase
        .from("projects")
        .update({ client_id: newUserId })
        .eq("id", invite.project_id);
      if (linkError) {
        toast({ title: "Account created, but project link failed", description: linkError.message, variant: "destructive" });
      }
    }

    await supabase
      .from("client_invites")
      .update({ status: "accepted", accepted_at: new Date().toISOString(), user_id: newUserId ?? undefined })
      .eq("token", params.token);

    setDone(true);
    setLoading(false);
  };

  if (fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invalid invite</CardTitle>
            <CardDescription>This link has expired or is invalid. Please contact your project manager.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" onClick={() => navigate("/login")}>
              Go to sign in
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-6">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2" style={{ fontFamily: "var(--font-serif)" }}>
            You&apos;re all set, {invite.first_name}!
          </h1>
          <p className="text-muted-foreground text-sm mb-8">
            Your account has been created. Sign in to access your{" "}
            {invite.role === "client" ? "project portal" : "workspace"}.
          </p>
          <Button className="w-full gap-2" onClick={() => navigate("/login")}>
            <Home className="h-4 w-4" />
            Sign in now
          </Button>
        </div>
      </div>
    );
  }

  const role = invite.role ?? "client";
  const isCrewOrAdmin = role === "crew" || role === "admin";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        {/* Header branding */}
        <div className="text-center mb-8">
          <p
            className="text-2xl font-bold text-foreground"
            style={{ fontFamily: "var(--font-serif)", letterSpacing: "-0.03em" }}
          >
            E.L.M
          </p>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
            Aster &amp; Spruce Living
          </p>
        </div>

        <Card className="shadow-lg border-border/60">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Welcome, {invite.first_name}!</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  You&apos;ve been invited as a{" "}
                  <span className="font-medium text-foreground">{ROLE_LABELS[role] ?? role}</span>
                </p>
              </div>
            </div>
            <CardDescription className="mt-1">
              Create a password to activate your{" "}
              {isCrewOrAdmin ? "team account" : "project portal"}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={invite.email} disabled className="bg-muted/40 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Create password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  minLength={8}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  required
                  minLength={8}
                />
              </div>
              <Button type="submit" className="w-full gap-2 mt-2" disabled={loading || !password || !confirmPassword}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Create account
              </Button>
            </form>
            <p className="text-center text-xs text-muted-foreground mt-4">
              Already have an account?{" "}
              <button onClick={() => navigate("/login")} className="text-primary hover:underline">
                Sign in
              </button>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
