import { cn } from "@/lib/utils";

export interface AxisChip {
  id: string;
  label: string;
  count?: number;
  color?: string;
}

interface SecondaryAxisChipsProps {
  chips: AxisChip[];
  selected: string[];
  onToggle: (id: string) => void;
  label?: string;
  multiSelect?: boolean;
  className?: string;
}

export function SecondaryAxisChips({
  chips,
  selected,
  onToggle,
  label,
  multiSelect = true,
  className,
}: SecondaryAxisChipsProps) {
  if (chips.length === 0) return null;

  const isSelected = (id: string) => selected.includes(id);

  const handleClick = (id: string) => {
    if (!multiSelect && isSelected(id)) return;
    onToggle(id);
  };

  return (
    <div className={cn("flex items-center gap-1.5 flex-wrap", className)}>
      {label && (
        <span className="text-[10px] uppercase tracking-[0.1em] font-medium text-muted-foreground/60 mr-0.5 shrink-0">
          {label}
        </span>
      )}
      {chips.map((chip) => {
        const active = isSelected(chip.id);
        return (
          <button
            key={chip.id}
            type="button"
            onClick={() => handleClick(chip.id)}
            className={cn(
              "inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-medium transition-all select-none",
              active
                ? "bg-foreground text-background shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            )}
            aria-pressed={active}
          >
            {chip.color && (
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: chip.color }}
              />
            )}
            {chip.label}
            {chip.count != null && (
              <span className={cn("opacity-60 tabular-nums", active ? "opacity-70" : "")}>
                {chip.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
