import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/shared/database.types";

export interface AuthUser extends Profile {}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
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
      // Profile RLS blocked the read — build a minimal user from session metadata
      const meta = session.user.user_metadata ?? {};
      setUser({
        id: session.user.id,
        email: session.user.email ?? "",
        name: meta.name ?? session.user.email?.split("@")[0] ?? "",
        role: meta.role ?? "crew",
        phone: null,
        avatar_url: null,
        created_at: session.user.created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } else {
      setUser(null);
    }
    setIsLoading(false);
  }

  return { user, isLoading };
}
