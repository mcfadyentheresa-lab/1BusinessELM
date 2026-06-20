import { useAuth } from "@/hooks/use-auth";
import { useViewAs } from "@/contexts/view-as";

export type ViewMode = "admin" | "client" | "crew";

export function useViewMode(): { viewMode: ViewMode; isPreview: boolean } {
  const { user } = useAuth();
  const { previewRole } = useViewAs();
  const actualRole = (user as { role?: string } | null)?.role ?? "admin";

  const isAdmin = actualRole === "admin";
  const effectiveRole = isAdmin && previewRole ? previewRole : actualRole;

  const viewMode: ViewMode =
    effectiveRole === "client" ? "client" : effectiveRole === "crew" ? "crew" : "admin";

  return { viewMode, isPreview: isAdmin && previewRole !== null };
}

