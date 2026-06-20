import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useBoardSnapshots,
  useCreateBoardSnapshot,
  useRestoreBoardSnapshot,
  useDeleteBoardSnapshot,
  useRenameBoardSnapshot,
  type BoardSnapshot,
} from "@/hooks/use-projects";
import { Clock, Plus, MoreHorizontal, RotateCcw, Trash2, Pencil, GitCompare } from "lucide-react";
import type { CanvasElement } from "@/shared/database.types";
import { formatDistanceToNow } from "date-fns";

interface VersionsPopoverProps {
  boardId: number;
  currentElements: CanvasElement[];
  onRestore: (snapshot: BoardSnapshot) => void;
  onCompare: (snapshot: BoardSnapshot) => void;
  hasUnsavedChanges?: boolean;
  children: React.ReactNode;
}

export function VersionsPopover({
  boardId,
  currentElements,
  onRestore,
  onCompare,
  hasUnsavedChanges,
  children,
}: VersionsPopoverProps) {
  const { data: snapshots, isLoading } = useBoardSnapshots(boardId);
  const createSnapshot = useCreateBoardSnapshot();
  const restoreSnapshot = useRestoreBoardSnapshot();
  const deleteSnapshot = useDeleteBoardSnapshot();
  const renameSnapshot = useRenameBoardSnapshot();

  const [open, setOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BoardSnapshot | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<BoardSnapshot | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  const snapshotsArr = snapshots ?? [];

  const handleSave = async () => {
    const name = saveName.trim() || `Version ${snapshotsArr.length + 1}`;
    setSaving(true);
    try {
      await createSnapshot.mutateAsync({
        boardId,
        name,
        canvasData: { elements: currentElements },
      });
      setSaveName("");
    } finally {
      setSaving(false);
    }
  };

  const confirmRestore = async () => {
    if (!restoreTarget) return;
    await restoreSnapshot.mutateAsync({
      id: restoreTarget.id,
      boardId,
      canvasData: (restoreTarget.canvas_data as { elements?: CanvasElement[] })?.elements ?? [],
    });
    onRestore(restoreTarget);
    setRestoreTarget(null);
    setOpen(false);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteSnapshot.mutateAsync({ id: deleteTarget.id, boardId });
    setDeleteTarget(null);
  };

  const confirmRename = async (snap: BoardSnapshot) => {
    const name = editName.trim();
    if (name && name !== snap.name) {
      await renameSnapshot.mutateAsync({ id: snap.id, boardId, name });
    }
    setEditingId(null);
    setEditName("");
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{children}</PopoverTrigger>
        <PopoverContent side="bottom" align="end" className="w-72 p-0 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm font-medium">Versions</span>
              {hasUnsavedChanges && (
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" title="Unsaved changes" />
              )}
            </div>
            <span className="text-xs text-muted-foreground">{snapshotsArr.length} saved</span>
          </div>

          {/* Save new */}
          <div className="flex gap-1.5 p-2.5 border-b border-border bg-muted/30">
            <Input
              placeholder={`Version ${snapshotsArr.length + 1}`}
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              className="h-7 text-xs flex-1"
            />
            <Button
              size="sm"
              className="h-7 px-2.5 gap-1 text-xs"
              onClick={handleSave}
              disabled={saving}
            >
              <Plus className="h-3 w-3" />
              Save
            </Button>
          </div>

          {/* Snapshot list */}
          <div className="max-h-60 overflow-y-auto">
            {isLoading ? (
              <div className="p-3 space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
              </div>
            ) : snapshotsArr.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-center px-4">
                <Clock className="h-7 w-7 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">No saved versions yet</p>
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {snapshotsArr.map((snap) => (
                  <li key={snap.id} className="group flex items-center gap-2 px-3 py-2 hover:bg-muted/40 transition-colors">
                    <div className="flex-1 min-w-0">
                      {editingId === snap.id ? (
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") confirmRename(snap);
                            if (e.key === "Escape") { setEditingId(null); setEditName(""); }
                          }}
                          onBlur={() => confirmRename(snap)}
                          className="h-6 text-xs"
                          autoFocus
                        />
                      ) : (
                        <>
                          <p className="text-xs font-medium truncate text-foreground">{snap.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(snap.created_at), { addSuffix: true })}
                          </p>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        title="Compare"
                        onClick={() => { onCompare(snap); setOpen(false); }}
                      >
                        <GitCompare className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        title="Restore"
                        onClick={() => setRestoreTarget(snap)}
                      >
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            <MoreHorizontal className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36">
                          <DropdownMenuItem onClick={() => { setEditingId(snap.id); setEditName(snap.name); }}>
                            <Pencil className="h-3.5 w-3.5 mr-2" />Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeleteTarget(snap)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" />Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Restore confirmation */}
      <AlertDialog open={!!restoreTarget} onOpenChange={(o) => !o && setRestoreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore "{restoreTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace the current board state with this saved version. Save the current version first if you want to keep it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRestore}>Restore</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This saved version will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
