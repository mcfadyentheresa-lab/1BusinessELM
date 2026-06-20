import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  const [, navigate] = useLocation();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <p
        className="text-8xl font-bold text-muted-foreground/30 mb-4"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        404
      </p>
      <h1 className="text-2xl font-semibold text-foreground mb-2">Page not found</h1>
      <p className="text-muted-foreground mb-8 max-w-md">
        The page you're looking for doesn't exist or you may not have access.
      </p>
      <Button onClick={() => navigate("/")} variant="outline" className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Button>
    </div>
  );
}
