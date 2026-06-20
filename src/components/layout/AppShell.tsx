import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useViewAs } from "@/contexts/view-as";
import { supabase } from "@/lib/supabase";
import { cn, initials } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import {
  LayoutDashboard,
  Palette,
  Clock,
  DollarSign,
  Users,
  Calendar,
  Settings,
  LogOut,
  Sofa,
  ShoppingCart,
  Menu,
  Moon,
  Sun,
  User,
  History,
  ArrowLeft,
  Eye,
  X,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: string[];
}

const NAV_GROUPS = [
  {
    label: "Operations",
    items: [
      { href: "/master-calendar", label: "Master Calendar", icon: Calendar, roles: ["admin", "crew"] },
      { href: "/timesheets", label: "Log Hours", icon: Clock, roles: ["admin", "crew"] },
      { href: "/payroll", label: "Payroll", icon: DollarSign, roles: ["admin"] },
      { href: "/colors", label: "Colour Portfolio", icon: Palette, roles: ["admin", "crew"] },
      { href: "/crew-and-trade", label: "Crew & Trade", icon: Users, roles: ["admin", "crew"] },
    ],
  },
  {
    label: "Resources",
    items: [
      { href: "/supplier-prices", label: "Supplier Prices", icon: ShoppingCart, roles: ["admin"] },
      { href: "/table-redesign", label: "Furniture Planner", icon: Sofa, roles: ["admin"] },
    ],
  },
  {
    label: "Personal",
    items: [
      { href: "/profile", label: "Profile", icon: User, roles: ["admin", "crew", "client"] },
      { href: "/settings", label: "Settings", icon: Settings, roles: ["admin"] },
    ],
  },
];

const PREVIEW_ROLES = [
  { value: "client", label: "Client view" },
  { value: "crew", label: "Crew view" },
] as const;

function NavLink({ href, label, icon: Icon, active }: NavItem & { active: boolean }) {
  return (
    <Link href={href}>
      <span className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors w-full cursor-pointer",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          : "text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
      )}>
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{label}</span>
      </span>
    </Link>
  );
}

function DarkModeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      aria-label="Toggle dark mode"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { previewRole, setPreviewRole } = useViewAs();
  const [location, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = user?.role === "admin";
  const isPreview = isAdmin && previewRole !== null;
  // The role used for nav filtering — real role when not previewing
  const effectiveRole = isAdmin && previewRole ? previewRole : (user?.role ?? "admin");

  const isProjectPage = /^\/project\/\d+/.test(location);

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  const { data: recentProjects } = useQuery({
    queryKey: ["recent-projects-nav"],
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, name")
        .in("status", ["active", "planning"])
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const isActive = (href: string) =>
    href === "/" ? location === "/" : location.startsWith(href);

  const filteredGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.roles.includes(effectiveRole)),
  })).filter((g) => g.items.length > 0);

  const sidebarContent = (
    <div className={cn(
      "flex h-full flex-col bg-sidebar text-sidebar-foreground select-none",
      isPreview && "ring-2 ring-inset ring-amber-400/40"
    )}>
      {/* Wordmark */}
      <div className="px-4 pt-5 pb-4">
        <Link href="/">
          <span className="block cursor-pointer">
            <p
              className="text-sidebar-foreground text-xl font-bold tracking-tight leading-none"
              style={{ fontFamily: "var(--font-serif)", letterSpacing: "-0.03em" }}
            >
              E.L.M
            </p>
            <p className="text-sidebar-foreground/40 text-[9px] uppercase tracking-[0.18em] mt-0.5 font-sans font-medium">
              Aster &amp; Spruce Living
            </p>
          </span>
        </Link>
      </div>

      {/* Dashboard link */}
      <div className="px-3 mb-1">
        <Link href="/">
          <span className={cn(
            "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors w-full cursor-pointer",
            isActive("/") && location === "/"
              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
              : "text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
          )}>
            <LayoutDashboard className="h-4 w-4 shrink-0" />
            <span>Dashboard</span>
          </span>
        </Link>
      </div>

      <ScrollArea className="flex-1 px-3">
        <div className="space-y-5 pb-4">
          {filteredGroups.map((group) => (
            <div key={group.label}>
              <p className="text-sidebar-foreground/30 text-[10px] uppercase tracking-[0.12em] font-semibold px-2.5 mb-1 font-sans">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.href}
                    {...item}
                    active={isActive(item.href)}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Recent projects — only show for admin/crew views */}
          {effectiveRole !== "client" && (recentProjects ?? []).length > 0 && (
            <div>
              <p className="text-sidebar-foreground/30 text-[10px] uppercase tracking-[0.12em] font-semibold px-2.5 mb-1 font-sans">
                Recent
              </p>
              <div className="space-y-0.5">
                {(recentProjects ?? []).map((p: any) => (
                  <Link key={p.id} href={`/project/${p.id}`}>
                    <span className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors w-full cursor-pointer",
                      isActive(`/project/${p.id}`)
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        : "text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                    )}>
                      <History className="h-4 w-4 shrink-0 opacity-60" />
                      <span className="truncate">{p.name}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Admin preview switcher */}
      {isAdmin && (
        <div className="border-t border-sidebar-border px-3 py-3">
          <p className="text-sidebar-foreground/30 text-[9px] uppercase tracking-widest mb-2 font-semibold">
            Preview as
          </p>
          <div className="flex gap-1.5">
            {PREVIEW_ROLES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setPreviewRole(previewRole === value ? null : value as "client" | "crew")}
                className={cn(
                  "flex-1 rounded-md py-1 text-[10px] font-medium transition-colors border",
                  previewRole === value
                    ? "bg-amber-400/20 text-amber-700 border-amber-400/40 dark:text-amber-300"
                    : "bg-sidebar-accent/30 text-sidebar-foreground/50 border-transparent hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                {label.split(" ")[0]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* User */}
      <div className="border-t border-sidebar-border px-3 py-3">
        {user && (
          <div className="flex items-center gap-2.5">
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarImage src={user.avatar_url ?? undefined} />
              <AvatarFallback className="text-[10px] bg-sidebar-accent text-sidebar-accent-foreground">
                {initials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-sidebar-foreground truncate">{user.name}</p>
              <p className="text-[10px] text-sidebar-foreground/40 capitalize">{user.role}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="shrink-0 text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors p-1 rounded"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col shrink-0 w-[180px] border-r border-sidebar-border">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative z-10 w-[180px] flex flex-col">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main content area */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Preview banner */}
        {isPreview && (
          <div className="flex items-center justify-between gap-3 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/50 px-4 py-2 shrink-0">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
              <Eye className="h-3.5 w-3.5 shrink-0" />
              <span className="text-xs font-medium">
                Previewing as <span className="capitalize font-semibold">{previewRole}</span> — this is what {previewRole === "client" ? "a client" : "crew members"} see
              </span>
            </div>
            <button
              onClick={() => setPreviewRole(null)}
              className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 font-medium transition-colors shrink-0"
            >
              <X className="h-3.5 w-3.5" />
              Exit preview
            </button>
          </div>
        )}

        {/* Top bar */}
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4 bg-background">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-8 w-8"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-4 w-4" />
          </Button>
          {isProjectPage && (
            <button
              onClick={() => navigate("/")}
              className="hidden md:flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>All projects</span>
            </button>
          )}
          <div className="flex-1" />
          <div className="flex items-center gap-1">
            <DarkModeToggle />
            <Avatar className="h-7 w-7 cursor-pointer ml-1">
              <AvatarImage src={user?.avatar_url ?? undefined} />
              <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">
                {user ? initials(user.name).slice(0, 1) : "?"}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
