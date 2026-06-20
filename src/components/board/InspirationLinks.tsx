/**
 * InspirationLinks — toolbar quick-launch buttons for Pinterest and Houzz.
 */
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface InspirationLinksProps {
  variant?: "desktop" | "mobile";
}

const PINTEREST_URL = "https://www.pinterest.com";
const HOUZZ_URL = "https://www.houzz.com";

const openUrl = (url: string) => window.open(url, "_blank", "noopener,noreferrer");

function PinterestGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.5 2 2 6.5 2 12c0 4.2 2.6 7.8 6.3 9.3-.1-.8-.2-2 0-2.9.2-.8 1.3-5.5 1.3-5.5s-.3-.7-.3-1.7c0-1.6.9-2.8 2.1-2.8 1 0 1.5.7 1.5 1.6 0 1-.6 2.4-1 3.8-.3 1.1.6 2.1 1.7 2.1 2.1 0 3.7-2.2 3.7-5.4 0-2.8-2-4.8-4.9-4.8-3.4 0-5.3 2.5-5.3 5.1 0 1 .4 2.1.9 2.7.1.1.1.2.1.3-.1.4-.3 1.1-.3 1.3 0 .2-.2.3-.4.2-1.4-.7-2.3-2.7-2.3-4.3 0-3.5 2.6-6.8 7.4-6.8 3.9 0 6.9 2.8 6.9 6.5 0 3.9-2.4 7-5.8 7-1.1 0-2.2-.6-2.6-1.3l-.7 2.7c-.3 1-.9 2.3-1.4 3.1 1.1.3 2.2.5 3.4.5 5.5 0 10-4.5 10-10S17.5 2 12 2z" />
    </svg>
  );
}

function HouzzGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="6" y1="3" x2="6" y2="21" />
      <line x1="18" y1="11" x2="18" y2="21" />
      <line x1="6" y1="11" x2="18" y2="11" />
    </svg>
  );
}

export function InspirationLinks({ variant = "desktop" }: InspirationLinksProps) {
  if (variant === "mobile") {
    return (
      <>
        <button
          onClick={(e) => { e.stopPropagation(); openUrl(PINTEREST_URL); }}
          className="h-11 w-11 flex items-center justify-center rounded-full text-foreground/60 active:bg-foreground/10 active:text-primary shrink-0"
          data-testid="mobile-pinterest"
          aria-label="Open Pinterest"
        >
          <PinterestGlyph className="h-5 w-5" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); openUrl(HOUZZ_URL); }}
          className="h-11 w-11 flex items-center justify-center rounded-full text-foreground/60 active:bg-foreground/10 active:text-primary shrink-0"
          data-testid="mobile-houzz"
          aria-label="Open Houzz"
        >
          <HouzzGlyph className="h-5 w-5" />
        </button>
      </>
    );
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-foreground/60 hover:bg-primary/10 hover:text-primary"
            onClick={() => openUrl(PINTEREST_URL)}
            data-testid="button-pinterest"
            aria-label="Open Pinterest"
          >
            <PinterestGlyph className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">Open Pinterest</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-foreground/60 hover:bg-primary/10 hover:text-primary"
            onClick={() => openUrl(HOUZZ_URL)}
            data-testid="button-houzz"
            aria-label="Open Houzz"
          >
            <HouzzGlyph className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">Open Houzz</TooltipContent>
      </Tooltip>
    </>
  );
}
