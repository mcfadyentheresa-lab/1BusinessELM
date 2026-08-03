import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { useViewAs, ViewAsProvider } from "@/contexts/view-as";
import { usePresenceHeartbeat } from "@/hooks/use-presence";
import { toast } from "@/hooks/use-toast";
import { useEffect, useRef, lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { ThemeProvider } from "next-themes";
import { AppShell } from "@/components/layout/AppShell";
import { useBodyPointerEventsCleanup } from "@/hooks/use-body-pointer-events-cleanup";

function RoleGuard({ component: Component, allowedRoles }: { component: React.ComponentType; allowedRoles: string[] }) {
  const { user } = useAuth();
  const { previewRole } = useViewAs();
  const [, navigate] = useLocation();
  const effectiveRole = user?.role === "admin" && previewRole ? previewRole : (user?.role ?? "");
  useEffect(() => {
    if (user && !allowedRoles.includes(effectiveRole)) {
      toast({ title: "Access restricted", description: "That page isn't available for your account.", variant: "destructive" });
      navigate("/");
    }
  }, [user, effectiveRole]);
  if (!user || !allowedRoles.includes(effectiveRole)) return null;
  return <Component />;
}

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const CrewDashboard = lazy(() => import("@/pages/CrewDashboard"));
const ProjectDetails = lazy(() => import("@/pages/ProjectDetails"));
const Profile = lazy(() => import("@/pages/Profile"));
const AdminSettings = lazy(() => import("@/pages/AdminSettings"));
const ColorPortfolio = lazy(() => import("@/pages/ColorPortfolio"));
const Timesheets = lazy(() => import("@/pages/Timesheets"));
const Payroll = lazy(() => import("@/pages/Payroll"));
const CrewAndTrade = lazy(() => import("@/pages/CrewAndTrade"));
const SupplierPrices = lazy(() => import("@/pages/SupplierPrices"));
const MasterCalendar = lazy(() => import("@/pages/MasterCalendar"));
const CostEstimator = lazy(() => import("@/pages/CostEstimator"));
const EstimatesList = lazy(() => import("@/pages/EstimatesList"));
const ProjectSettings = lazy(() => import("@/pages/ProjectSettings"));
const Login = lazy(() => import("@/pages/Login"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const AcceptInvite = lazy(() => import("@/pages/AcceptInvite"));
const Welcome = lazy(() => import("@/pages/Welcome"));
const LandingPage = lazy(() => import("@/pages/LandingPage"));
const PublicPresentation = lazy(() => import("@/pages/PublicPresentation"));
const NotFound = lazy(() => import("@/pages/not-found"));

const WELCOME_KEY = "elm_welcomed";

function RouteFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function PresenceTracker() {
  usePresenceHeartbeat();
  return null;
}

function OnboardingGuard() {
  const { user } = useAuth();
  const [location, navigate] = useLocation();
  const checked = useRef(false);
  useEffect(() => {
    if (!user || checked.current || location === "/welcome") return;
    checked.current = true;
    const key = `${WELCOME_KEY}_${user.id}`;
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, "1");
      navigate("/welcome");
    }
  }, [user]);
  return null;
}

function HomeDashboard() {
  const { user } = useAuth();
  const { previewRole } = useViewAs();
  if (!user) return null;
  const effectiveRole = user.role === "admin" && previewRole ? previewRole : user.role;
  if (effectiveRole === "crew") return <CrewDashboard />;
  if (effectiveRole === "client") return <Dashboard />;
  return <Dashboard />;
}

function Router() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!user) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <Switch>
          <Route path="/login" component={Login} />
          <Route path="/forgot-password" component={ForgotPassword} />
          <Route path="/reset-password/:token" component={ResetPassword} />
          <Route path="/accept-invite/:token" component={AcceptInvite} />
          <Route path="/invite/:token" component={AcceptInvite} />
          <Route path="/p/:token" component={PublicPresentation} />
          <Route component={LandingPage} />
        </Switch>
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<RouteFallback />}>
      <OnboardingGuard />
      <Switch>
        <Route path="/welcome" component={Welcome} />
        <Route path="/login">{() => { window.location.href = "/"; return null; }}</Route>
        <Route path="/accept-invite/:token" component={AcceptInvite} />
        <Route path="/invite/:token" component={AcceptInvite} />
        <Route path="/reset-password/:token" component={ResetPassword} />
        <Route path="/p/:token" component={PublicPresentation} />
        <Route>
          {() => (
            <AppShell>
              <Switch>
                <Route path="/" component={HomeDashboard} />
                <Route path="/profile" component={Profile} />
                <Route path="/settings">{() => <RoleGuard component={AdminSettings} allowedRoles={["admin"]} />}</Route>
                <Route path="/project/:id" component={ProjectDetails} />
                <Route path="/project/:projectId/estimates" component={EstimatesList} />
                <Route path="/project/:projectId/estimate/:estimateId" component={CostEstimator} />
                <Route path="/project/:id/estimate" component={CostEstimator} />
                <Route path="/project/:id/settings" component={ProjectSettings} />
                <Route path="/colors">{() => <RoleGuard component={ColorPortfolio} allowedRoles={["admin", "crew"]} />}</Route>
                <Route path="/timesheets">{() => <RoleGuard component={Timesheets} allowedRoles={["admin", "crew"]} />}</Route>
                <Route path="/payroll">{() => <RoleGuard component={Payroll} allowedRoles={["admin"]} />}</Route>
                <Route path="/crew-and-trade">{() => <RoleGuard component={CrewAndTrade} allowedRoles={["admin", "crew"]} />}</Route>
                <Route path="/supplier-prices">{() => <RoleGuard component={SupplierPrices} allowedRoles={["admin"]} />}</Route>
                <Route path="/master-calendar">{() => <RoleGuard component={MasterCalendar} allowedRoles={["admin", "crew"]} />}</Route>
                <Route component={NotFound} />
              </Switch>
            </AppShell>
          )}
        </Route>
      </Switch>
    </Suspense>
  );
}

function GlobalEffects() {
  useBodyPointerEventsCleanup();
  return null;
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={true}>
      <QueryClientProvider client={queryClient}>
        <ViewAsProvider>
          <TooltipProvider>
            <GlobalEffects />
            <PresenceTracker />
            <Toaster />
            <Router />
          </TooltipProvider>
        </ViewAsProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
