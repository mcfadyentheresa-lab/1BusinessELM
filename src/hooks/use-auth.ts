import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/shared/database.types";

export type AuthUser = Profile;

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
}

// role must come from app_metadata (server-controlled via the
// sync_profile_role_to_app_metadata trigger), never user_metadata, which
// any authenticated user can overwrite via supabase.auth.updateUser().
// See supabase/migrations/20260608001656_fix_rls_use_app_metadata_not_user_metadata.sql
// for the same fix applied at the RLS layer.
export function buildFallbackUser(user: User): AuthUser {
  const meta = user.user_metadata ?? {};
  return {
    id: user.id,
    email: user.email ?? "",
    name: meta.name ?? user.email?.split("@")[0] ?? "",
    role: user.app_metadata?.role ?? "crew",
    phone: null,
    avatar_url: null,
    created_at: user.created_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setIsLoading(false);
      }
    }).catch(() => {
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        setUser(null);
        setIsLoading(false);
      } else if (session?.user) {
        fetchProfile(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    const { data: { session } } = await supabase.auth.getSession();
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (data) {
      setUser(data);
    } else if (session?.user) {
      // Profile RLS blocked the read — build a minimal user from session metadata.
      setUser(buildFallbackUser(session.user));
    } else {
      setUser(null);
    }
    setIsLoading(false);
  }

  return { user, isLoading };
}
