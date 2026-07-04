import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isToday } from "date-fns";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CalendarEvent {
  id: number;
  title: string;
  date: string;
  type: string;
}

interface CalendarPanelProps {
  projectId: number;
  compact?: boolean;
  readOnly?: boolean;
  effectiveRole?: string;
}

export default function CalendarPanel({ projectId, compact }: CalendarPanelProps) {
  const [month, setMonth] = useState(new Date());

  const { data: events = [] } = useQuery<CalendarEvent[]>({
    queryKey: ["calendar-events", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .eq("project_id", projectId)
        .order("date");
      if (error) throw error;
      return (data ?? []) as CalendarEvent[];
    },
    enabled: !!projectId,
  });

  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });

  return (
    <div className={cn("space-y-2", compact && "text-sm")}>
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">{format(month, "MMMM yyyy")}</span>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setMonth(subMonths(month, 1))}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setMonth(addMonths(month, 1))}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px text-center text-[10px] text-muted-foreground mb-1">
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-px">
        {Array.from({ length: days[0].getDay() }).map((_, i) => <div key={`empty-${i}`} />)}
        {days.map((day) => {
          const dayEvents = events.filter((e) => isSameDay(new Date(e.date), day));
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "flex flex-col items-center justify-start py-0.5 rounded text-[10px] min-h-[26px]",
                isToday(day) && "bg-primary/10 font-semibold text-primary",
                dayEvents.length > 0 && "bg-muted/60"
              )}
            >
              <span>{format(day, "d")}</span>
              {dayEvents.length > 0 && (
                <span className="h-1 w-1 rounded-full bg-primary/70 mt-0.5" />
              )}
            </div>
          );
        })}
      </div>
      {events.length > 0 && (
        <ul className="mt-2 space-y-1">
          {events.slice(0, compact ? 3 : 10).map((ev) => (
            <li key={ev.id} className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">{format(new Date(ev.date), "MMM d")}</span>
              <span className="truncate">{ev.title}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
