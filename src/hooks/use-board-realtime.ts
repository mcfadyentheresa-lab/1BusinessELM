import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { CanvasElement } from "@/shared/database.types";

interface Collaborator {
  userId: string;
  name: string;
  color: string;
  profileImageUrl?: string;
  firstName?: string;
  lastName?: string;
}

interface CursorPosition {
  userId: string;
  x: number;
  y: number;
  color?: string;
  firstName?: string;
  lastName?: string;
}

const COLORS = ["#e57373", "#64b5f6", "#81c784", "#ffb74d", "#ce93d8", "#4db6ac"];

export function useBoardRealtime(boardId: number | null, user: { id: string; name?: string } | null) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [cursors, setCursors] = useState<Record<string, CursorPosition>>({});
  const [activeEdits, setActiveEdits] = useState<Record<string, { elementId: number; color?: string; firstName?: string; lastName?: string }>>({});
  const colorMapRef = useRef<Record<string, string>>({});
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  function getCollaboratorColor(userId: string): string {
    if (!colorMapRef.current[userId]) {
      const idx = Object.keys(colorMapRef.current).length % COLORS.length;
      colorMapRef.current[userId] = COLORS[idx];
    }
    return colorMapRef.current[userId];
  }

  useEffect(() => {
    if (!boardId || !user) return;
    const channel = supabase.channel(`board:${boardId}`);
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ userId: string; name: string }>();
        const collabs: Collaborator[] = Object.values(state)
          .flat()
          .filter((p) => p.userId !== user.id)
          .map((p) => ({ userId: p.userId, name: p.name, color: getCollaboratorColor(p.userId) }));
        setCollaborators(collabs);
      })
      .subscribe(async () => {
        await channel.track({ userId: user.id, name: user.name ?? "Unknown" });
      });

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [boardId, user?.id]);

  function sendElementAdd(_el: CanvasElement) {}
  function sendElementUpdate(_id: number, _patch: Partial<CanvasElement>) {}
  function sendElementRemove(_id: number) {}
  function sendElementMove(_id: number, _x: number, _y: number) {}
  function sendCursorMove(_x: number, _y: number) {}

  return {
    collaborators,
    cursors,
    activeEdits,
    getCollaboratorColor,
    sendElementAdd,
    sendElementUpdate,
    sendElementRemove,
    sendElementMove,
    sendCursorMove,
  };
}
