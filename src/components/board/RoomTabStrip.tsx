import { useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  GripHorizontal,
  FileText,
  Sparkles,
  DollarSign,
} from "lucide-react";
import type { CanvasElement } from "@/shared/database.types";
import {
  isRoomable,
  orderRooms,
  ROOM_STATUSES,
  type RoomStatus,
  computeRoomBudget,
  countByStatus,
  formatCad,
  resolveRoomFor,
} from "@/lib/board-rooms";

interface RoomTabStripProps {
  elements: CanvasElement[];
  activeRoom: string | null;
  onRoomChange: (room: string | null) => void;
  activeStatus: RoomStatus | null;
  onStatusChange: (status: RoomStatus | null) => void;
  savedRoomOrder: string[];
  onRoomOrderChange: (order: string[]) => void;
  onAddRoom: (name: string) => void;
  onRenameRoom: (oldName: string, newName: string) => void;
  onDeleteRoom: (name: string) => void;
  onRenderRoom?: (room: string) => void;
  onExportSpec?: (room: string) => void;
}

const STATUS_COLORS: Record<RoomStatus, string> = {
  idea: "bg-muted text-muted-foreground",
  shortlist: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  selected: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  ordered: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
};

const STATUS_LABELS: Record<RoomStatus, string> = {
  idea: "Idea",
  shortlist: "Shortlist",
  selected: "Selected",
  ordered: "Ordered",
};

export function RoomTabStrip({
  elements,
  activeRoom,
  onRoomChange,
  activeStatus,
  onStatusChange,
  savedRoomOrder,
  onRoomOrderChange,
  onAddRoom,
  onRenameRoom,
  onDeleteRoom,
  onRenderRoom,
  onExportSpec,
}: RoomTabStripProps) {
  const [addingRoom, setAddingRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [editingRoom, setEditingRoom] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [dragOver, setDragOver] = useState<string | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Derive rooms from elements
  const roomSet = new Set<string>();
  for (const el of elements) {
    if (isRoomable(el)) {
      const r = resolveRoomFor(el, elements);
      if (r) roomSet.add(r);
    }
  }
  const rooms = orderRooms(Array.from(roomSet), savedRoomOrder);

  useEffect(() => { if (addingRoom) addInputRef.current?.focus(); }, [addingRoom]);
  useEffect(() => { if (editingRoom) editInputRef.current?.focus(); }, [editingRoom]);

  const confirmAdd = () => {
    const name = newRoomName.trim();
    if (name) {
      onAddRoom(name);
      onRoomOrderChange([...savedRoomOrder, name]);
    }
    setAddingRoom(false);
    setNewRoomName("");
  };

  const confirmRename = () => {
    const name = editName.trim();
    if (name && editingRoom && name !== editingRoom) {
      onRenameRoom(editingRoom, name);
      const next = savedRoomOrder.map((r) => (r === editingRoom ? name : r));
      onRoomOrderChange(next);
    }
    setEditingRoom(null);
    setEditName("");
  };

  // Drag-to-reorder
  const dragRoomRef = useRef<string | null>(null);

  const handleDragStart = (room: string) => { dragRoomRef.current = room; };
  const handleDragOver = (room: string, e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(room);
  };
  const handleDrop = (target: string) => {
    const src = dragRoomRef.current;
    if (!src || src === target) { setDragOver(null); return; }
    const cur = [...(savedRoomOrder.length ? savedRoomOrder : rooms)];
    const srcIdx = cur.indexOf(src);
    const tgtIdx = cur.indexOf(target);
    if (srcIdx === -1 || tgtIdx === -1) { setDragOver(null); return; }
    const next = [...cur];
    next.splice(srcIdx, 1);
    next.splice(tgtIdx, 0, src);
    onRoomOrderChange(next);
    setDragOver(null);
  };

  const budget = activeRoom !== undefined ? computeRoomBudget(elements, activeRoom) : null;
  const counts = activeRoom !== undefined ? countByStatus(elements, activeRoom) : null;

  return (
    <div className="flex flex-col gap-0 border-b border-border bg-background/95 backdrop-blur-sm">
      {/* Room tabs row */}
      <div className="flex items-center gap-0.5 px-2 pt-2 overflow-x-auto scrollbar-none">
        {/* All rooms tab */}
        <button
          type="button"
          onClick={() => onRoomChange(null)}
          className={`shrink-0 px-3 h-8 rounded-t-md text-xs font-medium transition-colors border-b-2 ${
            activeRoom === null
              ? "border-primary text-foreground bg-background"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          All rooms
        </button>

        {rooms.map((room) => (
          editingRoom === room ? (
            <div key={room} className="flex items-center shrink-0">
              <Input
                ref={editInputRef}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirmRename();
                  if (e.key === "Escape") { setEditingRoom(null); setEditName(""); }
                }}
                onBlur={confirmRename}
                className="h-7 text-xs w-28 rounded-t-md rounded-b-none"
              />
            </div>
          ) : (
            <div
              key={room}
              draggable
              onDragStart={() => handleDragStart(room)}
              onDragOver={(e) => handleDragOver(room, e)}
              onDrop={() => handleDrop(room)}
              onDragLeave={() => setDragOver(null)}
              className={`group shrink-0 flex items-center gap-1 px-2.5 h-8 rounded-t-md text-xs font-medium cursor-pointer transition-colors border-b-2 ${
                activeRoom === room
                  ? "border-primary text-foreground bg-background"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted"
              } ${dragOver === room ? "bg-primary/10" : ""}`}
              onClick={() => onRoomChange(room)}
            >
              <GripHorizontal className="h-2.5 w-2.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
              <span>{room}</span>
              {counts && (
                <span className={`text-[10px] px-1 rounded-full ${activeRoom === room ? "bg-primary/15 text-primary" : "bg-muted"}`}>
                  {Object.values(counts).reduce((a, b) => a + b, 0)}
                </span>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="opacity-0 group-hover:opacity-100 transition-opacity ml-0.5"
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Room actions"
                  >
                    <MoreHorizontal className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-40">
                  <DropdownMenuItem onClick={() => { setEditingRoom(room); setEditName(room); }}>
                    <Pencil className="h-3.5 w-3.5 mr-2" />Rename
                  </DropdownMenuItem>
                  {onRenderRoom && (
                    <DropdownMenuItem onClick={() => onRenderRoom(room)}>
                      <Sparkles className="h-3.5 w-3.5 mr-2" />AI Render
                    </DropdownMenuItem>
                  )}
                  {onExportSpec && (
                    <DropdownMenuItem onClick={() => onExportSpec(room)}>
                      <FileText className="h-3.5 w-3.5 mr-2" />Export spec
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={() => onDeleteRoom(room)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" />Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        ))}

        {/* Add room */}
        {addingRoom ? (
          <div className="flex items-center shrink-0 ml-0.5">
            <Input
              ref={addInputRef}
              placeholder="Room name"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmAdd();
                if (e.key === "Escape") { setAddingRoom(false); setNewRoomName(""); }
              }}
              onBlur={confirmAdd}
              className="h-7 text-xs w-28"
            />
          </div>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setAddingRoom(true)}
                className="shrink-0 h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors ml-0.5"
                aria-label="Add room"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Add room</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Status filter + budget row */}
      <div className="flex items-center justify-between px-3 py-1.5 gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onStatusChange(null)}
            className={`h-5 px-2 rounded-full text-[10px] font-medium transition-colors ${
              activeStatus === null
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            All
          </button>
          {ROOM_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onStatusChange(activeStatus === s ? null : s)}
              className={`h-5 px-2 rounded-full text-[10px] font-medium transition-colors ${
                activeStatus === s
                  ? STATUS_COLORS[s]
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {STATUS_LABELS[s]}
              {counts && <span className="ml-1 opacity-60">{counts[s]}</span>}
            </button>
          ))}
        </div>

        {budget && budget.total > 0 && (
          <div className="flex items-center gap-1.5 shrink-0">
            <DollarSign className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {formatCad(budget.total)}
              {budget.selected > 0 && (
                <span className="text-amber-600 ml-1">({formatCad(budget.selected)} selected)</span>
              )}
              {budget.hasMixedCurrency && (
                <span className="text-[10px] ml-1 text-muted-foreground/60">mixed currency</span>
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
