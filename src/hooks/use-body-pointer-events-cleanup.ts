import { useEffect } from "react";

export function useBodyPointerEventsCleanup() {
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const style = document.body.getAttribute("style") || "";
      if (style.includes("pointer-events: none")) {
        const hasOpenModal =
          document.querySelector('[role="dialog"][data-state="open"]') ||
          document.querySelector('[data-radix-popper-content-wrapper]') ||
          document.querySelector('[data-state="open"]');
        if (!hasOpenModal) {
          document.body.style.pointerEvents = "";
        }
      }
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["style"],
    });

    return () => observer.disconnect();
  }, []);
}
