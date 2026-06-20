import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

export function usePresenceHeartbeat() {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return;

      const channel = supabase.channel("presence:global", {
        config: { presence: { key: session.user.id } },
      });

      channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: session.user.id,
            online_at: new Date().toISOString(),
          });
        }
      });

      channelRef.current = channel;
    });

    return () => {
      channelRef.current?.unsubscribe();
    };
  }, []);
}
